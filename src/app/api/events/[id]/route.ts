import { withErrorHandling, ok } from "@/lib/api";
import {
  deleteEvent,
  eventScopeSchema,
  updateEvent,
  updateEventSchema,
} from "@/lib/events-write";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id: rawId } = await params;
  const url = new URL(req.url);
  const scope = eventScopeSchema.parse(url.searchParams.get("scope") ?? undefined);
  const body = updateEventSchema.parse(await req.json());

  const result = await updateEvent(rawId, scope, body);
  if (result.kind === "instance") return ok(result.payload);
  return ok(result.event);
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id: rawId } = await params;
  const url = new URL(req.url);
  const scope = eventScopeSchema.parse(url.searchParams.get("scope") ?? undefined);

  await deleteEvent(rawId, scope);
  return ok({ ok: true });
});
