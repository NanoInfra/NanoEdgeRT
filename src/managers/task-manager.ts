import { Kysely } from "kysely";
import { DatabaseContext } from "../../database/config.ts";
import {
  emitTrace,
  getFunctionNameByQueueId,
  getQueueAvailableRetries,
  getQueuedTasks,
  QueueBase,
  reduceQueueRetries,
  updateQueueStatus,
} from "../../database/task_tables/queue.ts";
import { execFunction } from "./function-manager.ts";
import { safeSleep } from "../utils.ts";

export async function queueExecutor(
  context: DatabaseContext,
  dbInstance: Kysely<QueueBase>,
  ac: AbortController,
) {
  console.log("🔄 Starting queue executor...");
  while (!ac.signal.aborted) {
    // resolution of queue tasks: 5hz
    await safeSleep(200, ac.signal);

    // select tasks that are queued, adjust their status to running
    const justQueuedTasks = await getQueuedTasks(dbInstance);
    justQueuedTasks.forEach(async (task) => {
      await updateQueueStatus(
        dbInstance,
        task.id,
        "running",
      );
    });

    // process each task
    Promise.allSettled(justQueuedTasks.map(async (queue) => {
      while (true) {
        const retries = await getQueueAvailableRetries(dbInstance, queue.id);
        const fc = await getFunctionNameByQueueId(context, dbInstance, queue.id);
        try {
          await fcToTrace(
            context,
            dbInstance,
            queue.id,
            fc!,
            queue.params,
          );
          await updateQueueStatus(dbInstance, queue.id, "completed");
        } catch (error) {
          if (retries <= 0) {
            console.error(`Task ${queue.id} failed with no retries left:`, error);
            await updateQueueStatus(dbInstance, queue.id, "failed");
            break;
          } else {
            console.warn(`Task ${queue.id} failed, retrying... (${retries} retries left)`);
            await safeSleep(queue.retry_delay, ac.signal);

            // reduce retries count
            await reduceQueueRetries(dbInstance, queue.id);
            continue;
          }
        }
        break;
      }
    })).then((ps) => {
      ps.filter((p) => p.status === "rejected").forEach((p) => {
        console.error("Task processing failed:", p.reason);
      });
    });
  }
}

async function fcToTrace(
  context: DatabaseContext,
  dbInstance: Kysely<QueueBase>,
  queueId: string,
  function_name: string,
  params: string,
) {
  // normal: "data: {whateverjson}\n\n"
  // end either "data: [DONE]\n\n" or "data: [DONE]{whateverjson}\n\n"
  await emitTrace(dbInstance, queueId, "start", params);

  const resp = await execFunction(context, function_name, JSON.parse(params));
  if (!resp.ok) {
    await emitTrace(
      dbInstance,
      queueId,
      "failed",
      JSON.stringify({
        error: `Failed to fetch: ${resp.status} ${resp.statusText}`,
      }),
    );
    throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
  }
  if (resp.headers.get("Content-Type") === "application/json") {
    await emitTrace(dbInstance, queueId, "end", await resp.json());
    return; // if not sse, just return
  } else if (resp.headers.get("Content-Type") === "text/event-stream") {
    const sse = resp.body;
    if (!sse) {
      throw new Error("Response body is not readable");
    }
    let buffer = "";
    const reader = sse.getReader();
    while (true) {
      const { done, value } = await reader.read();
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            await emitTrace(dbInstance, queueId, "end");
          } else if (data.startsWith("[DONE]")) {
            await emitTrace(dbInstance, queueId, "end", JSON.parse(data.slice(6)));
          } else {
            await emitTrace(dbInstance, queueId, "stream", JSON.parse(data));
          }
        }
      }
      if (done) break;
    }
  } else {
    throw new Error("Unsupported content type: " + resp.headers.get("Content-Type"));
  }
}
