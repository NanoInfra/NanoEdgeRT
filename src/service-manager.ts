import { DatabaseContext, loadConfig, ServiceConfig } from "../database/dto.ts";
import { allocatePort, getServicePort, releasePort } from "../database/sqlite3.ts";

export interface ServiceInstance {
  config: ServiceConfig;
  worker?: Worker;
  port: number;
  status: "starting" | "running" | "stopped" | "error";
}

export interface ServiceManagerState {
  services: Map<string, ServiceInstance>;
  dbContext: DatabaseContext;
}

export function createServiceManagerState(
  dbContext: DatabaseContext,
): ServiceManagerState {
  const services = new Map<string, ServiceInstance>();
  return {
    services,
    dbContext,
  };
}

export function getService(
  state: ServiceManagerState,
  serviceName: string,
): ServiceInstance | undefined {
  return state.services.get(serviceName);
}

export function getAllServices(
  state: ServiceManagerState,
): ServiceInstance[] {
  return Array.from(state.services.values());
}

export async function startService(
  state: ServiceManagerState,
  serviceConfig: ServiceConfig,
): Promise<ServiceInstance> {
  if (state.services.has(serviceConfig.name)) {
    console.log(`Service ${serviceConfig.name} already running`);
    return state.services.get(serviceConfig.name)!;
  }

  try {
    // Check if service already has an allocated port
    let port = await getServicePort(serviceConfig.name, state.dbContext.dbInstance);

    // If no port allocated, allocate a new one
    if (!port) {
      port = await allocatePort(serviceConfig.name, state.dbContext.dbInstance);
    }

    const serviceInstance: ServiceInstance = {
      config: serviceConfig,
      port,
      status: "starting",
    };

    state.services.set(serviceConfig.name, serviceInstance);

    // Services must have code from database - no file-based services
    if (!serviceConfig.code) {
      throw new Error("Service code is required - file-based services are not supported");
    }

    const serviceCode = serviceConfig.code;

    // Create worker adapter code that safely executes the database-stored code
    const workerAdapterCode = `
// User service code (from database)
${serviceCode}

let __handler;

// Try to find the handler function from the executed code
if (typeof defaultExport !== 'undefined') {
  __handler = defaultExport;
} else if (typeof handler !== 'undefined') {
  __handler = handler;
} else if (typeof main !== 'undefined') {
  __handler = main;
} else {
  throw new Error('No handler function found. Please export a function named "handler", "main", or use "defaultExport".');
}

if (typeof __handler !== 'function') {
  throw new Error('Handler must be a function');
}

const __handler_rewriter = async (req) => {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(s => s);
  
  // Remove service name from path
  if (pathSegments[0] === "${serviceConfig.name}") {
    pathSegments.shift();
  }
  
  const newPath = "/" + pathSegments.join("/");
  const rewrittenUrl = "http://${serviceConfig.name}" + newPath + url.search;
  
  const newReq = new Request(rewrittenUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    credentials: req.credentials,
  });
  
  return await __handler(newReq);
};

const ____AC = new AbortController();

// Handle server startup
(async () => {
  try {
    console.log("Starting service ${serviceConfig.name} on port ${port}");
    
    await Deno.serve({
      port: ${port},
      signal: ____AC.signal,
    }, async (req) => {
      try {
        return await __handler_rewriter(req);
      } catch (error) {
        console.error("Request error:", error);
        return new Response(
          JSON.stringify({ error: error.message || String(error) }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }).finished;
  } catch (error) {
    self.postMessage({
      type: "startup_error",
      error: error.message || String(error),
    });
  }
})();

self.onmessage = async (event) => {
  if (event.data === "stop") {
    console.log("Stopping ${serviceConfig.name}");
    ____AC.abort();
    self.close();
    return;
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
            read: serviceConfig.permissions?.read || [],
            write: serviceConfig.permissions?.write || [],
            env: serviceConfig.permissions?.env || [],
            run: serviceConfig.permissions?.run || [],
          },
        },
      },
    );

    worker.addEventListener("message", (event) => {
      if (event.data.type === "startup_error") {
        console.error(`Service ${serviceConfig.name} startup error:`, event.data.error);
        serviceInstance.status = "error";
      }
    });

    worker.addEventListener("error", async (error) => {
      console.error(`Worker error for ${serviceConfig.name}:`, error);
      serviceInstance.status = "error";
      await releasePort(serviceConfig.name, state.dbContext.dbInstance);
    });

    serviceInstance.worker = worker;
    serviceInstance.status = "running";

    console.log(`✅ Service ${serviceConfig.name} started on port ${port}`);
    return serviceInstance;
  } catch (error) {
    console.error(`Failed to start service ${serviceConfig.name}:`, error);
    await releasePort(serviceConfig.name, state.dbContext.dbInstance);
    state.services.delete(serviceConfig.name);
    throw error;
  }
}

export async function stopService(
  state: ServiceManagerState,
  serviceName: string,
): Promise<void> {
  const service = state.services.get(serviceName);
  if (!service) {
    console.log(`Service ${serviceName} not found`);
    return;
  }

  if (service.worker) {
    service.worker.postMessage("stop");
    service.worker.terminate();
  }

  await releasePort(serviceName, state.dbContext.dbInstance);
  state.services.delete(serviceName);
  console.log(`Stopped service ${serviceName}`);
}

export async function stopAllServices(
  state: ServiceManagerState,
): Promise<void> {
  for (const serviceName of state.services.keys()) {
    await stopService(state, serviceName);
  }
  console.log("All services stopped");
}
