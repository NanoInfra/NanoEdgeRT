import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createNanoEdgeRT } from "../../src/nanoedge.ts";
import { createIsolatedDb } from "../test_utils.ts";
import { createDatabaseContext } from "../../database/config.ts";
import { createJWT } from "../../src/api/api.admin.ts";

Deno.test("Integration: Task API - CRUD operations", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    const mockToken = await createJWT({
      sub: "user123",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    });

    // Test creating a task
    const createTaskPayload = {
      name: "test-task",
      retry_count: 3,
      retry_delay: 2000,
      code: `
        export default function handler(input) {
          return {
            message: "Task executed successfully",
            input: input,
            timestamp: Date.now()
          };
        }
      `,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Integration test task",
    };

    const createResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createTaskPayload),
      }),
    );

    assertEquals(createResponse.status, 201);
    const createResult = await createResponse.json();
    assertEquals(createResult.message, "Task created successfully");
    assertExists(createResult.task);
    assertExists(createResult.task.id);
    assertEquals(createResult.task.name, "test-task");
    assertEquals(createResult.task.retry_count, 3);
    assertEquals(createResult.task.retry_delay, 2000);

    // Use the ID returned from the create response (the UUID)
    const taskId = createResult.task.id;

    // Test getting all tasks
    const getAllResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getAllResponse.status, 200);
    const getAllResult = await getAllResponse.json();
    assertExists(getAllResult.tasks);
    assertEquals(getAllResult.tasks.length >= 1, true);
    // Find the task by the UUID we got from create
    const foundTask = getAllResult.tasks.find((t: { id: string }) => t.id === taskId);
    assertExists(foundTask);
    assertEquals(foundTask.name, "test-task");

    // Test getting task by ID using the UUID from create response
    const getByIdResponse = await app.fetch(
      new Request(`http://localhost:8000/admin-api/v2/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getByIdResponse.status, 200);
    const getByIdResult = await getByIdResponse.json();
    assertEquals(getByIdResult.id, taskId);
    assertEquals(getByIdResult.name, "test-task");
    assertEquals(getByIdResult.retry_count, 3);

    // Test updating task
    const updatePayload = {
      name: "updated-test-task",
      retry_count: 5,
      retry_delay: 3000,
      description: "Updated integration test task",
    };

    const updateResponse = await app.fetch(
      new Request(`http://localhost:8000/admin-api/v2/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      }),
    );

    assertEquals(updateResponse.status, 200);
    const updateResult = await updateResponse.json();
    assertEquals(updateResult.message, "Task updated successfully");
    assertEquals(updateResult.task.name, "updated-test-task");
    assertEquals(updateResult.task.retry_count, 5);
    assertEquals(updateResult.task.retry_delay, 3000);

    // Test getting tasks by name filter
    const getByNameResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks?name=updated-test-task", {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getByNameResponse.status, 200);
    const getByNameResult = await getByNameResponse.json();
    assertExists(getByNameResult.tasks);
    assertEquals(getByNameResult.tasks.length, 1);
    assertEquals(getByNameResult.tasks[0].name, "updated-test-task");

    // Test deleting task
    const deleteResponse = await app.fetch(
      new Request(`http://localhost:8000/admin-api/v2/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(deleteResponse.status, 200);
    const deleteResult = await deleteResponse.json();
    assertEquals(deleteResult.message, "Task deleted successfully");

    // Verify task is deleted
    const getDeletedTaskResponse = await app.fetch(
      new Request(`http://localhost:8000/admin-api/v2/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getDeletedTaskResponse.status, 404);
    const getDeletedTaskResult = await getDeletedTaskResponse.json();
    assertEquals(getDeletedTaskResult.error, "Task not found");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Task API - validation errors", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    const mockToken = await createJWT({
      sub: "user123",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    });

    // Test creating task without name
    const createWithoutNameResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "export default function() { return {}; }",
        }),
      }),
    );

    assertEquals(createWithoutNameResponse.status, 400);
    const createWithoutNameResult = await createWithoutNameResponse.json();
    assertEquals(createWithoutNameResult.error, "Name is required");

    // Test creating task without code
    const createWithoutCodeResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "test-task",
        }),
      }),
    );

    assertEquals(createWithoutCodeResponse.status, 400);
    const createWithoutCodeResult = await createWithoutCodeResponse.json();
    assertEquals(createWithoutCodeResult.error, "Function code is required");

    // Test getting non-existent task
    const getNonExistentResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks/non-existent-id", {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getNonExistentResponse.status, 404);
    const getNonExistentResult = await getNonExistentResponse.json();
    assertEquals(getNonExistentResult.error, "Task not found");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Task API - unauthorized access", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    // Test accessing tasks without authentication
    const unauthenticatedResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks"),
    );
    assertEquals(unauthenticatedResponse.status, 401);

    // Test creating task without authentication
    const createUnauthenticatedResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "test-task",
          code: "export default function() { return {}; }",
        }),
      }),
    );
    assertEquals(createUnauthenticatedResponse.status, 401);

    // Test with invalid token
    const invalidTokenResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        headers: {
          "Authorization": "Bearer invalid.token.here",
        },
      }),
    );
    assertEquals(invalidTokenResponse.status, 401);
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Task API - task execution integration", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    const mockToken = await createJWT({
      sub: "user123",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    });

    // Create a task that can be executed
    const createTaskPayload = {
      name: "executable-task",
      retry_count: 1,
      retry_delay: 1000,
      code: `
        export default function handler(input) {
          console.log("Executing task with input:", input);
          return {
            success: true,
            processedAt: new Date().toISOString(),
            input: input
          };
        }
      `,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Task for execution testing",
    };

    const createResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createTaskPayload),
      }),
    );

    assertEquals(createResponse.status, 201);
    const createResult = await createResponse.json();
    const taskId = createResult.task.id;

    // Verify the task was created and has the correct function associated
    const getTaskResponse = await app.fetch(
      new Request(`http://localhost:8000/admin-api/v2/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getTaskResponse.status, 200);
    const getTaskResult = await getTaskResponse.json();
    assertEquals(getTaskResult.name.includes("executable-task"), true);
    assertEquals(getTaskResult.retry_count, 1);
    assertEquals(getTaskResult.retry_delay, 1000);
    assertExists(getTaskResult.function_name);

    // Test that the associated function was created and can be executed
    const functionResponse = await app.fetch(
      new Request(`http://localhost:8000/functions/v2/${getTaskResult.function_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ test: "data", timestamp: Date.now() }),
      }),
    );

    assertEquals(functionResponse.status, 200);
    const functionResult = await functionResponse.json();
    assertEquals(functionResult.success, true);
    assertExists(functionResult.processedAt);
    assertEquals(functionResult.input.test, "data");
  } finally {
    abortController.abort();
  }
});

Deno.test("Integration: Task API - task with streaming function", async () => {
  const db = await createIsolatedDb();
  const dbContext = await createDatabaseContext(db);
  const [app, _port, abortController, _serviceManagerState] = await createNanoEdgeRT(dbContext);

  try {
    const mockToken = await createJWT({
      sub: "user123",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    });

    // Create a task with streaming function
    const createTaskPayload = {
      name: "streaming-task",
      retry_count: 0,
      retry_delay: 1000,
      code: `
        export default async function* handler(input) {
          yield { step: 1, message: "Starting processing", input };
          yield { step: 2, message: "Processing data" };
          yield { step: 3, message: "Finalizing" };
          return { step: 4, message: "Complete", result: "success" };
        }
      `,
      permissions: {
        read: [],
        write: [],
        env: [],
        run: [],
      },
      description: "Streaming task for testing",
    };

    const createResponse = await app.fetch(
      new Request("http://localhost:8000/admin-api/v2/tasks", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mockToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createTaskPayload),
      }),
    );

    assertEquals(createResponse.status, 201);
    const createResult = await createResponse.json();
    const taskId = createResult.task.id;

    // Get the task to retrieve function name
    const getTaskResponse = await app.fetch(
      new Request(`http://localhost:8000/admin-api/v2/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${mockToken}`,
        },
      }),
    );

    assertEquals(getTaskResponse.status, 200);
    const getTaskResult = await getTaskResponse.json();
    assertExists(getTaskResult.function_name);

    // Test the streaming function
    const functionResponse = await app.fetch(
      new Request(`http://localhost:8000/functions/v2/${getTaskResult.function_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ test: "streaming" }),
      }),
    );

    assertEquals(functionResponse.status, 200);
    assertEquals(functionResponse.headers.get("Content-Type"), "text/event-stream");

    // Read the streaming response
    const reader = functionResponse.body?.getReader();
    assertExists(reader);

    let streamData = "";
    let chunks = 0;

    while (chunks < 10) { // Limit to prevent infinite loop
      const { done, value } = await reader.read();
      if (done) break;

      streamData += value;
      chunks++;

      // If we have received some data, we can verify the stream format
      if (streamData.includes("data: ")) {
        break;
      }
    }

    // Verify that we received streaming data
    assertEquals(streamData.includes("data: "), true);
  } finally {
    abortController.abort();
  }
});
