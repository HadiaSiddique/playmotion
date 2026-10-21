// Freeze Dance (kids): a disco floor that flashes while you dance, then "FREEZE!" and the lights stop
// while you hold still like a statue. No music (no copyrighted tracks): the beat is visual.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';
const TILE_COLORS = ['#F472B6', '#A78BFA', '#38BDF8', '#34D399', '#FBBF24', '#FB923C'];

interface Props {
  freeze: boolean; // this move is a "freeze" (hold still)
  holding: boolean; // still right now
  chapter: number; // 0..3; 4 = finished
  progress: number;
  avatar: string;
  pixelWidth: number;
}

export default function FreezeDance({ freeze, holding, chapter, progress, avatar, pixelWidth }: Props) {
  const w = pixelWidth;
  const h = w * 0.56;
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (freeze) {
      beat.stopAnimation();
      beat.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver }),
        Animated.timing(beat, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [freeze, beat]);

  const cols = 6;
  const rows = 3;
  const tileW = w / cols;
  const floorTop = h * 0.55;
  const tileH = (h - floorTop) / rows;
  const bounce = beat.interpolate({ inputRange: [0, 1], outputRange: [0, -s(28)] });
  const sway = beat.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });
  const done = chapter >= 4;

  return (
    <View style={[styles.stage, { width: w, height: h }]}>
      {/* spotlights */}
      {[0.2, 0.5, 0.8].map((x, i) => (
        <Animated.View
          key={x}
          style={[styles.light, { left: w * x - s(60), backgroundColor: TILE_COLORS[i * 2], opacity: freeze ? 0.12 : beat.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.55] }) }]}
        />
      ))}
      {/* dance floor */}
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const lit = (r + c + chapter) % 2 === 0;
        return (
          <Animated.View
            key={i}
            style={[
              styles.tile,
              {
                left: c * tileW,
                top: floorTop + r * tileH,
                width: tileW - 2,
                height: tileH - 2,
                backgroundColor: freeze ? '#475569' : TILE_COLORS[(i + chapter) % TILE_COLORS.length],
                opacity: freeze ? 0.6 : lit ? beat.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) : beat.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
              },
            ]}
          />
        );
      })}
      <Animated.Text
        style={[styles.avatar, { left: w / 2 - s(60), top: floorTop - s(120), transform: freeze ? [] : [{ translateY: bounce }, { rotate: sway }] }]}
      >
        {avatar}
      </Animated.Text>
      {freeze && !done ? (
        <View style={[styles.banner, holding && styles.bannerOk]}>
          <Text style={styles.bannerText}>{holding ? 'Statue! ⭐' : 'FREEZE! ❄️'}</Text>
        </View>
      ) : (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{done ? 'Best statues ever! 🏆' : 'Dance! 🎶'}</Text>
        </View>
      )}
      <View style={styles.stars}>
        {[0, 1, 2, 3].map((i) => (
          <Text key={i} style={[styles.star, i >= chapter && !(i === chapter && progress >= 1) && styles.starOff]}>
            ⭐
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#1E1B4B', borderRadius: s(32), overflow: 'hidden', borderWidth: s(6), borderColor: '#4C1D95' },
  light: { position: 'absolute', top: -s(40), width: s(120), height: '70%', borderBottomLeftRadius: s(80), borderBottomRightRadius: s(80) },
  tile: { position: 'absolute', borderRadius: s(6) },
  avatar: { position: 'absolute', fontSize: s(120) },
  banner: { position: 'absolute', top: s(18), alignSelf: 'center', backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: s(999), paddingHorizontal: s(28), paddingVertical: s(8) },
  bannerOk: { backgroundColor: '#16A34A' },
  bannerText: { color: '#FFFFFF', fontSize: s(40), fontWeight: '900' },
  stars: { position: 'absolute', right: s(16), top: s(16), flexDirection: 'row' },
  star: { fontSize: s(34), marginLeft: s(4) },
  starOff: { opacity: 0.25 },
});
