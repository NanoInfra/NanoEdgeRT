import { Kysely } from "kysely";
import { Database as Sqlite } from "jsr:@db/sqlite";
import { DenoSqliteDialect } from "../kysely_deno_sqlite3_adapter.ts";
import { getTaskById } from "../tables/tasks.ts";
import { DatabaseContext } from "../config.ts";

export interface Queue {
  id: string;
  task_id: string;
  params: string; // JSON string
  status: "queued" | "running" | "completed" | "failed";
  retries: number;
  max_retries: number;
  retry_delay: number; // in milliseconds
  created_at: string;
  updated_at: string;
}

export interface Trace {
  id?: number; // auto-incremented ID
  ts: string; // date
  task_id: string;
  queue_id: string;
  status: "start" | "end" | "failed" | "stream";
  data?: string; // JSON string for additional data
}

export interface QueueBase {
  queue: Queue;
  trace: Trace;
}

async function createQueueBase(dbPath: string) {
  const queueBase = new Kysely<QueueBase>({
    dialect: new DenoSqliteDialect(new Sqlite(dbPath)),
  });

  await queueBase.schema
    .createTable("queue")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("task_id", "text", (col) => col.notNull())
    .addColumn("params", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("retries", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("max_retries", "integer", (col) => col.notNull().defaultTo(3))
    .addColumn("retry_delay", "integer", (col) => col.notNull().defaultTo(1000)) // default 1 second
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await queueBase.schema
    .createTable("trace")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("ts", "text", (col) => col.notNull())
    .addColumn("task_id", "text", (col) => col.notNull())
    .addColumn("queue_id", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("data", "text", (col) => col.notNull())
    .execute();
  return queueBase;
}

async function checkDatabaseExists(dbPath: string): Promise<boolean> {
  // check file dbPath exists
  try {
    const stats = await Deno.stat(dbPath);
    return stats.isFile;
  } catch {
    return false;
  }
}

function loadExistingQueueBase(dbPath: string): Kysely<QueueBase> {
  const queueBase = new Kysely<QueueBase>({
    dialect: new DenoSqliteDialect(new Sqlite(dbPath)),
  });

  return queueBase;
}

export async function createOrLoadQueuebase(dbPath: string) {
  if (dbPath === ":memory:") {
    return await createQueueBase(dbPath);
  } else {
    const dbExists = await checkDatabaseExists(dbPath);
    if (dbExists) {
      return loadExistingQueueBase(dbPath);
    } else {
      return await createQueueBase(dbPath);
    }
  }
}

export async function updateQueueStatus(
  dbInstance: Kysely<QueueBase>,
  queueId: string,
  status: "running" | "completed" | "failed",
): Promise<void> {
  const now = new Date().toISOString();
  await dbInstance
    .updateTable("queue")
    .set({
      status,
      updated_at: now,
    })
    .where("id", "=", queueId)
    .execute();
}

export async function getQueueAvailableRetries(
  dbInstance: Kysely<QueueBase>,
  queueId: string,
): Promise<number> {
  const queue = await dbInstance
    .selectFrom("queue")
    .select(["max_retries", "retries"])
    .where("id", "=", queueId)
    .executeTakeFirst();
  return queue ? queue.max_retries - queue.retries : 0;
}

export async function reduceQueueRetries(
  dbInstance: Kysely<QueueBase>,
  queueId: string,
): Promise<void> {
  await dbInstance
    .updateTable("queue")
    .set((eb) => ({
      retries: eb("retries", "-", 1),
    }))
    .where("id", "=", queueId)
    .execute();
}

export async function getQueuedTasks(
  dbInstance: Kysely<QueueBase>,
): Promise<Queue[]> {
  const result = await dbInstance
    .selectFrom("queue")
    .selectAll()
    .where("status", "=", "queued")
    .execute();
  return result;
}

export async function emitTrace(
  dbInstance: Kysely<QueueBase>,
  queueId: string,
  status: "start" | "end" | "failed" | "stream",
  data: string = "{}",
) {
  const now = new Date().toISOString();
  await dbInstance
    .insertInto("trace")
    .values({
      ts: now,
      task_id: queueId,
      queue_id: queueId,
      status,
      data,
    })
    .execute();
}

export async function getFunctionNameByQueueId(
  context: DatabaseContext,
  dbInstance: Kysely<QueueBase>,
  queueId: string,
): Promise<string | null> {
  const task_id = await dbInstance
    .selectFrom("queue")
    .select("task_id")
    .where("id", "=", queueId)
    .executeTakeFirst();
  if (!task_id) return null;
  const task = await getTaskById(context, task_id.task_id);
  return task ? task.function_name! : null;
}

// =========== enqueue ===========

export async function enqueueTask(
  context: DatabaseContext,
  dbInstance: Kysely<QueueBase>,
  taskId: string,
  params: string,
): Promise<string> {
  const task = await getTaskById(context, taskId);
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }
  const now = new Date().toISOString();
  const queueId = crypto.randomUUID();
  await dbInstance
    .insertInto("queue")
    .values({
      id: queueId,
      task_id: taskId,
      params,
      status: "queued",
      retries: 0,
      max_retries: task.retry_count,
      retry_delay: task.retry_delay,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return queueId;
}
