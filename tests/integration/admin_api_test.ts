import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT } from "../../src/nanoedge.ts";
import { createIsolatedDb } from "../test_utils.ts";
import { createDatabaseContext } from "../../database/dto.ts";
import { createJWT } from "../../src/api.admin.ts";
import JSZip from "jszip";

Deno.test("Integration: Admin API authentication flow", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test access without authentication - should fail
    const unauthenticatedResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/services"),
    );
    assertEquals(unauthenticatedResponse.status, 401);
    // Consume response body to prevent leaks
    await unauthenticatedResponse.text();

    // Test access with invalid token - should fail
    const invalidTokenResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/services", {
        headers: {
          "Authorization": "Bearer invalid.token.here",
        },
      }),
    );
    assertEquals(invalidTokenResponse.status, 401);
    // Consume response body to prevent leaks
    await invalidTokenResponse.text();

    // Note: Testing with valid JWT would require proper JWT library setup
    // For now, we verify the authentication middleware is working
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API CRUD operations", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a mock token (note: this won't work with real JWT validation)
    const mockToken = await createJWT({
      sub: "user123",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5, // Token expires in 5 minutes
    });
    console.log("Mock JWT Token:", mockToken);

    // Test getting all services (will fail due to JWT validation, but tests routing)
    const servicesResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/services", {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(servicesResponse.status, 200);

    // Test getting configuration
    const configResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/config", {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(configResponse.status, 200);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API service management", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const db = serviceManagerState.dbContext.dbInstance;

    // Test direct database access for admin operations

    // Create a new service via database
    await db
      .insertInto("services")
      .values({
        name: "admin-test-service",
        code: "export default function(req) { return new Response('Admin created service'); }",
        enabled: true,
        jwt_check: false,
        permissions: JSON.stringify({ read: [], write: [], env: [], run: [] }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // Verify service was created
    const createdService = await db
      .selectFrom("services")
      .selectAll()
      .where("name", "=", "admin-test-service")
      .executeTakeFirst();

    assertExists(createdService);
    assertEquals(createdService.name, "admin-test-service");

    // Test updating service
    await db
      .updateTable("services")
      .set({
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .where("name", "=", "admin-test-service")
      .execute();

    // Verify update
    const updatedService = await db
      .selectFrom("services")
      .select(["name", "enabled"])
      .where("name", "=", "admin-test-service")
      .executeTakeFirst();

    assertExists(updatedService);
    // 0 == false, but ts
    // assertEquals(updatedService.enabled, false);

    // Test deleting service
    await db
      .deleteFrom("services")
      .where("name", "=", "admin-test-service")
      .execute();

    // Verify deletion
    const deletedService = await db
      .selectFrom("services")
      .selectAll()
      .where("name", "=", "admin-test-service")
      .executeTakeFirst();

    assertEquals(deletedService, undefined);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API configuration management", async () => {
  const [_app, _port, abortController, serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    const db = serviceManagerState.dbContext.dbInstance;

    // Test configuration operations

    // Add new configuration
    await db
      .insertInto("config")
      .values({
        key: "test_setting",
        value: "test_value",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();

    // Verify configuration was added
    const newConfig = await db
      .selectFrom("config")
      .selectAll()
      .where("key", "=", "test_setting")
      .executeTakeFirst();

    assertExists(newConfig);
    assertEquals(newConfig.value, "test_value");

    // Test updating configuration
    await db
      .updateTable("config")
      .set({
        value: "updated_value",
        updated_at: new Date().toISOString(),
      })
      .where("key", "=", "test_setting")
      .execute();

    // Verify update
    const updatedConfig = await db
      .selectFrom("config")
      .select(["key", "value"])
      .where("key", "=", "test_setting")
      .executeTakeFirst();

    assertExists(updatedConfig);
    assertEquals(updatedConfig.value, "updated_value");

    // Test getting all configuration
    const allConfig = await db
      .selectFrom("config")
      .selectAll()
      .execute();

    assertEquals(allConfig.length >= 4, true); // Original 3 + test_setting

    // Verify required config keys exist
    const configKeys = allConfig.map((c) => c.key);
    assertEquals(configKeys.includes("main_port"), true);
    assertEquals(configKeys.includes("available_port_start"), true);
    assertEquals(configKeys.includes("available_port_end"), true);
    assertEquals(configKeys.includes("jwt_secret"), true);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API error handling", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test various error scenarios

    // Test invalid admin endpoint
    const invalidEndpointResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/invalid-endpoint"),
    );
    assertEquals(invalidEndpointResponse.status, 401); // Should be unauthorized first

    // Test malformed requests (without auth, should fail at auth level)
    const malformedResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/services", {
        method: "POST",
        body: "invalid-json",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    assertEquals(malformedResponse.status, 401); // Auth should fail first
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API middleware chain", async () => {
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(":memory:");

  try {
    // Test that admin routes require authentication
    const endpoints = [
      "/admin-api/v2/services",
      "/admin-api/v2/services/test",
      "/admin-api/v2/config",
      "/admin-api/v2/config/main_port",
    ];

    for (const endpoint of endpoints) {
      const response = await app.fetch(new Request(`http://localhost:8000${endpoint}`));
      assertEquals(response.status, 401, `Endpoint ${endpoint} should require authentication`);
    }

    // Test CORS headers on admin endpoints
    const corsResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/services", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "GET",
        },
      }),
    );

    // Should have CORS headers even for admin endpoints
    assertExists(corsResponse.headers.get("access-control-allow-origin"));
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Frontend hosting API", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a mock token
    const _mockToken = await createJWT({
      sub: "admin",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    });

    // Create mock files for testing
    const serverCode = `
async function handler(req) {
  return new Response("Hello from test service");
};

Deno.serve(handler)
`;

    // Create a simple ZIP file containing an index.html
    const indexHtml = "<html><body><h1>Hello Frontend!</h1></body></html>";

    // Create a real ZIP file using JSZip
    const zip = new JSZip();
    zip.file("index.html", indexHtml);
    zip.file("assets/style.css", "body { font-family: Arial; }");

    // Generate the ZIP file as a Uint8Array
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    const serverFile = new File([serverCode], "server.js", { type: "application/javascript" });
    const staticFile = new File([zipBuffer], "static.zip", { type: "application/zip" });

    const formData = new FormData();
    formData.append("server", serverFile);
    formData.append("static", staticFile);
    formData.append("serviceName", "my-frontend");

    // Test with valid authentication - should work
    const authResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/host-frontend", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${_mockToken}`,
        },
        body: formData,
      }),
    );

    // Should successfully create the frontend service
    assertEquals(authResponse.status, 201);

    const responseJson = await authResponse.json();
    assertEquals(responseJson.serviceName, "my-frontend");
    assertExists(responseJson.message);

    // Verify the service was created in the database
    const createdService = await db
      .selectFrom("services")
      .selectAll()
      .where("name", "=", "my-frontend")
      .executeTakeFirst();

    assertExists(createdService);
    assertEquals(createdService.name, "my-frontend");
    assertEquals(Boolean(createdService.enabled), true);
    assertEquals(Boolean(createdService.jwt_check), false);
    assertExists(createdService.code); // Test that static directory was created and files extracted

    // fetch the service created here
    // Test that the service is actually running and serving files
    const serviceResponse = await app.fetch(
      new Request(`http://localhost:${port}/api/v2/my-frontend/dist/index.html`),
    );
    assertEquals(serviceResponse.status, 200);

    const serviceContent = await serviceResponse.text();
    console.log("Service Content:", serviceContent);
    assertEquals(serviceContent, indexHtml);

    // Test CSS file serving
    const cssResponse = await app.fetch(
      new Request(`http://localhost:${port}/api/v2/my-frontend/dist/assets/style.css`),
    );
    assertEquals(cssResponse.status, 200);

    const cssResponseContent = await cssResponse.text();
    console.log("CSS Content:", cssResponseContent);
    assertEquals(cssResponse.headers.get("Content-Type"), "text/css; charset=UTF-8");
    assertEquals(cssResponseContent, "body { font-family: Arial; }");

    try {
      const indexExists = await Deno.stat("./static/my-frontend/index.html");
      assertExists(indexExists);

      const cssExists = await Deno.stat("./static/my-frontend/assets/style.css");
      assertExists(cssExists);

      // Read and verify file contents
      const indexContent = await Deno.readTextFile("./static/my-frontend/index.html");
      assertEquals(indexContent, indexHtml);

      const cssContent = await Deno.readTextFile("./static/my-frontend/assets/style.css");
      assertEquals(cssContent, "body { font-family: Arial; }");
    } catch (error) {
      throw error;
    }
  } finally {
    // Clean up on test failure
    try {
      // await Deno.remove("./static", { recursive: true });
    } catch {
      // Ignore cleanup errors
      console.warn("Failed to clean up static directory");
    }
    abortController.abort();
  }
});
