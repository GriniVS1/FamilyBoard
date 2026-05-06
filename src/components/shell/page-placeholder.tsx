import { GlassCard } from "@/components/shared/glass-card";

type PagePlaceholderProps = {
  title: string;
  message?: string;
};

export function PagePlaceholder({ title, message }: PagePlaceholderProps) {
  return (
    <GlassCard className="p-8">
      <h2 className="font-display text-3xl tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-muted">{message ?? `${title} — coming up next.`}</p>
    </GlassCard>
  );
}
