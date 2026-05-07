import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

// Crockford base32 — excludes I, L, O, U to avoid transcription errors
export function generatePairingCode(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export async function hashDeviceToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function verifyDeviceToken(
  token: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
