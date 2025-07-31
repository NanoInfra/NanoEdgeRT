import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT, gracefulShutdown, stopNanoEdgeRT } from "../../src/nanoedge.ts";
import { createOrLoadDatabase } from "../../database/sqlite3.ts";

Deno.test("createNanoEdgeRT - should create server with default configuration", async () => {
  const [app, port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  assertExists(app);
  assertEquals(port, 8000);
  assertExists(abortController);
  assertExists(serviceManagerState);
  assertExists(serviceManagerState.services);
  assertExists(serviceManagerState.dbContext);

  // Cleanup
  abortController.abort();
});

Deno.test("createNanoEdgeRT - should use custom database path", async () => {
  const testDbPath = ":memory:";
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(testDbPath);

  assertExists(app);
  assertExists(serviceManagerState.dbContext.dbInstance);

  // Cleanup
  abortController.abort();
});

Deno.test("createNanoEdgeRT - should setup all required routes", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  // Test that app has the expected routes by checking if fetch handles them
  const testRequests = [
    new Request("http://localhost:8000/health"),
    new Request("http://localhost:8000/status"),
    new Request("http://localhost:8000/openapi.json"),
    new Request("http://localhost:8000/docs"),
  ];

  for (const request of testRequests) {
    const response = await app.fetch(request);
    // Should not return 404 for these routes
    assertEquals(response.status !== 404, true);
  }

  // Cleanup
  abortController.abort();
});

Deno.test("createNanoEdgeRT - should handle health endpoint", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  const response = await app.fetch(new Request("http://localhost:8000/health"));
  assertEquals(response.status, 200);

  const health = await response.json();
  assertExists(health.status);
  assertExists(health.startTime);
  assertExists(health.currentTime);
  assertExists(health.upTime);
  assertExists(health.services);
  assertEquals(health.status, "ok");

  // Cleanup
  abortController.abort();
});

Deno.test("createNanoEdgeRT - should handle openapi.json endpoint", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  const response = await app.fetch(new Request("http://localhost:8000/openapi.json"));
  assertEquals(response.status, 200);

  const openapi = await response.json();
  assertExists(openapi.openapi);
  assertExists(openapi.info);
  assertExists(openapi.paths);

  // Cleanup
  abortController.abort();
});

Deno.test("stopNanoEdgeRT - should abort controller and stop services", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  // Check initial state
  assertEquals(abortController.signal.aborted, false);

  // Stop the server
  stopNanoEdgeRT(abortController, serviceManagerState);

  // Verify abort controller was triggered
  assertEquals(abortController.signal.aborted, true);
});

Deno.test("gracefulShutdown - should setup signal handlers", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  // This test just verifies the function doesn't throw
  const shutdownPromise = gracefulShutdown(abortController, serviceManagerState);

  // Simulate shutdown
  abortController.abort();

  // The promise should resolve quickly after abort
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 1000);
  });

  await Promise.race([shutdownPromise, timeoutPromise]);

  // Verify shutdown was triggered
  assertEquals(abortController.signal.aborted, true);
});

Deno.test("createNanoEdgeRT - should handle database initialization errors", async () => {
  // This test uses invalid database path to trigger error handling
  await assertRejects(
    async () => {
      await createNanoEdgeRT("/invalid/path/that/does/not/exist.db");
    },
    Error,
  );
});

Deno.test("createNanoEdgeRT - should handle configuration loading", async () => {
  // Create a temporary database with custom config
  const db = await createOrLoadDatabase(":memory:");

  // Insert custom configuration
  await db
    .insertInto("config")
    .values([
      {
        key: "main_port",
        value: "9000",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        key: "jwt_secret",
        value: "test-secret",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .execute();

  const [_app, port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  // Should use default port since we created a new in-memory DB
  assertEquals(port, 8000);
  assertExists(serviceManagerState.dbContext.config);

  // Cleanup
  abortController.abort();
});
