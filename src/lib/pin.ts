import bcrypt from "bcryptjs";
import { db } from "./db";

const PIN_KEY = "admin_pin_hash";

export async function setAdminPin(pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  const hash = await bcrypt.hash(pin, 10);
  await db.setting.upsert({
    where: { key: PIN_KEY },
    update: { value: hash },
    create: { key: PIN_KEY, value: hash },
  });
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: PIN_KEY } });
  if (!row) return false;
  return bcrypt.compare(pin, row.value);
}

export async function isAdminPinSet(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: PIN_KEY } });
  return Boolean(row?.value);
}
