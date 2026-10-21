// Rep counters. Each detector turns a stream of landmark frames into a rep count, a 0..1 "signal"
// for the TV game, form cues and a per-rep form score. Pure: tested in node (test/detectors.test.js).
import {
  HIPS_AND_KNEES, SHOULDERS_AND_HANDS, armHeight, armsHeight, bodyFrame, clamp, elbowAngle, feetSpread, hipRise, torsoTilt, visibleAll,
} from './geometry.js';

/**
 * Two-threshold state machine with smoothing (hysteresis stops jitter from double counting).
 *  - higher values = "active" unless lowerIsActive
 *  - countOn 'exit': a rep counts when you come back to rest (arm raise: arms back down)
 *  - countOn 'enter': a rep counts when you reach the active position (sit-to-stand: standing up)
 */
export class RepCounter {
  constructor({ enter, exit, lowerIsActive = false, countOn = 'exit', minMs = 300, maxMs = 15000, smooth = 0.5 }) {
    Object.assign(this, { enter, exit, lowerIsActive, countOn, minMs, maxMs, smooth });
    this.count = 0;
    this.state = null;
    this.value = null;
    this.lastRepT = null;
  }

  isActive(v) {
    return this.lowerIsActive ? v <= this.enter : v >= this.enter;
  }

  isRest(v) {
    return this.lowerIsActive ? v >= this.exit : v <= this.exit;
  }

  update(raw, t) {
    this.value = this.value === null ? raw : this.value + (raw - this.value) * this.smooth;
    const v = this.value;
    if (this.state === null) {
      // Start in whatever position the person is already in, without counting it.
      this.state = this.isActive(v) ? 'active' : 'rest';
      this.startT = t;
      this.peak = v;
      return null;
    }
    if (this.state === 'rest' && this.isActive(v)) {
      this.state = 'active';
      this.startT = t;
      this.peak = v;
      return this.countOn === 'enter' ? this.tryCount(t, t - (this.lastRepT ?? -Infinity), v) : null;
    }
    if (this.state === 'active') {
      this.peak = this.lowerIsActive ? Math.min(this.peak, v) : Math.max(this.peak, v);
      if (this.isRest(v)) {
        this.state = 'rest';
        return this.countOn === 'exit' ? this.tryCount(t, t - this.startT, this.peak) : null;
      }
    }
    return null;
  }

  tryCount(t, durationMs, peak) {
    if (durationMs < this.minMs) return { rejected: 'too_fast', durationMs, peak };
    if (this.countOn === 'exit' && durationMs > this.maxMs) return { rejected: 'too_slow', durationMs, peak };
    this.count += 1;
    this.lastRepT = t;
    return { count: this.count, durationMs, peak };
  }
}

const norm = (v, [from, to]) => clamp((v - from) / (to - from), 0, 1);

/**
 * Wraps a RepCounter with visibility checks, a game signal, form scoring and cues.
 * update({ lm, t, aspect }) -> { inFrame, need?, count, signal, rep?: {count, formScore}, cue? }
 * need: which body parts must be visible ('upper' = shoulders and hands, 'legs' = hips and knees).
 */
function counterDetector({ required, need, metric, counter, range, score, cueOnRep, liveCue }) {
  return {
    counter,
    need,
    get count() {
      return counter.count;
    },
    update({ lm, t, aspect }) {
      if (!visibleAll(lm, required)) return { inFrame: false, need, count: counter.count, signal: 0 };
      const b = bodyFrame(lm, aspect);
      const value = metric(b);
      const r = counter.update(value, t);
      const out = { inFrame: true, count: counter.count, signal: norm(counter.value, range), value: counter.value };
      if (r?.count) {
        out.rep = { count: r.count, formScore: Math.round(clamp(score ? score(r) : 100, 0, 100)) };
        out.cue = cueOnRep?.(r) ?? null;
      } else if (r?.rejected === 'too_fast') {
        out.cue = 'slow_down';
      }
      if (!out.cue && liveCue) out.cue = liveCue(b, counter, t) ?? null;
      return out;
    },
  };
}

// ---------------------------------------------------------------- sit to stand
// Works from the front or the side: when you stand, your hips rise well above your knees.
function sitToStand({ testMode = false } = {}) {
  return counterDetector({
    required: HIPS_AND_KNEES,
    need: 'legs',
    metric: hipRise,
    counter: new RepCounter({ enter: 0.68, exit: 0.45, countOn: 'enter', minMs: testMode ? 700 : 1200 }),
    range: [0.3, 0.85],
    score: (r) => 70 + norm(r.peak, [0.68, 0.8]) * 30,
    // Once standing, the body should be upright.
    liveCue: (b, c, t) => (c.state === 'active' && t - c.startT > 700 && torsoTilt(b) > 25 ? 'stand_tall' : null),
  });
}

// ---------------------------------------------------------------- arm raises (standing or seated)
function armRaise() {
  return counterDetector({
    required: SHOULDERS_AND_HANDS,
    need: 'upper',
    metric: armsHeight,
    counter: new RepCounter({ enter: 0.3, exit: -0.25, countOn: 'exit', minMs: 700 }),
    range: [-0.9, 0.8],
    score: (r) => 60 + norm(r.peak, [0.3, 0.7]) * 40,
    cueOnRep: (r) => (r.peak < 0.5 ? 'arms_higher' : null),
  });
}

// ---------------------------------------------------------------- squats (and kids' frog jumps)
function squat({ depth = 0.55 } = {}) {
  return counterDetector({
    required: HIPS_AND_KNEES,
    need: 'legs',
    metric: hipRise,
    counter: new RepCounter({ enter: depth, exit: 0.75, lowerIsActive: true, countOn: 'exit', minMs: 500 }),
    range: [0.85, 0.35],
    score: (r) => 100 - clamp((r.peak - 0.35) * 200, 0, 40),
    liveCue: (b, c) => (c.state === 'active' && torsoTilt(b) > 55 ? 'stand_tall' : null),
  });
}

// ---------------------------------------------------------------- jumping jacks / star jumps (arms up + feet apart)
const FULL_JACK = [11, 12, 15, 16, 23, 24, 27, 28];
function jacks({ seated = false } = {}) {
  return counterDetector({
    required: seated ? SHOULDERS_AND_HANDS : FULL_JACK,
    need: seated ? 'upper' : 'legs',
    // 1 = open (arms up, feet apart), 0 = closed, 0.5 = in between.
    metric: (b) => {
      const arms = armsHeight(b);
      const feetOpen = seated || feetSpread(b) > 1.7;
      const feetClosed = seated || feetSpread(b) < 1.4;
      if (arms > 0.2 && feetOpen) return 1;
      if (arms < -0.3 && feetClosed) return 0;
      return 0.5;
    },
    counter: new RepCounter({ enter: 0.9, exit: 0.1, countOn: 'exit', minMs: 350, smooth: 0.6 }),
    range: [0, 1],
  });
}

// ---------------------------------------------------------------- punches (each arm counts)
// A punch = the elbow straightens while the hand is up near the chest. Uses MediaPipe's 3D world
// landmarks when available, so punches straight at the camera still register.
function punches() {
  const required = [11, 12, 13, 14, 15, 16];
  const make = () => new RepCounter({ enter: 150, exit: 115, countOn: 'enter', minMs: 250, smooth: 0.7 });
  const sides = { L: make(), R: make() };
  let total = 0;
  return {
    need: 'upper',
    get count() {
      return total;
    },
    update({ lm, world, t, aspect }) {
      if (!visibleAll(lm, required)) return { inFrame: false, need: 'upper', count: total, signal: 0 };
      const b = bodyFrame(lm, aspect);
      const out = { inFrame: true, count: total, signal: 0 };
      for (const side of ['L', 'R']) {
        // A straight arm hanging by your side is not a punch.
        const value = armHeight(b, side) > -0.6 ? elbowAngle(lm, world, side) : 90;
        const r = sides[side].update(value, t);
        out.signal = Math.max(out.signal, norm(sides[side].value, [90, 170]));
        if (r?.count) {
          total += 1;
          out.rep = { count: total, formScore: Math.round(70 + norm(value, [150, 175]) * 30) };
        }
      }
      out.count = total;
      return out;
    },
  };
}

// ---------------------------------------------------------------- slow breathing with arm raises (Calm River)
// Same movement as arm raises, but paced: arms float up on the in-breath and down on the out-breath.
function breathing() {
  return counterDetector({
    required: SHOULDERS_AND_HANDS,
    need: 'upper',
    metric: armsHeight,
    counter: new RepCounter({ enter: 0.15, exit: -0.3, countOn: 'exit', minMs: 2500, maxMs: 30000 }),
    range: [-0.9, 0.6],
    score: () => 100,
  });
}

// ---------------------------------------------------------------- holds (Balance Bridge, sit-tall)
// Counts whole seconds held. Sends a "balance" game event with how steady you are (wobble 0..1),
// measured as side-to-side sway of the shoulders over the last second.
const std = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

function hold({ required, need, holding }) {
  let seconds = 0;
  let heldMs = 0;
  let lastT = null;
  let wasHolding = false;
  const sway = [];
  return {
    need,
    get count() {
      return seconds;
    },
    update({ lm, t, aspect }) {
      if (!visibleAll(lm, required)) {
        lastT = t;
        wasHolding = false;
        return { inFrame: false, need, count: seconds, signal: 0, game: { kind: 'balance', holding: false, seconds, wobble: 1 } };
      }
      const b = bodyFrame(lm, aspect);
      const isHolding = holding(b);
      if (isHolding && wasHolding && lastT !== null) heldMs += Math.min(200, t - lastT);
      wasHolding = isHolding;
      lastT = t;
      sway.push(b.sm.x / b.shoulderWidth);
      if (sway.length > 25) sway.shift();
      const wobble = sway.length > 5 ? clamp(std(sway) / 0.08, 0, 1) : 0;
      const out = { inFrame: true, count: seconds, signal: isHolding ? 1 - wobble : 0 };
      const whole = Math.floor(heldMs / 1000);
      if (whole > seconds) {
        seconds = whole;
        out.count = seconds;
        out.rep = { count: seconds, formScore: Math.round(100 - wobble * 40) };
      }
      out.game = { kind: 'balance', holding: isHolding, seconds, wobble: Math.round(wobble * 100) / 100 };
      if (isHolding && wobble > 0.6) out.cue = 'hold_steady';
      return out;
    },
  };
}

// ---------------------------------------------------------------- freeze (kids' Freeze Dance)
// Counts seconds held still like a statue: hands and shoulders barely move over the last ~0.4 s.
function freezeStill() {
  const recent = [];
  return hold({
    required: SHOULDERS_AND_HANDS,
    need: 'upper',
    holding: (b) => {
      recent.push([b.lw.x, b.lw.y, b.rw.x, b.rw.y, b.sm.x, b.sm.y]);
      if (recent.length > 12) recent.shift();
      if (recent.length < 6) return false;
      let moved = 0;
      for (let k = 0; k < 6; k += 2) {
        const xs = recent.map((p) => p[k]);
        const ys = recent.map((p) => p[k + 1]);
        moved = Math.max(moved, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
      }
      return moved / b.torso < 0.12;
    },
  });
}

// ---------------------------------------------------------------- knee lifts (standing march, kids' bear stomps)
// Each knee that rises towards hip height counts once.
function kneeLifts() {
  const make = () => new RepCounter({ enter: 0.55, exit: 0.72, lowerIsActive: true, countOn: 'enter', minMs: 250 });
  const legs = { L: make(), R: make() };
  let total = 0;
  return {
    need: 'legs',
    get count() {
      return total;
    },
    update({ lm, t, aspect }) {
      if (!visibleAll(lm, HIPS_AND_KNEES)) return { inFrame: false, need: 'legs', count: total, signal: 0 };
      const b = bodyFrame(lm, aspect);
      const out = { inFrame: true, count: total, signal: 0 };
      for (const side of ['L', 'R']) {
        const drop = side === 'L' ? (b.lk.y - b.lh.y) / b.torso : (b.rk.y - b.rh.y) / b.torso;
        const r = legs[side].update(drop, t);
        out.signal = Math.max(out.signal, norm(legs[side].value, [0.85, 0.4]));
        if (r?.count) {
          total += 1;
          out.rep = { count: total, formScore: 100 };
        }
      }
      out.count = total;
      return out;
    },
  };
}

// ---------------------------------------------------------------- side steps (kids' crab steps)
// Counts each clear step sideways: the hips move about a third of a torso length from where they were.
function sideSteps() {
  const STEP = 0.35;
  let anchor = null;
  let x = null;
  let dir = 0; // direction of the last counted step
  let settle = 0; // frames left in which the step is still landing
  let total = 0;
  return {
    need: 'legs',
    get count() {
      return total;
    },
    update({ lm, aspect }) {
      if (!visibleAll(lm, [11, 12, 23, 24])) return { inFrame: false, need: 'legs', count: total, signal: 0 };
      const b = bodyFrame(lm, aspect);
      const raw = b.hm.x / b.torso;
      x = x === null ? raw : x + (raw - x) * 0.5;
      if (anchor === null) anchor = x;
      // While a counted step is still landing, follow it, so the next step is measured from where you landed.
      if (settle > 0) {
        settle -= 1;
        if ((x - anchor) * dir > 0) anchor = x;
      }
      const out = { inFrame: true, count: total, signal: clamp(Math.abs(x - anchor) / STEP, 0, 1) };
      if (Math.abs(x - anchor) >= STEP) {
        total += 1;
        dir = Math.sign(x - anchor);
        settle = 6;
        anchor = x;
        out.count = total;
        out.rep = { count: total, formScore: 100 };
      }
      return out;
    },
  };
}

// One foot lifted: the ankles are at clearly different heights.
const footLifted = (b) => Math.abs(b.la.y - b.ra.y) / b.torso > 0.12;
// Sitting tall: shoulders level and the head above them.
const sittingTall = (lm) => (b) => Math.abs(b.ls.y - b.rs.y) / b.shoulderWidth < 0.15 && lm[0].y < b.sm.y;

const BUILDERS = {
  sit_to_stand: sitToStand,
  chair_stand_test: () => sitToStand({ testMode: true }),
  arm_raise: armRaise,
  seated_arm_raise: armRaise,
  breathing,
  standing_march: kneeLifts,
  bear_steps: kneeLifts,
  side_steps: sideSteps,
  crab_walk: sideSteps,
  freeze: freezeStill,
  balance_hold: () => hold({ required: [11, 12, 23, 24, 25, 26, 27, 28], need: 'legs', holding: footLifted }),
  flamingo_balance: () => hold({ required: [11, 12, 23, 24, 25, 26, 27, 28], need: 'legs', holding: footLifted }),
  seated_tall_hold: () => {
    let latest = null;
    const detector = hold({ required: [0, 11, 12], need: 'upper', holding: (b) => sittingTall(latest)(b) });
    return { ...detector, get count() { return detector.count; }, update: (frame) => ((latest = frame.lm), detector.update(frame)) };
  },
  squats: () => squat(),
  frog_jump: () => squat({ depth: 0.5 }),
  jumping_jacks: () => jacks(),
  star_jumps: () => jacks(),
  seated_arm_jacks: () => jacks({ seated: true }),
  punches,
  seated_punches: punches,
};

export const SUPPORTED_EXERCISES = Object.keys(BUILDERS);

/** Returns a fresh detector, or null when this exercise isn't supported on the phone yet. */
export function createDetector(exerciseId) {
  return BUILDERS[exerciseId]?.() ?? null;
}
