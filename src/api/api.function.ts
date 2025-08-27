import { Context } from "hono";
import { Hono } from "hono";
import { execFunction } from "../managers/function-manager.ts";
import { databaseMiddleware } from "../../database/api/api.service.ts";
import { DatabaseContext } from "../../database/config.ts";
import { getFunction } from "../../database/tables/functions.ts";

// Setup function execution API routes
export function setupFunctionAPIRoutes(dbContext: DatabaseContext) {
  const app = new Hono();
  // Function execution route
  app.use("*", databaseMiddleware(dbContext));
  app.post(
    ":name",
    executeFunctionHandler,
  );
  return app;
}

// Function execution handler
async function executeFunctionHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const functionName = c.req.param("name");

  try {
    // Get function from database
    const functionConfig = await getFunction(dbContext, functionName);
    if (!functionConfig) {
      return c.json({ error: "Function not found" }, 404);
    }

    if (!functionConfig.enabled) {
      return c.json({ error: "Function is disabled" }, 403);
    }

    // Execute the function
    const result = await execFunction(dbContext, functionName, await c.req.json());

    return result;
  } catch (error) {
    console.error("Execute function error:", error);
    return c.json({
      error: "Failed to execute function",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

// AppType export for hono-docs
export type AppType = ReturnType<typeof setupFunctionAPIRoutes>;
