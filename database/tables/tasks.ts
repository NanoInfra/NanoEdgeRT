import { DatabaseContext } from "../config.ts";
import { Kysely } from "kysely";
import { Database } from "./index.ts";
import { FunctionConfig } from "./functions.ts";

// cron: cron != null, and last_run is meeting the cron schedule
export interface TaskTable {
  id?: string;
  name: string;
  function_name?: string; // Foreign key to functions table

  // concurrency_count: number; // select ... limit *; promise.allsattled([data])
  retry_count: number; // retry count, if failed, retry this many times
  retry_delay: number; // retry delay in milliseconds
}

export interface TaskConfig extends TaskTable, FunctionConfig {}

// Task management operations
export async function createTask(
  context: DatabaseContext,
  taskConfig: TaskConfig,
): Promise<TaskConfig> {
  const { createFunction } = await import("./functions.ts");

  // Extract function config from taskConfig
  const taskId = crypto.randomUUID().replace(/-/g, "");
  const functionConfig: FunctionConfig = {
    name: `task_${taskConfig.name}_${taskId}`, // Unique function name
    code: taskConfig.code,
    enabled: taskConfig.enabled ?? true,
    permissions: taskConfig.permissions,
    description: taskConfig.description,
  };

  // Create the function first
  const createdFunction = await createFunction(context, functionConfig);

  await context.dbInstance
    .insertInto("tasks")
    .values({
      id: taskId,
      name: taskConfig.name,
      function_name: createdFunction.name, // Use function name as foreign key
      // concurrency_count: taskConfig.concurrency_count,
      retry_count: taskConfig.retry_count,
      retry_delay: taskConfig.retry_delay,
    })
    .execute();

  return { ...taskConfig, id: taskId, function_name: createdFunction.name };
}

export async function updateTask(
  context: DatabaseContext,
  id: string,
  updates: Partial<TaskConfig>,
  functionUpdates?: Partial<FunctionConfig>,
): Promise<TaskConfig> {
  const { updateFunction } = await import("./functions.ts");

  // Get current task to access function_name
  const currentTask = await getTaskById(context, id);
  if (!currentTask) {
    throw new Error(`Task with id ${id} not found`);
  }

  // Update function if functionUpdates provided
  if (functionUpdates) {
    await updateFunction(context, currentTask.function_name!, functionUpdates);
  }

  // Update task data
  const updateData: Partial<{
    name: string;
    concurrency_count: number;
    retry_count: number;
    retry_delay: number;
  }> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  // if (updates.concurrency_count !== undefined) {
  //   updateData.concurrency_count = updates.concurrency_count;
  // }
  if (updates.retry_count !== undefined) updateData.retry_count = updates.retry_count;
  if (updates.retry_delay !== undefined) updateData.retry_delay = updates.retry_delay;

  if (Object.keys(updateData).length > 0) {
    await context.dbInstance
      .updateTable("tasks")
      .set(updateData)
      .where("id", "=", id)
      .execute();
  }

  // Return updated task
  return await getTaskById(context, id) as TaskConfig;
}

export async function deleteTask(context: DatabaseContext, id: string): Promise<void> {
  const { deleteFunction } = await import("./functions.ts");

  // Get task to access function_name
  const task = await getTaskById(context, id);
  if (!task) {
    throw new Error(`Task with id ${id} not found`);
  }

  // Delete task first
  await context.dbInstance
    .deleteFrom("tasks")
    .where("id", "=", id)
    .execute();

  // Delete associated function
  await deleteFunction(context, task.function_name!);
}

export async function getTaskById(
  context: DatabaseContext,
  id: string,
): Promise<TaskConfig | null> {
  const { getFunction } = await import("./functions.ts");

  const task = await context.dbInstance
    .selectFrom("tasks")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!task) {
    return null;
  }

  // Get associated function
  const functionConfig = await getFunction(context, task.function_name!);
  if (!functionConfig) {
    throw new Error(`Function with name ${task.function_name} not found`);
  }

  return {
    ...functionConfig,
    ...task, // Task properties override function properties
  } as TaskConfig;
}

export async function getAllTasks(context: DatabaseContext): Promise<TaskConfig[]> {
  const { getFunction } = await import("./functions.ts");

  const tasks = await context.dbInstance
    .selectFrom("tasks")
    .selectAll()
    .execute();

  const taskConfigs: TaskConfig[] = [];

  for (const task of tasks) {
    const functionConfig = await getFunction(context, task.function_name!);
    if (functionConfig) {
      taskConfigs.push({
        ...functionConfig,
        ...task, // Task properties override function properties
      } as TaskConfig);
    }
  }

  return taskConfigs;
}

export async function getTasksByName(
  context: DatabaseContext,
  name: string,
): Promise<TaskConfig[]> {
  const { getFunction } = await import("./functions.ts");

  const tasks = await context.dbInstance
    .selectFrom("tasks")
    .selectAll()
    .where("name", "=", name)
    .execute();

  const taskConfigs: TaskConfig[] = [];

  for (const task of tasks) {
    const functionConfig = await getFunction(context, task.function_name!);
    if (functionConfig) {
      taskConfigs.push({
        ...functionConfig,
        ...task, // Task properties override function properties
      } as TaskConfig);
    }
  }

  return taskConfigs;
}

export async function up(
  dbInstance: Kysely<Database>,
) {
  // Create tasks table
  await dbInstance.schema
    .createTable("tasks")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("function_name", "text", (col) => col.notNull())
    // .addColumn("concurrency_count", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("retry_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("retry_delay", "integer", (col) => col.notNull().defaultTo(1000))
    .execute();
}
