import { Kysely } from "kysely";
import { Database as Sqlite } from "jsr:@db/sqlite";
import { DenoSqlite3Dialect } from "jsr:@soapbox/kysely-deno-sqlite";

// Database schema types
export interface ServiceTable {
  id?: number;
  name: string;
  code: string;
  enabled: boolean;
  jwt_check: boolean;
  permissions: string; // JSON string
  created_at?: string;
  updated_at?: string;
}

export interface ConfigTable {
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

export interface Database {
  services: ServiceTable;
  config: ConfigTable;
}

// Default database for production
export const db = new Kysely<Database>({
  dialect: new DenoSqlite3Dialect({
    database: new Sqlite("db.sqlite3"),
  }),
});

// Function to create a database instance with custom path
export function createDatabase(dbPath: string) {
  return new Kysely<Database>({
    dialect: new DenoSqlite3Dialect({
      database: new Sqlite(dbPath),
    }),
  });
}

// Initialize database with tables
export async function initializeDatabase(dbInstance: Kysely<Database> = db) {
  console.log("🗄️ Initializing database...");

  // Create services table
  await dbInstance.schema
    .createTable("services")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text", (col) => col.unique().notNull())
    .addColumn("code", "text", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("jwt_check", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn(
      "permissions",
      "text",
      (col) => col.notNull().defaultTo('{"read":[],"write":[],"env":[],"run":[]}'),
    )
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  // Create config table
  await dbInstance.schema
    .createTable("config")
    .ifNotExists()
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  // Insert default config values if they don't exist
  const defaultConfigs = [
    { key: "available_port_start", value: "8001" },
    { key: "available_port_end", value: "8999" },
    { key: "main_port", value: "8000" },
    { key: "jwt_secret", value: Deno.env.get("JWT_SECRET") || "default-secret-change-me" },
  ];

  for (const config of defaultConfigs) {
    const existing = await dbInstance
      .selectFrom("config")
      .select("key")
      .where("key", "=", config.key)
      .executeTakeFirst();

    if (!existing) {
      await dbInstance
        .insertInto("config")
        .values({
          key: config.key,
          value: config.value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute();
    }
  }

  // Add default services if none exist
  const existingServices = await dbInstance
    .selectFrom("services")
    .select("id")
    .execute();

  if (existingServices.length === 0) {
    console.log("🌱 Seeding database with default services...");

    // Hello service
    const helloService = `export default async function handler(req) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "World";
  
  return new Response(
    JSON.stringify({ 
      message: \`Hello, \${name}!\`,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}`;

    // Calculator service
    const calculatorService = `export default async function handler(req) {
  const url = new URL(req.url);
  
  if (req.method === "GET") {
    const expression = url.searchParams.get("expr");
    if (!expression) {
      return new Response(
        JSON.stringify({ 
          error: "Missing 'expr' parameter",
          example: "/calculator?expr=2+2" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    try {
      // Simple calculator - only allow basic operations for security
      const sanitized = expression.replace(/[^0-9+\\-*/().\\s]/g, '');
      const result = Function('"use strict"; return (' + sanitized + ')')();
      
      return new Response(
        JSON.stringify({ 
          expression: expression,
          result: result,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid expression",
          message: error.message 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}`;

    const defaultServices = [
      {
        name: "hello",
        code: helloService,
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        name: "calculator",
        code: calculatorService,
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const service of defaultServices) {
      await dbInstance
        .insertInto("services")
        .values(service)
        .execute();
    }

    console.log("✅ Default services added: hello, calculator");
  }

  console.log("✅ Database initialized");
}

export const DB = db;
