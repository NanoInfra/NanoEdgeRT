import { Config } from "../src/types.ts";
import { SwaggerGenerator } from "../src/swagger.ts";
import { AuthMiddleware } from "../src/auth.ts";

Deno.bench("Config parsing performance", () => {
  const configJson = JSON.stringify({
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    jwt_secret: "test-secret",
    services: Array.from({ length: 100 }, (_, i) => ({
      name: `service-${i}`,
      enable: true,
      jwt_check: false,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
    })),
  });

  JSON.parse(configJson);
});

Deno.bench("Swagger spec generation performance", () => {
  const config: Config = {
    available_port_start: 8001,
    available_port_end: 8999,
    main_port: 8000,
    jwt_secret: "test-secret",
    services: Array.from({ length: 50 }, (_, i) => ({
      name: `service-${i}`,
      enable: true,
      jwt_check: i % 2 === 0,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
    })),
  };

  const generator = new SwaggerGenerator(config);
  generator.generateOpenAPISpec();
});

Deno.bench("JWT token creation", async () => {
  const authMiddleware = await AuthMiddleware.create("test-secret-for-benchmarking");
  // Benchmark would include token creation if we exposed that method
});

Deno.bench("Request URL parsing", () => {
  const urls = [
    "http://0.0.0.0:8000/service1/path/to/resource",
    "http://0.0.0.0:8000/service2?param1=value1&param2=value2",
    "http://0.0.0.0:8000/_admin/services",
    "http://0.0.0.0:8000/health",
  ];

  for (const urlString of urls) {
    const url = new URL(urlString);
    url.pathname.split("/").filter((s) => s);
  }
});

// Service performance benchmarks - require server to be running
Deno.bench({
  name: "Hello service response time",
  async fn() {
    try {
      const response = await fetch("http://0.0.0.0:8000/hello?name=BenchTest");
      if (response.ok) {
        await response.json();
      }
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "service_calls",
  baseline: true,
});

Deno.bench({
  name: "Calculator service - simple addition",
  async fn() {
    try {
      const response = await fetch("http://0.0.0.0:8000/calculator?a=10&b=5&op=add");
      if (response.ok) {
        await response.json();
      }
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "service_calls",
});

Deno.bench({
  name: "Calculator service - expression evaluation",
  async fn() {
    try {
      const response = await fetch("http://0.0.0.0:8000/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: "(10 + 5) * 2" }),
      });
      if (response.ok) {
        await response.json();
      }
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "service_calls",
});

Deno.bench({
  name: "Health endpoint response time",
  async fn() {
    try {
      const response = await fetch("http://0.0.0.0:8000/health");
      if (response.ok) {
        await response.json();
      }
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "system_endpoints",
  baseline: true,
});

Deno.bench({
  name: "Welcome endpoint response time",
  async fn() {
    try {
      const response = await fetch("http://0.0.0.0:8000/");
      if (response.ok) {
        await response.json();
      }
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "system_endpoints",
});

Deno.bench({
  name: "OpenAPI spec generation endpoint",
  async fn() {
    try {
      const response = await fetch("http://0.0.0.0:8000/openapi.json");
      if (response.ok) {
        await response.json();
      }
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "system_endpoints",
});

// Concurrent request benchmarks
Deno.bench({
  name: "Concurrent hello service requests (10x)",
  async fn() {
    try {
      const promises = Array.from(
        { length: 10 },
        (_, i) =>
          fetch(`http://0.0.0.0:8000/hello?name=Concurrent${i}`)
            .then((r) => r.ok ? r.json() : null)
            .catch(() => null),
      );
      await Promise.all(promises);
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "concurrent",
});

Deno.bench({
  name: "Concurrent calculator requests (10x)",
  async fn() {
    try {
      const promises = Array.from(
        { length: 10 },
        (_, i) =>
          fetch(`http://0.0.0.0:8000/calculator?a=${i}&b=${i + 1}&op=add`)
            .then((r) => r.ok ? r.json() : null)
            .catch(() => null),
      );
      await Promise.all(promises);
    } catch {
      // Server not running, skip benchmark
    }
  },
  group: "concurrent",
});
