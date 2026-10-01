import { C } from "../palette";
import { Detail, Dot, Shine, Tube, gearPath, starPath } from "../parts";
import type { Motif } from "../types";

const home: Motif = {
  motion: "bounce",
  origin: "32px 58px",
  move: (
    <>
      <rect x={41} y={10} width={7} height={14} rx={1.5} fill={C.brown} />
      <rect x={13} y={27} width={38} height={31} rx={2.5} fill={C.white} />
      <path d="M5 30 L32 8 L59 30 Z" fill={C.red} />
      <path d="M27 58 V46 A5 5 0 0 1 37 46 V58 Z" fill={C.blue} />
      <Dot cx={34.5} cy={52} r={1.3} color={C.yellow} />
      <rect x={17} y={35} width={8} height={8} rx={1.5} fill={C.yellow} />
      <rect x={39} y={35} width={8} height={8} rx={1.5} fill={C.yellow} />
      <Shine d="M13 26 L28 13.5" width={2.5} />
    </>
  ),
};

const calendar: Motif = {
  motion: "wiggle",
  origin: "32px 10px",
  move: (
    <>
      <rect x={7} y={11} width={50} height={48} rx={6} fill={C.white} />
      <path d="M7 17 A6 6 0 0 1 13 11 H51 A6 6 0 0 1 57 17 V25 H7 Z" fill={C.red} />
      <rect x={17} y={5} width={6} height={12} rx={3} fill={C.steel} />
      <rect x={41} y={5} width={6} height={12} rx={3} fill={C.steel} />
      <Dot cx={17} cy={34} r={2.4} color={C.gray} />
      <Dot cx={27} cy={34} r={2.4} color={C.gray} />
      <Dot cx={37} cy={34} r={2.4} color={C.gray} />
      <Dot cx={47} cy={34} r={2.4} color={C.gray} />
      <Dot cx={17} cy={43} r={2.4} color={C.gray} />
      <Dot cx={27} cy={43} r={2.4} color={C.gray} />
      <Dot cx={17} cy={52} r={2.4} color={C.gray} />
      <Dot cx={27} cy={52} r={2.4} color={C.gray} />
      <path d={starPath(42, 48, 9)} fill={C.yellow} />
      <Shine d="M11.5 20.5 V18 A3 3 0 0 1 14.5 15" width={2.25} />
    </>
  ),
};

const meals: Motif = {
  motion: "wiggle",
  move: (
    <>
      <circle cx={32} cy={33} r={17} fill={C.blue} />
      <circle cx={32} cy={33} r={11} fill={C.white} />
      <Shine d="M20 27 Q22 21.5 27 19.5" width={2.75} />
      <path d="M3.5 9 H12.5 V20 Q12.5 25 10 26 V55 A2 2 0 0 1 6 55 V26 Q3.5 25 3.5 20 Z" fill={C.steel} />
      <Detail d="M6.5 9.5 V18 M9.5 9.5 V18" width={2} />
      <path d="M53 57 V9 Q60.5 13 60.5 30 V33 H57 V57 A2 2 0 0 1 53 57 Z" fill={C.steel} />
    </>
  ),
};

const tasks: Motif = {
  motion: "bounce",
  origin: "32px 58px",
  move: (
    <>
      <path d={starPath(32, 34, 27, 13)} fill={C.yellow} />
      <Tube d="M23 34.5 L29.5 41 L41.5 28.5" color={C.white} width={4.5} />
      <Shine d="M20 28.5 L26.5 26.5" width={3} />
    </>
  ),
};

const more: Motif = {
  motion: "bounce",
  origin: "32px 58px",
  move: (
    <>
      <rect x={7} y={7} width={22} height={22} rx={6.5} fill={C.blue} />
      <rect x={35} y={7} width={22} height={22} rx={6.5} fill={C.orange} />
      <rect x={7} y={35} width={22} height={22} rx={6.5} fill={C.yellow} />
      <rect x={35} y={35} width={22} height={22} rx={6.5} fill={C.green} />
      <Shine d="M11.5 18 Q11.5 12 16 11.5" width={2.75} />
    </>
  ),
};

const todos: Motif = {
  motion: "wiggle",
  origin: "32px 8px",
  move: (
    <>
      <rect x={9} y={8} width={46} height={53} rx={5} fill={C.wood} />
      <rect x={14.5} y={14} width={35} height={42} rx={2} fill={C.white} />
      <path d="M23 5 H41 V13 A2.5 2.5 0 0 1 38.5 15.5 H25.5 A2.5 2.5 0 0 1 23 13 Z" fill={C.steel} />
      <rect x={19} y={22} width={7} height={7} rx={1.8} fill={C.white} strokeWidth={2.25} />
      <Detail d="M20 25.5 L22 27.5 L25.5 23" color={C.leaf} width={2.5} />
      <Detail d="M30 25.5 H44" color={C.gray} width={3} />
      <rect x={19} y={33} width={7} height={7} rx={1.8} fill={C.white} strokeWidth={2.25} />
      <Detail d="M20 36.5 L22 38.5 L25.5 34" color={C.leaf} width={2.5} />
      <Detail d="M30 36.5 H44" color={C.gray} width={3} />
      <rect x={19} y={44} width={7} height={7} rx={1.8} fill={C.white} strokeWidth={2.25} />
      <Detail d="M30 47.5 H40" color={C.gray} width={3} />
    </>
  ),
};

const notes: Motif = {
  motion: "wiggle",
  origin: "32px 12px",
  move: (
    <>
      <path d="M9 14 A3 3 0 0 1 12 11 H52 A3 3 0 0 1 55 14 V45 L43 57 H12 A3 3 0 0 1 9 54 Z" fill={C.yellow} />
      <path d="M55 45 H46 A3 3 0 0 0 43 48 V57 Z" fill={C.orange} />
      <Detail d="M17 26 H46 M17 34 H43 M17 42 H33" color={C.orange} width={3} />
      <circle cx={32} cy={11} r={5.5} fill={C.red} />
      <Dot cx={30.3} cy={9.4} r={1.4} color={C.shine} />
    </>
  ),
};

const photos: Motif = {
  motion: "wiggle",
  move: (
    <g transform="rotate(-6 32 32)">
      <rect x={5} y={10} width={54} height={44} rx={5} fill={C.wood} />
      <rect x={11} y={16} width={42} height={32} rx={2} fill={C.water} />
      <path d="M11 48 V44 L25 29 L34 39 L40.5 32.5 L53 44.5 V48 Z" fill={C.green} />
      <circle cx={43} cy={24.5} r={4.5} fill={C.yellow} />
      <Shine d="M9 20 V15.5 A2.5 2.5 0 0 1 11.5 13" width={2.25} />
    </g>
  ),
};

const settings: Motif = {
  motion: "spin",
  origin: "32px 32px",
  move: (
    <>
      <path d={gearPath(32, 32, 26, 19.5, 8)} fill={C.steel} />
      <circle cx={32} cy={32} r={9} fill={C.white} />
      <Shine d="M17 26 Q19.5 19.5 25.5 17" width={2.75} />
    </>
  ),
};

export const NAV_MOTIFS = {
  "nav-home": home,
  "nav-calendar": calendar,
  "nav-meals": meals,
  "nav-tasks": tasks,
  "nav-todos": todos,
  "nav-notes": notes,
  "nav-photos": photos,
  "nav-settings": settings,
  "nav-more": more,
} satisfies Record<string, Motif>;
