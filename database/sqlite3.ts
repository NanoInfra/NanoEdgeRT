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
  schema?: string; // JSON string for OpenAPI schema (nullable)
  port?: number; // Allocated port for the service
  created_at?: string;
  updated_at?: string;
}

export interface ConfigTable {
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortTable {
  port: number;
  service_name?: string; // null if available, service name if allocated
  allocated_at?: string;
  released_at?: string;
}

export interface Database {
  services: ServiceTable;
  config: ConfigTable;
  ports: PortTable;
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
    .addColumn("schema", "text") // Nullable JSON string for OpenAPI schema
    .addColumn("port", "integer") // Allocated port for the service
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

  // Create ports table for port allocation tracking
  await dbInstance.schema
    .createTable("ports")
    .ifNotExists()
    .addColumn("port", "integer", (col) => col.primaryKey())
    .addColumn("service_name", "text") // null if available, service name if allocated
    .addColumn("allocated_at", "text")
    .addColumn("released_at", "text")
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

  // Initialize ports table with available ports if empty
  const existingPorts = await dbInstance
    .selectFrom("ports")
    .select("port")
    .executeTakeFirst();

  if (!existingPorts) {
    console.log("🌱 Initializing ports table...");

    // Get port range from config
    const portStartConfig = await dbInstance
      .selectFrom("config")
      .select("value")
      .where("key", "=", "available_port_start")
      .executeTakeFirst();

    const portEndConfig = await dbInstance
      .selectFrom("config")
      .select("value")
      .where("key", "=", "available_port_end")
      .executeTakeFirst();

    const portStart = parseInt(portStartConfig?.value || "8001");
    const portEnd = parseInt(portEndConfig?.value || "8999");

    // Insert all available ports
    const portInserts = [];
    for (let port = portStart; port <= portEnd; port++) {
      portInserts.push({
        port,
        service_name: undefined,
        allocated_at: undefined,
        released_at: undefined,
      });
    }

    // Insert ports in batches to avoid potential issues with large ranges
    const batchSize = 100;
    for (let i = 0; i < portInserts.length; i += batchSize) {
      const batch = portInserts.slice(i, i + batchSize);
      await dbInstance
        .insertInto("ports")
        .values(batch)
        .execute();
    }

    console.log(`✅ Initialized ${portInserts.length} available ports (${portStart}-${portEnd})`);
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

    // OpenAPI schema for hello service
    const helloSchema = JSON.stringify({
      openapi: "3.0.0",
      info: {
        title: "Hello Service",
        version: "1.0.0",
        description: "A simple greeting service",
      },
      paths: {
        "/": {
          get: {
            summary: "Get a greeting message",
            parameters: [
              {
                name: "name",
                in: "query",
                description: "Name to greet",
                required: false,
                schema: {
                  type: "string",
                  default: "World",
                },
              },
            ],
            responses: {
              "200": {
                description: "Successful greeting",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        timestamp: { type: "string", format: "date-time" },
                        method: { type: "string" },
                        path: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // OpenAPI schema for calculator service
    const calculatorSchema = JSON.stringify({
      openapi: "3.0.0",
      info: {
        title: "Calculator Service",
        version: "1.0.0",
        description: "A simple mathematical calculator service",
      },
      paths: {
        "/": {
          get: {
            summary: "Evaluate a mathematical expression",
            parameters: [
              {
                name: "expr",
                in: "query",
                description: "Mathematical expression to evaluate (e.g., 2+2, 10*5)",
                required: true,
                schema: {
                  type: "string",
                  example: "2+2",
                },
              },
            ],
            responses: {
              "200": {
                description: "Successful calculation",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        expression: { type: "string" },
                        result: { type: "number" },
                        timestamp: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
              "400": {
                description: "Invalid expression or missing parameter",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        error: { type: "string" },
                        message: { type: "string" },
                        example: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const defaultServices = [
      {
        name: "hello",
        code: helloService,
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        schema: helloSchema,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        name: "calculator",
        code: calculatorService,
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        schema: calculatorSchema,
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

// Port allocation functions
export async function allocatePort(
  serviceName: string,
  dbInstance: Kysely<Database> = db,
): Promise<number> {
  // Find an available port
  const availablePort = await dbInstance
    .selectFrom("ports")
    .select("port")
    .where("service_name", "is", null)
    .orderBy("port", "asc")
    .executeTakeFirst();

  if (!availablePort) {
    throw new Error("No available ports");
  }

  // Allocate the port to the service
  await dbInstance
    .updateTable("ports")
    .set({
      service_name: serviceName,
      allocated_at: new Date().toISOString(),
      released_at: undefined,
    })
    .where("port", "=", availablePort.port)
    .execute();

  // Update the service record with the allocated port
  await dbInstance
    .updateTable("services")
    .set({
      port: availablePort.port,
      updated_at: new Date().toISOString(),
    })
    .where("name", "=", serviceName)
    .execute();

  return availablePort.port;
}

export async function releasePort(
  serviceName: string,
  dbInstance: Kysely<Database> = db,
): Promise<void> {
  // Get the port number for the service
  const service = await dbInstance
    .selectFrom("services")
    .select("port")
    .where("name", "=", serviceName)
    .executeTakeFirst();

  if (service?.port) {
    // Release the port
    await dbInstance
      .updateTable("ports")
      .set({
        service_name: undefined,
        allocated_at: undefined,
        released_at: new Date().toISOString(),
      })
      .where("port", "=", service.port)
      .execute();

    // Remove port from service record
    await dbInstance
      .updateTable("services")
      .set({
        port: undefined,
        updated_at: new Date().toISOString(),
      })
      .where("name", "=", serviceName)
      .execute();
  }
}

export async function getServicePort(
  serviceName: string,
  dbInstance: Kysely<Database> = db,
): Promise<number | null> {
  const service = await dbInstance
    .selectFrom("services")
    .select("port")
    .where("name", "=", serviceName)
    .executeTakeFirst();

  return service?.port || null;
}

export async function getAllocatedPorts(
  dbInstance: Kysely<Database> = db,
): Promise<{ port: number; serviceName: string; allocatedAt: string }[]> {
  const ports = await dbInstance
    .selectFrom("ports")
    .select(["port", "service_name", "allocated_at"])
    .where("service_name", "is not", null)
    .execute();

  return ports.map((p) => ({
    port: p.port,
    serviceName: p.service_name!,
    allocatedAt: p.allocated_at!,
  }));
}

export const DB = db;
