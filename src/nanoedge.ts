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
} from "./managers/service-manager.ts";
import { setupApiRoutes, setupDocsRoutes } from "./api.service.ts";
import { setupAdminAPIRoutes } from "./api.admin.ts";
import { setupJWTRoutes } from "./api.jwt.ts";
import { Context } from "hono";
import openapi from "./openapi.ts";
import { setupFunctionAPIRoutes } from "./api.function.ts";

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
  app.get("/openapi.json", (c: Context) => c.json(openapi, 200));
  app.get("/health", status);
  app.get("/status", status);
  app.get("/static/*", serveStatic({ root: "./" }));

  app.route("/api/docs", setupDocsRoutes(serviceManagerState));
  app.route("/api/v2", setupApiRoutes(serviceManagerState));
  app.route("/functions/v2", setupFunctionAPIRoutes(dbContext));
  app.route("/admin-api/v2", setupAdminAPIRoutes(dbContext));

  // 隐藏API
  app.route("/jwt", setupJWTRoutes());

  const abortController = new AbortController();
  return [app, dbContext.config?.main_port || 8000, abortController, serviceManagerState];
}

export async function startNanoEdgeRT(
  db: string | DatabaseContext = ":memory:",
): Promise<AbortController> {
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

  console.log(`✅ NanoEdgeRT server running on port ${port}`);
  console.log("📚 API documentation available at /docs");

  return ac;
}

function stopNanoEdgeRT(ac: AbortController): void {
  console.log("🛑 Stopping NanoEdgeRT...");
  ac.abort();
}

if (import.meta.main) {
  const dbPath = Deno.args[0] || ":memory:";

  Deno.addSignalListener("SIGINT", () => {
    console.log("\n🛑 SIGINT received, initiating graceful shutdown...");
    stopNanoEdgeRT(ac);
  });

  // if is not windows
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", () => {
      console.log("\n🛑 SIGTERM received, initiating graceful shutdown...");
      stopNanoEdgeRT(ac);
    });
  }

  const ac = await startNanoEdgeRT(dbPath);
  console.log("NanoEdgeRT server is running. Press Ctrl+C to stop.");
  await new Promise((resolve) => ac.signal.addEventListener("abort", resolve));
}
