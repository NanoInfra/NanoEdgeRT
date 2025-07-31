import { OpenAPIHono } from "@hono/zod-openapi";
import { jwt } from "hono/jwt";
import { setupAPIRoutes } from "../database/api.ts";
import { DatabaseContext } from "../database/dto.ts";
import { Context } from "hono";

// Extend Hono's Context to include our database context
declare module "hono" {
  interface ContextVariableMap {
    jwtPayload: {
      sub: string; // Subject (user ID)
      iat: number; // Issued at
      exp: number; // Expiration time
      // deno-lint-ignore no-explicit-any
      [key: string]: any; // Additional custom claims
    };
  }
}

export function jwtCheck(c: Context, next: any): Promise<void> {
  return jwt({
    secret: Deno.env.get("ADMIN_JWT_SECRET") || "admin",
    algorithms: ["HS256"],
  })(c, next);
}

export function setupAdminAPIRoutes(
  dbContext: DatabaseContext,
) {
  const app = new OpenAPIHono();
  app.use(
    "*",
    jwtCheck,
  );

  const adminRoutes = new OpenAPIHono();
  setupAPIRoutes(adminRoutes, dbContext);
  app.route("*", adminRoutes);
  return app;
}
