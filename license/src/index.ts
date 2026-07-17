// FamilyBoard license server — Cloudflare Worker on license.familyboard.ch.
//
// Shipped devices activate with an offline-verifiable Ed25519 license key
// (FB1.<payload>.<sig>, minted by the vendor with tool/sign-license.mjs) and
// then check in here periodically to receive a short-lived signed LEASE
// (FBL1.<payload>.<sig>). The device caches the lease and keeps working while
// it's valid + a grace window — so it survives ~30d+ offline — and hard-locks
// only once the lease and grace expire. See docs / src/lib/license.ts.
//
// The lease is signed with the SAME Ed25519 keypair as the license keys, so
// the device verifies it with the public key it already bakes in — no new key
// material on the device. The private key lives ONLY here (Worker secret).
//
// KV is a revocation/override list, not an entitlement store: a validly signed,
// device-bound key is trusted by its signature. key:<sha256(key)> entries exist
// only to revoke ({"status":"revoked"}) or override plan / cap the lease.

export interface Env {
  LICENSE_KV: KVNamespace;
  LICENSE_PRIVATE_KEY: string; // base64 of PKCS8 DER (Worker secret)
  LICENSE_PUBLIC_KEY: string; // base64 SPKI DER (var)
  LEASE_DAYS: string;
}

const DAY_MS = 86_400_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesFromB64url(b64url: string): Uint8Array {
  return bytesFromB64(b64url.replace(/-/g, "+").replace(/_/g, "/"));
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256B64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return b64urlFromBytes(new Uint8Array(digest));
}

// Cached per isolate — importKey is not free.
let _signKey: CryptoKey | undefined;
let _verifyKey: CryptoKey | undefined;

async function signingKey(env: Env): Promise<CryptoKey> {
  if (!_signKey) {
    _signKey = await crypto.subtle.importKey(
      "pkcs8",
      bytesFromB64(env.LICENSE_PRIVATE_KEY.trim()),
      { name: "Ed25519" },
      false,
      ["sign"],
    );
  }
  return _signKey;
}

async function verifyKey(env: Env): Promise<CryptoKey> {
  if (!_verifyKey) {
    _verifyKey = await crypto.subtle.importKey(
      "spki",
      bytesFromB64(env.LICENSE_PUBLIC_KEY.trim()),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  }
  return _verifyKey;
}

type KeyPayload = {
  v: number;
  deviceId: string;
  plan: string;
  issuedAt: string;
  validUntil?: string;
};

type PresentedResult =
  | { ok: true; plan: string; validUntil: number | null }
  | { ok: false; code: string };

// Mirror of the device's verifyLicenseKey (src/lib/license.ts): verify the
// Ed25519 signature over the base64url payload STRING bytes, then check the
// device binding and expiry.
async function verifyPresentedKey(
  env: Env,
  key: string,
  deviceId: string,
): Promise<PresentedResult> {
  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== "FB1") return { ok: false, code: "malformed" };
  const [, payloadB64, sigB64] = parts;

  let payload: KeyPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytesFromB64url(payloadB64))) as KeyPayload;
  } catch {
    return { ok: false, code: "malformed" };
  }
  if (
    payload.v !== 1 ||
    typeof payload.deviceId !== "string" ||
    typeof payload.plan !== "string" ||
    typeof payload.issuedAt !== "string"
  ) {
    return { ok: false, code: "malformed" };
  }

  let sigOk = false;
  try {
    sigOk = await crypto.subtle.verify(
      { name: "Ed25519" },
      await verifyKey(env),
      bytesFromB64url(sigB64),
      new TextEncoder().encode(payloadB64),
    );
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, code: "bad_signature" };
  if (payload.deviceId !== deviceId) return { ok: false, code: "device_mismatch" };

  let validUntil: number | null = null;
  if (payload.validUntil) {
    const t = Date.parse(payload.validUntil);
    if (Number.isNaN(t)) return { ok: false, code: "malformed" };
    if (t < Date.now()) return { ok: false, code: "key_expired" };
    validUntil = t;
  }
  return { ok: true, plan: payload.plan, validUntil };
}

async function mintLease(
  env: Env,
  deviceId: string,
  plan: string,
  leaseUntilMs: number,
): Promise<string> {
  const payload = {
    v: 1,
    deviceId,
    plan,
    status: "active",
    issuedAt: new Date().toISOString(),
    leaseUntil: new Date(leaseUntilMs).toISOString(),
  };
  const payloadB64 = b64urlFromBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, await signingKey(env), new TextEncoder().encode(payloadB64)),
  );
  return `FBL1.${payloadB64}.${b64urlFromBytes(sig)}`;
}

type KvEntry = { status?: "revoked" | "active"; plan?: string; leaseUntilCap?: string };

async function handleCheckin(req: Request, env: Env): Promise<Response> {
  let body: { deviceId?: unknown; key?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const key = typeof body.key === "string" ? body.key : "";
  if (!deviceId || !key) return json({ error: "device_and_key_required" }, 400);

  const presented = await verifyPresentedKey(env, key, deviceId);
  if (!presented.ok) return json({ error: presented.code }, 400);

  const kvRaw = await env.LICENSE_KV.get(`key:${await sha256B64url(key)}`);
  let kv: KvEntry = {};
  if (kvRaw) {
    try {
      kv = JSON.parse(kvRaw) as KvEntry;
    } catch {
      kv = {};
    }
  }
  if (kv.status === "revoked") return json({ error: "revoked" }, 403);

  const plan = kv.plan ?? presented.plan;
  const leaseDays = Math.max(1, Number(env.LEASE_DAYS) || 30);
  let leaseUntil = Date.now() + leaseDays * DAY_MS;
  if (presented.validUntil !== null) leaseUntil = Math.min(leaseUntil, presented.validUntil);
  if (kv.leaseUntilCap) {
    const cap = Date.parse(kv.leaseUntilCap);
    if (!Number.isNaN(cap)) leaseUntil = Math.min(leaseUntil, cap);
  }

  const lease = await mintLease(env, deviceId, plan, leaseUntil);
  return json({ lease, leaseUntil: new Date(leaseUntil).toISOString(), plan });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/license/checkin") {
      return handleCheckin(req, env);
    }
    if (url.pathname === "/health") return json({ ok: true });
    return json({ error: "not_found" }, 404);
  },
};
