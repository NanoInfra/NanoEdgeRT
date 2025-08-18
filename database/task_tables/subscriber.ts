import { Kysely, sql } from "kysely";
import { QueueBase } from "./queue.ts";
import { safeSleep } from "../../src/utils.ts";

export async function* subscribeToTraceByQueueId(
  dbInstance: Kysely<QueueBase>,
  queueId: string,
  ac: AbortController,
) {
  let lastId = 0;
  let end = false;
  while (!ac.signal.aborted) {
    // resolution of trace tasks: 5hz
    await safeSleep(200, ac.signal);

    const data = await dbInstance
      .selectFrom("trace")
      .select(["id", sql`UNIXEPOCH(ts)`.as("ts"), "task_id", "queue_id", "status", "data"])
      .where("queue_id", "=", queueId)
      .where("id", ">", lastId)
      .orderBy("ts", "asc")
      .execute();
    if (data.length !== 0) {
      const max_current_batch_id = data.map((d) => d.id as number).reduce(
        (a, b) => Math.max(a, b),
        0,
      );
      lastId = max_current_batch_id;
      for (const trace of data) {
        yield trace;
      }
    }
    if (end) {
      break;
    }
    const queueStatus = await dbInstance
      .selectFrom("queue")
      .select("status")
      .where("id", "=", queueId)
      .executeTakeFirst();
    if (queueStatus?.status !== "queued" && queueStatus?.status !== "running") {
      await safeSleep(200, ac.signal);
      end = true;
    }
  }
}
