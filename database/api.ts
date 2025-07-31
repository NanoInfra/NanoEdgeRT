import type { Context, Next } from "hono";
import type { Hono } from "hono";
import {
  createService,
  DatabaseContext,
  deleteService,
  getAllServices,
  getService,
  updateConfig,
  updateService,
} from "./dto.ts";

// Extend Hono's Context to include our database context
declare module "hono" {
  interface ContextVariableMap {
    dbContext: DatabaseContext;
  }
}

// Middleware to inject database context
export function databaseMiddleware(dbContext: DatabaseContext) {
  return async (c: Context, next: Next) => {
    c.set("dbContext", dbContext);
    return await next();
  };
}

// Setup all API routes
export function setupAPIRoutes(app: Hono, dbContext: DatabaseContext) {
  // Apply database middleware to all API routes
  app.use("*", databaseMiddleware(dbContext));

  // Services routes
  app.get("/services", getAllServicesHandler);
  app.get("/services/:name", getServiceHandler);
  app.post("/services", createServiceHandler);
  app.put("/services/:name", updateServiceHandler);
  app.delete("/services/:name", deleteServiceHandler);

  // Config routes
  app.get("/config", getAllConfigHandler);
  app.get("/config/:key", getConfigHandler);
  app.put("/config/:key", updateConfigHandler);
}

// Services handlers
async function getAllServicesHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  try {
    const services = await getAllServices(dbContext);
    return c.json({ services });
  } catch (error) {
    console.error("Get all services error:", error);
    return c.json(
      {
        error: "Failed to get services",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function getServiceHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const serviceName = c.req.param("name");

  try {
    const service = await getService(dbContext, serviceName);
    if (!service) {
      return c.json({ error: "Service not found" }, 404);
    }
    return c.json(service);
  } catch (error) {
    console.error("Get service error:", error);
    return c.json(
      {
        error: "Failed to get service",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function createServiceHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");

  try {
    const body = await c.req.json();
    const { name, code, enabled = true, jwt_check = false, permissions, schema } = body;

    if (!name || !code) {
      return c.json({ error: "Name and code are required" }, 400);
    }

    // Validate schema if provided
    if (schema) {
      try {
        JSON.parse(schema);
      } catch {
        return c.json({ error: "Invalid schema JSON" }, 400);
      }
    }

    await createService(dbContext, {
      name,
      code,
      enabled,
      jwt_check,
      permissions: permissions || {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      schema,
    });

    return c.json({ message: "Service created successfully", name }, 201);
  } catch (error) {
    console.error("Create service error:", error);
    return c.json(
      {
        error: "Failed to create service",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function updateServiceHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const serviceName = c.req.param("name");

  try {
    const body = await c.req.json();
    const { code, enabled, jwt_check, permissions, schema } = body;

    // Validate schema if provided
    if (schema) {
      try {
        JSON.parse(schema);
      } catch {
        return c.json({ error: "Invalid schema JSON" }, 400);
      }
    }

    await updateService(dbContext, {
      name: serviceName,
      code,
      enabled,
      jwt_check,
      permissions,
      schema,
    });

    return c.json({ message: "Service updated successfully", ...body });
  } catch (error) {
    console.error("Update service error:", error);
    return c.json(
      {
        error: "Failed to update service",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function deleteServiceHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const serviceName = c.req.param("name");

  try {
    await deleteService(dbContext, serviceName);
    return c.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Delete service error:", error);
    return c.json(
      {
        error: "Failed to delete service",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

// Config handlers
function getAllConfigHandler(c: Context): Response {
  const dbContext = c.get("dbContext");

  try {
    // Load all config from the database context
    if (!dbContext.config) {
      return c.json({ error: "Config not loaded" }, 500);
    }
    return c.json(dbContext.config);
  } catch (error) {
    console.error("Get all config error:", error);
    return c.json(
      {
        error: "Failed to get config",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

function getConfigHandler(c: Context): Response {
  const dbContext = c.get("dbContext");
  const configKey = c.req.param("key");

  try {
    if (!dbContext.config) {
      return c.json({ error: "Config not loaded" }, 500);
    }

    const configRecord = dbContext.config as unknown as Record<string, unknown>;
    const value = configRecord[configKey];

    if (value === undefined) {
      return c.json({ error: "Config key not found" }, 404);
    }

    return c.json({ key: configKey, value });
  } catch (error) {
    console.error("Get config error:", error);
    return c.json(
      {
        error: "Failed to get config",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function updateConfigHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const configKey = c.req.param("key");

  try {
    const body = await c.req.json();
    const { value } = body;

    if (value === undefined) {
      return c.json({ error: "Value is required" }, 400);
    }

    await updateConfig(dbContext, configKey, String(value));
    return c.json({ message: "Config updated successfully" });
  } catch (error) {
    console.error("Update config error:", error);
    return c.json(
      {
        error: "Failed to update config",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
