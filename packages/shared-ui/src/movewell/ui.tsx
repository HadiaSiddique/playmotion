// Shared 10-foot UI pieces: big focusable option cards, grids that work with the D-pad, screen frame.
import React from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { safeZones } from '../theme';
import MwButton from './MwButton';
import { accentGradient, gradient, mw, shade } from './theme';

const s = scaledPixels;

const CARD_GAP = 20;

/**
 * Width for one card when `columns` cards share a row inside the title-safe area, measured from the real
 * screen so rows never run off the edge (TVs, browsers and emulators scale differently). Optional max.
 */
export function useColumnWidth(columns: number, max?: number) {
  const { width } = useWindowDimensions();
  const content = width - 2 * s(safeZones.titleSafe.horizontal);
  const w = Math.floor((content - columns * s(CARD_GAP)) / columns - 1);
  return max ? Math.min(w, max) : w;
}

/**
 * Full-screen frame inside the TV safe area. In a browser the window can be shorter than a TV screen
 * (laptop, browser toolbars), so there it scrolls when the content doesn't fit; when it fits, layout
 * (centering etc.) is exactly the same as on a TV.
 */
export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const content =
    Platform.OS === 'web' ? (
      <ScrollView style={styles.webScroll} contentContainerStyle={[styles.screen, styles.webContent, style]}>
        {children}
      </ScrollView>
    ) : (
      <View style={[styles.screen, style]}>{children}</View>
    );
  return (
    <View style={[styles.backdrop, gradient(mw.bg, mw.bgDeep, 160)]}>
      {/* Soft colour glows behind everything */}
      <View pointerEvents="none" style={[styles.glow, styles.glowA]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowB]} />
      {content}
    </View>
  );
}

export interface Option<T> {
  value: T;
  label: string;
  sub?: string;
  icon?: string;
}

interface OptionCardProps {
  label: string;
  sub?: string;
  icon?: string;
  selected?: boolean;
  disabled?: boolean;
  width: number;
  onSelect: () => void;
  accent?: string;
}

/** Large card for answers and menu items: clear focus ring, scale and accent colour for the remote. */
export function OptionCard({ label, sub, icon, selected, disabled, width, onSelect, accent = mw.accent }: OptionCardProps) {
  return (
    <SpatialNavigationFocusableView onSelect={disabled ? undefined : onSelect}>
      {({ isFocused }) => (
        <View
          accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
          accessibilityLabel={sub ? `${label}. ${sub}` : label}
          accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
          style={[
            styles.card,
            { width },
            selected && { borderColor: accent, backgroundColor: mw.cardRaised },
            isFocused && [accent === mw.accent ? accentGradient : gradient(accent, shade(accent, -0.25)), styles.cardFocused],
            disabled && !isFocused && { opacity: 0.55 },
          ]}
        >
          {icon ? (
            <View style={[styles.iconBubble, { backgroundColor: isFocused ? 'rgba(255,255,255,0.3)' : `${accent}26` }]}>
              <Text style={styles.cardIcon}>{icon}</Text>
            </View>
          ) : null}
          <Text style={[styles.cardLabel, isFocused && { color: mw.onAccent }]}>
            {selected ? '✓ ' : ''}
            {label}
          </Text>
          {sub ? <Text style={[styles.cardSub, isFocused && { color: mw.onAccent }]}>{sub}</Text> : null}
        </View>
      )}
    </SpatialNavigationFocusableView>
  );
}

/** Options laid out in rows, so up/down/left/right on the remote all behave as expected. */
export function OptionGrid<T>({
  options,
  columns,
  cardWidth,
  isSelected,
  onSelect,
}: {
  options: Option<T>[];
  columns: number;
  cardWidth: number;
  isSelected?: (value: T) => boolean;
  onSelect: (value: T) => void;
}) {
  const rows: Option<T>[][] = [];
  for (let i = 0; i < options.length; i += columns) rows.push(options.slice(i, i + columns));
  return (
    <SpatialNavigationView direction="vertical">
      {rows.map((row, r) => (
        <SpatialNavigationView key={r} direction="horizontal" style={styles.row}>
          {row.map((o, c) => {
            const card = (
              <OptionCard
                key={String(o.value)}
                label={o.label}
                sub={o.sub}
                icon={o.icon}
                width={cardWidth}
                selected={isSelected?.(o.value)}
                onSelect={() => onSelect(o.value)}
              />
            );
            return r === 0 && c === 0 ? <DefaultFocus key={String(o.value)}>{card}</DefaultFocus> : card;
          })}
        </SpatialNavigationView>
      ))}
    </SpatialNavigationView>
  );
}

export function Loading({ text }: { text: string }) {
  return (
    <Screen style={styles.center}>
      <ActivityIndicator size="large" color={mw.accent} />
      <Text style={styles.loadingText}>{text}</Text>
    </Screen>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <SpatialNavigationView direction="horizontal" style={styles.row}>
          <DefaultFocus>
            <MwButton label="Try again" onSelect={onRetry} />
          </DefaultFocus>
        </SpatialNavigationView>
      ) : null}
    </View>
  );
}

export const text = StyleSheet.create({
  brand: { color: mw.accent, fontSize: s(28), fontWeight: '800', letterSpacing: 1 },
  h1: { color: mw.text, fontSize: s(60), fontWeight: '800' },
  h2: { color: mw.text, fontSize: s(40), fontWeight: '800' },
  body: { color: mw.text, fontSize: s(28) },
  muted: { color: mw.muted, fontSize: s(26) },
  small: { color: mw.muted, fontSize: s(20) },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1, // transparent: the backdrop gradient shows through
    paddingHorizontal: s(safeZones.titleSafe.horizontal),
    paddingVertical: s(safeZones.titleSafe.vertical),
  },
  backdrop: { flex: 1, overflow: 'hidden' },
  glow: { position: 'absolute', width: s(900), height: s(900), borderRadius: s(450), opacity: 0.18 },
  glowA: { top: -s(420), right: -s(260), backgroundColor: '#7C3AED' },
  glowB: { bottom: -s(520), left: -s(300), backgroundColor: '#0EA5E9' },
  webScroll: { flex: 1 },
  webContent: { flex: undefined, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', marginBottom: s(20) },
  card: {
    backgroundColor: mw.glass,
    borderRadius: s(26),
    borderWidth: s(3),
    borderColor: mw.line,
    paddingVertical: s(22),
    paddingHorizontal: s(26),
    marginRight: s(CARD_GAP),
    minHeight: s(120),
    justifyContent: 'center',
  },
  cardFocused: { borderColor: mw.white, transform: [{ scale: 1.05 }], shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: s(24), elevation: 10 },
  iconBubble: { width: s(72), height: s(72), borderRadius: s(36), alignItems: 'center', justifyContent: 'center', marginBottom: s(10) },
  cardIcon: { fontSize: s(42) },
  cardLabel: { color: mw.text, fontSize: s(30), fontWeight: '800' },
  cardSub: { color: mw.muted, fontSize: s(22), marginTop: s(4) },
  loadingText: { color: mw.muted, fontSize: s(30), marginTop: s(24) },
  errorBox: { backgroundColor: mw.card, borderRadius: s(24), padding: s(32), marginTop: s(24) },
  errorTitle: { color: mw.danger, fontSize: s(32), fontWeight: '800' },
  errorText: { color: mw.text, fontSize: s(26), marginTop: s(8), marginBottom: s(16) },
});
