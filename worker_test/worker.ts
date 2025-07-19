const worker = new Worker(new URL("./test.ts", import.meta.url), {
  type: "module",
  deno: {
    permissions: {
      read: [
        new URL("./file_1.txt", import.meta.url),
        new URL("./file_2.txt", import.meta.url),
      ],
    },
  },
});
await new Promise((resolve) => setTimeout(resolve, 3000));
worker.postMessage("stop");
