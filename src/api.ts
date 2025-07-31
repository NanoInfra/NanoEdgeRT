import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { getService as getServiceFromDB, loadConfig } from "../database/dto.ts";
import {
  getService,
  ServiceInstance,
  ServiceManagerState,
  startService,
} from "./service-manager.ts";
import { verifyJWT } from "./api.admin.ts";

// Service-specific documentation routes
export function setupDocsRoutes(
  context: ServiceManagerState,
) {
  const doc = new Hono();
  // Serve static files for documentation
  doc.get("/:serviceName", async (c, next) => {
    const serviceName = await c.req.param("serviceName");
    return swaggerUI({ url: `/api/docs/openapi/${serviceName}` })(c, next);
  });

  // Service OpenAPI schema endpoint
  doc.get("/openapi/:serviceName", async (c) => {
    const serviceName = c.req.param("serviceName");
    if (!serviceName) {
      return c.json({ error: "Service name is required" }, 400);
    }

    const dbService = await getServiceFromDB(context.dbContext, serviceName);
    try {
      const schema = JSON.parse(dbService?.schema || "null");

      // Ensure the schema has the required OpenAPI structure
      if (!schema.openapi && !schema.swagger) {
        return c.json({
          error: `Invalid OpenAPI schema for service '${serviceName}'`,
        }, 400);
      }

      // Add server information if not present
      const config = await loadConfig(context.dbContext.dbInstance);
      if (!schema.servers) {
        schema.servers = [
          {
            url: `http://127.0.0.1:${config.main_port || 8000}/api/v2/${serviceName}`,
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
  return doc;
}

export function setupApiRoutes(
  context: ServiceManagerState,
) {
  const serviceRouter = new Hono();
  serviceRouter.all("/:serviceName/*", async (c) => {
    const serviceName = c.req.param("serviceName");
    const service = getService(context, serviceName);

    const handleService = async (service: ServiceInstance) => {
      // JWT authentication check
      if (service.config.jwt_check) {
        try {
          const _payload = await verifyJWT(
            c.req.header("Authorization")?.replace("Bearer ", "") || "",
          );
          if (_payload) {
            return await forwardToService(service, c.req.raw);
          } else {
            return c.json({ error: "Unauthorized" }, 401);
          }
        } catch (_error) {
          return c.json({ error: "Unauthorized " + _error }, 401);
        }
      }

      if (service.status === "running") {
        return await forwardToService(service, c.req.raw);
      } else {
        return c.json({ error: `Service '${serviceName}' failed to start` }, 503);
      }
    };

    if (!service) {
      const serviceConfig = await getServiceFromDB(context.dbContext, serviceName);
      if (!serviceConfig) {
        return c.json({ error: `Service '${serviceName}' not found` }, 404);
      }
      // start service
      const service = await startService(context, serviceConfig);
      return handleService(service);
    } else {
      return handleService(service);
    }
  });
  return serviceRouter;
}

async function forwardToService(
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
