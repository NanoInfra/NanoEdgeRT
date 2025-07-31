import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { serveStatic } from "@hono/node-server/serve-static";
import { createOrLoadDatabase } from "../database/sqlite3.ts";
import { createDatabaseContext } from "../database/dto.ts";
import {
  createServiceManagerState,
  getAllServices,
  ServiceManagerState,
  stopAllServices,
} from "./service-manager.ts";
import { setupApiRoutes, setupDocsRoutes } from "./api.ts";
import { setupAdminAPIRoutes } from "./api.admin.ts";
import { Context } from "hono";
import openapi from "./openapi.ts";

export async function createNanoEdgeRT(
  dbPath?: string,
): Promise<
  [Hono, number, AbortController, ServiceManagerState]
> {
  const db = await createOrLoadDatabase(dbPath || ":memory:");
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);
  const startTime = new Date().toISOString();
  const app = new Hono();
  app.use("*", cors());
  app.use("*", logger());

  const status = (c: Context) => {
    const now = new Date();
    const upTimeMs = now.getTime() - new Date(startTime).getTime();
    const upTimeSec = Math.floor(upTimeMs / 1000);
    return c.json({
      status: "ok",
      startTime,
      currentTime: now.toISOString(),
      upTime: {
        milliseconds: upTimeMs,
        seconds: upTimeSec,
        human: `${Math.floor(upTimeSec / 3600)}h ${Math.floor((upTimeSec % 3600) / 60)}m ${
          upTimeSec % 60
        }s`,
      },
      services: getAllServices(serviceManagerState),
    });
  };
  app.use("/docs", swaggerUI({ url: "/openapi.json" }));
  app.get("/openapi.json", (c) => c.json(openapi, 200));
  app.get("/health", status);
  app.get("/status", status);
  app.get("/static/*", serveStatic({ root: "./" }));
  app.route("/api/docs", setupDocsRoutes(serviceManagerState));
  app.route("/api/v2", setupApiRoutes(serviceManagerState));
  app.route("/admin-api/v2", setupAdminAPIRoutes(dbContext));
  const abortController = new AbortController();
  return [app, dbContext.config?.main_port || 8000, abortController, serviceManagerState];
}

export async function startNanoEdgeRT(
  dbPath?: string,
): Promise<[AbortController, ServiceManagerState]> {
  console.log("🚀 Starting NanoEdgeRT...");

  // Start main server
  const [honoServer, port, ac, sm] = await createNanoEdgeRT(dbPath);
  console.log(`🌐 NanoEdgeRT server starting on http://0.0.0.0:${port}`);

  Deno.serve({
    port,
    hostname: "0.0.0.0",
    signal: ac.signal,
  }, honoServer.fetch);

  console.log(`✅ NanoEdgeRT server running on port ${port}`);
  return [ac, sm];
}

export function stopNanoEdgeRT(ac: AbortController, sm: ServiceManagerState): void {
  console.log("🛑 Stopping NanoEdgeRT...");
  ac.abort();
  // Note: stopAllServices is now async, but we can't await in stop()
  // Consider making this async in the future
  stopAllServices(sm).catch(console.error);
  console.log("✅ NanoEdgeRT stopped");
}

export function gracefulShutdown(
  ac: AbortController,
  sm: ServiceManagerState,
): Promise<void> {
  let shutdown = false;
  // Listen for graceful shutdown signal
  globalThis.addEventListener("beforeunload", () => {
    console.log("🛑 Graceful shutdown initiated...");
    shutdown = true;
    stopNanoEdgeRT(ac, sm);
  });

  globalThis.addEventListener("SIGINT", () => {
    console.log("🛑 SIGINT received, initiating graceful shutdown...");
    shutdown = true;
    stopNanoEdgeRT(ac, sm);
  });

  return new Promise((resolve) => {
    const checkShutdown = () => {
      if (shutdown) {
        resolve();
      } else {
        setTimeout(checkShutdown, 5000);
      }
    };
    checkShutdown();
  });
}

export async function server(dbPath?: string): Promise<void> {
  const [ac, sm] = await startNanoEdgeRT(dbPath);
  console.log("NanoEdgeRT server is running. Press Ctrl+C to stop.");
  await gracefulShutdown(ac, sm);
  console.log("NanoEdgeRT server has been stopped gracefully.");
  Deno.exit(0);
}

if (import.meta.main) {
  const dbPath = Deno.args[0] || ":memory:";
  await server(dbPath);
}
