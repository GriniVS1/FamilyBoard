import "server-only";

import { randomUUID, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "./db";
import { AppError } from "./api";
import { env } from "./env";
import type { LicenseStatus } from "./enums";

// Baked-in dev public key — generated once by `tool/sign-license.mjs keygen`.
// Only used when LICENSE_PUBLIC_KEY is absent from the environment.
// The corresponding private key is never committed; it lives in tool/.license-private.pem.
const DEV_PUBLIC_KEY_B64 =
  "MCowBQYDK2VwAyEAYbWcFQdKpFWrGHT6uANzQ5k6/L4mZQv1wJGSdE3Mkik=";

export type LicenseGate = "active" | "grace" | "soft" | "hard";

export type LicenseSnapshot = {
  status: LicenseStatus;
  gate: LicenseGate;
  plan: string | null;
  validUntil: Date | null;
  isActive: boolean;
  deviceId: string;
  graceEndsAt: Date | null;
  softEndsAt: Date | null;
};

type VerifyResult =
  | { valid: true; plan: string; validUntil: Date | null }
  | { valid: false; reason: string };

type LeaseVerifyResult =
  | { valid: true; plan: string; leaseUntil: Date }
  | { valid: false; reason: string };

let _deviceIdCache: string | undefined;

async function readPiSerial(): Promise<string | null> {
  for (const path of [
    "/proc/cpuinfo",
    "/sys/firmware/devicetree/base/serial-number",
  ]) {
    try {
      const text = await readFile(path, "utf-8");
      if (path === "/proc/cpuinfo") {
        const match = /^Serial\s*:\s*([0-9a-fA-F]+)\s*$/m.exec(text);
        if (match && match[1] && match[1] !== "0000000000000000") {
          return match[1].toLowerCase();
        }
      } else {
        // Strip NUL bytes and whitespace
        const serial = text.replace(/\0/g, "").trim();
        if (serial.length > 0) return serial;
      }
    } catch {
      // file not present — try next
    }
  }
  return null;
}

async function getOrCreatePersistedDeviceId(): Promise<string> {
  const existing = await db.setting.findUnique({ where: { key: "device_id" } });
  if (existing) return existing.value;
  const id = randomUUID();
  await db.setting.upsert({
    where: { key: "device_id" },
    create: { key: "device_id", value: id },
    update: {},
  });
  return id;
}

export async function getDeviceId(): Promise<string> {
  if (_deviceIdCache !== undefined) return _deviceIdCache;
  const serial = await readPiSerial();
  if (serial) {
    _deviceIdCache = serial;
    return serial;
  }
  const persisted = await getOrCreatePersistedDeviceId();
  _deviceIdCache = persisted;
  return persisted;
}

function getPublicKeyObject(): ReturnType<typeof createPublicKey> {
  const b64 =
    (process.env.LICENSE_PUBLIC_KEY ?? "").trim() || DEV_PUBLIC_KEY_B64;
  const der = Buffer.from(b64, "base64");
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

export function verifyLicenseKey(key: string, deviceId: string): VerifyResult {
  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== "FB1") {
    return { valid: false, reason: "MALFORMED" };
  }

  const [, payloadB64, sigB64] = parts as [string, string, string];

  let payload: { v: number; deviceId: string; plan: string; issuedAt: string; validUntil?: string };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as typeof payload;
  } catch {
    return { valid: false, reason: "MALFORMED" };
  }

  if (
    typeof payload !== "object" ||
    payload.v !== 1 ||
    typeof payload.deviceId !== "string" ||
    typeof payload.plan !== "string" ||
    typeof payload.issuedAt !== "string"
  ) {
    return { valid: false, reason: "MALFORMED" };
  }

  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sigB64, "base64url");
  } catch {
    return { valid: false, reason: "MALFORMED" };
  }

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = getPublicKeyObject();
  } catch {
    return { valid: false, reason: "PUBKEY_CONFIG" };
  }

  const signedData = Buffer.from(payloadB64, "utf-8");
  let sigOk: boolean;
  try {
    sigOk = cryptoVerify(null, signedData, publicKey, sigBuf);
  } catch {
    sigOk = false;
  }

  if (!sigOk) {
    return { valid: false, reason: "BAD_SIGNATURE" };
  }

  if (payload.deviceId !== deviceId) {
    return { valid: false, reason: "DEVICE_MISMATCH" };
  }

  let validUntil: Date | null = null;
  if (payload.validUntil) {
    validUntil = new Date(payload.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      return { valid: false, reason: "MALFORMED" };
    }
    if (validUntil < new Date()) {
      return { valid: false, reason: "EXPIRED" };
    }
  }

  return { valid: true, plan: payload.plan, validUntil };
}

/**
 * Verify a lease token (`FBL1.<payloadB64url>.<sig>`) minted by the license
 * server. Mirror of {@link verifyLicenseKey}, signed by the SAME vendor keypair
 * and verified with the SAME baked/`LICENSE_PUBLIC_KEY` — no new key material.
 *
 * Unlike a license key, an expired lease is NOT rejected here: the caller needs
 * `leaseUntil` even in the past so {@link computeGateFromLease} can decide
 * grace/soft/hard. Signature and device binding are still hard requirements.
 */
export function verifyLease(token: string, deviceId: string): LeaseVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "FBL1") {
    return { valid: false, reason: "MALFORMED" };
  }

  const [, payloadB64, sigB64] = parts as [string, string, string];

  let payload: {
    v: number;
    deviceId: string;
    plan: string;
    status: string;
    issuedAt: string;
    leaseUntil: string;
  };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8")) as typeof payload;
  } catch {
    return { valid: false, reason: "MALFORMED" };
  }

  if (
    typeof payload !== "object" ||
    payload.v !== 1 ||
    typeof payload.deviceId !== "string" ||
    typeof payload.plan !== "string" ||
    typeof payload.leaseUntil !== "string"
  ) {
    return { valid: false, reason: "MALFORMED" };
  }

  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sigB64, "base64url");
  } catch {
    return { valid: false, reason: "MALFORMED" };
  }

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = getPublicKeyObject();
  } catch {
    return { valid: false, reason: "PUBKEY_CONFIG" };
  }

  const signedData = Buffer.from(payloadB64, "utf-8");
  let sigOk: boolean;
  try {
    sigOk = cryptoVerify(null, signedData, publicKey, sigBuf);
  } catch {
    sigOk = false;
  }

  if (!sigOk) {
    return { valid: false, reason: "BAD_SIGNATURE" };
  }

  if (payload.deviceId !== deviceId) {
    return { valid: false, reason: "DEVICE_MISMATCH" };
  }

  const leaseUntil = new Date(payload.leaseUntil);
  if (Number.isNaN(leaseUntil.getTime())) {
    return { valid: false, reason: "MALFORMED" };
  }

  return { valid: true, plan: payload.plan, leaseUntil };
}

async function getGraceDays(): Promise<{ graceDays: number; softDays: number }> {
  const [graceRow, softRow] = await Promise.all([
    db.setting.findUnique({ where: { key: "license_grace_days" } }),
    db.setting.findUnique({ where: { key: "license_soft_days" } }),
  ]);
  const graceDays = graceRow ? Math.max(0, Number(graceRow.value) || 7) : 7;
  const softDays = softRow ? Math.max(0, Number(softRow.value) || 7) : 7;
  return { graceDays, softDays };
}

/**
 * Pure gate computation — extractable for unit testing without DB.
 */
export function computeGate(
  createdAt: Date,
  hasValidKey: boolean,
  graceDays: number,
  softDays: number,
  now: Date,
): { gate: LicenseGate; status: LicenseStatus; isActive: boolean; graceEndsAt: Date; softEndsAt: Date } {
  const graceEndsAt = new Date(createdAt.getTime() + graceDays * 86_400_000);
  const softEndsAt = new Date(graceEndsAt.getTime() + softDays * 86_400_000);

  if (hasValidKey) {
    return { gate: "active", status: "ACTIVE", isActive: true, graceEndsAt, softEndsAt };
  }
  if (now < graceEndsAt) {
    return { gate: "grace", status: "TRIAL", isActive: true, graceEndsAt, softEndsAt };
  }
  if (now < softEndsAt) {
    return { gate: "soft", status: "EXPIRED", isActive: false, graceEndsAt, softEndsAt };
  }
  return { gate: "hard", status: "UNLICENSED", isActive: false, graceEndsAt, softEndsAt };
}

/**
 * Pure gate computation from a verified lease — the online-license counterpart
 * of {@link computeGate} (which drives the offline trial-from-createdAt path).
 *
 * A licensed device runs on the lease. As long as it is within `leaseUntil` the
 * gate is fully active. Past `leaseUntil` the device is presumed offline and
 * gets `graceDays` at full function to reconnect, then `softDays` of nagging
 * degraded access, then a hard lock — the generous offline runway.
 */
export function computeGateFromLease(
  leaseUntil: Date,
  graceDays: number,
  softDays: number,
  now: Date,
): { gate: LicenseGate; status: LicenseStatus; isActive: boolean; graceEndsAt: Date; softEndsAt: Date } {
  const graceEndsAt = new Date(leaseUntil.getTime() + graceDays * 86_400_000);
  const softEndsAt = new Date(graceEndsAt.getTime() + softDays * 86_400_000);

  if (now < leaseUntil) {
    return { gate: "active", status: "ACTIVE", isActive: true, graceEndsAt, softEndsAt };
  }
  if (now < graceEndsAt) {
    return { gate: "grace", status: "ACTIVE", isActive: true, graceEndsAt, softEndsAt };
  }
  if (now < softEndsAt) {
    return { gate: "soft", status: "EXPIRED", isActive: false, graceEndsAt, softEndsAt };
  }
  return { gate: "hard", status: "UNLICENSED", isActive: false, graceEndsAt, softEndsAt };
}

const LICENSE_LEASE_KEY = "license_lease";

async function getStoredLease(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: LICENSE_LEASE_KEY } });
  return row?.value ?? null;
}

/**
 * Persist the latest lease token issued by the license server. Called by the
 * check-in flow (PR3); read back here to drive the gate.
 */
export async function storeLease(token: string): Promise<void> {
  await db.setting.upsert({
    where: { key: LICENSE_LEASE_KEY },
    create: { key: LICENSE_LEASE_KEY, value: token },
    update: { value: token },
  });
}

async function getOrCreateInstallation() {
  const existing = await db.installation.findFirst();
  if (existing) return existing;
  try {
    return await db.installation.create({ data: {} });
  } catch {
    // Lost a create race — re-read.
    const again = await db.installation.findFirst();
    if (again) return again;
    throw new AppError("Installation init failed", "INSTALLATION_INIT_FAILED", 500);
  }
}

export async function getLicenseSnapshot(): Promise<LicenseSnapshot> {
  const installation = await getOrCreateInstallation();

  const deviceId = await getDeviceId();
  const { graceDays, softDays } = await getGraceDays();
  const now = new Date();

  // No key at all → unlicensed trial, gated off the install's createdAt. This is
  // the shipped/paired-but-not-activated path and stays exactly as before.
  if (!installation.licenseKey) {
    const { gate, status, isActive, graceEndsAt, softEndsAt } = computeGate(
      installation.createdAt,
      false,
      graceDays,
      softDays,
      now,
    );
    return {
      status,
      gate,
      plan: null,
      validUntil: null,
      isActive,
      deviceId,
      graceEndsAt,
      softEndsAt,
    };
  }

  const keyResult = verifyLicenseKey(installation.licenseKey, deviceId);

  // A key is present. The gate now lives off the lease (or the key itself),
  // NOT the write-mostly `licenseStatus` columns — those can go stale.
  const leaseToken = await getStoredLease();
  if (leaseToken) {
    const lease = verifyLease(leaseToken, deviceId);
    if (lease.valid) {
      const { gate, status, isActive, graceEndsAt, softEndsAt } = computeGateFromLease(
        lease.leaseUntil,
        graceDays,
        softDays,
        now,
      );
      return {
        status,
        gate,
        plan: lease.plan,
        validUntil: lease.leaseUntil,
        isActive,
        deviceId,
        graceEndsAt,
        softEndsAt,
      };
    }
  }

  // No verifiable lease yet (never checked in, or lease for another device).
  // Fall back to the key: a valid, device-bound key means offline activation
  // succeeded and the device is active until its first check-in mints a lease.
  if (keyResult.valid) {
    return {
      status: "ACTIVE",
      gate: "active",
      plan: keyResult.plan,
      validUntil: keyResult.validUntil,
      isActive: true,
      deviceId,
      graceEndsAt: null,
      softEndsAt: null,
    };
  }

  // Key present but no longer verifies (revoked-and-re-signed, tampered, expired,
  // or bound to a different device) and no valid lease → hard lock.
  return {
    status: "UNLICENSED",
    gate: "hard",
    plan: null,
    validUntil: null,
    isActive: false,
    deviceId,
    graceEndsAt: null,
    softEndsAt: null,
  };
}

export async function activateLicense(key: string): Promise<LicenseSnapshot> {
  const deviceId = await getDeviceId();
  const result = verifyLicenseKey(key, deviceId);

  if (!result.valid) {
    if (result.reason === "PUBKEY_CONFIG") {
      throw new AppError(
        "License verification is misconfigured on this server",
        "LICENSE_SERVER_MISCONFIG",
        500,
      );
    }
    if (result.reason === "DEVICE_MISMATCH") {
      throw new AppError(
        "This license key is bound to a different device",
        "LICENSE_DEVICE_MISMATCH",
        400,
      );
    }
    throw new AppError("Invalid license key", "LICENSE_INVALID", 400);
  }

  const installation = await getOrCreateInstallation();

  await db.installation.update({
    where: { id: installation.id },
    data: {
      licenseKey: key,
      licenseStatus: "ACTIVE",
      licensePlan: result.plan,
      licenseValidUntil: result.validUntil,
      lastLicenseCheckAt: new Date(),
    },
  });

  // Best-effort: pull the first lease immediately so the gate runs off it right
  // away. Offline activation still succeeds if the server is unreachable — the
  // key alone keeps the device active until the next check-in mints a lease.
  await checkInWithLicenseServer().catch(() => {});

  return getLicenseSnapshot();
}

export async function requireActiveLicense(): Promise<void> {
  const snap = await getLicenseSnapshot();
  if (snap.gate === "soft" || snap.gate === "hard") {
    throw new AppError("License required", "LICENSE_REQUIRED", 403);
  }
}

/**
 * Check in with the license server to renew the device lease. Called on a slow
 * timer (instrumentation.ts) and best-effort right after activation.
 *
 * Failure modes are deliberately soft so a transient server/network problem
 * never locks a paid device:
 * - no activated key            → nothing to renew, return.
 * - network error / timeout / 5xx → keep the cached lease (offline grace runway).
 * - 403 revoked                 → do NOT renew; the device rides the current
 *                                 lease until it lapses into grace→soft→hard.
 * - 200 with a valid lease      → store it + stamp lastLicenseCheckAt.
 */
export async function checkInWithLicenseServer(): Promise<void> {
  const installation = await getOrCreateInstallation();
  if (!installation.licenseKey) return;

  const deviceId = await getDeviceId();

  let res: Response;
  try {
    res = await fetch(`${env.LICENSE_SERVER_URL}/license/checkin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId, key: installation.licenseKey }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Offline or timeout — keep riding the cached lease.
    return;
  }

  // Revoked or any non-OK response: leave the stored lease untouched. A revoked
  // key stops getting fresh leases, so the current one simply ages out.
  if (!res.ok) return;

  let body: { lease?: unknown };
  try {
    body = (await res.json()) as { lease?: unknown };
  } catch {
    return;
  }
  if (typeof body.lease !== "string") return;

  // Never store a lease we can't verify against our own public key.
  const lease = verifyLease(body.lease, deviceId);
  if (!lease.valid) return;

  await storeLease(body.lease);
  await db.installation.update({
    where: { id: installation.id },
    data: { lastLicenseCheckAt: new Date() },
  });
}
