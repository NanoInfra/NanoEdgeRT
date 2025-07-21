import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

export { assertEquals, assertExists, assertRejects };

export interface TestContext {
  name: string;
  only?: boolean;
  ignore?: boolean;
  sanitizeOps?: boolean;
  sanitizeResources?: boolean;
}

export function createTestServer(port: number = 8000): {
  start: () => Promise<void>;
  stop: () => void;
  url: string;
} {
  let abortController: AbortController | undefined;

  return {
    url: `http://0.0.0.0:${port}`,
    start: async () => {
      abortController = new AbortController();
      // Server implementation would go here
    },
    stop: () => {
      if (abortController) {
        abortController.abort();
      }
    },
  };
}

export async function waitForServer(url: string, timeout: number = 5000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

export function createMockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    method: "GET",
    ...options,
  });
}

export async function assertJsonResponse(
  response: Response,
  expectedStatus: number = 200,
  expectedData?: any,
): Promise<any> {
  assertEquals(response.status, expectedStatus);
  assertEquals(response.headers.get("content-type"), "application/json");

  const data = await response.json();

  if (expectedData) {
    assertEquals(data, expectedData);
  }

  return data;
}
