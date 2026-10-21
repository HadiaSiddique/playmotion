// Garden Grow: one plant per move. Every rep waters it (a drop falls from a rain cloud) and it grows
// from seed to sunflower as the move fills up. Gentle, no fail state: every rep makes something grow.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';
const STAGES = ['🌰', '🌱', '🌿', '🪴', '🌷', '🌻'];

interface Props {
  moveIndex: number;
  moveCount: number;
  progress: number; // 0..1 within the current move
  count: number; // reps so far in this move (each one waters the plant)
  pixelWidth: number;
}

export default function GardenGrow({ moveIndex, moveCount, progress, count, pixelWidth }: Props) {
  const w = pixelWidth;
  const h = w * 0.56;
  const drop = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0)).current;
  const lastCount = useRef(count);

  useEffect(() => {
    if (count > lastCount.current) {
      drop.setValue(0);
      Animated.timing(drop, { toValue: 1, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver }).start();
      grow.setValue(0);
      Animated.spring(grow, { toValue: 1, friction: 3, useNativeDriver }).start();
    }
    lastCount.current = count;
  }, [count, drop, grow]);

  const slots = Math.max(1, moveCount);
  const slotW = w / slots;
  const stageOf = (i: number) => (i < moveIndex ? STAGES.length - 1 : i === moveIndex ? Math.min(STAGES.length - 1, Math.floor(progress * (STAGES.length - 1) + 0.0001)) : 0);
  const plantSize = Math.min(s(120), slotW * 0.55);
  const dropY = drop.interpolate({ inputRange: [0, 1], outputRange: [h * 0.18, h * 0.58] });
  const dropOpacity = drop.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
  const pop = grow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] });
  const currentX = slotW * (Math.min(moveIndex, slots - 1) + 0.5);

  return (
    <View style={[styles.scene, { width: w, height: h }]}>
      <View style={[styles.sun, { left: w * 0.06, top: h * 0.07, width: s(86), height: s(86), borderRadius: s(43) }]} />
      <Text style={[styles.cloud, { left: w * 0.6, top: h * 0.05 }]}>☁️</Text>
      <View style={[styles.soil, { height: h * 0.3 }]} />
      <View style={[styles.grass, { top: h * 0.68 }]} />

      {Array.from({ length: slots }, (_, i) => {
        const stage = stageOf(i);
        const current = i === moveIndex;
        return (
          <View key={i} style={[styles.slot, { left: slotW * i, width: slotW, bottom: h * 0.18 }]}>
            <Animated.Text style={{ fontSize: plantSize * (0.6 + stage * 0.1), transform: current ? [{ scale: pop }] : [] }}>{STAGES[stage]}</Animated.Text>
            <View style={[styles.label, current && styles.labelNow]}>
              <Text style={styles.labelText}>{i < moveIndex ? 'Grown! 🌟' : current ? `${Math.round(progress * 100)}%` : 'Next'}</Text>
            </View>
          </View>
        );
      })}

      {moveIndex < slots ? (
        <>
          <Text style={[styles.can, { left: currentX - s(34), top: h * 0.04 }]}>🌧️</Text>
          <Animated.Text style={[styles.drop, { left: currentX - s(12), opacity: dropOpacity, transform: [{ translateY: dropY }] }]}>💧</Animated.Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { backgroundColor: '#BAE6FD', borderRadius: s(32), overflow: 'hidden', borderWidth: s(6), borderColor: '#0EA5E9' },
  sun: { position: 'absolute', backgroundColor: '#FACC15' },
  cloud: { position: 'absolute', fontSize: s(70) },
  soil: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#92400E' },
  grass: { position: 'absolute', left: 0, right: 0, height: s(18), backgroundColor: '#16A34A' },
  slot: { position: 'absolute', alignItems: 'center' },
  label: { marginTop: s(6), backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: s(999), paddingHorizontal: s(14), paddingVertical: s(4) },
  labelNow: { backgroundColor: '#16A34A' },
  labelText: { color: '#FFFFFF', fontSize: s(22), fontWeight: '800' },
  can: { position: 'absolute', fontSize: s(56) },
  drop: { position: 'absolute', top: 0, fontSize: s(36) },
});
