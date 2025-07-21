#!/usr/bin/env -S deno run --allow-all

import { loadConfig, saveConfig } from "./src/config.ts";
import { ServiceConfig } from "./src/types.ts";

async function main() {
  const [command, ...args] = Deno.args;

  switch (command) {
    case "init":
      await initProject();
      break;
    case "add":
      await addService(args[0], args[1]);
      break;
    case "remove":
      await removeService(args[0]);
      break;
    case "list":
      await listServices();
      break;
    case "enable":
      await toggleService(args[0], true);
      break;
    case "disable":
      await toggleService(args[0], false);
      break;
    default:
      showHelp();
  }
}

async function initProject(): Promise<void> {
  console.log("🚀 Initializing NanoEdgeRT project...");

  // Create directories
  try {
    await Deno.mkdir("./nanoedge/services", { recursive: true });
    console.log("✅ Created nanoedge/services directory");
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  // Create default config
  const config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    jwt_secret: "change-me-in-production",
    services: [],
  };

  await saveConfig(config);
  console.log("✅ Created default config.json");

  // Create example service
  const exampleServiceDir = "./nanoedge/services/hello";
  try {
    await Deno.mkdir(exampleServiceDir, { recursive: true });

    const exampleCode = `export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "World";
  
  return new Response(
    JSON.stringify({ 
      message: \`Hello, \${name}!\`,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}`;

    await Deno.writeTextFile(`${exampleServiceDir}/index.ts`, exampleCode);
    console.log("✅ Created example hello service");

    // Add service to config
    const newConfig = await loadConfig();
    newConfig.services.push({
      name: "hello",
      enable: true,
      jwt_check: false,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
    });
    await saveConfig(newConfig);
    console.log("✅ Added hello service to config");
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  console.log("🎉 NanoEdgeRT project initialized!");
  console.log("📖 Run 'deno task start' to start the server");
}

async function addService(name: string, path?: string): Promise<void> {
  if (!name) {
    console.error("❌ Service name is required");
    return;
  }

  const config = await loadConfig();

  if (config.services.find((s) => s.name === name)) {
    console.error(`❌ Service '${name}' already exists`);
    return;
  }

  const serviceConfig: ServiceConfig = {
    name,
    path,
    enable: true,
    jwt_check: false,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };

  config.services.push(serviceConfig);
  await saveConfig(config);

  // Create service directory and template file
  const serviceDir = path || `./nanoedge/services/${name}`;
  try {
    await Deno.mkdir(serviceDir, { recursive: true });

    const templateCode = `export default async function handler(req: Request): Promise<Response> {
  // Your service logic here
  return new Response(
    JSON.stringify({ 
      service: "${name}",
      message: "Hello from ${name} service!",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}`;

    await Deno.writeTextFile(`${serviceDir}/index.ts`, templateCode);
    console.log(`✅ Added service '${name}' and created template file`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to create service directory: ${errorMessage}`);
  }
}

async function removeService(name: string): Promise<void> {
  if (!name) {
    console.error("❌ Service name is required");
    return;
  }

  const config = await loadConfig();
  const index = config.services.findIndex((s) => s.name === name);

  if (index === -1) {
    console.error(`❌ Service '${name}' not found`);
    return;
  }

  config.services.splice(index, 1);
  await saveConfig(config);

  console.log(`✅ Removed service '${name}' from config`);
  console.log("⚠️  Service files were not deleted. Remove them manually if needed.");
}

async function listServices(): Promise<void> {
  const config = await loadConfig();

  if (config.services.length === 0) {
    console.log("📭 No services configured");
    return;
  }

  console.log("📋 Configured services:");
  console.log("");

  for (const service of config.services) {
    const status = service.enable ? "🟢 enabled" : "🔴 disabled";
    const auth = service.jwt_check ? "🔒 JWT required" : "🔓 No auth";
    const path = service.path || `./nanoedge/services/${service.name}`;

    console.log(`  ${service.name} - ${status} - ${auth}`);
    console.log(`    Path: ${path}`);
    console.log("");
  }
}

async function toggleService(name: string, enable: boolean): Promise<void> {
  if (!name) {
    console.error("❌ Service name is required");
    return;
  }

  const config = await loadConfig();
  const service = config.services.find((s) => s.name === name);

  if (!service) {
    console.error(`❌ Service '${name}' not found`);
    return;
  }

  service.enable = enable;
  await saveConfig(config);

  const action = enable ? "enabled" : "disabled";
  console.log(`✅ Service '${name}' ${action}`);
}

function showHelp(): void {
  console.log(`
🔧 NanoEdgeRT CLI

Usage:
  deno run --allow-all cli.ts <command> [args]

Commands:
  init                    Initialize a new NanoEdgeRT project
  add <name> [path]       Add a new service
  remove <name>           Remove a service
  list                    List all services
  enable <name>           Enable a service
  disable <name>          Disable a service

Examples:
  deno run --allow-all cli.ts init
  deno run --allow-all cli.ts add my-api
  deno run --allow-all cli.ts add my-service ./custom/path
  deno run --allow-all cli.ts list
  deno run --allow-all cli.ts enable my-api
  deno run --allow-all cli.ts remove my-api
`);
}

if (import.meta.main) {
  main();
}
