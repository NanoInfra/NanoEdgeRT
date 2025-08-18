import { DatabaseContext } from "../config.ts";
import { ServicePermissions } from "./services.ts";
import { Kysely } from "kysely";
import { Database } from "./index.ts";

export interface FunctionTable {
  id?: number;
  name: string;
  code: string;
  enabled: boolean;
  permissions: string; // JSON string
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FunctionConfig {
  name: string;
  code: string;
  permissions: ServicePermissions;
  enabled?: boolean;
  description?: string;
}

// Function management operations
export async function createFunction(
  context: DatabaseContext,
  functionConfig: FunctionConfig,
): Promise<FunctionConfig> {
  const now = new Date().toISOString();

  await context.dbInstance
    .insertInto("functions")
    .values({
      name: functionConfig.name,
      code: functionConfig.code,
      enabled: functionConfig.enabled ?? true,
      permissions: JSON.stringify(
        functionConfig.permissions || {
          read: [],
          write: [],
          env: [],
          run: [],
        },
      ),
      description: functionConfig.description || undefined,
      created_at: now,
      updated_at: now,
    })
    .execute();

  return functionConfig;
}

export async function updateFunction(
  context: DatabaseContext,
  name: string,
  updates: Partial<FunctionConfig>,
): Promise<FunctionConfig> {
  const updateData: Partial<{
    code: string;
    enabled: boolean;
    permissions: string;
    description: string;
    updated_at: string;
  }> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.code !== undefined) updateData.code = updates.code;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.permissions !== undefined) {
    updateData.permissions = JSON.stringify(updates.permissions);
  }
  if (updates.description !== undefined) updateData.description = updates.description;

  await context.dbInstance
    .updateTable("functions")
    .set(updateData)
    .where("name", "=", name)
    .execute();

  return { name, ...updates } as FunctionConfig;
}

export async function deleteFunction(context: DatabaseContext, name: string): Promise<void> {
  await context.dbInstance
    .deleteFrom("functions")
    .where("name", "=", name)
    .execute();
}

export async function getAllFunctions(context: DatabaseContext): Promise<FunctionConfig[]> {
  const functions = await context.dbInstance
    .selectFrom("functions")
    .selectAll()
    .execute();

  return functions.map((func) => ({
    ...func,
    enabled: Boolean(func.enabled),
    permissions: JSON.parse(func.permissions) as ServicePermissions,
  } as FunctionConfig));
}

export async function getFunction(context: DatabaseContext, name: string): Promise<
  FunctionConfig | null
> {
  const func = await context.dbInstance
    .selectFrom("functions")
    .selectAll()
    .where("name", "=", name)
    .executeTakeFirst();

  if (!func) return null;

  return {
    ...func,
    enabled: Boolean(func.enabled),
    permissions: JSON.parse(func.permissions) as ServicePermissions,
  } as FunctionConfig;
}

export async function up(
  dbInstance: Kysely<Database>,
) {
  // Create functions table
  await dbInstance.schema
    .createTable("functions")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text", (col) => col.unique().notNull())
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn(
      "permissions",
      "text",
      (col) => col.notNull().defaultTo('{"read":[],"write":[],"env":[],"run":[]}'),
    )
    .addColumn("description", "text") // Nullable description
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();
}
