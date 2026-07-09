import { z } from "zod";
import type { Member } from "@prisma/client";
import { AppError } from "./api";
import { db } from "./db";
import { MEMBER_ROLE } from "./enums";
import { MEMBER_COLORS } from "./utils";
import { deleteRemoteEvent } from "./sync";
import { deleteRemoteCaldavEvent } from "./caldav";
import { deleteRemoteMicrosoftEvent } from "./microsoft";

export const MAX_MEMBERS = 8;

export const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(MEMBER_COLORS),
  emoji: z.string().max(4).optional().nullable(),
  role: z.enum(MEMBER_ROLE).optional(),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const patchMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: z.enum(MEMBER_COLORS).optional(),
    emoji: z.string().max(4).nullable().optional(),
    role: z.enum(MEMBER_ROLE).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.color !== undefined ||
      v.emoji !== undefined ||
      v.role !== undefined,
    { message: "At least one field must be provided" },
  );
export type UpdateMemberInput = z.infer<typeof patchMemberSchema>;

export type MemberSummary = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
};

export function serializeMember(member: Member): MemberSummary {
  return {
    id: member.id,
    name: member.name,
    color: member.color,
    emoji: member.emoji,
    role: member.role,
  };
}

/**
 * Add a single member after the initial setup wizard. The setup-wizard's
 * POST /api/setup/members handles bulk-create during onboarding; this one
 * is used by both the wall's post-setup settings screen and the mobile app.
 *
 * Rules:
 * - Family must exist
 * - Cap at MAX_MEMBERS — beyond that, refuse
 * - Default role is "MEMBER"; only allow "ADMIN" if explicitly requested
 *   (the wizard's first-member-is-admin shortcut doesn't apply post-setup)
 */
export async function createMember(input: CreateMemberInput): Promise<Member> {
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

  return db.member.create({
    data: {
      familyId: family.id,
      name: input.name,
      color: input.color,
      emoji: input.emoji ?? undefined,
      role: input.role ?? "MEMBER",
    },
  });
}

export async function updateMember(
  id: string,
  input: UpdateMemberInput,
  opts?: { familyId?: string },
): Promise<Member> {
  const member = await db.member.findUnique({ where: { id } });
  if (!member || (opts?.familyId && member.familyId !== opts.familyId)) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  if (input.role && input.role !== member.role && member.role === "ADMIN") {
    const adminCount = await db.member.count({
      where: { familyId: member.familyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError("Cannot demote the only admin", "LAST_ADMIN", 400);
    }
  }

  return db.member.update({
    where: { id },
    data: {
      name: input.name,
      color: input.color,
      emoji: input.emoji,
      role: input.role,
    },
  });
}

export async function deleteMember(
  id: string,
  opts?: { familyId?: string },
): Promise<void> {
  const member = await db.member.findUnique({ where: { id } });
  if (!member || (opts?.familyId && member.familyId !== opts.familyId)) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  const totalCount = await db.member.count({
    where: { familyId: member.familyId },
  });
  if (totalCount <= 1) {
    throw new AppError("Cannot remove the only member", "LAST_MEMBER", 400);
  }

  if (member.role === "ADMIN") {
    const adminCount = await db.member.count({
      where: { familyId: member.familyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError("Cannot remove the only admin", "LAST_ADMIN", 400);
    }
  }

  // LOCAL events we pushed to the member's linked calendars would be orphaned
  // by the cascade delete — remove the remote copies first, best-effort.
  // Provider-sourced events (GOOGLE/CALDAV/MICROSOFT) stay on the provider.
  // Must run BEFORE db.member.delete: the helpers re-read event + member rows
  // themselves, so after the cascade they'd silently no-op.
  const pushedEvents = await db.event.findMany({
    where: {
      memberId: id,
      source: "LOCAL",
      OR: [
        { googleEventId: { not: null } },
        { caldavHref: { not: null } },
        { microsoftEventId: { not: null } },
      ],
    },
    select: {
      id: true,
      googleEventId: true,
      caldavHref: true,
      microsoftEventId: true,
    },
  });
  for (const event of pushedEvents) {
    try {
      if (event.googleEventId) await deleteRemoteEvent(event.id);
      if (event.caldavHref) await deleteRemoteCaldavEvent(event.id);
      if (event.microsoftEventId) await deleteRemoteMicrosoftEvent(event.id);
    } catch (err) {
      console.warn(
        `[members] remote cleanup for event ${event.id} failed`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // onDelete: Cascade on MobileDevice.member revokes any paired device for
  // this member as part of the same delete — requireMobileAuth then 401s
  // cleanly for that device's next request instead of erroring.
  await db.member.delete({ where: { id } });
}
