import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|favicon.ico).*)"],
};

// Suffixes that never resolve through public DNS, so a rebinding attacker
// cannot own a name under them.
const LOCAL_SUFFIXES = [".local", ".localhost", ".lan", ".home", ".internal", ".home.arpa"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const configuredHosts = new Set([
  new URL(env.NEXTAUTH_URL).hostname.toLowerCase(),
  ...env.ALLOWED_HOSTS,
]);

function forbidden(code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: 403 });
}

function requestHost(req: NextRequest): string | null {
  const forwarded = env.TRUST_PROXY ? req.headers.get("x-forwarded-host") : null;
  const host = forwarded?.split(",")[0]?.trim() || req.headers.get("host");
  return host ? host.toLowerCase() : null;
}

function isAllowedHostname(hostname: string): boolean {
  if (isIP(hostname.replace(/^\[|\]$/g, ""))) return true;
  if (hostname === "localhost" || !hostname.includes(".")) return true;
  if (LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
  return configuredHosts.has(hostname);
}

// Everything on :3000 outside the bearer-guarded mobile API trusts the caller's
// network position. A DNS-rebinding page arrives with its own hostname in Host,
// and a cross-site page arrives with a foreign Origin; neither may borrow that
// position, so both are refused before any route runs.
export function middleware(req: NextRequest): NextResponse {
  const host = requestHost(req);
  let hostname: string;
  try {
    hostname = new URL(`http://${host ?? ""}`).hostname;
  } catch {
    return forbidden("FORBIDDEN_HOST", "Unrecognised host");
  }
  if (!host || !isAllowedHostname(hostname)) {
    return forbidden("FORBIDDEN_HOST", "Unrecognised host");
  }

  if (UNSAFE_METHODS.has(req.method)) {
    if (req.headers.get("sec-fetch-site") === "cross-site") {
      return forbidden("FORBIDDEN_ORIGIN", "Cross-site request refused");
    }
    const origin = req.headers.get("origin");
    if (origin !== null) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        // "null" and other opaque origins never match.
      }
      if (originHost !== host) {
        return forbidden("FORBIDDEN_ORIGIN", "Cross-origin request refused");
      }
    }
  }

  return NextResponse.next();
}
