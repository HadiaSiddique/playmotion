// Body geometry from MediaPipe's 33 normalised landmarks (x, y in 0..1, y pointing down).
// Pure functions: no browser APIs, so they run in node tests.

export const LM = {
  NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14, L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28, L_FOOT: 31, R_FOOT: 32,
};

// What has to be visible to judge the whole body (placement guide) and each kind of move.
export const FULL_BODY = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
// Arm moves only need shoulders and hands, so seated users at a desk or close to the phone still count.
export const SHOULDERS_AND_HANDS = [11, 12, 15, 16];
export const UPPER_BODY = [0, 11, 12, 13, 14, 15, 16];
export const HIPS_AND_KNEES = [11, 12, 23, 24, 25, 26];

// Shoulder-to-hip length is about 1.4x the distance between the shoulder points (front view).
const TORSO_PER_SHOULDER_WIDTH = 1.4;

export const SKELETON = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32],
];

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const visibleAll = (lm, ids, min = 0.5) => Boolean(lm) && ids.every((i) => (lm[i]?.visibility ?? 0) >= min);

/** True when every key point is confidently visible and inside the picture (with a small margin). */
export function fullBodyInFrame(lm, margin = 0.02) {
  return pointsInFrame(lm, FULL_BODY, margin);
}

/** Head, shoulders, elbows and hands in view: enough for seated and arm moves. */
export function upperBodyInFrame(lm, margin = 0.02) {
  return pointsInFrame(lm, UPPER_BODY, margin);
}

function pointsInFrame(lm, ids, margin) {
  if (!visibleAll(lm, ids, 0.6)) return false;
  return ids.every((i) => lm[i].x > margin && lm[i].x < 1 - margin && lm[i].y > margin && lm[i].y < 1 - margin);
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Key points in "picture height" units: x is multiplied by the aspect ratio (width / height)
 * so distances are the same horizontally and vertically.
 */
export function bodyFrame(lm, aspect = 1) {
  const p = (i) => ({ x: lm[i].x * aspect, y: lm[i].y });
  const b = {
    ls: p(11), rs: p(12), le: p(13), re: p(14), lw: p(15), rw: p(16), lh: p(23), rh: p(24), lk: p(25), rk: p(26), la: p(27), ra: p(28),
  };
  b.sm = mid(b.ls, b.rs);
  b.hm = mid(b.lh, b.rh);
  b.shoulderWidth = Math.max(1e-3, dist(b.ls, b.rs));
  b.hipWidth = Math.max(1e-3, dist(b.lh, b.rh));
  // When the hips are hidden (sitting at a table, close to the phone), estimate the torso from the shoulders.
  const hipsVisible = (lm[23]?.visibility ?? 0) >= 0.5 && (lm[24]?.visibility ?? 0) >= 0.5;
  b.torso = hipsVisible ? Math.max(1e-3, dist(b.sm, b.hm)) : b.shoulderWidth * TORSO_PER_SHOULDER_WIDTH;
  return b;
}

/** Knees below hips, in torso lengths: ~0.85 standing, ~0.2-0.4 sitting (front or side view). */
export const hipRise = (b) => ((b.lk.y + b.rk.y) / 2 - b.hm.y) / b.torso;

/** Wrist above shoulder, in torso lengths: ~-1 arms by the sides, 0 at shoulder height, ~+0.8 overhead. */
export const armHeight = (b, side) => (side === 'L' ? b.ls.y - b.lw.y : b.rs.y - b.rw.y) / b.torso;

export const armsHeight = (b) => (armHeight(b, 'L') + armHeight(b, 'R')) / 2;

/** Feet apart, in hip widths: ~1 feet together, ~2.5+ jumping-jack wide. */
export const feetSpread = (b) => Math.abs(b.la.x - b.ra.x) / b.hipWidth;

/** Angle at b (degrees) between a-b and c-b; uses z when present (MediaPipe world landmarks are in metres). */
export function angle3(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
  const v2 = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (!n) return 180;
  const cos = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / n;
  return (Math.acos(clamp(cos, -1, 1)) * 180) / Math.PI;
}

/** Elbow straightness: ~180 arm straight (punch), ~60 guard position. 3D world landmarks when available. */
export function elbowAngle(lm, world, side) {
  const [s, e, w] = side === 'L' ? [11, 13, 15] : [12, 14, 16];
  const pts = world ?? lm;
  return angle3(pts[s], pts[e], pts[w]);
}

/** Forward/sideways torso lean from vertical, in degrees. */
export const torsoTilt = (b) => (Math.atan2(Math.abs(b.sm.x - b.hm.x), Math.abs(b.hm.y - b.sm.y)) * 180) / Math.PI;
