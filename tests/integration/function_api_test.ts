import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT } from "../../src/nanoedge.ts";
import { createIsolatedDb } from "../test_utils.ts";
import { createDatabaseContext } from "../../database/config.ts";
import { createJWT } from "../../src/api/api.admin.ts";
import { createFunction } from "../../database/tables/functions.ts";

Deno.test("Integration: Function API execution", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a test function in the database
    const functionConfig = {
      name: "test-function",
      code: `
        export default function(input) {
          return {
            message: "Hello from function!",
            input: input
          }
        }
      `,
      enabled: true,
      timeout: 5000,
      memory_limit: 128,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Test function for integration testing",
    };

    await createFunction(dbContext, functionConfig);

    // Test function execution
    const response = await app.fetch(
      new Request("http://localhost:8000/functions/v2/test-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Integration Test" }),
      }),
    );
    console.log("Function response:", response);
    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.message, "Hello from function!");
    assertEquals(result.input.name, "Integration Test");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Function API - function not found", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Test non-existent function
    const response = await app.fetch(
      new Request("http://localhost:8000/functions/v2/nonexistent-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ test: "data" }),
      }),
    );

    assertEquals(response.status, 404);
    const result = await response.json();
    assertEquals(result.error, "Function not found");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Function API - disabled function", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a disabled function
    const functionConfig = {
      name: "disabled-function",
      code: `
        export default function() {
          return { message: "Should not execute" }
        }
      `,
      enabled: false, // Disabled
      timeout: 5000,
      memory_limit: 128,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Disabled test function",
    };

    await createFunction(dbContext, functionConfig);

    // Test disabled function execution
    const response = await app.fetch(
      new Request("http://localhost:8000/functions/v2/disabled-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 403);
    const result = await response.json();
    assertEquals(result.error, "Function is disabled");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Function API - async function execution", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create an async function
    const functionConfig = {
      name: "async-function",
      code: `
        export default async function(input) {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            processed: true,
            data: input.data?.toUpperCase() || "NO_DATA"
          }
        }
      `,
      enabled: true,
      timeout: 5000,
      memory_limit: 128,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Async test function",
    };

    await createFunction(dbContext, functionConfig);

    // Test async function execution
    const response = await app.fetch(
      new Request("http://localhost:8000/functions/v2/async-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: "hello world" }),
      }),
    );

    assertEquals(response.status, 200);
    const result = await response.json();
    assertEquals(result.processed, true);
    assertEquals(result.data, "HELLO WORLD");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Function API - error handling", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a function that throws an error
    const functionConfig = {
      name: "error-function",
      code: `
        export default function(input) {
          throw new Error("Intentional test error");
        }
      `,
      enabled: true,
      timeout: 5000,
      memory_limit: 128,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Error test function",
    };

    await createFunction(dbContext, functionConfig);

    // Test error function execution
    const response = await app.fetch(
      new Request("http://localhost:8000/functions/v2/error-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(response.status, 500);
    const result = await response.text();
    console.log("Error response:", result);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Function API - complex data processing", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a function that processes complex data
    const functionConfig = {
      name: "data-processor",
      code: `
        export default function(input) {
          const { users } = input;

          const processed = users.map(user => ({
            id: user.id,
            fullName: user.firstName + " " + user.lastName,
            email: user.email,
            isAdult: user.age >= 18,
            category: user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior"
          }));

          const stats = {
            total: users.length,
            adults: processed.filter(u => u.isAdult).length,
            minors: processed.filter(u => !u.isAdult).length,
            avgAge: users.reduce((sum, u) => sum + u.age, 0) / users.length
          };

          return {
            processed,
            statistics: stats
          };
        }
      `,
      enabled: true,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      timeout: 5000,
      memory_limit: 128,
      description: "Data processing function",
    };

    await createFunction(dbContext, functionConfig);

    const testData = {
      users: [
        { id: 1, firstName: "John", lastName: "Doe", email: "john@example.com", age: 30 },
        { id: 2, firstName: "Jane", lastName: "Smith", email: "jane@example.com", age: 25 },
        { id: 3, firstName: "Bob", lastName: "Johnson", email: "bob@example.com", age: 17 },
      ],
    };

    // Test complex data processing
    const response = await app.fetch(
      new Request("http://localhost:8000/functions/v2/data-processor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
      }),
    );

    assertEquals(response.status, 200);
    const result = await response.json();

    assertEquals(result.processed.length, 3);
    assertEquals(result.processed[0].fullName, "John Doe");
    assertEquals(result.processed[0].isAdult, true);
    assertEquals(result.processed[2].isAdult, false);

    assertEquals(result.statistics.total, 3);
    assertEquals(result.statistics.adults, 2);
    assertEquals(result.statistics.minors, 1);
    assertEquals(result.statistics.avgAge, 24);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Admin API function management with JWT", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Create a JWT token for admin access
    const mockToken = await createJWT({
      sub: "admin",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    });

    // Test creating a function via admin API
    const createResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/functions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "admin-created-function",
          code: `
            export default function(input) {
              return {
                message: "Created via admin API",
                timestamp: new Date().toISOString()
              };
            }
          `,
          enabled: true,
          timeout: 5000,
          memory_limit: 128,
          description: "Function created via admin API",
        }),
      }),
    );

    assertEquals(createResponse.status, 201);

    // Test listing functions via admin API
    const listResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/functions", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(listResponse.status, 200);
    const functions = await listResponse.json();
    assertExists(functions.functions);
    assertEquals(functions.functions.length, 1);
    assertEquals(functions.functions[0].name, "admin-created-function");

    // Test executing the created function
    const execResponse = await app.fetch(
      new Request("http://localhost:8000/functions/v2/admin-created-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(execResponse.status, 200);
    const result = await execResponse.json();
    assertEquals(result.message, "Created via admin API");
    assertExists(result.timestamp);
  } finally {
    abortController.abort();
  }
});
