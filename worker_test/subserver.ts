export default async function server1(req: Request): Promise<Response> {
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
