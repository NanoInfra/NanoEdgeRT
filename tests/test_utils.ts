import { createOrLoadDatabase } from "../database/tables/index.ts";
import { ServiceConfig } from "../database/tables/services.ts";

let port = 9000; // Base port for tests
export async function createIsolatedDb() {
  const db = await createOrLoadDatabase(":memory:", {
    available_port_start: port + 1,
    available_port_end: port + 20,
    main_port: port,
    jwt_secret: Deno.env.get("JWT_SECRET") || "default-secret-change-me",
  });

  port += 20; // Increment base port for next test
  return db;
}

/**
 * Creates a minimal test service configuration
 */
export function createTestService(name: string, responseMessage?: string): ServiceConfig {
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
