import { assertEquals, assertExists } from "../test_utils.ts";
import { NanoEdgeRT } from "../../src/nanoedge.ts";
import { createTestDatabase } from "../test_database.ts";

async function setupTestDatabase() {
  const testDb = await createTestDatabase();

  // Update config for testing
  await testDb.dbConfig.updateConfig("main_port", "9000");
  await testDb.dbConfig.updateConfig("available_port_start", "9001");
  await testDb.dbConfig.updateConfig("available_port_end", "9999");
  await testDb.dbConfig.updateConfig("jwt_secret", "test-secret");

  // Add test service with unique name
  const uniqueName = `test-service-${Date.now()}`;
  await testDb.dbConfig.createService({
    name: uniqueName,
    code: `export default async function handler(req) {
      return new Response(
        JSON.stringify({ message: "Test service response" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }`,
    enabled: true,
    jwt_check: false,
    permissions: { read: [], write: [], env: [], run: [] },
  });

  return { testDb, serviceName: uniqueName };
}
Deno.test({
  name: "Integration - NanoEdgeRT should start and handle health check",
  async fn() {
    let testData;
    try {
      // Setup test database
      testData = await setupTestDatabase();
      const testServiceName = testData.serviceName;

      // Create NanoEdgeRT instance with test database
      const nanoEdge = await NanoEdgeRT.create(testData.testDb.dbConfig);

      // Start server in background
      nanoEdge.start();

      // Wait a moment for server to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        // Test health endpoint
        const healthResponse = await fetch("http://127.0.0.1:9000/health");
        assertEquals(healthResponse.status, 200);

        const healthData = await healthResponse.json();
        assertEquals(healthData.status, "healthy");
        assertExists(healthData.timestamp);
        assertEquals(Array.isArray(healthData.services), true);

        // Test welcome endpoint
        const welcomeResponse = await fetch("http://127.0.0.1:9000/");
        assertEquals(welcomeResponse.status, 200);

        const welcomeData = await welcomeResponse.json();
        assertEquals(welcomeData.message, "Welcome to NanoEdgeRT");
        assertEquals(Array.isArray(welcomeData.services), true);

        // Test Swagger documentation
        const docsResponse = await fetch("http://127.0.0.1:9000/docs");
        assertEquals(docsResponse.status, 200);

        const docsText = await docsResponse.text();
        assertExists(docsText);

        // Test OpenAPI spec
        const openApiResponse = await fetch("http://127.0.0.1:9000/openapi.json");
        assertEquals(openApiResponse.status, 200);

        const openApiData = await openApiResponse.json();
        assertExists(openApiData.openapi);
        assertExists(openApiData.info);
        assertExists(openApiData.paths);

        // Test service endpoints
        const serviceResponse = await fetch(`http://127.0.0.1:9000/${testServiceName}`);
        assertEquals(serviceResponse.status, 200);

        const serviceData = await serviceResponse.json();
        assertEquals(serviceData.message, "Test service response");

        console.log("✅ All integration tests passed");
      } finally {
        // Stop the server
        nanoEdge.stop();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error("❌ Integration test failed:", error);
      throw error;
    } finally {
      // Clean up test database
      if (testData) {
        await testData.testDb.cleanup();
      }
    }
  },
});

Deno.test({
  name: "Integration - NanoEdgeRT Dynamic API under _admin",
  async fn() {
    let testData;
    try {
      // Setup test database
      testData = await setupTestDatabase();

      // Create NanoEdgeRT instance with test database
      const nanoEdge = await NanoEdgeRT.create(testData.testDb.dbConfig);

      // Start server in background
      nanoEdge.start();

      // Wait for server and services to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        // Note: In real scenario, you'd need JWT token for _admin endpoints
        // For testing, we'll test the endpoint structure

        // Test that _admin/api requires authentication
        const servicesResponse = await fetch("http://127.0.0.1:9000/_admin/api/services");
        assertEquals(servicesResponse.status, 401); // Should require auth

        // Consume the response body to avoid leak warning
        await servicesResponse.text();

        console.log("✅ Dynamic API test passed");
      } finally {
        // Stop the server
        nanoEdge.stop();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error("❌ Dynamic API test failed:", error);
      throw error;
    } finally {
      // Clean up test database
      if (testData) {
        await testData.testDb.cleanup();
      }
    }
  },
});
