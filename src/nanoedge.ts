import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { serveStatic } from "@hono/node-server/serve-static";
import { createOrLoadDatabase } from "../database/sqlite3.ts";
import { createDatabaseContext, DatabaseContext } from "../database/dto.ts";
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
  db: string | DatabaseContext,
): Promise<
  [Hono, number, AbortController, ServiceManagerState]
> {
  const dbContext = typeof db === "string"
    ? await createDatabaseContext(await createOrLoadDatabase(db))
    : db;
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
  db: string | DatabaseContext = ":memory:",
): Promise<void> {
  console.log("🚀 Starting NanoEdgeRT...");

  // Start main server
  const [honoServer, port, ac, sm] = await createNanoEdgeRT(db);
  console.log(`🌐 NanoEdgeRT server starting on http://0.0.0.0:${port}`);

  Deno.serve({
    port,
    hostname: "0.0.0.0",
    signal: ac.signal,
  }, honoServer.fetch);

  ac.signal.addEventListener("abort", () => {
    console.log("🛑 NanoEdgeRT server stopped gracefully.");
    stopAllServices(sm).catch(console.error);
    console.log("✅ NanoEdgeRT stopped");
  });

  globalThis.addEventListener("beforeunload", () => {
    console.log("🛑 Graceful shutdown initiated...");
    stopNanoEdgeRT(ac);
  });

  globalThis.addEventListener("SIGINT", () => {
    console.log("🛑 SIGINT received, initiating graceful shutdown...");
    stopNanoEdgeRT(ac);
  });

  console.log(`✅ NanoEdgeRT server running on port ${port}`);
  console.log("📚 API documentation available at /docs");
}

function stopNanoEdgeRT(ac: AbortController): void {
  console.log("🛑 Stopping NanoEdgeRT...");
  ac.abort();
}

export async function server(dbPath?: string | DatabaseContext): Promise<void> {
  await startNanoEdgeRT(dbPath);
  console.log("NanoEdgeRT server is running. Press Ctrl+C to stop.");
  Deno.exit(0);
}

if (import.meta.main) {
  const dbPath = Deno.args[0] || ":memory:";
  await server(dbPath);
}
