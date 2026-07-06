// FamilyBoard OAuth broker — Cloudflare Worker on familyboard.ch.
//
// Lets shipped LAN devices link Google Calendar without baking the client
// secret onto them, and without Google having to accept a http://…​.local
// redirect URI. See docs/google-oauth-broker-plan.md.
//
// Flow (redirect-adopt):
//   device → POST /oauth/google/start {memberId, adoptSecret, returnUrl}
//          ← {authorizeUrl, state}   (broker stores pending{state} in KV, 10 min)
//   browser opens authorizeUrl → Google consent → GET /oauth/google/callback
//   broker exchanges code → refresh_token, encrypts it with adoptSecret,
//   302 → returnUrl?state=…&payload=…  (back to the device on the LAN)
//
// The refresh token is never persisted by the broker; the vendor client secret
// lives only here (Worker secret).

export interface Env {
  OAUTH_KV: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BROKER_BASE_URL: string; // e.g. https://familyboard.ch
}

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/calendar.events";
const STATE_TTL_S = 600;

type Pending = {
  memberId: string;
  adoptSecret: string; // hex, 32 bytes — device-supplied AES-256 key
  returnUrl: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// The broker only ever redirects a token payload to the device on its own LAN.
// Restrict to familyboard.local or RFC1918 IPs over http, on the adopt path —
// never an attacker-supplied external URL (no open redirect).
function isAllowedReturnUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:") return false;
  if (u.pathname !== "/api/auth/google/adopt") return false;
  const h = u.hostname;
  if (h === "familyboard.local" || h === "localhost") return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true;
  return false;
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// AES-256-GCM. Output framing: iv(12) || ciphertext || tag(16), base64url.
// The device (Node crypto) splits the trailing 16-byte tag back off.
async function encryptForDevice(adoptSecretHex: string, plaintext: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    bytesFromHex(adoptSecretHex),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64urlFromBytes(out);
}

function errorPage(message: string, status = 400): Response {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>FamilyBoard</title>` +
      `<p style="font:16px system-ui;padding:2rem">${message}</p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

async function handleStart(req: Request, env: Env): Promise<Response> {
  let body: Partial<Pending>;
  try {
    body = (await req.json()) as Partial<Pending>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { memberId, adoptSecret, returnUrl } = body;
  if (!memberId || typeof memberId !== "string") return json({ error: "memberId_required" }, 400);
  if (!adoptSecret || !/^[0-9a-f]{64}$/i.test(adoptSecret)) {
    return json({ error: "adoptSecret_must_be_64_hex" }, 400);
  }
  if (!returnUrl || !isAllowedReturnUrl(returnUrl)) {
    return json({ error: "returnUrl_not_allowed" }, 400);
  }

  const state = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(32)));
  const pending: Pending = { memberId, adoptSecret, returnUrl };
  await env.OAUTH_KV.put(`google:${state}`, JSON.stringify(pending), {
    expirationTtl: STATE_TTL_S,
  });

  const authorizeUrl = new URL(GOOGLE_AUTH);
  authorizeUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", `${env.BROKER_BASE_URL}/oauth/google/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", GOOGLE_SCOPES);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent");
  authorizeUrl.searchParams.set("include_granted_scopes", "true");
  authorizeUrl.searchParams.set("state", state);

  return json({ authorizeUrl: authorizeUrl.toString(), state });
}

async function handleCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return errorPage(`Google sign-in was cancelled (${oauthError}).`);
  if (!code || !state) return errorPage("Missing code or state.");

  const raw = await env.OAUTH_KV.get(`google:${state}`);
  if (!raw) return errorPage("This sign-in link has expired. Please try again from the device.");
  await env.OAUTH_KV.delete(`google:${state}`);
  const pending = JSON.parse(raw) as Pending;

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.BROKER_BASE_URL}/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return errorPage("Token exchange with Google failed. Please try again.", 502);
  const tokens = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token?: string;
    id_token?: string;
  };
  if (!tokens.refresh_token) {
    return errorPage(
      "Google did not return a refresh token. Remove FamilyBoard from your Google account's connected apps and try again.",
    );
  }

  let email: string | undefined;
  if (tokens.access_token) {
    const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (info.ok) email = ((await info.json()) as { email?: string }).email;
  }

  const payload = await encryptForDevice(
    pending.adoptSecret,
    JSON.stringify({ refreshToken: tokens.refresh_token, email: email ?? null }),
  );

  const dest = new URL(pending.returnUrl);
  dest.searchParams.set("state", state);
  dest.searchParams.set("payload", payload);
  return Response.redirect(dest.toString(), 302);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/oauth/google/start") {
      return handleStart(req, env);
    }
    if (req.method === "GET" && url.pathname === "/oauth/google/callback") {
      return handleCallback(req, env);
    }
    if (url.pathname === "/health") return json({ ok: true });
    return new Response("Not found", { status: 404 });
  },
};
