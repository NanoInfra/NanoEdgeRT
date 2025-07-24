import { ServiceConfig, ServiceInstance } from "./types.ts";

export class ServiceManager {
  private services: Map<string, ServiceInstance> = new Map();
  private usedPorts: Set<number> = new Set();
  private portStart: number;
  private portEnd: number;

  constructor(portStart: number, portEnd: number) {
    this.portStart = portStart;
    this.portEnd = portEnd;
  }

  private getAvailablePort(): number {
    for (let port = this.portStart; port <= this.portEnd; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error("No available ports");
  }

  private releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  // Build service method removed - no file-based services supported

  async startService(serviceConfig: ServiceConfig): Promise<void> {
    if (this.services.has(serviceConfig.name)) {
      console.log(`Service ${serviceConfig.name} already running`);
      return;
    }
    const _ = await 1;
    const port = this.getAvailablePort();

    try {
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

      worker.addEventListener("error", (error) => {
        console.error(`Worker error for ${serviceConfig.name}:`, error);
        serviceInstance.status = "error";
        this.releasePort(port);
      });

      serviceInstance.worker = worker;
      serviceInstance.status = "running";

      console.log(`✅ Service ${serviceConfig.name} started on port ${port}`);
    } catch (error) {
      console.error(`Failed to start service ${serviceConfig.name}:`, error);
      this.releasePort(port);
      this.services.delete(serviceConfig.name);
      throw error;
    }
  }

  stopService(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (!service) {
      console.log(`Service ${serviceName} not found`);
      return;
    }

    if (service.worker) {
      service.worker.postMessage("stop");
      service.worker.terminate();
    }

    this.releasePort(service.port);
    this.services.delete(serviceName);
    console.log(`Stopped service ${serviceName}`);
  }

  stopAllServices(): void {
    const serviceNames = Array.from(this.services.keys());
    for (const name of serviceNames) {
      this.stopService(name);
    }
  }

  getService(serviceName: string): ServiceInstance | undefined {
    return this.services.get(serviceName);
  }

  getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values());
  }
}
