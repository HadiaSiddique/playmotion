// A game session (Boss Battle, Calm River or Balance Bridge):
// connect phone → for each move: how-to + countdown → the phone counts reps / seconds held / stands →
// the game reacts → mood/energy after → POST /session/complete → results (XP, badges, garden, mood lift,
// chair-stand trend).
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { RootStackParamList } from '../navigation/types';
import howToJson from '../../../shared/howto.json';
import { api } from './api';
import { playVoice, stopVoice } from './audio';
import BalanceBridge, { ChairStandPanel } from './BalanceBridge';
import BossBattle from './BossBattle';
import CalmRiver from './CalmRiver';
import DemoCoach, { hasDemo } from './DemoCoach';
import { AVATARS, BADGE_NAMES, CHAIR_TEST_SECONDS, exerciseName, GAMES, GARDEN_STAGES, moveKind, STICKER_EMOJI, STORY_GAMES } from './catalog';
import FloorIsLava from './FloorIsLava';
import FreezeDance from './FreezeDance';
import GardenGrow from './GardenGrow';
import PopBubbles from './PopBubbles';
import JungleQuest from './JungleQuest';
import { CameraSlot, LaptopCameraButton, useCompactLaptopCamera, useLaptopCamera } from './LaptopCamera';
import MwButton from './MwButton';
import { usePairing, usePhoneEvents } from './PairingContext';
import { useVoiceCommands } from './voiceCommands';
import QrCode from './QrCode';
import Skeleton, { CompactLandmark } from './Skeleton';
import { mw } from './theme';
import { PlanExercise, ReportResponse, SessionResult, VoicePack } from './types';
import { ErrorBox, Loading, Option, OptionGrid, Screen, text, useColumnWidth } from './ui';
import { useUser } from './UserContext';

const s = scaledPixels;
const HOW_TO = howToJson as Record<string, { steps: string[]; tip: string; camera: string }>;
const INTRO_SECONDS = 6;
const COMBO_WINDOW_MS = 4000;
const FRAME_VOICE_GAP_MS = 20_000; // "step back" voice at most every 20 s
const TIP_VOICE_GAP_MS = 10_000; // the same form tip at most every 10 s

const FACES: Option<number>[] = [
  { value: 1, label: 'Very low', icon: '😞' },
  { value: 2, label: 'Low', icon: '🙁' },
  { value: 3, label: 'Okay', icon: '😐' },
  { value: 4, label: 'Good', icon: '🙂' },
  { value: 5, label: 'Great', icon: '😄' },
];

const CUE_TEXT: Record<string, string> = {
  slow_down: 'Nice and slow. Control the move.',
  stand_tall: 'Stand tall and look ahead.',
  arms_higher: 'Reach a little higher if it feels okay.',
  step_in_frame: 'Step back or tilt the phone down so we can see your hips and knees.',
  show_arms: 'Make sure your shoulders and both hands are in the picture.',
  hold_steady: 'Hold steady. Breathe. Use the chair if you need it.',
};
// Phone cue id → pre-recorded Polly line in the voice pack.
const CUE_VOICE: Record<string, string> = {
  step_in_frame: 'step_in_frame', show_arms: 'step_in_frame', stand_tall: 'stand_tall', arms_higher: 'arms_higher', slow_down: 'slow_down', hold_steady: 'hold_steady',
};

const HEADLINES: Record<string, { win: string; done: string }> = {
  boss_battle: { win: 'Victory! The Couch Monster is down 🎉', done: 'Session complete' },
  superhero_training: { win: 'Hero training complete! 🦸', done: 'Training complete' },
  calm_river: { win: 'You reached the calm lake 🌅', done: 'A calm few minutes' },
  balance_bridge: { win: 'You crossed the bridge! 🌉', done: 'Balance session complete' },
  jungle_quest: { win: 'Treasure found! 💎', done: 'What an adventure!' },
  pop_bubbles: { win: 'Every bubble popped! 🫧', done: 'Nice reaching' },
  garden_grow: { win: 'Your garden is in bloom! 🌻', done: 'Your garden got watered' },
  freeze_dance: { win: 'Best statues ever! 🕺', done: 'What a dance!' },
  floor_is_lava: { win: 'Safe across the lava! 🌋', done: 'What an adventure!' },
};
const STORY_INTRO_SECONDS = 10; // time for the narrator to read the chapter

type Phase = 'connect' | 'intro' | 'play' | 'moveDone' | 'after' | 'saving' | 'results' | 'error';
type Pause = null | 'stop' | 'pain' | 'menu';

interface State {
  phase: Phase;
  moves: PlanExercise[];
  moveIndex: number;
  reps: number[]; // reps, seconds held, or stands, per move
  forms: number[][];
  hp: number;
  maxHp: number;
  combo: number;
  lastRepAt: number;
  hitKey: number;
  lastDamage: number;
  power: number;
  supported: boolean | null;
  paused: Pause;
  endedEarly: null | 'user' | 'pain';
}

type Action =
  | { type: 'ready' }
  | { type: 'go' }
  | { type: 'rep'; count: number; formScore: number; now: number }
  | { type: 'timeUp' }
  | { type: 'next' }
  | { type: 'supported'; supported: boolean }
  | { type: 'pause'; kind: Exclude<Pause, null> }
  | { type: 'resume' }
  | { type: 'seated'; exercise: string }
  | { type: 'skip' }
  | { type: 'end'; reason: 'user' | 'pain' }
  | { type: 'phase'; phase: Phase };

function init(moves: PlanExercise[]): State {
  const maxHp = moves.reduce((sum, m) => sum + (moveKind(m.id) === 'reps' ? m.target : 0), 0) * 10;
  return {
    phase: 'connect', moves, moveIndex: 0, reps: moves.map(() => 0), forms: moves.map(() => []), hp: maxHp, maxHp,
    combo: 0, lastRepAt: 0, hitKey: 0, lastDamage: 0, power: 0, supported: null, paused: null, endedEarly: null,
  };
}

function reducer(st: State, a: Action): State {
  switch (a.type) {
    case 'ready':
      return st.phase === 'connect' ? { ...st, phase: 'intro' } : st;
    case 'go':
      return { ...st, phase: 'play', supported: null };
    case 'rep': {
      if (st.phase !== 'play' || st.paused) return st;
      const i = st.moveIndex;
      const delta = a.count - st.reps[i];
      if (delta <= 0) return st;
      const kind = moveKind(st.moves[i].id);
      const reps = [...st.reps];
      reps[i] = a.count;
      const forms = st.forms.map((f, j) => (j === i ? [...f, a.formScore] : f));
      // Timed moves (chair-stand test) end with the clock, not at a count.
      const moveDone = kind !== 'timed' && a.count >= st.moves[i].target;
      if (kind !== 'reps') return { ...st, reps, forms, hitKey: st.hitKey + 1, phase: moveDone ? 'moveDone' : 'play' };
      const combo = a.now - st.lastRepAt < COMBO_WINDOW_MS ? st.combo + delta : delta;
      const multiplier = 1 + 0.15 * (Math.min(combo, 5) - 1);
      let damage = Math.round(delta * 10 * (0.7 + a.formScore / 333) * multiplier);
      let hp = Math.max(0, st.hp - damage);
      let lastRepMove = -1;
      st.moves.forEach((m, j) => {
        if (moveKind(m.id) === 'reps') lastRepMove = j;
      });
      if (moveDone && i === lastRepMove) {
        damage += hp; // finishing blow on the last rep
        hp = 0;
      }
      return { ...st, reps, forms, combo, lastRepAt: a.now, hp, hitKey: st.hitKey + 1, lastDamage: damage, power: st.power + damage, phase: moveDone ? 'moveDone' : 'play' };
    }
    case 'timeUp':
      return st.phase === 'play' ? { ...st, phase: 'moveDone' } : st;
    case 'next':
      return st.moveIndex + 1 < st.moves.length ? { ...st, moveIndex: st.moveIndex + 1, phase: 'intro', combo: 0 } : { ...st, phase: 'after' };
    case 'supported':
      return { ...st, supported: a.supported };
    case 'pause':
      return { ...st, paused: a.kind };
    case 'resume':
      return { ...st, paused: null };
    case 'seated': {
      // The phone restarts its count for the seated version, so this move's count restarts too.
      const moves = st.moves.map((m, j) => (j === st.moveIndex ? { ...m, id: a.exercise } : m));
      const reps = st.reps.map((r, j) => (j === st.moveIndex ? 0 : r));
      return { ...st, moves, reps, paused: null };
    }
    case 'skip':
      return reducer({ ...st, paused: null }, { type: 'next' });
    case 'end':
      return { ...st, paused: null, phase: 'after', endedEarly: a.reason };
    case 'phase':
      return { ...st, phase: a.phase };
    default:
      return st;
  }
}

// Spoken intro for each move, in the coach language. Non-English lines leave out the move's name
// (it is on screen and the demo coach shows it). Translations: [verify] with native speakers.
const INTRO: Record<string, { timed: string; hold: (first: boolean, n: number) => string; breathe: (n: number) => string; reps: (first: boolean, n: number) => string }> = {
  'hi-IN': {
    timed: 'तीस सेकंड का कुर्सी टेस्ट। हाथ बांध लीजिए। जितनी बार आराम से हो सके, उठिए और बैठिए।',
    hold: (first, n) => `${first ? 'चलिए शुरू करते हैं।' : 'अगला।'} ${n} सेकंड तक संतुलन बनाए रखिए। ज़रूरत हो तो कुर्सी पकड़िए।`,
    breathe: (n) => `चलिए साथ में सांस लेते हैं। ${n} धीमी सांसें। सांस लेते हुए हाथ ऊपर, छोड़ते हुए नीचे।`,
    reps: (first, n) => `${first ? 'चलो शुरू करें!' : 'अगली एक्सरसाइज़!'} ${n} बार।`,
  },
  'es-US': {
    timed: 'Prueba de la silla de treinta segundos. Brazos cruzados. Levántate y siéntate tantas veces como puedas con seguridad.',
    hold: (first, n) => `${first ? 'Empecemos.' : 'Siguiente.'} Mantén el equilibrio ${n} segundos. Agárrate de la silla si lo necesitas.`,
    breathe: (n) => `Respiremos juntos. ${n} respiraciones lentas. Brazos arriba al inhalar, abajo al exhalar.`,
    reps: (first, n) => `${first ? '¡Vamos!' : '¡Siguiente ejercicio!'} ${n} repeticiones.`,
  },
  'ar-AE': {
    timed: 'اختبار الكرسي لمدة ثلاثين ثانية. ضع ذراعيك متقاطعتين. قف واجلس بأمان أكبر عدد ممكن من المرات.',
    hold: (first, n) => `${first ? 'لنبدأ.' : 'التالي.'} حافظ على توازنك لمدة ${n} ثانية. أمسك الكرسي إذا احتجت.`,
    breathe: (n) => `لنتنفس معًا. ${n} أنفاس بطيئة. ارفع ذراعيك مع الشهيق، وأنزلهما مع الزفير.`,
    reps: (first, n) => `${first ? 'هيا بنا!' : 'التمرين التالي!'} ${n} مرات.`,
  },
};

function introLine(id: string, target: number, first: boolean, game: string, language = 'en-US') {
  const kind = moveKind(id);
  const breathing = game === 'calm_river' && id === 'breathing';
  const t = INTRO[language];
  if (t) {
    if (kind === 'timed') return t.timed;
    if (kind === 'hold') return t.hold(first, target);
    return breathing ? t.breathe(target) : t.reps(first, target);
  }
  if (kind === 'timed') return 'Thirty-second chair-stand test. Arms crossed. Stand up and sit down as many times as you safely can.';
  if (kind === 'hold') return `${first ? "Let's begin." : 'Next.'} ${exerciseName(id)} for ${target} seconds. Hold the chair if you need it.`;
  if (breathing) return `Let's breathe together. ${target} slow breaths. Arms up as you breathe in, down as you breathe out.`;
  return `${first ? "Let's go!" : 'Next move!'} ${target} ${exerciseName(id).toLowerCase()}.`;
}

/**
 * In a browser, refreshing (or opening) /play/<game> has no move list: moves come from the check-in's
 * safety rules and never go into the address. Go home instead of guessing.
 */
export default function SessionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Session'>>();
  const ready = Array.isArray(route.params?.moves) && route.params.moves.length > 0;
  useEffect(() => {
    if (ready) return undefined;
    // Browser: a plain redirect to "/" is the most reliable while the navigator is still applying the address.
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.replace('/');
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    return undefined;
  }, [ready, navigation]);
  return ready ? <SessionGame /> : <Loading text="Taking you home…" />;
}

function SessionGame() {
  const isFocused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Session'>>();
  const { game, moves, moodBefore, energyBefore } = route.params;
  const { client, state: pairing } = usePairing();
  const { userId, data } = useUser();
  const isKid = data?.profile.kind === 'kid';
  const isBoss = game === 'boss_battle' || game === 'superhero_training';
  const isStory = STORY_GAMES.has(game);
  const introSeconds = isStory ? STORY_INTRO_SECONDS : INTRO_SECONDS;
  const voiceStyle = isKid ? 'kids' : game === 'calm_river' ? 'calm' : 'coach';
  const language = isKid ? 'en-US' : data?.profile.language ?? 'en-US'; // Kids mode is English only

  const [st, dispatch] = useReducer(reducer, moves, init);
  useCompactLaptopCamera();
  const laptopCamera = useLaptopCamera();
  const [countdown, setCountdown] = useState(introSeconds);
  const [narration, setNarration] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(CHAIR_TEST_SECONDS);
  const [pose, setPose] = useState<{ lm: CompactLandmark[]; ar: number; mirrored: boolean } | null>(null);
  const [signal, setSignal] = useState(0);
  const [balance, setBalance] = useState({ holding: false, wobble: 0 });
  const [cue, setCue] = useState<string | null>(null);
  const [need, setNeed] = useState<string | null>(null);
  const [after, setAfter] = useState<{ mood?: number; energy?: number }>({});
  const [result, setResult] = useState<SessionResult | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pack = useRef<VoicePack | null>(null);
  const startedAt = useRef<number | null>(null);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathCues = useRef(0);
  const lastTipVoice = useRef<Record<string, number>>({});
  const allowLeave = useRef(false);
  const faceWidth = useColumnWidth(5);
  // Game scene: about 58% of the usable screen width, whatever the TV or browser size.
  const visualWidth = Math.floor(useColumnWidth(1) * 0.58);

  const move = st.moves[st.moveIndex];
  const kind = move ? moveKind(move.id) : 'reps';
  const count = st.reps[st.moveIndex] ?? 0;
  const playing = st.phase === 'intro' || st.phase === 'play' || st.phase === 'moveDone';
  const cueVoice = (id: string) => playVoice(pack.current?.cues[id]?.url);
  const chairIndex = st.moves.findIndex((m) => m.id === 'chair_stand_test');
  const chairStands = chairIndex >= 0 && (st.moveIndex > chairIndex || st.phase === 'after' || st.phase === 'results') ? st.reps[chairIndex] : null;
  const bestHold = Math.max(0, ...st.moves.map((m, i) => (moveKind(m.id) === 'hold' ? st.reps[i] : 0)));
  const sessionProgress = st.moves.reduce((sum, m, i) => sum + Math.min(st.reps[i], m.target), 0) / Math.max(1, st.moves.reduce((sum, m) => sum + m.target, 0));

  // Pre-recorded Polly cues (cached in S3 after the first time).
  useEffect(() => {
    api.voicePack(voiceStyle, language).then((p) => (pack.current = p)).catch(() => {});
  }, [voiceStyle, language]);

  // Story games: fetch all five chapters (text + narrator audio) up front, so each chapter starts instantly.
  const chapters = useRef<Record<number, Promise<{ text: string; audioUrl: string | null }>>>({});
  const loadChapter = useCallback(
    (chapter: number) => {
      if (!userId) return Promise.reject(new Error('no user'));
      chapters.current[chapter] ??= api.story({ userId, game, chapter });
      return chapters.current[chapter];
    },
    [userId, game],
  );
  useEffect(() => {
    if (!isStory) return;
    [0, 1, 2, 3, 4].forEach((c) => loadChapter(c).catch(() => delete chapters.current[c]));
  }, [isStory, loadChapter]);

  // 1. Wait for the phone.
  useEffect(() => {
    if (st.phase === 'connect' && pairing.status === 'connected') dispatch({ type: 'ready' });
  }, [st.phase, pairing.status]);

  // 2. Intro for each move: how-to, voice, countdown, then tell the phone to start counting.
  useEffect(() => {
    if (st.phase !== 'intro' || st.paused) return undefined;
    setCountdown(introSeconds);
    setNeed(null);
    setBalance({ holding: false, wobble: 0 });
    if (userId && isStory) {
      // The narrator (Polly, child voice) reads this chapter of the story.
      setNarration(null);
      loadChapter(st.moveIndex)
        .then((r) => {
          setNarration(r.text);
          playVoice(r.audioUrl);
        })
        .catch(() => setNarration(null));
    } else if (userId) {
      api
        .tts({ userId, text: introLine(move.id, move.target, st.moveIndex === 0, game, language), style: voiceStyle, language })
        .then((r) => playVoice(r.url))
        .catch(() => {});
    }
    let left = introSeconds;
    const timer = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(timer);
        startedAt.current ??= Date.now();
        setTimeLeft(CHAIR_TEST_SECONDS);
        client.startExercise(move.id, { target: move.target });
        dispatch({ type: 'go' });
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, st.moveIndex, st.paused]);

  // Chair-stand test clock: 30 seconds, then the move ends whatever the count.
  useEffect(() => {
    if (st.phase !== 'play' || kind !== 'timed' || st.paused) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          client.control('end');
          dispatch({ type: 'timeUp' });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, kind, st.paused]);

  // 3. Move finished: short celebration, then the next move (or the end).
  useEffect(() => {
    if (st.phase !== 'moveDone') return undefined;
    const last = st.moveIndex === st.moves.length - 1;
    client.control('end');
    if (isKid && !last) cueVoice('star_earned');
    if (last && !isKid) cueVoice(game === 'calm_river' ? 'well_done' : 'session_done');
    const timer = setTimeout(() => dispatch({ type: 'next' }), last ? 3000 : 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase]);

  // Voice encouragement on Boss Battle hits.
  useEffect(() => {
    if (!st.hitKey || st.phase !== 'play' || !isBoss || kind !== 'reps') return;
    if (move.target - count === 3) cueVoice('last_three');
    else if (count === Math.ceil(move.target / 2)) cueVoice('halfway');
    else if (st.combo === 3) cueVoice('combo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.hitKey]);

  // Pausing on the TV pauses counting on the phone.
  useEffect(() => {
    if (st.phase !== 'play') return;
    client.control(st.paused ? 'pause' : 'resume');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.paused]);

  // The remote's Back button opens the pause menu instead of leaving mid-session.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (allowLeave.current || !playing) return;
        e.preventDefault();
        dispatch({ type: 'pause', kind: 'menu' });
      }),
    [navigation, playing],
  );

  // Stop the phone counting if we leave for any reason.
  useEffect(
    () => () => {
      client.control('end');
      stopVoice();
    },
    [client],
  );

  usePhoneEvents((e) => {
    const p = e.payload ?? {};
    switch (e.event) {
      case 'pose':
        setPose({ lm: p.lm, ar: p.ar || 0.75, mirrored: Boolean(p.mirrored) });
        break;
      case 'rep':
        dispatch({ type: 'rep', count: p.count, formScore: p.formScore ?? 80, now: Date.now() });
        break;
      case 'game':
        if (p.kind === 'balance') setBalance({ holding: Boolean(p.holding), wobble: Number(p.wobble) || 0 });
        else if (typeof p.signal === 'number') setSignal(p.signal);
        break;
      case 'form': {
        setCue(CUE_TEXT[p.cue] ?? null);
        // Speak a tip only now and then: the text stays on screen, the voice must not nag.
        const voiceId = CUE_VOICE[p.cue];
        const now = Date.now();
        const gap = voiceId === 'step_in_frame' ? FRAME_VOICE_GAP_MS : TIP_VOICE_GAP_MS;
        if (voiceId && game !== 'calm_river' && now - (lastTipVoice.current[voiceId] ?? 0) > gap) {
          lastTipVoice.current[voiceId] = now;
          cueVoice(voiceId);
        }
        if (cueTimer.current) clearTimeout(cueTimer.current);
        cueTimer.current = setTimeout(() => setCue(null), 3500);
        break;
      }
      case 'status':
        if (typeof p.exercise === 'string' && typeof p.supported === 'boolean') dispatch({ type: 'supported', supported: p.supported });
        if (typeof p.exercise === 'string' && p.exercise !== move?.id && st.phase === 'play') dispatch({ type: 'seated', exercise: p.exercise });
        if ('inFrame' in p) setNeed(p.inFrame ? null : p.need ?? 'upper');
        break;
      case 'safety':
        if (p.kind === 'stop' || p.kind === 'pain') {
          stopVoice();
          cueVoice(p.kind === 'pain' ? 'pain_ok' : 'stop_ok');
          dispatch({ type: 'pause', kind: p.kind });
        } else if (p.kind === 'ok') dispatch({ type: 'resume' });
        else if (p.kind === 'end') dispatch({ type: 'end', reason: 'user' });
        break;
      default:
        break;
    }
  });

  // Say "stop" / "it hurts" to the TV (web: laptop mode). Same as STOP on the phone: pause here and on the phone.
  const voice = useVoiceCommands(playing && !st.paused, language, (cmd) => {
    stopVoice();
    cueVoice(cmd === 'pain' ? 'pain_ok' : 'stop_ok');
    client.relay('safety', { kind: cmd, source: 'voice', exercise: move?.id }, 'phone');
    dispatch({ type: 'pause', kind: cmd });
  });

  // Calm River: a soft "breathe in / out" voice for the first few breaths, then just the ring.
  const onBreath = useCallback(
    (phase: 'in' | 'out') => {
      if (st.phase !== 'play' || st.paused || breathCues.current >= 4) return;
      breathCues.current += 1;
      cueVoice(phase === 'in' ? 'breathe_in' : 'breathe_out');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st.phase, st.paused],
  );

  const save = useCallback(
    async (mood?: number, energy?: number) => {
      dispatch({ type: 'phase', phase: 'saving' });
      try {
        const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);
        const res = await api.completeSession({
          userId,
          game,
          durationSec: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 60,
          exercises: st.moves.map((m, i) => ({
            id: m.id,
            reps: moveKind(m.id) === 'hold' ? 0 : st.reps[i],
            seconds: moveKind(m.id) === 'hold' ? st.reps[i] : 0,
            formScore: avg(st.forms[i]),
          })),
          reps: st.moves.reduce((sum, m, i) => sum + (moveKind(m.id) === 'hold' ? 0 : st.reps[i]), 0),
          moodBefore,
          moodAfter: mood,
          energyBefore,
          energyAfter: energy,
          balanceSeconds: bestHold || undefined,
          fallTest: chairStands !== null ? { type: 'chair_stand_30s', stands: chairStands } : undefined,
          stoppedEarly: Boolean(st.endedEarly),
          stopReason: st.endedEarly ?? undefined,
        });
        setResult(res);
        dispatch({ type: 'phase', phase: 'results' });
        if (isStory && userId) {
          // The narrator reads the happy ending instead of the usual celebration line.
          loadChapter(4)
            .then((r) => {
              setEnding(r.text);
              playVoice(r.audioUrl);
            })
            .catch(() => playVoice(res.celebration.audioUrl));
        } else playVoice(res.celebration.audioUrl);
        if (chairStands !== null && userId) api.report(userId).then(setReport).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        dispatch({ type: 'phase', phase: 'error' });
      }
    },
    [userId, game, isStory, loadChapter, st.moves, st.reps, st.forms, st.endedEarly, moodBefore, energyBefore, bestHold, chairStands],
  );

  const leave = (to: 'Home' | 'again') => {
    allowLeave.current = true;
    if (to === 'Home') navigation.navigate('Home');
    else navigation.replace('Session', { game, moves, moodBefore, energyBefore });
  };

  if (st.phase === 'saving') return <Loading text="Saving your session…" />;

  const gameInfo = GAMES[game] ?? GAMES.boss_battle;
  const howTo = move ? HOW_TO[move.id] : null;
  const won = isBoss ? st.hp <= 0 : !st.endedEarly;
  const headline = HEADLINES[game] ?? HEADLINES.boss_battle;

  let visual: React.ReactNode = null;
  const moveProgress = st.phase === 'intro' ? 0 : Math.min(1, count / Math.max(1, move?.target ?? 1));
  const storyChapter = st.phase === 'after' || st.phase === 'results' ? 4 : st.moveIndex;
  const kidAvatar = AVATARS[data?.profile.kid?.avatar ?? 'fox'] ?? '🦊';
  if (game === 'freeze_dance')
    visual = (
      <FreezeDance
        freeze={move?.id === 'freeze'}
        holding={balance.holding && st.phase === 'play'}
        chapter={storyChapter}
        progress={moveProgress}
        avatar={kidAvatar}
        pixelWidth={visualWidth}
      />
    );
  else if (game === 'floor_is_lava') visual = <FloorIsLava chapter={storyChapter} progress={moveProgress} avatar={kidAvatar} pixelWidth={visualWidth} />;
  else if (isStory) visual = <JungleQuest chapter={storyChapter} progress={moveProgress} avatar={kidAvatar} pixelWidth={visualWidth} />;
  else if (game === 'pop_bubbles') visual = <PopBubbles count={count} target={move?.target ?? 8} signal={st.phase === 'play' ? signal : 0} pixelWidth={visualWidth} />;
  else if (game === 'garden_grow')
    visual = <GardenGrow moveIndex={st.moveIndex} moveCount={st.moves.length} progress={moveProgress} count={count} pixelWidth={visualWidth} />;
  else if (game === 'calm_river') visual = <CalmRiver progress={sessionProgress} signal={signal} pixelWidth={visualWidth} onBreath={onBreath} />;
  else if (game === 'balance_bridge')
    visual =
      kind === 'timed' ? (
        <ChairStandPanel secondsLeft={timeLeft} stands={count} started={st.phase !== 'intro'} />
      ) : (
        <BalanceBridge progress={count / Math.max(1, move?.target ?? 1)} holding={balance.holding && st.phase === 'play'} wobble={balance.wobble} pixelWidth={visualWidth} />
      );
  else visual = <BossBattle hp={st.hp} maxHp={st.maxHp} hitKey={st.hitKey} lastDamage={st.lastDamage} combo={st.combo} defeated={st.hp <= 0} />;

  return (
    <SpatialNavigationRoot key={`${st.phase}-${st.paused}-${after.mood ?? 0}-${st.supported}`} isActive={isFocused}>
      <Screen>
        {st.phase === 'connect' ? (
          <View style={styles.center}>
            <Text style={text.brand}>{gameInfo.name}</Text>
            <Text style={[text.h1, styles.mt]}>Connect your phone to start</Text>
            <View style={styles.connectRow}>
              {pairing.joinUrl ? <QrCode value={pairing.joinUrl} size={s(320)} /> : null}
              <View style={styles.connectText}>
                <Text style={text.muted}>Scan the QR code, or type this code on the phone:</Text>
                <Text style={styles.code}>{pairing.code ? `${pairing.code.slice(0, 3)} ${pairing.code.slice(3)}` : '--- ---'}</Text>
                <Text style={text.muted}>Waiting for your phone…</Text>
              </View>
            </View>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <DefaultFocus>
                <MwButton label="← Back" onSelect={() => leave('Home')} />
              </DefaultFocus>
              <LaptopCameraButton />
            </SpatialNavigationView>
          </View>
        ) : null}

        {playing && move ? (
          <View style={styles.battle}>
            <View style={styles.topBar}>
              <Text style={text.brand}>
                {gameInfo.icon} {gameInfo.name}
              </Text>
              <Text style={text.muted}>
                Move {st.moveIndex + 1} of {st.moves.length}
                {isBoss ? ` · ⚡ Power ${st.power}` : ''}
              </Text>
            </View>
            <View style={styles.arena}>
              <View style={styles.leftCol}>
                <Text style={styles.moveName}>{exerciseName(move.id)}</Text>
                {st.phase === 'intro' && isStory ? (
                  <>
                    <Text style={styles.chapter}>📖 Chapter {st.moveIndex + 1}</Text>
                    <Text style={styles.narration}>{narration ?? 'The storyteller is opening the book…'}</Text>
                    {howTo?.steps.map((step, i) => (
                      <Text key={step} style={[text.muted, styles.stepSmall]}>
                        {i + 1}. {step}
                      </Text>
                    ))}
                    <Text style={styles.countdown}>{countdown > 3 ? 'Get ready, hero…' : countdown > 0 ? countdown : 'Go!'}</Text>
                  </>
                ) : st.phase === 'intro' ? (
                  <>
                    {howTo?.steps.map((step, i) => (
                      <Text key={step} style={[text.body, styles.step]}>
                        {i + 1}. {step}
                      </Text>
                    ))}
                    {howTo?.tip ? <Text style={[text.muted, styles.step]}>💡 {howTo.tip}</Text> : null}
                    <Text style={styles.countdown}>{countdown > 3 ? 'Get into position…' : countdown > 0 ? countdown : 'Go!'}</Text>
                  </>
                ) : (
                  <>
                    {kind === 'timed' ? (
                      <Text style={styles.count}>
                        {count}
                        <Text style={styles.target}> stands · {timeLeft}s</Text>
                      </Text>
                    ) : (
                      <Text style={styles.count}>
                        {count}
                        <Text style={styles.target}>
                          {' '}
                          / {move.target}
                          {kind === 'hold' ? ' s' : ''}
                        </Text>
                      </Text>
                    )}
                    {st.phase === 'moveDone' ? <Text style={styles.moveDone}>{kind === 'timed' ? `Done: ${count} stands!` : 'Move complete! 💥'}</Text> : null}
                    {isBoss && st.combo >= 2 && st.phase === 'play' ? <Text style={styles.comboText}>Combo ×{Math.min(st.combo, 5)}</Text> : null}
                    {st.supported === false ? (
                      <View style={styles.manual}>
                        <Text style={text.muted}>The phone can't count this move yet. Press OK on the remote for each rep.</Text>
                        <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                          <DefaultFocus>
                            <MwButton label="+1" onSelect={() => dispatch({ type: 'rep', count: count + 1, formScore: 80, now: Date.now() })} />
                          </DefaultFocus>
                        </SpatialNavigationView>
                      </View>
                    ) : null}
                  </>
                )}
                {need ? <Text style={styles.need}>{need === 'legs' ? CUE_TEXT.step_in_frame : CUE_TEXT.show_arms}</Text> : cue ? <Text style={styles.cue}>{cue}</Text> : null}
                <View style={styles.skeletonWrap}>
                  {st.phase !== 'intro' && hasDemo(move.id) ? (
                    <View style={styles.skeletonItem}>
                      <View style={styles.miniCoach}>
                        <DemoCoach move={move.id} width={s(200)} />
                      </View>
                      <Text style={[text.small, styles.skeletonLabel]}>Coach</Text>
                    </View>
                  ) : null}
                  {laptopCamera ? (
                    // The laptop camera panel sits here and already shows you with your skeleton.
                    <CameraSlot width={Math.max(s(280), 210)} height={Math.max(s(330), 260)} />
                  ) : (
                    <View style={styles.skeletonItem}>
                      <Skeleton landmarks={pose?.lm ?? null} height={s(240)} aspect={pose?.ar ?? 0.75} mirrored={pose?.mirrored ?? true} />
                      <Text style={[text.small, styles.skeletonLabel]}>You</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={[styles.rightCol, !isBoss && { width: visualWidth }]}>
                {st.phase === 'intro' && hasDemo(move.id) ? (
                  <View style={styles.demoCard}>
                    <Text style={styles.demoTitle}>{isKid ? 'Watch me, then copy!' : 'Watch the coach, then copy'}</Text>
                    <DemoCoach move={move.id} width={Math.min(s(380), Math.floor(visualWidth * 0.6))} />
                    <Text style={[text.body, styles.demoLine]}>📏 Stand about 2–3 metres from the camera</Text>
                    {howTo?.camera ? <Text style={[text.muted, styles.demoLine]}>📷 {howTo.camera}</Text> : null}
                  </View>
                ) : (
                  visual
                )}
                {isKid ? <Text style={[text.small, styles.supervise]}>👀 A grown-up should be nearby while you play.</Text> : null}
              </View>
            </View>
            <Text style={text.small}>
              {voice === 'listening'
                ? '🎤 Listening: say “stop” any time. Or press Back on the remote, or STOP on the camera.'
                : voice === 'blocked'
                  ? '🎤 Allow the microphone in the browser to pause by saying “stop”. Or press Back, or STOP on the camera.'
                  : 'Press Back on the remote to pause. Say “stop” or tap STOP on the phone any time.'}
            </Text>
          </View>
        ) : null}

        {st.paused && playing ? (
          <View style={styles.overlay}>
            <Text style={text.h1}>{st.paused === 'pain' ? "Let's stop that move" : 'Paused'}</Text>
            <Text style={[text.body, styles.mt]}>
              {st.paused === 'pain'
                ? "Your comfort comes first. Try the seated version, or end for today. If pain doesn't settle, talk to a health professional."
                : 'Take a breath. You did well.'}
            </Text>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <DefaultFocus>
                <MwButton
                  label={st.paused === 'pain' ? 'Seated version' : 'Resume'}
                  onSelect={() => {
                    if (st.paused === 'pain') client.startExercise(move.id, { seated: true, target: move.target });
                    else client.control('resume');
                    dispatch({ type: 'resume' });
                  }}
                />
              </DefaultFocus>
              {st.paused !== 'pain' ? (
                <MwButton
                  label="Seated version"
                  onSelect={() => {
                    client.startExercise(move.id, { seated: true, target: move.target });
                    dispatch({ type: 'resume' });
                  }}
                />
              ) : null}
              <MwButton label="Skip this move" onSelect={() => dispatch({ type: 'skip' })} />
              <MwButton
                label="End session"
                tone="danger"
                onSelect={() => {
                  client.control('end');
                  dispatch({ type: 'end', reason: st.paused === 'pain' ? 'pain' : 'user' });
                }}
              />
            </SpatialNavigationView>
          </View>
        ) : null}

        {st.phase === 'after' ? (
          <View style={styles.center}>
            <Text style={text.brand}>{won ? headline.win : 'Great effort!'}</Text>
            <Text style={[text.h1, styles.mt]}>{after.mood ? 'And your energy now?' : 'How do you feel now?'}</Text>
            <View style={styles.sub} />
            <OptionGrid
              options={after.mood ? FACES.map((f, i) => ({ ...f, icon: ['🪫', '😮‍💨', '🙂', '⚡', '🔋'][i] })) : FACES}
              columns={5}
              cardWidth={faceWidth}
              onSelect={(v) => {
                if (!after.mood) setAfter({ mood: v });
                else {
                  setAfter({ mood: after.mood, energy: v });
                  save(after.mood, v);
                }
              }}
            />
          </View>
        ) : null}

        {st.phase === 'error' ? (
          <View style={styles.center}>
            <ErrorBox message={error ?? ''} onRetry={() => save(after.mood, after.energy)} />
          </View>
        ) : null}

        {st.phase === 'results' && result ? (
          <Results
            result={result}
            headline={won ? headline.win : headline.done}
            power={isBoss ? st.power : null}
            reps={st.moves.reduce((sum, m, i) => sum + (moveKind(m.id) === 'reps' ? st.reps[i] : 0), 0)}
            bestHold={bestHold}
            chairStands={chairStands}
            report={report}
            ending={ending}
            moodBefore={moodBefore}
            moodAfter={after.mood}
            isKid={isKid}
            onHome={() => leave('Home')}
            onAgain={() => leave('again')}
          />
        ) : null}
      </Screen>
    </SpatialNavigationRoot>
  );
}

interface ResultsProps {
  result: SessionResult;
  headline: string;
  power: number | null;
  reps: number;
  bestHold: number;
  chairStands: number | null;
  report: ReportResponse | null;
  ending?: string | null;
  moodBefore?: number;
  moodAfter?: number;
  isKid: boolean;
  onHome: () => void;
  onAgain: () => void;
}

function Results({ result, headline, power, reps, bestHold, chairStands, report, ending, moodBefore, moodAfter, isKid, onHome, onAgain }: ResultsProps) {
  const g = result.gained;
  const stickers = result.progress.stickers ?? [];
  return (
    <View style={styles.center}>
      <Text style={text.brand}>{headline}</Text>
      <Text style={[text.h1, styles.mt]}>{isKid && ending ? ending : result.celebration.line}</Text>
      <View style={styles.resultsRow}>
        <View style={styles.stats}>
          {isKid ? <Stat big={`🌟 ${result.progress.stars}`} small="stars collected" /> : null}
          {isKid && g.sticker ? <Stat big={STICKER_EMOJI[g.sticker] ?? '⭐'} small={`New sticker: ${g.sticker.replace(/_/g, ' ')}!`} /> : null}
          <Stat big={`+${g.xp} XP`} small={g.levelUp ? `Level up! You're now level ${g.level}` : `Level ${g.level}`} />
          <Stat big={`🔥 ${g.streak}`} small={`day${g.streak === 1 ? '' : 's'} in a row`} />
          {power !== null ? <Stat big={`⚡ ${power}`} small={`power · ${reps} reps`} /> : reps ? <Stat big={`${reps}`} small="reps" /> : null}
          {bestHold ? <Stat big={`${bestHold}s`} small="longest balance hold" /> : null}
          {chairStands !== null ? <Stat big={`🪑 ${chairStands}`} small="stands in 30 seconds" /> : null}
          <Stat big={GARDEN_STAGES[g.gardenStage] ?? '🌱'} small={g.gardenGrew ? 'Your garden grew!' : 'Your garden got watered'} />
        </View>
        {chairStands !== null && report?.stats.chairStand ? <ChairTrend history={report.stats.chairStand.history} /> : null}
        {moodBefore && moodAfter ? <MoodLift before={moodBefore} after={moodAfter} /> : null}
      </View>
      {g.newBadges.length ? <Text style={[text.h2, styles.mt]}>🏅 New badge: {g.newBadges.map((b) => BADGE_NAMES[b] ?? b).join(', ')}</Text> : null}
      {isKid && stickers.length ? (
        <View style={styles.mt}>
          <Text style={text.muted}>Your sticker book</Text>
          <View style={styles.stickerBook}>
            {stickers.map((st, i) => (
              <Text key={`${st}-${i}`} style={styles.sticker}>
                {STICKER_EMOJI[st] ?? '⭐'}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {result.sharedWithFamily ? <Text style={[text.muted, styles.mt]}>✓ Shared with your family circle</Text> : null}
      {result.followUp ? <Text style={[text.muted, styles.mt]}>{result.followUp.message}</Text> : null}
      <SpatialNavigationView direction="horizontal" style={styles.buttons}>
        <DefaultFocus>
          <MwButton label="Back home" onSelect={onHome} />
        </DefaultFocus>
        <MwButton label="Play again" onSelect={onAgain} />
      </SpatialNavigationView>
    </View>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statBig}>{big}</Text>
      <Text style={text.muted}>{small}</Text>
    </View>
  );
}

/** Before/after mood bars: the "mood lift" every session shows. */
function MoodLift({ before, after }: { before: number; after: number }) {
  const lift = after - before;
  const bar = (value: number, color: string, label: string) => (
    <View style={styles.barCol}>
      <Text style={styles.barFace}>{FACES[value - 1]?.icon}</Text>
      <View style={[styles.bar, { height: s(44 * value), backgroundColor: color }]} />
      <Text style={text.muted}>{label}</Text>
    </View>
  );
  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendTitle}>Mood lift</Text>
      <View style={styles.bars}>
        {bar(before, mw.cardRaised, 'Before')}
        {bar(after, mw.ok, 'After')}
      </View>
      <Text style={[text.body, styles.liftText]}>{lift > 0 ? `+${lift} after moving` : lift === 0 ? 'Same as before, and you showed up' : 'Thanks for being honest'}</Text>
    </View>
  );
}

/** Chair-stand results over time (last 8 tests): more stands = stronger legs. */
function ChairTrend({ history }: { history: { date: string; stands: number }[] }) {
  const max = Math.max(10, ...history.map((h) => h.stands));
  const latest = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendTitle}>Chair-stand trend</Text>
      <View style={styles.bars}>
        {history.slice(-6).map((h, i, arr) => (
          <View key={`${h.date}-${i}`} style={styles.trendCol}>
            <Text style={text.small}>{h.stands}</Text>
            <View style={[styles.trendBar, { height: s((200 * h.stands) / max), backgroundColor: i === arr.length - 1 ? mw.accent : mw.cardRaised }]} />
            <Text style={text.small}>{h.date.slice(5)}</Text>
          </View>
        ))}
      </View>
      <Text style={[text.body, styles.liftText]}>
        {prev && latest ? (latest.stands > prev.stands ? `+${latest.stands - prev.stands} since last time` : latest.stands === prev.stands ? 'Same as last time' : 'Every week counts') : 'Your first result: we will track it weekly'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  mt: { marginTop: s(12) },
  sub: { height: s(28) },
  buttons: { flexDirection: 'row', marginTop: s(32) },
  connectRow: { flexDirection: 'row', alignItems: 'center', marginTop: s(32) },
  connectText: { marginLeft: s(48) },
  code: { color: mw.text, fontSize: s(96), fontWeight: '900', letterSpacing: s(6), marginVertical: s(8) },
  battle: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  arena: { flex: 1, flexDirection: 'row', marginTop: s(16) },
  leftCol: { flex: 1, paddingRight: s(32) },
  rightCol: { width: s(560), alignItems: 'center', justifyContent: 'center' },
  rightWide: { width: s(1000) },
  moveName: { color: mw.text, fontSize: s(60), fontWeight: '900' },
  chapter: { color: mw.warn, fontSize: s(28), fontWeight: '800', marginTop: s(8) },
  narration: { color: mw.text, fontSize: s(36), fontWeight: '700', lineHeight: s(48), marginTop: s(8), marginBottom: s(12) },
  stepSmall: { marginTop: s(4), fontSize: s(24) },
  supervise: { marginTop: s(12) },
  stickerBook: { flexDirection: 'row', flexWrap: 'wrap', marginTop: s(8) },
  sticker: { fontSize: s(56), marginRight: s(12) },
  step: { marginTop: s(10) },
  countdown: { color: mw.accent, fontSize: s(72), fontWeight: '900', marginTop: s(20) },
  count: { color: mw.accent, fontSize: s(180), fontWeight: '900', lineHeight: s(190) },
  target: { color: mw.muted, fontSize: s(60), fontWeight: '800' },
  moveDone: { color: mw.ok, fontSize: s(44), fontWeight: '900' },
  comboText: { color: mw.warn, fontSize: s(40), fontWeight: '900' },
  manual: { marginTop: s(12) },
  cue: { color: mw.text, fontSize: s(30), fontWeight: '700', marginTop: s(16) },
  need: { color: mw.warn, fontSize: s(28), fontWeight: '700', marginTop: s(16) },
  skeletonWrap: { flexDirection: 'row', alignItems: 'flex-end', marginTop: s(20) },
  skeletonItem: { alignItems: 'center', marginRight: s(20) },
  skeletonLabel: { marginTop: s(6) },
  miniCoach: { backgroundColor: mw.card, borderRadius: 16, overflow: 'hidden' },
  demoCard: { backgroundColor: mw.card, borderRadius: s(28), padding: s(24), alignItems: 'center', alignSelf: 'stretch' },
  demoTitle: { color: mw.accent, fontSize: s(30), fontWeight: '800', marginBottom: s(8) },
  demoLine: { marginTop: s(10), textAlign: 'center' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 22, 48, 0.94)',
    justifyContent: 'center',
    paddingHorizontal: s(120),
  },
  resultsRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: s(28) },
  stats: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  stat: { backgroundColor: mw.card, borderRadius: s(24), padding: s(24), marginRight: s(18), marginBottom: s(18), minWidth: s(240) },
  statBig: { color: mw.text, fontSize: s(48), fontWeight: '900' },
  trendCard: { backgroundColor: mw.card, borderRadius: s(24), padding: s(24), minWidth: s(360), alignItems: 'center', marginLeft: s(18) },
  trendTitle: { color: mw.accent, fontSize: s(26), fontWeight: '800' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: s(300), marginTop: s(10) },
  barCol: { alignItems: 'center', marginHorizontal: s(24), justifyContent: 'flex-end' },
  barFace: { fontSize: s(40), marginBottom: s(6) },
  bar: { width: s(80), borderRadius: s(12) },
  trendCol: { alignItems: 'center', marginHorizontal: s(10), justifyContent: 'flex-end' },
  trendBar: { width: s(44), borderRadius: s(8), marginVertical: s(4) },
  liftText: { marginTop: s(10), textAlign: 'center' },
});
