import { randomUUID, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "./db";
import { AppError } from "./api";
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

  let hasValidKey = false;
  let plan: string | null = installation.licensePlan;
  let validUntil: Date | null = installation.licenseValidUntil;

  if (installation.licenseKey) {
    const result = verifyLicenseKey(installation.licenseKey, deviceId);
    if (result.valid) {
      hasValidKey = true;
      plan = result.plan;
      validUntil = result.validUntil;
    }
  }

  const { gate, status, isActive, graceEndsAt, softEndsAt } = computeGate(
    installation.createdAt,
    hasValidKey,
    graceDays,
    softDays,
    new Date(),
  );

  return {
    status,
    gate,
    plan: hasValidKey ? plan : null,
    validUntil: hasValidKey ? validUntil : null,
    isActive,
    deviceId,
    graceEndsAt,
    softEndsAt,
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

  return getLicenseSnapshot();
}

export async function requireActiveLicense(): Promise<void> {
  const snap = await getLicenseSnapshot();
  if (snap.gate === "soft" || snap.gate === "hard") {
    throw new AppError("License required", "LICENSE_REQUIRED", 403);
  }
}

// No-op until v3 remote check-in is wired.
export async function checkInWithLicenseServer(): Promise<void> {
  return;
}
