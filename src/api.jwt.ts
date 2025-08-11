import { Hono } from "hono";
import { Context } from "hono";
import { createJWT, JWTPayload } from "./api/api.admin.ts";

// Localhost-only middleware
const localhostOnly = async (c: Context, next: () => Promise<void>) => {
  const clientIP = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "127.0.0.1";
  const allowedIPs = ["127.0.0.1", "::1", "localhost"];

  if (!allowedIPs.includes(clientIP)) {
    return c.json({ error: "Access denied. Only localhost is allowed." }, 403);
  }

  await next();
};

// Generate expiration time (24 hours from now)
function generateExpiration(): number {
  const now = Math.floor(Date.now() / 1000);
  return now + (24 * 60 * 60); // 24 hours
}

// Generate a default user ID
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function setupJWTRoutes() {
  const app = new Hono();

  // Simple JWT creation - no parameters needed
  app.all("/create", localhostOnly, async (c: Context) => {
    try {
      const payload: JWTPayload = {
        sub: generateUserId(),
        exp: generateExpiration(),
        iat: Math.floor(Date.now() / 1000), // issued at
        type: "access",
        scope: "full",
      };

      const token = await createJWT(payload);
      return c.json({
        token,
        payload,
        expires_in: 24 * 60 * 60, // 24 hours in seconds
        expires_at: new Date(payload.exp * 1000).toISOString(),
      }, 200);
    } catch (error) {
      console.error("JWT creation error:", error);
      return c.json({
        error: "Failed to create JWT",
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  return app;
}
