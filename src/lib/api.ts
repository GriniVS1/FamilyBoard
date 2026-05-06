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

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

export function withErrorHandling<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
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
