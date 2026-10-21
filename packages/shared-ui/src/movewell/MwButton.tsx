// Remote-friendly button: big target, warm accent focus with a clear outline and slight scale.
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { accentGradient, gradient, mw } from './theme';

const DANGER = gradient(mw.danger, '#B91C1C', 120);

interface Props {
  label: string;
  onSelect: () => void;
  tone?: 'normal' | 'danger';
}

export default function MwButton({ label, onSelect, tone = 'normal' }: Props) {
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {/* A plain View: the focusable wrapper already handles remote "select" and, on web, mouse clicks
          (a Pressable here would nest one <button> inside another on web). */}
      {({ isFocused }) => (
        <View
          // On web the focusable wrapper is already the <button>; a second button role would nest buttons.
          accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
          accessibilityLabel={label}
          style={[styles.button, tone === 'danger' && styles.danger, isFocused && [tone === 'danger' ? DANGER : accentGradient, styles.focused]]}
        >
          <Text style={[styles.label, isFocused && styles.labelFocused]}>{label}</Text>
        </View>
      )}
    </SpatialNavigationFocusableView>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: mw.glass,
    borderRadius: scaledPixels(999),
    borderWidth: scaledPixels(3),
    borderColor: mw.line,
    paddingVertical: scaledPixels(18),
    paddingHorizontal: scaledPixels(34),
    marginRight: scaledPixels(20),
    minHeight: scaledPixels(72),
    justifyContent: 'center',
  },
  danger: {
    backgroundColor: '#5A1A26',
  },
  focused: {
    borderColor: mw.white,
    transform: [{ scale: 1.06 }],
    shadowColor: mw.accent2,
    shadowOpacity: 0.5,
    shadowRadius: scaledPixels(18),
    elevation: 8,
  },
  label: {
    color: mw.text,
    fontSize: scaledPixels(28),
    fontWeight: '700',
  },
  labelFocused: {
    color: mw.onAccent,
  },
});
