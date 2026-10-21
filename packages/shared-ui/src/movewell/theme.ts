// PlayMotion palette: calm dark navy with a warm accent and high contrast for 10-foot viewing,
// plus gradients and soft glows so screens feel lively rather than flat.
import { Platform, ViewStyle } from 'react-native';

export const mw = {
  bg: '#0B1630',
  bgDeep: '#151041',
  card: '#13224A',
  cardRaised: '#1B2D5C',
  glass: 'rgba(30, 48, 102, 0.72)',
  line: 'rgba(255, 255, 255, 0.08)',
  text: '#F4F6FB',
  muted: '#A9B4D0',
  accent: '#FF9F5A',
  accent2: '#FF5F8F', // second stop of the accent gradient
  onAccent: '#1A1206',
  ok: '#4ADE80',
  warn: '#FBBF24',
  danger: '#FF4D5E',
  white: '#FFFFFF',
};

/**
 * A CSS linear gradient as a style. Browsers get `backgroundImage`; react-native-tvos 0.81 draws
 * `experimental_backgroundImage`. `backgroundColor` (the second stop) shows wherever neither is supported.
 */
export function gradient(from: string, to: string, angle = 135): ViewStyle {
  const css = `linear-gradient(${angle}deg, ${from}, ${to})`;
  const style = Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css };
  return { backgroundColor: to, ...style } as unknown as ViewStyle;
}

/** Darken (amount < 0) or lighten a #RRGGBB colour, for two-stop gradients from one game colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c * amount : (255 - c) * amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const accentGradient = gradient(mw.accent, mw.accent2, 120);
