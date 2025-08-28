import { DatabaseContext } from "../config.ts";
import { Database } from "./index.ts";
import { Kysely } from "kysely";

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

export interface PortTable {
  port: number;
  service_name?: string; // null if available, service name if allocated
  allocated_at?: string;
  released_at?: string;
}

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

// Port allocation functions
export async function allocatePort(
  serviceName: string,
  dbInstance: Kysely<Database>,
): Promise<number> {
  const trx = await dbInstance.startTransaction().execute();

  try {
    // Find an available port
    const availablePort = await trx
      .selectFrom("ports")
      .select("port")
      .where((eb) =>
        eb.or([
          eb("service_name", "is", null),
          eb("released_at", "is not", null),
        ])
      )
      .orderBy("port", "asc")
      .executeTakeFirst();

    if (!availablePort) {
      throw new Error("No available ports");
    }

    // Allocate the port to the service
    await trx
      .updateTable("ports")
      .set({
        service_name: serviceName,
        allocated_at: new Date().toISOString(),
        released_at: undefined,
      })
      .where("port", "=", availablePort.port)
      .execute();

    // Update the service record with the allocated port
    await trx
      .updateTable("services")
      .set({
        port: availablePort.port,
        updated_at: new Date().toISOString(),
      })
      .where("name", "=", serviceName)
      .execute();

    await trx.commit().execute();
    return availablePort.port;
  } catch (error) {
    await trx.rollback().execute();
    throw error;
  }
}

export async function releasePort(
  serviceName: string,
  dbInstance: Kysely<Database>,
): Promise<void> {
  const trx = await dbInstance.startTransaction().execute();

  try {
    // Get the port number for the service
    const service = await trx
      .selectFrom("services")
      .select("port")
      .where("name", "=", serviceName)
      .executeTakeFirst();
    if (service?.port) {
      // Release the port
      await trx
        .updateTable("ports")
        .set({
          service_name: undefined,
          allocated_at: undefined,
          released_at: new Date().toISOString(),
        })
        .where("port", "=", service.port)
        .execute();

      // Remove port from service record
      await trx
        .updateTable("services")
        .set({
          port: undefined,
          updated_at: new Date().toISOString(),
        })
        .where("name", "=", serviceName)
        .execute();
    } else {
      throw new Error(`Service ${serviceName} does not have an allocated port`);
    }

    await trx.commit().execute();
  } catch (error) {
    await trx.rollback().execute();
    console.warn("⚠️ Error releasing port:", error);
  }
}

export async function getServicePort(
  serviceName: string,
  dbInstance: Kysely<Database>,
): Promise<number | null> {
  const service = await dbInstance
    .selectFrom("services")
    .select("port")
    .where("name", "=", serviceName)
    .executeTakeFirst();

  return service?.port || null;
}

export async function getAllocatedPorts(
  dbInstance: Kysely<Database>,
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
    .select(["name", "enabled", "jwt_check", "permissions"])
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
    name: service.name,
    code: service.code,
    schema: service.schema || undefined,
    enabled: Boolean(service.enabled),
    jwt_check: Boolean(service.jwt_check),
    permissions: JSON.parse(service.permissions) as ServicePermissions,
  };
}

// ========== migration function ==========

export async function up(
  dbInstance: Kysely<Database>,
) {
  console.log("🗄️  Initializing services table...");
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

  // Create ports table for port allocation tracking
  await dbInstance.schema
    .createTable("ports")
    .ifNotExists()
    .addColumn("port", "integer", (col) => col.primaryKey())
    .addColumn("service_name", "text") // null if available, service name if allocated
    .addColumn("allocated_at", "text")
    .addColumn("released_at", "text")
    .execute();

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
    const batchSize = 10;
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
    const helloService = `Deno.serve(async (req) => {
    const url = new URL(req.url);
    const name = url.searchParams.get("name") || "World";

    return new Response(
      JSON.stringify({
        message: \`Hello, \${name}!\`,
        meta: import.meta.url,
        staticUrl: globalThis.staticUrl,
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
  })`;

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

    await dbInstance
      .insertInto("services")
      .values({
        name: "hello",
        code: helloService,
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        schema: helloSchema,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    console.log("✅ Default services added: hello");
  }
}
