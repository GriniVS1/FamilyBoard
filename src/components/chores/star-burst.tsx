"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

type Burst = {
  id: number;
  x: number;
  y: number;
};

type StarBurstProps = {
  burst: Burst | null;
  onDone: (id: number) => void;
};

const STAR_COUNT = 5;
const FAN_DEGREES = 110;
const RADIUS = 56;

function fanOffsets(): Array<{ dx: number; dy: number; rotate: number }> {
  const startAngle = -90 - FAN_DEGREES / 2;
  const step = STAR_COUNT > 1 ? FAN_DEGREES / (STAR_COUNT - 1) : 0;
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const angleDeg = startAngle + step * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angleRad) * RADIUS;
    const dy = Math.sin(angleRad) * RADIUS;
    return { dx, dy, rotate: angleDeg + 90 };
  });
}

const OFFSETS = fanOffsets();

export function StarBurst({ burst, onDone }: StarBurstProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {burst && <Burst key={burst.id} burst={burst} onDone={onDone} />}
      </AnimatePresence>
    </div>
  );
}

function Burst({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDone(burst.id), 700);
    return () => window.clearTimeout(t);
  }, [burst.id, onDone]);

  return (
    <div
      className="absolute"
      style={{ left: burst.x, top: burst.y, transform: "translate(-50%, -50%)" }}
      aria-hidden
    >
      {OFFSETS.map((o, i) => (
        <motion.span
          key={i}
          className="absolute left-0 top-0 block text-accent-sun"
          initial={{ x: 0, y: 0, scale: 0.5, opacity: 0, rotate: 0 }}
          animate={{
            x: [0, o.dx * 0.6, o.dx],
            y: [0, o.dy * 0.6, o.dy],
            scale: [0.5, 1.2, 1],
            opacity: [0, 1, 0],
            rotate: o.rotate,
          }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Star className="size-5 fill-current" strokeWidth={0} />
        </motion.span>
      ))}
    </div>
  );
}

export type { Burst };

export function useStarBurst() {
  const [burst, setBurst] = useState<Burst | null>(null);
  const [counter, setCounter] = useState(0);

  function trigger(x: number, y: number) {
    const id = counter + 1;
    setCounter(id);
    setBurst({ id, x, y });
  }

  function dismiss(id: number) {
    setBurst((curr) => (curr && curr.id === id ? null : curr));
  }

  return { burst, trigger, dismiss };
}
