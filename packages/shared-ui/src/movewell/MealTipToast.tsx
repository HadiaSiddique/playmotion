// Shows meal-photo tips from the phone on the TV, over whatever screen is open, for 20 seconds.
// Only the tip text arrives here; the photo is never sent to the TV.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { usePhoneEvents } from './PairingContext';
import { mw } from './theme';

const s = scaledPixels;
const SHOW_MS = 20_000;

interface Tip {
  looksLike?: string | null;
  positives?: string[];
  tips?: string[];
  swap?: string | null;
  waterNudge?: string | null;
}

export default function MealTipToast() {
  const [tip, setTip] = useState<Tip | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePhoneEvents((e) => {
    if (e.event !== 'meal' || !e.payload) return;
    setTip(e.payload as Tip);
  });

  useEffect(() => {
    if (!tip) return undefined;
    const useNativeDriver = Platform.OS !== 'web';
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver }).start(() => setTip(null));
    }, SHOW_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tip, opacity]);

  if (!tip) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
      <Text style={styles.label}>🍽️ Meal tip from your phone</Text>
      {tip.looksLike ? <Text style={styles.title}>{tip.looksLike}</Text> : null}
      {tip.positives?.slice(0, 1).map((p) => (
        <Text key={p} style={styles.good}>
          ✓ {p}
        </Text>
      ))}
      {tip.tips?.slice(0, 3).map((t) => (
        <Text key={t} style={styles.line}>
          • {t}
        </Text>
      ))}
      {tip.swap ? <Text style={styles.line}>🔁 {tip.swap}</Text> : null}
      {tip.waterNudge ? <Text style={styles.line}>💧 {tip.waterNudge}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.small}>Gentle tips, not medical or dietary advice.</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: s(40),
    right: s(60),
    width: s(620),
    backgroundColor: mw.cardRaised,
    borderRadius: s(28),
    padding: s(28),
    borderWidth: s(4),
    borderColor: mw.ok,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: s(20),
    elevation: 12,
  },
  label: { color: mw.ok, fontSize: s(24), fontWeight: '800' },
  title: { color: mw.text, fontSize: s(36), fontWeight: '800', marginTop: s(6) },
  good: { color: mw.ok, fontSize: s(24), marginTop: s(8) },
  line: { color: mw.text, fontSize: s(26), marginTop: s(8) },
  footer: { marginTop: s(14) },
  small: { color: mw.muted, fontSize: s(18) },
});
