"use client";

import { useTranslations } from "next-intl";
import { Calendar, Users, CloudSun } from "lucide-react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { LocaleSelect } from "@/components/shared/locale-picker";

type StepWelcomeProps = {
  onNext: () => void;
};

export function StepWelcome({ onNext }: StepWelcomeProps) {
  const t = useTranslations("setup.welcome");

  const bullets = [
    {
      icon: Users,
      title: t("bullet1Title"),
      description: t("bullet1Desc"),
      bg: "bg-accent-peach",
    },
    {
      icon: Calendar,
      title: t("bullet2Title"),
      description: t("bullet2Desc"),
      bg: "bg-accent-mint",
    },
    {
      icon: CloudSun,
      title: t("bullet3Title"),
      description: t("bullet3Desc"),
      bg: "bg-accent-sun",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted text-sm font-medium tracking-wide uppercase">
            {t("welcome")}
          </p>
          <LocaleSelect />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          {t("title")}
        </h1>
        <p className="text-muted text-lg max-w-xl">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {bullets.map(({ icon: Icon, title, description, bg }) => (
          <GlassCard key={title} className="p-5">
            <div
              className={`size-12 rounded-2xl ${bg} flex items-center justify-center mb-4`}
            >
              <Icon className="size-6 text-ink" strokeWidth={2} />
            </div>
            <h3 className="font-display text-lg mb-1">{title}</h3>
            <p className="text-muted text-sm leading-snug">{description}</p>
          </GlassCard>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={onNext}>
          {t("start")}
        </Button>
      </div>
    </div>
  );
}
