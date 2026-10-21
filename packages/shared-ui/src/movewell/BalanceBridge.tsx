// Balance Bridge: hold your balance and the walker crosses the bridge; wobble and the bridge sways;
// put your foot down and the walker waits (no penalty). Plus the 30-second chair-stand test panel.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { mw } from './theme';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';
const PLANKS = 14;

interface BridgeProps {
  progress: number; // 0..1 of the hold target
  holding: boolean;
  wobble: number; // 0..1
  pixelWidth: number; // measured on screen by the caller
}

export default function BalanceBridge({ progress, holding, wobble, pixelWidth }: BridgeProps) {
  const w = pixelWidth;
  const h = w * 0.46;
  const walker = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const swayLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.timing(walker, { toValue: Math.min(1, progress), duration: 900, easing: Easing.out(Easing.quad), useNativeDriver }).start();
  }, [progress, walker]);

  // More wobble = a bigger, faster sway.
  useEffect(() => {
    swayLoop.current?.stop();
    const amount = holding ? Math.max(0.08, wobble) : 0.05;
    const duration = 900 - amount * 400;
    swayLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: amount, duration, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(sway, { toValue: -amount, duration, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    swayLoop.current.start();
    return () => swayLoop.current?.stop();
  }, [holding, wobble, sway]);

  const bridgeLeft = w * 0.18;
  const bridgeWidth = w * 0.64;
  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const walkerX = walker.interpolate({ inputRange: [0, 1], outputRange: [bridgeLeft - w * 0.08, bridgeLeft + bridgeWidth - w * 0.02] });
  const steady = wobble < 0.35;

  return (
    <View style={{ width: w }}>
      <View style={[styles.scene, { width: w, height: h }]}>
        <View style={[styles.valley, { top: h * 0.62 }]}>
          <Text style={[styles.river, { fontSize: s(40) }]}>🌊 🌊 🌊 🌊</Text>
        </View>
        <View style={[styles.cliff, { left: 0, width: bridgeLeft, top: h * 0.5 }]} />
        <View style={[styles.cliff, { right: 0, width: w - bridgeLeft - bridgeWidth, top: h * 0.5 }]}>
          <Text style={[styles.flag, { fontSize: s(56) }]}>🏁</Text>
        </View>
        <Animated.View style={[styles.bridge, { left: bridgeLeft, width: bridgeWidth, top: h * 0.47, transform: [{ rotate }] }]}>
          <View style={styles.rope} />
          <View style={styles.planks}>
            {Array.from({ length: PLANKS }, (_, i) => (
              <View key={i} style={[styles.plank, { width: bridgeWidth / PLANKS - s(6) }]} />
            ))}
          </View>
        </Animated.View>
        <Animated.Text style={[styles.walker, { top: h * 0.24, fontSize: s(110), transform: [{ translateX: walkerX }, { rotate }] }]}>
          {holding ? '🚶' : '🧍'}
        </Animated.Text>
      </View>
      <View style={styles.meterRow}>
        <Text style={[styles.state, { color: holding ? mw.ok : mw.warn }]}>
          {holding ? (steady ? 'Steady! Keep holding' : 'A bit wobbly. Hold the chair if you need it') : 'Foot down. Lift it again when you are ready'}
        </Text>
        <View style={styles.meterTrack} accessibilityLabel={`Wobble ${Math.round(wobble * 100)} percent`}>
          <View style={[styles.meterFill, { width: `${Math.round(wobble * 100)}%`, backgroundColor: steady ? mw.ok : wobble < 0.65 ? mw.warn : mw.danger }]} />
        </View>
        <Text style={styles.meterLabel}>Wobble</Text>
      </View>
    </View>
  );
}

/** 30-second chair-stand test: big countdown and stand count. */
export function ChairStandPanel({ secondsLeft, stands, started }: { secondsLeft: number; stands: number; started: boolean }) {
  return (
    <View style={styles.chair}>
      <Text style={styles.chairIcon}>🪑</Text>
      <Text style={styles.chairTitle}>30-second chair-stand test</Text>
      <Text style={styles.timer}>{started ? `${secondsLeft}s` : 'Ready?'}</Text>
      <Text style={styles.stands}>
        {stands} <Text style={styles.standsLabel}>stands</Text>
      </Text>
      <Text style={styles.chairNote}>A simple check of leg strength used in fall-risk screening. We track it week by week.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { borderRadius: s(32), overflow: 'hidden', backgroundColor: '#7DD3FC' },
  valley: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#1D4ED8', alignItems: 'center', paddingTop: s(30) },
  river: { color: '#FFFFFF' },
  cliff: { position: 'absolute', bottom: 0, backgroundColor: '#65A30D', borderTopLeftRadius: s(20), borderTopRightRadius: s(20), alignItems: 'center' },
  flag: { marginTop: -s(64) },
  bridge: { position: 'absolute' },
  rope: { height: s(6), backgroundColor: '#78350F', borderRadius: s(3), marginBottom: s(30) },
  planks: { flexDirection: 'row', justifyContent: 'space-between' },
  plank: { height: s(22), backgroundColor: '#B45309', borderRadius: s(4) },
  walker: { position: 'absolute', left: 0 },
  meterRow: { marginTop: s(16) },
  state: { fontSize: s(32), fontWeight: '800' },
  meterTrack: { height: s(18), backgroundColor: mw.card, borderRadius: s(9), overflow: 'hidden', marginTop: s(12) },
  meterFill: { height: '100%' },
  meterLabel: { color: mw.muted, fontSize: s(22), marginTop: s(6) },
  chair: { backgroundColor: mw.card, borderRadius: s(32), padding: s(32), alignItems: 'center', alignSelf: 'stretch' },
  chairIcon: { fontSize: s(90) },
  chairTitle: { color: mw.text, fontSize: s(36), fontWeight: '800', marginTop: s(4) },
  timer: { color: mw.accent, fontSize: s(120), fontWeight: '900', lineHeight: s(130) },
  stands: { color: mw.text, fontSize: s(72), fontWeight: '900' },
  standsLabel: { color: mw.muted, fontSize: s(36), fontWeight: '700' },
  chairNote: { color: mw.muted, fontSize: s(24), marginTop: s(16), textAlign: 'center' },
});
