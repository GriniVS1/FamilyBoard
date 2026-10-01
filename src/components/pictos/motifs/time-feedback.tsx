import { C } from "../palette";
import { Detail, Dot, Lines, Shine, Tube, crescentPath, dropPath, sparklePath, starPath } from "../parts";
import type { Motif } from "../types";

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const ray = (cx: number, cy: number, from: number, to: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(cx + from * Math.cos(a))} ${f(cy + from * Math.sin(a))} L${f(cx + to * Math.cos(a))} ${f(cy + to * Math.sin(a))}`;
};

const morning: Motif = {
  motion: "float",
  origin: "32px 46px",
  move: (
    <>
      {[200, 235, 270, 305, 340].map((deg) => (
        <Tube key={deg} d={ray(32, 44, 20, 26, deg)} color={C.orange} width={3.5} />
      ))}
      <circle cx={32} cy={44} r={14} fill={C.orange} />
      <Shine d="M22.5 40 Q24 34.5 29 32.5" width={3} />
    </>
  ),
  front: (
    <>
      <path d="M3 46 Q18 40 32 44 Q46 48 61 43 V56 A4 4 0 0 1 57 60 H7 A4 4 0 0 1 3 56 Z" fill={C.green} />
      <Detail d="M12 52 Q16 50.5 20 51.5 M40 53 Q45 51.5 50 52.5" color={C.leaf} width={2.5} />
    </>
  ),
};

const day: Motif = {
  motion: "spin",
  origin: "32px 32px",
  move: (
    <>
      {RAY_ANGLES.map((deg) => (
        <Tube key={deg} d={ray(32, 32, 20.5, 26.5, deg)} color={C.yellow} width={4} />
      ))}
    </>
  ),
  front: (
    <>
      <circle cx={32} cy={32} r={15} fill={C.yellow} />
      <Shine d="M21.5 28 Q23 22.5 28 20.5" width={3} />
      <Dot cx={27} cy={31} />
      <Dot cx={37} cy={31} />
      <Detail d="M27 36.5 Q32 40.5 37 36.5" />
      <Dot cx={23.5} cy={36} r={2} color={C.orange} />
      <Dot cx={40.5} cy={36} r={2} color={C.orange} />
    </>
  ),
};

const evening: Motif = {
  motion: "float",
  back: (
    <>
      <path d={crescentPath(28, 34, 22, 40, 24, 18)} fill={C.yellow} />
      <Shine d="M11 37 Q11.5 46 18.5 51" width={3} />
      <Dot cx={20} cy={36} r={2} />
      <Detail d="M17.5 42.5 Q21 45.5 24.5 42.5" />
      <Dot cx={14.5} cy={40.5} r={1.9} color={C.orange} />
    </>
  ),
  move: (
    <>
      <path d={starPath(47, 12, 6)} fill={C.white} />
      <path d={starPath(55, 31, 4)} fill={C.white} strokeWidth={2.25} />
      <path d={sparklePath(36, 8, 3.2)} fill={C.white} strokeWidth={2} />
    </>
  ),
};

// S-shaped split, not a straight diagonal: a circle with a slash reads as "forbidden".
const anytime: Motif = {
  motion: "spin",
  origin: "32px 32px",
  move: (
    <>
      <path d="M49.68 14.32 C30 20 34 44 14.32 49.68 A25 25 0 0 1 49.68 14.32 Z" fill={C.water} />
      <path d="M49.68 14.32 C30 20 34 44 14.32 49.68 A25 25 0 0 0 49.68 14.32 Z" fill={C.purple} />
      <Detail d={[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => ray(21.5, 24, 8.5, 11.5, deg)).join(" ")} color={C.orange} width={2.5} />
      <circle cx={21.5} cy={24} r={6.2} fill={C.yellow} />
      <path d={crescentPath(42, 41.5, 8, 46.5, 37.5, 7)} fill={C.yellow} strokeWidth={2.25} />
      <path d={sparklePath(49, 27, 3)} fill={C.white} strokeWidth={1.75} />
      <Shine d="M11 33 Q11.3 38 13.5 41.5" width={2.75} />
    </>
  ),
};

const night: Motif = {
  motion: "float",
  back: (
    <>
      <path d={crescentPath(26, 37, 20, 37, 30, 16)} fill={C.yellow} />
      <Shine d="M9 38 Q9.5 47 16 52" width={3} />
      <Detail d="M11.5 34 Q14 36.5 16.5 34" />
      <Detail d="M13.5 43 Q16 45 18.5 43" />
      <Dot cx={10.5} cy={39.5} r={1.8} color={C.orange} />
      <path d="M17.5 21 Q19 9.5 31.5 6.5 Q42 4.5 47 11 Q38.5 9.5 33 17.5 Z" fill={C.blue} />
      <Tube d="M17.5 21 Q25 15.5 33 17.5" color={C.white} width={3.5} />
      <circle cx={47.5} cy={12} r={3.6} fill={C.white} />
    </>
  ),
  move: (
    <>
      <Lines d="M38 26 H45 L38 33 H45" width={3} />
      <Lines d="M48.5 17.5 H54 L48.5 23 H54" width={2.75} />
    </>
  ),
};

const pause: Motif = {
  motion: "wiggle",
  move: (
    <>
      <path d="M18 11 H46 Q46 24 35 31 V33 Q46 40 46 53 H18 Q18 40 29 33 V31 Q18 24 18 11 Z" fill={C.white} />
      <path d="M23.5 19 H40.5 Q38.5 25.5 32 28.5 Q25.5 25.5 23.5 19 Z" fill={C.yellow} strokeWidth={2} />
      <path d="M21.5 51 Q32 38.5 42.5 51 Z" fill={C.yellow} strokeWidth={2} />
      <Detail d="M32 30 V44" color={C.yellow} width={2.25} />
      <path d="M18 11 H46 Q46 24 35 31 V33 Q46 40 46 53 H18 Q18 40 29 33 V31 Q18 24 18 11 Z" />
      <Shine d="M22 15 Q22.5 21 26 25" width={2.5} />
      <rect x={13} y={5} width={38} height={7} rx={3.5} fill={C.wood} />
      <rect x={13} y={52} width={38} height={7} rx={3.5} fill={C.wood} />
    </>
  ),
};

const celebrate: Motif = {
  motion: "bounce",
  origin: "32px 58px",
  back: (
    <>
      <path d={starPath(9, 40, 5)} fill={C.red} strokeWidth={2.25} />
      <path d={starPath(55, 38, 5)} fill={C.blue} strokeWidth={2.25} />
      <path d={sparklePath(8, 15, 4.5)} fill={C.yellow} />
      <path d={sparklePath(56, 12, 4)} fill={C.yellow} />
      <Dot cx={14} cy={27} r={2} color={C.purple} />
      <Dot cx={51} cy={25} r={2} color={C.green} />
    </>
  ),
  move: (
    <>
      <Tube d="M21 13.5 H14.5 Q13 23.5 21.5 27" color={C.yellow} width={2.5} />
      <Tube d="M43 13.5 H49.5 Q51 23.5 42.5 27" color={C.yellow} width={2.5} />
      <rect x={28.5} y={36} width={7} height={10} fill={C.yellow} />
      <path d="M19 9 H45 V22 Q45 36 32 37 Q19 36 19 22 Z" fill={C.yellow} />
      <path d={starPath(32, 22, 6)} fill={C.white} strokeWidth={2.25} />
      <rect x={20} y={45} width={24} height={7} rx={2} fill={C.wood} />
      <rect x={16} y={51.5} width={32} height={7} rx={2.5} fill={C.brown} />
      <Shine d="M23 13 V22 Q23 26 25 29" width={3} />
    </>
  ),
};

const oops: Motif = {
  motion: "wiggle",
  origin: "32px 48px",
  move: (
    <>
      <path d="M15 48 A10.5 10.5 0 0 1 13 27.2 A13 13 0 0 1 37 18.5 A11.5 11.5 0 0 1 52 30 A9 9 0 0 1 50 48 Z" fill={C.water} />
      <Shine d="M13 35 Q14 30.5 18.5 29" width={3} />
      <Dot cx={25} cy={36} />
      <Dot cx={37} cy={36} />
      <Detail d="M27 42.5 Q29 40.5 31 42.5 Q33 44.5 35 42.5" />
      <g transform="rotate(-35 42 24)">
        <rect x={31} y={19.5} width={22} height={9} rx={4.5} fill={C.skin} />
        <rect x={38.5} y={19.5} width={7} height={9} fill={C.cream} strokeWidth={2} />
        <Dot cx={41} cy={22.5} r={0.9} color={C.wood} />
        <Dot cx={43} cy={25.5} r={0.9} color={C.wood} />
      </g>
      <path d={dropPath(9, 10, 3)} fill={C.blue} strokeWidth={2.25} />
    </>
  ),
};

const relax: Motif = {
  motion: "wiggle",
  origin: "42px 44px",
  back: <Tube d="M18 47 L13.5 57.5 M50 47 L54.5 57.5" color={C.steel} width={2.5} />,
  move: (
    <>
      <Tube d="M42 13 V44" color={C.steel} width={2} />
      <path d="M24 17 Q42 1 60 17 Q55 14 51 17 Q46.5 13.5 42 17 Q37.5 13.5 33 17 Q29 14 24 17 Z" fill={C.red} />
      <path d="M33 17 Q37.5 13.5 42 17 Q42 7 42 5.2 Q35 7.5 33 17 Z" fill={C.white} strokeWidth={2.25} />
      <path d="M51 17 Q55 14 60 17 Q56.5 8.5 49.5 6.5 Q51.5 11 51 17 Z" fill={C.white} strokeWidth={2.25} />
    </>
  ),
  front: (
    <>
      <path d="M6 29 Q6 23.5 11 24.5 L21 39 H54 Q58.5 39 58.5 43.5 Q58.5 48 54 48 H19 Q15.5 48 13.5 44.5 Z" fill={C.blue} />
      <Shine d="M11 29 L18.5 40.5" width={2.5} />
      <Detail d="M24 43.5 H52" color={C.water} width={2.5} />
    </>
  ),
};

const star: Motif = {
  motion: "bounce",
  origin: "32px 58px",
  move: (
    <>
      <path d={starPath(32, 34, 27, 13)} fill={C.yellow} />
      <Shine d="M20 28.5 L26.5 26.5" width={3} />
    </>
  ),
};

const undo: Motif = {
  motion: "wiggle",
  origin: "32px 34px",
  move: (
    <>
      <path d="M21 24 H38 A13 13 0 0 1 38 50 H27" stroke={C.line} strokeWidth={12} fill="none" />
      <path d="M6.5 24 L22 11.5 V36.5 Z" fill={C.blue} />
      <path d="M20 24 H38 A13 13 0 0 1 38 50 H27" stroke={C.blue} strokeWidth={6.5} fill="none" />
      <Shine d="M38 24 A13 13 0 0 1 50 33" width={2.25} />
    </>
  ),
};

const next: Motif = {
  motion: "scrub",
  move: (
    <>
      <path d="M9 25 H33 V14 A2 2 0 0 1 36.2 12.4 L58 30.4 A2 2 0 0 1 58 33.6 L36.2 51.6 A2 2 0 0 1 33 50 V39 H9 A4 4 0 0 1 5 35 V29 A4 4 0 0 1 9 25 Z" fill={C.green} />
      <Shine d="M10 29.5 H30" width={3} />
    </>
  ),
};

export const TIME_MOTIFS = {
  "tod-morning": morning,
  "tod-day": day,
  "tod-evening": evening,
  "tod-night": night,
  "tod-anytime": anytime,
} satisfies Record<string, Motif>;

export const FEEDBACK_MOTIFS = {
  celebrate,
  oops,
  relax,
  star,
  undo,
  next,
  pause,
} satisfies Record<string, Motif>;
