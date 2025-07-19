async function server1(req: Request): Promise<Response> {
  console.log("Server 1 received request:", req.url);
  const body = await req.json();
  console.log("body:", body);
  return new Response(JSON.stringify({ hi: 1 }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

Deno.serve({
  hostname: "127.0.0.1",
  port: 12345,
}, async (req) => {
  console.log("main Server received request:", req.url);
  const requrl = new URL(req.url);

  if (requrl.pathname.startsWith("/server1")) {
    const rewritedUrl = "http://server1" + requrl.pathname.substring(8) +
      requrl.search;
    const newReq = new Request(rewritedUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    return await server1(newReq);
  } else {
    return new Response("Not Found", { status: 404 });
  }
});

console.log("Server is running");

// Example curl request:
// curl -X POST http://127.0.0.1:12345/server1/test -H "Content-Type: application/json" -d '{"message": "hello"}'
