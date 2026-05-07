import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getPhotosDir } from "@/lib/photos";
import { verifyAdminPin } from "@/lib/pin";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pin: z.string().min(1).max(12),
  confirm: z.literal("RESET"),
});

async function clearPhotosDir(): Promise<void> {
  const dir = getPhotosDir();
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === "ENOENT") return;
    throw err;
  }
  await Promise.all(
    files.map(async (name) => {
      try {
        await unlink(path.join(dir, name));
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code?: string }).code
            : undefined;
        if (code !== "ENOENT") {
          console.warn("[factory-reset] failed to remove", name, err);
        }
      }
    }),
  );
}

export const POST = withErrorHandling(async (req) => {
  const ip = getClientIp(req.headers);
  const limit = hitRateLimit(`factory-reset:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many attempts. Please wait a minute.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const { pin } = bodySchema.parse(await req.json());
  const valid = await verifyAdminPin(pin);
  if (!valid) {
    throw new AppError("PIN is incorrect", "INVALID_PIN", 401);
  }

  await db.$transaction(async (tx) => {
    const installation = await tx.installation.findFirst();
    if (installation) {
      await tx.installation.update({
        where: { id: installation.id },
        data: { familyId: null },
      });
    }
    await tx.choreCompletion.deleteMany();
    await tx.chore.deleteMany();
    await tx.event.deleteMany();
    await tx.todo.deleteMany();
    await tx.note.deleteMany();
    await tx.photo.deleteMany();
    await tx.groceryItem.deleteMany();
    await tx.ingredient.deleteMany();
    await tx.mealPlan.deleteMany();
    await tx.recipe.deleteMany();
    await tx.member.deleteMany();
    await tx.family.deleteMany();
    await tx.setting.deleteMany();
  });

  await clearPhotosDir();

  return ok({ ok: true });
});
