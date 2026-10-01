import { Picto, resolveEventPicto } from "@/components/pictos";
import { toneOf } from "@/components/kids/tone";
import { cn } from "@/lib/utils";

type EventGlyphProps = {
  title: string;
  color: string;
  /** Day shown on the fallback calendar leaf. */
  date: Date;
  size: number;
  className?: string;
};

function CalendarLeaf({ color, date, size, className }: Omit<EventGlyphProps, "title">) {
  const tone = toneOf(color);
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 flex-col overflow-hidden rounded-[22%] border-2",
        "border-[hsl(var(--picto-line))] bg-[hsl(var(--picto-white))]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className={cn("block shrink-0 border-b-2 border-[hsl(var(--picto-line))]", tone.bg)} style={{ height: "30%" }} />
      <span
        className="flex flex-1 items-center justify-center font-display font-bold leading-none tabular text-[hsl(var(--picto-line))]"
        style={{ fontSize: size * 0.4 }}
      >
        {date.getDate()}
      </span>
    </span>
  );
}

/** Picture for an event: a matching motif from the title, else a calendar leaf in the person's colour. */
export function EventGlyph({ title, color, date, size, className }: EventGlyphProps) {
  const picto = resolveEventPicto(null, title);
  if (picto) return <Picto name={picto} size={size} className={className} />;
  return <CalendarLeaf color={color} date={date} size={size} className={className} />;
}
