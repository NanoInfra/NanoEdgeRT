import type { Context } from "hono";
import type { Hono } from "hono";
import { DatabaseContext } from "../config.ts";
import {
  createFunction,
  deleteFunction,
  getAllFunctions,
  getFunction,
  updateFunction,
} from "../tables/functions.ts";

// Setup function API routes
export function setupFunctionAPIRoutes(app: Hono, _dbContext: DatabaseContext) {
  // Functions routes
  app.get("/functions", getAllFunctionsHandler);
  app.get("/functions/:name", getFunctionHandler);
  app.post("/functions", createFunctionHandler);
  app.put("/functions/:name", updateFunctionHandler);
  app.delete("/functions/:name", deleteFunctionHandler);
}

// Function handlers
async function getAllFunctionsHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  try {
    const functions = await getAllFunctions(dbContext);
    return c.json({ functions });
  } catch (error) {
    console.error("Get all functions error:", error);
    return c.json(
      {
        error: "Failed to get functions",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function getFunctionHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const functionName = c.req.param("name");

  try {
    const func = await getFunction(dbContext, functionName);
    if (!func) {
      return c.json({ error: "Function not found" }, 404);
    }
    return c.json(func);
  } catch (error) {
    console.error("Get function error:", error);
    return c.json(
      {
        error: "Failed to get function",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function createFunctionHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");

  try {
    const body = await c.req.json();
    const { name, code, enabled = true, permissions, description } = body;

    if (!name || !code) {
      return c.json({ error: "Name and code are required" }, 400);
    }

    await createFunction(dbContext, {
      name,
      code,
      enabled,
      permissions: permissions || {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description,
    });

    return c.json({ message: "Function created successfully", name }, 201);
  } catch (error) {
    console.error("Create function error:", error);
    return c.json(
      {
        error: "Failed to create function",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function updateFunctionHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const functionName = c.req.param("name");

  try {
    const body = await c.req.json();
    const { code, enabled, permissions, description } = body;

    await updateFunction(dbContext, functionName, {
      code,
      enabled,
      permissions,
      description,
    });

    return c.json({ message: "Function updated successfully", ...body });
  } catch (error) {
    console.error("Update function error:", error);
    return c.json(
      {
        error: "Failed to update function",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function deleteFunctionHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const functionName = c.req.param("name");

  try {
    await deleteFunction(dbContext, functionName);
    return c.json({ message: "Function deleted successfully" });
  } catch (error) {
    console.error("Delete function error:", error);
    return c.json(
      {
        error: "Failed to delete function",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
