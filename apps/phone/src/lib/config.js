// Written by scripts/write-env.ps1 into apps/phone/.env.local after the backend deploy.
export const API_URL = import.meta.env.VITE_API_URL ?? '';
export const WS_URL = import.meta.env.VITE_WS_URL ?? '';

// The WASM files must match the npm package version exactly (pinned in package.json).
export const MP_VERSION = '0.10.14';
export const MP_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
// "full" (9 MB) tracks knees and hands at 2-3 m far more reliably than "lite" (5.5 MB), at a small fps cost.
export const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
export const POSE_MODEL_LITE_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE_SEND_INTERVAL_MS = 80; // ~12 fps of landmarks to the TV
export const DETECT_INTERVAL_MS = 33; // run the model at up to ~30 fps
