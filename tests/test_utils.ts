import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { Kysely } from "kysely";
import type { Database } from "../database/sqlite3.ts";

/**
 * Test utilities for NanoEdgeRT testing
 */

export interface TestServiceConfig {
  name: string;
  code: string;
  enabled?: boolean;
  jwt_check?: boolean;
  permissions?: {
    read: string[];
    write: string[];
    env: string[];
    run: string[];
  };
  schema?: string;
}

/**
 * Creates a minimal test service configuration
 */
export function createTestService(name: string, responseMessage?: string): TestServiceConfig {
  const message = responseMessage || `Hello from ${name}`;

  return {
    name,
    code: `export default async function handler(req) {
      const url = new URL(req.url);
      return new Response(JSON.stringify({
        message: "${message}",
        service: "${name}",
        method: req.method,
        path: url.pathname,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }`,
    enabled: true,
    jwt_check: false,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
}

/**
 * Creates a test service with JWT authentication enabled
 */
export function createProtectedTestService(name: string): TestServiceConfig {
  const baseService = createTestService(name, `Protected service ${name}`);
  return {
    ...baseService,
    jwt_check: true,
  };
}

/**
 * Creates a test service with specific permissions
 */
export function createPermissionedTestService(
  name: string,
  permissions: { read: string[]; write: string[]; env: string[]; run: string[] },
): TestServiceConfig {
  const baseService = createTestService(name);
  return {
    ...baseService,
    permissions,
  };
}

/**
 * Creates a test service with OpenAPI schema
 */
export function createTestServiceWithSchema(name: string, title?: string): TestServiceConfig {
  const baseService = createTestService(name);
  const schemaTitle = title || `${name} Service`;

  return {
    ...baseService,
    schema: JSON.stringify({
      openapi: "3.0.0",
      info: {
        title: schemaTitle,
        version: "1.0.0",
        description: `Test service: ${name}`,
      },
      paths: {
        "/": {
          get: {
            summary: `Get response from ${name}`,
            responses: {
              "200": {
                description: "Success response",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        service: { type: "string" },
                        method: { type: "string" },
                        path: { type: "string" },
                        timestamp: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  };
}

/**
 * Helper function to create a valid JWT token using the correct algorithm and secret
 */
export async function createValidJWTToken(
  dbContext?: any,
  payload: Record<string, unknown> = {},
): Promise<string> {
  // Use the same secret as the admin API
  const secret = Deno.env.get("ADMIN_JWT_SECRET") || "admin";

  const defaultPayload = {
    sub: "test-user",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    ...payload,
  };

  // Use the Web Crypto API to create a proper HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const encodedPayload = btoa(JSON.stringify(defaultPayload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Helper function to create a mock JWT token (for testing purposes only)
 */
export function createMockJWTToken(
  secret: string = "test-secret",
  payload: Record<string, unknown> = {},
): string {
  const defaultPayload = {
    sub: "test-user",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "");
  const encodedPayload = btoa(JSON.stringify(defaultPayload)).replace(/=/g, "");
  const signature = btoa(`${encodedHeader}.${encodedPayload}.${secret}`).replace(/=/g, "");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Asserts that a response is a valid JSON response
 */
export async function assertValidJSONResponse(
  response: Response,
  expectedStatus: number = 200,
): Promise<unknown> {
  assertEquals(response.status, expectedStatus);
  assertEquals(response.headers.get("content-type")?.includes("application/json"), true);

  const data = await response.json();
  assertExists(data);
  return data;
}

/**
 * Asserts that a response is a valid HTML response
 */
export async function assertValidHTMLResponse(
  response: Response,
  expectedStatus: number = 200,
): Promise<string> {
  assertEquals(response.status, expectedStatus);
  assertEquals(response.headers.get("content-type")?.includes("text/html"), true);

  const html = await response.text();
  assertExists(html);
  return html;
}

/**
 * Asserts that a response contains specific error information
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  errorMessageContains?: string,
): Promise<unknown> {
  assertEquals(response.status, expectedStatus);

  const data = await response.json();
  assertExists(data);
  assertExists(data.error);

  if (errorMessageContains) {
    assertEquals(
      data.error.toLowerCase().includes(errorMessageContains.toLowerCase()),
      true,
      `Error message "${data.error}" should contain "${errorMessageContains}"`,
    );
  }

  return data;
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Test context for managing test resources
 */
export class TestContext {
  private resources: Array<() => void | Promise<void>> = [];

  /**
   * Add a cleanup function to be called when test ends
   */
  addCleanup(cleanup: () => void | Promise<void>): void {
    this.resources.push(cleanup);
  }

  /**
   * Clean up all registered resources
   */
  async cleanup(): Promise<void> {
    for (const cleanup of this.resources.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
    this.resources = [];
  }
}

/**
 * Creates a test context with automatic cleanup
 */
export function createTestContext(): TestContext {
  return new TestContext();
}

/**
 * Database test utilities
 */
export class DatabaseTestHelper {
  constructor(private db: Kysely<Database>) {}

  /**
   * Insert a test service into the database
   */
  async insertTestService(config: TestServiceConfig): Promise<void> {
    await this.db
      .insertInto("services")
      .values({
        name: config.name,
        code: config.code,
        enabled: config.enabled ?? true,
        jwt_check: config.jwt_check ?? false,
        permissions: JSON.stringify(
          config.permissions ?? { read: [], write: [], env: [], run: [] },
        ),
        schema: config.schema || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();
  }

  /**
   * Get service count
   */
  async getServiceCount(): Promise<number> {
    const result = await this.db
      .selectFrom("services")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirst();
    return parseInt(result?.count as string || "0");
  }

  /**
   * Clear all test services (services not in default set)
   */
  async clearTestServices(): Promise<void> {
    await this.db
      .deleteFrom("services")
      .where("name", "not in", ["hello", "calculator"])
      .execute();
  }

  /**
   * Insert test configuration
   */
  async insertTestConfig(key: string, value: string): Promise<void> {
    await this.db
      .insertInto("config")
      .values({
        key,
        value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          value,
          updated_at: new Date().toISOString(),
        })
      )
      .execute();
  }
}

/**
 * Creates a database test helper
 */
export function createDatabaseTestHelper(db: Kysely<Database>): DatabaseTestHelper {
  return new DatabaseTestHelper(db);
}
