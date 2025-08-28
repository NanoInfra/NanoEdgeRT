import { Kysely } from "kysely";
import { Database as Sqlite } from "jsr:@db/sqlite";
import { DenoSqliteDialect } from "../kysely_deno_sqlite3_adapter.ts";
import { FunctionTable, up as functionUp } from "./functions.ts";
import { PortTable, ServiceTable, up as serviceUp } from "./services.ts";
import { TaskTable, up as taskUp } from "./tasks.ts";

// Database schema types

export interface ConfigTable {
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

export interface Database {
  services: ServiceTable;
  functions: FunctionTable;
  config: ConfigTable;
  ports: PortTable;
  tasks: TaskTable;
}

// Function to create a database instance with custom path
export function createDatabase(dbPath: string) {
  return new Kysely<Database>({
    dialect: new DenoSqliteDialect(new Sqlite(dbPath)),
  });
}

function loadDatabase(dbPath: string): Kysely<Database> {
  if (dbPath === ":memory:") {
    throw new Error("In-memory database is not supported in this context");
  }
  return new Kysely<Database>({
    dialect: new DenoSqliteDialect(new Sqlite(dbPath)),
  });
}

export async function createOrLoadDatabase(
  dbPath: string,
  config: DbInitConfig = DEFAULT_DB_INIT_CONFIG,
): Promise<Kysely<Database>> {
  console.log(`🗄️  Create or load database at ${dbPath}`);
  // Check if database file exists (excluding :memory:)
  let dbExists = false;
  if (dbPath !== ":memory:") {
    try {
      await Deno.stat(dbPath);
      dbExists = true;
    } catch (_error) {
      // File doesn't exist
      dbExists = false;
    }
  }

  if (dbExists) {
    try {
      const db = loadDatabase(dbPath);
      return db;
    } catch (_error) {
      // console.error("Failed to load database, creating a new one:", error);
      const db = createDatabase(dbPath);
      await initializeDatabase(db, config);
      return db;
    }
  } else {
    const db = createDatabase(dbPath);
    await initializeDatabase(db, config);
    return db;
  }
}
export interface DbInitConfig {
  available_port_start?: number;
  available_port_end?: number;
  main_port?: number;
  jwt_secret?: string;
  function_execution_timeout?: number;
}

export const DEFAULT_DB_INIT_CONFIG: DbInitConfig = {
  available_port_start: 8001,
  available_port_end: 8999,
  main_port: 8000,
  jwt_secret: Deno.env.get("JWT_SECRET") || "default-secret-change-me",
  function_execution_timeout: 30000, // 30 seconds default timeout
};

// Initialize database with tables
export async function initializeDatabase(
  dbInstance: Kysely<Database>,
  config: DbInitConfig,
) {
  console.log("🗄️  Initializing database...");

  // Create config table
  await dbInstance.schema
    .createTable("config")
    .ifNotExists()
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  for (const [key, value] of Object.entries(config)) {
    const existing = await dbInstance
      .selectFrom("config")
      .select("key")
      .where("key", "=", key)
      .executeTakeFirst();

    if (!existing) {
      await dbInstance
        .insertInto("config")
        .values({
          key: key,
          value: value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();
    }
  }

  // other txn
  await serviceUp(dbInstance);
  await functionUp(dbInstance);
  await taskUp(dbInstance);
}
