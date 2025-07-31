import { Hono, MiddlewareHandler } from "hono";
import { jwt, sign, verify } from "hono/jwt";
import { setupAPIRoutes } from "../database/api.ts";
import { DatabaseContext } from "../database/dto.ts";
import { Context } from "hono";

// Extend Hono's Context to include our database context
export interface JWTPayload {
  sub: string; // Subject (user ID)
  exp: number; // Expiration time
  // deno-lint-ignore no-explicit-any
  [key: string]: any; // Additional custom claims
}
declare module "hono" {
  interface ContextVariableMap {
    jwtPayload: JWTPayload;
  }
}
const secret = "my_super_duper_secret_key_for_admin_jwt";

export async function createJWT(payload: JWTPayload): Promise<string> {
  const jwt = await sign(payload, secret);
  return jwt;
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

export function jwtCheck(c: Context, next: MiddlewareHandler) {
  return jwt({
    secret,
    algorithms: ["HS256"],
  })(c, next);
}

export function setupAdminAPIRoutes(
  dbContext: DatabaseContext,
) {
  const app = new Hono();
  app.use(
    "*",
    jwtCheck,
  );

  setupAPIRoutes(app, dbContext);
  return app;
}
