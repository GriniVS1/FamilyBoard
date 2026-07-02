"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { GlassCard } from "@/components/shared/glass-card";
import {
  MemberColorSwatch,
  memberColorClass,
} from "@/components/shared/member-color-swatch";
import { MEMBER_COLORS, type MemberColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MEMBER_EMOJIS, postJson, type DraftMember } from "./types";

const MAX_MEMBERS = 8;

type StepMembersProps = {
  onComplete: () => void;
  onBack: () => void;
};

type ServerMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultMember(index: number): DraftMember {
  return {
    id: makeId(),
    name: "",
    color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    emoji: MEMBER_EMOJIS[index % MEMBER_EMOJIS.length],
    role: index === 0 ? "ADMIN" : "MEMBER",
  };
}

export function StepMembers({ onComplete, onBack }: StepMembersProps) {
  const t = useTranslations("setup.members");
  const tCommon = useTranslations("common");
  const [members, setMembers] = useState<DraftMember[]>([defaultMember(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMember(id: string, patch: Partial<DraftMember>) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  function addMember() {
    if (members.length >= MAX_MEMBERS) return;
    setMembers((prev) => [...prev, defaultMember(prev.length)]);
  }

  function removeMember(id: string) {
    setMembers((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((m) => m.id !== id);
      return next.map((m, idx) => ({
        ...m,
        role: idx === 0 ? "ADMIN" : "MEMBER",
      }));
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleaned = members
      .map((m) => ({ ...m, name: m.name.trim() }))
      .filter((m) => m.name.length > 0);

    if (cleaned.length === 0) {
      setError(t("atLeastOne"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await postJson<ServerMember[]>("/api/setup/members", {
        members: cleaned.map((m) => ({
          name: m.name,
          color: m.color,
          emoji: m.emoji,
          role: m.role,
        })),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="space-y-3">
        <p className="text-muted text-sm font-medium tracking-wide uppercase">
          {t("step")}
        </p>
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          {t("title")}
        </h2>
        <p className="text-muted text-lg">
          {t("hint", { max: MAX_MEMBERS })}
        </p>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {members.map((member, idx) => (
            <motion.div
              key={member.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard className="p-5 space-y-5">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "size-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl",
                      memberColorClass(member.color),
                    )}
                  >
                    {member.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      value={member.name}
                      onChange={(e) =>
                        updateMember(member.id, { name: e.target.value })
                      }
                      placeholder={t("namePlaceholder", { n: idx + 1 })}
                      maxLength={40}
                      aria-label={t("namePlaceholder", { n: idx + 1 })}
                    />
                    {idx === 0 && (
                      <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-ink text-bg">
                        {tCommon("admin")}
                      </span>
                    )}
                  </div>
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="size-12 tap-target rounded-full text-muted hover:text-ink hover:bg-bg flex items-center justify-center transition-colors"
                      aria-label={t("remove", { n: idx + 1 })}
                    >
                      <X className="size-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-muted font-medium uppercase tracking-wide">
                    {t("emoji")}
                  </p>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                    {MEMBER_EMOJIS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => updateMember(member.id, { emoji })}
                        className={cn(
                          "size-12 tap-target rounded-2xl flex items-center justify-center text-2xl transition-[background-color,box-shadow,color,transform] ease-snappy",
                          member.emoji === emoji
                            ? "bg-bg ring-2 ring-ink"
                            : "bg-bg/60 hover:bg-bg",
                        )}
                        aria-label={`Emoji ${emoji}`}
                        aria-pressed={member.emoji === emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-muted font-medium uppercase tracking-wide">
                    {t("color")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MEMBER_COLORS.map((color) => (
                      <MemberColorSwatch
                        key={color}
                        color={color as MemberColor}
                        selected={member.color === color}
                        onClick={() => updateMember(member.id, { color })}
                      />
                    ))}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={addMember}
          disabled={members.length >= MAX_MEMBERS}
          className="w-full"
        >
          <Plus className="size-5" />
          {t("addMember")}
          {members.length >= MAX_MEMBERS && (
            <span className="text-muted text-sm ml-1">{t("maxReached", { max: MAX_MEMBERS })}</span>
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-accent-rose" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3">
        <Button type="button" variant="ghost" size="lg" onClick={onBack}>
          {tCommon("back")}
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? tCommon("saving") : t("next")}
        </Button>
      </div>
    </form>
  );
}
