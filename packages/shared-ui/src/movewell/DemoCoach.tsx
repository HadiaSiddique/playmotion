// Animated demo coach: a friendly figure that loops the current move slowly, so people who don't
// know an exercise can copy it. Plain Views (no SVG or video), keyframes interpolated at ~25 fps.
// Front view, drawn like a mirror (the coach's right hand is on the viewer's right).
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { mw } from './theme';

type Pt = [number, number];
type Joint = 'head' | 'ls' | 'rs' | 'le' | 're' | 'lh' | 'rh' | 'lp' | 'rp' | 'lk' | 'rk' | 'lf' | 'rf';
type Pose = Record<Joint, Pt>;

// Figure box: 100 wide x 120 tall, floor at y = 113.
const STAND: Pose = {
  head: [50, 20], ls: [40, 34], rs: [60, 34], le: [35, 50], re: [65, 50], lh: [34, 64], rh: [66, 64],
  lp: [44, 66], rp: [56, 66], lk: [44, 89], rk: [56, 89], lf: [44, 112], rf: [56, 112],
};
// Seated, front view: short thighs angled out to wide knees read as a lap.
const SEATED: Pose = {
  head: [50, 36], ls: [40, 50], rs: [60, 50], le: [35, 64], re: [65, 64], lh: [37, 80], rh: [63, 80],
  lp: [43, 76], rp: [57, 76], lk: [35, 85], rk: [65, 85], lf: [37, 112], rf: [63, 112],
};
const CROUCH: Pose = {
  head: [50, 56], ls: [40, 68], rs: [60, 68], le: [38, 84], re: [62, 84], lh: [44, 104], rh: [56, 104],
  lp: [41, 90], rp: [59, 90], lk: [32, 96], rk: [68, 96], lf: [40, 113], rf: [60, 113],
};

const with_ = (base: Pose, o: Partial<Pose>): Pose => ({ ...base, ...o });
const shift = (p: Pose, dx: number, dy: number): Pose =>
  Object.fromEntries(Object.entries(p).map(([k, [x, y]]) => [k, [x + dx, y + dy]])) as Pose;

// Arms
const armsUp = (b: Pose): Partial<Pose> => {
  const y = b.ls[1];
  return { le: [37, y - 14], re: [63, y - 14], lh: [39, y - 29], rh: [61, y - 29] };
};
const armsWideUp = (b: Pose): Partial<Pose> => {
  const y = b.ls[1];
  return { le: [30, y - 12], re: [70, y - 12], lh: [22, y - 26], rh: [78, y - 26] };
};
const guard = (b: Pose): Partial<Pose> => {
  const y = b.ls[1];
  return { le: [37, y + 12], re: [63, y + 12], lh: [44, y - 2], rh: [56, y - 2] };
};
const crossed = (b: Pose): Partial<Pose> => {
  const y = b.ls[1];
  return { le: [36, y + 10], re: [64, y + 10], lh: [57, y + 4], rh: [43, y + 4] };
};
const punchR = (b: Pose): Partial<Pose> => ({ ...guard(b), re: [72, b.rs[1] - 1], rh: [86, b.rs[1] - 2] });
const punchL = (b: Pose): Partial<Pose> => ({ ...guard(b), le: [28, b.ls[1] - 1], lh: [14, b.ls[1] - 2] });
const wings: Partial<Pose> = { le: [27, 36], re: [73, 36], lh: [15, 36], rh: [85, 36] };
const paws: Partial<Pose> = { le: [33, 32], re: [67, 32], lh: [36, 21], rh: [64, 21] };
const claws: Partial<Pose> = { le: [29, 42], re: [71, 42], lh: [30, 27], rh: [70, 27] };

// Legs
const kneeUpL = (high = 72): Partial<Pose> => ({ lk: [43, high], lf: [42, high + 20] });
const kneeUpR = (high = 72): Partial<Pose> => ({ rk: [57, high], rf: [58, high + 20] });
// Sitting tall: the upper body rises a little with each breath, hips and legs stay put.
const SEATED_TALL: Pose = { ...shift(SEATED, 0, -2), lp: SEATED.lp, rp: SEATED.rp, lk: SEATED.lk, rk: SEATED.rk, lf: SEATED.lf, rf: SEATED.rf, lh: SEATED.lh, rh: SEATED.rh };
const seatedKneeL: Partial<Pose> = { lk: [40, 74], lf: [40, 97] };
const seatedKneeR: Partial<Pose> = { rk: [60, 74], rf: [60, 97] };
const SQUAT: Pose = {
  head: [50, 40], ls: [40, 54], rs: [60, 54], le: [38, 64], re: [62, 64], lh: [45, 61], rh: [55, 61],
  lp: [42, 80], rp: [58, 80], lk: [36, 94], rk: [64, 94], lf: [42, 112], rf: [58, 112],
};
const FEET_TOGETHER: Partial<Pose> = { lk: [46, 89], rk: [54, 89], lf: [46, 112], rf: [54, 112] };
const JACK: Partial<Pose> = { lk: [38, 88], rk: [62, 88], lf: [32, 112], rf: [68, 112] };
const CRAB: Pose = with_(STAND, { lp: [43, 70], rp: [57, 70], lk: [39, 90], rk: [61, 90], lf: [45, 112], rf: [55, 112], head: [50, 24], ls: [40, 38], rs: [60, 38], ...claws });

interface Demo {
  frames: Pose[];
  cycleMs: number;
  chair?: boolean;
}

const pingPong = (a: Pose, b: Pose, cycleMs: number, chair = false): Demo => ({ frames: [a, b], cycleMs, chair });

const DEMOS: Record<string, Demo> = {
  sit_to_stand: pingPong(SEATED, STAND, 3600, true),
  chair_stand_test: pingPong(with_(SEATED, crossed(SEATED)), with_(STAND, crossed(STAND)), 3000, true),
  arm_raise: pingPong(STAND, with_(STAND, armsUp(STAND)), 3600),
  breathing: pingPong(STAND, with_(STAND, armsUp(STAND)), 8000),
  seated_arm_raise: pingPong(SEATED, with_(SEATED, armsUp(SEATED)), 3600, true),
  squats: pingPong(STAND, SQUAT, 3200),
  standing_march: { frames: [STAND, with_(STAND, kneeUpL()), STAND, with_(STAND, kneeUpR())], cycleMs: 2400 },
  seated_march: { frames: [SEATED, with_(SEATED, seatedKneeL), SEATED, with_(SEATED, seatedKneeR)], cycleMs: 2400, chair: true },
  seated_knee_lift: { frames: [SEATED, with_(SEATED, seatedKneeL), SEATED, with_(SEATED, seatedKneeR)], cycleMs: 3200, chair: true },
  balance_hold: pingPong(with_(STAND, { lk: [44, 84], lf: [46, 103], le: [30, 46], lh: [24, 56] }), with_(STAND, { lk: [44, 84], lf: [46, 103], le: [30, 46], lh: [24, 55], head: [50.8, 20] }), 2400),
  flamingo_balance: pingPong(with_(STAND, { lk: [35, 80], lf: [48, 88], ...wings }), with_(STAND, { lk: [35, 80], lf: [48, 88], ...wings, lh: [15, 34], rh: [85, 38] }), 2000),
  seated_tall_hold: pingPong(SEATED, SEATED_TALL, 4000, true),
  punches: { frames: [with_(STAND, guard(STAND)), with_(STAND, punchR(STAND)), with_(STAND, guard(STAND)), with_(STAND, punchL(STAND))], cycleMs: 2000 },
  seated_punches: { frames: [with_(SEATED, guard(SEATED)), with_(SEATED, punchR(SEATED)), with_(SEATED, guard(SEATED)), with_(SEATED, punchL(SEATED))], cycleMs: 2000, chair: true },
  jumping_jacks: pingPong(with_(STAND, FEET_TOGETHER), with_(STAND, { ...JACK, ...armsWideUp(STAND) }), 1600),
  star_jumps: pingPong(with_(STAND, FEET_TOGETHER), shift(with_(STAND, { ...JACK, ...armsWideUp(STAND) }), 0, -4), 1600),
  seated_arm_jacks: pingPong(SEATED, with_(SEATED, armsWideUp(SEATED)), 1800, true),
  side_leg_raise: pingPong(STAND, with_(STAND, { rk: [61, 88], rf: [70, 108], le: [32, 48], lh: [26, 58] }), 3000),
  seated_side_reach: {
    frames: [SEATED, with_(SEATED, { head: [53, 37], re: [66, 40], rh: [72, 26] }), SEATED, with_(SEATED, { head: [47, 37], le: [34, 40], lh: [28, 26] })],
    cycleMs: 4400,
    chair: true,
  },
  frog_jump: { frames: [CROUCH, CROUCH, shift(with_(STAND, armsUp(STAND)), 0, -6), STAND], cycleMs: 2000 },
  bear_steps: { frames: [with_(STAND, paws), with_(STAND, { ...paws, ...kneeUpL(68) }), with_(STAND, paws), with_(STAND, { ...paws, ...kneeUpR(68) })], cycleMs: 2000 },
  crab_walk: { frames: [CRAB, with_(CRAB, { rk: [66, 90], rf: [72, 112] }), shift(CRAB, 6, 0), shift(CRAB, 6, 0)], cycleMs: 2400 },
  // Freeze: dance (bounce), then hold a statue pose.
  freeze: { frames: [with_(STAND, armsWideUp(STAND)), shift(with_(STAND, armsWideUp(STAND)), 0, -4), with_(STAND, wings), with_(STAND, wings)], cycleMs: 2400 },
  side_steps: { frames: [STAND, with_(STAND, { rk: [64, 89], rf: [70, 112] }), shift(STAND, 6, 0), shift(STAND, 6, 0)], cycleMs: 2400 },
};

export const hasDemo = (move: string) => Boolean(DEMOS[move]);
export const DEMO_MOVES = Object.keys(DEMOS);

const smooth = (u: number) => u * u * (3 - 2 * u);

function poseAt(demo: Demo, t: number): Pose {
  const n = demo.frames.length;
  const seg = demo.cycleMs / n;
  const i = Math.floor((t % demo.cycleMs) / seg);
  const u = smooth(((t % demo.cycleMs) - i * seg) / seg);
  const a = demo.frames[i];
  const b = demo.frames[(i + 1) % n];
  return Object.fromEntries((Object.keys(a) as Joint[]).map((k) => [k, [a[k][0] + (b[k][0] - a[k][0]) * u, a[k][1] + (b[k][1] - a[k][1]) * u]])) as Pose;
}

const COLORS = { skin: '#F2C39B', hair: '#3B2A20', shirt: mw.accent, pants: '#3E5BA9', shoe: '#E8ECF7', chair: '#8B6B4A', chairBack: '#6E5238', face: '#3B2A20' };

interface Props {
  move: string;
  width: number;
}

export default function DemoCoach({ move, width }: Props) {
  const demo = DEMOS[move];
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!demo) return undefined;
    const start = Date.now();
    const timer = setInterval(() => setT(Date.now() - start), 40);
    return () => clearInterval(timer);
  }, [demo]);

  if (!demo) return null;
  const k = width / 100;
  const height = Math.round(width * 1.2);
  const p = poseAt(demo, t);
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  const bone = (key: string, a: Pt, b: Pt, thick: number, color: string, overlap = 1) => {
    const [x1, y1] = [a[0] * k, a[1] * k];
    const [x2, y2] = [b[0] * k, b[1] * k];
    const len = Math.hypot(x2 - x1, y2 - y1) + thick * k * overlap; // overlap so joints look round
    const w = thick * k;
    return (
      <View
        key={key}
        style={{
          position: 'absolute',
          left: (x1 + x2) / 2 - len / 2,
          top: (y1 + y2) / 2 - w / 2,
          width: len,
          height: w,
          borderRadius: w / 2,
          backgroundColor: color,
          transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
        }}
      />
    );
  };
  const dot = (key: string, c: Pt, r: number, color: string, extra?: object) => (
    <View key={key} style={{ position: 'absolute', left: c[0] * k - r * k, top: c[1] * k - r * k, width: 2 * r * k, height: 2 * r * k, borderRadius: r * k, backgroundColor: color, ...extra }} />
  );
  const rect = (key: string, x: number, y: number, w: number, h: number, color: string, radius = 1.5) => (
    <View key={key} style={{ position: 'absolute', left: x * k, top: y * k, width: w * k, height: h * k, borderRadius: radius * k, backgroundColor: color }} />
  );

  const neck = mid(p.ls, p.rs);
  const pelvis = mid(p.lp, p.rp);
  const [hx, hy] = p.head;

  return (
    <View style={{ width, height }} accessibilityLabel="Demo coach showing the move">
      {demo.chair
        ? [
            rect('back', 31, 46, 38, 33, COLORS.chairBack, 3),
            rect('legL', 30, 82, 3, 31, COLORS.chair),
            rect('legR', 67, 82, 3, 31, COLORS.chair),
            rect('seat', 27, 78, 46, 5, COLORS.chair, 2),
          ]
        : null}
      {/* Floor shadow */}
      {rect('shadow', 26, 112, 48, 3, 'rgba(0,0,0,0.25)', 2)}
      {bone('thighL', p.lp, p.lk, 8, COLORS.pants)}
      {bone('thighR', p.rp, p.rk, 8, COLORS.pants)}
      {bone('shinL', p.lk, p.lf, 7, COLORS.pants)}
      {bone('shinR', p.rk, p.rf, 7, COLORS.pants)}
      {rect('shoeL', p.lf[0] - 5, p.lf[1] - 2, 10, 4.5, COLORS.shoe, 2.2)}
      {rect('shoeR', p.rf[0] - 5, p.rf[1] - 2, 10, 4.5, COLORS.shoe, 2.2)}
      {bone('torso', neck, pelvis, 17, COLORS.shirt, 0.3)}
      {/* Waistband over the bottom of the shirt */}
      {bone('hips', p.lp, p.rp, 9, COLORS.pants)}
      {bone('shoulders', p.ls, p.rs, 9, COLORS.shirt)}
      {bone('neck', neck, p.head, 4, COLORS.skin)}
      {bone('upperL', p.ls, p.le, 6, COLORS.shirt)}
      {bone('upperR', p.rs, p.re, 6, COLORS.shirt)}
      {bone('foreL', p.le, p.lh, 5, COLORS.skin)}
      {bone('foreR', p.re, p.rh, 5, COLORS.skin)}
      {dot('handL', p.lh, 3.4, COLORS.skin)}
      {dot('handR', p.rh, 3.4, COLORS.skin)}
      {dot('hair', [hx, hy - 1.5], 8.6, COLORS.hair)}
      {dot('head', [hx, hy + 0.8], 7.8, COLORS.skin)}
      {dot('eyeL', [hx - 2.8, hy], 0.9, COLORS.face)}
      {dot('eyeR', [hx + 2.8, hy], 0.9, COLORS.face)}
      {/* Smile: the bottom half of a ring */}
      <View
        style={{
          position: 'absolute',
          left: (hx - 3) * k,
          top: (hy + 0.6) * k,
          width: 6 * k,
          height: 3.4 * k,
          borderBottomLeftRadius: 3 * k,
          borderBottomRightRadius: 3 * k,
          borderWidth: 0.8 * k,
          borderTopWidth: 0,
          borderColor: COLORS.face,
        }}
      />
    </View>
  );
}
