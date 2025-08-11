import { Hono } from "hono";
import { jwt, sign, verify } from "hono/jwt";
import { setupAPIRoutes } from "../database/api.service.ts";
import { setupFunctionAPIRoutes } from "../database/api.function.ts";
import { createService, DatabaseContext } from "../database/dto.ts";
import { Context } from "hono";
import JSZip from "jszip";

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
  const jwt = await sign(payload, secret, "HS256");
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

// export function jwtCheck(c: Context, next: MiddlewareHandler) {
//   return
// }

async function hostFrontendHandler(c: Context): Promise<Response> {
  try {
    const formData = await c.req.formData();
    const serverFile = formData.get("server") as File;
    const staticFile = formData.get("static") as File;
    const serviceName = formData.get("serviceName") as string;

    if (!serverFile || !staticFile || !serviceName) {
      return c.json({
        error: "Missing required fields: server (JS file), static (ZIP file), and serviceName",
      }, 400);
    }

    // Validate file types
    if (!serverFile.name.endsWith(".js")) {
      return c.json({ error: "Server file must be a .js file" }, 400);
    }

    if (!staticFile.name.endsWith(".zip")) {
      return c.json({ error: "Static file must be a .zip file" }, 400);
    }

    // Read server JS code
    const serverCode = await serverFile.text();

    // Create static directory if it doesn't exist
    const staticDirString = `../static/${serviceName}`;
    const staticDir = new URL(staticDirString, import.meta.url);

    try {
      await Deno.mkdir(staticDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }

    // Unzip static files
    const zipBuffer = await staticFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extract all files from the zip
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const filePath = `${staticDirString}/${relativePath}`;
        const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
        const dirPathURL = new URL(dirPath, import.meta.url);
        // Create directory if it doesn't exist
        if (dirPathURL !== staticDir) {
          try {
            await Deno.mkdir(dirPathURL, { recursive: true });
          } catch (error) {
            if (!(error instanceof Deno.errors.AlreadyExists)) {
              throw error;
            }
          }
        }

        // Write the file
        const fileContent = await zipEntry.async("uint8array");
        await Deno.writeFile(new URL(filePath, import.meta.url), fileContent);
      }
    }

    // Create service with the server code
    const dbContext = c.get("dbContext") as DatabaseContext;
    await createService(dbContext, {
      name: serviceName,
      code: serverCode,
      enabled: true,
      jwt_check: false,
      permissions: {
        read: [staticDir.toString()],
        write: [],
        env: [],
        run: [],
      },
    });

    return c.json({
      message: "Frontend hosted successfully",
      serviceName,
      staticPath: staticDir,
    }, 201);
  } catch (error) {
    console.error("Host frontend error:", error);
    return c.json({
      error: "Failed to host frontend",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function setupAdminAPIRoutes(
  dbContext: DatabaseContext,
) {
  const app = new Hono();
  app.use(
    "*",
    jwt({
      secret,
      // algorithms: ["HS256"],
    }),
  );

  setupAPIRoutes(app, dbContext);
  setupFunctionAPIRoutes(app, dbContext);

  // Frontend hosting API
  app.post("/host-frontend", hostFrontendHandler);

  return app;
}
