import { assertEquals, assertExists } from "../test_utils.ts";
import { NanoEdgeRT } from "../../src/nanoedge.ts";
import { saveConfig } from "../../src/config.ts";
import { Config } from "../../src/types.ts";

Deno.test({
  name: "Integration - NanoEdgeRT should start and handle health check",
  async fn() {
    const testConfigPath = `./test-config-${Date.now()}.json`;
    const testConfig: Config = {
      available_port_start: 9001,
      available_port_end: 9999,
      main_port: 9000,
      jwt_secret: "test-secret",
      services: [],
    };

    try {
      // Save test configuration
      await saveConfig(testConfig, testConfigPath);

      // Create NanoEdgeRT instance
      const nanoEdge = await NanoEdgeRT.create(testConfigPath);

      // Start server in background
      const startPromise = nanoEdge.start();

      // Wait a moment for server to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        // Test health endpoint
        const healthResponse = await fetch("http://0.0.0.0:9000/health");
        assertEquals(healthResponse.status, 200);

        const healthData = await healthResponse.json();
        assertEquals(healthData.status, "healthy");
        assertExists(healthData.timestamp);
        assertEquals(Array.isArray(healthData.services), true);

        // Test welcome endpoint
        const welcomeResponse = await fetch("http://0.0.0.0:9000/");
        assertEquals(welcomeResponse.status, 200);

        const welcomeData = await welcomeResponse.json();
        assertEquals(welcomeData.message, "Welcome to NanoEdgeRT");
        assertEquals(Array.isArray(welcomeData.services), true);

        // Test Swagger documentation
        const docsResponse = await fetch("http://0.0.0.0:9000/docs");
        assertEquals(docsResponse.status, 200);
        assertEquals(docsResponse.headers.get("content-type"), "text/html");

        // Test OpenAPI spec
        const openapiResponse = await fetch("http://0.0.0.0:9000/openapi.json");
        assertEquals(openapiResponse.status, 200);
        assertEquals(openapiResponse.headers.get("content-type"), "application/json");

        const openapiData = await openapiResponse.json();
        assertEquals(openapiData.openapi, "3.0.3");
        assertEquals(openapiData.info.title, "NanoEdgeRT API");
      } finally {
        // Stop server
        nanoEdge.stop();
      }
    } finally {
      // Cleanup
      try {
        await Deno.remove(testConfigPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Integration - should handle service requests",
  async fn() {
    const testConfigPath = `./test-config-${Date.now()}.json`;
    const serviceDir = `./test-service-${Date.now()}`;

    try {
      // Create service directory and file
      await Deno.mkdir(serviceDir, { recursive: true });

      const serviceCode = `export default async function handler(req) {
        const url = new URL(req.url);
        return new Response(JSON.stringify({ 
          message: "Hello from test service",
          path: url.pathname,
          method: req.method
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }`;

      await Deno.writeTextFile(`${serviceDir}/index.ts`, serviceCode);

      const testConfig: Config = {
        available_port_start: 9001,
        available_port_end: 9999,
        main_port: 9000,
        jwt_secret: "test-secret",
        services: [
          {
            name: "test-service",
            path: serviceDir,
            enable: true,
            jwt_check: false,
            permissions: {
              read: [],
              write: [],
              env: [],
              run: [],
            },
          },
        ],
      };

      // Save test configuration
      await saveConfig(testConfig, testConfigPath);

      // Create and start NanoEdgeRT
      const nanoEdge = await NanoEdgeRT.create(testConfigPath);
      const startPromise = nanoEdge.start();

      // Wait for server and services to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        // Test service endpoint
        const serviceResponse = await fetch("http://0.0.0.0:9000/test-service");
        assertEquals(serviceResponse.status, 200);

        const serviceData = await serviceResponse.json();
        assertEquals(serviceData.message, "Hello from test service");
        assertEquals(serviceData.method, "GET");
      } finally {
        nanoEdge.stop();
      }
    } finally {
      // Cleanup
      try {
        await Deno.remove(testConfigPath);
        await Deno.remove(serviceDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
