// Calm River: a boat drifts down a river towards a calm lake as you breathe and move. No fail state.
// A pacing ring (4 s in, 6 s out) guides the arms: up on the in-breath, down on the out-breath.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { mw } from './theme';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';
export const BREATH_IN_MS = 4000;
export const BREATH_OUT_MS = 6000;

interface Props {
  progress: number; // 0..1 across the whole session
  signal: number; // 0..1 how high the arms are (from the phone)
  pixelWidth: number; // measured on screen by the caller
  onBreath?: (phase: 'in' | 'out') => void;
}

export default function CalmRiver({ progress, signal, pixelWidth, onBreath }: Props) {
  const w = pixelWidth;
  const h = w * 0.46;
  const boatX = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(boatX, { toValue: Math.min(1, progress), duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver }).start();
  }, [progress, boatX]);

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
          Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        ]),
      ),
      Animated.loop(Animated.timing(ripple, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bob, ripple]);

  const boatW = w * 0.16;
  const translateX = boatX.interpolate({ inputRange: [0, 1], outputRange: [w * 0.04, w * 0.78] });
  // Arms up lifts the boat on a gentle swell.
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -s(10)] });
  const lift = -s(30) * Math.max(0, Math.min(1, signal));
  const rippleX = ripple.interpolate({ inputRange: [0, 1], outputRange: [0, -w * 0.25] });

  return (
    <View style={{ width: w }}>
      <View style={[styles.scene, { width: w, height: h }]}>
        <View style={[styles.sky, { height: h * 0.45 }]} />
        <View style={[styles.sun, { right: w * 0.1, top: h * 0.12, width: h * 0.22, height: h * 0.22, borderRadius: h * 0.11 }]} />
        <Text style={[styles.hills, { left: w * 0.05, top: h * 0.24, fontSize: s(70) }]}>⛰️  🌲🌲</Text>
        <View style={[styles.river, { top: h * 0.45, height: h * 0.55 }]}>
          <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: rippleX }] }}>
            {Array.from({ length: 16 }, (_, i) => (
              <View key={i} style={[styles.wave, { marginTop: s(30 + ((i * 37) % 140)), marginLeft: w * 0.08 }]} />
            ))}
          </Animated.View>
          <View style={[styles.lake, { width: w * 0.2 }]}>
            <Text style={[styles.lakeText, { fontSize: s(22) }]}>Calm lake</Text>
          </View>
        </View>
        <Animated.Text style={[styles.boat, { top: h * 0.5, fontSize: boatW, transform: [{ translateX }, { translateY }, { translateY: lift }] }]}>🛶</Animated.Text>
      </View>
      <View style={styles.bottomRow}>
        <BreathRing size={150} onBreath={onBreath} />
        <Text style={styles.progressText}>🛶 {Math.round(Math.min(1, progress) * 100)}% of the way{'\n'}to the calm lake</Text>
      </View>
    </View>
  );
}

/** Pacing ring: grows for 4 s (breathe in, arms up), shrinks for 6 s (breathe out, arms down). */
export function BreathRing({ size = 200, onBreath }: { size?: number; onBreath?: (phase: 'in' | 'out') => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const callback = useRef(onBreath);
  callback.current = onBreath;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: BREATH_IN_MS, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(scale, { toValue: 0.6, duration: BREATH_OUT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    let inPhase = true;
    callback.current?.('in');
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      inPhase = !inPhase;
      setPhase(inPhase ? 'in' : 'out');
      callback.current?.(inPhase ? 'in' : 'out');
      timer = setTimeout(tick, inPhase ? BREATH_IN_MS : BREATH_OUT_MS);
    };
    timer = setTimeout(tick, BREATH_IN_MS);
    return () => {
      loop.stop();
      clearTimeout(timer);
    };
  }, [scale]);

  return (
    <View style={styles.ringRow}>
      <Animated.View style={[styles.ring, { width: s(size), height: s(size), borderRadius: s(size / 2), transform: [{ scale }] }]} />
      <View style={styles.ringText}>
        <Text style={styles.breathWord}>{phase === 'in' ? 'Breathe in…' : 'Breathe out…'}</Text>
        <Text style={styles.breathHint}>{phase === 'in' ? 'Float your arms up slowly' : 'Let your arms drift down'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { borderRadius: s(32), overflow: 'hidden', backgroundColor: '#1E3A5F' },
  sky: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#F4A88A' },
  sun: { position: 'absolute', backgroundColor: '#FDE68A' },
  hills: { position: 'absolute' },
  river: { position: 'absolute', left: 0, right: 0, backgroundColor: '#2563EB', overflow: 'hidden' },
  wave: { width: s(70), height: s(6), borderRadius: s(3), backgroundColor: 'rgba(255,255,255,0.35)' },
  lake: { position: 'absolute', right: 0, top: 0, bottom: 0, backgroundColor: '#60A5FA', alignItems: 'center', justifyContent: 'center' },
  lakeText: { color: '#0B1630', fontWeight: '800' },
  boat: { position: 'absolute', left: 0 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: s(20) },
  progressText: { color: mw.muted, fontSize: s(26), textAlign: 'right' },
  ringRow: { flexDirection: 'row', alignItems: 'center' },
  ring: { backgroundColor: '#A78BFA', opacity: 0.9 },
  ringText: { marginLeft: s(36) },
  breathWord: { color: mw.text, fontSize: s(48), fontWeight: '800' },
  breathHint: { color: mw.muted, fontSize: s(28), marginTop: s(6) },
});
