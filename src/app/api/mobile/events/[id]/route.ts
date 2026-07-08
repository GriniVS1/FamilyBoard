import { ok, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  deleteEvent,
  eventScopeSchema,
  getMobileEvent,
  updateEvent,
  updateEventSchema,
} from "@/lib/events-write";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const ctx = await requireMobileAuth(req);
  const { id: rawId } = await params;
  const url = new URL(req.url);
  const scope = eventScopeSchema.parse(url.searchParams.get("scope") ?? undefined);
  const body = updateEventSchema.parse(await req.json());

  const result = await updateEvent(rawId, scope, body, { familyId: ctx.familyId });
  if (result.kind === "instance") return ok({ ok: true });

  const mobileEvent = await getMobileEvent(result.event.id);
  return ok({ event: mobileEvent });
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const ctx = await requireMobileAuth(req);
  const { id: rawId } = await params;
  const url = new URL(req.url);
  const scope = eventScopeSchema.parse(url.searchParams.get("scope") ?? undefined);

  await deleteEvent(rawId, scope, { familyId: ctx.familyId });
  return ok({ ok: true });
});
