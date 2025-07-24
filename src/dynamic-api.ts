import { databaseConfig } from "./database-config.ts";
import { ServicePermissions } from "./types.ts";

export class DynamicAPI {
  async handleAPIRequest(request: Request, pathSegments: string[]): Promise<Response> {
    const method = request.method;
    const endpoint = pathSegments[0];

    try {
      switch (endpoint) {
        case "services":
          return await this.handleServicesAPI(request, pathSegments.slice(1), method);
        case "config":
          return await this.handleConfigAPI(request, pathSegments.slice(1), method);
        default:
          return new Response(
            JSON.stringify({ error: "Unknown API endpoint" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
      }
    } catch (error) {
      console.error("API Error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  private async handleServicesAPI(
    request: Request,
    pathSegments: string[],
    method: string,
  ): Promise<Response> {
    const serviceName = pathSegments[0];

    switch (method) {
      case "GET":
        if (serviceName) {
          // Get specific service
          const service = await databaseConfig.getService(serviceName);
          if (!service) {
            return new Response(
              JSON.stringify({ error: "Service not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(
            JSON.stringify(service),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } else {
          // Get all services
          const services = await databaseConfig.getAllServices();
          return new Response(
            JSON.stringify({ services }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

      case "POST":
        // Create new service
        return await this.createService(request);

      case "PUT":
        if (!serviceName) {
          return new Response(
            JSON.stringify({ error: "Service name required for update" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // Update service
        return await this.updateService(request, serviceName);

      case "DELETE": {
        if (!serviceName) {
          return new Response(
            JSON.stringify({ error: "Service name required for deletion" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // Delete service
        await databaseConfig.deleteService(serviceName);
        return new Response(
          JSON.stringify({ message: "Service deleted successfully" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { "Content-Type": "application/json" } },
        );
    }
  }

  private async createService(request: Request): Promise<Response> {
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("multipart/form-data")) {
      // Handle file upload
      return await this.createServiceFromFile(request);
    } else {
      // Handle JSON payload
      return await this.createServiceFromJSON(request);
    }
  }

  private async createServiceFromFile(request: Request): Promise<Response> {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const enabled = formData.get("enabled") === "true";
    const jwtCheck = formData.get("jwt_check") === "true";
    const permissionsStr = formData.get("permissions") as string;

    if (!file || !name) {
      return new Response(
        JSON.stringify({ error: "File and name are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const code = await file.text();
    let permissions: ServicePermissions;

    try {
      permissions = permissionsStr ? JSON.parse(permissionsStr) : {
        read: [],
        write: [],
        env: [],
        run: [],
      };
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid permissions JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate JavaScript code (basic syntax check)
    try {
      new Function(code);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Invalid JavaScript code",
          details: error instanceof Error ? error.message : String(error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    await databaseConfig.createService({
      name,
      code,
      enabled,
      jwt_check: jwtCheck,
      permissions,
    });

    return new Response(
      JSON.stringify({ message: "Service created successfully", name }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  }

  private async createServiceFromJSON(request: Request): Promise<Response> {
    const body = await request.json();
    const { name, code, enabled = true, jwt_check = false, permissions } = body;

    if (!name || !code) {
      return new Response(
        JSON.stringify({ error: "Name and code are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate JavaScript code (basic syntax check)
    try {
      new Function(code);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Invalid JavaScript code",
          details: error instanceof Error ? error.message : String(error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    await databaseConfig.createService({
      name,
      code,
      enabled,
      jwt_check,
      permissions: permissions || {
        read: [],
        write: [],
        env: [],
        run: [],
      },
    });

    return new Response(
      JSON.stringify({ message: "Service created successfully", name }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  }

  private async updateService(request: Request, serviceName: string): Promise<Response> {
    const body = await request.json();
    const { code, enabled, jwt_check, permissions } = body;

    // Validate JavaScript code if provided
    if (code) {
      try {
        new Function(code);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Invalid JavaScript code",
            details: error instanceof Error ? error.message : String(error),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    await databaseConfig.updateService(serviceName, {
      code,
      enabled,
      jwt_check,
      permissions,
    });

    return new Response(
      JSON.stringify({ message: "Service updated successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  private async handleConfigAPI(
    request: Request,
    pathSegments: string[],
    method: string,
  ): Promise<Response> {
    const configKey = pathSegments[0];

    switch (method) {
      case "GET": {
        if (configKey) {
          // Get specific config value
          const config = await databaseConfig.loadConfig();
          const configRecord = config as unknown as Record<string, unknown>;
          const value = configRecord[configKey];
          if (value === undefined) {
            return new Response(
              JSON.stringify({ error: "Config key not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(
            JSON.stringify({ key: configKey, value }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } else {
          // Get all config
          const config = await databaseConfig.loadConfig();
          return new Response(
            JSON.stringify(config),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      case "PUT": {
        if (!configKey) {
          return new Response(
            JSON.stringify({ error: "Config key required for update" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const body = await request.json();
        const { value } = body;

        if (value === undefined) {
          return new Response(
            JSON.stringify({ error: "Value is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        await databaseConfig.updateConfig(configKey, String(value));

        return new Response(
          JSON.stringify({ message: "Config updated successfully" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { "Content-Type": "application/json" } },
        );
    }
  }
}

export const dynamicAPI = new DynamicAPI();
