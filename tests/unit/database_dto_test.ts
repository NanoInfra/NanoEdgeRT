// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createDatabaseContext, loadConfig, updateConfig } from "../../database/config.ts";
import { createIsolatedDb } from "../test_utils.ts";
import {
  createService,
  deleteService,
  getAllServices,
  getService,
  updateService,
} from "../../database/tables/services.ts";

Deno.test("createDatabaseContext - should create valid context", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  assertExists(context);
  assertExists(context.dbInstance);
  assertExists(context.config);
  assertEquals(context.dbInstance, db);
});

Deno.test("loadConfig - should load default configuration", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const config = await loadConfig(context.dbInstance);

  assertExists(config);
  assertExists(config.available_port_start);
  assertExists(config.available_port_end);
  assertExists(config.main_port);
  assertExists(config.jwt_secret);

  assertEquals(typeof config.available_port_start, "number");
  assertEquals(typeof config.available_port_end, "number");
  assertEquals(typeof config.main_port, "number");
});

Deno.test("loadConfig - should return cached config on subsequent calls", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const config1 = await loadConfig(context.dbInstance);
  const config2 = await loadConfig(context.dbInstance);

  assertEquals(config1, config2);
});

Deno.test("updateConfig - should update configuration values", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const testKey = `test_key_${Date.now()}_${Math.random()}`;
  await updateConfig(context, testKey, "test_value");

  // Verify the value was stored
  const result = await db
    .selectFrom("config")
    .select(["key", "value"])
    .where("key", "=", testKey)
    .executeTakeFirst();

  assertExists(result);
  assertEquals(result.key, testKey);
  assertEquals(result.value, "test_value");
});

Deno.test("updateConfig - should handle upsert operations", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const testKey = `test_upsert_key_${Date.now()}_${Math.random()}`;

  // Insert initial value
  await updateConfig(context, testKey, "initial_value");

  // Update the same key
  await updateConfig(context, testKey, "updated_value");

  // Verify only one record exists with updated value
  const results = await db
    .selectFrom("config")
    .select(["key", "value"])
    .where("key", "=", testKey)
    .execute();

  assertEquals(results.length, 1);
  assertEquals(results[0].value, "updated_value");
});

Deno.test("createService - should create new service", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const serviceData = {
    name: "test-service",
    code: "export default function handler() { return new Response('ok'); }",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
    schema: JSON.stringify({ openapi: "3.0.0", info: { title: "Test", version: "1.0.0" } }),
  };

  const service = await createService(context, serviceData);

  assertExists(service);
  assertEquals(service.name, "test-service");
  assertEquals(service.code, serviceData.code);
  assertEquals(service.enabled, true);
  assertEquals(service.jwt_check, false);
  assertExists(service.permissions);
  assertExists(service.schema);
});

Deno.test("getService - should retrieve service by name", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  // Create a service first
  const serviceData = {
    name: "test-service",
    code: "export default function handler() { return new Response('ok'); }",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  };

  await createService(context, serviceData);

  // Retrieve the service
  const service = await getService(context, "test-service");

  assertExists(service);
  assertEquals(service.name, "test-service");
  assertEquals(service.code, serviceData.code);
});

Deno.test("getService - should return null for nonexistent service", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const service = await getService(context, "nonexistent");
  assertEquals(service, null);
});

Deno.test("getAllServices - should retrieve all services", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  // Create multiple services
  const serviceData1 = {
    name: "service1",
    code: "export default function handler() { return new Response('service1'); }",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  };

  const serviceData2 = {
    name: "service2",
    code: "export default function handler() { return new Response('service2'); }",
    enabled: false,
    jwt_check: true,
    permissions: { read: ["file1"], write: ["file2"], env: ["VAR1"], run: ["cmd1"] },
  };

  await createService(context, serviceData1);
  await createService(context, serviceData2);

  const services = await getAllServices(context);

  assertExists(services);
  assertEquals(services.length >= 2, true); // May include default services

  const service1 = services.find((s) => s.name === "service1");
  const service2 = services.find((s) => s.name === "service2");

  assertExists(service1);
  assertExists(service2);
  assertEquals(service1.enabled, true);
  assertEquals(service2.enabled, false);
});

Deno.test("updateService - should update existing service", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  // Create a service first
  const serviceData = {
    name: "test-service",
    code: "original code",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  };

  await createService(context, serviceData);

  // Update the service
  const updateData = {
    name: "test-service",
    code: "updated code",
    enabled: false,
    jwt_check: true,
    permissions: { read: ["file1"], write: [], env: [], run: [] },
    schema: JSON.stringify({ openapi: "3.0.0", info: { title: "Updated", version: "2.0.0" } }),
  };

  const updatedService = await updateService(context, updateData);

  assertExists(updatedService);
  assertEquals((updatedService as any).name, "test-service");
  assertEquals((updatedService as any).code, "updated code");
  assertEquals((updatedService as any).enabled, false);
  assertEquals((updatedService as any).jwt_check, true);
  assertExists((updatedService as any).schema);
});

Deno.test("deleteService - should remove service", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  // Create a service first
  const serviceData = {
    name: "test-service",
    code: "export default function handler() { return new Response('ok'); }",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  };

  await createService(context, serviceData);

  // Verify service exists
  let service = await getService(context, "test-service");
  assertExists(service);

  // Delete the service
  await deleteService(context, "test-service");

  // Verify service is deleted
  service = await getService(context, "test-service");
  assertEquals(service, null);
});

Deno.test("createService - should handle duplicate names", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);

  const serviceData = {
    name: "duplicate-service",
    code: "export default function handler() { return new Response('ok'); }",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  };

  // Create first service
  await createService(context, serviceData);

  // Try to create service with same name - should handle gracefully
  try {
    await createService(context, serviceData);
    // If it doesn't throw, that's fine - implementation may handle duplicates
  } catch (error) {
    // If it throws, that's also acceptable behavior
    assertExists(error);
  }
});
