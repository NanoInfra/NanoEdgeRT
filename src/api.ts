import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { getService as getServiceFromDB, loadConfig } from "../database/dto.ts";
import {
  getService,
  ServiceInstance,
  ServiceManagerState,
  startService,
} from "./service-manager.ts";
import { jwtCheck } from "./api.admin.ts";
import { Context } from "hono";

// Service-specific documentation routes
export function setupDocsRoutes(
  context: ServiceManagerState,
) {
  const doc = new OpenAPIHono();
  // Serve static files for documentation
  doc.get("/:serviceName", async (c, next) => {
    const serviceName = await c.req.param("serviceName");
    const service = getService(context, serviceName);

    if (!service) {
      return c.json({ error: `Service '${serviceName}' not found` }, 404);
    }
    return swaggerUI({ url: `/openapi/${serviceName}` })(c, next);
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
      const config = await loadConfig(context.dbContext);
      if (!schema.servers) {
        schema.servers = [
          {
            url: `http://127.0.0.1:${config.main_port || 8000}/${serviceName}`,
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
  const serviceRouter = new OpenAPIHono();
  serviceRouter.all("/:serviceName/*", async (c) => {
    const serviceName = c.req.param("serviceName");
    const service = getService(context, serviceName);

    const handleService = async (service: ServiceInstance) => {
      // JWT authentication check
      if (service.config.jwt_check) {
        jwtCheck(c, async (c: Context) => (await forwardToService(service, c.req.raw)));
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
      handleService(service);
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
