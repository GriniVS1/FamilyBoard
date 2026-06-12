import { randomBytes } from "node:crypto";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { getAuthorizeUrlAsync, isMicrosoftConfigured } from "@/lib/microsoft";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

const STATE_TTL_MS = 10 * 60 * 1000;

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  if (!isMicrosoftConfigured()) {
    throw new AppError(
      "Microsoft OAuth is not configured on this server",
      "MICROSOFT_NOT_CONFIGURED",
      503,
    );
  }

  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  if (member.googleSyncEnabled) {
    throw new AppError(
      "Member is already linked to Google. Disconnect Google first or use a different member.",
      "PROVIDER_CONFLICT",
      400,
    );
  }
  if (member.caldavSyncEnabled) {
    throw new AppError(
      "Member is already linked to CalDAV. Disconnect CalDAV first or use a different member.",
      "PROVIDER_CONFLICT",
      400,
    );
  }

  const stateToken = randomBytes(32).toString("hex");
  const payload = JSON.stringify({
    memberId: id,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  await db.setting.upsert({
    where: { key: `microsoft_oauth_state:${stateToken}` },
    update: { value: payload },
    create: { key: `microsoft_oauth_state:${stateToken}`, value: payload },
  });

  const authorizeUrl = await getAuthorizeUrlAsync(stateToken);
  return ok({ authorizeUrl });
});
