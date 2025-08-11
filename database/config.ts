import type { Kysely } from "kysely";
import type { Database } from "./tables/index.ts";
import { Config } from "./tables/functions.ts";
import { ServiceConfig, ServicePermissions } from "./tables/services.ts";

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
