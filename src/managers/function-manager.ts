import { DatabaseContext } from "../../database/config.ts";
import { FunctionConfig } from "../../database/tables/functions.ts";

export interface FunctionManagerState {
  functions: Map<string, FunctionConfig>;
  dbContext: DatabaseContext;
}

export function createFunctionManagerState(
  dbContext: DatabaseContext,
): FunctionManagerState {
  const functions = new Map<string, FunctionConfig>();
  return {
    functions,
    dbContext,
  };
}

export function getFunction(
  state: FunctionManagerState,
  functionName: string,
): FunctionConfig | undefined {
  return state.functions.get(functionName);
}

export function getAllFunctions(
  state: FunctionManagerState,
): object[] {
  return Array.from(state.functions.values()).map((f) => (
    {
      ...f,
      code: undefined, // Do not expose code in API
    }
  ));
}

export async function execFunction(
  state: FunctionManagerState,
  functionConfig: FunctionConfig,
  params: object,
): Promise<Response> {
  try {
    // Check if function already has an allocated port
    state.functions.set(functionConfig.name, functionConfig);

    // Functions must have code from database - no file-based functions
    if (!functionConfig.code) {
      throw new Error("Function code is required - file-based functions are not supported");
    }

    const functionCode = functionConfig.code;
    const staticDir = new URL(`../../static/${functionConfig.name}/`, import.meta.url);
    const handlerCode = `
globalThis.staticDir = "${staticDir.toString()}";

${functionCode}
`;
    const handlerURI = "data:application/javascript," + encodeURIComponent(handlerCode);

    const workerAdapterCode = `
let __handler;
try {
  __handler = (await import(\`${handlerURI}\`)).default;
} catch (error) {
  self.postMessage({
    type: "error",
    message: error.message || "Failed to load function",
    stack: error.stack,
  });
}

if (typeof __handler !== "function") {
  console.log(__handler);
  self.postMessage({
    type: "error",
    message: "No default export found or default export is not a function",
  });
}

const is_html = (t) => (/<\\/?[a-z][\\s\\S]*>/i.test(t));
const is_json = (t) => {
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};

self.onmessage = async (event) => {
  if (typeof event.data === "object" && event.data !== null) {
    try {
      const res = await __handler(event.data);
      // check if res is a generator
      if (res && typeof res.next === "function") {
        self.postMessage({
          contentType: "text/event-stream",
        });
        const generator = res;
        while (true) {
          const { value, done } = await generator.next();
          if (done) {
            self.postMessage({
              type: "stream-result",
              value,
            });
            break;
          }
          // post the value back to the main thread
          self.postMessage({
            type: "progress",
            value,
          });
        }
      } else if (res) {
        if (is_html(res)) {
          self.postMessage({
            contentType: "text/html",
          });
        } else if (is_json(res)) {
          self.postMessage({
            contentType: "application/json",
          });
        } else {
          self.postMessage({
            contentType: "text/plain",
          });
        }
        self.postMessage({
          type: "result",
          value: res,
        });
      } else {
        self.postMessage({
          contentType: "text/plain",
        });
        self.postMessage({
          type: "result",
          value: null,
        });
      }
    } catch (error) {
      // Send error back to main thread
      self.postMessage({
        type: "error",
        message: error.message || "Unknown error",
        stack: error.stack,
      });
    }
  }
};

  `;

    // Create worker with appropriate permissions
    const worker = new Worker(
      URL.createObjectURL(new Blob([workerAdapterCode], { type: "application/javascript" })),
      {
        type: "module",
        deno: {
          permissions: {
            net: true,
            read: functionConfig.permissions?.read.map((urlString) => new URL(urlString)) || [],
            write: functionConfig.permissions?.write || [],
            env: functionConfig.permissions?.env || [],
            run: functionConfig.permissions?.run || [],
          },
        },
      },
    );

    let streamController: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
    });

    worker.postMessage(params);
    return await new Promise((resolve, reject) => {
      worker.addEventListener("message", (event) => {
        if (event.data.type === "error") {
          reject(new Error(`Function execution error: ${event.data.message}`));
        }

        // handle response
        if (event.data.contentType) {
          if (event.data.contentType === "text/event-stream") {
            resolve(
              new Response(stream, {
                headers: {
                  "Content-Type": event.data.contentType,
                },
              }),
            );
          }
        }

        if (event.data.type === "progress") {
          streamController.enqueue(`data: ${JSON.stringify(event.data.value)}\n\n`);
        }

        if (event.data.type === "stream-result") {
          streamController.enqueue(
            `data: [DONE]${event.data.value ? JSON.stringify(event.data.value) : ""}\n\n`,
          );
          streamController.close();
          worker.terminate();
        }

        if (event.data.type === "result") {
          streamController.close();
          worker.terminate();
          resolve(
            new Response(JSON.stringify(event.data.value), {
              headers: {
                "Content-Type": "application/json",
              },
            }),
          );
        }
      });
    });
  } catch (error) {
    // console.error(`Failed to execute function ${functionConfig.name}:`, error);
    return new Response(`Internal Server Error: ${error}`, {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
