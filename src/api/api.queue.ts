import { Context, Hono } from "hono";
import { Kysely } from "kysely";
import { queueBaseMiddleware } from "../../database/api/api.task.ts";
import { enqueueTask, QueueBase } from "../../database/task_tables/queue.ts";
import { DatabaseContext } from "../../database/config.ts";
import { databaseMiddleware } from "../../database/api/api.service.ts";
import { subscribeToTraceByQueueId } from "../../database/task_tables/subscriber.ts";

// Setup function execution API routes
export function setupQueueAPIRoutes(dbContext: DatabaseContext, queueBase: Kysely<QueueBase>) {
  const app = new Hono();
  // Function execution route
  app.use("*", databaseMiddleware(dbContext));
  app.use("*", queueBaseMiddleware(queueBase));
  app.post("enqueue", enqueueTaskHandler);
  app.post("subscribe", subscribeToTraceHandler);
  return app;
}

// Enqueue task handler
async function enqueueTaskHandler(c: Context): Promise<Response> {
  const dbContext = c.get("dbContext");
  const queueBase = c.get("queueBase");
  const {
    taskId,
    params,
  } = await c.req.json();
  if (!taskId || !params) {
    return c.json({ error: "taskId and params are required" }, 400);
  }
  const queue_id = await enqueueTask(dbContext, queueBase, taskId, params);
  return c.json({ queue_id }, 200);
}

// Subscribe to trace handler
async function subscribeToTraceHandler(c: Context): Promise<Response> {
  const queueBase = c.get("queueBase");
  const { queue_id } = await c.req.json();
  if (!queue_id) {
    return c.json({ error: "queue_id is required" }, 400);
  }
  const ac = new AbortController();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const trace of subscribeToTraceByQueueId(queueBase, queue_id, ac)) {
        controller.enqueue(`data: ${JSON.stringify(trace)}\n\n`);
      }
      controller.enqueue("data: [DONE]\n\n");
      controller.close();
    },
    cancel() {
      ac.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// AppType export for hono-docs
export type AppType = ReturnType<typeof setupQueueAPIRoutes>;
