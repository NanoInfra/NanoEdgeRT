export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      // Simple calculation via query parameters
      const a = parseFloat(url.searchParams.get("a") || "0");
      const b = parseFloat(url.searchParams.get("b") || "0");
      const operation = url.searchParams.get("op") || "add";

      let result: number;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            throw new Error("Division by zero");
          }
          result = a / b;
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      return new Response(
        JSON.stringify({
          service: "calculator",
          operation,
          operands: { a, b },
          result,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } else if (method === "POST") {
      // Complex calculation via JSON body
      const body = await req.json();
      const { expression } = body;

      if (!expression) {
        throw new Error("Expression is required");
      }

      // Simple expression evaluator (for demo purposes)
      // In production, use a proper math parser
      const result = evaluateExpression(expression);

      return new Response(
        JSON.stringify({
          service: "calculator",
          expression,
          result,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } else {
      throw new Error(`Method ${method} not supported`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        service: "calculator",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

function evaluateExpression(expression: string): number {
  // Simple safe expression evaluator
  // Remove spaces and validate characters
  const sanitized = expression.replace(/\s/g, "");

  // Only allow numbers, operators, and parentheses
  if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
    throw new Error("Invalid characters in expression");
  }

  try {
    // Use Function constructor for safe evaluation
    return Function(`"use strict"; return (${sanitized})`)();
  } catch {
    throw new Error("Invalid expression");
  }
}
