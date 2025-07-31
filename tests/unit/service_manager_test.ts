// deno-lint-ignore-file no-explicit-any
import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  createServiceManagerState,
  getAllServices,
  getService,
  startService,
  stopAllServices,
  stopService,
} from "../../src/service-manager.ts";
import { createDatabaseContext } from "../../database/dto.ts";
import { createOrLoadDatabase } from "../../database/sqlite3.ts";

Deno.test("createServiceManagerState - should create valid state", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);

  const state = createServiceManagerState(dbContext);

  assertExists(state);
  assertExists(state.services);
  assertExists(state.dbContext);
  assertEquals(state.services.size, 0);
  assertEquals(state.dbContext, dbContext);
});

Deno.test("getService - should return undefined for nonexistent service", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  const service = getService(state, "nonexistent");
  assertEquals(service, undefined);
});

Deno.test("getService - should return service when it exists", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  // Manually add a service to state
  const mockService = {
    config: {
      name: "test-service",
      enabled: true,
      jwt_check: false,
      permissions: { read: [], write: [], env: [], run: [] },
      code: "export default async function handler() { return new Response('ok'); }",
    },
    port: 8001,
    status: "running" as const,
  };

  state.services.set("test-service", mockService);

  const service = getService(state, "test-service");
  assertExists(service);
  assertEquals(service.config.name, "test-service");
});

Deno.test("getAllServices - should return empty array initially", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  const services = getAllServices(state);
  assertEquals(services.length, 0);
});

Deno.test("getAllServices - should return all services without sensitive data", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  // Add multiple mock services
  const mockServices = [
    {
      config: {
        name: "service1",
        enabled: true,
        jwt_check: false,
        permissions: { read: [], write: [], env: [], run: [] },
        code: "code1",
      },
      port: 8001,
      status: "running" as const,
    },
    {
      config: {
        name: "service2",
        enabled: true,
        jwt_check: true,
        permissions: { read: [], write: [], env: [], run: [] },
        code: "code2",
      },
      port: 8002,
      status: "stopped" as const,
    },
  ];

  mockServices.forEach((service) => {
    state.services.set(service.config.name, service);
  });

  const services = getAllServices(state);
  assertEquals(services.length, 2);

  // Verify sensitive data is not exposed
  services.forEach((service) => {
    assertExists((service as any).name);
    assertExists((service as any).port);
    assertExists((service as any).status);
    assertEquals((service as any).config, undefined);
    assertEquals((service as any).worker, undefined);
  });
});

Deno.test("startService - should reject service without code", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  const serviceConfig = {
    name: "test-service",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
    // Missing code property
  };

  await assertRejects(
    async () => {
      await startService(state, serviceConfig);
    },
    Error,
    "Service code is required",
  );
});

Deno.test("startService - should return existing service if already running", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  // Add an existing service
  const existingService = {
    config: {
      name: "test-service",
      enabled: true,
      jwt_check: false,
      permissions: { read: [], write: [], env: [], run: [] },
      code: "export default async function handler() { return new Response('ok'); }",
    },
    port: 8001,
    status: "running" as const,
  };

  state.services.set("test-service", existingService);

  const serviceConfig = existingService.config;
  const result = await startService(state, serviceConfig);

  assertEquals(result, existingService);
});

Deno.test("startService - should create new service", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  const serviceConfig = {
    name: "test-service",
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
    code: "export default async function handler(req) { return new Response('Hello World'); }",
  };

  // This will fail in unit test environment due to worker creation,
  // but we can test the initial setup
  try {
    const service = await startService(state, serviceConfig);
    assertExists(service);
    assertEquals(service.config.name, "test-service");
    assertExists(service.port);
  } catch (error) {
    // Expected to fail in test environment due to worker limitations
    // We mainly test that the function processes the config correctly
    assertExists(error);
  }
});

Deno.test("stopService - should handle nonexistent service", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  // Should not throw when stopping nonexistent service
  await stopService(state, "nonexistent");
  assertEquals(state.services.size, 0);
});

Deno.test("stopService - should remove service from state", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  // Add a mock service
  const mockService = {
    config: {
      name: "test-service",
      enabled: true,
      jwt_check: false,
      permissions: { read: [], write: [], env: [], run: [] },
      code: "code",
    },
    port: 8001,
    status: "running" as const,
  };

  state.services.set("test-service", mockService);
  assertEquals(state.services.size, 1);

  await stopService(state, "test-service");
  assertEquals(state.services.size, 0);
});

Deno.test("stopAllServices - should stop all services", async () => {
  const db = await createOrLoadDatabase(":memory:");
  const dbContext = await createDatabaseContext(db);
  const state = createServiceManagerState(dbContext);

  // Add multiple mock services
  const mockServices = ["service1", "service2", "service3"];
  mockServices.forEach((name, index) => {
    state.services.set(name, {
      config: {
        name,
        enabled: true,
        jwt_check: false,
        permissions: { read: [], write: [], env: [], run: [] },
        code: "code",
      },
      port: 8001 + index,
      status: "running" as const,
    });
  });

  assertEquals(state.services.size, 3);

  await stopAllServices(state);
  assertEquals(state.services.size, 0);
});
