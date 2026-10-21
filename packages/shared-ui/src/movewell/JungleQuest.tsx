// Jungle Quest map: the child's avatar walks from stop to stop as they move. Each stop reached earns a star.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { mw } from './theme';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';

export const JUNGLE_STOPS = [
  { icon: '🐸', label: 'River' },
  { icon: '🦩', label: 'Wobbly log' },
  { icon: '🐻', label: 'Bear cave' },
  { icon: '🦀', label: 'Sandy beach' },
  { icon: '💎', label: 'Treasure' },
];

interface Props {
  chapter: number; // current move (0..3); 4 = treasure reached
  progress: number; // 0..1 within the current move
  avatar: string; // emoji
  pixelWidth: number;
}

export default function JungleQuest({ chapter, progress, avatar, pixelWidth }: Props) {
  const w = pixelWidth;
  const h = w * 0.5;
  const pos = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const target = Math.min(JUNGLE_STOPS.length - 1, chapter + Math.min(1, Math.max(0, progress)));

  useEffect(() => {
    Animated.timing(pos, { toValue: target, duration: 900, easing: Easing.out(Easing.back(1.4)), useNativeDriver }).start();
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 180, useNativeDriver }),
      Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver }),
    ]).start();
  }, [target, pos, hop]);

  // Stops sit on a gentle zig-zag path across the map.
  const stopX = (i: number) => w * (0.08 + (0.84 * i) / (JUNGLE_STOPS.length - 1));
  const stopY = (i: number) => h * (i % 2 === 0 ? 0.62 : 0.38);
  const inputRange = JUNGLE_STOPS.map((_, i) => i);
  const avatarSize = s(84);
  const translateX = pos.interpolate({ inputRange, outputRange: inputRange.map((i) => stopX(i) - avatarSize / 2) });
  const translateY = pos.interpolate({ inputRange, outputRange: inputRange.map((i) => stopY(i) - avatarSize * 1.25) });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -s(30)] });

  return (
    <View style={[styles.map, { width: w, height: h }]}>
      {['🌴', '🌿', '🌴', '🍃', '🌴', '🌺'].map((tree, i) => (
        <Text key={i} style={[styles.tree, { left: w * (0.05 + i * 0.17), top: i % 2 ? h * 0.06 : h * 0.8, fontSize: s(48) }]}>
          {tree}
        </Text>
      ))}
      {/* path dots between stops */}
      {JUNGLE_STOPS.slice(0, -1).map((_, i) =>
        [0.25, 0.5, 0.75].map((f) => (
          <View
            key={`${i}-${f}`}
            style={[
              styles.dot,
              { left: stopX(i) + (stopX(i + 1) - stopX(i)) * f - s(6), top: stopY(i) + (stopY(i + 1) - stopY(i)) * f - s(6) },
              i < chapter && styles.dotDone,
            ]}
          />
        )),
      )}
      {JUNGLE_STOPS.map((stop, i) => {
        const reached = i <= chapter;
        const current = i === chapter + 1 && chapter < JUNGLE_STOPS.length - 1;
        return (
          <View key={stop.label} style={[styles.stop, { left: stopX(i) - s(52), top: stopY(i) - s(52) }, current && styles.stopNext, reached && styles.stopReached]}>
            <Text style={styles.stopIcon}>{stop.icon}</Text>
            <Text style={styles.stopLabel}>{stop.label}</Text>
            {i > 0 && i <= chapter ? <Text style={styles.star}>⭐</Text> : null}
          </View>
        );
      })}
      <Animated.Text style={[styles.avatar, { fontSize: avatarSize, transform: [{ translateX }, { translateY }, { translateY: hopY }] }]}>{avatar}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: '#166534', borderRadius: s(32), overflow: 'hidden', borderWidth: s(6), borderColor: '#14532D' },
  tree: { position: 'absolute', opacity: 0.9 },
  dot: { position: 'absolute', width: s(12), height: s(12), borderRadius: s(6), backgroundColor: 'rgba(255,255,255,0.35)' },
  dotDone: { backgroundColor: mw.warn },
  stop: {
    position: 'absolute',
    width: s(104),
    height: s(104),
    borderRadius: s(52),
    backgroundColor: '#15803D',
    borderWidth: s(5),
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNext: { borderColor: mw.warn, backgroundColor: '#16A34A' },
  stopReached: { borderColor: mw.white },
  stopIcon: { fontSize: s(48) },
  stopLabel: { position: 'absolute', bottom: -s(34), width: s(180), textAlign: 'center', color: mw.white, fontSize: s(20), fontWeight: '800' },
  star: { position: 'absolute', top: -s(18), right: -s(10), fontSize: s(34) },
  avatar: { position: 'absolute', left: 0, top: 0 },
});
