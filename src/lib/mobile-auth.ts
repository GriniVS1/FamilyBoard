import "server-only";
import { db } from "./db";
import { AppError } from "./api";
import { verifyDeviceToken } from "./mobile-tokens";

export type MobileAuthContext = {
  deviceId: string;
  memberId: string;
  familyId: string;
};

export async function requireMobileAuth(
  req: Request,
): Promise<MobileAuthContext> {
  const header = req.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new AppError("Missing bearer token", "UNAUTHORIZED", 401);
  }
  const token = header.slice("bearer ".length).trim();
  if (!token) throw new AppError("Empty bearer token", "UNAUTHORIZED", 401);

  // Per-row bcrypt compare is necessary because bcrypt salts prevent a lookup
  // by hash. Single-family installs have at most ~10 devices, so this scan is
  // acceptable. Revoked devices are excluded before iterating.
  const candidates = await db.mobileDevice.findMany({
    where: { revokedAt: null },
    select: { id: true, memberId: true, familyId: true, tokenHash: true },
  });

  for (const c of candidates) {
    if (await verifyDeviceToken(token, c.tokenHash)) {
      void db.mobileDevice
        .update({ where: { id: c.id }, data: { lastSeenAt: new Date() } })
        .catch(() => {});
      return { deviceId: c.id, memberId: c.memberId, familyId: c.familyId };
    }
  }

  throw new AppError("Invalid bearer token", "UNAUTHORIZED", 401);
}

export async function optionalMobileAuth(
  req: Request,
): Promise<MobileAuthContext | null> {
  try {
    return await requireMobileAuth(req);
  } catch {
    return null;
  }
}
