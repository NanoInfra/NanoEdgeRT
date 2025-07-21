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

  async buildService(serviceConfig: ServiceConfig): Promise<void> {
    if (!serviceConfig.build_command) return;

    const servicePath = serviceConfig.path || `./nanoedge/services/${serviceConfig.name}`;

    console.log(`Building service ${serviceConfig.name}...`);

    const command = new Deno.Command("sh", {
      args: ["-c", serviceConfig.build_command],
      cwd: servicePath,
      stdout: "inherit",
      stderr: "inherit",
    });

    const child = command.spawn();
    const result = await child.status;

    if (!result.success) {
      throw new Error(`Failed to build service ${serviceConfig.name}`);
    }
  }

  async startService(serviceConfig: ServiceConfig): Promise<void> {
    if (this.services.has(serviceConfig.name)) {
      console.log(`Service ${serviceConfig.name} already running`);
      return;
    }

    const port = this.getAvailablePort();
    const servicePath = serviceConfig.path || `./nanoedge/services/${serviceConfig.name}`;

    try {
      // Build the service if needed
      await this.buildService(serviceConfig);

      const serviceInstance: ServiceInstance = {
        config: serviceConfig,
        port,
        status: "starting",
      };

      this.services.set(serviceConfig.name, serviceInstance);

      // Create worker adapter code
      const workerAdapterCode = `
let __handler;
const __handler_rewriter = async (req) => {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(s => s);
  
  // Remove service name from path
  if (pathSegments[0] === "${serviceConfig.name}") {
    pathSegments.shift();
  }
  
  const newPath = "/" + pathSegments.join("/");
  const rewritedUrl = "http://${serviceConfig.name}" + newPath + url.search;
  
  const newReq = new Request(rewritedUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    credentials: req.credentials,
  });
  
  return await __handler(newReq);
};

const ____AC = new AbortController();

self.onmessage = async (event) => {
  if (event.data === "stop") {
    console.log("Stopping ${serviceConfig.name}");
    ____AC.abort();
    self.close();
  } else {
    const { port } = event.data;
    try {
      const __handlerModule = await import(import.meta.url);
      __handler = __handlerModule.default || __handlerModule.handler;
      
      if (!__handler) {
        throw new Error("No default export or handler function found");
      }
      
      Deno.serve({
        port,
        hostname: "127.0.0.1",
        signal: ____AC.signal,
      }, __handler_rewriter);
      
      console.log(\`Service ${serviceConfig.name} started on port \${port}\`);
    } catch (error) {
      console.error(\`Failed to start service ${serviceConfig.name}:\`, error);
      self.postMessage({ type: 'error', error: error.message });
    }
  }
};
`;

      // Read the compiled service code
      const mainFilePath = `${servicePath}/index.js`;
      let serviceCode: string;

      try {
        serviceCode = await Deno.readTextFile(mainFilePath);
      } catch {
        // If no compiled file, try TypeScript
        const tsPath = `${servicePath}/index.ts`;
        try {
          // Compile TypeScript to JavaScript
          const command = new Deno.Command(Deno.execPath(), {
            args: ["bundle", tsPath],
            stdout: "piped",
            stderr: "piped",
          });

          const child = command.spawn();
          const output = await child.output();

          if (!output.success) {
            throw new Error(`Failed to compile ${tsPath}`);
          }

          serviceCode = new TextDecoder().decode(output.stdout);
        } catch {
          throw new Error(`No service file found at ${mainFilePath} or ${tsPath}`);
        }
      }

      // Create worker
      const fullWorkerCode = serviceCode + workerAdapterCode;
      const blob = new Blob([fullWorkerCode], { type: "application/javascript" });

      const worker = new Worker(URL.createObjectURL(blob), {
        type: "module",
        deno: {
          permissions: {
            ...serviceConfig.permissions,
            net: ["127.0.0.1"],
          },
        },
      });

      worker.onmessage = (event) => {
        if (event.data.type === "error") {
          console.error(`Worker error for ${serviceConfig.name}:`, event.data.error);
          serviceInstance.status = "error";
        }
      };

      worker.onerror = (error) => {
        console.error(`Worker error for ${serviceConfig.name}:`, error);
        serviceInstance.status = "error";
      };

      serviceInstance.worker = worker;
      serviceInstance.status = "running";

      // Start the worker
      worker.postMessage({ port });

      console.log(`Started service ${serviceConfig.name} on port ${port}`);
    } catch (error) {
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
