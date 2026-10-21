// MediaPipe Tasks Vision PoseLandmarker, running entirely in the browser (WASM + GPU when available).
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MP_WASM_URL, POSE_MODEL_LITE_URL, POSE_MODEL_URL } from '../config.js';

let landmarkerPromise = null;

const options = (delegate, model = POSE_MODEL_URL) => ({
  baseOptions: { modelAssetPath: model, delegate },
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

async function create() {
  const fileset = await FilesetResolver.forVisionTasks(MP_WASM_URL);
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    // No usable GPU (some laptops, embedded frames): the full model is too slow on the CPU, so use lite.
    console.warn('PlayMotion: GPU pose model failed, falling back to the lite model on the CPU', err);
    return PoseLandmarker.createFromOptions(fileset, options('CPU', POSE_MODEL_LITE_URL));
  }
}

/** Loads the model once and reuses it (switching cameras doesn't reload it). */
export function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = create().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

const r = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Landmarks only, rounded to keep each frame around 1 KB: [x, y, z, visibility] x 33. */
export const compactLandmarks = (lm) => lm.map((p) => [r(p.x, 3), r(p.y, 3), r(p.z ?? 0, 2), r(p.visibility ?? 0, 2)]);
