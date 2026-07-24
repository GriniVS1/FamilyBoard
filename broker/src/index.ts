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
  // Microsoft (Azure AD app) — same broker, same redirect-adopt flow as Google.
  // Secret lives only here; devices never hold it.
  MS_CLIENT_ID: string;
  MS_CLIENT_SECRET: string;
  MS_TENANT?: string; // "common" (default) = personal + work/school accounts
  // App-download redirect targets (familyboard.ch/app/ios|android — QR codes on
  // the wall's setup screen). Empty/unset = branded "coming soon" page.
  APP_IOS_URL?: string;
  APP_ANDROID_URL?: string;
}

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/calendar.events";
const STATE_TTL_S = 600;

// Microsoft v2.0 endpoints (tenant filled in per request). offline_access yields
// the refresh token; the calendar/user scopes match src/lib/microsoft.ts.
const MS_SCOPES = "openid email offline_access Calendars.ReadWrite User.Read";
const msAuthUrl = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
const msTokenUrl = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

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
function isAllowedReturnUrl(raw: string, adoptPath: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:") return false;
  if (u.pathname !== adoptPath) return false;
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

async function sha256B64url(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return b64urlFromBytes(new Uint8Array(buf));
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
  if (!returnUrl || !isAllowedReturnUrl(returnUrl, "/api/auth/google/adopt")) {
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

// Mint a fresh Google access token from a device's refresh token. Shipped
// devices can't do this themselves — the refresh grant needs the vendor client
// secret, which lives only here. The refresh token is the bearer credential
// (the broker issued it in the callback); we don't persist it. Coarse per-token
// rate limiting blunts a leaked-token refresh loop. HMAC per-installation
// hardening is a planned follow-up.
async function handleRefresh(req: Request, env: Env): Promise<Response> {
  let body: { refreshToken?: string };
  try {
    body = (await req.json()) as { refreshToken?: string };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const refreshToken = body.refreshToken;
  if (!refreshToken || typeof refreshToken !== "string") {
    return json({ error: "refreshToken_required" }, 400);
  }

  const rlKey = `rl:refresh:${await sha256B64url(refreshToken)}`;
  const count = parseInt((await env.OAUTH_KV.get(rlKey)) ?? "0", 10);
  if (count >= 30) return json({ error: "rate_limited" }, 429);
  await env.OAUTH_KV.put(rlKey, String(count + 1), { expirationTtl: 60 });

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // 400/401 from Google means the refresh token is revoked/invalid — surface
    // that to the device (401) so it can prompt a relink; anything else is 502.
    const status = res.status === 400 || res.status === 401 ? 401 : 502;
    return json({ error: "refresh_failed" }, status);
  }
  const t = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!t.access_token) return json({ error: "no_access_token" }, 502);
  return json({ access_token: t.access_token, expires_in: t.expires_in ?? 3600 });
}

// --- Microsoft (Azure AD) — mirror of the Google redirect-adopt flow ----------

async function handleMsStart(req: Request, env: Env): Promise<Response> {
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
  if (!returnUrl || !isAllowedReturnUrl(returnUrl, "/api/auth/microsoft/adopt")) {
    return json({ error: "returnUrl_not_allowed" }, 400);
  }

  const tenant = env.MS_TENANT || "common";
  const state = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(32)));
  const pending: Pending = { memberId, adoptSecret, returnUrl };
  await env.OAUTH_KV.put(`microsoft:${state}`, JSON.stringify(pending), {
    expirationTtl: STATE_TTL_S,
  });

  const authorizeUrl = new URL(msAuthUrl(tenant));
  authorizeUrl.searchParams.set("client_id", env.MS_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", `${env.BROKER_BASE_URL}/oauth/microsoft/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", MS_SCOPES);
  authorizeUrl.searchParams.set("prompt", "select_account");
  authorizeUrl.searchParams.set("state", state);

  return json({ authorizeUrl: authorizeUrl.toString(), state });
}

async function handleMsCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return errorPage(`Microsoft sign-in was cancelled (${oauthError}).`);
  if (!code || !state) return errorPage("Missing code or state.");

  const raw = await env.OAUTH_KV.get(`microsoft:${state}`);
  if (!raw) return errorPage("This sign-in link has expired. Please try again from the device.");
  await env.OAUTH_KV.delete(`microsoft:${state}`);
  const pending = JSON.parse(raw) as Pending;

  const tenant = env.MS_TENANT || "common";
  const tokenRes = await fetch(msTokenUrl(tenant), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      redirect_uri: `${env.BROKER_BASE_URL}/oauth/microsoft/callback`,
      grant_type: "authorization_code",
      scope: MS_SCOPES,
    }),
  });
  if (!tokenRes.ok) return errorPage("Token exchange with Microsoft failed. Please try again.", 502);
  const tokens = (await tokenRes.json()) as {
    refresh_token?: string;
    access_token?: string;
  };
  if (!tokens.refresh_token) {
    return errorPage("Microsoft did not return a refresh token. Please try again.");
  }

  let email: string | null = null;
  if (tokens.access_token) {
    const info = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (info.ok) {
      const me = (await info.json()) as { mail?: string; userPrincipalName?: string };
      email = me.mail ?? me.userPrincipalName ?? null;
    }
  }

  const payload = await encryptForDevice(
    pending.adoptSecret,
    JSON.stringify({ refreshToken: tokens.refresh_token, email }),
  );

  const dest = new URL(pending.returnUrl);
  dest.searchParams.set("state", state);
  dest.searchParams.set("payload", payload);
  return Response.redirect(dest.toString(), 302);
}

// Mint a fresh Microsoft access token from a device's refresh token. Like
// Google, the refresh grant needs the vendor client secret (broker-only).
// Microsoft ROTATES the refresh token on every refresh, so we return the new
// one too — the device must persist it or the next refresh fails.
async function handleMsRefresh(req: Request, env: Env): Promise<Response> {
  let body: { refreshToken?: string };
  try {
    body = (await req.json()) as { refreshToken?: string };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const refreshToken = body.refreshToken;
  if (!refreshToken || typeof refreshToken !== "string") {
    return json({ error: "refreshToken_required" }, 400);
  }

  const rlKey = `rl:msrefresh:${await sha256B64url(refreshToken)}`;
  const count = parseInt((await env.OAUTH_KV.get(rlKey)) ?? "0", 10);
  if (count >= 30) return json({ error: "rate_limited" }, 429);
  await env.OAUTH_KV.put(rlKey, String(count + 1), { expirationTtl: 60 });

  const tenant = env.MS_TENANT || "common";
  const res = await fetch(msTokenUrl(tenant), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      client_secret: env.MS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MS_SCOPES,
    }),
  });
  if (!res.ok) {
    const status = res.status === 400 || res.status === 401 ? 401 : 502;
    return json({ error: "refresh_failed" }, status);
  }
  const t = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!t.access_token) return json({ error: "no_access_token" }, 502);
  return json({
    access_token: t.access_token,
    expires_in: t.expires_in ?? 3600,
    refresh_token: t.refresh_token,
  });
}

// --- App-download redirects (QR codes on the wall's setup screen) -------------

function comingSoonPage(storeName: string): Response {
  return new Response(
    `<!doctype html><html lang="de"><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>FamilyBoard App</title>` +
      `<body style="margin:0;font:17px/1.6 system-ui,-apple-system,sans-serif;` +
      `display:flex;min-height:100vh;align-items:center;justify-content:center;` +
      `background:#faf6f1;color:#2b2622;text-align:center">` +
      `<div style="padding:2rem;max-width:26rem">` +
      `<div style="font-size:2.5rem">📱</div>` +
      `<h1 style="font-size:1.4rem;margin:.6rem 0">FamilyBoard für ${storeName}</h1>` +
      `<p style="color:#7a716a">Bald verfügbar — die App ist gerade in Vorbereitung.<br>` +
      `Coming soon — the app is on its way.</p>` +
      `</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

function handleAppDownload(url: URL, env: Env): Response {
  if (url.pathname === "/app/ios") {
    const target = (env.APP_IOS_URL || "").trim();
    return target ? Response.redirect(target, 302) : comingSoonPage("iOS");
  }
  if (url.pathname === "/app/android") {
    const target = (env.APP_ANDROID_URL || "").trim();
    return target ? Response.redirect(target, 302) : comingSoonPage("Android");
  }
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.startsWith("/app/")) {
      return handleAppDownload(url, env);
    }
    if (req.method === "POST" && url.pathname === "/oauth/google/start") {
      return handleStart(req, env);
    }
    if (req.method === "GET" && url.pathname === "/oauth/google/callback") {
      return handleCallback(req, env);
    }
    if (req.method === "POST" && url.pathname === "/oauth/google/refresh") {
      return handleRefresh(req, env);
    }
    if (req.method === "POST" && url.pathname === "/oauth/microsoft/start") {
      return handleMsStart(req, env);
    }
    if (req.method === "GET" && url.pathname === "/oauth/microsoft/callback") {
      return handleMsCallback(req, env);
    }
    if (req.method === "POST" && url.pathname === "/oauth/microsoft/refresh") {
      return handleMsRefresh(req, env);
    }
    if (url.pathname === "/health") return json({ ok: true });
    return new Response("Not found", { status: 404 });
  },
};
