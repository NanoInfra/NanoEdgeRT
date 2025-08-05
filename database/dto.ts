import type { Kysely } from "kysely";
import type { Database } from "./sqlite3.ts";
export interface ServicePermissions {
  read: string[];
  write: string[];
  env: string[];
  run: string[];
}

export interface ServiceConfig {
  name: string;
  path?: string;
  enabled: boolean;
  jwt_check: boolean;
  build_command?: string;
  permissions: ServicePermissions;
  code?: string;
  schema?: string;
}

export interface FunctionConfig {
  name: string;
  code: string;
  enabled: boolean;
  permissions: ServicePermissions;
  description?: string;
}

export interface Config {
  available_port_start: number;
  available_port_end: number;
  services: ServiceConfig[];
  jwt_secret?: string;
  main_port?: number;
  function_execution_timeout?: number; // Timeout in milliseconds for function execution
}

export interface DatabaseContext {
  dbInstance: Kysely<Database>;
  config: Config | null;
}

export async function createDatabaseContext(
  dbInstance: Kysely<Database>,
): Promise<DatabaseContext> {
  const config = await loadConfig(dbInstance);
  return {
    dbInstance,
    config,
  };
}

export async function loadConfig(dbInstance: Kysely<Database>): Promise<Config> {
  // Load configuration from database
  const configRows = await dbInstance
    .selectFrom("config")
    .selectAll()
    .execute();

  const configMap = new Map(configRows.map((row) => [row.key, row.value]));

  // Load services from database
  const serviceRows = await dbInstance
    .selectFrom("services")
    .selectAll()
    .where("enabled", "=", true)
    .execute();

  const services: ServiceConfig[] = serviceRows.map((row) => ({
    name: row.name,
    enabled: Boolean(row.enabled),
    jwt_check: Boolean(row.jwt_check),
    permissions: JSON.parse(row.permissions) as ServicePermissions,
    code: row.code,
    schema: row.schema, // Include schema field
  }));

  const config: Config = {
    available_port_start: parseInt(configMap.get("available_port_start") as string || "8001"),
    available_port_end: parseInt(configMap.get("available_port_end") as string || "8999"),
    main_port: parseInt(configMap.get("main_port") as string || "8000"),
    jwt_secret: configMap.get("jwt_secret") as string || "default-secret-change-me",
    services,
  };

  return config;
}

export async function updateConfig(
  context: DatabaseContext,
  key: string,
  value: string,
): Promise<void> {
  const now = new Date().toISOString();

  await context.dbInstance
    .insertInto("config")
    .values({
      key,
      value,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value, updated_at: now }))
    .execute();

  // Invalidate cache
  context.config = null;
}

export async function createService(
  context: DatabaseContext,
  service: ServiceConfig,
): Promise<ServiceConfig> {
  const now = new Date().toISOString();

  await context.dbInstance
    .insertInto("services")
    .values({
      name: service.name,
      code: service.code || "",
      enabled: service.enabled ?? true,
      jwt_check: service.jwt_check ?? false,
      permissions: JSON.stringify(
        service.permissions || {
          read: [],
          write: [],
          env: [],
          run: [],
        },
      ),
      schema: service.schema || undefined, // Include schema field (nullable)
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Invalidate cache
  context.config = null;
  return service; // Return the created service
}

export async function updateService(
  context: DatabaseContext,
  updates: ServiceConfig,
): Promise<ServiceConfig> {
  const updateData: Partial<{
    code: string;
    enabled: boolean;
    jwt_check: boolean;
    permissions: string;
    schema: string;
    updated_at: string;
  }> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.code !== undefined) updateData.code = updates.code;
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
  if (updates.jwt_check !== undefined) updateData.jwt_check = updates.jwt_check;
  if (updates.permissions !== undefined) {
    updateData.permissions = JSON.stringify(updates.permissions);
  }
  if (updates.schema !== undefined) updateData.schema = updates.schema;

  await context.dbInstance
    .updateTable("services")
    .set(updateData)
    .where("name", "=", name)
    .execute();

  return updates;
}

export async function deleteService(context: DatabaseContext, name: string): Promise<void> {
  await context.dbInstance
    .deleteFrom("services")
    .where("name", "=", name)
    .execute();

  // Invalidate cache
  context.config = null;
}

export async function getAllServices(context: DatabaseContext): Promise<
  ServiceConfig[]
> {
  const services = await context.dbInstance
    .selectFrom("services")
    .selectAll()
    .execute();

  return services.map((service) => ({
    ...service,
    enabled: Boolean(service.enabled),
    jwt_check: Boolean(service.jwt_check),
    permissions: JSON.parse(service.permissions) as ServicePermissions,
  }));
}

export async function getService(context: DatabaseContext, name: string): Promise<
  ServiceConfig | null
> {
  const service = await context.dbInstance
    .selectFrom("services")
    .selectAll()
    .where("name", "=", name)
    .executeTakeFirst();

  if (!service) return null;

  return {
    ...service,
    enabled: Boolean(service.enabled),
    jwt_check: Boolean(service.jwt_check),
    permissions: JSON.parse(service.permissions) as ServicePermissions,
  };
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
  }));
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
  };
}
