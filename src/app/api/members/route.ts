import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEMBER_ROLE } from "@/lib/enums";
import { listMembers } from "@/lib/queries";
import { MEMBER_COLORS } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MEMBERS = 8;

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(MEMBER_COLORS),
  emoji: z.string().max(4).optional().nullable(),
  role: z.enum(MEMBER_ROLE).optional(),
});

export const GET = withErrorHandling(async () => {
  const members = await listMembers();
  return ok(members);
});

/**
 * Add a single member after the initial setup wizard. The setup-wizard's
 * POST /api/setup/members handles bulk-create during onboarding; this one
 * lives in settings.
 *
 * Rules:
 * - Family must exist
 * - Cap at MAX_MEMBERS — beyond that, refuse
 * - Default role is "MEMBER"; only allow "ADMIN" if explicitly requested
 *   (the wizard's first-member-is-admin shortcut doesn't apply post-setup)
 */
export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding members",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  const count = await db.member.count({ where: { familyId: family.id } });
  if (count >= MAX_MEMBERS) {
    throw new AppError(
      `Maximum of ${MAX_MEMBERS} members already reached`,
      "MAX_MEMBERS_REACHED",
      400,
    );
  }

  const created = await db.member.create({
    data: {
      familyId: family.id,
      name: body.name,
      color: body.color,
      emoji: body.emoji ?? undefined,
      role: body.role ?? "MEMBER",
    },
  });

  return ok(created);
});
