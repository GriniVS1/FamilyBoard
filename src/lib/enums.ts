export const LICENSE_STATUS = ["UNLICENSED", "TRIAL", "ACTIVE", "EXPIRED"] as const;
export type LicenseStatus = (typeof LICENSE_STATUS)[number];

export const MEMBER_ROLE = ["ADMIN", "MEMBER"] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

export const EVENT_SOURCE = ["LOCAL", "GOOGLE"] as const;
export type EventSource = (typeof EVENT_SOURCE)[number];

export function isLicenseStatus(v: string): v is LicenseStatus {
  return (LICENSE_STATUS as readonly string[]).includes(v);
}
