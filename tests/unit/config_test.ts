import { assertEquals, assertExists } from "../test_utils.ts";
import { loadConfig, saveConfig } from "../../src/config.ts";
import { Config } from "../../src/types.ts";

Deno.test("Config - loadConfig should return default config when file doesn't exist", async () => {
  const config = await loadConfig("./non-existent-config.json");

  assertEquals(config.available_port_start, 8001);
  assertEquals(config.available_port_end, 8999);
  assertEquals(config.main_port, 8000);
  assertEquals(config.services.length, 0);
  assertExists(config.jwt_secret);
});

Deno.test("Config - saveConfig and loadConfig should work together", async () => {
  const testConfig: Config = {
    available_port_start: 9001,
    available_port_end: 9999,
    main_port: 9000,
    jwt_secret: "test-secret",
    services: [
      {
        name: "test-service",
        enable: true,
        jwt_check: false,
        permissions: {
          read: ["./test"],
          write: [],
          env: [],
          run: [],
        },
      },
    ],
  };

  const testConfigPath = "./test-config.json";

  try {
    await saveConfig(testConfig, testConfigPath);
    const loadedConfig = await loadConfig(testConfigPath);

    assertEquals(loadedConfig.available_port_start, testConfig.available_port_start);
    assertEquals(loadedConfig.available_port_end, testConfig.available_port_end);
    assertEquals(loadedConfig.main_port, testConfig.main_port);
    assertEquals(loadedConfig.jwt_secret, testConfig.jwt_secret);
    assertEquals(loadedConfig.services.length, 1);
    assertEquals(loadedConfig.services[0].name, "test-service");
  } finally {
    try {
      await Deno.remove(testConfigPath);
    } catch {
      // Ignore cleanup errors
    }
  }
});

Deno.test("Config - loadConfig should use environment JWT_SECRET when available", async () => {
  const originalSecret = Deno.env.get("JWT_SECRET");

  try {
    Deno.env.set("JWT_SECRET", "env-test-secret");

    const config = await loadConfig("./non-existent-config.json");
    assertEquals(config.jwt_secret, "env-test-secret");
  } finally {
    if (originalSecret) {
      Deno.env.set("JWT_SECRET", originalSecret);
    } else {
      Deno.env.delete("JWT_SECRET");
    }
  }
});
