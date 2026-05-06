import { db } from "./db";
import type { LicenseStatus } from "./enums";

export type LicenseSnapshot = {
  status: LicenseStatus;
  plan: string | null;
  validUntil: Date | null;
  isActive: boolean;
};

export async function getLicenseSnapshot(): Promise<LicenseSnapshot> {
  const installation = await db.installation.findFirst();
  if (!installation) {
    return { status: "ACTIVE", plan: null, validUntil: null, isActive: true };
  }
  return {
    status: "ACTIVE",
    plan: installation.licensePlan,
    validUntil: installation.licenseValidUntil,
    isActive: true,
  };
}

export async function requireActiveLicense(): Promise<void> {
  const snap = await getLicenseSnapshot();
  if (!snap.isActive) {
    throw new Error("LICENSE_INACTIVE");
  }
}

export async function checkInWithLicenseServer(): Promise<void> {
  return;
}
