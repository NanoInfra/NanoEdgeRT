import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { Table } from "jsr:@cliffy/table@^1.0.0-rc.8";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";
import { Confirm, Input, Select } from "jsr:@cliffy/prompt@^1.0.0-rc.8";

const logo = `
        ███████╗██████╗  ██████╗ ███████╗██████╗ ████████╗
        ██╔════╝██╔══██╗██╔════╝ ██╔════╝██╔══██╗╚══██╔══╝
██║  ██╗█████╗  ██║  ██║██║  ███╗█████╗  ██████╔╝   ██║   
██║  ██║██╔══╝  ██║  ██║██║   ██║██╔══╝  ██╔══██╗   ██║   
██████╔╝███████╗██████╔╝╚██████╔╝███████╗██║  ██║   ██║   
██╔═══╝ ╚══════╝╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   
`;

function renderLogo(): string {
  const lines = logo.split("\n");
  const width = Math.max(...lines.map((line) => line.length));
  let output = "";

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const ratio = i / width;
      const r = Math.floor(255 - (255 * ratio));
      const g = Math.floor(200 * ratio);
      const b = Math.floor(255 - (55 * ratio));
      output += `\x1b[38;2;${r};${g};${b}m${line[i]}`;
    }
    output += "\x1b[0m\n";
  }

  return output;
}

interface ServiceConfig {
  name: string;
  code: string;
  enabled: boolean;
  jwt_check: boolean;
  port?: number;
  created_at?: string;
  updated_at?: string;
  permissions: {
    read: string[];
    write: string[];
    env: string[];
    run: string[];
  };
}

interface HealthResponse {
  status: string;
  timestamp: string;
  services: Array<{
    name: string;
    status: string;
    port?: number;
  }>;
}

function getAuthHeader(token?: string): Record<string, string> {
  if (token) {
    return { "Authorization": `Bearer ${token}` };
  }
  return {};
}

async function makeRequest(
  url: string,
  options: RequestInit = {},
  token?: string,
): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(token),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

async function handleResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!response.ok) {
    console.error(`❌ Error ${response.status}: ${text}`);
    Deno.exit(1);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Health check command
const healthCommand = new Command()
  .description("Check server health status")
  .action(async (options: { host: string; port: number; token?: string }) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const response = await makeRequest(`${baseUrl}/health`);
      const data = await handleResponse(response) as HealthResponse;

      console.log(colors.brightBlue("🏥 Server Health Status:"));
      console.log(
        `   Status: ${
          data.status === "healthy"
            ? colors.green("✅ " + data.status)
            : colors.red("❌ " + data.status)
        }`,
      );
      console.log(`   Timestamp: ${colors.dim(data.timestamp)}`);
      console.log(`   Services: ${colors.cyan(data.services.length.toString())}`);

      if (data.services.length > 0) {
        console.log("\n📊 Services:");
        const table = new Table()
          .header(["Status", "Name", "Port"])
          .border(true);

        for (const service of data.services) {
          const status = service.status === "running"
            ? colors.green("🟢 Running")
            : colors.red("🔴 Stopped");
          table.push([status, service.name, service.port?.toString() || "N/A"]);
        }

        table.render();
      }
    } catch (error) {
      console.error(colors.red("❌ Failed to check health:"), (error as Error).message);
      Deno.exit(1);
    }
  });

// List services command
const listCommand = new Command()
  .description("List all services")
  .action(async (options: { host: string; port: number; token?: string }) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const response = await makeRequest(`${baseUrl}/_admin/api/services`, {}, options.token);
      const services = await handleResponse(response) as ServiceConfig[];

      if (services.length === 0) {
        console.log(colors.yellow("📭 No services found"));
        return;
      }

      console.log(colors.brightBlue("📋 Services:"));
      const table = new Table()
        .header(["Name", "Enabled", "JWT Check", "Port", "Size"])
        .border(true);

      for (const service of services) {
        const enabled = service.enabled ? colors.green("✅") : colors.red("❌");
        const jwtCheck = service.jwt_check ? colors.yellow("🔒") : colors.gray("🔓");
        const port = service.port ? colors.cyan(service.port.toString()) : colors.gray("N/A");
        const size = colors.dim(`${service.code.length}B`);

        table.push([service.name, enabled, jwtCheck, port, size]);
      }

      table.render();
    } catch (error) {
      console.error(colors.red("❌ Failed to list services:"), (error as Error).message);
      Deno.exit(1);
    }
  });

// Get service command
const getCommand = new Command()
  .arguments("<name:string>")
  .description("Get service details")
  .action(async (options: { host: string; port: number; token?: string }, name: string) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const response = await makeRequest(
        `${baseUrl}/_admin/api/services/${name}`,
        {},
        options.token,
      );
      const service = await handleResponse(response) as ServiceConfig;

      console.log(`📄 Service: ${colors.cyan(service.name)}`);
      console.log(`   Enabled: ${service.enabled ? "✅" : "❌"}`);
      console.log(`   JWT Check: ${service.jwt_check ? "🔒 Required" : "🔓 Not required"}`);
      console.log(`   Port: ${service.port || "Not allocated"}`);
      console.log(`   Code size: ${service.code.length} characters`);
      console.log(`   Created: ${service.created_at}`);
      console.log(`   Updated: ${service.updated_at}`);
      console.log("\n📝 Code:");
      console.log(colors.dim("```javascript"));
      console.log(service.code);
      console.log(colors.dim("```"));

      if (service.permissions) {
        const perms = typeof service.permissions === "string"
          ? JSON.parse(service.permissions)
          : service.permissions;
        console.log("\n🔐 Permissions:");
        console.log(`   Read: ${perms.read.length > 0 ? perms.read.join(", ") : "None"}`);
        console.log(`   Write: ${perms.write.length > 0 ? perms.write.join(", ") : "None"}`);
        console.log(`   Env: ${perms.env.length > 0 ? perms.env.join(", ") : "None"}`);
        console.log(`   Run: ${perms.run.length > 0 ? perms.run.join(", ") : "None"}`);
      }
    } catch (error) {
      console.error("❌ Failed to get service:", (error as Error).message);
      Deno.exit(1);
    }
  });

// Create service command
const createCommand = new Command()
  .arguments("<name:string> <file:string>")
  .description("Create a new service from file")
  .option("-e, --enabled", "Enable the service", { default: true })
  .option("-j, --jwt", "Enable JWT check", { default: false })
  .action(
    async (
      options: { host: string; port: number; token?: string; enabled: boolean; jwt: boolean },
      name: string,
      file: string,
    ) => {
      const baseUrl = `http://${options.host}:${options.port}`;

      try {
        // Read the service code from file
        const code = await Deno.readTextFile(file);

        const serviceData: ServiceConfig = {
          name,
          code,
          enabled: options.enabled,
          jwt_check: options.jwt,
          permissions: {
            read: [],
            write: [],
            env: [],
            run: [],
          },
        };

        const response = await makeRequest(`${baseUrl}/_admin/api/services`, {
          method: "POST",
          body: JSON.stringify(serviceData),
        }, options.token);

        await handleResponse(response);
        console.log(`✅ Service '${name}' created successfully`);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          console.error(`❌ File not found: ${file}`);
        } else {
          console.error("❌ Failed to create service:", (error as Error).message);
        }
        Deno.exit(1);
      }
    },
  );

// Update service command
const updateCommand = new Command()
  .arguments("<name:string> [file:string]")
  .description("Update an existing service")
  .option("-e, --enabled [enabled:boolean]", "Set enabled status")
  .option("-j, --jwt [jwt:boolean]", "Set JWT check")
  .action(
    async (
      options: { host: string; port: number; token?: string; enabled?: boolean; jwt?: boolean },
      name: string,
      file?: string,
    ) => {
      const baseUrl = `http://${options.host}:${options.port}`;

      try {
        // Get current service
        const getResponse = await makeRequest(
          `${baseUrl}/_admin/api/services/${name}`,
          {},
          options.token,
        );
        await handleResponse(getResponse);

        const updateData: Partial<ServiceConfig> = {};

        // Update code if file provided
        if (file) {
          updateData.code = await Deno.readTextFile(file);
        }

        // Update enabled status if provided
        if (options.enabled !== undefined) {
          updateData.enabled = options.enabled;
        }

        // Update JWT check if provided
        if (options.jwt !== undefined) {
          updateData.jwt_check = options.jwt;
        }

        const response = await makeRequest(`${baseUrl}/_admin/api/services/${name}`, {
          method: "PUT",
          body: JSON.stringify(updateData),
        }, options.token);

        await handleResponse(response);
        console.log(`✅ Service '${name}' updated successfully`);
      } catch (error) {
        if (file && error instanceof Deno.errors.NotFound) {
          console.error(`❌ File not found: ${file}`);
        } else {
          console.error("❌ Failed to update service:", (error as Error).message);
        }
        Deno.exit(1);
      }
    },
  );

// Delete service command
const deleteCommand = new Command()
  .arguments("<name:string>")
  .description("Delete a service")
  .option("-f, --force", "Force delete without confirmation")
  .action(
    async (
      options: { host: string; port: number; token?: string; force?: boolean },
      name: string,
    ) => {
      const baseUrl = `http://${options.host}:${options.port}`;

      if (!options.force) {
        const confirmation = await Confirm.prompt(
          `❓ Are you sure you want to delete service '${name}'?`,
        );
        if (!confirmation) {
          console.log("❌ Deletion cancelled");
          return;
        }
      }

      try {
        const response = await makeRequest(`${baseUrl}/_admin/api/services/${name}`, {
          method: "DELETE",
        }, options.token);

        await handleResponse(response);
        console.log(`✅ Service '${name}' deleted successfully`);
      } catch (error) {
        console.error("❌ Failed to delete service:", (error as Error).message);
        Deno.exit(1);
      }
    },
  );

// Start service command
const startCommand = new Command()
  .arguments("<name:string>")
  .description("Start a service")
  .action(async (options: { host: string; port: number; token?: string }, name: string) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const response = await makeRequest(`${baseUrl}/_admin/start/${name}`, {
        method: "POST",
      }, options.token);

      const result = await handleResponse(response) as { message: string };
      console.log(`✅ ${result.message}`);
    } catch (error) {
      console.error("❌ Failed to start service:", (error as Error).message);
      Deno.exit(1);
    }
  });

// Stop service command
const stopCommand = new Command()
  .arguments("<name:string>")
  .description("Stop a service")
  .action(async (options: { host: string; port: number; token?: string }, name: string) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const response = await makeRequest(`${baseUrl}/_admin/stop/${name}`, {
        method: "POST",
      }, options.token);

      const result = await handleResponse(response) as { message: string };
      console.log(`✅ ${result.message}`);
    } catch (error) {
      console.error("❌ Failed to stop service:", (error as Error).message);
      Deno.exit(1);
    }
  });

// Test service command
const testCommand = new Command()
  .arguments("<name:string> [path:string]")
  .description("Test a service endpoint")
  .option("-m, --method <method:string>", "HTTP method", { default: "GET" })
  .option("-d, --data <data:string>", "Request body data")
  .option("-H, --header <header:string>", "Add custom header (format: 'Key: Value')", {
    collect: true,
  })
  .action(
    async (
      options: {
        host: string;
        port: number;
        token?: string;
        method: string;
        data?: string;
        header?: string[];
      },
      name: string,
      path = "/",
    ) => {
      const baseUrl = `http://${options.host}:${options.port}`;
      const serviceUrl = `${baseUrl}/${name}${path.startsWith("/") ? path : "/" + path}`;

      try {
        const headers: Record<string, string> = {};

        // Parse custom headers
        if (options.header) {
          for (const header of options.header) {
            const [key, ...valueParts] = header.split(":");
            if (key && valueParts.length > 0) {
              headers[key.trim()] = valueParts.join(":").trim();
            }
          }
        }

        const requestOptions: RequestInit = {
          method: options.method.toUpperCase(),
          headers,
        };

        if (
          options.data &&
          (options.method.toUpperCase() === "POST" || options.method.toUpperCase() === "PUT")
        ) {
          requestOptions.body = options.data;
          headers["Content-Type"] = headers["Content-Type"] || "application/json";
        }

        console.log(`🧪 Testing ${options.method.toUpperCase()} ${serviceUrl}`);

        const start = Date.now();
        const response = await fetch(serviceUrl, requestOptions);
        const duration = Date.now() - start;

        console.log(`📊 Response: ${response.status} ${response.statusText} (${duration}ms)`);
        console.log(`📋 Headers:`);
        for (const [key, value] of response.headers.entries()) {
          console.log(`   ${key}: ${value}`);
        }

        const responseText = await response.text();
        console.log(`📄 Body:`);

        try {
          const jsonData = JSON.parse(responseText);
          console.log(JSON.stringify(jsonData, null, 2));
        } catch {
          console.log(responseText);
        }
      } catch (error) {
        console.error("❌ Failed to test service:", (error as Error).message);
        Deno.exit(1);
      }
    },
  );

// Services command group
const servicesCommand = new Command()
  .description("Service management commands")
  .action(function () {
    this.showHelp();
  })
  .command("list", listCommand)
  .command("get", getCommand)
  .command("create", createCommand)
  .command("update", updateCommand)
  .command("delete", deleteCommand)
  .command("start", startCommand)
  .command("stop", stopCommand)
  .command("test", testCommand);

// Config get command
const configGetCommand = new Command()
  .arguments("[key:string]")
  .description("Get configuration value(s)")
  .action(async (options: { host: string; port: number; token?: string }, key?: string) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const url = key ? `${baseUrl}/_admin/api/config/${key}` : `${baseUrl}/_admin/api/config`;

      const response = await makeRequest(url, {}, options.token);
      const config = await handleResponse(response) as
        | { value: string }
        | Array<{ key: string; value: string }>;

      if (key) {
        console.log(`⚙️  ${key}: ${(config as { value: string }).value}`);
      } else {
        console.log("⚙️  Configuration:");
        for (const item of config as Array<{ key: string; value: string }>) {
          console.log(`   ${item.key}: ${item.value}`);
        }
      }
    } catch (error) {
      console.error("❌ Failed to get configuration:", (error as Error).message);
      Deno.exit(1);
    }
  });

// Config set command
const configSetCommand = new Command()
  .arguments("<key:string> <value:string>")
  .description("Set configuration value")
  .action(
    async (options: { host: string; port: number; token?: string }, key: string, value: string) => {
      const baseUrl = `http://${options.host}:${options.port}`;

      try {
        const response = await makeRequest(`${baseUrl}/_admin/api/config/${key}`, {
          method: "PUT",
          body: JSON.stringify({ value }),
        }, options.token);

        await handleResponse(response);
        console.log(`✅ Configuration '${key}' set to '${value}'`);
      } catch (error) {
        console.error("❌ Failed to set configuration:", (error as Error).message);
        Deno.exit(1);
      }
    },
  );

// Config command group
const configCommand = new Command()
  .description("Manage server configuration")
  .action(function () {
    this.showHelp();
  })
  .command("get", configGetCommand)
  .command("set", configSetCommand);

// Info command
const infoCommand = new Command()
  .description("Show server information")
  .action(async (options: { host: string; port: number; token?: string }) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const [healthResponse, docsResponse] = await Promise.allSettled([
        makeRequest(`${baseUrl}/health`),
        makeRequest(`${baseUrl}/`),
      ]);

      console.log("ℹ️  Server Information:");
      console.log(`   URL: ${baseUrl}`);

      if (healthResponse.status === "fulfilled") {
        const health = await handleResponse(healthResponse.value) as HealthResponse;
        console.log(`   Status: ${health.status}`);
        console.log(`   Services: ${health.services.length} total`);
      }

      if (docsResponse.status === "fulfilled") {
        console.log(`   API Docs: ${baseUrl}/docs`);
        console.log(`   OpenAPI: ${baseUrl}/openapi.json`);
        console.log(`   Admin UI: ${baseUrl}/admin`);
      }

      console.log("\n📚 Available commands:");
      console.log("   health          - Check server health");
      console.log("   services list   - List all services");
      console.log("   services create - Create new service");
      console.log("   services test   - Test service endpoint");
      console.log("   config get      - Get configuration");
      console.log("   info           - Show this information");
    } catch (error) {
      console.error("❌ Failed to get server info:", (error as Error).message);
      Deno.exit(1);
    }
  });

// Interactive mode command
const interactiveCommand = new Command()
  .description("Start interactive mode")
  .action(async (options: { host: string; port: number; token?: string }) => {
    console.log(colors.brightBlue("🎛️  NanoEdgeRT Interactive Mode"));
    console.log("Choose an action:\n");

    while (true) {
      const action = await Select.prompt({
        message: "What would you like to do?",
        options: [
          { name: "List services", value: "list" },
          { name: "Create service", value: "create" },
          { name: "Get service details", value: "get" },
          { name: "Start service", value: "start" },
          { name: "Stop service", value: "stop" },
          { name: "Test service", value: "test" },
          { name: "Delete service", value: "delete" },
          { name: "Check health", value: "health" },
          { name: "View configuration", value: "config" },
          { name: "Exit", value: "exit" },
        ],
      });

      if (action === "exit") {
        console.log("👋 Goodbye!");
        break;
      }

      const baseUrl = `http://${options.host}:${options.port}`;

      try {
        switch (action) {
          case "list": {
            const response = await makeRequest(`${baseUrl}/_admin/api/services`, {}, options.token);
            const services = await handleResponse(response) as ServiceConfig[];

            if (services.length === 0) {
              console.log(colors.yellow("📭 No services found"));
            } else {
              const table = new Table()
                .header(["Name", "Enabled", "JWT", "Port"])
                .border(true);

              for (const service of services) {
                table.push([
                  service.name,
                  service.enabled ? "✅" : "❌",
                  service.jwt_check ? "🔒" : "🔓",
                  service.port?.toString() || "N/A",
                ]);
              }
              table.render();
            }
            break;
          }

          case "create": {
            const name = await Input.prompt("Service name:");
            const filePath = await Input.prompt("JavaScript file path:");
            const enabled = await Confirm.prompt("Enable service?");
            const jwtCheck = await Confirm.prompt("Require JWT authentication?");

            try {
              const code = await Deno.readTextFile(filePath);
              const serviceData: ServiceConfig = {
                name,
                code,
                enabled,
                jwt_check: jwtCheck,
                permissions: { read: [], write: [], env: [], run: [] },
              };

              const response = await makeRequest(`${baseUrl}/_admin/api/services`, {
                method: "POST",
                body: JSON.stringify(serviceData),
              }, options.token);

              await handleResponse(response);
              console.log(colors.green(`✅ Service '${name}' created successfully`));
            } catch (error) {
              if (error instanceof Deno.errors.NotFound) {
                console.error(colors.red(`❌ File not found: ${filePath}`));
              } else {
                console.error(colors.red("❌ Failed to create service:"), (error as Error).message);
              }
            }
            break;
          }

          case "get": {
            const name = await Input.prompt("Service name:");
            const response = await makeRequest(
              `${baseUrl}/_admin/api/services/${name}`,
              {},
              options.token,
            );
            const service = await handleResponse(response) as ServiceConfig;

            console.log(`📄 Service: ${colors.cyan(service.name)}`);
            console.log(`   Enabled: ${service.enabled ? "✅" : "❌"}`);
            console.log(`   JWT Check: ${service.jwt_check ? "🔒" : "🔓"}`);
            console.log(`   Port: ${service.port || "N/A"}`);
            console.log(`   Code size: ${service.code.length} characters`);
            break;
          }

          case "health": {
            const response = await makeRequest(`${baseUrl}/health`);
            const data = await handleResponse(response) as HealthResponse;
            console.log(`🏥 Status: ${data.status}`);
            console.log(`📊 Services: ${data.services.length}`);
            break;
          }

          case "start":
          case "stop": {
            const name = await Input.prompt("Service name:");
            const response = await makeRequest(`${baseUrl}/_admin/${action}/${name}`, {
              method: "POST",
            }, options.token);
            const result = await handleResponse(response) as { message: string };
            console.log(colors.green(`✅ ${result.message}`));
            break;
          }

          case "test": {
            const name = await Input.prompt("Service name:");
            const path = await Input.prompt("Path (default: /):");
            const method = await Select.prompt({
              message: "HTTP method:",
              options: ["GET", "POST", "PUT", "DELETE"],
              default: "GET",
            });

            const serviceUrl = `${baseUrl}/${name}${
              (path || "/").startsWith("/") ? (path || "/") : "/" + (path || "/")
            }`;
            console.log(`🧪 Testing ${method} ${serviceUrl}`);

            const start = Date.now();
            const response = await fetch(serviceUrl, { method });
            const duration = Date.now() - start;

            console.log(`📊 Response: ${response.status} ${response.statusText} (${duration}ms)`);
            const text = await response.text();
            try {
              console.log(JSON.stringify(JSON.parse(text), null, 2));
            } catch {
              console.log(text);
            }
            break;
          }

          case "delete": {
            const name = await Input.prompt("Service name:");
            const confirm = await Confirm.prompt(`Are you sure you want to delete '${name}'?`);
            if (confirm) {
              const response = await makeRequest(`${baseUrl}/_admin/api/services/${name}`, {
                method: "DELETE",
              }, options.token);
              await handleResponse(response);
              console.log(colors.green(`✅ Service '${name}' deleted`));
            }
            break;
          }

          case "config": {
            const response = await makeRequest(`${baseUrl}/_admin/api/config`, {}, options.token);
            const config = await handleResponse(response) as Array<{ key: string; value: string }>;

            const table = new Table()
              .header(["Key", "Value"])
              .border(true);

            for (const item of config) {
              table.push([item.key, item.value]);
            }
            table.render();
            break;
          }
        }
      } catch (error) {
        console.error(colors.red("❌ Error:"), (error as Error).message);
      }

      console.log(); // Add spacing
    }
  });

// Main CLI command
const cli = new Command()
  .name("NanoEdgeRT CLI")
  .version("1.1.0")
  .description("A fast, lightweight, and secure 🔬 nano-Service framework for Deno 🦖")
  .globalOption("--host <host:string>", "NanoEdgeRT server host", { default: "127.0.0.1" })
  .globalOption("-p, --port <port:number>", "NanoEdgeRT server port", { default: 8000 })
  .globalOption("-t, --token <token:string>", "JWT token for authentication")
  .action(function () {
    console.log("\n" + renderLogo());
    this.showHelp();
  })
  .command("health", healthCommand)
  .command("services", servicesCommand)
  .command("config", configCommand)
  .command("info", infoCommand)
  .command("interactive", interactiveCommand);

if (import.meta.main) {
  await cli.parse(Deno.args);
}
