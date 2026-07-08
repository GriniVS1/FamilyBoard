// FamilyBoard relay — Cloudflare Worker + Durable Object on relay.familyboard.ch.
//
// Lets the phone reach the wall's mobile API from outside the home LAN without
// port forwarding: the Pi opens an OUTBOUND WebSocket to its per-installation
// Durable Object (`GET /connect`), and the phone's HTTPS requests
// (`/f/<installationId>/api/mobile/...`) are forwarded through that tunnel as
// JSON frames. End-to-end auth stays the existing bearer token — the Pi
// validates it; this relay is transport only. See docs in the main repo.
//
// Cost model: WebSocket Hibernation API + setWebSocketAutoResponse for
// heartbeats, so idle devices keep the DO asleep.

import { isAllowedRemotePath } from "./whitelist";

export interface Env {
  TUNNEL: DurableObjectNamespace;
}

const MAX_REQUEST_BODY = 1 * 1024 * 1024; // bytes
const MAX_RESPONSE_B64 = 5_700_000; // ~4 MB raw as base64
const MAX_IN_FLIGHT = 32;
const FORWARD_TIMEOUT_MS = 30_000;
const DEVICE_RATE_PER_MIN = 120;
const IP_RATE_PER_MIN = 300;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64encode(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Header allow-lists — never forward cookies, host, or x-forwarded chains.
const REQ_HEADERS = ["authorization", "content-type", "accept-language"] as const;
const RES_HEADERS = ["content-type"] as const;

type ReqFrame = {
  t: "req";
  id: string;
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  body?: string;
};

type ResFrame =
  | { t: "res"; id: string; status: number; headers?: Record<string, string>; body?: string }
  | { t: "err"; id: string; code: string };

// Coarse per-IP limiter (per isolate — resets on isolate recycle; the WAF rule
// on the zone is the durable backstop).
const ipBuckets = new Map<string, { windowStart: number; count: number }>();
function ipAllowed(ip: string): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || now - b.windowStart > 60_000) {
    ipBuckets.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= IP_RATE_PER_MIN;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";

    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/connect") {
      if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "expected_websocket" }, 426);
      }
      const installationId = req.headers.get("x-fb-installation");
      if (!installationId || !/^[a-z0-9-]{10,64}$/i.test(installationId)) {
        return json({ error: "installation_required" }, 400);
      }
      const stub = env.TUNNEL.get(env.TUNNEL.idFromName(installationId));
      return stub.fetch(req);
    }

    // Phone data plane: /f/<installationId>/<path...>
    const m = url.pathname.match(/^\/f\/([a-z0-9-]{10,64})(\/.*)$/i);
    if (m) {
      if (!ipAllowed(ip)) return json({ error: "rate_limited" }, 429);
      const [, installationId, path] = m;
      if (!isAllowedRemotePath(req.method, path)) {
        return json({ error: "path_not_allowed" }, 403);
      }
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_REQUEST_BODY) return json({ error: "body_too_large" }, 413);

      const headers = new Headers();
      for (const h of REQ_HEADERS) {
        const v = req.headers.get(h);
        if (v) headers.set(h, v);
      }
      const stub = env.TUNNEL.get(env.TUNNEL.idFromName(installationId));
      return stub.fetch(
        new Request(`https://tunnel${path}${url.search}`, {
          method: req.method,
          headers,
          body: req.body,
        }),
      );
    }

    const s = url.pathname.match(/^\/status\/([a-z0-9-]{10,64})$/i);
    if (s) {
      if (!ipAllowed(ip)) return json({ error: "rate_limited" }, 429);
      const stub = env.TUNNEL.get(env.TUNNEL.idFromName(s[1]));
      return stub.fetch(new Request("https://tunnel/__status", { method: "GET" }));
    }

    return json({ error: "not_found" }, 404);
  },
};

export class TunnelDO implements DurableObject {
  private pending = new Map<
    string,
    { resolve: (r: Response) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private rate = { windowStart: 0, count: 0 };

  constructor(private ctx: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return this.handleConnect(req);
    }
    if (url.pathname === "/__status") {
      return json({ online: this.ctx.getWebSockets().length > 0 });
    }
    return this.handleForward(req, url);
  }

  private async handleConnect(req: Request): Promise<Response> {
    const secret = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!secret || secret.length < 32) return json({ error: "secret_required" }, 400);

    // Trust on first use: the first device to connect for this installationId
    // pins its secret hash; every later connect must present the same secret.
    // The wall only publishes its relay URL AFTER a successful connect, so the
    // id never leaves the LAN before the pin exists.
    const hash = await sha256hex(secret);
    const pinned = await this.ctx.storage.get<string>("secretHash");
    if (pinned === undefined) {
      await this.ctx.storage.put("secretHash", hash);
    } else if (pinned !== hash) {
      return json({ error: "forbidden" }, 403);
    }

    // One Pi per installation — replace any previous socket.
    for (const ws of this.ctx.getWebSockets()) ws.close(1012, "replaced");

    const pair = new WebSocketPair();
    // Hibernation API: idle connections keep the DO asleep (cost model). The
    // Pi disables permessage-deflate — Workers WebSockets don't support it.
    this.ctx.acceptWebSocket(pair[1]);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private async handleForward(req: Request, url: URL): Promise<Response> {
    const sockets = this.ctx.getWebSockets();
    const socket = sockets[0];
    if (!socket) return json({ error: "device_offline" }, 503);
    if (this.pending.size >= MAX_IN_FLIGHT) return json({ error: "busy" }, 429);

    const now = Date.now();
    if (now - this.rate.windowStart > 60_000) {
      this.rate = { windowStart: now, count: 0 };
    }
    if (++this.rate.count > DEVICE_RATE_PER_MIN) return json({ error: "rate_limited" }, 429);

    let body: string | undefined;
    if (req.body) {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > MAX_REQUEST_BODY) return json({ error: "body_too_large" }, 413);
      if (buf.byteLength > 0) body = b64encode(buf);
    }

    const headers: Record<string, string> = {};
    for (const h of REQ_HEADERS) {
      const v = req.headers.get(h);
      if (v) headers[h] = v;
    }

    const frame: ReqFrame = {
      t: "req",
      id: crypto.randomUUID(),
      method: req.method,
      path: url.pathname,
      query: url.search.replace(/^\?/, ""),
      headers,
      ...(body !== undefined ? { body } : {}),
    };
    socket.send(JSON.stringify(frame));

    return await new Promise<Response>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(frame.id);
        resolve(json({ error: "gateway_timeout" }, 504));
      }, FORWARD_TIMEOUT_MS);
      this.pending.set(frame.id, { resolve, timer });
    });
  }

  webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    let frame: ResFrame | { t: string };
    try {
      frame = JSON.parse(message) as ResFrame;
    } catch {
      return;
    }
    if (frame.t !== "res" && frame.t !== "err") return; // hello etc.

    const f = frame as ResFrame;
    const p = this.pending.get(f.id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(f.id);

    if (f.t === "err") {
      p.resolve(json({ error: f.code }, 502));
      return;
    }
    if (f.body && f.body.length > MAX_RESPONSE_B64) {
      p.resolve(json({ error: "response_too_large" }, 502));
      return;
    }
    const headers = new Headers({ "cache-control": "no-store" });
    for (const h of RES_HEADERS) {
      const v = f.headers?.[h];
      if (v) headers.set(h, v);
    }
    p.resolve(
      new Response(f.body ? b64decode(f.body) : null, { status: f.status, headers }),
    );
  }

  webSocketClose(): void {
    this.failAllPending();
  }

  webSocketError(): void {
    this.failAllPending();
  }

  private failAllPending(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve(json({ error: "device_disconnected" }, 502));
    }
    this.pending.clear();
  }
}
