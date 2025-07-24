import { verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

export class AuthMiddleware {
  private cryptoKey: CryptoKey;

  private constructor(cryptoKey: CryptoKey) {
    this.cryptoKey = cryptoKey;
  }

  static async create(jwtSecret: string): Promise<AuthMiddleware> {
    const encoder = new TextEncoder();
    const secretData = encoder.encode(jwtSecret);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      secretData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    return new AuthMiddleware(cryptoKey);
  }

  async authenticate(request: Request): Promise<{ authenticated: boolean; user?: unknown }> {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { authenticated: false };
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verify(token, this.cryptoKey);
      return { authenticated: true, user: payload };
    } catch (error) {
      console.warn(
        "JWT verification failed:",
        error instanceof Error ? error.message : String(error),
      );
      return { authenticated: false };
    }
  }

  createUnauthorizedResponse(): Response {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
