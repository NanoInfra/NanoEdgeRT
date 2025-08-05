import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Hono } from "hono";
import { databaseMiddleware, setupAPIRoutes } from "../../database/api.service.ts";
import { createDatabaseContext } from "../../database/dto.ts";
import { createIsolatedDb } from "../test_utils.ts";

Deno.test("databaseMiddleware - should inject database context", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);

  const middleware = databaseMiddleware(dbContext);
  assertExists(middleware);
  assertEquals(typeof middleware, "function");
});

Deno.test("setupAPIRoutes - should setup all routes", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  // Test that the app has routes set up
  assertExists(app);
});

Deno.test("getAllServicesHandler - should return services", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(new Request("http://localhost/services"));
  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.services);
  assertEquals(Array.isArray(data.services), true);
});

Deno.test("getServiceHandler - should return 404 for nonexistent service", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(new Request("http://localhost/services/nonexistent"));
  assertEquals(response.status, 404);

  const data = await response.json();
  assertExists(data.error);
});

Deno.test("getServiceHandler - should return service when it exists", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  // Create a test service
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "export default function handler() { return new Response('ok'); }",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(new Request("http://localhost/services/test-service"));
  assertEquals(response.status, 200);

  const service = await response.json();
  assertExists(service);
  assertEquals(service.name, "test-service");
});

Deno.test("createServiceHandler - should create new service", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const serviceData = {
    name: "new-service",
    code: "export default function handler() { return new Response('hello'); }",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  };

  const response = await app.fetch(
    new Request("http://localhost/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serviceData),
    }),
  );

  assertEquals(response.status, 201);

  const service = await response.json();
  assertExists(service);
  assertEquals(service.name, "new-service");
});

Deno.test("createServiceHandler - should require name and code", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const incompleteData = {
    name: "incomplete-service",
    // Missing code
  };

  const response = await app.fetch(
    new Request("http://localhost/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incompleteData),
    }),
  );

  assertEquals(response.status, 400);

  const error = await response.json();
  assertExists(error.error);
});

Deno.test("updateServiceHandler - should update existing service", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  // Create a test service first
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "original code",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  setupAPIRoutes(app, dbContext);

  const updateData = {
    code: "updated code",
    enabled: false,
  };

  const response = await app.fetch(
    new Request("http://localhost/services/test-service", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    }),
  );

  assertEquals(response.status, 200);

  const service = await response.json();
  assertExists(service);
  assertEquals(service.code, "updated code");
  assertEquals(service.enabled, false);
});

Deno.test("deleteServiceHandler - should delete existing service", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  // Create a test service first
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "code to delete",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(
    new Request("http://localhost/services/test-service", {
      method: "DELETE",
    }),
  );

  assertEquals(response.status, 200);

  const result = await response.json();
  assertExists(result.message);
});

Deno.test("getAllConfigHandler - should return all configuration", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(new Request("http://localhost/config"));
  assertEquals(response.status, 200);

  const config = await response.json();
  assertExists(config);
  assertExists(config.main_port);
  assertExists(config.available_port_start);
  assertExists(config.available_port_end);
});

Deno.test("getConfigHandler - should return specific config value", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(new Request("http://localhost/config/main_port"));
  assertEquals(response.status, 200);

  const config = await response.json();
  assertExists(config);
  assertEquals(config.key, "main_port");
  assertExists(config.value);
});

Deno.test("getConfigHandler - should return 404 for nonexistent config key", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const response = await app.fetch(new Request("http://localhost/config/nonexistent_key"));
  assertEquals(response.status, 404);

  const error = await response.json();
  assertExists(error.error);
});

Deno.test("updateConfigHandler - should update config value", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const updateData = { value: "9000" };

  const response = await app.fetch(
    new Request("http://localhost/config/main_port", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    }),
  );

  assertEquals(response.status, 200);

  const result = await response.json();
  assertExists(result.message);
});

Deno.test("updateConfigHandler - should require value", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const app = new Hono();

  setupAPIRoutes(app, dbContext);

  const incompleteData = {}; // Missing value

  const response = await app.fetch(
    new Request("http://localhost/config/test_key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incompleteData),
    }),
  );

  assertEquals(response.status, 400);

  const error = await response.json();
  assertExists(error.error);
});
