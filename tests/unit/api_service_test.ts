import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { setupApiRoutes, setupDocsRoutes } from "../../src/api/api.service.ts";
import { createDatabaseContext } from "../../database/config.ts";
import { createServiceManagerState } from "../../src/managers/service-manager.ts";
import { createIsolatedDb } from "../test_utils.ts";

Deno.test("setupDocsRoutes - should create docs router", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  const docsRouter = setupDocsRoutes(serviceManagerState);
  assertExists(docsRouter);
});

Deno.test("setupDocsRoutes - should handle service documentation request", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  // Create a service with schema
  const testSchema = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "Test Service", version: "1.0.0" },
    paths: {},
  });

  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "export default async function handler(req) { return new Response('ok'); }",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      schema: testSchema,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  const docsRouter = setupDocsRoutes(serviceManagerState);

  // Test docs route
  const response = await docsRouter.fetch(
    new Request("http://localhost/test-service"),
  );

  // Should return swagger UI page (HTML)
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type")?.includes("text/html"), true);
});

Deno.test("setupDocsRoutes - should handle OpenAPI schema request", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  // Create a service with schema
  const testSchema = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "Test Service", version: "1.0.0" },
    paths: {},
  });

  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "export default async function handler(req) { return new Response('ok'); }",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      schema: testSchema,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  const docsRouter = setupDocsRoutes(serviceManagerState);

  // Test OpenAPI schema endpoint
  const response = await docsRouter.fetch(
    new Request("http://localhost/openapi/test-service"),
  );

  assertEquals(response.status, 200);

  const schema = await response.json();
  assertExists(schema.openapi);
  assertExists(schema.info);
  assertEquals(schema.info.title, "Test Service");
  assertExists(schema.servers);
});

Deno.test("setupDocsRoutes - should handle missing service", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  const docsRouter = setupDocsRoutes(serviceManagerState);

  // Test missing service
  const response = await docsRouter.fetch(
    new Request("http://localhost/openapi/nonexistent-service"),
  );

  assertEquals(response.status, 400);

  const error = await response.json();
  assertExists(error.error);
});

Deno.test("setupDocsRoutes - should handle invalid schema", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  // Create a service with invalid schema
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "export default async function handler(req) { return new Response('ok'); }",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      schema: "invalid-json",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  const docsRouter = setupDocsRoutes(serviceManagerState);

  const response = await docsRouter.fetch(
    new Request("http://localhost/openapi/test-service"),
  );

  assertEquals(response.status, 400);

  const error = await response.json();
  assertExists(error.error);
  assertExists(error.details);
});

Deno.test("setupApiRoutes - should create service router", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  const serviceRouter = setupApiRoutes(serviceManagerState);
  assertExists(serviceRouter);
});

Deno.test("setupApiRoutes - should handle nonexistent service", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  const serviceRouter = setupApiRoutes(serviceManagerState);

  const response = await serviceRouter.fetch(
    new Request("http://localhost/nonexistent-service/"),
  );

  assertEquals(response.status, 404);

  const error = await response.json();
  assertExists(error.error);
  assertEquals(error.error, "Service 'nonexistent-service' not found");
});

Deno.test("setupApiRoutes - should handle service startup", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const serviceManagerState = createServiceManagerState(dbContext);

  // Create a test service
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code:
        "async function handler(req) { return new Response(JSON.stringify({message: 'hello'}), {headers: {'Content-Type': 'application/json'}}); }; Deno.serve(handler)",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  const serviceRouter = setupApiRoutes(serviceManagerState);

  // This should trigger service startup
  const response = await serviceRouter.fetch(
    new Request("http://localhost/test-service/"),
  );

  const res = await response.json();
  assertEquals(response.status, 200);
  assertExists(res);
  assertEquals(res.message, "hello");
});
