import type { Context } from "hono";
import type { Hono } from "hono";
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
  getTasksByName,
  type TaskConfig,
  updateTask,
} from "../tables/tasks.ts";
import type { FunctionConfig } from "../tables/functions.ts";
import { Kysely } from "kysely";
import { Next } from "hono";
import { QueueBase } from "../task_tables/queue.ts";

// Middleware to inject database context
export function queueBaseMiddleware(queueBase: Kysely<QueueBase>) {
  return async (c: Context, next: Next) => {
    c.set("queueBase", queueBase);
    return await next();
  };
}

// Setup task API routes
export function setupTaskAPIRoutes(app: Hono) {
  // Tasks routes
  app.get("/tasks", getAllTasksHandler);
  app.get("/tasks/:id", getTaskHandler);
  app.post("/tasks", createTaskHandler);
  app.put("/tasks/:id", updateTaskHandler);
  app.delete("/tasks/:id", deleteTaskHandler);
}

// Task handlers
async function getAllTasksHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const taskName = c.req.query("name");

  try {
    let tasks;
    if (taskName) {
      // Filter by name if provided
      tasks = await getTasksByName(dbContext, taskName);
    } else {
      // Get all tasks if no name filter
      tasks = await getAllTasks(dbContext);
    }
    return c.json({ tasks });
  } catch (error) {
    console.error("Get tasks error:", error);
    return c.json(
      {
        error: "Failed to get tasks",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function getTaskHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const taskId = c.req.param("id");

  try {
    const task = await getTaskById(dbContext, taskId);
    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json(task);
  } catch (error) {
    console.error("Get task error:", error);
    return c.json(
      {
        error: "Failed to get task",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function createTaskHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");

  try {
    const body = await c.req.json();
    const {
      name,
      retry_count = 0,
      retry_delay = 1000,
      // Function configuration
      code,
      permissions = {},
      description,
    } = body;

    if (!name) {
      return c.json({ error: "Name is required" }, 400);
    }

    if (!code) {
      return c.json({ error: "Function code is required" }, 400);
    }

    const task = await createTask(dbContext, {
      name,
      retry_count,
      retry_delay,
      // Function configuration
      code,
      permissions,
      description,
    });

    return c.json({ message: "Task created successfully", task }, 201);
  } catch (error) {
    console.error("Create task error:", error);
    return c.json(
      {
        error: "Failed to create task",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function updateTaskHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const taskId = c.req.param("id");

  try {
    const body = await c.req.json();
    const {
      name,
      retry_count,
      retry_delay,
      // Function updates
      code,
      permissions,
      description,
    } = body;

    // Prepare task updates
    const taskUpdates: Partial<TaskConfig> = {};
    if (name !== undefined) taskUpdates.name = name;
    if (retry_count !== undefined) taskUpdates.retry_count = retry_count;
    if (retry_delay !== undefined) taskUpdates.retry_delay = retry_delay;

    // Prepare function updates
    const functionUpdates: Partial<FunctionConfig> = {};
    if (code !== undefined) functionUpdates.code = code;
    if (permissions !== undefined) functionUpdates.permissions = permissions;
    if (description !== undefined) functionUpdates.description = description;

    const updatedTask = await updateTask(
      dbContext,
      taskId,
      taskUpdates,
      Object.keys(functionUpdates).length > 0 ? functionUpdates : undefined,
    );

    return c.json({ message: "Task updated successfully", task: updatedTask });
  } catch (error) {
    console.error("Update task error:", error);
    return c.json(
      {
        error: "Failed to update task",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

async function deleteTaskHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const taskId = c.req.param("id");

  try {
    await deleteTask(dbContext, taskId);
    return c.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    return c.json(
      {
        error: "Failed to delete task",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
