// 编译subserver

// const command = new Deno.Command(Deno.execPath(), {
//   args: [
//     "bundle",
//     new URL("./subserver.ts", import.meta.url).pathname,
//     "-o",
//     new URL("./subserver.js", import.meta.url).pathname,
//   ],
//   stdout: "inherit",
//   stderr: "inherit",
// });

// // run the command
// const child = command.spawn();
// const success = await child.status;
// if (!success.success) {
//   console.error("Failed to compile subserver:", success);
//   Deno.exit(1);
// }

const workerAdapterCode = `

let __handler;
const __handler_rewriter = async (
  req
) => {
  const url = new URL(req.url);
  const rewritedPathname = url.pathname.split("/");
  const _first = rewritedPathname.shift(); // remove the first part (e.g., "server1")
  const name = rewritedPathname.shift(); // remove the name part (e.g., "server1")
  const path = rewritedPathname.join("/");
  const rewritedUrl = "http://" + name + "/" + path +
    url.search;
  const newReq = new Request(rewritedUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    credentials: req.credentials,
  });
  return await __handler(newReq);
}
const ____AC = new AbortController();
self.onmessage = async (event) => {
  if (event.data === "stop") {
    console.log("Stopping server1");
    ____AC.abort();
    self.close();
  } else {
    const { port } = event.data;
    const __handlerModule = await import(import.meta.url);
    __handler = __handlerModule.default;
    Deno.serve({
      port,
      hostname: "127.0.0.1",
      signal: ____AC.signal,
    }, __handler_rewriter);
  }
};
`;

const workerCode = await Deno.readTextFile(
  new URL("./subserver.js", import.meta.url),
);

const blob = new Blob([workerCode + workerAdapterCode], {
  type: "application/javascript",
});
const worker = new Worker(URL.createObjectURL(blob), {
  type: "module",
});

worker.postMessage({
  port: 12345,
});
