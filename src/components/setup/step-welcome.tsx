"use client";

import { Calendar, Users, CloudSun } from "lucide-react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";

type StepWelcomeProps = {
  onNext: () => void;
};

const BULLETS = [
  {
    icon: Users,
    title: "Family at a glance",
    description: "Each member gets a color and emoji.",
    bg: "bg-accent-peach",
  },
  {
    icon: Calendar,
    title: "Shared calendar",
    description: "Plan together, sync with Google.",
    bg: "bg-accent-mint",
  },
  {
    icon: CloudSun,
    title: "Today's weather",
    description: "A friendly forecast on the dashboard.",
    bg: "bg-accent-sun",
  },
] as const;

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div className="flex flex-col gap-10">
      <div className="space-y-3">
        <p className="text-muted text-sm font-medium tracking-wide uppercase">
          Welcome
        </p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          Let&apos;s set up your FamilyBoard
        </h1>
        <p className="text-muted text-lg max-w-xl">
          A calm, colorful command center for the whole family. Takes about two
          minutes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {BULLETS.map(({ icon: Icon, title, description, bg }) => (
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
          Get started
        </Button>
      </div>
    </div>
  );
}
