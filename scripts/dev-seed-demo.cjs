// Demo family for UI work on a throwaway database — WIPES the target DB.
// Usage (repo root):
//   DATABASE_URL="file:../data/kids-ui.db" node node_modules/prisma/build/index.js migrate deploy
//   DATABASE_URL="file:../data/kids-ui.db" node scripts/dev-seed-demo.cjs
// Admin PIN of the demo family: 123456 (local demo DB only).
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

if (!/kids-ui|demo/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to seed: DATABASE_URL must point at a demo DB (e.g. file:../data/kids-ui.db).");
  process.exit(1);
}

const db = new PrismaClient();

function at(dayOffset, h, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

async function main() {
  await db.choreCompletion.deleteMany();
  await db.chore.deleteMany();
  await db.todo.deleteMany();
  await db.note.deleteMany();
  await db.event.deleteMany();
  await db.member.deleteMany();
  await db.installation.deleteMany();
  await db.family.deleteMany();
  await db.setting.deleteMany();

  const family = await db.family.create({
    data: {
      name: "Familie Muster",
      weatherLat: 47.3769,
      weatherLon: 8.5417,
      weatherLabel: "Zürich",
    },
  });
  await db.installation.create({ data: { familyId: family.id } });

  const mama = await db.member.create({
    data: { familyId: family.id, name: "Mama", color: "rose", emoji: "🌻", role: "ADMIN" },
  });
  const papa = await db.member.create({
    data: { familyId: family.id, name: "Papa", color: "sky", emoji: "🧔", role: "ADMIN" },
  });
  const mia = await db.member.create({
    data: { familyId: family.id, name: "Mia", color: "lilac", emoji: "🦄", role: "MEMBER" },
  });
  const leo = await db.member.create({
    data: { familyId: family.id, name: "Leo", color: "mint", emoji: "🦖", role: "MEMBER" },
  });

  await db.setting.createMany({
    data: [
      { key: "admin_pin_hash", value: await bcrypt.hash("123456", 10) },
      { key: "locale", value: "de" },
      { key: "remote_access_enabled", value: "false" },
      { key: "screensaver_idle_minutes", value: "120" },
    ],
  });

  const chore = (memberId, title, icon, points = 1, timeOfDay = null) =>
    db.chore.create({ data: { familyId: family.id, memberId, title, icon, points, timeOfDay } });

  // Mia: many tasks (12) to exercise the "lots of tasks" layout.
  const miaWater = await chore(mia.id, "Wasser trinken", "💧");
  await chore(mia.id, "Zähne putzen", "🪥", 1, "MORNING");
  const miaDress = await chore(mia.id, "Anziehen", "👕", 1, "MORNING");
  await chore(mia.id, "Bett machen", "🛏️", 1, "MORNING");
  await chore(mia.id, "Hände waschen", "🧼", 1, "DAY");
  await chore(mia.id, "Tisch decken", "🍽️", 2, "DAY");
  await chore(mia.id, "Blumen giessen", "🌱", 1, "DAY");
  await chore(mia.id, "Schuhe versorgen", "👟", 1, "DAY");
  await chore(mia.id, "Spielzeug aufräumen", "🧸", 2, "EVENING");
  await chore(mia.id, "Pyjama anziehen", "🌙", 1, "EVENING");
  await chore(mia.id, "Zähne putzen", "🪥", 1, "EVENING");
  await chore(mia.id, "Buch anschauen", "📖", 1, "EVENING");
  // Leo: a handful.
  const leoBed = await chore(leo.id, "Bett machen", "🛏️", 1, "MORNING");
  await chore(leo.id, "Schultasche packen", "🎒", 1, "MORNING");
  await chore(leo.id, "Hund füttern", "🐶", 2, "DAY");
  await chore(leo.id, "Wasser trinken", "💧");
  await chore(leo.id, "Hausaufgaben", "📚", 3, "DAY");
  await chore(papa.id, "Müll rausbringen", "🚮", 2, "EVENING");
  await chore(mama.id, "Pflanzen giessen", "🌱");
  await chore(null, "Wäsche zusammenlegen", "🧺", 3);

  await db.choreCompletion.create({ data: { choreId: miaWater.id, memberId: mia.id } });
  await db.choreCompletion.create({ data: { choreId: miaDress.id, memberId: mia.id } });
  await db.choreCompletion.create({ data: { choreId: leoBed.id, memberId: leo.id } });

  const ev = (memberId, title, d, h, m, dur = 60, allDay = false) =>
    db.event.create({
      data: {
        familyId: family.id,
        memberId,
        title,
        startsAt: at(d, h, m),
        endsAt: new Date(at(d, h, m).getTime() + dur * 60_000),
        allDay,
      },
    });
  await ev(mia.id, "Kindergarten", 0, 8, 0, 240);
  await ev(leo.id, "Fussballtraining", 0, 14, 30, 90);
  await ev(mama.id, "Znacht zusammen", 0, 18, 0, 60);
  await ev(mia.id, "Schwimmen", 1, 10, 0, 60);
  await ev(papa.id, "Zahnarzt", 2, 9, 30, 45);
  await ev(leo.id, "Geburtstag Oma", 3, 0, 0, 24 * 60, true);

  await db.todo.createMany({
    data: [
      { familyId: family.id, memberId: papa.id, title: "Velo flicken", dueDate: at(0, 12) },
      { familyId: family.id, memberId: mama.id, title: "Geschenk für Oma kaufen", dueDate: at(2, 12) },
      { familyId: family.id, memberId: leo.id, title: "Turnsack packen" },
      { familyId: family.id, memberId: null, title: "Batterien kaufen", done: true },
    ],
  });

  await db.note.createMany({
    data: [
      { familyId: family.id, authorMemberId: mama.id, body: "Nicht vergessen: Mia hat morgen Schwimmen! 🏊", color: "sun", pinned: true },
      { familyId: family.id, authorMemberId: leo.id, body: "Ich will Pizza am Freitag 🍕", color: "peach" },
    ],
  });

  console.log("seeded", { family: family.id, members: [mama.id, papa.id, mia.id, leo.id] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
