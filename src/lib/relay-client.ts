import "server-only";

import WebSocket from "ws";
import { isAllowedRemotePath } from "./relay-whitelist";

// Pi-side tunnel client: holds an outbound WebSocket to the relay Worker's
// per-installation Durable Object and executes forwarded phone requests against
// the local server. Started from instrumentation.ts. Keeps that module's
// discipline: no DB/Prisma imports here — credentials and status flow through
// loopback fetch to internal API routes. See relay/src/index.ts for the peer.

type StartOptions = {
  baseUrl: string; // loopback, e.g. http://127.0.0.1:3000
  internalHeaders: () => Record<string, string>;
};

type Credentials = {
  installationId: string;
  deviceSecret: string;
  enabled: boolean;
  relayUrl: string;
};

const HEARTBEAT_MS = 30_000;
const CREDENTIAL_POLL_MS = 60_000;
const MAX_REQUEST_BODY = 1 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const FORWARD_TIMEOUT_MS = 25_000;
const REQ_HEADERS = ["authorization", "content-type", "accept-language"];
const RES_HEADERS = ["content-type"];

let started = false;

export function startRelayClient(opts: StartOptions): void {
  if (started) return;
  started = true;
  void runForever(opts);
}

async function runForever(opts: StartOptions): Promise<void> {
  let backoff = 1_000;
  for (;;) {
    let creds: Credentials | null = null;
    try {
      creds = await fetchCredentials(opts);
    } catch {
      // ignore — retry below
    }
    if (!creds || !creds.enabled || !creds.installationId) {
      await sleep(CREDENTIAL_POLL_MS);
      continue;
    }
    try {
      await connectOnce(opts, creds);
      backoff = 1_000; // clean close (e.g. disabled) → poll again promptly
    } catch {
      await sleep(backoff + Math.floor(Math.random() * 1_000));
      backoff = Math.min(backoff * 2, 60_000);
      continue;
    }
    await sleep(CREDENTIAL_POLL_MS);
  }
}

async function fetchCredentials(opts: StartOptions): Promise<Credentials> {
  const res = await fetch(`${opts.baseUrl}/api/network/relay-credentials`, {
    headers: opts.internalHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`credentials ${res.status}`);
  return (await res.json()) as Credentials;
}

async function reportStatus(
  opts: StartOptions,
  body: { connected: boolean; lastError?: string | null },
): Promise<void> {
  try {
    await fetch(`${opts.baseUrl}/api/network/relay-status`, {
      method: "POST",
      headers: { ...opts.internalHeaders(), "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // best-effort
  }
}

function connectOnce(opts: StartOptions, creds: Credentials): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const wsUrl = creds.relayUrl.replace(/\/+$/, "") + "/connect";
    const ws = new WebSocket(wsUrl, {
      // Cloudflare Workers WebSockets don't support permessage-deflate; the ws
      // client negotiates it by default and the server then rejects the
      // compressed frames (1002 "Invalid compressed data"). Disable it.
      perMessageDeflate: false,
      headers: {
        "x-fb-installation": creds.installationId,
        authorization: `Bearer ${creds.deviceSecret}`,
      },
    });

    let alive = true;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let pongMisses = 0;

    const done = (err?: Error) => {
      if (!alive) return;
      alive = false;
      if (heartbeat) clearInterval(heartbeat);
      try {
        ws.close();
      } catch {
        // ignore
      }
      void reportStatus(opts, { connected: false, lastError: err?.message ?? null });
      if (err) reject(err);
      else resolve();
    };

    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", proto: 1 }));
      void reportStatus(opts, { connected: true, lastError: null });
      heartbeat = setInterval(() => {
        if (pongMisses >= 2) {
          done(new Error("heartbeat lost"));
          return;
        }
        pongMisses += 1;
        try {
          ws.send("ping");
        } catch {
          done(new Error("send failed"));
        }
      }, HEARTBEAT_MS);
    });

    ws.on("message", (data) => {
      const text = data.toString();
      if (text === "pong") {
        pongMisses = 0;
        return;
      }
      void handleFrame(opts, ws, text);
    });

    ws.on("close", () => done());
    ws.on("error", (err) => done(err instanceof Error ? err : new Error(String(err))));
  });
}

async function handleFrame(opts: StartOptions, ws: WebSocket, text: string): Promise<void> {
  let frame: {
    t?: string;
    id?: string;
    method?: string;
    path?: string;
    query?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  try {
    frame = JSON.parse(text);
  } catch {
    return;
  }
  if (frame.t !== "req" || !frame.id || !frame.method || !frame.path) return;
  const id = frame.id;

  // Defense in depth — the relay already enforced this, we enforce it again.
  if (!isAllowedRemotePath(frame.method, frame.path)) {
    ws.send(JSON.stringify({ t: "err", id, code: "path_not_allowed" }));
    return;
  }

  const bodyBuf =
    frame.body !== undefined ? Buffer.from(frame.body, "base64") : undefined;
  if (bodyBuf && bodyBuf.byteLength > MAX_REQUEST_BODY) {
    ws.send(JSON.stringify({ t: "err", id, code: "too_large" }));
    return;
  }

  const headers: Record<string, string> = { "x-familyboard-relay": "1" };
  for (const h of REQ_HEADERS) {
    const v = frame.headers?.[h];
    if (v) headers[h] = v;
  }

  const url = `${opts.baseUrl}${frame.path}${frame.query ? `?${frame.query}` : ""}`;
  try {
    const res = await fetch(url, {
      method: frame.method,
      headers,
      body: bodyBuf,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      ws.send(JSON.stringify({ t: "err", id, code: "too_large" }));
      return;
    }
    const resHeaders: Record<string, string> = {};
    for (const h of RES_HEADERS) {
      const v = res.headers.get(h);
      if (v) resHeaders[h] = v;
    }
    ws.send(
      JSON.stringify({
        t: "res",
        id,
        status: res.status,
        headers: resHeaders,
        ...(buf.byteLength > 0 ? { body: buf.toString("base64") } : {}),
      }),
    );
  } catch (err) {
    const code =
      err instanceof Error && err.name === "TimeoutError" ? "timeout" : "internal";
    ws.send(JSON.stringify({ t: "err", id, code }));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
