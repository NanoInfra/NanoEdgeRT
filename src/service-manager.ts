import { ServiceConfig, ServiceInstance } from "./types.ts";
import { allocatePort, releasePort, getServicePort } from "../database/sqlite3.ts";
import type { Kysely } from "kysely";
import type { Database } from "../database/sqlite3.ts";

export class ServiceManager {
  private services: Map<string, ServiceInstance> = new Map();
  private dbInstance?: Kysely<Database>;

  constructor(dbInstance?: Kysely<Database>) {
    this.dbInstance = dbInstance;
  }

  // Build service method removed - no file-based services supported

  async startService(serviceConfig: ServiceConfig): Promise<void> {
    if (this.services.has(serviceConfig.name)) {
      console.log(`Service ${serviceConfig.name} already running`);
      return;
    }

    try {
      // Check if service already has an allocated port
      let port = await getServicePort(serviceConfig.name, this.dbInstance);
      
      // If no port allocated, allocate a new one
      if (!port) {
        port = await allocatePort(serviceConfig.name, this.dbInstance);
      }

      const serviceInstance: ServiceInstance = {
        config: serviceConfig,
        port,
        status: "starting",
      };

      this.services.set(serviceConfig.name, serviceInstance);

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
        await releasePort(serviceConfig.name, this.dbInstance);
      });

      serviceInstance.worker = worker;
      serviceInstance.status = "running";

      console.log(`✅ Service ${serviceConfig.name} started on port ${port}`);
    } catch (error) {
      console.error(`Failed to start service ${serviceConfig.name}:`, error);
      await releasePort(serviceConfig.name, this.dbInstance);
      this.services.delete(serviceConfig.name);
      throw error;
    }
  }

  async stopService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      console.log(`Service ${serviceName} not found`);
      return;
    }

    if (service.worker) {
      service.worker.postMessage("stop");
      service.worker.terminate();
    }

    await releasePort(serviceName, this.dbInstance);
    this.services.delete(serviceName);
    console.log(`Stopped service ${serviceName}`);
  }

  async stopAllServices(): Promise<void> {
    const serviceNames = Array.from(this.services.keys());
    for (const name of serviceNames) {
      await this.stopService(name);
    }
  }

  getService(serviceName: string): ServiceInstance | undefined {
    return this.services.get(serviceName);
  }

  getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values());
  }
}
