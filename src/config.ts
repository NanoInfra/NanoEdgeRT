import { Config } from "./database-config.ts";

export async function loadConfig(configPath: string = "./nanoedge/config.json"): Promise<Config> {
  try {
    const configText = await Deno.readTextFile(configPath);
    const config = JSON.parse(configText) as Partial<Config>;

    // Set defaults
    const defaultConfig: Config = {
      available_port_start: 8001,
      available_port_end: 8999,
      services: [],
      jwt_secret: Deno.env.get("JWT_SECRET") || "default-secret-change-me",
      main_port: 8000,
      ...config,
    };

    return defaultConfig;
  } catch (error) {
    console.warn(
      `Failed to load config from ${configPath}:`,
      error instanceof Error ? error.message : String(error),
    );
    return {
      available_port_start: 8001,
      available_port_end: 8999,
      services: [],
      jwt_secret: Deno.env.get("JWT_SECRET") || "default-secret-change-me",
      main_port: 8000,
    };
  }
}

export async function saveConfig(
  config: Config,
  configPath: string = "./nanoedge/config.json",
): Promise<void> {
  try {
    const configText = JSON.stringify(config, null, 2);
    await Deno.writeTextFile(configPath, configText);
  } catch (error) {
    console.error(
      `Failed to save config to ${configPath}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
