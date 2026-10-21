// Daily check-in (mood, energy, sleep, pain) → POST /checkin → adapted session, or a calm support screen.
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { RootStackParamList } from '../navigation/types';
import { api } from './api';
import { playVoice } from './audio';
import { adaptedText, exerciseName, GAMES, moveKind, movesFor, playableGame, singleMoves } from './catalog';
import MwButton from './MwButton';
import WorkoutPicker, { WorkoutChoice } from './WorkoutPicker';
import { mw } from './theme';
import { CheckinResponse } from './types';
import { ErrorBox, Loading, Option, OptionGrid, Screen, text, useColumnWidth } from './ui';
import { useUser } from './UserContext';

const s = scaledPixels;

const STEPS: { key: 'mood' | 'energy' | 'sleep' | 'pain'; title: string; sub?: string; options: Option<any>[] }[] = [
  {
    key: 'mood',
    title: 'How are you feeling today?',
    sub: 'There are no wrong answers.',
    options: [
      { value: 1, label: 'Very low', icon: '😞' },
      { value: 2, label: 'Low', icon: '🙁' },
      { value: 3, label: 'Okay', icon: '😐' },
      { value: 4, label: 'Good', icon: '🙂' },
      { value: 5, label: 'Great', icon: '😄' },
    ],
  },
  {
    key: 'energy',
    title: 'How much energy do you have?',
    options: [
      { value: 1, label: 'Empty', icon: '🪫' },
      { value: 2, label: 'Low', icon: '😮‍💨' },
      { value: 3, label: 'Some', icon: '🙂' },
      { value: 4, label: 'Good', icon: '⚡' },
      { value: 5, label: 'Full', icon: '🔋' },
    ],
  },
  {
    key: 'sleep',
    title: 'How did you sleep last night?',
    options: [
      { value: 1, label: 'Very badly', icon: '😫' },
      { value: 2, label: 'Badly', icon: '😕' },
      { value: 3, label: 'Okay', icon: '😐' },
      { value: 4, label: 'Well', icon: '🙂' },
      { value: 5, label: 'Very well', icon: '😴' },
    ],
  },
  {
    key: 'pain',
    title: 'Any pain today?',
    sub: 'If something hurts, we switch to seated moves.',
    options: [
      { value: false, label: 'No pain', icon: '👍' },
      { value: true, label: 'Some pain', icon: '🩹' },
    ],
  },
];

export default function CheckinScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Checkin'>>();
  const { userId, data } = useUser();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<WorkoutChoice | null>(null);
  const cardWidth = useColumnWidth(STEPS[step].options.length, s(420));

  const submit = async (final: Record<string, any>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.checkin({ userId, mood: final.mood, energy: final.energy, sleep: final.sleep, pain: final.pain });
      setResult(res);
      playVoice(res.coach?.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const answer = (key: string, value: any) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step + 1 < STEPS.length) setStep(step + 1);
    else submit(next);
  };

  if (busy) return <Loading text="Planning today's session around how you feel…" />;

  // The person's own pick (from Home, a mode, or "Choose something else" below) stays; otherwise play today's
  // (possibly adapted) game, e.g. Calm River on a low day. Moves are re-checked against today's answers:
  // reporting pain swaps a picked standing move for the safe list.
  const isKid = data?.profile.kind === 'kid';
  const plan = data?.plan ?? null;
  const picked = chosen ?? (route.params?.game ? { game: route.params.game, moves: route.params.moves } : null);
  const recommended = playableGame(result?.today?.game ?? 'boss_battle');
  const game = picked?.game ?? recommended;
  // A game is rebuilt for today's answers; a single move is kept only while it is still safe today.
  const single = picked?.moves?.length === 1 ? picked.moves[0] : null;
  const singleOk = Boolean(single && result?.today && singleMoves(plan, result.today, isKid).some((m) => m.id === single.id));
  const moves = !result?.today ? [] : singleOk ? [single!] : movesFor(game, plan, result.today, isKid);
  const ownChoice = Boolean(picked) && (game !== recommended || singleOk);

  const start = () => {
    if (!result?.today) return;
    navigation.replace('Session', { game, moves, moodBefore: answers.mood, energyBefore: answers.energy });
  };

  const view = error ? 'error' : result ? (result.safety.level === 'support' ? 'support' : 'result') : 'ask';
  const q = STEPS[step];

  return (
    <SpatialNavigationRoot key={`${view}-${step}-${breathing}-${picking}-${chosen?.game ?? ''}`} isActive={isFocused}>
      <Screen style={styles.center}>
        {view === 'ask' ? (
          <>
            <Text style={text.brand}>Daily check-in · {step + 1} of {STEPS.length}</Text>
            <Text style={[text.h1, styles.title]}>{q.title}</Text>
            {q.sub ? <Text style={[text.muted, styles.sub]}>{q.sub}</Text> : <View style={styles.sub} />}
            <OptionGrid options={q.options} columns={q.options.length} cardWidth={cardWidth} onSelect={(v) => answer(q.key, v)} />
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <MwButton label="← Back" onSelect={() => (step > 0 ? setStep(step - 1) : navigation.goBack())} />
            </SpatialNavigationView>
          </>
        ) : null}

        {view === 'error' ? <ErrorBox message={error ?? ''} onRetry={() => submit(answers)} /> : null}

        {view === 'support' && result ? (
          breathing ? (
            <BreathingView onDone={() => setBreathing(false)} />
          ) : (
            <View style={styles.support}>
              <Text style={text.h1}>{result.safety.title ?? "Let's pause here"}</Text>
              <Text style={[text.body, styles.supportText]}>{result.safety.message}</Text>
              {(result.safety.helplines ?? []).map((h) => (
                <Text key={h.name} style={[text.h2, styles.helpline]}>
                  📞 {h.name}: {h.contact}
                </Text>
              ))}
              {result.safety.emergency ? <Text style={[text.body, styles.supportText]}>{result.safety.emergency}</Text> : null}
              <Text style={[text.muted, styles.supportText]}>{result.safety.disclaimer ?? 'PlayMotion is not therapy.'}</Text>
              <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                <DefaultFocus>
                  <MwButton label="2 minutes of slow breathing" onSelect={() => setBreathing(true)} />
                </DefaultFocus>
                <MwButton label="Back to home" onSelect={() => navigation.goBack()} />
              </SpatialNavigationView>
            </View>
          )
        ) : null}

        {view === 'result' && result?.today && picking ? (
          <WorkoutPicker
            plan={plan}
            today={result.today}
            isKid={isKid}
            recommended={recommended}
            onPick={(c) => {
              setChosen(c);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        ) : null}

        {view === 'result' && result?.today && !picking ? (
          <View>
            <Text style={text.brand}>Thanks for checking in</Text>
            <Text style={[text.h1, styles.title]}>“{result.coach?.line}”</Text>
            <View style={styles.sessionCard}>
              <Text style={styles.sessionIcon}>{GAMES[game]?.icon}</Text>
              <View style={styles.flex}>
                <Text style={text.h2}>
                  {GAMES[game]?.name} · {result.today.minutes} min
                </Text>
                <Text style={text.muted}>{moves.map((m) => `${exerciseName(m.id)} (${m.target}${moveKind(m.id) === 'reps' ? '' : ' s'})`).join(' · ')}</Text>
                <Text style={[text.small, styles.adapted]}>
                  {ownChoice
                    ? ['low_mood', 'low_energy'].includes(result.today.adapted)
                      ? 'Your choice. Go gently today and stop any time.'
                      : 'Your choice, with moves that are safe for you.'
                    : `⭐ Recommended · ${adaptedText(result.today.adapted)}`}
                </Text>
              </View>
            </View>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <DefaultFocus>
                <MwButton label="Start session" onSelect={start} />
              </DefaultFocus>
              <MwButton label="🎯 Choose something else" onSelect={() => setPicking(true)} />
              <MwButton label="Not now" onSelect={() => navigation.goBack()} />
            </SpatialNavigationView>
          </View>
        ) : null}
      </Screen>
    </SpatialNavigationRoot>
  );
}

/** Paced breathing: 4 s in, 6 s out, for about 2 minutes. */
function BreathingView({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [breaths, setBreaths] = useState(0);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(scale, { toValue: 0.6, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    let inPhase = true;
    const tick = () => {
      inPhase = !inPhase;
      setPhase(inPhase ? 'in' : 'out');
      if (inPhase) setBreaths((b) => b + 1);
      timer = setTimeout(tick, inPhase ? 4000 : 6000);
    };
    let timer = setTimeout(tick, 4000);
    return () => {
      loop.stop();
      clearTimeout(timer);
    };
  }, [scale]);

  return (
    <View style={styles.breathing}>
      <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
        <Text style={styles.circleText}>{phase === 'in' ? 'Breathe in…' : 'Breathe out…'}</Text>
      </Animated.View>
      <Text style={[text.muted, styles.breathCount]}>{breaths} of 12 breaths · go at your own pace</Text>
      <SpatialNavigationView direction="horizontal" style={styles.buttons}>
        <DefaultFocus>
          <MwButton label={breaths >= 12 ? 'Done' : 'Stop'} onSelect={onDone} />
        </DefaultFocus>
      </SpatialNavigationView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  flex: { flex: 1 },
  title: { marginTop: s(10) },
  sub: { marginTop: s(8), marginBottom: s(32), minHeight: s(8) },
  buttons: { flexDirection: 'row', marginTop: s(32) },
  support: { maxWidth: s(1400) },
  supportText: { marginTop: s(16) },
  helpline: { marginTop: s(18), color: mw.accent },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: mw.card, borderRadius: s(28), padding: s(30), marginTop: s(32), maxWidth: s(1400) },
  sessionIcon: { fontSize: s(96), marginRight: s(28) },
  adapted: { marginTop: s(6) },
  breathing: { alignItems: 'center' },
  circle: { width: s(460), height: s(460), borderRadius: s(230), backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' },
  circleText: { color: mw.onAccent, fontSize: s(40), fontWeight: '800' },
  breathCount: { marginTop: s(32) },
});
