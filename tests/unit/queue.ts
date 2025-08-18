import { createDatabaseContext } from "../../database/config.ts";
import { createTask } from "../../database/tables/tasks.ts";
import { subscribeToTraceByQueueId } from "../../database/task_tables/subscriber.ts";
import { createOrLoadQueuebase, enqueueTask } from "../../database/task_tables/queue.ts";
import { createNanoEdgeRT } from "NanoEdgeRT/mod.ts";
import { createIsolatedDb } from "../test_utils.ts";
import { getAllFunctions } from "../../database/tables/functions.ts";
import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";

Deno.test("Queue API - should enqueue task and subscribe to trace", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);
  const queue = await createOrLoadQueuebase(":memory:");
  const ac = new AbortController();
  const _ = await createNanoEdgeRT(context, queue, ac);
  // create a task
  const task = await createTask(context, {
    name: "hello_world",
    retry_count: 0,
    retry_delay: 1000,
    code: `
export default async function handler(req) {
console.log("Hello, world!");
req.bye = "bye";
return req
}
`,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  });

  const queueId = await enqueueTask(
    context,
    queue,
    task.id!,
    JSON.stringify({ message: "Hello, world!" }),
  );

  const all_functions = await getAllFunctions(context);
  console.log("All functions:", all_functions);

  const traces = [];
  for await (const trace of subscribeToTraceByQueueId(queue, queueId, ac)) {
    console.log("Received trace:", trace);
    traces.push(trace);
  }
  ac.abort(); // Stop the executor after testing
  assert(traces.length == 2, "Should receive at least one trace");
});

Deno.test("Queue API - should enqueue streaming task and subscribe to trace", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);
  const queue = await createOrLoadQueuebase(":memory:");
  const ac = new AbortController();
  const _ = await createNanoEdgeRT(context, queue, ac);
  // create a task
  const task = await createTask(context, {
    name: "hello_stream",
    retry_count: 0,
    retry_delay: 1000,
    code: `
export default async function* handler(req) {
console.log("Hello, world!");
yield 1;
yield 2;
req.bye = "bye";
return req
}
`,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  });

  const queueId = await enqueueTask(
    context,
    queue,
    task.id!,
    JSON.stringify({ message: "Hello, world!" }),
  );

  const all_functions = await getAllFunctions(context);
  console.log("All functions:", all_functions);

  const traces = [];
  for await (const trace of subscribeToTraceByQueueId(queue, queueId, ac)) {
    console.log("Received trace:", trace);
    traces.push(trace);
  }
  ac.abort(); // Stop the executor after testing
  assert(traces.length == 4, "Should receive at least one trace");
});

Deno.test("Queue API - test retry", async () => {
  const db = await createIsolatedDb();
  const context = await createDatabaseContext(db);
  const queue = await createOrLoadQueuebase(":memory:");
  const ac = new AbortController();
  const _ = await createNanoEdgeRT(context, queue, ac);
  // create a task
  const task = await createTask(context, {
    name: "test_retry",
    retry_count: 20,
    retry_delay: 100,
    code: `
export default async function handler(req) {
  const randint = Math.random();
  if (randint < 0.5) {
    throw new Error("Random failure");
  }
  return randint;
}
`,
    permissions: {
      read: [],
      write: [],
      env: [],
      run: [],
    },
  });

  const queueId = await enqueueTask(
    context,
    queue,
    task.id!,
    JSON.stringify({ message: "Hello, world!" }),
  );

  const all_functions = await getAllFunctions(context);
  console.log("All functions:", all_functions);

  const traces = [];
  for await (const trace of subscribeToTraceByQueueId(queue, queueId, ac)) {
    console.log("Received trace:", trace);
    traces.push(trace);
  }
  ac.abort(); // Stop the executor after testing
  assert(traces.length >= 2, "Should receive at least one trace");
});
