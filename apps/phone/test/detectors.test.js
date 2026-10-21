// Rep counting on synthetic skeletons (no camera needed).  Run:  npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RepCounter, createDetector } from '../src/lib/pose/detectors.js';
import { armsHeight, bodyFrame, fullBodyInFrame, hipRise } from '../src/lib/pose/geometry.js';

const T = 0.25; // torso length in picture-height units

/** Front-view skeleton. kneeDrop: knees below hips in torso lengths (0.85 standing, 0.25 sitting). arms: wrists above shoulders. */
function pose({ kneeDrop = 0.85, kneeL, kneeR, shift = 0, arms = -0.95, armsL, armsR, spread = 1, visibility = 0.99, hide = [] } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }));
  const set = (i, x, y) => {
    lm[i] = { x, y, z: 0, visibility };
  };
  const sy = 0.3;
  const hy = sy + T;
  set(0, 0.5, sy - 0.1);
  set(11, 0.44, sy);
  set(12, 0.56, sy);
  set(23, 0.45, hy);
  set(24, 0.55, hy);
  set(25, 0.45, hy + (kneeL ?? kneeDrop) * T);
  set(26, 0.55, hy + (kneeR ?? kneeDrop) * T);
  set(27, 0.5 - 0.05 * spread, Math.min(0.95, hy + kneeDrop * T + 0.8 * T));
  set(28, 0.5 + 0.05 * spread, Math.min(0.95, hy + kneeDrop * T + 0.8 * T));
  const aL = armsL ?? arms;
  const aR = armsR ?? arms;
  set(13, 0.4, sy - (aL * T) / 2);
  set(14, 0.6, sy - (aR * T) / 2);
  set(15, 0.38, sy - aL * T);
  set(16, 0.62, sy - aR * T);
  for (const i of hide) lm[i] = { ...lm[i], visibility: 0.05 };
  if (shift) for (const p of lm) p.x += shift;
  return lm;
}

/** Feeds [params, frames] segments at 25 fps; returns all results. */
function run(detector, segments) {
  const out = [];
  let t = 0;
  for (const [params, frames] of segments) {
    for (let i = 0; i < frames; i++) {
      out.push(detector.update({ lm: pose(params), t, aspect: 1 }));
      t += 40;
    }
  }
  return out;
}

const SIT = { kneeDrop: 0.25 };
const STAND = { kneeDrop: 0.85 };
const DOWN = { arms: -0.95 };
const UP = { arms: 0.8 };

test('geometry: hip rise and arm height read the synthetic skeleton correctly', () => {
  const b = bodyFrame(pose(STAND));
  assert.ok(Math.abs(hipRise(b) - 0.85) < 0.01);
  assert.ok(Math.abs(armsHeight(bodyFrame(pose(UP))) - 0.8) < 0.01);
  assert.ok(Math.abs(hipRise(bodyFrame(pose(SIT))) - 0.25) < 0.01);
});

test('sit to stand: counts each time you stand up, not when you start standing', () => {
  const d = createDetector('sit_to_stand');
  const results = run(d, [[SIT, 15], [STAND, 30], [SIT, 30], [STAND, 30], [SIT, 30], [STAND, 30]]);
  assert.equal(d.count, 3);
  const reps = results.filter((r) => r.rep);
  assert.equal(reps.length, 3);
  for (const r of reps) assert.ok(r.rep.formScore >= 70 && r.rep.formScore <= 100);

  const startStanding = createDetector('sit_to_stand');
  run(startStanding, [[STAND, 20], [SIT, 30], [STAND, 30]]);
  assert.equal(startStanding.count, 1);
});

test('sit to stand: bouncing faster than a real stand is not counted', () => {
  const d = createDetector('sit_to_stand');
  const results = run(d, [[SIT, 10], [STAND, 8], [SIT, 5], [STAND, 8], [SIT, 5], [STAND, 8]]);
  assert.equal(d.count, 1);
  assert.ok(results.some((r) => r.cue === 'slow_down'));
});

test('chair-stand test mode allows a faster pace', () => {
  const d = createDetector('chair_stand_test');
  run(d, [[SIT, 10], [STAND, 10], [SIT, 10], [STAND, 10], [SIT, 10], [STAND, 10]]);
  assert.equal(d.count, 3);
});

test('arm raises: counts full up-and-down cycles and scores height', () => {
  const d = createDetector('arm_raise');
  const results = run(d, [[DOWN, 10], [UP, 25], [DOWN, 20], [UP, 25], [DOWN, 20]]);
  assert.equal(d.count, 2);
  const reps = results.filter((r) => r.rep);
  assert.ok(reps.every((r) => r.rep.formScore >= 95));
});

test('arm raises: a low raise counts but gets the "arms higher" cue', () => {
  const d = createDetector('arm_raise');
  const results = run(d, [[DOWN, 10], [{ arms: 0.4 }, 25], [DOWN, 20]]);
  assert.equal(d.count, 1);
  const rep = results.find((r) => r.rep);
  assert.equal(rep.cue, 'arms_higher');
  assert.ok(rep.rep.formScore < 90);
});

test('arm raises: seated version uses the same counter', () => {
  const d = createDetector('seated_arm_raise');
  run(d, [[{ ...SIT, ...DOWN }, 10], [{ ...SIT, ...UP }, 25], [{ ...SIT, ...DOWN }, 20]]);
  assert.equal(d.count, 1);
});

test('arm raises: still count when hips and legs are hidden (sitting at a table, close to the phone)', () => {
  const LOWER = [23, 24, 25, 26, 27, 28];
  const d = createDetector('seated_arm_raise');
  const results = run(d, [[{ ...DOWN, hide: LOWER }, 10], [{ ...UP, hide: LOWER }, 25], [{ ...DOWN, hide: LOWER }, 20]]);
  assert.equal(d.count, 1);
  assert.ok(results.every((r) => r.inFrame === true));
});

test('sit to stand: hidden hips report what is missing', () => {
  const d = createDetector('sit_to_stand');
  const [r] = run(d, [[{ ...STAND, hide: [23, 24, 25, 26] }, 1]]);
  assert.equal(r.inFrame, false);
  assert.equal(r.need, 'legs');
});

test('out of frame: no counting, inFrame false', () => {
  const d = createDetector('arm_raise');
  const results = run(d, [[{ ...DOWN, visibility: 0.1 }, 5], [{ ...UP, visibility: 0.1 }, 25], [{ ...DOWN, visibility: 0.1 }, 20]]);
  assert.equal(d.count, 0);
  assert.ok(results.every((r) => r.inFrame === false));
});

test('fullBodyInFrame: needs every key point visible and inside the picture', () => {
  assert.equal(fullBodyInFrame(pose(STAND)), true);
  assert.equal(fullBodyInFrame(pose({ ...STAND, visibility: 0.3 })), false);
  const cut = pose(STAND);
  cut[27] = { ...cut[27], y: 1.05 };
  assert.equal(fullBodyInFrame(cut), false);
  assert.equal(fullBodyInFrame(null), false);
});

test('RepCounter: jitter around one threshold never counts', () => {
  const c = new RepCounter({ enter: 0.3, exit: -0.25, minMs: 100 });
  let t = 0;
  for (let i = 0; i < 100; i++) {
    c.update(i % 2 ? 0.32 : 0.2, t);
    t += 40;
  }
  assert.equal(c.count, 0);
});

test('squats: counts deep enough squats and scores depth', () => {
  const d = createDetector('squats');
  const results = run(d, [[STAND, 10], [{ kneeDrop: 0.35 }, 20], [STAND, 20], [{ kneeDrop: 0.35 }, 20], [STAND, 20], [{ kneeDrop: 0.65 }, 20], [STAND, 20]]);
  assert.equal(d.count, 2, 'the shallow third squat does not count');
  assert.ok(results.filter((r) => r.rep).every((r) => r.rep.formScore >= 90));
});

test('jumping jacks: arms up + feet apart, then back together', () => {
  const OPEN = { arms: 0.6, spread: 2.6 };
  const CLOSED = { arms: -0.9, spread: 1 };
  const d = createDetector('jumping_jacks');
  run(d, [[CLOSED, 8], [OPEN, 10], [CLOSED, 10], [OPEN, 10], [CLOSED, 10], [{ arms: 0.6, spread: 1 }, 10], [CLOSED, 10]]);
  assert.equal(d.count, 2, 'arms up without feet apart is not a jack');
  const seated = createDetector('seated_arm_jacks');
  run(seated, [[{ arms: -0.9, hide: [23, 24, 25, 26, 27, 28] }, 8], [{ arms: 0.6, hide: [23, 24, 25, 26, 27, 28] }, 10], [{ arms: -0.9, hide: [23, 24, 25, 26, 27, 28] }, 10]]);
  assert.equal(seated.count, 1);
});

test('punches: each straightening of an arm at chest height counts', () => {
  // Left arm: guard (bent) vs punch (straight out to the side at shoulder height).
  const guard = () => {
    const lm = pose({ armsR: -0.95 });
    lm[13] = { x: 0.38, y: 0.36, z: 0, visibility: 0.99 };
    lm[15] = { x: 0.44, y: 0.33, z: 0, visibility: 0.99 };
    return lm;
  };
  const punch = () => {
    const lm = pose({ armsR: -0.95 });
    lm[13] = { x: 0.34, y: 0.3, z: 0, visibility: 0.99 };
    lm[15] = { x: 0.24, y: 0.3, z: 0, visibility: 0.99 };
    return lm;
  };
  const d = createDetector('punches');
  let t = 0;
  const feed = (make, frames) => {
    for (let i = 0; i < frames; i++) {
      const lm = make();
      d.update({ lm, world: lm, t, aspect: 1 });
      t += 40;
    }
  };
  feed(guard, 8);
  feed(punch, 8);
  feed(guard, 8);
  feed(punch, 8);
  feed(guard, 8);
  assert.equal(d.count, 2);
  // An arm hanging straight down is not a punch.
  const hanging = createDetector('punches');
  run(hanging, [[{ arms: -0.95 }, 30]]);
  assert.equal(hanging.count, 0);
});

test('balance hold: counts whole seconds with one foot up, pauses when the foot comes down', () => {
  const footUp = () => {
    const lm = pose(STAND);
    lm[27] = { ...lm[27], y: lm[27].y - 0.06 }; // left ankle lifted (0.24 torso lengths)
    return lm;
  };
  const d = createDetector('balance_hold');
  let t = 0;
  const results = [];
  const feed = (make, frames) => {
    for (let i = 0; i < frames; i++) {
      results.push(d.update({ lm: make(), t, aspect: 1 }));
      t += 40;
    }
  };
  feed(footUp, 76); // ~3 s
  assert.equal(d.count, 3);
  feed(() => pose(STAND), 50); // foot down for 2 s: no time added
  assert.equal(d.count, 3);
  feed(footUp, 30);
  assert.equal(d.count, 4);
  const last = results.at(-1);
  assert.equal(last.game.kind, 'balance');
  assert.equal(last.game.holding, true);
  assert.ok(last.game.wobble < 0.2, 'a perfectly still synthetic body has almost no wobble');
});

test('breathing: slow arm raises count, rushed ones get "slow down"', () => {
  const d = createDetector('breathing');
  const slow = run(d, [[DOWN, 10], [UP, 75], [DOWN, 40]]); // 3 s up
  assert.equal(d.count, 1);
  const fast = createDetector('breathing');
  const rushed = run(fast, [[DOWN, 10], [UP, 20], [DOWN, 20]]); // under a second up
  assert.equal(fast.count, 0);
  assert.ok(rushed.some((r) => r.cue === 'slow_down'));
  assert.ok(slow.length);
});

test('bear stomps: each knee lift counts, left and right', () => {
  const d = createDetector('bear_steps');
  run(d, [[STAND, 8], [{ kneeL: 0.35 }, 10], [STAND, 8], [{ kneeR: 0.35 }, 10], [STAND, 8], [{ kneeL: 0.35 }, 10], [STAND, 8]]);
  assert.equal(d.count, 3);
  const small = createDetector('standing_march');
  run(small, [[STAND, 8], [{ kneeL: 0.7 }, 10], [STAND, 8]]);
  assert.equal(small.count, 0, 'a small knee bend is not a stomp');
});

test('crab steps: clear sideways steps count, standing still does not', () => {
  const d = createDetector('crab_walk');
  run(d, [[STAND, 10], [{ shift: 0.1 }, 10], [{ shift: 0.2 }, 10], [{ shift: 0.1 }, 10], [{ shift: 0 }, 10]]);
  assert.equal(d.count, 4);
  const still = createDetector('side_steps');
  run(still, [[STAND, 40], [{ shift: 0.02 }, 20]]);
  assert.equal(still.count, 0);
});

test('unknown exercise has no detector yet', () => {
  assert.equal(createDetector('side_leg_raise'), null);
});

test('freeze: counts seconds held still, not while dancing', () => {
  const still = createDetector('freeze');
  run(still, [[{ arms: 0 }, 100]]); // 4 s like a statue
  assert.ok(still.count >= 3, `held ${still.count} s`);

  const dancing = createDetector('freeze');
  const wiggle = [];
  for (let i = 0; i < 50; i++) wiggle.push([i % 2 ? UP : DOWN, 2]); // arms flapping up and down
  run(dancing, wiggle);
  assert.equal(dancing.count, 0);
});
