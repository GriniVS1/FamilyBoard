"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Picto } from "@/components/pictos";

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };

export type CelebrationEvent = {
  id: number;
  /** Viewport coordinates the stars leave from (the tapped card's ring). */
  from: Point;
  /** Star counter the stars fly to; null when it is off screen. */
  to: Point | null;
  points: number;
  memberId: string;
  /** Set when the person's whole column is done: adds confetti and the trophy. */
  column: Rect | null;
  /** Announced to screen readers; the visuals are decorative. */
  label: string;
};

export type CelebrationInput = Omit<CelebrationEvent, "id">;

const STAR_COUNT = 6;
const FLIGHT_MS = 950;
const ITEM_MS = 1300;
const COLUMN_MS = 2000;
const CONFETTI_COUNT = 24;

const CONFETTI_COLORS = [
  "bg-accent-peach",
  "bg-accent-mint",
  "bg-accent-sun",
  "bg-accent-sky",
  "bg-accent-lilac",
  "bg-accent-rose",
  "bg-accent-teal",
  "bg-accent-sand",
] as const;

export function useCelebration() {
  const [events, setEvents] = useState<CelebrationEvent[]>([]);

  const fire = useCallback((input: CelebrationInput) => {
    setEvents((list) => [...list, { ...input, id: Date.now() + list.length }]);
  }, []);

  const remove = useCallback((id: number) => {
    setEvents((list) => list.filter((e) => e.id !== id));
  }, []);

  return { events, fire, remove };
}

type CelebrationLayerProps = {
  events: CelebrationEvent[];
  onRemove: (id: number) => void;
  /** Called when the flying stars reach the counter so it can pulse. */
  onArrive?: (memberId: string) => void;
};

/**
 * Portalled to <body>: a transformed ancestor (route transitions) would
 * otherwise turn `fixed` into "fixed to that ancestor".
 */
export function CelebrationLayer({ events, onRemove, onArrive }: CelebrationLayerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const latest = events[events.length - 1];

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
        {events.map((event) => (
          <CelebrationItem key={event.id} event={event} onRemove={onRemove} onArrive={onArrive} />
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {latest?.label}
      </p>
    </>,
    document.body,
  );
}

type CelebrationItemProps = {
  event: CelebrationEvent;
  onRemove: (id: number) => void;
  onArrive?: (memberId: string) => void;
};

function CelebrationItem({ event, onRemove, onArrive }: CelebrationItemProps) {
  const reduced = useReducedMotion();
  const { id, from, to, points, memberId, column } = event;

  useEffect(() => {
    const arrive = window.setTimeout(() => onArrive?.(memberId), reduced ? 0 : FLIGHT_MS);
    const end = window.setTimeout(() => onRemove(id), column ? COLUMN_MS : ITEM_MS + (reduced ? 400 : 0));
    return () => {
      window.clearTimeout(arrive);
      window.clearTimeout(end);
    };
  }, [id, memberId, column, reduced, onArrive, onRemove]);

  return (
    <>
      {!reduced &&
        Array.from({ length: STAR_COUNT }, (_, i) => (
          <FlyingStar key={i} index={i} from={from} to={to} />
        ))}

      <div
        className="absolute -translate-x-1/2 -translate-y-full"
        style={{ left: from.x, top: from.y - 28 }}
      >
        <div className="animate-reward-rise inline-flex h-10 items-center gap-1 rounded-full bg-accent-sun px-4 text-on-accent shadow-pop">
          <Picto name="star" size={24} />
          <span className="kid-number">+{points}</span>
        </div>
      </div>

      {column && <ColumnFinale rect={column} reduced={Boolean(reduced)} />}
    </>
  );
}

type FlyingStarProps = {
  index: number;
  from: Point;
  to: Point | null;
};

function FlyingStar({ index, from, to }: FlyingStarProps) {
  const spread = 120;
  const angle = ((-90 - spread / 2 + (spread / (STAR_COUNT - 1)) * index) * Math.PI) / 180;
  const radius = 56 + (index % 2) * 18;
  const burstX = Math.cos(angle) * radius;
  const burstY = Math.sin(angle) * radius;
  const endX = to ? to.x - from.x : burstX * 1.6;
  const endY = to ? to.y - from.y : burstY * 1.6;
  const delay = index * 0.045;

  return (
    <motion.div
      className="absolute"
      style={{ left: from.x - 14, top: from.y - 14 }}
      initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
      animate={{
        x: [0, burstX, endX],
        y: [0, burstY, endY],
        scale: [0.3, 1.15, 0.6],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        delay,
        x: { duration: FLIGHT_MS / 1000, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] },
        y: { duration: FLIGHT_MS / 1000, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] },
        scale: { duration: FLIGHT_MS / 1000, times: [0, 0.3, 1] },
        opacity: { duration: FLIGHT_MS / 1000, times: [0, 0.12, 0.85, 1] },
      }}
    >
      <Picto name="star" size={28} />
    </motion.div>
  );
}

function ColumnFinale({ rect, reduced }: { rect: Rect; reduced: boolean }) {
  const centerX = rect.left + rect.width / 2;

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: COLUMN_MS / 1000, times: [0, 0.8, 1] }}
    >
      <div
        className="absolute -translate-x-1/2"
        style={{ left: centerX, top: rect.top + Math.min(120, rect.height / 4) }}
      >
        <div className="animate-pop-in">
          <Picto name="celebrate" size={120} />
        </div>
      </div>
      {!reduced &&
        Array.from({ length: CONFETTI_COUNT }, (_, i) => {
          const dx = (((i * 37) % 100) - 50) * (rect.width / 100);
          const dy = 140 + ((i * 53) % 100) * 2.6;
          const rot = ((i * 97) % 720) - 360;
          return (
            <span
              key={i}
              className={`animate-confetti absolute block h-[10px] w-[6px] rounded-[2px] ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
              style={
                {
                  left: centerX,
                  top: rect.top + 32,
                  "--fly-x": `${dx}px`,
                  "--fly-y": `${dy}px`,
                  "--fly-r": `${rot}deg`,
                  animationDelay: `${(i % 6) * 30}ms`,
                } as CSSProperties
              }
            />
          );
        })}
    </motion.div>
  );
}
