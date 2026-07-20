import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Mutation requests through these path prefixes bypass the license gate so the
// user can always activate, set up, or recover — even when the license is locked.
const LICENSE_WHITELIST_PREFIXES = [
  "/api/license",
  "/api/setup",
  "/api/network",
  "/api/auth",
  "/api/devices/pair",
  "/api/settings/pin",
  "/api/settings/factory-reset",
  // Trigger an OTA update check (writes the update-request flag). A locked
  // device must be able to pull the fix/license-key OTA from the UI, not only
  // via the nightly host timer — the recovery path, same rationale as above.
  "/api/settings/update-status",
];

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function isWhitelisted(pathname: string): boolean {
  return LICENSE_WHITELIST_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

export function withErrorHandling<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (MUTATION_METHODS.has(req.method)) {
        const pathname = new URL(req.url).pathname;
        if (!isWhitelisted(pathname)) {
          // Dynamic import breaks the otherwise-circular dependency at module load
          // (license.ts → db.ts; api.ts is imported by nearly every route).
          const { requireActiveLicense } = await import("./license");
          await requireActiveLicense();
        }
      }
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        return fail(err.code, err.message, err.status);
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request",
              issues: err.flatten(),
            },
          },
          { status: 400 },
        );
      }
      const isProd = process.env.NODE_ENV === "production";
      const message =
        !isProd && err instanceof Error ? err.message : "Internal server error";
      return fail("INTERNAL_ERROR", message, 500);
    }
  };
}
