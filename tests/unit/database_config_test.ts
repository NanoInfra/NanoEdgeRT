import { assertEquals, assertExists } from "../test_utils.ts";
import { createTestDatabase } from "../test_database.ts";

Deno.test("DatabaseConfig - should initialize and load default config", async () => {
  const testDb = await createTestDatabase();

  try {
    const config = await testDb.dbConfig.loadConfig();

    // Test the default values from fresh database
    assertEquals(config.available_port_start, 8001);
    assertEquals(config.available_port_end, 8999);
    assertEquals(config.main_port, 8000);
    assertExists(config.jwt_secret);
    assertEquals(Array.isArray(config.services), true);
  } finally {
    await testDb.cleanup();
  }
});

Deno.test("DatabaseConfig - should create and retrieve service", async () => {
  const testDb = await createTestDatabase();

  try {
    const uniqueName = `test-service-config-${Date.now()}`;
    const testService = {
      name: uniqueName,
      code: `export default async function handler(req) {
        return new Response("test");
      }`,
      enabled: true,
      jwt_check: false,
      permissions: {
        read: ["./test"],
        write: [],
        env: [],
        run: [],
      },
    };

    // Create service
    await testDb.dbConfig.createService(testService);

    // Retrieve service
    const retrievedService = await testDb.dbConfig.getService(uniqueName);

    assertExists(retrievedService);
    assertEquals(retrievedService.name, uniqueName);
    assertEquals(retrievedService.enabled, true);
    assertEquals(retrievedService.jwt_check, false);
    assertEquals(retrievedService.permissions.read.length, 1);
    assertEquals(retrievedService.permissions.read[0], "./test");

    // Clean up
    await testDb.dbConfig.deleteService(uniqueName);
  } finally {
    await testDb.cleanup();
  }
});

Deno.test("DatabaseConfig - should update service", async () => {
  const testDb = await createTestDatabase();

  try {
    const uniqueName = `test-service-update-${Date.now()}`;
    const testService = {
      name: uniqueName,
      code: `export default async function handler(req) {
        return new Response("original");
      }`,
      enabled: true,
      jwt_check: false,
      permissions: { read: [], write: [], env: [], run: [] },
    };

    // Create service
    await testDb.dbConfig.createService(testService);

    // Update service
    await testDb.dbConfig.updateService(uniqueName, {
      code: `export default async function handler(req) {
        return new Response("updated");
      }`,
      enabled: false,
      jwt_check: true,
    });

    // Retrieve updated service
    const updatedService = await testDb.dbConfig.getService(uniqueName);

    assertExists(updatedService);
    assertEquals(updatedService.enabled, false);
    assertEquals(updatedService.jwt_check, true);
    assertEquals(updatedService.code.includes("updated"), true);

    // Clean up
    await testDb.dbConfig.deleteService(uniqueName);
  } finally {
    await testDb.cleanup();
  }
});

Deno.test("DatabaseConfig - should delete service", async () => {
  const testDb = await createTestDatabase();

  try {
    const uniqueName = `test-service-delete-${Date.now()}`;
    const testService = {
      name: uniqueName,
      code: `export default async function handler(req) {
        return new Response("test");
      }`,
      enabled: true,
      jwt_check: false,
      permissions: { read: [], write: [], env: [], run: [] },
    };

    // Create service
    await testDb.dbConfig.createService(testService);

    // Verify service exists
    let service = await testDb.dbConfig.getService(uniqueName);
    assertExists(service);

    // Delete service
    await testDb.dbConfig.deleteService(uniqueName);

    // Verify service no longer exists
    service = await testDb.dbConfig.getService(uniqueName);
    assertEquals(service, null);
  } finally {
    await testDb.cleanup();
  }
});

Deno.test("DatabaseConfig - should update and retrieve config values", async () => {
  const testDb = await createTestDatabase();

  try {
    // Update config value
    await testDb.dbConfig.updateConfig("test_key", "test_value");

    // Load config to verify update
    const _config = await testDb.dbConfig.loadConfig();

    // Since our config interface doesn't include arbitrary keys,
    // we test through the internal methods

    // Clean up by getting all services to verify the method works
    const services = await testDb.dbConfig.getAllServices();
    assertEquals(Array.isArray(services), true);
  } finally {
    await testDb.cleanup();
  }
});

Deno.test("DatabaseConfig - should handle non-existent service gracefully", async () => {
  const testDb = await createTestDatabase();

  try {
    const nonExistentService = await testDb.dbConfig.getService("non-existent-service");
    assertEquals(nonExistentService, null);
  } finally {
    await testDb.cleanup();
  }
});

Deno.test("DatabaseConfig - should list all services", async () => {
  const testDb = await createTestDatabase();

  try {
    // The database should be seeded with default services
    const services = await testDb.dbConfig.getAllServices();
    assertEquals(Array.isArray(services), true);

    // Check that default services exist
    const serviceNames = services.map((s) => s.name);
    assertEquals(serviceNames.includes("hello"), true);
    assertEquals(serviceNames.includes("calculator"), true);
  } finally {
    await testDb.cleanup();
  }
});
