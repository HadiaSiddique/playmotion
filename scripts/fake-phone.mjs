// Pretends to be the phone: joins the TV's code and sends a moving skeleton plus rep/form events,
// so you can check the TV screens without standing in front of a camera.
//   node scripts/fake-phone.mjs 123456            (code shown on the TV)
//   node scripts/fake-phone.mjs 123456 wss://...  (explicit WebSocket URL)
// Needs Node 22+ (built-in WebSocket).
import { readFileSync } from 'node:fs';

const code = process.argv[2];
if (!/^\d{6}$/.test(code ?? '')) {
  console.error('Usage: node scripts/fake-phone.mjs <6-digit code from the TV>');
  process.exit(1);
}
const url = process.argv[3] ?? JSON.parse(readFileSync(new URL('../infra/.stack-outputs.json', import.meta.url), 'utf8')).WebSocketUrl;
const ws = new WebSocket(`${url}?role=phone`);
const relay = (type, payload) => ws.send(JSON.stringify({ action: 'relay', type, payload }));

/** Front-view skeleton; `rise` 0 = sitting, 1 = standing; `arms` -1 = down, 1 = overhead. */
function skeleton(rise, arms) {
  const lm = Array.from({ length: 33 }, () => [0.5, 0.5, 0, 0]);
  const set = (i, x, y) => (lm[i] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, 0, 0.99]);
  const hipY = 0.62 - rise * 0.12;
  const shoulderY = hipY - 0.25;
  const kneeY = hipY + 0.06 + rise * 0.15;
  set(0, 0.5, shoulderY - 0.1);
  set(11, 0.44, shoulderY);
  set(12, 0.56, shoulderY);
  set(23, 0.46, hipY);
  set(24, 0.54, hipY);
  set(25, 0.45, kneeY);
  set(26, 0.55, kneeY);
  set(27, 0.45, 0.93);
  set(28, 0.55, 0.93);
  const wristY = shoulderY - arms * 0.22;
  set(13, 0.39, (shoulderY + wristY) / 2);
  set(14, 0.61, (shoulderY + wristY) / 2);
  set(15, 0.36 - Math.max(0, arms) * 0.02, wristY);
  set(16, 0.64 + Math.max(0, arms) * 0.02, wristY);
  return lm;
}

let exercise = 'sit_to_stand';
let reps = 0;
let t = 0;
let ticks = 0;

ws.onopen = () => ws.send(JSON.stringify({ action: 'join', code, role: 'phone' }));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'joined') {
    console.log(`Connected ✓ to TV code ${m.code}`);
    relay('status', { camera: 'ready', facing: 'user' });
    setInterval(tick, 80);
  } else if (m.type === 'error') {
    console.log(`error: ${m.message}`);
    process.exit(1);
  } else if (m.type === 'event' && m.event === 'control') {
    console.log('← control', JSON.stringify(m.payload));
    if (m.payload?.cmd === 'start') {
      exercise = m.payload.seated && m.payload.exercise === 'arm_raise' ? 'seated_arm_raise' : m.payload.exercise;
      reps = 0;
    }
  }
};

const HOLDS = ['balance_hold', 'flamingo_balance', 'seated_tall_hold'];

function tick() {
  t += 0.08;
  ticks += 1;
  const phase = (Math.sin(t * 2) + 1) / 2; // one rep about every 3 s
  const isArms = exercise.includes('arm') || exercise === 'breathing';
  relay('pose', { lm: skeleton(isArms ? 1 : phase, isArms ? phase * 2 - 1 : -1), ar: 0.75, mirrored: true });

  if (HOLDS.includes(exercise)) {
    // Holding with some wobble; the foot comes down for ~2 s every 10 s. One "rep" per second held.
    const holding = ticks % 125 > 25;
    const wobble = Math.round((0.2 + 0.25 * Math.abs(Math.sin(t))) * 100) / 100;
    if (ticks % 3 === 0) relay('game', { kind: 'balance', exercise, holding, seconds: reps, wobble });
    if (holding && ticks % 12 === 0) {
      reps += 1;
      relay('rep', { exercise, count: reps, formScore: Math.round(100 - wobble * 40) });
      console.log(`→ held ${reps}s (${exercise})`);
    }
    return;
  }
  if (ticks % 3 === 0) relay('game', { kind: 'signal', exercise, signal: Math.round(phase * 100) / 100 });
  // Slow breaths every ~4 s, chair stands every ~2.4 s, other reps every ~3 s.
  const every = exercise === 'breathing' ? 50 : exercise === 'chair_stand_test' ? 30 : 39;
  if (ticks % every === 0) {
    reps += 1;
    relay('rep', { exercise, count: reps, formScore: 80 + (reps % 4) * 5 });
    if (reps % 3 === 0 && exercise !== 'breathing') relay('form', { exercise, cue: isArms ? 'arms_higher' : 'stand_tall', severity: 'tip' });
    console.log(`→ rep ${reps} (${exercise})`);
  }
}
