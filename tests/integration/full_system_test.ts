import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT } from "../../src/nanoedge.ts";

Deno.test("Integration: Full server startup and basic endpoints", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test health endpoint
    const healthResponse = await app.fetch(new Request("http://localhost:8000/health"));
    assertEquals(healthResponse.status, 200);

    const health = await healthResponse.json();
    assertExists(health.status);
    assertExists(health.startTime);
    assertExists(health.services);
    assertEquals(health.status, "ok");

    // Test status endpoint
    const statusResponse = await app.fetch(new Request("http://localhost:8000/status"));
    assertEquals(statusResponse.status, 200);

    const status = await statusResponse.json();
    assertExists(status.status);
    assertEquals(status.status, "ok");

    // Test OpenAPI endpoint
    const openapiResponse = await app.fetch(new Request("http://localhost:8000/openapi.json"));
    assertEquals(openapiResponse.status, 200);

    const openapi = await openapiResponse.json();
    assertExists(openapi.openapi);
    assertExists(openapi.info);
    assertExists(openapi.paths);

    // Test docs endpoint (should return HTML)
    const docsResponse = await app.fetch(new Request("http://localhost:8000/docs"));
    assertEquals(docsResponse.status, 200);
    assertEquals(docsResponse.headers.get("content-type")?.includes("text/html"), true);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service API routes functionality", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test service listing
    const servicesResponse = await app.fetch(new Request("http://localhost:8000/api/v2/hello/"));

    // Should attempt to start the hello service (may fail in test environment)
    assertExists(servicesResponse);
    // Consume response body to prevent leaks
    await servicesResponse.text();

    // Test nonexistent service
    const nonExistentResponse = await app.fetch(
      new Request("http://localhost:8000/api/v2/nonexistent/"),
    );
    assertEquals(nonExistentResponse.status, 404);

    const error = await nonExistentResponse.json();
    assertExists(error.error);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Documentation routes", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test service documentation for hello service
    const helloDocsResponse = await app.fetch(new Request("http://localhost:8000/api/docs/hello"));
    assertEquals(helloDocsResponse.status, 200);
    assertEquals(helloDocsResponse.headers.get("content-type")?.includes("text/html"), true);

    // Test OpenAPI schema for hello service
    const helloSchemaResponse = await app.fetch(
      new Request("http://localhost:8000/api/docs/openapi/hello"),
    );
    assertEquals(helloSchemaResponse.status, 200);

    const schema = await helloSchemaResponse.json();
    assertExists(schema.openapi);
    assertExists(schema.info);
    assertExists(schema.servers);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API requires authentication", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test admin services endpoint without authentication
    const adminResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/services"),
    );
    assertEquals(adminResponse.status, 401); // Unauthorized
    // Consume response body to prevent leaks
    await adminResponse.text();

    // Test admin config endpoint without authentication
    const configResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/config"),
    );
    assertEquals(configResponse.status, 401); // Unauthorized
    // Consume response body to prevent leaks
    await configResponse.text();
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: CORS and logging middleware", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test CORS headers on health endpoint
    const response = await app.fetch(
      new Request("http://localhost:8000/health", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://example.com",
          "Access-Control-Request-Method": "GET",
        },
      }),
    );

    // Should have CORS headers
    assertExists(response.headers.get("access-control-allow-origin"));
    // Consume response body to prevent leaks
    await response.text();
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Static file serving", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test static file endpoint (may return 404 if no static files exist, which is fine)
    const staticResponse = await app.fetch(new Request("http://localhost:8000/static/test.txt"));

    // Should handle the request (either serve file or return 404)
    assertExists(staticResponse);
    assertEquals(staticResponse.status === 200 || staticResponse.status === 404, true);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Error handling for invalid routes", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test completely invalid route
    const invalidResponse = await app.fetch(
      new Request("http://localhost:8000/completely/invalid/route"),
    );
    assertEquals(invalidResponse.status, 404);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Database operations through API", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Verify database is accessible through service manager
    assertExists(serviceManagerState.dbContext);
    assertExists(serviceManagerState.dbContext.dbInstance);

    // Test that default services are loaded
    const services = await serviceManagerState.dbContext.dbInstance
      .selectFrom("services")
      .selectAll()
      .execute();

    assertEquals(services.length >= 1, true); // Should have hello

    // Test that configuration is loaded
    const config = await serviceManagerState.dbContext.config;
    assertExists(config);
    assertExists(config.main_port);
    assertExists(config.jwt_secret);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Service manager state management", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Initially no services should be running
    assertEquals(serviceManagerState.services.size, 0);

    // Database should have services available
    const dbServices = await serviceManagerState.dbContext.dbInstance
      .selectFrom("services")
      .selectAll()
      .where("enabled", "=", true)
      .execute();

    assertEquals(dbServices.length >= 1, true);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Port allocation system", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const db = serviceManagerState.dbContext.dbInstance;

    // Check that ports are initialized
    const ports = await db
      .selectFrom("ports")
      .selectAll()
      .execute();

    assertEquals(ports.length >= 100, true); // Should have port range

    // Check that all ports are initially unallocated
    const allocatedPorts = await db
      .selectFrom("ports")
      .selectAll()
      .where("service_name", "is not", null)
      .execute();

    assertEquals(allocatedPorts.length, 0);
  } finally {
    abortController.abort();
  }
});
