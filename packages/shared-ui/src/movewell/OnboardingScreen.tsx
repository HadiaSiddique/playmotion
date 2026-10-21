// Onboarding Q&A answered with the remote → POST /onboard → "Your plan is ready" reveal.
import { CommonActions, useIsFocused, useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { api } from './api';
import { GAMES, MODES } from './catalog';
import MwButton from './MwButton';
import { buildOnboardBody, Question, questionsFor } from './onboardingQuestions';
import { mw } from './theme';
import { OnboardResponse } from './types';
import { ErrorBox, Loading, OptionCard, OptionGrid, Screen, text, useColumnWidth } from './ui';
import { useUser } from './UserContext';

const s = scaledPixels;

type Phase = 'intro' | 'questions' | 'submitting' | 'reveal' | 'error';

export default function OnboardingScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { signIn } = useUser();
  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<OnboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questions = questionsFor(answers);
  const question = questions[step];

  const submit = async (final: Record<string, any>) => {
    setPhase('submitting');
    try {
      const res = await api.onboard(buildOnboardBody(final));
      setResult(res);
      setPhase('reveal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setPhase('error');
    }
  };

  const answer = (key: string, value: any) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    const list = questionsFor(next);
    if (step + 1 < list.length) setStep(step + 1);
    else submit(next);
  };

  const back = () => (step > 0 ? setStep(step - 1) : setPhase('intro'));

  const finish = async () => {
    if (!result) return;
    await signIn(result.userId);
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
  };

  if (phase === 'submitting') return <Loading text="Building your personal plan…" />;

  return (
    // A fresh navigation root per step puts focus on the first answer every time.
    <SpatialNavigationRoot key={`${phase}-${step}`} isActive={isFocused}>
      <Screen>
        {phase === 'intro' ? <Intro onStart={() => setPhase('questions')} /> : null}
        {phase === 'questions' && question ? (
          <QuestionView question={question} step={step} total={questions.length} answers={answers} onAnswer={answer} onBack={back} />
        ) : null}
        {phase === 'reveal' && result ? <Reveal result={result} onDone={finish} /> : null}
        {phase === 'error' ? (
          <View style={styles.center}>
            <ErrorBox message={error ?? ''} onRetry={() => submit(answers)} />
          </View>
        ) : null}
      </Screen>
    </SpatialNavigationRoot>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={text.brand}>PlayMotion</Text>
      <Text style={[text.h1, styles.introTitle]}>Your TV is now your coach.</Text>
      <Text style={[text.body, styles.introBody]}>
        Your phone becomes the camera, your TV turns every workout into a game. Let's set up a plan that fits you. It takes about a minute, all with the remote.
      </Text>
      <View style={styles.notice}>
        <Text style={text.body}>🔒 Video never leaves your phone. Only body points and rep counts reach the TV.</Text>
        <Text style={[text.body, styles.noticeLine]}>🩺 PlayMotion is wellness coaching, not a medical device.</Text>
      </View>
      <SpatialNavigationView direction="horizontal" style={styles.buttons}>
        <DefaultFocus>
          <MwButton label="Let's set up" onSelect={onStart} />
        </DefaultFocus>
      </SpatialNavigationView>
    </View>
  );
}

interface QuestionViewProps {
  question: Question;
  step: number;
  total: number;
  answers: Record<string, any>;
  onAnswer: (key: string, value: any) => void;
  onBack: () => void;
}

function QuestionView({ question, step, total, answers, onAnswer, onBack }: QuestionViewProps) {
  const columns = question.columns ?? 3;
  const cardWidth = useColumnWidth(columns);
  const [multi, setMulti] = useState<string[]>(answers[question.key] ?? []);

  const toggle = (value: string) => {
    if (value === 'none' || value === 'full_body') return setMulti(multi.includes(value) ? [] : [value]); // "all over" covers every area
    const without = multi.filter((v) => v !== 'none' && v !== 'full_body' && v !== value);
    setMulti(multi.includes(value) ? without : [...without, value]);
  };

  return (
    <View style={styles.question}>
      <View style={styles.progressRow}>
        <Text style={text.muted}>
          Question {step + 1} of {total}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(((step + 1) / total) * 100)}%` }]} />
        </View>
      </View>
      <Text style={[text.h1, styles.questionTitle]}>{question.title}</Text>
      {question.sub ? <Text style={[text.muted, styles.questionSub]}>{question.sub}</Text> : <View style={styles.questionSub} />}

      {question.kind === 'single' ? (
        <OptionGrid
          options={question.options ?? []}
          columns={columns}
          cardWidth={cardWidth}
          isSelected={(v) => answers[question.key] === v}
          onSelect={(v) => onAnswer(question.key, v)}
        />
      ) : null}

      {question.kind === 'multi' ? (
        <OptionGrid options={question.options ?? []} columns={columns} cardWidth={cardWidth} isSelected={(v) => multi.includes(v)} onSelect={toggle} />
      ) : null}

      {question.kind === 'info' ? (
        <SpatialNavigationView direction="horizontal" style={styles.buttons}>
          <DefaultFocus>
            <MwButton label="I'm the parent: continue" onSelect={() => onAnswer(question.key, true)} />
          </DefaultFocus>
        </SpatialNavigationView>
      ) : null}

      {question.kind === 'pin' ? <PinPad onDone={(pin) => onAnswer(question.key, pin)} /> : null}

      {question.kind === 'text' ? <NameKeyboard initial={answers[question.key] ?? ''} onDone={(name) => onAnswer(question.key, name)} /> : null}

      <SpatialNavigationView direction="horizontal" style={styles.backRow}>
        {question.kind === 'multi' ? (
          <MwButton label={multi.length ? '✓ Done' : 'Skip'} onSelect={() => onAnswer(question.key, multi.length ? multi : ['none'])} />
        ) : null}
        <MwButton label="← Back" onSelect={onBack} />
        {question.skip ? <MwButton label={question.skip.label ?? 'Skip for now'} onSelect={() => onAnswer(question.key, question.skip?.value)} /> : null}
      </SpatialNavigationView>
    </View>
  );
}

function PinPad({ onDone }: { onDone: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const press = (key: string) => {
    if (key === '⌫') return setPin(pin.slice(0, -1));
    if (key === 'OK') return pin.length === 4 && onDone(pin);
    if (pin.length < 4) setPin(pin + key);
  };
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['⌫', '0', 'OK']];
  return (
    <View style={styles.pinWrap}>
      <Text style={styles.pinDots} accessibilityLabel={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (i < pin.length ? '●' : '○')).join('  ')}
      </Text>
      <SpatialNavigationView direction="vertical">
        {rows.map((row, r) => (
          <SpatialNavigationView key={r} direction="horizontal" style={styles.pinRow}>
            {row.map((key, c) => {
              const card = (
                <OptionCard key={key} label={key} width={s(150)} disabled={key === 'OK' && pin.length < 4} onSelect={() => press(key)} />
              );
              return r === 0 && c === 0 ? <DefaultFocus key={key}>{card}</DefaultFocus> : card;
            })}
          </SpatialNavigationView>
        ))}
      </SpatialNavigationView>
    </View>
  );
}

const NAME_MAX = 20;
const KEY_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'].map((r) => r.split(''));

/** Type a name with the remote (on-screen letters) or, on a laptop, the keyboard. */
function NameKeyboard({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [name, setName] = useState<string>(initial);
  const keyWidth = useColumnWidth(10, s(150));
  const add = (ch: string) =>
    setName((n) => {
      if (n.length >= NAME_MAX || (ch === ' ' && (!n || n.endsWith(' ')))) return n;
      // "ammi khan" -> "Ammi Khan": capital at the start of each word.
      return n + (!n || n.endsWith(' ') ? ch.toUpperCase() : ch.toLowerCase());
    });
  const erase = () => setName((n) => n.slice(0, -1));
  const done = () => name.trim() && onDone(name.trim());

  // Laptop / web: typing on the physical keyboard works too.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[\p{L}' .-]$/u.test(e.key)) add(e.key);
      else if (e.key === 'Backspace') erase();
      else return;
      // Capture phase + stop: Backspace is also the remote's Back key (RemoteControlManager), and letters must not leave the screen.
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <View style={styles.nameBox}>
        <Text style={[styles.nameText, !name && styles.namePlaceholder]}>{name || 'Your name'}</Text>
        <Text style={styles.nameCursor}>|</Text>
      </View>
      <SpatialNavigationView direction="vertical">
        {KEY_ROWS.map((row, r) => (
          <SpatialNavigationView key={r} direction="horizontal" style={styles.keyRow}>
            {row.map((k, c) => {
              const key = <OptionCard key={k} label={k} width={keyWidth} onSelect={() => add(k)} />;
              return r === 0 && c === 0 ? <DefaultFocus key={k}>{key}</DefaultFocus> : key;
            })}
          </SpatialNavigationView>
        ))}
        <SpatialNavigationView direction="horizontal" style={styles.keyRow}>
          <OptionCard label="Space" width={keyWidth * 2} onSelect={() => add(' ')} />
          <OptionCard label="⌫ Delete" width={keyWidth * 2} onSelect={erase} />
          <OptionCard label="✓ Done" width={keyWidth * 2} disabled={!name.trim()} onSelect={done} />
        </SpatialNavigationView>
      </SpatialNavigationView>
    </View>
  );
}

function Reveal({ result, onDone }: { result: OnboardResponse; onDone: () => void }) {
  const { plan, profile } = result;
  const mode = MODES.find((m) => m.id === plan.mode);
  const isKid = profile.kind === 'kid';
  return (
    <View style={styles.reveal}>
      <Text style={text.brand}>{isKid ? `Ready for adventure, ${profile.kid?.nickname}!` : 'Your plan is ready'}</Text>
      <View style={styles.revealHead}>
        <Text style={styles.modeIcon}>{mode?.icon}</Text>
        <View style={styles.revealHeadText}>
          <Text style={text.h2}>
            {mode?.name} mode · {plan.sessionMinutes} min sessions{plan.posture === 'seated' ? ' · seated' : ''}
          </Text>
          <Text style={[text.body, styles.summary]}>{plan.explanation.summary}</Text>
        </View>
      </View>
      {plan.explanation.why.map((why) => (
        <Text key={why} style={[text.body, styles.why]}>
          ✓ {why}
        </Text>
      ))}
      <View style={styles.week}>
        {plan.week.map((d) => (
          <View key={d.day} style={styles.day}>
            <Text style={text.small}>{d.day}</Text>
            <Text style={styles.dayIcon}>{GAMES[d.game]?.icon}</Text>
            <Text style={styles.dayGame} numberOfLines={2}>
              {GAMES[d.game]?.name}
            </Text>
            <Text style={text.small}>{d.minutes} min</Text>
          </View>
        ))}
      </View>
      <Text style={[text.small, styles.safety]}>{plan.safetyNotes.join('  ·  ')}</Text>
      <SpatialNavigationView direction="horizontal" style={styles.buttons}>
        <DefaultFocus>
          <MwButton label={isKid ? "Let's play!" : "Let's go"} onSelect={onDone} />
        </DefaultFocus>
      </SpatialNavigationView>
      {plan.explanation.source === 'ai' ? <Text style={text.small}>Personalised by PlayMotion AI (Amazon Bedrock)</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  introTitle: { marginTop: s(12) },
  introBody: { maxWidth: s(1300), marginTop: s(16) },
  notice: { backgroundColor: mw.card, borderRadius: s(24), padding: s(28), marginTop: s(36), maxWidth: s(1300) },
  noticeLine: { marginTop: s(10) },
  buttons: { flexDirection: 'row', marginTop: s(36) },
  question: { flex: 1, justifyContent: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: s(16) },
  progressTrack: { flex: 1, height: s(10), backgroundColor: mw.card, borderRadius: s(5), marginLeft: s(24), overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: mw.accent },
  questionTitle: { fontSize: s(54) },
  questionSub: { marginTop: s(8), marginBottom: s(32), minHeight: s(8) },
  backRow: { flexDirection: 'row', marginTop: s(28) },
  pinWrap: { alignItems: 'flex-start' },
  pinDots: { color: mw.text, fontSize: s(56), letterSpacing: s(8), marginBottom: s(20) },
  pinRow: { flexDirection: 'row', marginBottom: s(14) },
  nameBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: mw.card, borderRadius: s(20), paddingHorizontal: s(28), paddingVertical: s(16), marginBottom: s(20), alignSelf: 'flex-start', minWidth: s(700) },
  nameText: { color: mw.text, fontSize: s(48), fontWeight: '800' },
  namePlaceholder: { color: mw.muted },
  nameCursor: { color: mw.accent, fontSize: s(48), fontWeight: '300', marginLeft: s(4) },
  keyRow: { flexDirection: 'row', marginBottom: s(10) },
  reveal: { flex: 1, justifyContent: 'center' },
  revealHead: { flexDirection: 'row', alignItems: 'center', marginTop: s(16), marginBottom: s(12) },
  revealHeadText: { flex: 1 },
  modeIcon: { fontSize: s(96), marginRight: s(28) },
  summary: { marginTop: s(8) },
  why: { marginTop: s(8) },
  week: { flexDirection: 'row', marginTop: s(28) },
  day: { flex: 1, backgroundColor: mw.card, borderRadius: s(20), padding: s(16), marginRight: s(14), alignItems: 'center' },
  dayIcon: { fontSize: s(48), marginVertical: s(6) },
  dayGame: { color: mw.text, fontSize: s(22), fontWeight: '700', textAlign: 'center', minHeight: s(56) },
  safety: { marginTop: s(20) },
});
