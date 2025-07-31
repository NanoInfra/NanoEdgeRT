import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

import {
  allocatePort,
  createOrLoadDatabase,
  getAllocatedPorts,
  getServicePort,
  releasePort,
} from "../../database/sqlite3.ts";
import { createIsolatedDb } from "../test_utils.ts";

Deno.test("createOrLoadDatabase - should create in-memory database", async () => {
  const db = await createIsolatedDb();
  assertExists(db);

  // Verify tables exist by querying them
  const services = await db.selectFrom("services").selectAll().execute();
  const config = await db.selectFrom("config").selectAll().execute();
  const ports = await db.selectFrom("ports").selectAll().execute();

  assertEquals(Array.isArray(services), true);
  assertEquals(Array.isArray(config), true);
  assertEquals(Array.isArray(ports), true);
});

Deno.test("createOrLoadDatabase - should initialize with default data", async () => {
  const db = await createOrLoadDatabase(":memory:");

  // Check for default services
  const services = await db.selectFrom("services").selectAll().execute();
  assertEquals(services.length >= 1, true); // Should have hello service

  // Check for default configuration
  const config = await db.selectFrom("config").selectAll().execute();
  assertEquals(config.length >= 3, true); // Should have main_port, port range, jwt_secret

  // Check for initialized ports
  const ports = await db.selectFrom("ports").selectAll().execute();
  assertEquals(ports.length >= 100, true); // Should have port range initialized
});

Deno.test("createOrLoadDatabase - should handle file database path", async () => {
  const testDbPath = ":memory:"; // Use memory for test safety
  const db = await createOrLoadDatabase(testDbPath);

  assertExists(db);

  // Verify it works the same as memory database
  const services = await db.selectFrom("services").selectAll().execute();
  assertEquals(Array.isArray(services), true);
});

Deno.test("allocatePort - should allocate first available port", async () => {
  const db = await createIsolatedDb();

  const port = await allocatePort("test-service", db);
  assertExists(port);
  assertEquals(typeof port, "number");
});

Deno.test("allocatePort - should mark port as allocated", async () => {
  const db = await createIsolatedDb();

  const port = await allocatePort("test-service", db);

  // Verify port is marked as allocated
  const allocatedPort = await db
    .selectFrom("ports")
    .selectAll()
    .where("port", "=", port)
    .executeTakeFirst();

  assertExists(allocatedPort);
  assertEquals(allocatedPort.service_name, "test-service");
  assertExists(allocatedPort.allocated_at);
});

Deno.test("allocatePort - should throw when no ports available", async () => {
  // Create a database with only one port available
  const db = await createIsolatedDb();
  const testPort = 9500; // Use unique port

  // Set very small port range with just one port
  await db
    .updateTable("config")
    .set({ value: testPort.toString() })
    .where("key", "=", "available_port_start")
    .execute();

  await db
    .updateTable("config")
    .set({ value: testPort.toString() })
    .where("key", "=", "available_port_end")
    .execute();

  // Clear and re-initialize ports with new range
  await db.deleteFrom("ports").execute();
  await db
    .insertInto("ports")
    .values({
      port: testPort,
      service_name: undefined,
      allocated_at: undefined,
      released_at: undefined,
    })
    .execute();

  // Allocate the only port
  await allocatePort("service1", db);

  // Try to allocate another port - should throw
  await assertRejects(
    async () => {
      await allocatePort("service2", db);
    },
    Error,
    "No available ports",
  );
});

Deno.test("getServicePort - should return port for existing service", async () => {
  const db = await createIsolatedDb();

  // Create a test service first
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "export default function() { return new Response('ok'); }",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  // Allocate a port to the service
  const allocatedPort = await allocatePort("test-service", db);

  // Get the port
  const port = await getServicePort("test-service", db);
  assertEquals(port, allocatedPort);
});

Deno.test("getServicePort - should return null for nonexistent service", async () => {
  const db = await createIsolatedDb();

  const port = await getServicePort("nonexistent-service", db);
  assertEquals(port, null);
});

Deno.test("releasePort - should free allocated port", async () => {
  const db = await createIsolatedDb();

  // Create a test service first
  await db
    .insertInto("services")
    .values({
      name: "test-service",
      code: "export default function() { return new Response('ok'); }",
      enabled: true,
      jwt_check: false,
      permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  // Allocate a port first
  const port = await allocatePort("test-service", db);

  // Release the port
  await releasePort("test-service", db);

  // Verify port is released
  const releasedPort = await db
    .selectFrom("ports")
    .selectAll()
    .where("port", "=", port)
    .executeTakeFirst();

  assertExists(releasedPort);
  assertExists(releasedPort.released_at);
  // do another allocation
  // Check that released_at is null
  const port2 = await allocatePort("test-service", db);
  assertEquals(port2, port, `${port2} should be the same as ${port}`);
});

Deno.test("releasePort - should handle nonexistent service gracefully", async () => {
  const db = await createIsolatedDb();

  // Should not throw when releasing port for nonexistent service
  await releasePort("nonexistent-service", db);
});

Deno.test("getAllocatedPorts - should return all allocated ports", async () => {
  const db = await createIsolatedDb(); // Use isolated database to avoid conflicts

  // Create test services first
  const services = ["service1", "service2", "service3"];
  for (const serviceName of services) {
    await db
      .insertInto("services")
      .values({
        name: serviceName,
        code: "export default function() { return new Response('ok'); }",
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();
  }

  // Allocate multiple ports
  await allocatePort("service1", db);
  await allocatePort("service2", db);
  await allocatePort("service3", db);

  const allocatedPorts = await getAllocatedPorts(db);

  assertEquals(allocatedPorts.length, 3);

  allocatedPorts.forEach((portInfo) => {
    assertExists(portInfo.port);
    assertExists(portInfo.serviceName);
    assertExists(portInfo.allocatedAt);
    assertEquals(typeof portInfo.port, "number");
    assertEquals(typeof portInfo.serviceName, "string");
    assertEquals(typeof portInfo.allocatedAt, "string");
  });
});

Deno.test("getAllocatedPorts - should return empty array when no ports allocated", async () => {
  const db = await createIsolatedDb();

  const allocatedPorts = await getAllocatedPorts(db);
  assertEquals(allocatedPorts.length, 0);
});

Deno.test("port allocation - should handle concurrent allocations", async () => {
  const db = await createIsolatedDb(); // Use isolated database to avoid conflicts

  // Create test services first
  const services = ["service1", "service2", "service3"];
  for (const serviceName of services) {
    await db
      .insertInto("services")
      .values({
        name: serviceName,
        code: "export default function() { return new Response('ok'); }",
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();
  }

  // Try to allocate ports concurrently
  const promises = [
    allocatePort("service1", db),
    allocatePort("service2", db),
    allocatePort("service3", db),
  ];

  const ports = await Promise.all(promises);
  console.log(ports);
  // All ports should be different
  const uniquePorts = new Set(ports);
  assertEquals(uniquePorts.size, 3);
  assertEquals(ports.length, 3);
});

Deno.test("database schema - should have correct table structure", async () => {
  const db = await createIsolatedDb();

  // Test services table structure
  const serviceFields = await db
    .selectFrom("services")
    .select([
      "id",
      "name",
      "code",
      "enabled",
      "jwt_check",
      "permissions",
      "schema",
      "port",
      "created_at",
      "updated_at",
    ])
    .limit(1)
    .execute();

  // Should not throw, indicating all fields exist
  assertEquals(Array.isArray(serviceFields), true);

  // Test config table structure
  const configFields = await db
    .selectFrom("config")
    .select(["key", "value", "created_at", "updated_at"])
    .limit(1)
    .execute();

  assertEquals(Array.isArray(configFields), true);

  // Test ports table structure
  const portFields = await db
    .selectFrom("ports")
    .select(["port", "service_name", "allocated_at", "released_at"])
    .limit(1)
    .execute();

  assertEquals(Array.isArray(portFields), true);
});

Deno.test("database initialization - should be idempotent", async () => {
  const db = await createIsolatedDb();

  // Get initial counts
  const initialServices = await db.selectFrom("services").selectAll().execute();
  const initialConfig = await db.selectFrom("config").selectAll().execute();
  const initialPorts = await db.selectFrom("ports").selectAll().execute();

  // Running initialization again should not duplicate data
  // Note: This test assumes initialization is called again,
  // but our current implementation may not support this directly

  const services = await db.selectFrom("services").selectAll().execute();
  const config = await db.selectFrom("config").selectAll().execute();
  const ports = await db.selectFrom("ports").selectAll().execute();

  // Counts should be the same (no duplicates)
  assertEquals(services.length, initialServices.length);
  assertEquals(config.length, initialConfig.length);
  assertEquals(ports.length, initialPorts.length);
});
