import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyAdminPin } from "@/lib/pin";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";
import { generatePairingCode } from "@/lib/mobile-tokens";
import { getLanBaseUrl, getMdnsBaseUrl } from "@/lib/network";
import { getOrCreateInstallation } from "@/lib/queries";
import { remoteUrlFor } from "@/lib/relay-url";

// The relay URL is only useful once the Pi's tunnel is actually up — and
// publishing it earlier would widen the TOFU window (see relay/src/index.ts).
async function connectedRemoteUrl(): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: "relay_state" } });
  if (!row) return null;
  try {
    if ((JSON.parse(row.value) as { connected?: boolean }).connected !== true) return null;
  } catch {
    return null;
  }
  const installation = await getOrCreateInstallation();
  return remoteUrlFor(installation.id);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  memberId: z.string().min(1),
  pin: z.string().min(1).max(12),
});

export const POST = withErrorHandling(async (req) => {
  const body = bodySchema.parse(await req.json());

  const ip = getClientIp(req.headers);
  const valid = await verifyAdminPin(body.pin);
  if (!valid) {
    throw new AppError("PIN is incorrect", "INVALID_PIN", 401);
  }

  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  const limit = hitRateLimit(`pair-code:${family.id}`, 5, 5 * 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many pairing codes requested. Please wait 5 minutes.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  // Validate memberId belongs to this family
  const member = await db.member.findUnique({
    where: { id: body.memberId },
    select: { id: true, familyId: true },
  });
  if (!member || member.familyId !== family.id) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);

  // Only one open code per member at a time
  await db.pairingCode.deleteMany({
    where: {
      memberId: body.memberId,
      consumedAt: null,
      expiresAt: { gt: now },
    },
  });

  const code = generatePairingCode();

  await db.pairingCode.create({
    data: {
      code,
      familyId: family.id,
      memberId: body.memberId,
      expiresAt,
    },
  });

  // LAN-reachable base URL for the QR code — the kiosk browser itself runs on
  // localhost, so the client's window.location.origin is useless to a phone.
  // mdnsUrl rides along as the QR's fallback so the app can recover when a
  // DHCP lease change invalidates the embedded LAN IP.
  return ok({
    code,
    expiresAt,
    serverUrl: getLanBaseUrl(),
    mdnsUrl: getMdnsBaseUrl(),
    remoteUrl: await connectedRemoteUrl(),
  });
});
