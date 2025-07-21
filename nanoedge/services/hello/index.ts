export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "World";
  
  return new Response(
    JSON.stringify({ 
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}