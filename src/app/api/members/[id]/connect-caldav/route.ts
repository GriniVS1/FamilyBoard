import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { CALDAV_PRESETS, discoverCalendars } from "@/lib/caldav";
import type { CaldavPresetKey } from "@/lib/caldav";

export const runtime = "nodejs";

const bodySchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  preset: z
    .enum(["icloud", "fastmail", "nextcloud", "yahoo", "custom"] as const)
    .optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
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

  if (member.microsoftSyncEnabled) {
    throw new AppError(
      "Member is already linked to Microsoft. Disconnect Microsoft first or use a different member.",
      "PROVIDER_CONFLICT",
      400,
    );
  }

  const body = bodySchema.parse(await req.json());

  // For presets with a fixed serverUrl, validate the provided URL matches or
  // let the user supply their own (nextcloud / custom allow any URL).
  const preset = body.preset
    ? CALDAV_PRESETS[body.preset as CaldavPresetKey]
    : undefined;
  const resolvedServerUrl =
    preset?.serverUrl ?? body.serverUrl;

  const calendars = await discoverCalendars({
    serverUrl: resolvedServerUrl,
    username: body.username,
    password: body.password,
  });

  // Persist credentials now; caldavSyncEnabled stays false until the user
  // picks a specific calendar via /select-caldav-calendar.
  await db.member.update({
    where: { id },
    data: {
      caldavServerUrl: resolvedServerUrl,
      caldavUsername: body.username,
      caldavPasswordEnc: encryptToken(body.password),
      caldavSyncEnabled: false,
    },
  });

  return ok({ calendars });
});
