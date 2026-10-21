// Runs the active detector on every frame and turns results into WebSocket events:
//   rep    { exercise, count, formScore }
//   form   { exercise, cue, severity }        (rate-limited so the TV doesn't nag)
//   game   { kind: 'signal', exercise, signal } at 5 Hz (drives the TV game smoothly between reps)
//   status { inFrame, need }                  when the needed body parts leave or enter the picture
//   status { exercise, supported }            when an exercise starts (so the TV can show how to do it)
import { EXERCISES } from '@shared/catalog.mjs';
import { createDetector } from './detectors.js';

export const CUE_TEXT = {
  slow_down: 'Nice and slow. Control the move.',
  stand_tall: 'Stand tall and look ahead.',
  arms_higher: 'Reach a little higher if it feels okay.',
  step_in_frame: 'Step back or tilt the phone down so we can see your hips and knees.',
  show_arms: 'Make sure your shoulders and both hands are in the picture.',
  hold_steady: 'Hold steady. Breathe. Use the chair if you need it.',
};

/** What to show when the needed body parts aren't visible. */
export const NEED_TEXT = {
  legs: 'We need to see your hips and knees. Step back or tilt the phone down.',
  upper: 'We need to see your shoulders and both hands. Move back a little.',
};

const SAME_CUE_MS = 5000;
const FRAME_CUE_MS = 15_000; // "step back" at most every 15 s
const OUT_OF_FRAME_MS = 1500;
const IN_FRAME_MS = 300;
const ANY_CUE_MS = 2000;
const GAME_EVENT_MS = 200;

export const exerciseName = (id) => (id === 'chair_stand_test' ? '30-second chair-stand test' : EXERCISES[id]?.name ?? id);

/** The exercise to actually track: the seated version when the TV asks for seated. */
export function resolveExercise(id, seated) {
  const ex = EXERCISES[id];
  if (seated && ex?.posture === 'standing' && ex.seatedAlt) return ex.seatedAlt;
  return id;
}

export class PoseEngine {
  constructor(emit) {
    this.emit = emit;
    this.reset();
  }

  reset() {
    this.detector = null;
    this.exercise = null;
    this.paused = false;
    this.inFrame = null; // what the TV was told
    this.rawInFrame = null; // what the last frame said
    this.rawSince = 0;
    this.lastCue = {};
    this.lastAnyCue = -Infinity;
    this.lastGame = -Infinity;
  }

  /** Returns { exercise, supported }. */
  start(id, { seated = false } = {}) {
    const exercise = resolveExercise(id, seated);
    this.reset();
    this.exercise = exercise;
    this.detector = createDetector(exercise);
    const supported = Boolean(this.detector);
    this.emit('status', { exercise, supported });
    return { exercise, supported };
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  stop() {
    this.reset();
  }

  get count() {
    return this.detector?.count ?? 0;
  }

  process(lm, t, aspect, world = null) {
    if (!this.detector || this.paused) return null;
    const r = this.detector.update({ lm, world, t, aspect });
    this.setInFrame(r.inFrame, t, this.detector.need);
    if (r.rep) this.emit('rep', { exercise: this.exercise, count: r.rep.count, formScore: r.rep.formScore });
    if (r.cue) this.cue(r.cue, t);
    if (r.inFrame && t - this.lastGame >= GAME_EVENT_MS) {
      this.lastGame = t;
      // Holds send { kind: 'balance', holding, seconds, wobble }; everything else a plain 0..1 signal.
      this.emit('game', { kind: 'signal', ...r.game, exercise: this.exercise, signal: Math.round(r.signal * 100) / 100 });
    }
    return r;
  }

  /**
   * Debounced: the model loses a knee or a hand for a few frames all the time, so "out of view" is only
   * reported after OUT_OF_FRAME_MS without the needed body parts, and "back in view" after IN_FRAME_MS.
   */
  setInFrame(raw, t, need) {
    if (raw !== this.rawInFrame) {
      this.rawInFrame = raw;
      this.rawSince = t;
    }
    const steadyFor = t - this.rawSince;
    const settled = this.inFrame === null || steadyFor >= (raw ? IN_FRAME_MS : OUT_OF_FRAME_MS);
    if (settled && raw !== this.inFrame) {
      this.inFrame = raw;
      this.emit('status', { inFrame: raw, need });
    }
    if (this.inFrame === false) this.cue(need === 'upper' ? 'show_arms' : 'step_in_frame', t, FRAME_CUE_MS);
  }

  cue(cue, t, sameGap = SAME_CUE_MS) {
    if (t - (this.lastCue[cue] ?? -Infinity) < sameGap || t - this.lastAnyCue < ANY_CUE_MS) return;
    this.lastCue[cue] = t;
    this.lastAnyCue = t;
    this.emit('form', { exercise: this.exercise, cue, severity: 'tip' });
  }
}
