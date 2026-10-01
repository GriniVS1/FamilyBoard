import { C } from "../palette";
import {
  Detail,
  Dot,
  Lines,
  Shine,
  Tube,
  crescentPath,
  dropPath,
  sparklePath,
  starPath,
} from "../parts";
import type { Motif } from "../types";

const water: Motif = {
  motion: "drop",
  back: (
    <>
      <path d="M17 24 H47 L43.5 55 Q43 58 40 58 H24 Q21 58 20.5 55 Z" fill={C.white} />
      <path
        d="M18.5 37 Q25 33.5 32 37 T45.5 37 L43.5 55 Q43 58 40 58 H24 Q21 58 20.5 55 Z"
        fill={C.water}
        stroke="none"
      />
      <Detail d="M18.5 37 Q25 33.5 32 37 T45.5 37" />
      <path d="M17 24 H47 L43.5 55 Q43 58 40 58 H24 Q21 58 20.5 55 Z" />
      <Shine d="M24 42 L25.2 52" width={3} />
    </>
  ),
  move: (
    <>
      <path d={dropPath(32, 3, 7)} fill={C.blue} />
      <Shine d="M28.5 17.5 Q28.3 14.5 30 12.5" />
    </>
  ),
};

const teeth: Motif = {
  motion: "scrub",
  back: (
    <>
      <path
        d="M6 20 C6 12 13 9.5 17 11.5 C19 12.5 21 12.5 23 11.5 C27 9.5 34 12 34 20 C34 27 32 31 31 37 C30 44 29 52 25.5 52 C22.5 52 22.5 42 20 42 C17.5 42 17.5 52 14.5 52 C11 52 10 44 9 37 C8 31 6 27 6 20 Z"
        fill={C.cream}
      />
      <Shine d="M10.5 20 Q10.8 16.2 14.5 15.6" width={3} />
      <Dot cx={15} cy={25} />
      <Dot cx={25} cy={25} />
      <Detail d="M16.5 30.5 Q20 33.5 23.5 30.5" />
    </>
  ),
  move: (
    <g transform="translate(40 42) rotate(-35)">
      <rect x={-9} y={0} width={30} height={7} rx={3.5} fill={C.green} />
      <rect x={-8.5} y={-9} width={15} height={9} rx={2} fill={C.water} />
      <Detail d="M-3.5 -7.5 V-1.5 M1.5 -7.5 V-1.5" width={2} />
      <Shine d="M9 3.5 H17" width={2} />
    </g>
  ),
  front: (
    <>
      <circle cx={35} cy={27} r={3.4} fill={C.white} />
      <circle cx={40} cy={21.5} r={2.6} fill={C.white} />
      <circle cx={31.5} cy={21} r={2} fill={C.white} />
    </>
  ),
};

const tidyToys: Motif = {
  motion: "drop",
  back: (
    <>
      <path d="M11 38 L14 31 H50 L53 38 Z" fill={C.brown} />
      <circle cx={34.5} cy={24.5} r={3.2} fill={C.wood} />
      <circle cx={45.5} cy={24.5} r={3.2} fill={C.wood} />
      <circle cx={40} cy={30} r={7.5} fill={C.wood} />
      <Dot cx={37.3} cy={28.5} r={1.5} />
      <Dot cx={42.7} cy={28.5} r={1.5} />
    </>
  ),
  move: (
    <>
      <circle cx={22} cy={17} r={8.5} fill={C.yellow} />
      <path d="M17 10 Q24 13.5 25.5 25" stroke={C.red} strokeWidth={4} fill="none" strokeLinecap="butt" />
      <circle cx={22} cy={17} r={8.5} />
      <Shine d="M16.5 15 Q17 12 19.5 11" />
      <Lines d="M15 2.5 L16 5.5 M22 1.5 V4.5 M29 2.5 L28 5.5" />
    </>
  ),
  front: (
    <>
      <path d="M9 36 H55 V54 A4 4 0 0 1 51 58 H13 A4 4 0 0 1 9 54 Z" fill={C.blue} />
      <path d={starPath(32, 47, 6.5)} fill={C.yellow} />
      <Shine d="M13.5 41 V52" width={3} />
    </>
  ),
};

const getDressed: Motif = {
  motion: "drop",
  back: (
    <>
      <circle cx={32} cy={17} r={10} fill={C.skin} />
      <path d="M22.3 15.5 Q22.5 6.8 32 6.8 Q41.5 6.8 41.7 15.5 Q37 11.8 32 12.8 Q27 11.8 22.3 15.5 Z" fill={C.brown} />
      <Dot cx={28.5} cy={18.5} r={1.7} />
      <Dot cx={35.5} cy={18.5} r={1.7} />
      <Detail d="M29 22.3 Q32 24.8 35 22.3" />
      <Lines d="M11 11 V19 M8 16 L11 19 L14 16 M53 11 V19 M50 16 L53 19 L56 16" />
    </>
  ),
  move: (
    <>
      <path
        d="M22 27 Q27 31 32 31 Q37 31 42 27 L52 32 L57 43 L49 47 L46 42 V58 H18 V42 L15 47 L7 43 L12 32 Z"
        fill={C.blue}
      />
      <path d={starPath(32, 44, 5.5)} fill={C.yellow} />
      <Shine d="M22 38 V52" width={3} />
    </>
  ),
};

const makeBed: Motif = {
  motion: "scrub",
  back: (
    <>
      <rect x={3} y={17} width={10} height={43} rx={3.5} fill={C.wood} />
      <rect x={8} y={45} width={50} height={8} rx={2.5} fill={C.brown} />
      <rect x={10} y={36} width={46} height={11} rx={3.5} fill={C.white} />
      <rect x={14} y={26.5} width={16} height={11} rx={5.5} fill={C.cream} />
      <Shine d="M17.5 30.5 H22.5" width={2.25} />
      <Lines d="M53 23 Q44 13.5 33.5 20.5 M33.5 20.5 L39.5 17.5 M33.5 20.5 L38.5 25" width={3.25} />
    </>
  ),
  move: (
    <>
      <path d="M31 34 H55 V47 H31 Z" fill={C.purple} />
      <Dot cx={42} cy={41} r={1.7} color={C.cream} />
      <Dot cx={49} cy={38.5} r={1.7} color={C.cream} />
      <path d="M31 34 H41 L31 44 Z" fill={C.cream} />
    </>
  ),
  front: <rect x={53} y={31} width={8} height={29} rx={3} fill={C.wood} />,
};

const setTable: Motif = {
  motion: "drop",
  back: (
    <>
      <rect x={3} y={24} width={58} height={36} rx={7} fill={C.green} />
      <circle cx={30} cy={42} r={11.5} stroke={C.shine} strokeWidth={2.5} strokeDasharray="4 3.4" strokeLinecap="butt" />
      <path d="M7.5 30 H14.5 V37.5 Q14.5 41.5 12.5 42.5 V54 A1.8 1.8 0 0 1 9.5 54 V42.5 Q7.5 41.5 7.5 37.5 Z" fill={C.steel} />
      <Detail d="M9.8 30.5 V36.5 M12.2 30.5 V36.5" width={1.75} />
      <path d="M48.5 54.5 V30 Q55 33.5 55 43 V45 H51.5 V54.5 A1.5 1.5 0 0 1 48.5 54.5 Z" fill={C.steel} />
      <Lines d="M55 5 L47 12.5 M47 12.5 H52 M47 12.5 V7.5" width={2.75} />
    </>
  ),
  move: (
    <>
      <circle cx={36} cy={23} r={11} fill={C.white} />
      <circle cx={36} cy={23} r={6.5} stroke={C.gray} strokeWidth={2.25} />
      <Shine d="M28.5 20.5 Q29.5 16.5 33 15" width={2.25} />
    </>
  ),
};

const feedDog: Motif = {
  motion: "drop",
  back: (
    <>
      <circle cx={21} cy={24} r={13} fill={C.wood} />
      <path d="M10 15 Q2.5 18 4.5 31 Q6.5 36 11 32 Q12.5 24 13 17 Z" fill={C.brown} />
      <path d="M32 15 Q39.5 18 37.5 31 Q35.5 36 31 32 Q29.5 24 29 17 Z" fill={C.brown} />
      <Dot cx={16.5} cy={22} />
      <Dot cx={25.5} cy={22} />
      <ellipse cx={21} cy={30} rx={6.5} ry={4.8} fill={C.cream} />
      <ellipse cx={21} cy={27.6} rx={2.8} ry={2} fill={C.line} />
      <path d="M19.2 32.5 Q21 38 22.8 32.5 Z" fill={C.pink} strokeWidth={2} />
      <path d="M31 47 Q35 41.5 40 43.5 Q44 40 48 43.5 Q53 41.5 57 47 Z" fill={C.brown} />
      <path d="M27 46 H61 L57.5 56.5 A3 3 0 0 1 54.7 58.5 H33.3 A3 3 0 0 1 30.5 56.5 Z" fill={C.red} />
      <Shine d="M33 50 L34.5 54.5" />
    </>
  ),
  move: (
    <>
      <circle cx={46} cy={26} r={2.6} fill={C.brown} />
      <circle cx={52.5} cy={33} r={2.6} fill={C.brown} />
      <circle cx={42} cy={35.5} r={2.4} fill={C.brown} />
      <Lines d="M46 16 V20 M53 23 V27" />
    </>
  ),
};

const feedCat: Motif = {
  motion: "drop",
  back: (
    <>
      <path d="M9 21 L9.5 7.5 L19.5 15.5 Z" fill={C.orange} />
      <path d="M33 21 L32.5 7.5 L22.5 15.5 Z" fill={C.orange} />
      <ellipse cx={21} cy={26} rx={13.5} ry={11.5} fill={C.orange} />
      <Detail d="M21 15.5 V19 M17 16.2 L17.6 18.8 M25 16.2 L24.4 18.8" />
      <Dot cx={16} cy={25} />
      <Dot cx={26} cy={25} />
      <path d="M19.3 28.8 H22.7 L21 31 Z" fill={C.pink} strokeWidth={1.75} />
      <Detail d="M21 31 Q19.3 33.8 17.4 32.3 M21 31 Q22.7 33.8 24.6 32.3" width={2} />
      <Detail d="M3.5 27.5 H10 M4 32 L10 30.5 M38.5 27.5 H32 M38 32 L32 30.5" color={C.motion} width={2} />
      <path d="M27 46 H61 L57.5 56.5 A3 3 0 0 1 54.7 58.5 H33.3 A3 3 0 0 1 30.5 56.5 Z" fill={C.purple} />
      <Shine d="M33 50 L34.5 54.5" />
    </>
  ),
  move: (
    <g transform="rotate(35 47 31)">
      <path d="M37 31 Q44 23.5 51 31 Q44 38.5 37 31 Z" fill={C.blue} />
      <path d="M51 31 L57.5 25.5 V36.5 Z" fill={C.blue} />
      <Dot cx={41.5} cy={30} r={1.4} />
    </g>
  ),
};

const trash: Motif = {
  motion: "drop",
  back: (
    <>
      <path d="M16 25 H48 L45 54 A3 3 0 0 1 42 57 H22 A3 3 0 0 1 19 54 Z" fill={C.green} />
      <Detail d="M26 31 L26.6 50 M32 31 V50 M38 31 L37.4 50" />
      <Shine d="M21.5 30 L23 44" width={3} />
      <g transform="rotate(20 51 23)">
        <rect x={13} y={20} width={39} height={6} rx={3} fill={C.leaf} />
        <rect x={27} y={16.5} width={10} height={4} rx={2} fill={C.leaf} />
      </g>
    </>
  ),
  move: (
    <>
      <path d="M15.5 8 L21 4 L27.5 6 L29 12 L24 16 L17 14.5 Z" fill={C.white} />
      <Detail d="M21 4.5 L22.5 10 L28.5 11.5 M22.5 10 L18.5 14" color={C.gray} width={1.75} />
    </>
  ),
  front: (
    <>
      <circle cx={44.5} cy={56} r={4.5} fill={C.steel} />
      <Dot cx={44.5} cy={56} r={1.4} color={C.gray} />
    </>
  ),
};

const waterPlants: Motif = {
  motion: "pour",
  origin: "47px 26px",
  back: (
    <>
      <Tube d="M16 44 V33" color={C.leaf} width={2} />
      <path d="M16 37 Q6 37 4.5 28.5 Q13 27.5 16 35.5 Z" fill={C.green} />
      <path d="M16 34 Q17.5 25 26.5 24 Q27 32.5 16 34.5 Z" fill={C.green} />
      <path d="M7 48 H25 L22.5 59 H9.5 Z" fill={C.orange} />
      <rect x={5} y={43} width={22} height={6} rx={2.5} fill={C.orange} />
      <Shine d="M10.5 52 L11.3 56" />
    </>
  ),
  move: (
    <>
      <path d="M38 22.5 L26.5 12.5 L24 16 L37.5 30 Z" fill={C.blue} />
      <ellipse cx={24.5} cy={14} rx={2.8} ry={5} transform="rotate(-40 24.5 14)" fill={C.blue} />
      <Tube d="M41 19 Q48 7 56 19" color={C.blue} width={3} />
      <rect x={36} y={18} width={22} height={19} rx={4} fill={C.blue} />
      <Shine d="M40 23 V32" width={3} />
    </>
  ),
  front: (
    <>
      <path d={dropPath(17, 17.5, 2.3)} fill={C.water} strokeWidth={2} />
      <path d={dropPath(23, 22, 2.3)} fill={C.water} strokeWidth={2} />
      <path d={dropPath(11.5, 21, 2.1)} fill={C.water} strokeWidth={2} />
    </>
  ),
};

const homework: Motif = {
  motion: "scrub",
  back: (
    <>
      <rect x={8} y={9} width={38} height={49} rx={4} fill={C.white} />
      <Detail d="M16 20 H38 M16 28 H38 M16 36 H38" color={C.water} width={2.5} />
      <Detail d="M16 45.5 q2.5 -5 5 0 t5 0 t5 0" width={2.5} />
      <circle cx={8} cy={17} r={2.4} fill={C.steel} />
      <circle cx={8} cy={27} r={2.4} fill={C.steel} />
      <circle cx={8} cy={37} r={2.4} fill={C.steel} />
      <circle cx={8} cy={47} r={2.4} fill={C.steel} />
    </>
  ),
  move: (
    <g transform="translate(33 47) rotate(-45)">
      <path d="M0 0 L8 -4.5 V4.5 Z" fill={C.wood} />
      <path d="M0 0 L3.2 -1.8 V1.8 Z" fill={C.line} strokeWidth={1.5} />
      <rect x={8} y={-4.5} width={16} height={9} fill={C.yellow} />
      <rect x={24} y={-4.5} width={4} height={9} fill={C.steel} />
      <path d="M28 -4.5 H31 A3 3 0 0 1 34 -1.5 V1.5 A3 3 0 0 1 31 4.5 H28 Z" fill={C.pink} />
      <Shine d="M10 -1.5 H21" width={2.25} />
    </g>
  ),
};

const read: Motif = {
  motion: "float",
  back: (
    <>
      <path d="M4 22 H10 V51 Q21 49 32 55 Q43 49 54 51 V22 H60 V55 Q45 53 32 59 Q19 53 4 55 Z" fill={C.red} />
      <path d="M32 22 Q22 16 9 18 V50 Q21 48.5 32 54 Z" fill={C.white} />
      <path d="M32 22 Q42 16 55 18 V50 Q43 48.5 32 54 Z" fill={C.white} />
      <Detail d="M14 27 Q20 26 27 28.5 M14 34 Q20 33 27 35.5 M14 41 Q20 40 27 42.5" color={C.gray} width={2.5} />
      <Detail d="M50 27 Q44 26 37 28.5 M50 34 Q44 33 37 35.5 M50 41 Q44 40 37 42.5" color={C.gray} width={2.5} />
    </>
  ),
  move: (
    <>
      <path d={starPath(20, 9, 5.5)} fill={C.yellow} />
      <path d={sparklePath(33, 6.5, 4.5)} fill={C.yellow} />
      <path d="M44 13.5 C40.5 11 41 6.5 44 7.5 C47 6.5 47.5 11 44 13.5 Z" fill={C.pink} strokeWidth={2.25} />
    </>
  ),
};

const washClothes: Motif = {
  motion: "spin",
  origin: "32px 38px",
  back: (
    <>
      <rect x={10} y={5} width={44} height={54} rx={6} fill={C.white} />
      <Detail d="M10 17 H54" />
      <circle cx={17.5} cy={11} r={2.4} fill={C.red} />
      <circle cx={24.5} cy={11} r={2.4} fill={C.blue} />
      <rect x={37} y={8.5} width={12} height={5} rx={2} fill={C.water} strokeWidth={2} />
      <circle cx={32} cy={38} r={14.5} fill={C.steel} />
      <circle cx={32} cy={38} r={10} fill={C.water} />
    </>
  ),
  move: (
    <>
      <path d="M25.5 33.5 H31.5 V38.5 Q31.5 41 34 41 H36 V45 H30 Q25.5 45 25.5 40.5 Z" fill={C.red} strokeWidth={2.25} />
      <circle cx={37.5} cy={33} r={2.3} fill={C.white} strokeWidth={2} />
      <circle cx={27} cy={47} r={1.6} fill={C.white} strokeWidth={1.75} />
    </>
  ),
  front: <Shine d="M24.5 31.5 Q26.5 28.8 29.5 28.2" />,
};

const laundry: Motif = {
  motion: "pour",
  origin: "40px 28px",
  back: (
    <>
      <rect x={9} y={48} width={46} height={10} rx={3} fill={C.blue} />
      <Detail d="M27 48 Q32 52 37 48" />
      <rect x={11} y={38.5} width={42} height={10} rx={3} fill={C.yellow} />
      <Detail d="M27 38.5 Q32 42.5 37 38.5" />
      <path d="M22 17 Q27 20.5 32 20.5 Q36.5 20.5 40 18.3 V38.5 H16 V31 L9 29 L12 21 Z" fill={C.red} />
      <Shine d="M19.5 26 V34" width={2.5} />
      <Lines d="M53 13 Q45 4.5 36 11 M36 11 L41.5 11.8 M36 11 L38 5.8" width={3} />
    </>
  ),
  move: <path d="M40 18.3 L42 17 L52 21 L55 29 L48 31 V38.5 H40 Z" fill={C.red} />,
};

const dishes: Motif = {
  motion: "scrub",
  back: (
    <>
      <circle cx={25} cy={29} r={19} fill={C.white} />
      <circle cx={25} cy={29} r={12} stroke={C.gray} strokeWidth={2.5} />
      <path d={sparklePath(10, 9, 5)} fill={C.yellow} />
    </>
  ),
  move: (
    <g transform="translate(40 44) rotate(-22)">
      <rect x={-11} y={-7} width={22} height={14} rx={3.5} fill={C.yellow} />
      <path d="M-11 -3 V-3.5 A3.5 3.5 0 0 1 -7.5 -7 H7.5 A3.5 3.5 0 0 1 11 -3.5 V-2 H-11 Z" fill={C.green} />
      <Dot cx={-5} cy={3} r={1.3} color={C.wood} />
      <Dot cx={3} cy={2} r={1.3} color={C.wood} />
    </g>
  ),
  front: (
    <>
      <circle cx={52} cy={30} r={3.6} fill={C.white} />
      <circle cx={56} cy={39} r={2.6} fill={C.white} />
      <circle cx={48} cy={55} r={3} fill={C.white} />
      <circle cx={27} cy={52} r={2.2} fill={C.white} />
    </>
  ),
};

const washHands: Motif = {
  motion: "drop",
  back: (
    <>
      <path d="M6 8 H36 A10 10 0 0 1 46 18 H39 A3 3 0 0 0 36 15 H6 Z" fill={C.steel} />
      <rect x={12} y={2.5} width={10} height={5.5} rx={2} fill={C.blue} />
      <Shine d="M9 11.5 H30" width={2.25} />
      <path
        d="M31 62 V50 L24.5 43.5 A3.2 3.2 0 0 1 29 39 L33 43 V34 A3.2 3.2 0 0 1 39.4 34 V41 V31 A3.2 3.2 0 0 1 45.8 31 V41 V34 A3.2 3.2 0 0 1 52.2 34 V42 V38.5 A3 3 0 0 1 58.2 38.5 V50 Q58.2 62 46 62 Z"
        fill={C.skin}
      />
    </>
  ),
  move: (
    <>
      <path d={dropPath(42.5, 19.5, 2.2)} fill={C.water} strokeWidth={2} />
      <path d={dropPath(36.5, 23, 2)} fill={C.water} strokeWidth={2} />
    </>
  ),
  front: (
    <>
      <circle cx={23} cy={33} r={3.6} fill={C.white} />
      <circle cx={17.5} cy={40} r={2.5} fill={C.white} />
      <circle cx={24} cy={52} r={3} fill={C.white} />
      <circle cx={57} cy={30} r={2.6} fill={C.white} />
    </>
  ),
};

const bath: Motif = {
  motion: "float",
  back: (
    <>
      <circle cx={12} cy={29} r={5} fill={C.white} />
      <circle cx={20} cy={25.5} r={6} fill={C.white} />
      <circle cx={29} cy={28} r={5} fill={C.white} />
    </>
  ),
  move: (
    <>
      <path d="M37 26 Q37.5 21.5 42 22 H48 Q54.5 22 55.5 27 Q56 31.5 51 31.5 H41 Q37 31.5 37 27.5 Z" fill={C.yellow} />
      <path d="M37.8 23.5 L34 19.5 L39.5 21.5" fill={C.yellow} strokeWidth={2.25} />
      <circle cx={47} cy={16.5} r={5.8} fill={C.yellow} />
      <path d="M52 15.5 L57.5 17.5 L52 19.8 Z" fill={C.orange} strokeWidth={2.25} />
      <Dot cx={48.5} cy={15.3} r={1.4} />
      <Detail d="M42.5 26 Q45.5 29 48.5 26" width={2} />
    </>
  ),
  front: (
    <>
      <Tube d="M15 52 L12.5 58.5 M49 52 L51.5 58.5" color={C.steel} width={2.5} />
      <path d="M6 34 H58 V40 Q58 54 44 54 H20 Q6 54 6 40 Z" fill={C.blue} />
      <rect x={4} y={31} width={56} height={6} rx={3} fill={C.white} />
      <Shine d="M11 41 Q12 47 17 49.5" width={3} />
    </>
  ),
};

// Own pose, not get-dressed's T-shirt pose: the child sits on the bed edge,
// arms up in the sleeves, pulling the button-up pyjama top down over the head.
const pajamas: Motif = {
  motion: "drop",
  back: (
    <>
      <rect x={56} y={22} width={6} height={37} rx={3} fill={C.wood} />
      <rect x={6} y={53} width={4.5} height={8} rx={1.5} fill={C.brown} />
      <rect x={2} y={48} width={58} height={7} rx={2.5} fill={C.brown} />
      <rect x={2} y={40} width={58} height={10} rx={3.5} fill={C.white} />
      <rect x={40} y={30.5} width={17} height={10.5} rx={5.25} fill={C.cream} />
      <Shine d="M43.5 34 H48" width={2.25} />
      <rect x={15} y={41} width={7.5} height={17} rx={3.5} fill={C.pink} />
      <rect x={25.5} y={41} width={7.5} height={17} rx={3.5} fill={C.pink} />
      <ellipse cx={18.5} cy={59.5} rx={4.5} ry={2.6} fill={C.skin} />
      <ellipse cx={29.5} cy={59.5} rx={4.5} ry={2.6} fill={C.skin} />
      <circle cx={24} cy={22} r={8.5} fill={C.skin} />
      <path d="M15.8 20.5 Q16 13 24 13 Q32 13 32.2 20.5 Q28.5 17.3 24 18 Q19.5 17.3 15.8 20.5 Z" fill={C.brown} />
      <Detail d="M19.4 23 Q20.9 24.6 22.4 23 M25.6 23 Q27.1 24.6 28.6 23" width={1.9} />
      <Dot cx={18.5} cy={26} r={1.4} color={C.pink} />
      <Dot cx={29.5} cy={26} r={1.4} color={C.pink} />
      <Lines d="M43 14 V23 M40 20 L43 23 L46 20" />
    </>
  ),
  move: (
    <>
      <path d="M14.5 31 L7.5 12.5 L13.5 10 L20 29 Z" fill={C.pink} />
      <path d="M33.5 31 L40.5 12.5 L34.5 10 L28 29 Z" fill={C.pink} />
      <circle cx={10.2} cy={9.2} r={3.3} fill={C.skin} />
      <circle cx={37.8} cy={9.2} r={3.3} fill={C.skin} />
      <path d="M14 29 Q19 32.5 24 32.5 Q29 32.5 34 29 V45 H14 Z" fill={C.pink} />
      <rect x={16.5} y={33} width={2.8} height={12} fill={C.white} stroke="none" />
      <rect x={28.7} y={33} width={2.8} height={12} fill={C.white} stroke="none" />
      <path d="M14 29 Q19 32.5 24 32.5 Q29 32.5 34 29 V45 H14 Z" />
      <path d="M18.5 30.5 L24 36 L20.5 37 Z" fill={C.white} strokeWidth={2} />
      <path d="M29.5 30.5 L24 36 L27.5 37 Z" fill={C.white} strokeWidth={2} />
      <Detail d="M24 36 V45" width={2} />
      <circle cx={24} cy={40.5} r={1.6} fill={C.white} strokeWidth={1.5} />
    </>
  ),
};

const backpack: Motif = {
  motion: "drop",
  back: (
    <>
      <Tube d="M15 33 Q8.5 33 8.5 41 V48 Q8.5 54 15 54 M49 33 Q55.5 33 55.5 41 V48 Q55.5 54 49 54" color={C.orange} width={2.5} />
      <path d="M17 29 L19.5 17 Q32 11 44.5 17 L47 29 Z" fill={C.red} />
      <rect x={29} y={15} width={6} height={9} rx={2} fill={C.orange} strokeWidth={2.25} />
      <ellipse cx={32} cy={29} rx={16} ry={4.5} fill={C.dark} />
    </>
  ),
  move: (
    <>
      <g transform="rotate(-10 32 20)">
        <rect x={25} y={8} width={19} height={23} rx={1.5} fill={C.white} />
        <Detail d="M41 11 V28 M38.5 11 V28" color={C.gray} width={1.5} />
        <path d="M21 6 H38 A2 2 0 0 1 40 8 V29 A2 2 0 0 1 38 31 H21 Z" fill={C.blue} />
        <rect x={21} y={6} width={4.5} height={25} fill={C.purple} strokeWidth={2.25} />
        <path d={starPath(32.5, 16.5, 4.2)} fill={C.yellow} strokeWidth={1.75} />
      </g>
      <Lines d="M17 5 V11 M47 5 V11" width={2.5} />
    </>
  ),
  front: (
    <>
      <path d="M14 29 Q14 33 18 33 H46 Q50 33 50 29 V54 A5 5 0 0 1 45 59 H19 A5 5 0 0 1 14 54 Z" fill={C.red} />
      <rect x={20} y={40} width={24} height={14} rx={4} fill={C.orange} />
      <Detail d="M20 45 H44" />
      <Shine d="M18 38 V50" width={3} />
    </>
  ),
};

const sweep: Motif = {
  motion: "wiggle",
  origin: "54px 6px",
  back: (
    <>
      <circle cx={10} cy={53} r={4.8} fill={C.gray} />
      <circle cx={17.5} cy={56} r={3.6} fill={C.gray} />
      <circle cx={5.5} cy={58} r={2.6} fill={C.gray} />
      <Lines d="M4 44 Q7 41 11 42 M8 38 Q11 35.5 14.5 37" />
    </>
  ),
  move: (
    <g transform="translate(38 36) rotate(28)">
      <rect x={-2.8} y={-34} width={5.6} height={36} rx={2.8} fill={C.wood} />
      <path d="M-6.5 4 H6.5 L12 22 Q0 25.5 -12 22 Z" fill={C.yellow} />
      <Detail d="M-3.5 8 L-6.5 21.5 M0 8 V22.5 M3.5 8 L6.5 21.5" width={2} />
      <rect x={-7.5} y={-1.5} width={15} height={6.5} rx={2.5} fill={C.red} />
    </g>
  ),
};

const vacuum: Motif = {
  motion: "scrub",
  back: (
    <>
      <Tube d="M37 39 Q26 30 21.5 42 L18 50" color={C.steel} width={3.5} />
      <Tube d="M42 20 Q48 12.5 54 20" color={C.purple} width={3} />
      <path d="M35 31 Q35 20 48 20 Q61 20 61 32 V44 A4 4 0 0 1 57 48 H39 A4 4 0 0 1 35 44 Z" fill={C.purple} />
      <circle cx={48} cy={32} r={3.5} fill={C.yellow} />
      <Shine d="M39.5 30 Q40.5 25.5 44.5 24" width={3} />
      <circle cx={41} cy={50} r={4} fill={C.steel} />
      <circle cx={55} cy={50} r={4} fill={C.steel} />
    </>
  ),
  move: (
    <>
      <path d="M5 52.5 A3 3 0 0 1 8 49.5 H26 A3 3 0 0 1 29 52.5 V55 A3 3 0 0 1 26 58 H8 A3 3 0 0 1 5 55 Z" fill={C.steel} />
      <Dot cx={4} cy={42} r={1.9} color={C.gray} />
      <Dot cx={10} cy={38.5} r={1.6} color={C.gray} />
      <Dot cx={8} cy={45} r={1.3} color={C.gray} />
    </>
  ),
};

const breakfast: Motif = {
  motion: "wiggle",
  origin: "57px 11px",
  back: (
    <>
      <circle cx={16} cy={33} r={4.5} fill={C.yellow} />
      <circle cx={24.5} cy={30.5} r={5} fill={C.wood} />
      <circle cx={33.5} cy={32} r={4.5} fill={C.yellow} />
      <circle cx={41.5} cy={30.5} r={4.5} fill={C.red} />
      <circle cx={49} cy={33} r={4} fill={C.wood} />
    </>
  ),
  move: (
    <>
      <Tube d="M46 31 L57.5 11" color={C.steel} width={3.2} />
    </>
  ),
  front: (
    <>
      <rect x={23} y={53.5} width={18} height={5} rx={2} fill={C.blue} />
      <path d="M7 34 H57 Q57 54.5 36 55.5 H28 Q7 54.5 7 34 Z" fill={C.blue} />
      <Shine d="M12.5 39.5 Q14.5 47.5 21.5 50.5" width={3} />
    </>
  ),
};

const medicine: Motif = {
  motion: "wiggle",
  back: (
    <>
      <circle cx={50} cy={50} r={7.5} fill={C.yellow} />
      <Shine d="M46 48.5 Q46.5 45.8 49 45.3" />
      <path d={sparklePath(12, 12, 5)} fill={C.water} />
    </>
  ),
  move: (
    <g transform="rotate(-45 30 30)">
      <path d="M13 21 H30 V39 H13 A9 9 0 0 1 13 21 Z" fill={C.red} />
      <path d="M30 21 H47 A9 9 0 0 1 47 39 H30 Z" fill={C.white} />
      <Shine d="M9.5 28 Q10 24.8 13 24.2" width={2.75} />
    </g>
  ),
};

const music: Motif = {
  motion: "float",
  back: (
    <>
      <rect x={5} y={32} width={54} height={26} rx={4} fill={C.white} />
      <path d="M5 36 A4 4 0 0 1 9 32 H55 A4 4 0 0 1 59 36 V38 H5 Z" fill={C.red} />
      <Detail d="M15.8 38 V58 M26.6 38 V58 M37.4 38 V58 M48.2 38 V58" width={2} />
      <rect x={12.8} y={38} width={6} height={11} rx={1} fill={C.line} strokeWidth={1.5} />
      <rect x={23.6} y={38} width={6} height={11} rx={1} fill={C.line} strokeWidth={1.5} />
      <rect x={45.2} y={38} width={6} height={11} rx={1} fill={C.line} strokeWidth={1.5} />
    </>
  ),
  move: (
    <>
      <path d="M22 8.5 L40 4 V9.5 L22 14 Z" fill={C.purple} />
      <Tube d="M22 9 V23 M40 4.5 V19" color={C.purple} width={1.6} />
      <ellipse cx={18.5} cy={23.5} rx={4.2} ry={3.3} transform="rotate(-20 18.5 23.5)" fill={C.purple} />
      <ellipse cx={36.5} cy={19.5} rx={4.2} ry={3.3} transform="rotate(-20 36.5 19.5)" fill={C.purple} />
    </>
  ),
};

const tidyRoom: Motif = {
  motion: "drop",
  back: (
    <>
      <rect x={12} y={55} width={5} height={5} rx={1.5} fill={C.brown} />
      <rect x={47} y={55} width={5} height={5} rx={1.5} fill={C.brown} />
      <rect x={8} y={22} width={48} height={35} rx={4} fill={C.wood} />
      <rect x={6} y={19} width={52} height={6} rx={3} fill={C.brown} />
      <rect x={12} y={27} width={40} height={8} rx={1.5} fill={C.brown} />
      <rect x={12} y={44} width={40} height={9} rx={2} fill={C.wood} />
      <Dot cx={32} cy={48.5} r={2} color={C.brown} />
      <path d={sparklePath(55, 9, 5)} fill={C.yellow} />
    </>
  ),
  move: (
    <>
      <rect x={20} y={25} width={24} height={9} rx={2.5} fill={C.blue} />
      <rect x={22} y={17} width={20} height={8.5} rx={2.5} fill={C.red} />
      <Detail d="M28 17.5 Q32 20.5 36 17.5" width={2} />
    </>
  ),
  front: (
    <>
      <rect x={10} y={33} width={44} height={10} rx={2} fill={C.wood} />
      <Dot cx={32} cy={38} r={2.2} color={C.brown} />
      <Shine d="M14 36.5 H24" />
    </>
  ),
};

const shoes: Motif = {
  motion: "drop",
  back: (
    <>
      <rect x={6} y={50} width={4.5} height={10} rx={1.5} fill={C.brown} />
      <rect x={53.5} y={50} width={4.5} height={10} rx={1.5} fill={C.brown} />
      <rect x={2} y={46} width={60} height={5.5} rx={2.75} fill={C.wood} />
    </>
  ),
  move: (
    <>
      <path d="M25.8 39 V23.6 Q25.8 20.0 29.4 20.0 H36.6 Q39.0 20.0 40.2 22.4 L43.2 28.4 Q45.0 30.8 48.0 30.8 L52.8 31.4 Q58.2 32.0 58.8 39 Z" fill={C.red} />
      <Detail d="M37.8 26.6 L41.76 24.8 M40.2 30.56 L44.16 28.76" color={C.shine} width={2.25} />
      <Shine d="M29.4 24.8 V32.0" />
      <path d="M24 38.5 H58.0 Q60.0 38.5 60.0 40.5 Q60.0 44 57.0 44 H26.5 Q24 44 24 41.5 Z" fill={C.white} />
      <path d="M4.8 41.5 V26.1 Q4.8 22.5 8.4 22.5 H15.6 Q18.0 22.5 19.2 24.9 L22.2 30.9 Q24.0 33.3 27.0 33.3 L31.8 33.9 Q37.2 34.5 37.8 41.5 Z" fill={C.red} />
      <Detail d="M16.8 29.1 L20.76 27.3 M19.2 33.06 L23.16 31.26" color={C.shine} width={2.25} />
      <Shine d="M8.4 27.3 V34.5" />
      <path d="M3 41.0 H37.0 Q39.0 41.0 39.0 43.0 Q39.0 46.5 36.0 46.5 H5.5 Q3 46.5 3 44.0 Z" fill={C.white} />
      <Lines d="M12 10 V16 M44 8 V14" width={2.5} />
    </>
  ),
};

const shopping: Motif = {
  motion: "drop",
  back: <Tube d="M22 26 V20 Q22 12.5 32 12.5 Q42 12.5 42 20 V26" color={C.brown} width={2.5} />,
  move: (
    <>
      <Tube d="M39 29 L48 7" color={C.yellow} width={6} />
      <Detail d="M43.5 13.5 L46.5 15 M41.5 18.5 L44.5 20" width={2} />
      <circle cx={23} cy={24} r={7} fill={C.red} />
      <Detail d="M23 17.5 Q23.5 14.5 25.5 13.5" width={2.25} />
      <path d="M24.5 16 Q28.5 12 31.5 15 Q27.5 18.5 24.5 16 Z" fill={C.green} strokeWidth={2} />
      <Shine d="M18.5 22.5 Q19 20 21 19.5" />
    </>
  ),
  front: (
    <>
      <path d="M11 27 H53 L49.5 58 H14.5 Z" fill={C.wood} />
      <Detail d="M11.5 32 H52.5" color={C.brown} width={2.5} />
      <Shine d="M16.5 37 L18 52" width={3} />
    </>
  ),
};

export const TASK_MOTIFS = {
  water,
  teeth,
  "tidy-toys": tidyToys,
  "get-dressed": getDressed,
  "make-bed": makeBed,
  "set-table": setTable,
  "feed-dog": feedDog,
  "feed-cat": feedCat,
  trash,
  "water-plants": waterPlants,
  homework,
  read,
  laundry,
  "wash-clothes": washClothes,
  dishes,
  "wash-hands": washHands,
  bath,
  pajamas,
  backpack,
  sweep,
  vacuum,
  breakfast,
  medicine,
  music,
  "tidy-room": tidyRoom,
  shoes,
  shopping,
} satisfies Record<string, Motif>;
