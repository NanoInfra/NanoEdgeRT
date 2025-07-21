import { assertEquals, assertExists } from "../test_utils.ts";
import { SwaggerGenerator } from "../../src/swagger.ts";
import { Config } from "../../src/types.ts";

Deno.test("SwaggerGenerator - should generate valid OpenAPI spec", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    jwt_secret: "test-secret",
    services: [
      {
        name: "hello",
        enable: true,
        jwt_check: false,
        permissions: {
          read: [],
          write: [],
          env: [],
          run: [],
        },
      },
      {
        name: "calculator",
        enable: true,
        jwt_check: true,
        permissions: {
          read: [],
          write: [],
          env: [],
          run: [],
        },
      },
    ],
  };

  const generator = new SwaggerGenerator(config);
  const spec = generator.generateOpenAPISpec();

  assertEquals(spec.openapi, "3.0.3");
  assertEquals(spec.info.title, "NanoEdgeRT API");
  assertExists(spec.info.version);
  assertExists(spec.servers);
  assertEquals(spec.servers.length, 1);
  assertEquals(spec.servers[0].url, "http://127.0.0.1:8000");
});

Deno.test("SwaggerGenerator - should include system endpoints", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    services: [],
  };

  const generator = new SwaggerGenerator(config);
  const spec = generator.generateOpenAPISpec();

  // Check for system endpoints
  assertExists(spec.paths["/health"]);
  assertExists(spec.paths["/"]);
  assertExists(spec.paths["/_admin/services"]);
  assertExists(spec.paths["/_admin/start/{serviceName}"]);
  assertExists(spec.paths["/_admin/stop/{serviceName}"]);
});

Deno.test("SwaggerGenerator - should include service endpoints", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    services: [
      {
        name: "test-service",
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

  const generator = new SwaggerGenerator(config);
  const spec = generator.generateOpenAPISpec();

  // Check for service endpoints
  assertExists(spec.paths["/test-service"]);
  assertExists(spec.paths["/test-service/{proxy+}"]);

  // Check that both GET and POST methods are included
  assertExists(spec.paths["/test-service"].get);
  assertExists(spec.paths["/test-service"].post);
});

Deno.test("SwaggerGenerator - should handle JWT-protected services", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    services: [
      {
        name: "protected-service",
        enable: true,
        jwt_check: true,
        permissions: {
          read: [],
          write: [],
          env: [],
          run: [],
        },
      },
    ],
  };

  const generator = new SwaggerGenerator(config);
  const spec = generator.generateOpenAPISpec();

  // Check that JWT security is applied to protected services
  const serviceEndpoint = spec.paths["/protected-service"];
  assertExists(serviceEndpoint.get.security);
  assertEquals(serviceEndpoint.get.security[0].BearerAuth, []);
});

Deno.test("SwaggerGenerator - should generate valid HTML", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    services: [],
  };

  const generator = new SwaggerGenerator(config);
  const html = generator.generateSwaggerHTML();

  // Basic HTML structure checks
  assertEquals(html.includes("<!DOCTYPE html>"), true);
  assertEquals(html.includes("swagger-ui"), true);
  assertEquals(html.includes("NanoEdgeRT API Documentation"), true);
});

Deno.test("SwaggerGenerator - should include all required schemas", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    services: [],
  };

  const generator = new SwaggerGenerator(config);
  const spec = generator.generateOpenAPISpec();

  const requiredSchemas = [
    "HealthResponse",
    "WelcomeResponse",
    "ServiceStatus",
    "ServiceInstance",
    "ServiceConfig",
    "ServicePermissions",
    "SuccessResponse",
    "ErrorResponse",
  ];

  for (const schema of requiredSchemas) {
    assertExists(spec.components.schemas[schema], `Schema ${schema} not found`);
  }
});
