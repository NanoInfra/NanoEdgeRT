import { Config } from "./database-config.ts";

export interface OpenAPIInfo {
  title: string;
  description: string;
  version: string;
  contact?: {
    name: string;
    url: string;
    email: string;
  };
  license?: {
    name: string;
    url: string;
  };
}

export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

export class SwaggerGenerator {
  private config: Config;
  private baseUrl: string;

  constructor(config: Config, baseUrl: string = "http://127.0.0.1:8000") {
    this.config = config;
    this.baseUrl = baseUrl;
  }

  generateOpenAPISpec(): OpenAPISpec {
    return {
      openapi: "3.0.3",
      info: {
        title: "NanoEdgeRT API",
        description: "A lightweight edge function runtime for Deno",
        version: "1.0.0",
        contact: {
          name: "NanoEdgeRT Team",
          url: "https://github.com/your-org/nanoedgert",
          email: "contact@nanoedgert.dev",
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT",
        },
      },
      servers: [
        {
          url: this.baseUrl,
          description: "Development server",
        },
      ],
      paths: this.generatePaths(),
      components: {
        schemas: this.generateSchemas(),
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    };
  }

  private generatePaths(): Record<string, unknown> {
    const paths: Record<string, unknown> = {};

    // Health check endpoint
    paths["/health"] = {
      get: {
        summary: "Health Check",
        description: "Get the health status of the server and all services",
        tags: ["System"],
        responses: {
          "200": {
            description: "Health status",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
          },
        },
      },
    };

    // Root endpoint
    paths["/"] = {
      get: {
        summary: "Welcome",
        description: "Get welcome message and list of available services",
        tags: ["System"],
        responses: {
          "200": {
            description: "Welcome message with services list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/WelcomeResponse",
                },
              },
            },
          },
        },
      },
    };

    // Admin endpoints
    paths["/_admin/services"] = {
      get: {
        summary: "List All Services",
        description: "Get list of all configured services with their status",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "List of services",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/ServiceInstance",
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    };

    paths["/_admin/start/{serviceName}"] = {
      post: {
        summary: "Start Service",
        description: "Start a specific service",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "serviceName",
            in: "path",
            required: true,
            description: "Name of the service to start",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Service started successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse",
                },
              },
            },
          },
          "404": {
            description: "Service not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Failed to start service",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    };

    paths["/_admin/stop/{serviceName}"] = {
      post: {
        summary: "Stop Service",
        description: "Stop a specific service",
        tags: ["Admin"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "serviceName",
            in: "path",
            required: true,
            description: "Name of the service to stop",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Service stopped successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse",
                },
              },
            },
          },
          "500": {
            description: "Failed to stop service",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    };

    // Service endpoints
    for (const service of this.config.services) {
      const servicePath = `/${service.name}`;
      const security = service.jwt_check ? [{ BearerAuth: [] }] : [];

      paths[servicePath] = {
        get: {
          summary: `${service.name} Service (GET)`,
          description: `Execute ${service.name} service with GET method`,
          tags: ["Services"],
          security,
          responses: {
            "200": {
              description: "Service response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    description: "Service-specific response",
                  },
                },
              },
            },
            "404": {
              description: "Service not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "503": {
              description: "Service unavailable",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `${service.name} Service (POST)`,
          description: `Execute ${service.name} service with POST method`,
          tags: ["Services"],
          security,
          requestBody: {
            description: "Request body for the service",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  description: "Service-specific request body",
                },
              },
              "text/plain": {
                schema: {
                  type: "string",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Service response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    description: "Service-specific response",
                  },
                },
              },
            },
            "404": {
              description: "Service not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "503": {
              description: "Service unavailable",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      };

      // Add wildcard path for service sub-routes
      paths[`${servicePath}/{proxy+}`] = {
        get: {
          summary: `${service.name} Service Sub-routes (GET)`,
          description: `Execute ${service.name} service sub-routes with GET method`,
          tags: ["Services"],
          security,
          parameters: [
            {
              name: "proxy+",
              in: "path",
              required: true,
              description: "Sub-path within the service",
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Service response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    description: "Service-specific response",
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `${service.name} Service Sub-routes (POST)`,
          description: `Execute ${service.name} service sub-routes with POST method`,
          tags: ["Services"],
          security,
          parameters: [
            {
              name: "proxy+",
              in: "path",
              required: true,
              description: "Sub-path within the service",
              schema: {
                type: "string",
              },
            },
          ],
          requestBody: {
            description: "Request body for the service",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Service response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
      };
    }

    return paths;
  }

  private generateSchemas(): Record<string, unknown> {
    return {
      HealthResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "healthy",
          },
          timestamp: {
            type: "string",
            format: "date-time",
          },
          services: {
            type: "array",
            items: {
              $ref: "#/components/schemas/ServiceStatus",
            },
          },
        },
        required: ["status", "timestamp", "services"],
      },
      WelcomeResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Welcome to NanoEdgeRT",
          },
          services: {
            type: "array",
            items: {
              $ref: "#/components/schemas/ServiceStatus",
            },
          },
        },
        required: ["message", "services"],
      },
      ServiceStatus: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          status: {
            type: "string",
            enum: ["starting", "running", "stopped", "error"],
          },
          port: {
            type: "number",
          },
        },
        required: ["name", "status", "port"],
      },
      ServiceInstance: {
        type: "object",
        properties: {
          config: {
            $ref: "#/components/schemas/ServiceConfig",
          },
          port: {
            type: "number",
          },
          status: {
            type: "string",
            enum: ["starting", "running", "stopped", "error"],
          },
        },
        required: ["config", "port", "status"],
      },
      ServiceConfig: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          path: {
            type: "string",
          },
          enable: {
            type: "boolean",
          },
          jwt_check: {
            type: "boolean",
          },
          build_command: {
            type: "string",
          },
          permissions: {
            $ref: "#/components/schemas/ServicePermissions",
          },
        },
        required: ["name", "enable", "jwt_check", "permissions"],
      },
      ServicePermissions: {
        type: "object",
        properties: {
          read: {
            type: "array",
            items: {
              type: "string",
            },
          },
          write: {
            type: "array",
            items: {
              type: "string",
            },
          },
          env: {
            type: "array",
            items: {
              type: "string",
            },
          },
          run: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: ["read", "write", "env", "run"],
      },
      SuccessResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
          },
        },
        required: ["message"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "string",
          },
        },
        required: ["error"],
      },
    };
  }

  generateSwaggerHTML(): string {
    const spec = JSON.stringify(this.generateOpenAPISpec(), null, 2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NanoEdgeRT API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://petstore.swagger.io/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="https://petstore.swagger.io/favicon-16x16.png" sizes="16x16" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #2c3e50;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        spec: ${spec},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
  }
}
