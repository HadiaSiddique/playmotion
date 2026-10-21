// The Couch Monster: an original cartoon boss drawn with plain Views and animated with the core Animated API.
// Every counted rep is a hit: the boss shakes, flashes, and a damage number floats up.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { mw } from './theme';

const s = scaledPixels;
const useNativeDriver = Platform.OS !== 'web';

interface Props {
  hp: number;
  maxHp: number;
  hitKey: number; // increments on every hit
  lastDamage: number;
  combo: number;
  defeated: boolean;
  size?: number; // design pixels
}

export default function BossBattle({ hp, maxHp, hitKey, lastDamage, combo, defeated, size = 440 }: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    if (!hitKey) return;
    shake.setValue(0);
    flash.setValue(1);
    pop.setValue(0);
    Animated.parallel([
      Animated.sequence(
        [12, -12, 9, -9, 4, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver })),
      ),
      Animated.timing(flash, { toValue: 0, duration: 280, useNativeDriver }),
      Animated.timing(pop, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver }),
    ]).start();
  }, [hitKey, shake, flash, pop]);

  const w = s(size);
  const pct = Math.max(0, hp / Math.max(1, maxHp));
  const barColor = pct > 0.5 ? mw.ok : pct > 0.2 ? mw.warn : mw.danger;
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, defeated ? 0 : -s(14)] });
  const popY = pop.interpolate({ inputRange: [0, 1], outputRange: [0, -s(120)] });
  const popOpacity = pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

  return (
    <View style={{ width: w, alignItems: 'center' }}>
      <Text style={styles.name}>{defeated ? 'Couch Monster is defeated!' : 'Couch Monster'}</Text>
      <View style={[styles.hpTrack, { width: w }]} accessibilityLabel={`Boss health ${Math.round(pct * 100)} percent`}>
        <View style={[styles.hpFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.hpText}>
        {Math.max(0, Math.round(hp))} / {maxHp} HP
      </Text>

      <View style={{ width: w, height: w * 1.05, marginTop: s(10) }}>
        <Animated.View style={{ transform: [{ translateY }, { translateX: shake }, { rotate: defeated ? '-14deg' : '0deg' }], opacity: defeated ? 0.55 : 1 }}>
          {/* horns */}
          <View style={[styles.horn, { left: w * 0.2, borderBottomWidth: w * 0.16, borderLeftWidth: w * 0.06, borderRightWidth: w * 0.06 }]} />
          <View style={[styles.horn, { right: w * 0.2, borderBottomWidth: w * 0.16, borderLeftWidth: w * 0.06, borderRightWidth: w * 0.06 }]} />
          {/* body */}
          <View style={[styles.body, { width: w, height: w * 0.78, borderTopLeftRadius: w * 0.5, borderTopRightRadius: w * 0.5, borderBottomLeftRadius: w * 0.22, borderBottomRightRadius: w * 0.22, marginTop: w * 0.12 }]}>
            {/* brows */}
            <View style={styles.faceRow}>
              <View style={[styles.brow, { width: w * 0.2, height: w * 0.045, transform: [{ rotate: '18deg' }] }]} />
              <View style={[styles.brow, { width: w * 0.2, height: w * 0.045, transform: [{ rotate: '-18deg' }] }]} />
            </View>
            {/* eyes */}
            <View style={styles.faceRow}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.eye, { width: w * 0.2, height: w * 0.2, borderRadius: w * 0.1 }]}>
                  {defeated ? (
                    <Text style={[styles.xEye, { fontSize: w * 0.12 }]}>✕</Text>
                  ) : (
                    <View style={[styles.pupil, { width: w * 0.08, height: w * 0.08, borderRadius: w * 0.04 }]} />
                  )}
                </View>
              ))}
            </View>
            {/* mouth with teeth */}
            <View style={[styles.mouth, { width: w * 0.46, height: w * 0.13, borderRadius: w * 0.06 }]}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.tooth, { width: w * 0.05, height: w * 0.05 }]} />
              ))}
            </View>
          </View>
          {/* the couch it refuses to leave */}
          <View style={[styles.couch, { width: w * 1.05, height: w * 0.14, borderRadius: w * 0.05, marginLeft: -w * 0.025 }]} />
          {/* hit flash */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
        </Animated.View>

        {hitKey ? (
          <Animated.View pointerEvents="none" style={[styles.popWrap, { transform: [{ translateY: popY }], opacity: popOpacity }]}>
            <Text style={styles.damage}>-{lastDamage}</Text>
            {combo >= 2 ? <Text style={styles.combo}>COMBO ×{combo}</Text> : null}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { color: mw.text, fontSize: s(34), fontWeight: '900', marginBottom: s(10) },
  hpTrack: { height: s(28), backgroundColor: mw.card, borderRadius: s(14), overflow: 'hidden', borderWidth: s(3), borderColor: mw.cardRaised },
  hpFill: { height: '100%' },
  hpText: { color: mw.muted, fontSize: s(22), marginTop: s(6) },
  horn: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F5D0FE',
    borderStyle: 'solid',
  },
  body: { backgroundColor: '#7C3AED', alignItems: 'center', paddingTop: s(40), borderWidth: s(6), borderColor: '#5B21B6' },
  faceRow: { flexDirection: 'row', justifyContent: 'center', gap: s(60) },
  brow: { backgroundColor: '#2E1065', borderRadius: s(6), marginBottom: s(6) },
  eye: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pupil: { backgroundColor: '#1E1B4B' },
  xEye: { color: '#1E1B4B', fontWeight: '900' },
  mouth: { backgroundColor: '#2E1065', marginTop: s(26), flexDirection: 'row', justifyContent: 'space-around', overflow: 'hidden' },
  tooth: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: s(4), borderBottomRightRadius: s(4) },
  couch: { backgroundColor: '#B45309', borderWidth: s(5), borderColor: '#78350F', marginTop: -s(10) },
  flash: { backgroundColor: '#FFFFFF', borderRadius: s(40) },
  popWrap: { position: 'absolute', top: '22%', alignSelf: 'center', alignItems: 'center' },
  damage: { color: mw.accent, fontSize: s(96), fontWeight: '900', textShadowColor: '#000', textShadowRadius: s(8) },
  combo: { color: mw.warn, fontSize: s(40), fontWeight: '900' },
});
