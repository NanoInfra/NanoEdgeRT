import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import { Config } from "./database-config.ts";
import { ServiceManager } from "./service-manager.ts";
import { AuthMiddleware } from "./auth.ts";
import { DatabaseConfig, databaseConfig } from "./database-config.ts";
import { initializeDatabase } from "../database/sqlite3.ts";
import { generateAdminUI } from "./admin-ui.ts";
import { dynamicAPI } from "./dynamic-api.ts";
import { serveStatic } from "@hono/node-server/serve-static";

export class NanoEdgeRT {
  private config: Config;
  private serviceManager: ServiceManager;
  private authMiddleware: AuthMiddleware;
  private abortController: AbortController;
  private app: OpenAPIHono;
  private dbConfig: DatabaseConfig;

  private constructor(config: Config, authMiddleware: AuthMiddleware, dbConfig: DatabaseConfig) {
    this.config = config;
    this.serviceManager = new ServiceManager(dbConfig.getDbInstance());
    this.authMiddleware = authMiddleware;
    this.abortController = new AbortController();
    this.app = new OpenAPIHono();
    this.dbConfig = dbConfig;
    this.setupRoutes();
  }

  static async create(customDbConfig?: DatabaseConfig): Promise<NanoEdgeRT> {
    // Initialize database first (use custom if provided)
    if (customDbConfig) {
      // Database already initialized by the custom config
    } else {
      await initializeDatabase();
    }

    // Load config from database (use custom if provided)
    const dbConfigInstance = customDbConfig || databaseConfig;
    const config = await dbConfigInstance.loadConfig();
    const authMiddleware = await AuthMiddleware.create(config.jwt_secret!);
    return new NanoEdgeRT(config, authMiddleware, dbConfigInstance);
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
    }, this.app.fetch);

    console.log(`✅ NanoEdgeRT server running on port ${port}`);
  }

  private setupRoutes(): void {
    // Add middleware
    this.app.use("*", cors());
    this.app.use("*", logger());
    this.app.get("/static/*", serveStatic({ root: "./" }));

    // Service-specific documentation routes
    this.app.get("/doc/:serviceName", async (c, next) => {
      const serviceName = c.req.param("serviceName");
      const service = this.serviceManager.getService(serviceName);

      if (!service) {
        return c.json({ error: `Service '${serviceName}' not found` }, 404);
      }

      // Get service from database to access schema
      const dbService = await this.dbConfig.getService(serviceName);
      if (!dbService) {
        return c.json({});
      } else if (!dbService.schema) {
        return c.json({
          error: `No OpenAPI schema found for service '${serviceName}'`,
          hint: "Add an OpenAPI schema to this service to view its documentation",
        }, 404);
      }

      return swaggerUI({ url: `/openapi/${serviceName}` })(c, next);
    });

    // Service OpenAPI schema endpoint
    this.app.get("/openapi/:serviceName", async (c) => {
      const serviceName = c.req.param("serviceName");
      if (!serviceName) {
        return c.json({ error: "Service name is required" }, 400);
      }

      const dbService = await this.dbConfig.getService(serviceName);

      if (!dbService || !dbService.schema) {
        return c.json({
          error: `No OpenAPI schema found for service '${serviceName}'`,
        }, 404);
      }

      try {
        const schema = JSON.parse(dbService.schema);

        // Ensure the schema has the required OpenAPI structure
        if (!schema.openapi && !schema.swagger) {
          return c.json({
            error: `Invalid OpenAPI schema for service '${serviceName}'`,
          }, 400);
        }

        // Add server information if not present
        if (!schema.servers) {
          schema.servers = [
            {
              url: `http://127.0.0.1:${this.config.main_port || 8000}/${serviceName}`,
              description: `${serviceName} service endpoint`,
            },
          ];
        }

        return c.json(schema);
      } catch (error) {
        return c.json({
          error: `Invalid JSON schema for service '${serviceName}'`,
          details: error instanceof Error ? error.message : String(error),
        }, 400);
      }
    });

    // Health check route
    this.app.get("/health", (c) => {
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
      return c.json(health);
    });

    // Admin UI route (localhost only)
    this.app.get("/admin", async (c) => {
      const host = c.req.header("host") || "";
      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return c.json({
          error: "Admin UI only accessible via localhost",
          hint: "Try http://127.0.0.1:8000/admin instead",
        }, 403);
      }

      const html = await generateAdminUI(this.getAllServicesWithStatus(), this.config.jwt_secret!);
      return c.html(html);
    });

    this.app.get("/admin/", async (c) => {
      const host = c.req.header("host") || "";
      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return c.json({
          error: "Admin UI only accessible via localhost",
          hint: "Try http://127.0.0.1:8000/admin instead",
        }, 403);
      }

      const html = await generateAdminUI(this.getAllServicesWithStatus(), this.config.jwt_secret!);
      return c.html(html);
    });

    // Setup admin routes
    this.setupAdminRoutes();

    // Root route
    this.app.get("/", (c) => {
      return c.json({
        message: "Welcome to NanoEdgeRT",
        services: this.serviceManager.getAllServices().map((s) => ({
          name: s.config.name,
          status: s.status,
          port: s.port,
        })),
        documentation: {
          main: "/docs",
          services: this.serviceManager.getAllServices()
            .map((s) => s.config.name)
            .map((name) => ({
              service: name,
              docs: `/doc/${name}`,
            })),
        },
      });
    });

    // Service forwarding routes
    this.app.all("/:serviceName/*", async (c) => {
      const serviceName = c.req.param("serviceName");
      const service = this.serviceManager.getService(serviceName);

      if (!service) {
        return c.json({ error: `Service '${serviceName}' not found` }, 404);
      }

      if (service.status !== "running") {
        return c.json({ error: `Service '${serviceName}' is not running` }, 503);
      }

      // JWT authentication check
      if (service.config.jwt_check) {
        const authResult = await this.authMiddleware.authenticate(c.req.raw);
        if (!authResult.authenticated) {
          return new Response("Unauthorized", { status: 401 });
        }
      }

      // Forward request to service
      return this.forwardToService(service, c.req.raw);
    });
  }

  private setupAdminRoutes(): void {
    // Middleware to check localhost access for admin routes
    const checkLocalhost = async (c: Context, next: Next) => {
      const host = c.req.header("host") || "";
      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return c.json({
          error: "Admin endpoints only accessible via localhost",
          hint: "Try http://127.0.0.1:8000/_admin/ instead",
        }, 403);
      }
      await next();
    };

    // Middleware to check authentication for admin routes
    const checkAuth = async (c: Context, next: Next) => {
      const authResult = await this.authMiddleware.authenticate(c.req.raw);
      if (!authResult.authenticated) {
        return new Response("Unauthorized", { status: 401 });
      }
      await next();
    };

    // Dynamic API routes
    this.app.all("/_admin/api/*", checkLocalhost, checkAuth, (c) => {
      const path = c.req.path.replace("/_admin/api", "").split("/").filter((s: string) => s);
      return dynamicAPI.handleAPIRequest(c.req.raw, path);
    });

    // Services management routes
    this.app.get("/_admin/services", checkLocalhost, checkAuth, (c) => {
      return c.json(this.serviceManager.getAllServices());
    });

    this.app.post("/_admin/start/:serviceName", checkLocalhost, checkAuth, async (c) => {
      const serviceName = c.req.param("serviceName");
      const serviceConfig = this.config.services.find((s) => s.name === serviceName);

      if (!serviceConfig) {
        return c.json({ error: "Service not found in config" }, 404);
      }

      try {
        await this.serviceManager.startService(serviceConfig);
        return c.json({ message: `Service ${serviceName} started` });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: errorMessage }, 500);
      }
    });

    this.app.post("/_admin/stop/:serviceName", checkLocalhost, checkAuth, async (c) => {
      const serviceName = c.req.param("serviceName");
      try {
        await this.serviceManager.stopService(serviceName);
        return c.json({ message: `Service ${serviceName} stopped` });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return c.json({ error: errorMessage }, 500);
      }
    });
  }

  stop(): void {
    console.log("🛑 Stopping NanoEdgeRT...");
    this.abortController.abort();
    // Note: stopAllServices is now async, but we can't await in stop()
    // Consider making this async in the future
    this.serviceManager.stopAllServices().catch(console.error);
    console.log("✅ NanoEdgeRT stopped");
  }

  private async forwardToService(
    service: { config: { name: string }; port: number },
    request: Request,
  ): Promise<Response> {
    try {
      const serviceUrl = `http://127.0.0.1:${service.port}${new URL(request.url).pathname}${
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

  private getAllServicesWithStatus() {
    // Get all running services
    const runningServices = this.serviceManager.getAllServices();

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
