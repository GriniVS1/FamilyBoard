import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  PICTO_CATEGORIES,
  PICTO_META,
  PICTO_NAMES,
  Picto,
  PictoDemo,
  pictosInCategory,
  resolveTaskPicto,
  type PictoCategory,
  type PictoName,
} from "@/components/pictos";
import { MOTIFS } from "@/components/pictos/motifs";
import { MEMBER_COLORS, cn, type MemberColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TINT: Record<MemberColor, string> = {
  peach: "bg-accent-peach-tint",
  mint: "bg-accent-mint-tint",
  sun: "bg-accent-sun-tint",
  sky: "bg-accent-sky-tint",
  lilac: "bg-accent-lilac-tint",
  rose: "bg-accent-rose-tint",
  teal: "bg-accent-teal-tint",
  sand: "bg-accent-sand-tint",
};

const SWATCH: Record<MemberColor, { tint: string; accent: string; ink: string; inkBg: string }> = {
  peach: { tint: "bg-accent-peach-tint", accent: "bg-accent-peach", ink: "text-accent-peach-ink", inkBg: "bg-accent-peach-ink" },
  mint: { tint: "bg-accent-mint-tint", accent: "bg-accent-mint", ink: "text-accent-mint-ink", inkBg: "bg-accent-mint-ink" },
  sun: { tint: "bg-accent-sun-tint", accent: "bg-accent-sun", ink: "text-accent-sun-ink", inkBg: "bg-accent-sun-ink" },
  sky: { tint: "bg-accent-sky-tint", accent: "bg-accent-sky", ink: "text-accent-sky-ink", inkBg: "bg-accent-sky-ink" },
  lilac: { tint: "bg-accent-lilac-tint", accent: "bg-accent-lilac", ink: "text-accent-lilac-ink", inkBg: "bg-accent-lilac-ink" },
  rose: { tint: "bg-accent-rose-tint", accent: "bg-accent-rose", ink: "text-accent-rose-ink", inkBg: "bg-accent-rose-ink" },
  teal: { tint: "bg-accent-teal-tint", accent: "bg-accent-teal", ink: "text-accent-teal-ink", inkBg: "bg-accent-teal-ink" },
  sand: { tint: "bg-accent-sand-tint", accent: "bg-accent-sand", ink: "text-accent-sand-ink", inkBg: "bg-accent-sand-ink" },
};

const THEMES = ["light", "dark"] as const;

// The seeded demo family (scratchpad seed-demo.cjs): title + stored emoji, as the wall sees them.
const DEMO_TASKS: ReadonlyArray<{ title: string; icon: string; color: MemberColor }> = [
  { title: "Wasser trinken", icon: "💧", color: "lilac" },
  { title: "Zähne putzen", icon: "🪥", color: "lilac" },
  { title: "Anziehen", icon: "👕", color: "lilac" },
  { title: "Bett machen", icon: "🛏️", color: "lilac" },
  { title: "Hände waschen", icon: "🧼", color: "lilac" },
  { title: "Tisch decken", icon: "🍽️", color: "lilac" },
  { title: "Blumen giessen", icon: "🌱", color: "lilac" },
  { title: "Schuhe versorgen", icon: "👟", color: "lilac" },
  { title: "Spielzeug aufräumen", icon: "🧸", color: "lilac" },
  { title: "Pyjama anziehen", icon: "🌙", color: "lilac" },
  { title: "Zähne putzen", icon: "🪥", color: "lilac" },
  { title: "Buch anschauen", icon: "📖", color: "lilac" },
  { title: "Bett machen", icon: "🛏️", color: "mint" },
  { title: "Schultasche packen", icon: "🎒", color: "mint" },
  { title: "Hund füttern", icon: "🐶", color: "mint" },
  { title: "Wasser trinken", icon: "💧", color: "mint" },
  { title: "Hausaufgaben", icon: "📚", color: "mint" },
  { title: "Müll rausbringen", icon: "🚮", color: "sky" },
  { title: "Pflanzen giessen", icon: "🌱", color: "rose" },
  { title: "Wäsche zusammenlegen", icon: "🧺", color: "sand" },
];

type SearchParams = Promise<{ cat?: string; demo?: string; theme?: string; view?: string; text?: string }>;

function isCategory(value: string | undefined): value is PictoCategory {
  return (PICTO_CATEGORIES as readonly string[]).includes(value ?? "");
}

export default async function PictoPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const t = await getTranslations("pictos");
  const category = isCategory(params.cat) ? params.cat : null;
  const demo = params.demo === "1";
  const themes = params.theme === "light" || params.theme === "dark" ? [params.theme] : THEMES;
  const names: PictoName[] = category ? pictosInCategory(category) : [...PICTO_NAMES];
  const tasksView = params.view === "tasks";
  const showText = params.text !== "0";

  return (
    <main className="min-h-dvh bg-bg text-ink" data-picto-demo={demo ? "true" : undefined}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <h1 className="kid-heading mr-4">Piktogramme · {names.length}</h1>
        <Link className="kid-label rounded-full bg-surface px-4 py-2 shadow-soft" href="/dev/pictos">
          Übersicht
        </Link>
        {PICTO_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/dev/pictos?cat=${c}`}
            className={cn(
              "kid-label rounded-full px-4 py-2 shadow-soft",
              c === category ? "bg-ink text-bg" : "bg-surface",
            )}
          >
            {c}
          </Link>
        ))}
        <Link className="kid-label rounded-full bg-surface px-4 py-2 shadow-soft" href="/dev/pictos?view=tasks&text=0">
          Demo-Aufgaben ohne Text
        </Link>
        <span className="kid-label text-muted">Tippen = Demo-Animation · ?demo=1 spielt alle</span>
      </header>

      {themes.map((theme) => (
        <section key={theme} className={cn(theme, "bg-bg px-6 py-6 text-ink")}>
          <h2 className="kid-title-lg mb-4">{theme === "light" ? "Light" : "Dark"}</h2>
          {!category && !tasksView && <TokenStrip />}
          {tasksView ? (
            <DemoTasks showText={showText} />
          ) : category ? (
            <DetailTable names={names} label={(n) => t(n)} />
          ) : (
            <OverviewGrid names={names} label={(n) => t(n)} />
          )}
        </section>
      ))}
    </main>
  );
}

/** "Ohne Text" check: can each demo task be named from its picture alone? */
function DemoTasks({ showText }: { showText: boolean }) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {DEMO_TASKS.map((task, i) => {
        const name = resolveTaskPicto(task.icon, task.title);
        return (
          <li key={`${task.title}-${i}`} className={cn("flex flex-col items-center gap-2 rounded-3xl p-3", TINT[task.color])}>
            <span className="kid-label self-start text-muted">{i + 1}</span>
            <span className="inline-flex size-[88px] items-center justify-center rounded-2xl bg-surface shadow-soft">
              {name ? <Picto name={name} size={64} /> : <span className="kid-heading">?</span>}
            </span>
            {showText && (
              <span className="kid-label text-center">
                {task.title} {task.icon} → {name ?? "—"}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TokenStrip() {
  return (
    <div className="mb-6 grid grid-cols-4 gap-3 xl:grid-cols-8">
      {MEMBER_COLORS.map((c) => (
        <div key={c} className={cn("rounded-3xl p-3", SWATCH[c].tint)}>
          <div className={cn("kid-label", SWATCH[c].ink)}>{c}</div>
          <div className={cn("kid-title", SWATCH[c].ink)}>Aa Zähne</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn("inline-flex size-10 items-center justify-center rounded-full text-on-accent", SWATCH[c].accent)}>
              ✓
            </span>
            <span className={cn("size-6 rounded-full", SWATCH[c].inkBg)} />
          </div>
        </div>
      ))}
      <div className="col-span-4 flex flex-wrap gap-3 xl:col-span-8">
        {(["success", "danger", "warning"] as const).map((s) => (
          <div
            key={s}
            className={cn(
              "kid-label flex items-center gap-2 rounded-full px-4 py-2",
              s === "success" && "bg-success-tint text-success-ink",
              s === "danger" && "bg-danger-tint text-danger-ink",
              s === "warning" && "bg-warning-tint text-warning-ink",
            )}
          >
            <span
              className={cn(
                "size-4 rounded-full",
                s === "success" && "bg-success",
                s === "danger" && "bg-danger",
                s === "warning" && "bg-warning",
              )}
            />
            {s}
          </div>
        ))}
        <button type="button" className="focus-ring-kid kid-label rounded-full bg-surface px-4 py-2 shadow-pop">
          Fokus (Tab)
        </button>
        <span className="kid-label rounded-full bg-surface px-4 py-2 text-muted shadow-soft">muted</span>
      </div>
    </div>
  );
}

function OverviewGrid({ names, label }: { names: PictoName[]; label: (n: PictoName) => string }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
      {names.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 rounded-3xl bg-surface p-3 shadow-soft">
          <div className="flex items-end gap-3">
            <PictoDemo label={label(name)}>
              <Picto name={name} size={120} />
            </PictoDemo>
            <Picto name={name} size={40} />
          </div>
          <div className="text-center">
            <div className="kid-label">{label(name)}</div>
            <div className="text-xs text-muted">
              {name} · {PICTO_META[name].emoji} · {MOTIFS[name].motion}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DetailTable({ names, label }: { names: PictoName[]; label: (n: PictoName) => string }) {
  return (
    <ul className="flex flex-col gap-2">
      {names.map((name) => (
        <li key={name} className="flex items-center gap-4 rounded-3xl bg-surface p-2 pr-4 shadow-soft">
          <div className="w-40 shrink-0 pl-2">
            <div className="kid-label">{label(name)}</div>
            <div className="text-xs text-muted">
              {name} · {MOTIFS[name].motion}
            </div>
          </div>
          <PictoDemo label={label(name)}>
            <Picto name={name} size={120} />
          </PictoDemo>
          <Picto name={name} size={40} />
          <div className="flex gap-2">
            {MEMBER_COLORS.map((c) => (
              <span key={c} className={cn("inline-flex size-14 items-center justify-center rounded-2xl", TINT[c])}>
                <Picto name={name} size={40} />
              </span>
            ))}
          </div>
          <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-accent-sky">
            <Picto name={name} size={40} />
          </span>
        </li>
      ))}
    </ul>
  );
}
