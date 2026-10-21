// Floor Is Lava (kids): the avatar hops from stone to stone across bubbling lava as the child side-steps
// and does small frog hops. Each stone reached earns a star; the last one is the cool blue river.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';
const STONES = 5; // start + 3 stepping stones + the river

interface Props {
  chapter: number; // 0..3; 4 = safe at the river
  progress: number; // 0..1 within the current move
  avatar: string;
  pixelWidth: number;
}

export default function FloorIsLava({ chapter, progress, avatar, pixelWidth }: Props) {
  const w = pixelWidth;
  const h = w * 0.5;
  const pos = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const target = Math.min(STONES - 1, chapter + Math.min(1, Math.max(0, progress)));

  useEffect(() => {
    Animated.timing(pos, { toValue: target, duration: 800, easing: Easing.out(Easing.back(1.3)), useNativeDriver }).start();
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 200, useNativeDriver }),
      Animated.timing(hop, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver }),
    ]).start();
  }, [target, pos, hop]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const stoneX = (i: number) => w * (0.1 + (0.8 * i) / (STONES - 1));
  const stoneY = h * 0.62;
  const avatarSize = s(80);
  const inputRange = Array.from({ length: STONES }, (_, i) => i);
  const translateX = pos.interpolate({ inputRange, outputRange: inputRange.map((i) => stoneX(i) - avatarSize / 2) });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -s(50)] });
  const lavaOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  return (
    <View style={[styles.scene, { width: w, height: h }]}>
      <Text style={[styles.volcano, { left: w * 0.04, top: h * 0.1 }]}>🌋</Text>
      <Text style={[styles.flame, { left: w * 0.62, top: h * 0.2 }]}>🔥</Text>
      <Text style={[styles.flame, { left: w * 0.78, top: h * 0.12 }]}>🔥</Text>
      <Animated.View style={[styles.lava, { opacity: lavaOpacity }]} />
      {[0.15, 0.4, 0.62, 0.85].map((x, i) => (
        <Text key={x} style={[styles.bubble, { left: w * x, top: h * (0.78 + (i % 2) * 0.08) }]}>
          🫧
        </Text>
      ))}
      <View style={[styles.river, { width: w * 0.2 }]}>
        <Text style={styles.riverText}>Cool river 💧</Text>
      </View>
      {Array.from({ length: STONES }, (_, i) => {
        const reached = i <= chapter;
        const last = i === STONES - 1;
        return (
          <View
            key={i}
            style={[styles.stone, { left: stoneX(i) - s(56), top: stoneY - s(22) }, last && styles.stoneRiver, reached && !last && styles.stoneReached]}
          >
            {i > 0 && reached ? <Text style={styles.star}>⭐</Text> : null}
          </View>
        );
      })}
      <Animated.Text style={[styles.avatar, { top: stoneY - avatarSize * 1.15, fontSize: avatarSize, transform: [{ translateX }, { translateY: hopY }] }]}>
        {avatar}
      </Animated.Text>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{chapter >= 4 ? 'Safe! The lava cooled down 🎉' : 'The floor is lava! 🌋'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { backgroundColor: '#7C2D12', borderRadius: s(32), overflow: 'hidden', borderWidth: s(6), borderColor: '#431407' },
  lava: { position: 'absolute', left: 0, right: 0, top: '45%', bottom: 0, backgroundColor: '#EA580C' },
  bubble: { position: 'absolute', fontSize: s(34), opacity: 0.6 },
  volcano: { position: 'absolute', fontSize: s(120) },
  flame: { position: 'absolute', fontSize: s(56), opacity: 0.85 },
  river: { position: 'absolute', right: 0, top: '45%', bottom: 0, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: s(10) },
  riverText: { color: '#FFFFFF', fontSize: s(22), fontWeight: '800' },
  stone: { position: 'absolute', width: s(112), height: s(44), borderRadius: s(22), backgroundColor: '#57534E', borderWidth: s(4), borderColor: '#292524', alignItems: 'center' },
  stoneReached: { backgroundColor: '#78716C', borderColor: '#FDE68A' },
  stoneRiver: { backgroundColor: '#22C55E', borderColor: '#BBF7D0' },
  star: { position: 'absolute', top: -s(40), fontSize: s(32) },
  avatar: { position: 'absolute', left: 0 },
  banner: { position: 'absolute', top: s(18), alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: s(999), paddingHorizontal: s(26), paddingVertical: s(8) },
  bannerText: { color: '#FFFFFF', fontSize: s(34), fontWeight: '900' },
});
