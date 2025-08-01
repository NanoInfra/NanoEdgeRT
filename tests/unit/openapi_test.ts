// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import openapi from "../../src/openapi.ts";

Deno.test("openapi - should export valid OpenAPI specification", () => {
  assertExists(openapi);
  assertEquals(typeof openapi, "object");
});

Deno.test("openapi - should have correct OpenAPI version", () => {
  assertEquals(openapi.openapi, "3.0.3");
});

Deno.test("openapi - should have valid info section", () => {
  assertExists(openapi.info);
  assertExists(openapi.info.title);
  assertExists(openapi.info.description);
  assertExists(openapi.info.version);
  assertExists(openapi.info.contact);
  assertExists(openapi.info.license);

  assertEquals(openapi.info.title, "NanoEdgeRT API");
  assertEquals(openapi.info.version, "2.1.0");
  assertEquals(openapi.info.license.name, "MIT");
});

Deno.test("openapi - should have servers configuration", () => {
  assertExists(openapi.servers);
  assertEquals(Array.isArray(openapi.servers), true);
  assertEquals(openapi.servers.length >= 1, true);

  const server = openapi.servers[0];
  assertExists(server.url);
  assertExists(server.description);
});

Deno.test("openapi - should have paths defined", () => {
  assertExists(openapi.paths);
  assertEquals(typeof openapi.paths, "object");

  // Check for essential system paths
  assertExists(openapi.paths["/health"]);
  assertExists(openapi.paths["/status"]);
});

Deno.test("openapi - should have health endpoint properly defined", () => {
  const healthPath = openapi.paths["/health"];
  assertExists(healthPath);
  assertExists(healthPath.get);

  const healthGet = healthPath.get;
  assertExists(healthGet.summary);
  assertExists(healthGet.description);
  assertExists(healthGet.operationId);
  assertExists(healthGet.tags);
  assertExists(healthGet.responses);

  assertEquals(healthGet.operationId, "healthCheck");
  assertEquals(Array.isArray(healthGet.tags), true);
  assertEquals(healthGet.tags.includes("System"), true);
});

Deno.test("openapi - should have status endpoint properly defined", () => {
  const statusPath = openapi.paths["/status"];
  assertExists(statusPath);
  assertExists(statusPath.get);

  const statusGet = statusPath.get;
  assertExists(statusGet.summary);
  assertExists(statusGet.description);
  assertExists(statusGet.operationId);
  assertExists(statusGet.responses);

  assertEquals(statusGet.operationId, "getStatus");
});

Deno.test("openapi - should have components section", () => {
  assertExists(openapi.components);
  assertEquals(typeof openapi.components, "object");
});

Deno.test("openapi - should have schemas defined", () => {
  assertExists(openapi.components.schemas);
  assertEquals(typeof openapi.components.schemas, "object");

  // Check for essential schemas
  assertExists(openapi.components.schemas.HealthStatus);
});

Deno.test("openapi - should have security schemes if auth is used", () => {
  // Check if security schemes are defined for JWT auth
  if (openapi.components.securitySchemes) {
    assertEquals(typeof openapi.components.securitySchemes, "object");
  }
});

Deno.test("openapi - should have valid response schemas", () => {
  const healthPath = openapi.paths["/health"];
  const response200 = healthPath.get.responses["200"];

  assertExists(response200);
  assertExists(response200.description);
  assertExists(response200.content);
  assertExists(response200.content["application/json"]);
  assertExists(response200.content["application/json"].schema);

  const schema = response200.content["application/json"].schema;
  assertExists(schema["$ref"]);
  assertEquals(schema["$ref"], "#/components/schemas/HealthStatus");
});

Deno.test("openapi - HealthStatus schema should be properly defined", () => {
  const healthStatusSchema = openapi.components.schemas.HealthStatus;
  assertExists(healthStatusSchema);
  assertEquals(typeof healthStatusSchema, "object");

  assertExists(healthStatusSchema.type);
  assertEquals(healthStatusSchema.type, "object");

  if (healthStatusSchema.properties) {
    assertEquals(typeof healthStatusSchema.properties, "object");
  }
});

Deno.test("openapi - should have consistent tag usage", () => {
  const paths = openapi.paths;
  const usedTags = new Set();

  for (const [_path, pathObj] of Object.entries(paths)) {
    for (const [_method, methodObj] of Object.entries(pathObj)) {
      if (methodObj.tags) {
        methodObj.tags.forEach((tag: any) => usedTags.add(tag));
      }
    }
  }

  // Should have at least the System tag
  assertEquals(usedTags.has("System"), true);
});

Deno.test("openapi - should have proper HTTP methods", () => {
  const healthPath = openapi.paths["/health"];

  // Health endpoint should only have GET method
  assertExists(healthPath.get);
  assertEquals((healthPath as any).post, undefined);
  assertEquals((healthPath as any).put, undefined);
  assertEquals((healthPath as any).delete, undefined);
});

Deno.test("openapi - should be serializable to JSON", () => {
  // This ensures the OpenAPI spec can be properly serialized
  const jsonString = JSON.stringify(openapi);
  assertExists(jsonString);

  // Should be able to parse it back
  const parsed = JSON.parse(jsonString);
  assertEquals(parsed.openapi, "3.0.3");
  assertEquals(parsed.info.title, "NanoEdgeRT API");
});

Deno.test("openapi - should have required OpenAPI 3.0.3 structure", () => {
  // Verify it conforms to OpenAPI 3.0.3 specification requirements
  assertExists(openapi.openapi);
  assertExists(openapi.info);
  assertExists(openapi.info.title);
  assertExists(openapi.info.version);
  assertExists(openapi.paths);

  // Optional but recommended fields
  if (openapi.servers) {
    assertEquals(Array.isArray(openapi.servers), true);
  }

  if (openapi.components) {
    assertEquals(typeof openapi.components, "object");
  }
});
