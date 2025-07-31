import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT } from "../../src/nanoedge.ts";
import { createDatabaseContext, createService, getService } from "../../database/dto.ts";
import { createIsolatedDb } from "../test_utils.ts";

Deno.test("Integration: Service lifecycle from creation to execution", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

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
    new Request(
      `http://localhost:${port}/api/docs/test-lifecycle-service`,
    ),
  );
  assertEquals(docsResponse.status, 200);
  const docs = await docsResponse.text(); // We just want to ensure it returns valid documentation
  assertEquals(docs.trimStart()[0], "<");

  // Test service OpenAPI schema endpoint
  const schemaResponse = await app.fetch(
    new Request(
      `http://localhost:${port}/api/docs/openapi/test-lifecycle-service`,
    ),
  );
  assertEquals(schemaResponse.status, 200);

  const schema = await schemaResponse.json();
  assertExists(schema.openapi);
  assertEquals(schema.info.title, "Test Service");

  // Test service execution (will trigger service startup)
  const serviceResponse = await app.fetch(
    new Request(`http://localhost:${port}/api/v2/test-lifecycle-service/`),
  );
  assertEquals(serviceResponse.status, 200);
  const responseBody = await serviceResponse.json();
  assertExists(responseBody);
  assertEquals(responseBody.message, "Hello from test service");

  abortController.abort();
});

Deno.test("Integration: Service with JWT authentication", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(dbContext);
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
    assertEquals(unauthorizedResponse.status, 401); // Unauthorized due to missing JWT
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service with custom permissions", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(dbContext);

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
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [_app, port, abortController, serviceManagerState] = await createNanoEdgeRT(dbContext);

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
    assertEquals(mainPortConfig.value.toString(), port.toString());
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service state management", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(dbContext);

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
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    const db = serviceManagerState.dbContext.dbInstance;

    // Check that default services exist in database
    const defaultServices = await db
      .selectFrom("services")
      .selectAll()
      .where("name", "in", ["hello"])
      .execute();

    assertEquals(defaultServices.length, 1);

    // Test hello service documentation
    const helloDocsResponse = await app.fetch(
      new Request("http://localhost:8000/api/docs/hello"),
    );
    assertEquals(helloDocsResponse.status, 200);

    // Verify default services have proper schemas
    const helloService = defaultServices.find((s) => s.name === "hello");

    assertExists(helloService);
    assertExists(helloService.schema);

    // Verify schemas are valid JSON
    const helloSchema = JSON.parse(helloService.schema);

    assertExists(helloSchema.openapi);
  } finally {
    abortController.abort();
  }
});
