import { Config } from "./types.ts";
import { ServiceManager } from "./service-manager.ts";
import { AuthMiddleware } from "./auth.ts";
import { loadConfig } from "./config.ts";
import { SwaggerGenerator } from "./swagger.ts";
import { generateAdminUI } from "./admin-ui.ts";

export class NanoEdgeRT {
  private config: Config;
  private serviceManager: ServiceManager;
  private authMiddleware: AuthMiddleware;
  private abortController: AbortController;
  private swaggerGenerator: SwaggerGenerator;

  private constructor(config: Config, authMiddleware: AuthMiddleware) {
    this.config = config;
    this.serviceManager = new ServiceManager(
      config.available_port_start,
      config.available_port_end,
    );
    this.authMiddleware = authMiddleware;
    this.abortController = new AbortController();
    const baseUrl = `http://127.0.0.1:${config.main_port || 8000}`;
    this.swaggerGenerator = new SwaggerGenerator(config, baseUrl);
  }

  static async create(configPath?: string): Promise<NanoEdgeRT> {
    const config = await loadConfig(configPath);
    const authMiddleware = await AuthMiddleware.create(config.jwt_secret!);
    return new NanoEdgeRT(config, authMiddleware);
  }

  async start(): Promise<void> {
    console.log("🚀 Starting NanoEdgeRT...");

    // Start enabled services
    for (const serviceConfig of this.config.services) {
      if (serviceConfig.enable) {
        try {
          await this.serviceManager.startService(serviceConfig);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to start service ${serviceConfig.name}:`, errorMessage);
        }
      }
    }

    // Start main server
    const port = this.config.main_port || 8000;

    console.log(`🌐 NanoEdgeRT server starting on http://0.0.0.0:${port}`);

    Deno.serve({
      port,
      hostname: "0.0.0.0",
      signal: this.abortController.signal,
    }, this.handleRequest.bind(this));

    console.log(`✅ NanoEdgeRT server running on port ${port}`);
  }

  stop(): void {
    console.log("🛑 Stopping NanoEdgeRT...");
    this.abortController.abort();
    this.serviceManager.stopAllServices();
    console.log("✅ NanoEdgeRT stopped");
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter((s) => s);

    // Health check endpoint
    if (url.pathname === "/health") {
      return this.handleHealthCheck();
    }

    // Swagger documentation endpoints
    if (url.pathname === "/docs" || url.pathname === "/swagger") {
      // Check if request is targeting localhost interface
      const host = request.headers.get("host") || url.host;

      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return new Response(
          JSON.stringify({
            error: "Documentation endpoints only accessible via localhost",
            hint: "Try http://127.0.0.1:8000/docs instead",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(this.swaggerGenerator.generateSwaggerHTML(), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/openapi.json") {
      // Check if request is targeting localhost interface
      const host = request.headers.get("host") || url.host;

      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return new Response(
          JSON.stringify({
            error: "OpenAPI spec only accessible via localhost",
            hint: "Try http://127.0.0.1:8000/openapi.json instead",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(this.swaggerGenerator.generateOpenAPISpec(), null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Admin UI interface (localhost only)
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      // Check if request is targeting localhost interface
      const host = request.headers.get("host") || url.host;

      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return new Response(
          JSON.stringify({
            error: "Admin UI only accessible via localhost",
            hint: "Try http://127.0.0.1:8000/admin instead",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        await generateAdminUI(this.getAllServicesWithStatus(), this.config.jwt_secret!),
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        },
      );
    }

    // Admin API endpoints
    if (pathSegments[0] === "_admin") {
      return this.handleAdminRequest(request, pathSegments.slice(1));
    }

    // Service request
    if (pathSegments.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Welcome to NanoEdgeRT",
          services: this.serviceManager.getAllServices().map((s) => ({
            name: s.config.name,
            status: s.status,
            port: s.port,
          })),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const serviceName = pathSegments[0];
    const service = this.serviceManager.getService(serviceName);

    if (!service) {
      return new Response(
        JSON.stringify({ error: `Service '${serviceName}' not found` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (service.status !== "running") {
      return new Response(
        JSON.stringify({ error: `Service '${serviceName}' is not running` }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // JWT authentication check
    if (service.config.jwt_check) {
      const authResult = await this.authMiddleware.authenticate(request);
      if (!authResult.authenticated) {
        return this.authMiddleware.createUnauthorizedResponse();
      }
    }

    // Forward request to service
    return this.forwardToService(service, request);
  }

  private async forwardToService(
    service: { config: { name: string }; port: number },
    request: Request,
  ): Promise<Response> {
    try {
      const serviceUrl = `http://0.0.0.0:${service.port}${new URL(request.url).pathname}${
        new URL(request.url).search
      }`;

      const response = await fetch(serviceUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error forwarding to service ${service.config.name}:`, errorMessage);
      return new Response(
        JSON.stringify({ error: "Service unavailable" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  private handleHealthCheck(): Response {
    const services = this.serviceManager.getAllServices();
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: services.map((service) => ({
        name: service.config.name,
        status: service.status,
        port: service.port,
      })),
    };

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleAdminRequest(request: Request, pathSegments: string[]): Promise<Response> {
    // Check if request is targeting localhost interface
    const host = request.headers.get("host") || new URL(request.url).host;

    if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
      return new Response(
        JSON.stringify({
          error: "Admin endpoints only accessible via localhost",
          hint: "Try http://127.0.0.1:8000/_admin/ instead",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Basic auth check for admin endpoints
    const authResult = await this.authMiddleware.authenticate(request);
    if (!authResult.authenticated) {
      return this.authMiddleware.createUnauthorizedResponse();
    }

    const [action, serviceName] = pathSegments;

    switch (action) {
      case "services":
        if (request.method === "GET") {
          return new Response(
            JSON.stringify(this.serviceManager.getAllServices()),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        break;

      case "start":
        if (request.method === "POST" && serviceName) {
          const serviceConfig = this.config.services.find((s) => s.name === serviceName);
          if (!serviceConfig) {
            return new Response(
              JSON.stringify({ error: "Service not found in config" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }
          try {
            await this.serviceManager.startService(serviceConfig);
            return new Response(
              JSON.stringify({ message: `Service ${serviceName} started` }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(
              JSON.stringify({ error: errorMessage }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        }
        break;

      case "stop":
        if (request.method === "POST" && serviceName) {
          try {
            this.serviceManager.stopService(serviceName);
            return new Response(
              JSON.stringify({ message: `Service ${serviceName} stopped` }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(
              JSON.stringify({ error: errorMessage }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        }
        break;
    }

    return new Response(
      JSON.stringify({ error: "Invalid admin request" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private getAllServicesWithStatus() {
    // Get all running services
    const runningServices = this.serviceManager.getAllServices();
    const runningServiceNames = new Set(runningServices.map((s) => s.config.name));

    // Create a list that includes all configured services
    const allServices = this.config.services.map((serviceConfig) => {
      const runningService = runningServices.find((s) => s.config.name === serviceConfig.name);

      if (runningService) {
        // Service is running, return its current state
        return runningService;
      } else {
        // Service is stopped, create a stopped service instance
        return {
          config: serviceConfig,
          status: "stopped" as const,
          port: null as number | null,
          worker: null,
        };
      }
    });

    return allServices;
  }
}
