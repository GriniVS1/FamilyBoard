// FamilyBoard license server — Cloudflare Worker on license.familyboard.ch.
//
// Shipped devices activate with an offline-verifiable Ed25519 license key
// (FB1.<payload>.<sig>, minted by the vendor) and then check in here
// periodically to receive a short-lived signed LEASE (FBL1.<payload>.<sig>).
// The device caches the lease and keeps working while it's valid + a grace
// window — so it survives ~30d+ offline — and hard-locks only once the lease
// and grace expire. See docs / src/lib/license.ts.
//
// The lease is signed with the SAME Ed25519 keypair as the license keys, so
// the device verifies it with the public key it already bakes in — no new key
// material on the device. The private key lives ONLY here (Worker secret).
//
// KV holds two things, by prefix:
//   key:<sha256url(key)> -> revocation/override  {"status":"revoked"} | {plan} | {leaseUntilCap}
//   rec:<deviceId>       -> vendor record         {deviceId, plan, customer, key, issuedAt}
// A validly signed, device-bound key is trusted by its signature alone; the
// key: entries exist only to revoke/override. The rec: entries are the vendor's
// "which customer got which key for which device" ledger, written by /license/issue
// and read by /license/lookup — so a lost key can always be re-found and resent.

export interface Env {
  LICENSE_KV: KVNamespace;
  LICENSE_PRIVATE_KEY: string; // base64 of PKCS8 DER (Worker secret)
  LICENSE_PUBLIC_KEY: string; // base64 SPKI DER (var)
  LEASE_DAYS: string;
  LICENSE_ADMIN_TOKEN: string; // Worker secret — gates /admin + issue/lookup/revoke
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

// Mint a perpetual, device-bound FB1 license key (no validUntil — the lease is
// the expiry/revocation surface). Same signing scheme the device verifies.
async function mintKey(env: Env, deviceId: string, plan: string): Promise<{ key: string; issuedAt: string }> {
  const issuedAt = new Date().toISOString();
  const payload = { v: 1, deviceId, plan, issuedAt };
  const payloadB64 = b64urlFromBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, await signingKey(env), new TextEncoder().encode(payloadB64)),
  );
  return { key: `FB1.${payloadB64}.${b64urlFromBytes(sig)}`, issuedAt };
}

type KvEntry = { status?: "revoked" | "active"; plan?: string; leaseUntilCap?: string };
type VendorRecord = { deviceId: string; plan: string; customer: string; key: string; issuedAt: string };

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

// --- Vendor admin surface -----------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Returns a 401 Response when the caller is not the vendor, else null.
function requireAdmin(req: Request, env: Env): Response | null {
  const expected = (env.LICENSE_ADMIN_TOKEN || "").trim();
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  const token = m ? m[1].trim() : "";
  if (!expected || !token || !timingSafeEqual(token, expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

async function recStatus(env: Env, rec: VendorRecord): Promise<"active" | "revoked"> {
  const raw = await env.LICENSE_KV.get(`key:${await sha256B64url(rec.key)}`);
  if (!raw) return "active";
  try {
    return (JSON.parse(raw) as KvEntry).status === "revoked" ? "revoked" : "active";
  } catch {
    return "active";
  }
}

async function handleIssue(req: Request, env: Env): Promise<Response> {
  const guard = requireAdmin(req, env);
  if (guard) return guard;

  let body: { deviceId?: unknown; plan?: unknown; customer?: unknown; reissue?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const plan = body.plan === "pro" ? "pro" : "home";
  const customer = typeof body.customer === "string" ? body.customer.trim() : "";
  const reissue = body.reissue === true;
  if (!deviceId) return json({ error: "deviceId_required" }, 400);

  // Idempotent: re-scanning a device returns its existing key instead of
  // minting a duplicate — unless the caller explicitly asks to reissue.
  const existingRaw = await env.LICENSE_KV.get(`rec:${deviceId}`);
  if (existingRaw && !reissue) {
    const rec = JSON.parse(existingRaw) as VendorRecord;
    return json({ ...rec, status: await recStatus(env, rec), reused: true });
  }

  const { key, issuedAt } = await mintKey(env, deviceId, plan);
  const rec: VendorRecord = { deviceId, plan, customer, key, issuedAt };
  await env.LICENSE_KV.put(`rec:${deviceId}`, JSON.stringify(rec));
  return json({ ...rec, status: "active", reused: false });
}

async function handleLookup(req: Request, env: Env): Promise<Response> {
  const guard = requireAdmin(req, env);
  if (guard) return guard;

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  if (deviceId) {
    const raw = await env.LICENSE_KV.get(`rec:${deviceId.trim()}`);
    if (!raw) return json({ records: [] });
    const rec = JSON.parse(raw) as VendorRecord;
    return json({ records: [{ ...rec, status: await recStatus(env, rec) }] });
  }

  const q = (url.searchParams.get("q") || "").toLowerCase().trim();
  const list = await env.LICENSE_KV.list({ prefix: "rec:", limit: 1000 });
  const records: (VendorRecord & { status: string })[] = [];
  for (const k of list.keys) {
    const raw = await env.LICENSE_KV.get(k.name);
    if (!raw) continue;
    const rec = JSON.parse(raw) as VendorRecord;
    if (
      !q ||
      rec.deviceId.toLowerCase().includes(q) ||
      (rec.customer || "").toLowerCase().includes(q)
    ) {
      records.push({ ...rec, status: await recStatus(env, rec) });
    }
  }
  records.sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  return json({ records });
}

async function handleRevoke(req: Request, env: Env, revoke: boolean): Promise<Response> {
  const guard = requireAdmin(req, env);
  if (guard) return guard;

  let body: { deviceId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) return json({ error: "deviceId_required" }, 400);

  const raw = await env.LICENSE_KV.get(`rec:${deviceId}`);
  if (!raw) return json({ error: "not_found" }, 404);
  const rec = JSON.parse(raw) as VendorRecord;
  const kvKey = `key:${await sha256B64url(rec.key)}`;
  if (revoke) await env.LICENSE_KV.put(kvKey, JSON.stringify({ status: "revoked" }));
  else await env.LICENSE_KV.delete(kvKey);
  return json({ ok: true, deviceId, status: revoke ? "revoked" : "active" });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/license/checkin") return handleCheckin(req, env);
    if (req.method === "POST" && url.pathname === "/license/issue") return handleIssue(req, env);
    if (req.method === "GET" && url.pathname === "/license/lookup") return handleLookup(req, env);
    if (req.method === "POST" && url.pathname === "/license/revoke") return handleRevoke(req, env, true);
    if (req.method === "POST" && url.pathname === "/license/restore") return handleRevoke(req, env, false);
    if (req.method === "GET" && url.pathname === "/admin") {
      return new Response(ADMIN_HTML, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (url.pathname === "/health") return json({ ok: true });
    return json({ error: "not_found" }, 404);
  },
};

// Self-contained vendor console served at /admin. All API calls carry the admin
// token (kept in localStorage) as a Bearer header; the page itself is just a
// form and is useless without the token.
const ADMIN_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FamilyBoard · Lizenzen</title>
<style>
  :root{--bg:#0f1115;--surface:#1a1d24;--ink:#e8eaed;--muted:#9aa0a6;--border:#2a2e37;--accent:#ff7a59;--ok:#34c759;--bad:#ff453a}
  @media(prefers-color-scheme:light){:root{--bg:#f5f6f8;--surface:#fff;--ink:#1a1d24;--muted:#5f6368;--border:#e0e2e7}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,sans-serif}
  .wrap{max-width:1000px;margin:0 auto;padding:24px}
  h1{font-size:20px;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 20px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:18px}
  label{display:block;font-size:12px;color:var(--muted);margin:10px 0 4px}
  input,select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--ink);font-size:14px}
  .row{display:flex;gap:12px;flex-wrap:wrap}.row>div{flex:1;min-width:180px}
  button{margin-top:14px;padding:10px 16px;border:0;border-radius:9px;background:var(--accent);color:#fff;font-weight:600;cursor:pointer;font-size:14px}
  button.ghost{background:transparent;border:1px solid var(--border);color:var(--ink);margin:0}
  button.mini{margin:0;padding:5px 10px;font-size:12px;font-weight:500}
  .muted{color:var(--muted)}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all}
  table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}
  th{color:var(--muted);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .pill.active{background:color-mix(in srgb,var(--ok) 20%,transparent);color:var(--ok)}
  .pill.revoked{background:color-mix(in srgb,var(--bad) 20%,transparent);color:var(--bad)}
  .keybox{background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px;margin-top:12px;display:none}
  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:10px;font-size:13px;opacity:0;transition:.2s;pointer-events:none}
  .toast.show{opacity:1}
</style></head><body><div class="wrap">
  <h1>FamilyBoard · Lizenz-Verwaltung</h1>
  <p class="sub">Gerät zusammenbauen → deviceId per <span class="mono">GET /api/license</span> auslesen → hier Key erzeugen.</p>

  <div class="card" id="tokCard">
    <label>Admin-Token</label>
    <input id="tok" type="password" placeholder="LICENSE_ADMIN_TOKEN" autocomplete="off">
    <button onclick="saveTok()">Merken</button>
    <button class="ghost" style="margin-left:8px" onclick="clearTok()">Löschen</button>
  </div>

  <div class="card">
    <strong>Neuen Key erzeugen</strong>
    <div class="row">
      <div><label>deviceId (Pi-Seriennummer)</label><input id="dev" placeholder="z.B. 100000001a2b3c4d"></div>
      <div><label>Kunde</label><input id="cust" placeholder="Name / Auftrag / E-Mail"></div>
      <div style="max-width:140px"><label>Plan</label><select id="plan"><option value="home">home</option><option value="pro">pro</option></select></div>
    </div>
    <label style="margin-top:12px"><input type="checkbox" id="reissue" style="width:auto;margin-right:6px">Neu ausstellen (bestehenden Key überschreiben)</label>
    <button onclick="issue()">Key erzeugen</button>
    <div class="keybox" id="keybox"><div class="muted" style="font-size:12px;margin-bottom:6px" id="keymeta"></div><div class="mono" id="keyval"></div><button class="mini" style="margin-top:10px" onclick="copyKey()">Key kopieren</button></div>
  </div>

  <div class="card">
    <strong>Suchen / verlorenen Key wiederfinden</strong>
    <div class="row"><div><input id="q" placeholder="Kunde oder deviceId…" oninput="debounced()"></div></div>
    <table><thead><tr><th>Kunde</th><th>deviceId</th><th>Plan</th><th>Status</th><th>Ausgestellt</th><th>Key</th><th></th></tr></thead><tbody id="rows"><tr><td colspan="7" class="muted">—</td></tr></tbody></table>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
const $=id=>document.getElementById(id);
let TOK=localStorage.getItem("fb_lic_tok")||"";
if(TOK){$("tok").value=TOK}
function saveTok(){TOK=$("tok").value.trim();localStorage.setItem("fb_lic_tok",TOK);toast("Token gemerkt");load()}
function clearTok(){TOK="";localStorage.removeItem("fb_lic_tok");$("tok").value="";toast("Token gelöscht")}
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
async function api(path,opts){const o=opts||{};o.headers=Object.assign({"content-type":"application/json","authorization":"Bearer "+TOK},o.headers||{});const r=await fetch(path,o);const d=await r.json().catch(()=>({}));if(r.status===401){toast("Token ungültig")}else if(!r.ok&&d.error){toast("Fehler: "+d.error)}return{ok:r.ok,d}}
let lastKey="";
async function issue(){
  const deviceId=$("dev").value.trim();if(!deviceId){toast("deviceId fehlt");return}
  const {ok,d}=await api("/license/issue",{method:"POST",body:JSON.stringify({deviceId,customer:$("cust").value.trim(),plan:$("plan").value,reissue:$("reissue").checked})});
  if(!ok)return;lastKey=d.key;$("keybox").style.display="block";
  $("keymeta").textContent=(d.reused?"Bereits vorhanden — ":"Neu erzeugt — ")+d.plan+" · "+d.deviceId+" · "+new Date(d.issuedAt).toLocaleString();
  $("keyval").textContent=d.key;toast(d.reused?"Bestehender Key":"Key erzeugt");load()
}
function copyKey(){navigator.clipboard.writeText(lastKey).then(()=>toast("Key kopiert"))}
let t;function debounced(){clearTimeout(t);t=setTimeout(load,250)}
async function load(){
  if(!TOK)return;
  const q=$("q").value.trim();
  const {ok,d}=await api("/license/lookup"+(q?"?q="+encodeURIComponent(q):""),{method:"GET"});
  if(!ok)return;const rows=$("rows");
  if(!d.records||!d.records.length){rows.innerHTML='<tr><td colspan="7" class="muted">Keine Einträge</td></tr>';return}
  rows.innerHTML=d.records.map(r=>{
    const st=r.status==="revoked"?'<span class="pill revoked">gesperrt</span>':'<span class="pill active">aktiv</span>';
    const act=r.status==="revoked"?'<button class="mini ghost" data-restore="'+enc(r.deviceId)+'">Entsperren</button>':'<button class="mini ghost" data-revoke="'+enc(r.deviceId)+'">Sperren</button>';
    return '<tr><td>'+esc(r.customer||"—")+'</td><td class="mono">'+esc(r.deviceId)+'</td><td>'+esc(r.plan)+'</td><td>'+st+'</td><td class="muted">'+new Date(r.issuedAt).toLocaleDateString()+'</td><td><button class="mini ghost" data-key="'+enc(r.key)+'">Kopieren</button></td><td>'+act+'</td></tr>'
  }).join("");
  rows.querySelectorAll("[data-key]").forEach(b=>b.onclick=()=>navigator.clipboard.writeText(dec(b.dataset.key)).then(()=>toast("Key kopiert")));
  rows.querySelectorAll("[data-revoke]").forEach(b=>b.onclick=()=>revoke(dec(b.dataset.revoke)));
  rows.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>restore(dec(b.dataset.restore)));
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function enc(s){return encodeURIComponent(s)}
function dec(s){return decodeURIComponent(s)}
async function revoke(deviceId){if(!confirm("Key für "+deviceId+" sperren? Das Gerät verliert nach Ablauf der Lease den Zugriff."))return;await api("/license/revoke",{method:"POST",body:JSON.stringify({deviceId})});toast("Gesperrt");load()}
async function restore(deviceId){await api("/license/restore",{method:"POST",body:JSON.stringify({deviceId})});toast("Entsperrt");load()}
load();
</script></body></html>`;
