// Pop the Bubbles: one bubble per rep. The next bubble swells as you reach (the phone's live 0..1 signal)
// and pops with a sparkle on each counted rep. Gentle reach-and-shift game with no fail state.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';
const COLORS = ['#7DD3FC', '#F9A8D4', '#C4B5FD', '#86EFAC', '#FDE68A', '#FDBA74'];

interface Props {
  count: number; // reps done in this move
  target: number;
  signal: number; // 0 = rest, 1 = top of the move
  pixelWidth: number;
}

// Fixed "random" spots so bubbles don't jump around between renders.
const spot = (i: number) => ({ x: 0.1 + ((i * 0.37) % 0.8), y: 0.14 + ((i * 0.53) % 0.62) });

export default function PopBubbles({ count, target, signal, pixelWidth }: Props) {
  const w = pixelWidth;
  const h = w * 0.58;
  const bob = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const lastCount = useRef(count);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    if (count > lastCount.current) {
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver }).start();
    }
    lastCount.current = count;
  }, [count, burst]);

  const size = Math.min(s(130), w / 6);
  const floatY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -s(14)] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] });
  const popped = Math.min(count, target);
  const lastPopped = popped - 1;

  return (
    <View style={[styles.sky, { width: w, height: h }]}>
      <View style={[styles.sun, { left: w * 0.82, top: h * 0.08, width: s(90), height: s(90), borderRadius: s(45) }]} />
      <Text style={[styles.cloud, { left: w * 0.06, top: h * 0.06 }]}>☁️</Text>
      <Text style={[styles.cloud, { left: w * 0.55, top: h * 0.02 }]}>☁️</Text>
      <View style={[styles.grass, { height: h * 0.14 }]} />

      {Array.from({ length: target }, (_, i) => {
        const { x, y } = spot(i);
        const isNext = i === popped;
        const left = x * (w - size);
        const top = y * (h - size * 1.2);
        if (i < popped) {
          // Popped: a sparkle burst for the latest one, a tiny star where the others were.
          return i === lastPopped ? (
            <Animated.Text key={i} style={[styles.burst, { left, top, fontSize: size * 0.7, opacity: burstOpacity, transform: [{ scale: burstScale }] }]}>
              ✨
            </Animated.Text>
          ) : (
            <Text key={i} style={[styles.done, { left: left + size * 0.35, top: top + size * 0.35, fontSize: size * 0.25 }]}>
              ⭐
            </Text>
          );
        }
        const grow = isNext ? 1 + Math.max(0, Math.min(1, signal)) * 0.35 : 1;
        const color = COLORS[i % COLORS.length];
        return (
          <Animated.View
            key={i}
            style={[
              styles.bubble,
              {
                left,
                top,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: `${color}55`,
                borderColor: isNext ? '#FFFFFF' : color,
                borderWidth: isNext ? s(6) : s(4),
                transform: [{ translateY: floatY }, { scale: grow }],
              },
            ]}
          >
            <View style={[styles.shine, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11 }]} />
          </Animated.View>
        );
      })}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          🫧 {popped} / {target} popped
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { backgroundColor: '#3B82F6', borderRadius: s(32), overflow: 'hidden', borderWidth: s(6), borderColor: '#1D4ED8' },
  sun: { position: 'absolute', backgroundColor: '#FDE047' },
  cloud: { position: 'absolute', fontSize: s(70), opacity: 0.9 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#22C55E' },
  bubble: { position: 'absolute' },
  shine: { position: 'absolute', top: '18%', left: '20%', backgroundColor: 'rgba(255,255,255,0.85)' },
  burst: { position: 'absolute' },
  done: { position: 'absolute', opacity: 0.8 },
  counter: { position: 'absolute', right: s(16), bottom: s(14), backgroundColor: 'rgba(15,23,42,0.55)', borderRadius: s(999), paddingHorizontal: s(18), paddingVertical: s(6) },
  counterText: { color: '#FFFFFF', fontSize: s(24), fontWeight: '800' },
});
