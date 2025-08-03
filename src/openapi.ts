export default {
  "openapi": "3.0.3",
  "info": {
    "title": "NanoEdgeRT API",
    "description":
      "NanoEdgeRT is a dynamic service management platform that allows you to create, manage, and run JavaScript-based microservices with JWT authentication, OpenAPI documentation, and real-time service orchestration.",
    "version": "2.1.0",
    "contact": {
      "name": "NanoEdgeRT",
      "url": "https://github.com/LemonHX/NanoEdgeRT",
    },
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT",
    },
  },
  "servers": [
    {
      "url": "http://127.0.0.1:8000",
      "description": "Local development server",
    },
  ],
  "paths": {
    "/health": {
      "get": {
        "summary": "Health check",
        "description": "Check if the server is running and get basic status information",
        "operationId": "healthCheck",
        "tags": ["System"],
        "responses": {
          "200": {
            "description": "Server is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthStatus",
                },
              },
            },
          },
        },
      },
    },
    "/status": {
      "get": {
        "summary": "System status",
        "description": "Get detailed system status including running services",
        "operationId": "getStatus",
        "tags": ["System"],
        "responses": {
          "200": {
            "description": "System status information",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthStatus",
                },
              },
            },
          },
        },
      },
    },
    "/api/docs/{serviceName}": {
      "get": {
        "summary": "Service documentation",
        "description": "Get Swagger UI documentation for a specific service",
        "operationId": "getServiceDocs",
        "tags": ["Documentation"],
        "parameters": [
          {
            "name": "serviceName",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "Swagger UI HTML page",
            "content": {
              "text/html": {
                "schema": {
                  "type": "string",
                },
              },
            },
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/api/docs/openapi/{serviceName}": {
      "get": {
        "summary": "Service OpenAPI schema",
        "description": "Get the OpenAPI schema for a specific service",
        "operationId": "getServiceOpenAPISchema",
        "tags": ["Documentation"],
        "parameters": [
          {
            "name": "serviceName",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "OpenAPI schema",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "description": "OpenAPI 3.0 schema",
                },
              },
            },
          },
          "400": {
            "description": "Invalid schema or service name required",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/api/v2/{serviceName}/{path}": {
      "get": {
        "summary": "Forward GET request to service",
        "description": "Forward a GET request to the specified service",
        "operationId": "forwardGetToService",
        "tags": ["Service Proxy"],
        "parameters": [
          {
            "name": "serviceName",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
          {
            "name": "path",
            "in": "path",
            "required": true,
            "description": "Path to forward to the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "Response from the service",
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "502": {
            "description": "Service unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "503": {
            "description": "Service failed to start",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "post": {
        "summary": "Forward POST request to service",
        "description": "Forward a POST request to the specified service",
        "operationId": "forwardPostToService",
        "tags": ["Service Proxy"],
        "parameters": [
          {
            "name": "serviceName",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
          {
            "name": "path",
            "in": "path",
            "required": true,
            "description": "Path to forward to the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "requestBody": {
          "description": "Request body to forward to the service",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Response from the service",
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "502": {
            "description": "Service unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "503": {
            "description": "Service failed to start",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "put": {
        "summary": "Forward PUT request to service",
        "description": "Forward a PUT request to the specified service",
        "operationId": "forwardPutToService",
        "tags": ["Service Proxy"],
        "parameters": [
          {
            "name": "serviceName",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
          {
            "name": "path",
            "in": "path",
            "required": true,
            "description": "Path to forward to the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "requestBody": {
          "description": "Request body to forward to the service",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Response from the service",
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "502": {
            "description": "Service unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "503": {
            "description": "Service failed to start",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "delete": {
        "summary": "Forward DELETE request to service",
        "description": "Forward a DELETE request to the specified service",
        "operationId": "forwardDeleteToService",
        "tags": ["Service Proxy"],
        "parameters": [
          {
            "name": "serviceName",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
          {
            "name": "path",
            "in": "path",
            "required": true,
            "description": "Path to forward to the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "Response from the service",
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "502": {
            "description": "Service unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "503": {
            "description": "Service failed to start",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/services": {
      "get": {
        "summary": "Get all services",
        "description": "Retrieve a list of all registered services",
        "operationId": "getAllServices",
        "tags": ["Admin - Services"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "responses": {
          "200": {
            "description": "List of services",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "services": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Service",
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "post": {
        "summary": "Create a new service",
        "description": "Create a new service with the specified configuration",
        "operationId": "createService",
        "tags": ["Admin - Services"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateServiceRequest",
              },
            },
          },
        },
        "responses": {
          "201": {
            "description": "Service created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/services/{name}": {
      "get": {
        "summary": "Get service by name",
        "description": "Retrieve a specific service by its name",
        "operationId": "getService",
        "tags": ["Admin - Services"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "Service details",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Service",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "404": {
            "description": "Service not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "put": {
        "summary": "Update service",
        "description": "Update an existing service configuration",
        "operationId": "updateService",
        "tags": ["Admin - Services"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateServiceRequest",
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Service updated successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "delete": {
        "summary": "Delete service",
        "description": "Delete a service by its name",
        "operationId": "deleteService",
        "tags": ["Admin - Services"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "description": "Name of the service",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "Service deleted successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/config": {
      "get": {
        "summary": "Get all configuration",
        "description": "Retrieve the complete system configuration",
        "operationId": "getAllConfig",
        "tags": ["Admin - Configuration"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "responses": {
          "200": {
            "description": "System configuration",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Config",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/config/{key}": {
      "get": {
        "summary": "Get configuration value",
        "description": "Retrieve a specific configuration value by key",
        "operationId": "getConfig",
        "tags": ["Admin - Configuration"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "key",
            "in": "path",
            "required": true,
            "description": "Configuration key",
            "schema": {
              "type": "string",
            },
          },
        ],
        "responses": {
          "200": {
            "description": "Configuration value",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "key": {
                      "type": "string",
                    },
                    "value": {
                      "oneOf": [
                        {
                          "type": "string",
                        },
                        {
                          "type": "number",
                        },
                        {
                          "type": "boolean",
                        },
                        {
                          "type": "object",
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "404": {
            "description": "Configuration key not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "put": {
        "summary": "Update configuration value",
        "description": "Update a specific configuration value by key",
        "operationId": "updateConfig",
        "tags": ["Admin - Configuration"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "key",
            "in": "path",
            "required": true,
            "description": "Configuration key",
            "schema": {
              "type": "string",
            },
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "value": {
                    "oneOf": [
                      {
                        "type": "string",
                      },
                      {
                        "type": "number",
                      },
                      {
                        "type": "boolean",
                      },
                      {
                        "type": "object",
                      },
                    ],
                  },
                },
                "required": ["value"],
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Configuration updated successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/host-frontend": {
      "post": {
        "summary": "Host frontend application",
        "description":
          "Upload and deploy a frontend application with a server JavaScript file and static assets ZIP file",
        "operationId": "hostFrontend",
        "tags": ["Admin - Frontend Hosting"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "properties": {
                  "server": {
                    "type": "string",
                    "format": "binary",
                    "description":
                      "JavaScript server file (.js) that will handle requests for the frontend",
                  },
                  "static": {
                    "type": "string",
                    "format": "binary",
                    "description":
                      "ZIP file containing static assets that will be extracted to ./static/{serviceName}",
                  },
                  "serviceName": {
                    "type": "string",
                    "description": "Name of the service/frontend application",
                    "example": "my-frontend-app",
                  },
                },
                "required": ["server", "static", "serviceName"],
              },
            },
          },
        },
        "responses": {
          "201": {
            "description": "Frontend hosted successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                      "example": "Frontend hosted successfully",
                    },
                    "serviceName": {
                      "type": "string",
                      "example": "my-frontend-app",
                    },
                    "staticPath": {
                      "type": "string",
                      "example": "./static/my-frontend-app",
                    },
                  },
                },
              },
            },
          },
          "400": {
            "description": "Bad request - missing required fields or invalid file types",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/functions": {
      "get": {
        "summary": "Get all functions",
        "description": "Retrieve a list of all functions",
        "operationId": "getAllFunctions",
        "tags": ["Admin - Functions"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "responses": {
          "200": {
            "description": "List of functions",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "functions": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Function",
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "post": {
        "summary": "Create a new function",
        "description": "Create a new function with the provided configuration",
        "operationId": "createFunction",
        "tags": ["Admin - Functions"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/FunctionInput",
              },
            },
          },
        },
        "responses": {
          "201": {
            "description": "Function created successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/admin-api/v2/functions/{name}": {
      "get": {
        "summary": "Get function by name",
        "description": "Retrieve a specific function by name",
        "operationId": "getFunction",
        "tags": ["Admin - Functions"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
            },
            "description": "Function name",
          },
        ],
        "responses": {
          "200": {
            "description": "Function details",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Function",
                },
              },
            },
          },
          "404": {
            "description": "Function not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "put": {
        "summary": "Update function",
        "description": "Update an existing function",
        "operationId": "updateFunction",
        "tags": ["Admin - Functions"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
            },
            "description": "Function name",
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/FunctionUpdateInput",
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Function updated successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "400": {
            "description": "Bad request",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "404": {
            "description": "Function not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      "delete": {
        "summary": "Delete function",
        "description": "Delete an existing function",
        "operationId": "deleteFunction",
        "tags": ["Admin - Functions"],
        "security": [
          {
            "jwtAuth": [],
          },
        ],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
            },
            "description": "Function name",
          },
        ],
        "responses": {
          "200": {
            "description": "Function deleted successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                  },
                },
              },
            },
          },
          "404": {
            "description": "Function not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Internal server error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/functions/v2/{name}": {
      "post": {
        "summary": "Execute function",
        "description":
          "Execute a function with the provided input data. Supports both regular responses and streaming responses for generator functions.",
        "operationId": "executeFunction",
        "tags": ["Functions"],
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
            },
            "description": "Function name to execute",
          },
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "description": "Input data for the function execution",
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Function executed successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "description": "Function execution result",
                },
              },
              "text/plain": {
                "schema": {
                  "type": "string",
                  "description": "Plain text response",
                },
              },
              "text/html": {
                "schema": {
                  "type": "string",
                  "description": "HTML response",
                },
              },
              "text/event-stream": {
                "schema": {
                  "type": "string",
                  "description": "Server-sent events stream for generator functions",
                },
              },
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary",
                  "description": "Binary response",
                },
              },
            },
          },
          "403": {
            "description": "Function is disabled",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "404": {
            "description": "Function not found",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
          "500": {
            "description": "Function execution failed",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
  },
  "components": {
    "securitySchemes": {
      "jwtAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description":
          "JWT Bearer token authentication. Include the token in the Authorization header as 'Bearer <token>'.",
      },
    },
    "schemas": {
      "Error": {
        "type": "object",
        "properties": {
          "error": {
            "type": "string",
            "description": "Error message",
          },
          "message": {
            "type": "string",
            "description": "Detailed error message",
          },
          "details": {
            "type": "string",
            "description": "Additional error details",
          },
        },
        "required": ["error"],
      },
      "HealthStatus": {
        "type": "object",
        "properties": {
          "startTime": {
            "type": "string",
            "format": "date-time",
            "description": "Server start time in ISO format",
          },
          "upTime": {
            "type": "number",
            "description": "Server uptime in milliseconds",
          },
          "services": {
            "type": "object",
            "description": "Currently running services",
          },
        },
        "required": ["startTime", "upTime", "services"],
      },
      "ServicePermissions": {
        "type": "object",
        "properties": {
          "read": {
            "type": "array",
            "items": {
              "type": "string",
            },
            "description": "Read permissions",
          },
          "write": {
            "type": "array",
            "items": {
              "type": "string",
            },
            "description": "Write permissions",
          },
          "env": {
            "type": "array",
            "items": {
              "type": "string",
            },
            "description": "Environment variable permissions",
          },
          "run": {
            "type": "array",
            "items": {
              "type": "string",
            },
            "description": "Execution permissions",
          },
        },
        "required": ["read", "write", "env", "run"],
      },
      "Service": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Service name",
          },
          "code": {
            "type": "string",
            "description": "JavaScript code for the service",
          },
          "enabled": {
            "type": "boolean",
            "description": "Whether the service is enabled",
          },
          "jwt_check": {
            "type": "boolean",
            "description": "Whether JWT authentication is required",
          },
          "permissions": {
            "$ref": "#/components/schemas/ServicePermissions",
          },
          "schema": {
            "type": "string",
            "nullable": true,
            "description": "OpenAPI schema JSON string",
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "description": "Service creation timestamp",
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "description": "Service last update timestamp",
          },
        },
        "required": ["name", "code", "enabled", "jwt_check", "permissions"],
      },
      "CreateServiceRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Service name",
          },
          "code": {
            "type": "string",
            "description": "JavaScript code for the service",
          },
          "enabled": {
            "type": "boolean",
            "default": true,
            "description": "Whether the service is enabled",
          },
          "jwt_check": {
            "type": "boolean",
            "default": false,
            "description": "Whether JWT authentication is required",
          },
          "permissions": {
            "$ref": "#/components/schemas/ServicePermissions",
          },
          "schema": {
            "type": "string",
            "description": "OpenAPI schema JSON string",
          },
        },
        "required": ["name", "code"],
      },
      "UpdateServiceRequest": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "JavaScript code for the service",
          },
          "enabled": {
            "type": "boolean",
            "description": "Whether the service is enabled",
          },
          "jwt_check": {
            "type": "boolean",
            "description": "Whether JWT authentication is required",
          },
          "permissions": {
            "$ref": "#/components/schemas/ServicePermissions",
          },
          "schema": {
            "type": "string",
            "description": "OpenAPI schema JSON string",
          },
        },
      },
      "Function": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Function name",
          },
          "code": {
            "type": "string",
            "description": "JavaScript code for the function",
          },
          "enabled": {
            "type": "boolean",
            "description": "Whether the function is enabled",
          },
          "permissions": {
            "$ref": "#/components/schemas/ServicePermissions",
          },
          "description": {
            "type": "string",
            "description": "Function description",
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "description": "Function creation timestamp",
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "description": "Function last update timestamp",
          },
        },
        "required": ["name", "code", "enabled", "permissions"],
      },
      "FunctionInput": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Function name",
          },
          "code": {
            "type": "string",
            "description": "JavaScript code for the function",
          },
          "enabled": {
            "type": "boolean",
            "default": true,
            "description": "Whether the function is enabled",
          },
          "permissions": {
            "$ref": "#/components/schemas/ServicePermissions",
          },
          "description": {
            "type": "string",
            "description": "Function description",
          },
        },
        "required": ["name", "code"],
      },
      "FunctionUpdateInput": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "JavaScript code for the function",
          },
          "enabled": {
            "type": "boolean",
            "description": "Whether the function is enabled",
          },
          "permissions": {
            "$ref": "#/components/schemas/ServicePermissions",
          },
          "description": {
            "type": "string",
            "description": "Function description",
          },
        },
      },
      "Config": {
        "type": "object",
        "properties": {
          "available_port_start": {
            "type": "number",
            "description": "Start of available port range",
          },
          "available_port_end": {
            "type": "number",
            "description": "End of available port range",
          },
          "jwt_secret": {
            "type": "string",
            "description": "JWT secret key",
          },
          "main_port": {
            "type": "number",
            "description": "Main server port",
          },
          "services": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Service",
            },
            "description": "List of configured services",
          },
        },
        "required": ["available_port_start", "available_port_end", "services"],
      },
    },
  },
  "tags": [
    {
      "name": "System",
      "description": "System health and status endpoints",
    },
    {
      "name": "Documentation",
      "description": "Service documentation endpoints",
    },
    {
      "name": "Service Proxy",
      "description": "Service request forwarding endpoints",
    },
    {
      "name": "Admin - Services",
      "description": "Admin endpoints for service management",
    },
    {
      "name": "Admin - Configuration",
      "description": "Admin endpoints for configuration management",
    },
  ],
};
