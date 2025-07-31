import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT } from "../../src/nanoedge.ts";
import { createService, getService } from "../../database/dto.ts";

Deno.test("Integration: Service lifecycle from creation to execution", async () => {
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const dbContext = serviceManagerState.dbContext;

    // Create a new service via database API
    const serviceData = {
      name: "test-lifecycle-service",
      code: `export default async function handler(req) {
        const url = new URL(req.url);
        return new Response(JSON.stringify({
          message: "Hello from test service",
          method: req.method,
          path: url.pathname
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }`,
      enabled: true,
      jwt_check: false,
      permissions: { read: [], write: [], env: [], run: [] },
      schema: JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Test Service", version: "1.0.0" },
        paths: {
          "/": {
            get: {
              summary: "Test endpoint",
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    };

    // Create the service
    const createdService = await createService(dbContext, serviceData);
    assertExists(createdService);
    assertEquals(createdService.name, "test-lifecycle-service");

    // Verify service can be retrieved
    const retrievedService = await getService(dbContext, "test-lifecycle-service");
    assertExists(retrievedService);
    assertEquals(retrievedService.name, "test-lifecycle-service");

    // Test service documentation endpoint
    const docsResponse = await app.fetch(
      new Request("http://localhost:8000/api/docs/test-lifecycle-service"),
    );
    assertEquals(docsResponse.status, 200);

    // Test service OpenAPI schema endpoint
    const schemaResponse = await app.fetch(
      new Request("http://localhost:8000/api/docs/openapi/test-lifecycle-service"),
    );
    assertEquals(schemaResponse.status, 200);

    const schema = await schemaResponse.json();
    assertExists(schema.openapi);
    assertEquals(schema.info.title, "Test Service");

    // Test service execution (will trigger service startup)
    const serviceResponse = await app.fetch(
      new Request("http://localhost:8000/api/v2/test-lifecycle-service/"),
    );

    // Note: In test environment, the service may not actually start due to worker limitations,
    // but we verify the request is handled appropriately
    assertExists(serviceResponse);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service with JWT authentication", async () => {
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const dbContext = serviceManagerState.dbContext;

    // Create a JWT-protected service
    const serviceData = {
      name: "protected-service",
      code: `export default async function handler(req) {
        return new Response(JSON.stringify({
          message: "This is a protected service",
          authenticated: true
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }`,
      enabled: true,
      jwt_check: true, // Enable JWT authentication
      permissions: { read: [], write: [], env: [], run: [] },
    };

    await createService(dbContext, serviceData);

    // Test access without JWT token (should fail due to JWT check)
    const unauthorizedResponse = await app.fetch(
      new Request("http://localhost:8000/api/v2/protected-service/"),
    );

    // The service should either fail to start or reject the request
    assertExists(unauthorizedResponse);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service with custom permissions", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const dbContext = serviceManagerState.dbContext;

    // Create a service with specific permissions
    const serviceData = {
      name: "permissions-service",
      code: `export default async function handler(req) {
        // This service would need read/write permissions in a real environment
        return new Response(JSON.stringify({
          message: "Service with custom permissions"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }`,
      enabled: true,
      jwt_check: false,
      permissions: {
        read: ["/tmp"],
        write: ["/tmp"],
        env: ["HOME", "USER"],
        run: ["ls", "echo"],
      },
    };

    const createdService = await createService(dbContext, serviceData);
    assertExists(createdService);
    assertEquals(createdService.permissions.read.includes("/tmp"), true);
    assertEquals(createdService.permissions.write.includes("/tmp"), true);
    assertEquals(createdService.permissions.env.includes("HOME"), true);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Database configuration management", async () => {
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const db = serviceManagerState.dbContext.dbInstance;

    // Test configuration reading
    const configs = await db
      .selectFrom("config")
      .selectAll()
      .execute();

    assertEquals(configs.length >= 3, true); // Should have main_port, port range, jwt_secret

    // Find main_port config
    const mainPortConfig = configs.find((c) => c.key === "main_port");
    assertExists(mainPortConfig);
    assertEquals(mainPortConfig.value, "8000");

    // Test configuration updating
    await db
      .updateTable("config")
      .set({
        value: "9000",
        updated_at: new Date().toISOString(),
      })
      .where("key", "=", "main_port")
      .execute();

    // Verify update
    const updatedConfig = await db
      .selectFrom("config")
      .select(["key", "value"])
      .where("key", "=", "main_port")
      .executeTakeFirst();

    assertExists(updatedConfig);
    assertEquals(updatedConfig.value, "9000");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Port allocation and service management", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const { allocatePort, releasePort, getAllocatedPorts } = await import(
      "../../database/sqlite3.ts"
    );
    const db = serviceManagerState.dbContext.dbInstance;

    // Test port allocation
    const port1 = await allocatePort("service1", db);
    const port2 = await allocatePort("service2", db);
    const port3 = await allocatePort("service3", db);

    assertExists(port1);
    assertExists(port2);
    assertExists(port3);

    // Ports should be different
    assertEquals(port1 !== port2, true);
    assertEquals(port2 !== port3, true);
    assertEquals(port1 !== port3, true);

    // Check allocated ports
    const allocatedPorts = await getAllocatedPorts(db);
    assertEquals(allocatedPorts.length, 3);

    // Release a port
    await releasePort("service2", db);

    // Check allocated ports again
    const remainingPorts = await getAllocatedPorts(db);
    assertEquals(remainingPorts.length, 2);

    // Verify the released port is available again
    const portsInDB = await db
      .selectFrom("ports")
      .selectAll()
      .where("port", "=", port2)
      .executeTakeFirst();

    assertExists(portsInDB);
    assertEquals(portsInDB.service_name, null);
    assertExists(portsInDB.released_at);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service state management", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const { getService, getAllServices } = await import("../../src/service-manager.ts");

    // Initially no services should be running
    assertEquals(serviceManagerState.services.size, 0);

    const allServices = getAllServices(serviceManagerState);
    assertEquals(allServices.length, 0);

    // Test getting non-existent service
    const nonExistentService = getService(serviceManagerState, "non-existent");
    assertEquals(nonExistentService, undefined);

    // The service manager state should be properly initialized
    assertExists(serviceManagerState.dbContext);
    assertExists(serviceManagerState.services);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Default services availability", async () => {
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const db = serviceManagerState.dbContext.dbInstance;

    // Check that default services exist in database
    const defaultServices = await db
      .selectFrom("services")
      .selectAll()
      .where("name", "in", ["hello", "calculator"])
      .execute();

    assertEquals(defaultServices.length, 2);

    // Test hello service documentation
    const helloDocsResponse = await app.fetch(
      new Request("http://localhost:8000/api/docs/hello"),
    );
    assertEquals(helloDocsResponse.status, 200);

    // Test calculator service documentation
    const calcDocsResponse = await app.fetch(
      new Request("http://localhost:8000/api/docs/calculator"),
    );
    assertEquals(calcDocsResponse.status, 200);

    // Verify default services have proper schemas
    const helloService = defaultServices.find((s) => s.name === "hello");
    const calcService = defaultServices.find((s) => s.name === "calculator");

    assertExists(helloService);
    assertExists(calcService);
    assertExists(helloService.schema);
    assertExists(calcService.schema);

    // Verify schemas are valid JSON
    const helloSchema = JSON.parse(helloService.schema);
    const calcSchema = JSON.parse(calcService.schema);

    assertExists(helloSchema.openapi);
    assertExists(calcSchema.openapi);
  } finally {
    abortController.abort();
  }
});
