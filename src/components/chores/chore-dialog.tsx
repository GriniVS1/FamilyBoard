"use client";

import { Check, ChevronDown, Smile, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/kids/confirm-dialog";
import { toneOf } from "@/components/kids/tone";
import { PICTO_META, Picto, type PictoName } from "@/components/pictos";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { useOskField } from "@/hooks/use-osk-field";
import type { ChoreTimeOfDay } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { PICTO_DEFAULTS, PICTO_GROUPS } from "./picto-defaults";
import { TaskCard } from "./task-card";
import { taskPictoOf } from "./task-picto";
import { TOD_PICTO } from "./time-of-day-header";
import { CHORE_ICONS } from "./types";
import type { Chore, ChoreInput, ChoreMember } from "./types";

type ChoreDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: readonly ChoreMember[];
  chore: Chore | null;
  initial?: { memberId?: string | null };
  onSave: (input: ChoreInput, choreId: string | null) => Promise<void>;
  onDelete: (choreId: string) => Promise<void>;
};

type FormState = {
  picto: PictoName | null;
  customEmoji: string;
  memberId: string | null;
  timeOfDay: ChoreTimeOfDay | null;
  points: number;
  title: string;
};

type Touched = { title: boolean; when: boolean; stars: boolean };

const TIME_CHOICES: ReadonlyArray<ChoreTimeOfDay | null> = ["MORNING", "DAY", "EVENING", null];
const BASE_STARS = [1, 2, 3, 4, 5] as const;
const MORE_STARS = [6, 7, 8, 9, 10] as const;
const MAX_POINTS = 50;
const NOOP = () => undefined;

function todKey(value: ChoreTimeOfDay | null): "MORNING" | "DAY" | "EVENING" | "ANYTIME" {
  return value ?? "ANYTIME";
}

function makeState(chore: Chore | null, initial?: ChoreDialogProps["initial"]): FormState {
  if (chore) {
    const picto = taskPictoOf(chore.icon, chore.title);
    return {
      picto,
      customEmoji: !picto && chore.icon ? chore.icon : "",
      memberId: chore.memberId,
      timeOfDay: chore.timeOfDay,
      points: chore.points,
      title: chore.title,
    };
  }
  return {
    picto: null,
    customEmoji: "",
    memberId: initial?.memberId ?? null,
    timeOfDay: null,
    points: 1,
    title: "",
  };
}

function makeTouched(chore: Chore | null): Touched {
  const existing = Boolean(chore);
  return { title: existing, when: existing, stars: existing };
}

export function ChoreDialog({
  open,
  onOpenChange,
  members,
  chore,
  initial,
  onSave,
  onDelete,
}: ChoreDialogProps) {
  const t = useTranslations("chores.dialog");
  const tCommon = useTranslations("common");
  const tPicto = useTranslations("pictos");
  const [state, setState] = useState<FormState>(() => makeState(chore, initial));
  const [touched, setTouched] = useState<Touched>(() => makeTouched(chore));
  const [customOpen, setCustomOpen] = useState(false);
  const [moreStars, setMoreStars] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { activeField, bind, close: closeKeyboard } = useOskField<"title">();

  const choreId = chore?.id ?? null;
  const initialMemberId = initial?.memberId;

  useEffect(() => {
    if (open) {
      const next = makeState(chore, initial);
      setState(next);
      setTouched(makeTouched(chore));
      setCustomOpen(Boolean(next.customEmoji));
      setMoreStars(next.points > 5);
      setError(null);
    } else {
      closeKeyboard();
    }
    // `chore` and `initial` are identified by id; their object identity changes every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, choreId, initialMemberId]);

  const isEdit = Boolean(chore);
  const selectedMember = members.find((m) => m.id === state.memberId) ?? null;
  const canSave = state.title.trim().length > 0 && !submitting;

  function patch(p: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  function pickPicto(name: PictoName) {
    const defaults = PICTO_DEFAULTS[name];
    setCustomOpen(false);
    setState((prev) => ({
      ...prev,
      picto: name,
      customEmoji: "",
      title: touched.title ? prev.title : tPicto(name),
      timeOfDay: !touched.when && defaults ? defaults.timeOfDay : prev.timeOfDay,
      points: !touched.stars && defaults ? defaults.points : prev.points,
    }));
    if (!touched.stars && defaults) setMoreStars(defaults.points > 5);
  }

  function pickEmoji(emoji: string) {
    patch({ picto: null, customEmoji: emoji });
  }

  const previewChore = useMemo<Chore>(
    () => ({
      id: "preview",
      familyId: "",
      memberId: state.memberId,
      title: state.title.trim() || t("previewTitle"),
      icon: state.picto ? PICTO_META[state.picto].emoji : state.customEmoji || null,
      points: state.points,
      rrule: null,
      timeOfDay: state.timeOfDay,
      createdAt: "",
    }),
    [state, t],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: ChoreInput = {
        memberId: state.memberId,
        title: state.title.trim(),
        icon: state.picto ? PICTO_META[state.picto].emoji : state.customEmoji || null,
        points: Math.max(1, Math.min(MAX_POINTS, Math.round(state.points))),
        rrule: chore?.rrule ?? null,
        timeOfDay: state.timeOfDay,
      };
      await onSave(input, choreId);
      onOpenChange(false);
    } catch {
      setError("save");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!chore) return;
    try {
      await onDelete(chore.id);
      onOpenChange(false);
    } catch {
      setError("delete");
    }
  }

  const starRow = (values: readonly number[]) => (
    <div className="flex gap-2">
      {values.map((n) => {
        const filled = n <= state.points;
        return (
          <button
            key={n}
            type="button"
            onClick={() => {
              setTouched((p) => ({ ...p, stars: true }));
              patch({ points: n });
            }}
            aria-pressed={state.points === n}
            aria-label={t("starsN", { count: n })}
            className={cn(
              "relative flex size-14 items-center justify-center rounded-2xl border-2 focus-ring-kid",
              "transition-transform duration-100 ease-snappy active:scale-95",
              state.points === n ? "border-ink bg-surface shadow-pop" : "border-transparent bg-bg",
            )}
          >
            <Picto name="star" size={32} className={cn(!filled && "opacity-30 grayscale")} />
            <span
              aria-hidden
              className="kid-label tabular absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 text-bg"
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(820px,calc(100vw-2rem))] p-0" showClose={false} aria-describedby={undefined}>
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-3xl border-b border-border bg-surface px-6 pb-4 pt-5">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="kid-heading">{isEdit ? t("editTitle") : t("newTitle")}</DialogTitle>
                <DialogClose
                  className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface text-ink focus-ring-kid"
                  aria-label={tCommon("close")}
                >
                  <X className="size-6" strokeWidth={2.5} />
                </DialogClose>
              </div>
              <ul inert className="pointer-events-none mx-auto w-full max-w-[340px]">
                <TaskCard
                  chore={previewChore}
                  status="open"
                  color={selectedMember?.color ?? "sand"}
                  onPress={NOOP}
                />
              </ul>
            </div>

            <div className="flex flex-col gap-7 px-6 py-6">
              <Section label={t("sectionPicture")}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-x-6 gap-y-4">
                    {PICTO_GROUPS.map((group) => (
                      <div key={group.key} className="flex flex-col gap-2">
                        <span className="kid-label text-muted">{t(`cat.${group.key}`)}</span>
                        <div className="flex flex-wrap gap-2">
                          {group.pictos.map((name) => {
                            const selected = state.picto === name;
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => pickPicto(name)}
                                aria-pressed={selected}
                                className={cn(
                                  "relative flex min-h-[100px] w-[92px] flex-col items-center gap-1 rounded-2xl border-2 p-1.5 focus-ring-kid",
                                  "transition-transform duration-100 ease-snappy active:scale-95",
                                  selected ? "border-ink bg-surface shadow-pop" : "border-transparent bg-bg",
                                )}
                              >
                                <Picto name={name} size={52} />
                                <span className="line-clamp-2 break-words text-center text-xs font-semibold leading-4 text-ink [hyphens:auto]">
                                  {tPicto(name)}
                                </span>
                                {selected && (
                                  <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-bg">
                                    <Check className="size-4" strokeWidth={4} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomOpen((o) => !o)}
                      aria-expanded={customOpen}
                      className={cn(
                        "inline-flex h-14 w-fit items-center gap-2 rounded-2xl border-2 border-dashed px-4 focus-ring-kid",
                        "kid-label text-ink",
                        state.customEmoji ? "border-ink bg-surface" : "border-border bg-bg",
                      )}
                    >
                      <Smile className="size-6" strokeWidth={2.25} aria-hidden />
                      {t("ownEmoji")}
                      <ChevronDown
                        className={cn("size-5 transition-transform", customOpen && "rotate-180")}
                        aria-hidden
                      />
                    </button>
                    {customOpen && (
                      <div className="flex flex-wrap gap-2">
                        {CHORE_ICONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => pickEmoji(emoji)}
                            aria-pressed={state.customEmoji === emoji}
                            aria-label={emoji}
                            className={cn(
                              "flex size-14 items-center justify-center rounded-2xl border-2 text-3xl focus-ring-kid",
                              state.customEmoji === emoji ? "border-ink bg-surface shadow-pop" : "border-transparent bg-bg",
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section label={t("sectionWho")}>
                <div className="flex flex-wrap gap-2">
                  <PersonTile
                    selected={state.memberId === null}
                    label={tCommon("anyone")}
                    onClick={() => patch({ memberId: null })}
                  >
                    <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-muted bg-surface text-ink">
                      <Users className="size-7" strokeWidth={2} aria-hidden />
                    </span>
                  </PersonTile>
                  {members.map((m) => (
                    <PersonTile
                      key={m.id}
                      selected={state.memberId === m.id}
                      label={m.name}
                      tintClass={toneOf(m.color).tint}
                      onClick={() => patch({ memberId: m.id })}
                    >
                      <MemberAvatar size="md" name={m.name} color={m.color} emoji={m.emoji} />
                    </PersonTile>
                  ))}
                </div>
              </Section>

              <Section label={t("sectionWhen")}>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_CHOICES.map((choice) => {
                    const selected = state.timeOfDay === choice;
                    const key = todKey(choice);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setTouched((p) => ({ ...p, when: true }));
                          patch({ timeOfDay: choice });
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "relative flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 focus-ring-kid",
                          "transition-transform duration-100 ease-snappy active:scale-95",
                          selected ? "border-ink bg-surface shadow-pop" : "border-transparent bg-bg",
                        )}
                      >
                        <Picto name={TOD_PICTO[key]} size={56} />
                        <span className="kid-label text-ink">{tPicto(TOD_PICTO[key])}</span>
                        {selected && (
                          <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-bg">
                            <Check className="size-4" strokeWidth={4} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section label={t("sectionStars")}>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {starRow(BASE_STARS)}
                    {!moreStars && (
                      <button
                        type="button"
                        onClick={() => setMoreStars(true)}
                        className="inline-flex h-14 items-center rounded-2xl border-2 border-dashed border-border bg-bg px-4 kid-label text-ink focus-ring-kid"
                      >
                        {t("moreStars")}
                      </button>
                    )}
                  </div>
                  {moreStars && starRow(MORE_STARS)}
                  {state.points > 10 && (
                    <span className="kid-label tabular text-muted">{t("starsN", { count: state.points })}</span>
                  )}
                </div>
              </Section>

              <Section label={t("sectionTitle")}>
                <Input
                  value={state.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setTouched((p) => ({ ...p, title: title.trim() !== "" }));
                    patch({ title });
                  }}
                  placeholder={t("titlePlaceholder")}
                  maxLength={100}
                  {...bind("title")}
                />
                <InlineKeyboardPanel
                  open={activeField === "title"}
                  value={state.title}
                  onChange={(title) => {
                    setTouched((p) => ({ ...p, title: title.trim() !== "" }));
                    patch({ title });
                  }}
                />
              </Section>

              {error && (
                <p role="alert" className="text-sm text-danger-ink">
                  {error === "delete" ? t("couldNotDelete") : t("couldNotSave")}
                </p>
              )}
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-3xl border-t border-border bg-surface px-6 py-4">
              <div>
                {isEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    disabled={submitting}
                    className="text-danger-ink"
                  >
                    <Trash2 className="size-5" />
                    {t("delete")}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={!canSave} className="min-w-32">
                  {submitting ? tCommon("saving") : t("save")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle")}
        picto={state.picto ?? undefined}
        preview={
          state.picto ? undefined : state.customEmoji ? (
            <span className="text-6xl leading-none">{state.customEmoji}</span>
          ) : (
            <Picto name="star" size={88} />
          )
        }
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
      />
    </>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="kid-title text-ink">{label}</h3>
      {children}
    </section>
  );
}

type PersonTileProps = {
  selected: boolean;
  label: string;
  tintClass?: string;
  onClick: () => void;
  children: ReactNode;
};

function PersonTile({ selected, label, tintClass, onClick, children }: PersonTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-[104px] min-w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 focus-ring-kid",
        "transition-transform duration-100 ease-snappy active:scale-95",
        selected ? cn("border-ink shadow-pop", tintClass ?? "bg-surface") : "border-transparent bg-bg",
      )}
    >
      {children}
      <span className="kid-label line-clamp-1 max-w-24 break-words text-ink">{label}</span>
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-bg">
          <Check className="size-4" strokeWidth={4} />
        </span>
      )}
    </button>
  );
}
