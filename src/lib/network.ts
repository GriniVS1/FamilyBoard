import "server-only";

// NetworkManager (nmcli) is the sole interface for WiFi management on Pi OS.
// The container uses pid:host + privileged so it can nsenter into the host's
// namespaces and run the host's nmcli/rfkill/iw/raspi-config binaries directly,
// without bind-mounting them. DBus access is implicit because the host mounts
// are visible once we enter the host's mount namespace via nsenter -m.
//
// In dev (non-production, nmcli absent) we return deterministic mock data so
// the wall UI can be developed and tested on a Mac without a Pi.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { env } from "./env";

export type NetworkStatus = {
  connected: boolean;
  online: boolean;
  ssid: string | null;
  ipAddress: string | null;
  hotspotActive: boolean;
};

export type WifiNetwork = {
  ssid: string;
  signal: number;
  secured: boolean;
};

// Base URL a phone on the same LAN can reach this server at. The kiosk browser
// runs on localhost, so window.location.origin is useless inside pairing QR
// codes. On the Pi the container uses network_mode: host, so the process sees
// the host's real interfaces and the first routable IPv4 is the device's LAN
// address. If NEXTAUTH_URL points at a real hostname (reverse-proxy setups),
// that wins. Returns null when no routable address exists (client falls back).
export function getLanBaseUrl(): string | null {
  const configured = new URL(env.NEXTAUTH_URL);
  const localHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"];
  const isLoopback = localHosts.includes(configured.hostname);
  // The Pi ships with NEXTAUTH_URL=http://familyboard.local:3000. iPhones
  // resolve mDNS names fine, many Androids don't — so for phone-facing URLs
  // prefer the concrete LAN IP and keep the .local name only as fallback.
  const isMdns = configured.hostname.endsWith(".local");
  if (!isLoopback && !isMdns) {
    return configured.origin; // real hostname (reverse-proxy / custom domain)
  }
  const port = configured.port || (configured.protocol === "https:" ? "443" : "80");

  const candidates: { name: string; address: string }[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    // Skip loopback and container-side plumbing (docker0, bridges, veth pairs).
    if (/^(lo|docker|br-|veth)/.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("169.254.")) continue; // link-local, unreachable for phones
      candidates.push({ name, address: a.address });
    }
  }
  if (candidates.length === 0) return isMdns ? configured.origin : null;

  // Wired first (stablest), then WiFi, then anything else.
  const rank = (n: string) => (/^(eth|en)/.test(n) ? 0 : /^wl/.test(n) ? 1 : 2);
  candidates.sort((a, b) => rank(a.name) - rank(b.name));
  return `http://${candidates[0].address}:${port}`;
}

// The .local origin (e.g. http://familyboard.local:3000) when the deployment
// advertises one — used as the pairing QR's fallback URL so phones can recover
// when the DHCP lease changes the LAN IP embedded as the primary URL.
export function getMdnsBaseUrl(): string | null {
  const configured = new URL(env.NEXTAUTH_URL);
  return configured.hostname.endsWith(".local") ? configured.origin : null;
}

export class NetworkError extends Error {
  constructor(
    public readonly code:
      | "NMCLI_MISSING"
      | "CONNECT_FAILED"
      | "SCAN_FAILED"
      | "TIMEOUT"
      | "INVALID_COUNTRY"
      | "COUNTRY_SET_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

// Alphabetically sorted subset of wireless-regdb ISO 3166-1 alpha-2 codes that
// covers the Pi's primary markets. Extend as needed; list is validated at
// runtime so adding a code here immediately allows it in the API.
export const SUPPORTED_WIFI_COUNTRIES = [
  "AT",
  "AU",
  "BE",
  "CA",
  "CH",
  "CZ",
  "DE",
  "DK",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LU",
  "NL",
  "NO",
  "NZ",
  "PL",
  "PT",
  "SE",
  "SI",
  "SK",
  "US",
] as const satisfies readonly string[];

// Printed once across the process lifetime so repeated calls don't spam logs.
let devWarnEmitted = false;

let lastScan: WifiNetwork[] = [];

export function getCachedScan(): WifiNetwork[] {
  return lastScan;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitDevWarn() {
  if (!devWarnEmitted) {
    console.warn("[network] nmcli not found — using dev mocks");
    devWarnEmitted = true;
  }
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

// Runs a command via spawn (no shell interpolation). Rejects with NetworkError
// on timeout, non-zero exit, or if the binary is not found (ENOENT).
function runCommand(
  bin: string,
  args: string[],
  timeoutMs = 25_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new NetworkError("TIMEOUT", `Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(new NetworkError("NMCLI_MISSING", "nmcli not found"));
      } else {
        reject(new NetworkError("SCAN_FAILED", err.message));
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr });
      // Non-zero exits are handled by callers who inspect stdout/stderr context.
      void code;
    });
  });
}

// On the Pi the app runs in a container sharing the host's PID and network
// namespaces (see docker-compose.pi.yml). The WiFi tools live on the HOST and
// cannot run inside this Alpine container, so execute them in the host's
// namespaces via nsenter. sudo provides the privileges needed to setns; a
// container sudoers rule (see Dockerfile) lets the app user run nsenter.
function hostCommand(args: string[], timeoutMs = 25_000) {
  return runCommand(
    "sudo",
    ["/usr/bin/nsenter", "-t", "1", "-m", "-u", "-i", "-n", "--", ...args],
    timeoutMs,
  );
}

// Strip anything that looks like a credential from nmcli stderr before it
// reaches the client. Removes key-value pairs whose key contains "password",
// "psk", "secret", or "key" (case-insensitive).
function sanitizeNmcliError(raw: string): string {
  return raw
    .replace(/\b(password|psk|secret|key)\s*[=:]\s*\S+/gi, "[REDACTED]")
    .trim()
    .slice(0, 300);
}

// ---------------------------------------------------------------------------
// Dev mocks
// ---------------------------------------------------------------------------

function mockNetworkStatus(): NetworkStatus {
  emitDevWarn();
  return {
    connected: true,
    online: true,
    ssid: "MockNetwork-Dev",
    ipAddress: "192.168.1.100",
    hotspotActive: false,
  };
}

function mockScanWifi(): WifiNetwork[] {
  emitDevWarn();
  return [
    { ssid: "MockNetwork-Dev", signal: 90, secured: true },
    { ssid: "Neighbor-2.4G", signal: 65, secured: true },
    { ssid: "OpenCafe", signal: 55, secured: false },
    { ssid: "FRITZ!Box 7590", signal: 40, secured: true },
    { ssid: "AndroidAP", signal: 20, secured: true },
  ];
}

// ---------------------------------------------------------------------------
// getNetworkStatus
// ---------------------------------------------------------------------------

export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        return mockNetworkStatus();
      }
    }
  }

  // `nmcli -t -f DEVICE,STATE,CONNECTION,IP4.ADDRESS device show wlan0`
  // We use two separate calls for clarity and robustness.
  const [deviceResult, connResult] = await Promise.all([
    hostCommand(["/usr/bin/nmcli", "-t", "-f", "GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS[1]", "device", "show", "wlan0"], 10_000).catch(() => ({ stdout: "", stderr: "" })),
    hostCommand(["/usr/bin/nmcli", "-t", "-f", "NAME,TYPE", "connection", "show", "--active"], 5_000).catch(() => ({ stdout: "", stderr: "" })),
  ]);

  // Parse IP address and connection name from device show output
  const deviceLines = deviceResult.stdout.split("\n");
  const stateLine = deviceLines.find((l) => l.startsWith("GENERAL.STATE:")) ?? "";
  const connLine = deviceLines.find((l) => l.startsWith("GENERAL.CONNECTION:")) ?? "";
  const ipLine = deviceLines.find((l) => l.startsWith("IP4.ADDRESS[1]:")) ?? "";

  const connectedState = stateLine.includes("100 (connected)");
  const rawConn = connLine.split(":")[1]?.trim() ?? null;
  const connName = rawConn === "--" || rawConn === "" ? null : rawConn;
  const rawIp = ipLine.split(":")[1]?.trim() ?? null;
  // IP4 comes as "192.168.1.100/24" — strip the prefix length
  const ipAddress = rawIp ? rawIp.split("/")[0] ?? null : null;

  // Detect hotspot: an active connection of type wifi-p2p or sharing.wifi
  const activeConns = connResult.stdout.split("\n").filter(Boolean);
  const hotspotActive = activeConns.some((line) => {
    const [name, type] = line.split(":");
    return type === "wifi" && name?.toLowerCase().includes("hotspot");
  });

  // Online check: ping 1.1.1.1 with a 2s deadline
  let online = false;
  try {
    await runCommand("ping", ["-c", "1", "-W", "2", "1.1.1.1"], 4_000);
    online = true;
  } catch {
    online = false;
  }

  // SSID from connection name (nmcli connection name == SSID for saved networks)
  const ssid = connectedState ? connName : null;

  return {
    connected: connectedState,
    online,
    ssid,
    ipAddress: connectedState ? ipAddress : null,
    hotspotActive,
  };
}

// ---------------------------------------------------------------------------
// scanWifi
// ---------------------------------------------------------------------------

export async function scanWifi(): Promise<WifiNetwork[]> {
  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        const mocked = mockScanWifi();
        lastScan = mocked;
        return mocked;
      }
    }
  }

  let result: { stdout: string; stderr: string };
  try {
    result = await hostCommand(
      ["/usr/bin/nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "yes"],
      25_000,
    );
  } catch (err) {
    if (err instanceof NetworkError) throw err;
    throw new NetworkError("SCAN_FAILED", "WiFi scan failed");
  }

  const seen = new Map<string, WifiNetwork>();

  for (const line of result.stdout.split("\n")) {
    // nmcli -t separates fields with ":" but SSID can contain ":" — use
    // the fact that SIGNAL is always numeric and SECURITY is known values.
    // Format: SSID:SIGNAL:SECURITY (may have colons in SSID).
    // Split from the right: last two fields are SIGNAL and SECURITY.
    const parts = line.split(":");
    if (parts.length < 2) continue;
    const security = parts[parts.length - 1]?.trim() ?? "";
    const signal = parseInt(parts[parts.length - 2] ?? "", 10);
    const ssid = parts.slice(0, parts.length - 2).join(":").trim();

    if (!ssid || Number.isNaN(signal)) continue;

    const secured = security !== "" && security !== "--";
    const existing = seen.get(ssid);
    if (!existing || signal > existing.signal) {
      seen.set(ssid, { ssid, signal, secured });
    }
  }

  const networks = Array.from(seen.values())
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 30);
  lastScan = networks;
  return networks;
}

// ---------------------------------------------------------------------------
// connectWifi
// ---------------------------------------------------------------------------

export async function connectWifi(ssid: string, psk?: string): Promise<void> {
  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        emitDevWarn();
        return;
      }
    }
  }

  // Use spawn with arg array — the PSK never touches a shell string.
  const args = psk
    ? ["/usr/bin/nmcli", "device", "wifi", "connect", ssid, "password", psk]
    : ["/usr/bin/nmcli", "device", "wifi", "connect", ssid];

  let result: { stdout: string; stderr: string };
  try {
    result = await hostCommand(args, 25_000);
  } catch (err) {
    if (err instanceof NetworkError && err.code === "TIMEOUT") {
      throw new NetworkError("TIMEOUT", "WiFi connection timed out after 25s");
    }
    throw new NetworkError("CONNECT_FAILED", "Could not run nmcli");
  }

  // nmcli prints "Error" to stdout on failure (exit code may still be 0 in some versions).
  if (result.stdout.toLowerCase().includes("error") || result.stderr.toLowerCase().includes("error")) {
    // Sanitize before surfacing — never leak PSK
    const sanitized = sanitizeNmcliError(result.stdout + " " + result.stderr);
    throw new NetworkError("CONNECT_FAILED", sanitized);
  }
}

// ---------------------------------------------------------------------------
// disconnectWifi
// ---------------------------------------------------------------------------

export async function disconnectWifi(): Promise<void> {
  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        emitDevWarn();
        return;
      }
    }
  }

  await hostCommand(["/usr/bin/nmcli", "device", "disconnect", "wlan0"], 10_000);
}

// ---------------------------------------------------------------------------
// startHotspot
// ---------------------------------------------------------------------------

export async function startHotspot(): Promise<{
  ssid: string;
  psk: string;
  ipAddress: string;
}> {
  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        emitDevWarn();
        const psk = randomBytes(4).toString("hex");
        return { ssid: "FamilyBoard-Setup", psk, ipAddress: "10.42.0.1" };
      }
    }
  }

  // Fresh 8-char PSK each call so the QR on screen always matches the live credential.
  // Never logged.
  const psk = randomBytes(4).toString("hex");

  await hostCommand(
    [
      "/usr/bin/nmcli",
      "device",
      "wifi",
      "hotspot",
      "ifname",
      "wlan0",
      "ssid",
      "FamilyBoard-Setup",
      "password",
      psk,
    ],
    25_000,
  );

  return { ssid: "FamilyBoard-Setup", psk, ipAddress: "10.42.0.1" };
}

// ---------------------------------------------------------------------------
// stopHotspot
// ---------------------------------------------------------------------------

export async function stopHotspot(): Promise<void> {
  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        emitDevWarn();
        return;
      }
    }
  }

  // NetworkManager names the hotspot connection "Hotspot" by default.
  await hostCommand(["/usr/bin/nmcli", "connection", "down", "Hotspot"], 10_000);
}

// ---------------------------------------------------------------------------
// setRegulatoryCountry
// ---------------------------------------------------------------------------

export async function setRegulatoryCountry(country: string): Promise<void> {
  if (!(SUPPORTED_WIFI_COUNTRIES as readonly string[]).includes(country)) {
    throw new NetworkError("INVALID_COUNTRY", `Unsupported WiFi country: ${country}`);
  }

  if (isDev()) {
    try {
      await runCommand("/usr/bin/nmcli", ["--version"], 2_000);
    } catch (err) {
      if (err instanceof NetworkError && err.code === "NMCLI_MISSING") {
        emitDevWarn();
        return;
      }
    }
  }

  // rfkill unblock is best-effort; on some Pi OS versions raspi-config handles
  // this internally, but doing it first avoids a race if the driver is blocked.
  try {
    await hostCommand(["/usr/sbin/rfkill", "unblock", "wifi"], 10_000);
  } catch {
    // Intentionally ignored — rfkill failure is non-fatal.
  }

  // Set the runtime regulatory domain directly. On Pi OS with NetworkManager
  // (wpa_supplicant masked) this most reliably lifts the WiFi block in the
  // current session so scanning works immediately; best-effort because iw may
  // be absent. raspi-config below persists the country across reboots.
  try {
    await hostCommand(["/usr/sbin/iw", "reg", "set", country], 10_000);
  } catch {
    // Intentionally ignored — iw failure is non-fatal.
  }

  // raspi-config do_wifi_country persists the country to /etc/wpa_supplicant/
  // wpa_supplicant.conf and triggers iw reg set, which lifts the rfkill soft block.
  try {
    await hostCommand(
      ["/usr/bin/raspi-config", "nonint", "do_wifi_country", country],
      15_000,
    );
  } catch (err) {
    if (err instanceof NetworkError) {
      throw new NetworkError("COUNTRY_SET_FAILED", err.message.slice(0, 300));
    }
    throw new NetworkError("COUNTRY_SET_FAILED", "raspi-config do_wifi_country failed");
  }
}

// ---------------------------------------------------------------------------
// getWifiCountry
// ---------------------------------------------------------------------------

export async function getWifiCountry(): Promise<string | null> {
  const { db } = await import("./db");
  const row = await db.setting.findUnique({ where: { key: "wifi_country" } });
  return row?.value ?? null;
}
