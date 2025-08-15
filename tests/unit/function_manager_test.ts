import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createIsolatedDb } from "../test_utils.ts";
import { createDatabaseContext } from "../../database/config.ts";
import { execFunction } from "../../src/managers/function-manager.ts";
import { createFunction } from "../../database/tables/functions.ts";

Deno.test("execFunction - should execute simple function", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "test-function",
    code: `
      export default async function hf() {
        return { message: "Hello from function!" }
      }
    `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, {});

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.message, "Hello from function!");
});

Deno.test("execFunction - should handle function with parameters", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "param-function",
    code: `
      export default function(input) {
        const name = input?.name || "World";
        return { greeting: \`Hello, \${name}!\` }
      }
    `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, { name: "Alice" });

  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.greeting, "Hello, Alice!");
});

Deno.test("execFunction - should handle async function", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "async-function",
    code: `
      export default async function() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 1
      }
    `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, {});
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body, 1);
});

Deno.test("execFunction - should handle function errors", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "error-function",
    code: `
      export default function() {
        throw new Error("Function error");
      }
    `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, {});
  assertEquals(response.status, 500);
  const body = await response.text();
  assertEquals(body.includes("Function execution error: Function error"), true);
});

Deno.test("execFunction - should handle invalid function code", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "invalid-function",
    code: "invalid javascript syntax {{{",
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, {});
  assertEquals(response.status, 500);
  const body = await response.text();
  assertEquals(body.includes("invalid javascript syntax"), true);
});

Deno.test("execFunction - should handle function with no default export", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "no-export-function",
    code: `
      function someFunction() {
        return "test";
      }
    `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, {});
  assertEquals(response.status, 500);
  const body = await response.text();
  assertEquals(body.includes("No default export"), true);
});

Deno.test("execFunction - should handle complex function with multiple operations", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "complex-function",
    code: `
      export default function complex(input) {
        const { numbers } = input || { numbers: [1, 2, 3, 4, 5] };

        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        const max = Math.max(...numbers);
        const min = Math.min(...numbers);

        return {
            sum,
            average: avg,
            maximum: max,
            minimum: min,
            count: numbers.length,
        }
      }
    `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, { numbers: [10, 20, 30] });

  assertEquals(response.status, 200);

  const body = await response.json();
  assertEquals(body.sum, 60);
  assertEquals(body.average, 20);
  assertEquals(body.maximum, 30);
  assertEquals(body.minimum, 10);
  assertEquals(body.count, 3);
});

Deno.test("execFunction - should handle generator functions", async () => {
  const db = await createIsolatedDb();
  const state = await createDatabaseContext(db);

  const functionConfig = {
    name: "generator-function",
    code: `
        export default function* main() {
            yield "first";
            yield "second";
            return "done";
        }
        `,
    enabled: true,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  };
  await createFunction(state, functionConfig);

  const response = await execFunction(state, functionConfig.name, {});
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "text/event-stream");
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let result = "";
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        result += value;
      }
    }
    result += decoder.decode(); // flush
  }
  console.log("Generator function result:", result);
  const expected = `data: "first"

data: "second"

data: [DONE]"done"`;
  assertEquals(result.trim(), expected);
});
