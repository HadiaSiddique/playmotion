// First screen on the TV: QR code + 6-digit code, then "Connected ✓" with a live view of what the phone sends.
// The test buttons start rep counting on the phone, so the whole loop can be checked with the remote.
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { RootStackParamList } from '../navigation/types';
import { safeZones } from '../theme';
import { getPlayMotionConfig } from './config';
import { LaptopCameraButton } from './LaptopCamera';
import MwButton from './MwButton';
import { usePairing, usePhoneEvents } from './PairingContext';
import QrCode from './QrCode';
import Skeleton, { CompactLandmark } from './Skeleton';
import { mw } from './theme';
import howToJson from '../../../shared/howto.json';

type HowTo = { steps: string[]; tip: string; camera: string };
const HOW_TO = howToJson as Record<string, HowTo>;

const EXERCISE_NAMES: Record<string, string> = {
  sit_to_stand: 'Sit to stand',
  arm_raise: 'Arm raises',
  seated_arm_raise: 'Seated arm raises',
  chair_stand_test: 'Chair-stand test',
};
const nameOf = (id: string) => EXERCISE_NAMES[id] ?? id.replace(/_/g, ' ');

const CUE_TEXT: Record<string, string> = {
  slow_down: 'Nice and slow. Control the move.',
  stand_tall: 'Stand tall and look ahead.',
  arms_higher: 'Reach a little higher if it feels okay.',
  step_in_frame: 'Step back or tilt the phone down so we can see your hips and knees.',
  show_arms: 'Make sure your shoulders and both hands are in the picture.',
};

const NEED_TEXT: Record<string, string> = {
  legs: 'The phone needs to see your hips and knees. Step back or tilt the phone down.',
  upper: 'The phone needs to see your shoulders and both hands. Move back a little.',
};

interface Pose {
  lm: CompactLandmark[];
  ar: number;
  mirrored: boolean;
}

export default function PairingScreen() {
  const { client, state } = usePairing();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { phoneUrl } = getPlayMotionConfig();

  const [pose, setPose] = useState<Pose | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [rep, setRep] = useState<{ exercise: string; count: number; formScore: number } | null>(null);
  const [cue, setCue] = useState<string | null>(null);
  const [safety, setSafety] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<number | null>(null);
  const [poseFps, setPoseFps] = useState(0);
  const [need, setNeed] = useState<string | null>(null);
  const frames = useRef({ count: 0, since: Date.now() });
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePhoneEvents((e) => {
    const p = e.payload ?? {};
    switch (e.event) {
      case 'pose': {
        setPose({ lm: p.lm, ar: p.ar || 0.75, mirrored: Boolean(p.mirrored) });
        frames.current.count += 1;
        const elapsed = Date.now() - frames.current.since;
        if (elapsed >= 2000) {
          setPoseFps(Math.round((frames.current.count * 1000) / elapsed));
          frames.current = { count: 0, since: Date.now() };
        }
        break;
      }
      case 'status':
        if (p.camera === 'ready') setCameraReady(true);
        // The phone says which move it is tracking (also when started from the phone's practice buttons).
        if (typeof p.exercise === 'string') {
          setRep({ exercise: p.exercise, count: 0, formScore: 0 });
          setNeed(null);
        }
        if ('inFrame' in p) setNeed(p.inFrame ? null : p.need ?? 'upper');
        break;
      case 'rep':
        setRep({ exercise: p.exercise, count: p.count, formScore: p.formScore });
        break;
      case 'form':
        setCue(CUE_TEXT[p.cue] ?? null);
        if (cueTimer.current) clearTimeout(cueTimer.current);
        cueTimer.current = setTimeout(() => setCue(null), 3500);
        break;
      case 'safety':
        if (p.kind === 'stop') setSafety('Stopped from the phone. Take a breath.');
        else if (p.kind === 'pain') setSafety("Paused because something hurts. Let's switch to a seated version.");
        else setSafety(null); // ok / seated_switch / end
        break;
      case 'game':
        if (p.kind === 'chair_stand_result') setTestResult(p.stands);
        break;
      default:
        break;
    }
  });

  const start = useCallback(
    (exercise: string, seated = false) => {
      setRep({ exercise: seated ? `seated_${exercise}` : exercise, count: 0, formScore: 0 });
      setSafety(null);
      setTestResult(null);
      client.startExercise(exercise, { seated, target: 10 });
    },
    [client],
  );

  const connected = state.status === 'connected';
  const code = state.code ? `${state.code.slice(0, 3)} ${state.code.slice(3)}` : '--- ---';

  return (
    // Re-mounting on connect/disconnect puts remote focus on the new screen's first button.
    <SpatialNavigationRoot key={connected ? 'connected' : 'waiting'} isActive={isFocused}>
      <View style={styles.screen}>
        <View style={styles.left}>
          <Text style={styles.brand}>PlayMotion</Text>
          <Text style={styles.title}>{connected ? 'Your phone is connected' : 'Connect your phone'}</Text>
          <Text style={styles.subtitle}>Your phone becomes the camera. Video never leaves your phone.</Text>

          {connected && rep && HOW_TO[rep.exercise] ? (
            <HowToPanel name={nameOf(rep.exercise)} howTo={HOW_TO[rep.exercise]} />
          ) : (
          <View style={styles.qrRow}>
            <View style={styles.qrBox}>
              {state.joinUrl ? (
                <QrCode value={state.joinUrl} size={scaledPixels(340)} />
              ) : (
                <View style={[styles.qrPlaceholder, { width: scaledPixels(340), height: scaledPixels(340) }]}>
                  <Text style={styles.muted}>{state.status === 'error' ? 'No connection' : 'Getting a code…'}</Text>
                </View>
              )}
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Or type this code</Text>
              <Text style={styles.code} accessibilityLabel={`Pairing code ${state.code?.split('').join(' ') ?? 'loading'}`}>
                {code}
              </Text>
              {phoneUrl ? <Text style={styles.url}>{phoneUrl.replace(/^https?:\/\//, '')}</Text> : null}
            </View>
          </View>
          )}

          <View style={[styles.status, connected ? styles.statusOk : styles.statusWait]}>
            <Text style={[styles.statusText, { color: connected ? mw.ok : mw.warn }]}>
              {connected
                ? `Connected ✓${state.phones > 1 ? `  (${state.phones} devices)` : ''}`
                : state.status === 'reconnecting'
                  ? 'Reconnecting…'
                  : state.status === 'error'
                    ? state.error ?? 'Connection problem'
                    : 'Waiting for your phone…'}
            </Text>
          </View>
          {state.error && state.status !== 'error' ? <Text style={styles.error}>{state.error}</Text> : null}
        </View>

        <View style={styles.right}>
          {connected ? (
            <>
              <View style={styles.liveRow}>
                <Skeleton landmarks={pose?.lm ?? null} height={scaledPixels(360)} aspect={pose?.ar ?? 0.75} mirrored={pose?.mirrored ?? true} />
                <View style={styles.liveInfo}>
                  <Text style={styles.liveLabel}>{cameraReady ? 'Phone camera ready ✓' : 'Starting the phone camera…'}</Text>
                  <Text style={styles.muted}>{pose ? `${poseFps} pose updates / s` : 'Step in front of the phone'}</Text>
                  {rep ? (
                    <>
                      <Text style={styles.exercise}>{nameOf(rep.exercise)}</Text>
                      <Text style={styles.count}>{rep.count}</Text>
                      {rep.count > 0 ? <Text style={styles.muted}>Form {rep.formScore}/100</Text> : null}
                    </>
                  ) : null}
                  {testResult !== null ? <Text style={styles.result}>{testResult} stands in 30 seconds</Text> : null}
                  <Text style={styles.cue}>{cue ?? ' '}</Text>
                </View>
              </View>
              {need && !safety ? (
                <View style={styles.needBanner}>
                  <Text style={styles.needText}>{NEED_TEXT[need] ?? NEED_TEXT.upper}</Text>
                </View>
              ) : null}
              {safety ? (
                <View style={styles.safety}>
                  <Text style={styles.safetyText}>{safety}</Text>
                </View>
              ) : null}
              <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                <DefaultFocus>
                  <MwButton label="Test sit to stand" onSelect={() => start('sit_to_stand')} />
                </DefaultFocus>
                <MwButton label="Test arm raises" onSelect={() => start('arm_raise')} />
                <MwButton label="Seated arm raises" onSelect={() => start('arm_raise', true)} />
              </SpatialNavigationView>
              <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                {safety ? (
                  <MwButton
                    label="Resume"
                    onSelect={() => {
                      setSafety(null);
                      client.control('resume');
                    }}
                  />
                ) : null}
                <MwButton label="Stop" tone="danger" onSelect={() => client.control('end')} />
                <MwButton label="Continue to app" onSelect={() => navigation.navigate('Home')} />
              </SpatialNavigationView>
            </>
          ) : (
            <>
              <Text style={styles.stepsTitle}>How to connect</Text>
              <Step n={1} text="Open your phone's camera and point it at the QR code." />
              <Step n={2} text={`Or open ${phoneUrl ? phoneUrl.replace(/^https?:\/\//, '') : 'the PlayMotion link'} and type the code.`} />
              <Step n={3} text="Stand the phone upright 2–3 metres away, so your whole body is in view." />
              <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                <DefaultFocus>
                  <MwButton label="New code" onSelect={() => client.newCode()} />
                </DefaultFocus>
                <MwButton label="Skip for now" onSelect={() => navigation.navigate('Home')} />
              </SpatialNavigationView>
              {Platform.OS === 'web' ? (
                <>
                  <Text style={[styles.muted, styles.laptopHint]}>No phone? On a laptop, use its webcam instead:</Text>
                  <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                    <LaptopCameraButton />
                  </SpatialNavigationView>
                </>
              ) : null}
            </>
          )}
          <Text style={styles.fineprint}>Wellness coaching, not a medical device.</Text>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

/** "How to do it" card shown in place of the QR code while a move is active. */
function HowToPanel({ name, howTo }: { name: string; howTo: HowTo }) {
  return (
    <View style={styles.howTo}>
      <Text style={styles.howToLabel}>How to do it</Text>
      <Text style={styles.howToName}>{name}</Text>
      {howTo.steps.map((step, i) => (
        <Step key={step} n={i + 1} text={step} />
      ))}
      <Text style={styles.howToTip}>💡 {howTo.tip}</Text>
      <Text style={styles.howToCamera}>📱 {howTo.camera}</Text>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: mw.bg,
    paddingHorizontal: scaledPixels(safeZones.titleSafe.horizontal),
    paddingVertical: scaledPixels(safeZones.titleSafe.vertical),
  },
  left: { flex: 1.1, justifyContent: 'center', paddingRight: scaledPixels(48) },
  right: { flex: 1, justifyContent: 'center' },
  brand: { color: mw.accent, fontSize: scaledPixels(30), fontWeight: '800', letterSpacing: 1 },
  title: { color: mw.text, fontSize: scaledPixels(60), fontWeight: '800', marginTop: scaledPixels(8) },
  subtitle: { color: mw.muted, fontSize: scaledPixels(28), marginTop: scaledPixels(8), marginBottom: scaledPixels(32) },
  qrRow: { flexDirection: 'row', alignItems: 'center' },
  qrBox: { marginRight: scaledPixels(40) },
  qrPlaceholder: { backgroundColor: mw.card, borderRadius: scaledPixels(16), alignItems: 'center', justifyContent: 'center' },
  codeBox: { flexShrink: 1 },
  codeLabel: { color: mw.muted, fontSize: scaledPixels(26) },
  code: { color: mw.text, fontSize: scaledPixels(92), fontWeight: '900', letterSpacing: scaledPixels(6) },
  url: { color: mw.muted, fontSize: scaledPixels(22), marginTop: scaledPixels(8) },
  status: { alignSelf: 'flex-start', marginTop: scaledPixels(36), paddingVertical: scaledPixels(14), paddingHorizontal: scaledPixels(28), borderRadius: scaledPixels(999) },
  statusOk: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  statusWait: { backgroundColor: 'rgba(251, 191, 36, 0.15)' },
  statusText: { fontSize: scaledPixels(34), fontWeight: '800' },
  error: { color: mw.danger, fontSize: scaledPixels(24), marginTop: scaledPixels(12) },
  muted: { color: mw.muted, fontSize: scaledPixels(24) },
  laptopHint: { marginTop: scaledPixels(28) },
  stepsTitle: { color: mw.text, fontSize: scaledPixels(36), fontWeight: '800', marginBottom: scaledPixels(20) },
  step: { flexDirection: 'row', alignItems: 'center', backgroundColor: mw.card, borderRadius: scaledPixels(20), padding: scaledPixels(22), marginBottom: scaledPixels(16) },
  stepNumber: { width: scaledPixels(56), height: scaledPixels(56), borderRadius: scaledPixels(28), backgroundColor: mw.accent, alignItems: 'center', justifyContent: 'center', marginRight: scaledPixels(22) },
  stepNumberText: { color: mw.onAccent, fontSize: scaledPixels(28), fontWeight: '900' },
  stepText: { color: mw.text, fontSize: scaledPixels(28), flexShrink: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', marginTop: scaledPixels(24) },
  liveRow: { flexDirection: 'row', alignItems: 'flex-start' },
  liveInfo: { marginLeft: scaledPixels(32), flexShrink: 1 },
  liveLabel: { color: mw.ok, fontSize: scaledPixels(28), fontWeight: '700' },
  exercise: { color: mw.text, fontSize: scaledPixels(32), fontWeight: '700', marginTop: scaledPixels(24) },
  count: { color: mw.accent, fontSize: scaledPixels(120), fontWeight: '900', lineHeight: scaledPixels(130) },
  result: { color: mw.ok, fontSize: scaledPixels(30), fontWeight: '800', marginTop: scaledPixels(8) },
  cue: { color: mw.text, fontSize: scaledPixels(26), marginTop: scaledPixels(12) },
  howTo: { marginBottom: scaledPixels(8) },
  howToLabel: { color: mw.accent, fontSize: scaledPixels(24), fontWeight: '800', letterSpacing: 1 },
  howToName: { color: mw.text, fontSize: scaledPixels(44), fontWeight: '800', marginBottom: scaledPixels(16) },
  howToTip: { color: mw.text, fontSize: scaledPixels(26), marginTop: scaledPixels(4) },
  howToCamera: { color: mw.muted, fontSize: scaledPixels(24), marginTop: scaledPixels(10) },
  needBanner: { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderRadius: scaledPixels(18), padding: scaledPixels(18), marginTop: scaledPixels(20) },
  needText: { color: mw.warn, fontSize: scaledPixels(28), fontWeight: '700' },
  safety: { backgroundColor: mw.danger, borderRadius: scaledPixels(18), padding: scaledPixels(20), marginTop: scaledPixels(20) },
  safetyText: { color: mw.white, fontSize: scaledPixels(30), fontWeight: '800' },
  fineprint: { color: mw.muted, fontSize: scaledPixels(20), marginTop: scaledPixels(28) },
});
