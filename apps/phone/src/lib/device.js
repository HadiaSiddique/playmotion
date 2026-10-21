// Browser helpers: camera, screen wake lock, skeleton drawing, voice "stop", vibration.
import { SKELETON } from './pose/geometry.js';

export async function openCamera(facingMode) {
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
  // Laptop webcams (the TV app's camera panel, ?embed=1): 720p gives the full sensor width and enough
  // detail to find a person 2-3 m away. Phones: 640x480 keeps the pose model fast.
  const laptop = new URLSearchParams(window.location.search).get('embed') === '1';
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: laptop ? 1280 : 640 },
      height: { ideal: laptop ? 720 : 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  });
  await keepInFocus(stream.getVideoTracks()[0]);
  return stream;
}

/** Continuous autofocus and exposure where the phone supports it (Chrome on Android), so a person 2-3 m away stays sharp. */
async function keepInFocus(track) {
  try {
    const caps = track?.getCapabilities?.() ?? {};
    const advanced = {};
    if (caps.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
    if (caps.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous';
    if (caps.whiteBalanceMode?.includes('continuous')) advanced.whiteBalanceMode = 'continuous';
    if (Object.keys(advanced).length) await track.applyConstraints({ advanced: [advanced] });
  } catch {
    // Not supported (iPhone, most laptops): the camera's own defaults are fine.
  }
}

export function cameraErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow the camera for this site in your browser settings, then reload.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "We couldn't find that camera. Try switching cameras.";
    case 'NotReadableError':
      return 'The camera is busy in another app. Close it and try again.';
    case 'InsecureContext':
      return 'The camera only works on a secure (https://) link. Open the link from the QR code on your TV.';
    case 'NotSupportedError':
      return 'This browser cannot use the camera. Try Chrome or Safari.';
    default:
      return 'The camera could not start. Reload the page to try again.';
  }
}

/** Keeps the screen on during a session. Returns a release function. */
export function keepScreenAwake() {
  let lock = null;
  const request = async () => {
    try {
      lock = await navigator.wakeLock?.request('screen');
    } catch {
      /* not supported or not allowed: fine */
    }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') request();
  };
  request();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    lock?.release?.().catch(() => {});
  };
}

export function drawSkeleton(canvas, lm, color) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.lineWidth = Math.max(3, w / 120);
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  for (const [a, b] of SKELETON) {
    if ((lm[a].visibility ?? 0) < 0.5 || (lm[b].visibility ?? 0) < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    if ((lm[i].visibility ?? 0) < 0.5) continue;
    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, Math.max(4, w / 90), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Listens for "stop" / "pain" words (Chrome on Android). Returns a stop function, or null if unsupported. */
export function listenForStopWords(onWord) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  let active = true;
  const rec = new Recognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    // Check every guess, not just the first: "stop" is short and often the second-best guess.
    for (let i = e.resultIndex; i < e.results.length; i++) {
      for (let j = 0; j < e.results[i].length; j++) {
        const text = e.results[i][j].transcript.toLowerCase();
        if (/\b(pain|ouch|ow|hurts?|hurting)\b/.test(text)) return onWord('pain');
        if (/\b(stop|stopp?ed|pause|enough|halt|ruko|rukho)\b/.test(text)) return onWord('stop');
      }
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') active = false;
  };
  rec.onend = () => {
    if (active) setTimeout(() => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    }, 300);
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return () => {
    active = false;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}

export const buzz = (ms = 150) => navigator.vibrate?.(ms);
