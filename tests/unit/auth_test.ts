import { assertEquals } from "../test_utils.ts";
import { AuthMiddleware } from "../../src/auth.ts";
import { create } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

Deno.test("AuthMiddleware - should create instance successfully", async () => {
  const authMiddleware = await AuthMiddleware.create("test-secret");
  assertEquals(typeof authMiddleware, "object");
});

Deno.test("AuthMiddleware - should authenticate valid JWT token", async () => {
  const secret = "test-secret";
  const authMiddleware = await AuthMiddleware.create(secret);

  // Create a valid JWT token
  const encoder = new TextEncoder();
  const secretData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secretData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const payload = { sub: "test-user", exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = await create({ alg: "HS256", typ: "JWT" }, payload, cryptoKey);

  const request = new Request("http://0.0.0.0:8000/test", {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  const result = await authMiddleware.authenticate(request);
  assertEquals(result.authenticated, true);
  assertEquals((result.user as { sub: string })?.sub, "test-user");
});

Deno.test("AuthMiddleware - should reject invalid JWT token", async () => {
  const authMiddleware = await AuthMiddleware.create("test-secret");

  const request = new Request("http://0.0.0.0:8000/test", {
    headers: {
      "Authorization": "Bearer invalid-token",
    },
  });

  const result = await authMiddleware.authenticate(request);
  assertEquals(result.authenticated, false);
});

Deno.test("AuthMiddleware - should reject missing Authorization header", async () => {
  const authMiddleware = await AuthMiddleware.create("test-secret");

  const request = new Request("http://0.0.0.0:8000/test");

  const result = await authMiddleware.authenticate(request);
  assertEquals(result.authenticated, false);
});

Deno.test("AuthMiddleware - should reject malformed Authorization header", async () => {
  const authMiddleware = await AuthMiddleware.create("test-secret");

  const request = new Request("http://0.0.0.0:8000/test", {
    headers: {
      "Authorization": "InvalidFormat token",
    },
  });

  const result = await authMiddleware.authenticate(request);
  assertEquals(result.authenticated, false);
});

Deno.test("AuthMiddleware - should create unauthorized response", async () => {
  const authMiddleware = await AuthMiddleware.create("test-secret");

  const response = authMiddleware.createUnauthorizedResponse();
  assertEquals(response.status, 401);
  assertEquals(response.headers.get("content-type"), "application/json");

  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});
