// Session storage + bearer-authenticated fetch wrapper for the relay's
// mobile-parity API surface (`/f/<installationId>/api/mobile/*`).

const SESSION_KEY = "fb.session";
const LOCALE_KEY = "fb.locale";

/** @typedef {{ installationId: string, token: string, familyName: string, memberName: string, memberColor: string, memberEmoji: string | null }} Session */

/** @returns {Session | null} */
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== "string" || typeof parsed.installationId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Session} session */
export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadLocale() {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

export function saveLocale(locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // ignore — locale just won't persist
  }
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * A 401 anywhere means the device token is gone (revoked/expired) — clear the
 * session and let the caller redirect to pairing. Called from the router, not
 * here, so this module stays free of navigation concerns.
 */
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function baseUrl(installationId) {
  return `${location.origin}/f/${installationId}`;
}

/**
 * @param {string} path e.g. "/api/mobile/todos"
 * @param {{ method?: string, body?: unknown, session?: Session | null }} [opts]
 */
export async function apiFetch(path, opts = {}) {
  const session = opts.session !== undefined ? opts.session : loadSession();
  if (!session) throw new ApiError("Not paired", 401, "NO_SESSION");

  const headers = { Authorization: `Bearer ${session.token}` };
  let body;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res;
  try {
    res = await fetch(`${baseUrl(session.installationId)}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body,
    });
  } catch {
    throw new ApiError("Network error", 0, "NETWORK_ERROR");
  }

  if (res.status === 401) {
    clearSession();
    onUnauthorized();
    throw new ApiError("Session expired", 401, "UNAUTHORIZED");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code;
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
      code = data?.error?.code;
    } catch {
      // body wasn't JSON — keep the generic message
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Unauthenticated pairing call — no session exists yet. */
export async function pairDevice(installationId, code, name) {
  const headers = { "Content-Type": "application/json" };
  let res;
  try {
    res = await fetch(`${baseUrl(installationId)}/api/devices/pair`, {
      method: "POST",
      headers,
      body: JSON.stringify({ code, name, platform: "web" }),
    });
  } catch {
    throw new ApiError("Network error", 0, "NETWORK_ERROR");
  }

  if (!res.ok) {
    let message = `Pairing failed (${res.status})`;
    let code2;
    try {
      const data = await res.json();
      if (data?.error?.message) message = data.error.message;
      code2 = data?.error?.code;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status, code2);
  }

  return res.json();
}
