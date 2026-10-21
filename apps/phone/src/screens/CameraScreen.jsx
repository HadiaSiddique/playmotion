import { useCallback, useEffect, useRef, useState } from 'react';
import { DETECT_INTERVAL_MS, POSE_SEND_INTERVAL_MS } from '../lib/config.js';
import { buzz, cameraErrorMessage, drawSkeleton, keepScreenAwake, listenForStopWords, openCamera } from '../lib/device.js';
import howTo from '@shared/howto.json';
import { CUE_TEXT, NEED_TEXT, PoseEngine, exerciseName, resolveExercise } from '../lib/pose/engine.js';
import { fullBodyInFrame, upperBodyInFrame } from '../lib/pose/geometry.js';
import { compactLandmarks, getLandmarker } from '../lib/pose/landmarker.js';
import { storage } from '../lib/storage.js';
import MealSheet from './MealSheet.jsx';
import PauseSheet from './PauseSheet.jsx';
import PlacementGuide from './PlacementGuide.jsx';

const PRACTICE = [
  { id: 'sit_to_stand', label: 'Sit to stand' },
  { id: 'arm_raise', label: 'Arm raises' },
  { id: 'seated_arm_raise', label: 'Seated arm raises' },
  { id: 'squats', label: 'Squats' },
  { id: 'punches', label: 'Punches' },
  { id: 'jumping_jacks', label: 'Jumping jacks' },
  { id: 'balance_hold', label: 'Balance hold' },
  { id: 'breathing', label: 'Slow breathing' },
  { id: 'frog_jump', label: 'Frog jumps' },
  { id: 'bear_steps', label: 'Bear stomps' },
  { id: 'crab_walk', label: 'Crab steps' },
  { id: 'chair_stand_test', label: '30-second chair-stand test' },
];
const TEST_SECONDS = 30;
const EMBEDDED = new URLSearchParams(window.location.search).get('embed') === '1';
const SKELETON_COLOR = '#ff9f5a';

export default function CameraScreen({ socketRef, link, eventHandlerRef }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cueTimer = useRef(null);
  const lastSafety = useRef(-Infinity);
  const bodyOkSince = useRef(null);

  const [facing, setFacing] = useState(() => (storage.get('facing') === 'environment' ? 'environment' : 'user'));
  const [phase, setPhase] = useState('camera'); // camera | model | ready | error
  const [error, setError] = useState(null);
  const [aspect, setAspect] = useState(3 / 4);
  const [fps, setFps] = useState(0);
  const [bodyView, setBodyView] = useState('none'); // 'full' | 'upper' | 'none', steady for 1 s
  const [need, setNeed] = useState(null); // body parts the current move needs but can't see
  const [guideOpen, setGuideOpen] = useState(true);
  const [exercise, setExercise] = useState(null); // { id, requested, supported, target, seated }
  const [count, setCount] = useState(0);
  const [cue, setCue] = useState(null);
  const [inFrame, setInFrame] = useState(true);
  const [paused, setPaused] = useState(null); // null | 'stop' | 'pain' | 'tv'
  const [testLeft, setTestLeft] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [voiceOn, setVoiceOn] = useState(() => storage.get('voiceStop') !== '0');
  const [mealOpen, setMealOpen] = useState(false);
  const voiceSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const relay = useCallback((type, payload) => socketRef.current?.relay(type, payload), [socketRef]);

  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new PoseEngine((type, payload) => {
      socketRef.current?.relay(type, payload);
      if (type === 'rep') setCount(payload.count);
      else if (type === 'status' && 'inFrame' in payload) {
        setInFrame(payload.inFrame);
        setNeed(payload.inFrame ? null : payload.need ?? null);
      }
      else if (type === 'form') {
        setCue(payload.cue);
        clearTimeout(cueTimer.current);
        cueTimer.current = setTimeout(() => setCue(null), 3500);
      }
    });
  }
  const engine = engineRef.current;

  const startExercise = useCallback(
    (id, { seated = false, target = null } = {}) => {
      const { exercise: resolved, supported } = engine.start(id, { seated });
      setExercise({ id: resolved, requested: id, supported, target, seated });
      setCount(0);
      setCue(null);
      setInFrame(true);
      setPaused(null);
      setTestResult(null);
      setTestLeft(resolved === 'chair_stand_test' ? TEST_SECONDS : null);
      setGuideOpen(false);
    },
    [engine],
  );

  const endExercise = useCallback(() => {
    engine.stop();
    setExercise(null);
    setPaused(null);
    setTestLeft(null);
  }, [engine]);

  const safety = useCallback(
    (kind, source) => {
      const now = performance.now();
      if (now - lastSafety.current < 2000) return;
      lastSafety.current = now;
      engine.pause();
      setPaused(kind);
      buzz(200);
      relay('safety', { kind, source, exercise: engine.exercise });
    },
    [engine, relay],
  );

  // Commands from the TV.
  useEffect(() => {
    eventHandlerRef.current = (msg) => {
      const p = msg.payload ?? {};
      if (msg.event === 'control') {
        if (p.cmd === 'start' && p.exercise) startExercise(p.exercise, { seated: Boolean(p.seated), target: p.target ?? null });
        else if (p.cmd === 'pause') {
          engine.pause();
          setPaused('tv');
        } else if (p.cmd === 'resume') {
          engine.resume();
          setPaused(null);
        } else if (p.cmd === 'end') endExercise();
      } else if (msg.event === 'safety' && (p.kind === 'stop' || p.kind === 'pain')) {
        engine.pause();
        setPaused(p.kind);
      }
    };
    return () => {
      eventHandlerRef.current = null;
    };
  }, [engine, eventHandlerRef, startExercise, endExercise]);

  // Camera + pose loop. Re-runs when switching front/rear camera.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stream = null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const releaseWakeLock = keepScreenAwake();

    (async () => {
      try {
        setError(null);
        setPhase('camera');
        stream = await openCamera(facing);
        if (cancelled) return;
        video.srcObject = stream;
        await video.play();
        const ar = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 3 / 4;
        setAspect(ar);
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 640;
      } catch (err) {
        if (!cancelled) {
          setError(cameraErrorMessage(err));
          setPhase('error');
        }
        return;
      }

      let landmarker;
      try {
        setPhase('model');
        landmarker = await getLandmarker();
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("We couldn't load the movement model. Check your internet connection and reload.");
          setPhase('error');
        }
        return;
      }
      if (cancelled) return;
      setPhase('ready');
      relay('status', { camera: 'ready', facing });

      let lastDetect = 0;
      let lastSend = 0;
      let lastVideoTime = -1;
      let frames = 0;
      let fpsStart = performance.now();
      const loop = () => {
        if (cancelled) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        if (video.readyState < 2 || now - lastDetect < DETECT_INTERVAL_MS || video.currentTime === lastVideoTime) return;
        lastDetect = now;
        lastVideoTime = video.currentTime;

        const result = landmarker.detectForVideo(video, now);
        const lm = result.landmarks?.[0] ?? null;
        const ar = video.videoWidth / video.videoHeight || 0.75;
        drawSkeleton(canvas, lm, SKELETON_COLOR);
        engine.process(lm, now, ar, result.worldLandmarks?.[0] ?? null);

        // Placement check: full body is best; head-to-hands is enough for seated and arm moves.
        const view = fullBodyInFrame(lm) ? 'full' : upperBodyInFrame(lm) ? 'upper' : 'none';
        if (view !== bodyOkSince.current?.view) bodyOkSince.current = { view, since: now };
        const steadyView = now - bodyOkSince.current.since > 1000 ? view : 'none';
        setBodyView((prev) => (prev === steadyView ? prev : steadyView));

        // Landmarks only: never the video frame.
        if (lm && now - lastSend >= POSE_SEND_INTERVAL_MS) {
          lastSend = now;
          socketRef.current?.relay('pose', { lm: compactLandmarks(lm), ar: Math.round(ar * 1000) / 1000, mirrored: facing === 'user' });
        }

        frames += 1;
        if (now - fpsStart >= 1000) {
          setFps(frames);
          frames = 0;
          fpsStart = now;
        }
      };
      loop();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      releaseWakeLock();
    };
  }, [facing, engine, relay, socketRef]);

  // Say "stop" (or "it hurts") to pause, where the browser supports speech recognition.
  // In the TV app's laptop panel (?embed=1) the TV page listens instead: two listeners in one browser fight over the mic.
  useEffect(() => {
    if (!voiceOn || EMBEDDED || phase !== 'ready') return undefined;
    const stopListening = listenForStopWords((word) => safety(word, 'voice'));
    return () => stopListening?.();
  }, [voiceOn, phase, safety]);

  // The placement guide closes itself once the whole body (or, for seated users, head to hands) is in view.
  useEffect(() => {
    if (!guideOpen || bodyView === 'none') return undefined;
    const timer = setTimeout(() => setGuideOpen(false), 1500);
    return () => clearTimeout(timer);
  }, [guideOpen, bodyView]);

  // 30-second chair-stand test countdown (pauses with the STOP button).
  useEffect(() => {
    if (testLeft === null || paused) return undefined;
    if (testLeft === 0) {
      const stands = engine.count;
      engine.pause();
      setTestLeft(null);
      setTestResult(stands);
      relay('game', { kind: 'chair_stand_result', exercise: 'sit_to_stand', stands, seconds: TEST_SECONDS });
      return undefined;
    }
    const timer = setTimeout(() => setTestLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [testLeft, paused, engine, relay]);

  const mirrored = facing === 'user';
  const seatedId = exercise ? resolveExercise(exercise.requested, true) : null;
  const canGoSeated = Boolean(exercise) && seatedId !== exercise.id;

  return (
    <main className="camera-screen">
      <header className="topbar">
        <span className={`pill ${link.tvConnected && link.joined ? 'ok' : 'warn'}`}>
          {link.joined ? (link.tvConnected ? 'Connected ✓' : 'TV disconnected') : link.everJoined ? 'Reconnecting…' : 'Practice mode'}
        </span>
        {link.code ? <span className="muted">Code {link.code}</span> : null}
        <span className="muted">{phase === 'ready' ? `${fps} fps` : ''}</span>
      </header>

      {/* Keep the camera's exact aspect ratio so the skeleton lines up, capped at 46% of the screen height. */}
      <div className="stage" style={{ aspectRatio: String(aspect), width: `min(100%, calc(46dvh * ${aspect.toFixed(4)}))` }}>
        <video ref={videoRef} playsInline muted autoPlay className={mirrored ? 'mirror' : ''} />
        <canvas ref={canvasRef} className={mirrored ? 'mirror' : ''} />
        {phase !== 'ready' ? (
          <div className="stage-msg">{error ?? (phase === 'model' ? 'Loading the movement model…' : 'Starting the camera…')}</div>
        ) : (
          <div className={`frame-badge ${bodyView !== 'none' ? 'ok' : ''}`}>
            {bodyView === 'full' ? 'Full body in view ✓' : bodyView === 'upper' ? 'Upper body in view ✓ (fine for seated moves)' : 'Move so we can see you'}
          </div>
        )}
        {phase === 'ready' && exercise && !inFrame ? <div className="frame-hint">{NEED_TEXT[need] ?? 'Move so the camera can see you.'}</div> : null}
      </div>

      <section className="hud" aria-live="polite">
        {exercise ? (
          <>
            <div className="exercise-name">{exerciseName(exercise.id)}</div>
            {exercise.supported ? (
              <div className="count">
                {count}
                {exercise.target ? <span className="target"> / {exercise.target}</span> : null}
              </div>
            ) : (
              <p className="muted">Counting for this move is coming soon. Follow along on your TV.</p>
            )}
            {testLeft !== null ? <div className="timer">{testLeft}s left</div> : null}
            {testResult !== null ? <div className="result">{testResult} stands in 30 seconds</div> : null}
            <div className="cue">{cue ? CUE_TEXT[cue] : ' '}</div>
            {howTo[exercise.id] ? (
              <ol className="howto">
                {howTo[exercise.id].steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
          </>
        ) : (
          <p className="idle">{link.joined ? 'Start a game on your TV, or practise a move below.' : 'Practise a move below.'}</p>
        )}
      </section>

      <div className="safety-row">
        <button className="btn-stop" onClick={() => safety('stop', 'tap')} aria-label="Stop now">
          STOP
        </button>
        <button className="btn-pain" onClick={() => safety('pain', 'tap')}>
          It hurts
        </button>
      </div>

      <div className="chips" role="group" aria-label="Practise a move">
        {PRACTICE.map((item) => (
          <button key={item.id} className={`chip ${exercise?.requested === item.id ? 'active' : ''}`} onClick={() => startExercise(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="tools">
        <button
          className="btn-secondary"
          onClick={() =>
            setFacing((f) => {
              const next = f === 'user' ? 'environment' : 'user';
              storage.set('facing', next);
              return next;
            })
          }
        >
          {facing === 'user' ? 'Use rear camera' : 'Use front camera'}
        </button>
        <button className="btn-secondary" onClick={() => setGuideOpen(true)}>
          Setup guide
        </button>
        <button className="btn-secondary" onClick={() => setMealOpen(true)}>
          🍽️ Meal tip
        </button>
        {voiceSupported ? (
          <button
            className="btn-secondary"
            aria-pressed={voiceOn}
            onClick={() =>
              setVoiceOn((on) => {
                storage.set('voiceStop', on ? '0' : '1');
                return !on;
              })
            }
          >
            Say "stop": {voiceOn ? 'on' : 'off'}
          </button>
        ) : null}
      </div>

      <p className="fineprint">Video stays on this phone. Only body points and rep counts go to your TV. Wellness coaching, not a medical device.</p>

      {mealOpen ? (
        <MealSheet
          userId={link.userId}
          onClose={() => setMealOpen(false)}
          // Only the tip text goes to the TV, never the photo.
          onResult={(r) => relay('meal', { looksLike: r.looksLike, positives: r.positives, tips: r.tips, swap: r.swap, waterNudge: r.waterNudge })}
        />
      ) : null}
      {guideOpen && phase === 'ready' && !paused && !mealOpen ? <PlacementGuide bodyView={bodyView} onClose={() => setGuideOpen(false)} /> : null}
      {paused ? (
        <PauseSheet
          kind={paused}
          canGoSeated={canGoSeated}
          onResume={() => {
            engine.resume();
            setPaused(null);
            relay('safety', { kind: 'ok', source: 'tap', exercise: engine.exercise });
          }}
          onSeated={() => {
            startExercise(exercise.requested, { seated: true, target: exercise.target });
            relay('safety', { kind: 'seated_switch', source: 'tap', exercise: seatedId });
          }}
          onEnd={() => {
            endExercise();
            relay('safety', { kind: 'end', source: 'tap' });
          }}
        />
      ) : null}
    </main>
  );
}
