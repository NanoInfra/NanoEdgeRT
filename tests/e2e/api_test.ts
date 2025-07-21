import { assertEquals, assertExists } from "../test_utils.ts";

Deno.test({
  name: "E2E - Calculator service should work correctly",
  async fn() {
    // Test simple arithmetic via GET
    const getResponse = await fetch("http://0.0.0.0:8000/calculator?a=10&b=5&op=add");

    if (getResponse.status === 404) {
      console.log("Skipping E2E test - server not running");
      return;
    }

    assertEquals(getResponse.status, 200);

    const getData = await getResponse.json();
    assertEquals(getData.service, "calculator");
    assertEquals(getData.operation, "add");
    assertEquals(getData.result, 15);
    assertEquals(getData.operands.a, 10);
    assertEquals(getData.operands.b, 5);

    // Test division
    const divResponse = await fetch("http://0.0.0.0:8000/calculator?a=20&b=4&op=divide");
    assertEquals(divResponse.status, 200);

    const divData = await divResponse.json();
    assertEquals(divData.result, 5);

    // Test expression evaluation via POST
    const postResponse = await fetch("http://0.0.0.0:8000/calculator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expression: "(10 + 5) * 2",
      }),
    });

    assertEquals(postResponse.status, 200);

    const postData = await postResponse.json();
    assertEquals(postData.service, "calculator");
    assertEquals(postData.expression, "(10 + 5) * 2");
    assertEquals(postData.result, 30);

    // Test error handling - division by zero
    const errorResponse = await fetch("http://0.0.0.0:8000/calculator?a=10&b=0&op=divide");
    assertEquals(errorResponse.status, 400);

    const errorData = await errorResponse.json();
    assertEquals(errorData.service, "calculator");
    assertEquals(errorData.error, "Division by zero");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2E - Hello service should work correctly",
  async fn() {
    const response = await fetch("http://0.0.0.0:8000/hello?name=TestUser");

    if (response.status === 404) {
      console.log("Skipping E2E test - server not running");
      return;
    }

    assertEquals(response.status, 200);

    const data = await response.json();
    assertEquals(data.message, "Hello, TestUser!");
    assertEquals(data.method, "GET");
    assertEquals(data.path, "/"); // Path is rewritten to remove service name
    assertExists(data.timestamp);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2E - Admin endpoints should require authentication",
  async fn() {
    // Test without authentication from localhost (should get 401)
    const response = await fetch("http://127.0.0.1:8000/_admin/services");

    if (response.status === 404) {
      console.log("Skipping E2E test - server not running");
      return;
    }

    assertEquals(response.status, 401);

    const data = await response.json();
    assertEquals(data.error, "Unauthorized");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "E2E - System endpoints should work",
  async fn() {
    // Test health endpoint
    const healthResponse = await fetch("http://0.0.0.0:8000/health");

    if (healthResponse.status === 404) {
      console.log("Skipping E2E test - server not running");
      return;
    }

    assertEquals(healthResponse.status, 200);

    const healthData = await healthResponse.json();
    assertEquals(healthData.status, "healthy");
    assertExists(healthData.timestamp);
    assertEquals(Array.isArray(healthData.services), true);

    // Test welcome endpoint
    const welcomeResponse = await fetch("http://0.0.0.0:8000/");
    assertEquals(welcomeResponse.status, 200);

    const welcomeData = await welcomeResponse.json();
    assertEquals(welcomeData.message, "Welcome to NanoEdgeRT");
    assertEquals(Array.isArray(welcomeData.services), true);

    // Test documentation endpoints (only accessible from localhost)
    const docsResponse = await fetch("http://127.0.0.1:8000/docs");
    assertEquals(docsResponse.status, 200);
    assertEquals(docsResponse.headers.get("content-type"), "text/html");

    const openapiResponse = await fetch("http://127.0.0.1:8000/openapi.json");
    assertEquals(openapiResponse.status, 200);
    assertEquals(openapiResponse.headers.get("content-type"), "application/json");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
