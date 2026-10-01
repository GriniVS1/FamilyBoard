import { C, LINE_WIDTH } from "../palette";
import { Detail, Dot, Lines, Shine, Tube, circlePath, dropPath, starPath } from "../parts";
import type { Motif } from "../types";

const f = (n: number) => Math.round(n * 100) / 100;
function polygon(cx: number, cy: number, r: number, sides: number, rot = -90): string {
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = ((rot + (i * 360) / sides) * Math.PI) / 180;
    return `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  });
  return `M${pts.join(" L")} Z`;
}

const school: Motif = {
  motion: "bounce",
  origin: "32px 58px",
  move: (
    <>
      <rect x={24} y={12} width={16} height={16} fill={C.wood} />
      <path d="M21.5 13.5 L32 4 L42.5 13.5 Z" fill={C.red} />
      <circle cx={32} cy={20} r={4.6} fill={C.white} strokeWidth={2.25} />
      <Detail d="M32 17.5 V20 L34 21" width={1.75} />
      <rect x={6} y={27} width={52} height={31} rx={2} fill={C.wood} />
      <rect x={4} y={24.5} width={56} height={5} rx={2.5} fill={C.red} />
      <rect x={10.5} y={34} width={8} height={7} rx={1.5} fill={C.water} strokeWidth={2.25} />
      <rect x={10.5} y={46} width={8} height={7} rx={1.5} fill={C.water} strokeWidth={2.25} />
      <rect x={45.5} y={34} width={8} height={7} rx={1.5} fill={C.water} strokeWidth={2.25} />
      <rect x={45.5} y={46} width={8} height={7} rx={1.5} fill={C.water} strokeWidth={2.25} />
      <path d="M25 58 V42 A7 7 0 0 1 39 42 V58 Z" fill={C.blue} />
      <Detail d="M32 36 V58" />
    </>
  ),
};

const kindergarten: Motif = {
  motion: "drop",
  back: (
    <>
      <rect x={7} y={38} width={21} height={21} rx={3.5} fill={C.red} />
      <circle cx={17.5} cy={48.5} r={5} fill={C.white} strokeWidth={2.25} />
      <rect x={31} y={38} width={21} height={21} rx={3.5} fill={C.blue} />
      <path d="M41.5 42.5 L47.5 53 H35.5 Z" fill={C.white} strokeWidth={2.25} />
      <Shine d="M10.5 42 V46" />
    </>
  ),
  move: (
    <g transform="rotate(-8 29.5 25)">
      <rect x={19} y={14.5} width={21} height={21} rx={3.5} fill={C.yellow} />
      <path d={starPath(29.5, 25.5, 6.5)} fill={C.white} strokeWidth={2.25} />
    </g>
  ),
  front: <Lines d="M22 5 L23 8.5 M30 3.5 V7 M38 5 L37 8.5" />,
};

const soccer: Motif = {
  motion: "spin",
  origin: "37px 31px",
  back: (
    <>
      <Lines d="M2 22 H8 M1 31 H6.5 M2 40 H8" width={2.5} />
      <ellipse cx={37} cy={57.5} rx={19} ry={3.5} fill={C.green} />
    </>
  ),
  move: (
    <>
      <circle cx={37} cy={31} r={22} fill={C.white} />
      <path d={polygon(37, 31, 6.8, 5)} fill={C.line} />
      {[0, 72, 144, 216, 288].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        const inner = [37 + 6.8 * Math.cos(a), 31 + 6.8 * Math.sin(a)];
        const outer = [37 + 13.8 * Math.cos(a), 31 + 13.8 * Math.sin(a)];
        return (
          <g key={deg}>
            <Detail d={`M${f(inner[0])} ${f(inner[1])} L${f(outer[0])} ${f(outer[1])}`} width={2.25} />
            <path d={polygon(f(37 + 18 * Math.cos(a)), f(31 + 18 * Math.sin(a)), 4.2, 5, deg + 90)} fill={C.line} strokeWidth={1.5} />
          </g>
        );
      })}
      <circle cx={37} cy={31} r={22} />
      <Shine d="M20 24 Q22.5 16.5 29 13" width={3} />
    </>
  ),
};

const swim: Motif = {
  motion: "float",
  back: <path d="M3 40 Q10 35.5 17 40 T31 40 T45 40 T59 40 Q61 39 61 41 V60 H3 Z" fill={C.blue} />,
  move: (
    <>
      <circle cx={32} cy={30} r={11.5} stroke={C.line} strokeWidth={11 + LINE_WIDTH * 2} />
      <circle cx={32} cy={30} r={11.5} stroke={C.white} strokeWidth={11} />
      <circle
        cx={32}
        cy={30}
        r={11.5}
        stroke={C.red}
        strokeWidth={11}
        strokeDasharray="9.03 9.03"
        strokeDashoffset={4.5}
        strokeLinecap="butt"
      />
      <Shine d="M21 24 Q23 19.5 27.5 18" width={2.5} />
    </>
  ),
  front: (
    <>
      <path d="M3 46 Q10 41.5 17 46 T31 46 T45 46 T59 46 Q61 45 61 47 V56 A4 4 0 0 1 57 60 H7 A4 4 0 0 1 3 56 Z" fill={C.water} />
      <Detail d="M10 53 Q14 50.5 18 53 M38 54 Q42 51.5 46 54" color={C.shine} width={2.5} />
    </>
  ),
};

const doctor: Motif = {
  motion: "wiggle",
  origin: "32px 12px",
  move: (
    <>
      <Tube d="M24 22 V17 A4 4 0 0 1 28 13 H36 A4 4 0 0 1 40 17 V22" color={C.brown} width={3} />
      <path d="M7 27 A5 5 0 0 1 12 22 H52 A5 5 0 0 1 57 27 V53 A5 5 0 0 1 52 58 H12 A5 5 0 0 1 7 53 Z" fill={C.red} />
      <path d="M28.5 31 H35.5 V36.5 H41 V43.5 H35.5 V49 H28.5 V43.5 H23 V36.5 H28.5 Z" fill={C.white} strokeWidth={2.25} />
      <Shine d="M11.5 32 V46" width={3} />
    </>
  ),
};

const birthday: Motif = {
  motion: "float",
  back: (
    <>
      <rect x={17.5} y={22} width={5} height={13} rx={1.5} fill={C.blue} />
      <rect x={29.5} y={20} width={5} height={15} rx={1.5} fill={C.yellow} />
      <rect x={41.5} y={22} width={5} height={13} rx={1.5} fill={C.green} />
      <rect x={3} y={54} width={58} height={5.5} rx={2.75} fill={C.steel} />
      <rect x={8} y={34} width={48} height={22} rx={4} fill={C.pink} />
      <path d="M8 39 Q8 34 13 34 H51 Q56 34 56 39 Q53 44 49 40 Q45.5 44 41 40 Q37 44 32.5 40 Q28.5 44 24 40 Q20 44 16 40 Q12 44 8 40 Z" fill={C.white} />
      <Dot cx={16} cy={49} r={1.6} color={C.yellow} />
      <Dot cx={27} cy={51} r={1.6} color={C.blue} />
      <Dot cx={38} cy={48.5} r={1.6} color={C.yellow} />
      <Dot cx={48} cy={50.5} r={1.6} color={C.blue} />
    </>
  ),
  move: (
    <>
      <path d={dropPath(20, 9.5, 3.4)} fill={C.orange} strokeWidth={2.25} />
      <path d={dropPath(32, 7.5, 3.4)} fill={C.orange} strokeWidth={2.25} />
      <path d={dropPath(44, 9.5, 3.4)} fill={C.orange} strokeWidth={2.25} />
    </>
  ),
};

const dinner: Motif = {
  motion: "float",
  back: (
    <>
      <Tube d="M11 34.5 H6 V41.5 H11 M53 34.5 H58 V41.5 H53" color={C.orange} width={2.5} />
      <path d="M10 30 H54 V47 A9 9 0 0 1 45 56 H19 A9 9 0 0 1 10 47 Z" fill={C.orange} />
      <Shine d="M15.5 37 Q16 46 21.5 50" width={3} />
      <path d="M7 30 Q8 20.5 32 20.5 Q56 20.5 57 30 Z" fill={C.orange} />
      <rect x={28} y={15.5} width={8} height={5.5} rx={2.5} fill={C.brown} />
    </>
  ),
  move: (
    <>
      <Lines d="M18 15 Q15 11.5 18 8 Q21 4.5 18 1.5" width={2.5} />
      <Lines d="M46 15 Q43 11.5 46 8 Q49 4.5 46 1.5" width={2.5} />
    </>
  ),
};

const music: Motif = {
  motion: "float",
  back: (
    <>
      <Tube d="M37 31 L53 12" color={C.brown} width={5} />
      <rect x={49} y={3.5} width={9} height={12} rx={2.5} transform="rotate(40 53.5 9.5)" fill={C.brown} />
      <g stroke={C.line} strokeWidth={LINE_WIDTH * 2}>
        <circle cx={24} cy={44} r={14} />
        <circle cx={35} cy={33} r={10} />
      </g>
      <circle cx={24} cy={44} r={14} fill={C.orange} stroke="none" />
      <circle cx={35} cy={33} r={10} fill={C.orange} stroke="none" />
      <circle cx={28.5} cy={39.5} r={4.5} fill={C.brown} />
      <Detail d="M22 55 L51 13" color={C.cream} width={1.5} />
      <Shine d="M14 38 Q15 33.5 19 31.5" width={3} />
    </>
  ),
  move: (
    <>
      <Tube d="M16 21 V7 Q20 8 22 12" color={C.purple} width={1.6} />
      <ellipse cx={12.5} cy={21} rx={4.2} ry={3.3} transform="rotate(-20 12.5 21)" fill={C.purple} />
    </>
  ),
};

const play: Motif = {
  motion: "wiggle",
  origin: "52px 8px",
  back: (
    <>
      <path d="M2 60 Q14 51 30 57 Q46 51 62 60 Z" fill={C.wood} />
      <Tube d="M13.5 29 Q28 11 42.5 29" color={C.steel} width={2} />
      <path d="M13 28 H43 L39.5 55 A3 3 0 0 1 36.5 57.5 H19.5 A3 3 0 0 1 16.5 55 Z" fill={C.red} />
      <rect x={11} y={25} width={34} height={6.5} rx={3.25} fill={C.yellow} />
      <path d={starPath(28, 43.5, 6)} fill={C.white} strokeWidth={2.25} />
      <Shine d="M18.5 36 L20 50" width={3} />
    </>
  ),
  move: (
    <>
      <Tube d="M52 7 L50 32" color={C.blue} width={3.5} />
      <path d="M44 32 H56 L55 45 Q50 52 45 45 Z" fill={C.blue} />
    </>
  ),
};

const trip: Motif = {
  motion: "bounce",
  origin: "34px 54px",
  back: <Lines d="M1 31 H4.5 M0.5 38 H4 M1 45 H4.5" width={2.5} />,
  move: (
    <>
      <rect x={27} y={10.5} width={16} height={7} rx={2} fill={C.wood} />
      <Detail d="M31 10.5 V17.5 M39 10.5 V17.5" color={C.brown} width={2} />
      <path d="M8 44 V36 Q8 32 12 31 L20 30 L27 20 Q29 17.5 33 17.5 H44 Q48 17.5 50 20 L56 30 Q60 31 60 35 V44 Q60 47 57 47 H11 Q8 47 8 44 Z" fill={C.red} />
      <path d="M24 30 L29 22.5 Q30 21.5 31.5 21.5 H36.5 V30 Z" fill={C.water} strokeWidth={2.25} />
      <path d="M40 21.5 H44 Q45.5 21.5 46.5 22.5 L51.5 30 H40 Z" fill={C.water} strokeWidth={2.25} />
      <circle cx={56.5} cy={36} r={2} fill={C.yellow} strokeWidth={1.75} />
      <Shine d="M12.5 38.5 H22" width={3} />
      <circle cx={20} cy={47} r={6.5} fill={C.dark} />
      <circle cx={20} cy={47} r={2.6} fill={C.gray} strokeWidth={1.75} />
      <circle cx={48} cy={47} r={6.5} fill={C.dark} />
      <circle cx={48} cy={47} r={2.6} fill={C.gray} strokeWidth={1.75} />
    </>
  ),
};

const bike: Motif = {
  motion: "bounce",
  origin: "32px 56px",
  move: (
    <>
      <Tube d={circlePath(15, 43, 11)} color={C.dark} width={3.5} />
      <Tube d={circlePath(49, 43, 11)} color={C.dark} width={3.5} />
      <circle cx={15} cy={43} r={8.2} stroke={C.gray} strokeWidth={1.5} />
      <circle cx={49} cy={43} r={8.2} stroke={C.gray} strokeWidth={1.5} />
      <Tube d="M15 43 L25 25 H45 L49 43 M25 25 L31 43 L45 25 M31 43 H15" color={C.red} width={3.2} />
      <Tube d="M44 25 L42 17 H48" color={C.steel} width={2.8} />
      <Tube d="M25 25 L23.5 20" color={C.steel} width={2.8} />
      <path d="M17 18 Q23 16 29 18 Q28 21.5 23 21.5 Q18 21.5 17 18 Z" fill={C.brown} strokeWidth={2.25} />
      <Dot cx={15} cy={43} r={2.2} />
      <Dot cx={49} cy={43} r={2.2} />
      <circle cx={31} cy={43} r={3.5} fill={C.steel} strokeWidth={2} />
    </>
  ),
};

export const EVENT_MOTIFS = {
  "event-school": school,
  "event-kindergarten": kindergarten,
  "event-soccer": soccer,
  "event-swim": swim,
  "event-doctor": doctor,
  "event-birthday": birthday,
  "event-dinner": dinner,
  "event-music": music,
  "event-play": play,
  "event-trip": trip,
  "event-bike": bike,
} satisfies Record<string, Motif>;
