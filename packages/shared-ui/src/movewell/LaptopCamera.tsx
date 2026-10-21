// Laptop mode (web only): use this computer's webcam instead of a phone. It opens the same camera
// page the QR code opens, inside a panel, already paired with this screen. Pose detection runs in
// that page as usual: video never leaves the laptop, only body points travel over the WebSocket.
//
// The panel can be dragged anywhere by its title bar (the spot is remembered), resized with ⤢
// (small, large, half the screen) and
// closed with ✕; a small "📷 Laptop camera" button brings it back. During a game it sits in the
// "You" slot next to the demo coach (CameraSlot) unless the person has moved it.
import React, { createElement, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import MwButton from './MwButton';
import { usePairing } from './PairingContext';
import { mw } from './theme';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const KEY_ON = 'movewell.laptopCamera';
const KEY_POS = 'movewell.laptopCameraPos';
const KEY_BIG = 'movewell.laptopCameraBig';

const read = (key: string) => {
  try {
    return isWeb ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: fine */
  }
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Store {
  on: boolean;
  compact: boolean; // a game screen is open
  size: PanelSize | null; // the person's own size choice (⤢ cycles small → large → huge)
  anchor: Rect | null; // the "You" slot in a game
  pos: { x: number; y: number } | null; // where the person dragged it
}

const parsePos = () => {
  try {
    const p = JSON.parse(read(KEY_POS) ?? 'null');
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
};
type PanelSize = 'small' | 'large' | 'huge';
const SIZES: PanelSize[] = ['small', 'large', 'huge'];
const sizeSaved = read(KEY_BIG);
let store: Store = {
  on: read(KEY_ON) === '1',
  compact: false,
  size: SIZES.includes(sizeSaved as PanelSize) ? (sizeSaved as PanelSize) : null,
  anchor: null,
  pos: parsePos(),
};
const listeners = new Set<(s: Store) => void>();
const update = (patch: Partial<Store>) => {
  store = { ...store, ...patch };
  listeners.forEach((l) => l(store));
};

function useStore(): Store {
  const [s, setS] = useState(store);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export function setLaptopCamera(on: boolean) {
  write(KEY_ON, on ? '1' : '0');
  update({ on });
}

export const useLaptopCamera = () => useStore().on;

/** Call from a game screen: the panel gets smaller while it is open. */
export function useCompactLaptopCamera() {
  useEffect(() => {
    update({ compact: true });
    return () => update({ compact: false, anchor: null });
  }, []);
}

/** "Use this laptop's camera" button for the connect screens. Renders nothing on a real TV. */
export function LaptopCameraButton() {
  const on = useLaptopCamera();
  if (!isWeb) return null;
  return <MwButton label={on ? '💻 Laptop camera is on' : "💻 Use this laptop's camera"} onSelect={() => setLaptopCamera(!on)} />;
}

/**
 * Where the camera panel goes during a game (the "You" spot next to the coach). Renders an empty box of
 * the given size and reports its position, so the panel can sit on top of it.
 */
export function CameraSlot({ width, height }: { width: number; height: number }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const measure = () =>
      ref.current?.measureInWindow((x, y, w, h) => {
        const a = store.anchor;
        if (w > 0 && (!a || a.x !== x || a.y !== y || a.w !== w || a.h !== h)) update({ anchor: { x, y, w, h } });
      });
    measure();
    // Text above the slot (tips, "step back") moves it, so re-measure now and then.
    const timer = setInterval(measure, 500);
    return () => {
      clearInterval(timer);
      update({ anchor: null });
    };
  }, []);
  return <View ref={ref} style={{ width, height }} />;
}

const HEADER = 28;

/** Panel size in pixels. "huge" is about half the screen: a big mirror to check your whole body is in view. */
function sizeOf(size: PanelSize, win: { width: number; height: number }) {
  if (size === 'small') return { w: 240, h: 300 };
  if (size === 'large') return { w: 400, h: 440 };
  const w = Math.round(Math.min(win.width * 0.48, 900));
  return { w, h: Math.round(Math.min(win.height - 40, w * 0.9)) };
}

/** The camera panel (and the button that brings it back), mounted once next to the navigator. */
export function LaptopCameraPanel() {
  const s = useStore();
  const { state } = usePairing();
  const win = useWindowDimensions();
  const headerRef = useRef<View>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const chosen: PanelSize = s.size ?? (s.compact ? 'small' : 'large');
  // In a game it sits in the "You" slot, unless the person moved it or picked a bigger size.
  const anchored = s.compact && !s.pos && (s.size === null || s.size === 'small') && s.anchor;
  const size = anchored ? { w: s.anchor!.w, h: s.anchor!.h } : sizeOf(chosen, win);
  const nextSize = SIZES[(SIZES.indexOf(chosen) + 1) % SIZES.length];
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(Math.max(0, p.x), Math.max(0, win.width - size.w)),
    y: Math.min(Math.max(0, p.y), Math.max(0, win.height - size.h)),
  });
  const where = drag ?? (s.pos ? clamp(s.pos) : anchored ? { x: s.anchor!.x, y: s.anchor!.y } : { x: win.width - size.w - 16, y: win.height - size.h - 16 });

  // Drag by the title bar (pointer events work for mouse, touch and pen).
  useEffect(() => {
    if (!isWeb || !s.on) return undefined;
    const node = headerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return undefined;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest?.('[data-nodrag]')) return;
      e.preventDefault();
      const start = { px: e.clientX, py: e.clientY, x: where.x, y: where.y };
      let last = { x: start.x, y: start.y };
      const onMove = (m: PointerEvent) => {
        last = clamp({ x: start.x + m.clientX - start.px, y: start.y + m.clientY - start.py });
        setDrag(last);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setDrag(null);
        write(KEY_POS, JSON.stringify(last));
        update({ pos: last });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    node.addEventListener('pointerdown', onDown);
    return () => node.removeEventListener('pointerdown', onDown);
  });

  if (!isWeb) return null;

  if (!s.on) {
    // Bring it back: only while no phone or laptop camera is connected.
    if (state.status === 'connected') return null;
    return (
      <Pressable style={styles.reopen} onPress={() => setLaptopCamera(true)} accessibilityLabel="Use this laptop's camera">
        <Text style={styles.reopenText}>📷 Laptop camera</Text>
      </Pressable>
    );
  }
  if (!state.joinUrl) return null;

  const src = `${state.joinUrl}${state.joinUrl.includes('?') ? '&' : '?'}embed=1`;
  const box: ViewStyle = { left: where.x, top: where.y, width: size.w, height: size.h };
  return (
    // The iframe stays the same element when the panel moves or resizes, so the camera keeps running.
    <View style={[styles.panel, box]}>
      <View ref={headerRef} style={[styles.header, { cursor: drag ? 'grabbing' : 'grab' } as unknown as ViewStyle]}>
        <Text style={styles.title} numberOfLines={1}>
          ✥ Laptop camera
        </Text>
        <View style={styles.actions} {...({ dataSet: { nodrag: '1' } } as object)}>
          {s.pos ? (
            <Pressable
              onPress={() => {
                write(KEY_POS, null);
                update({ pos: null });
              }}
              accessibilityLabel="Put the camera back in its place"
            >
              <Text style={styles.action}>↺</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              write(KEY_BIG, nextSize);
              update({ size: nextSize });
            }}
            accessibilityLabel={nextSize === 'small' ? 'Make the camera small' : 'Make the camera bigger'}
          >
            <Text style={styles.action}>{nextSize === 'small' ? '⤡' : '⤢'}</Text>
          </Pressable>
          <Pressable onPress={() => setLaptopCamera(false)} accessibilityLabel="Close the laptop camera">
            <Text style={styles.action}>✕</Text>
          </Pressable>
        </View>
      </View>
      {createElement('iframe', {
        key: src, // a new code reloads the page, which joins again
        src,
        title: 'PlayMotion camera',
        allow: 'camera; autoplay; screen-wake-lock', // the TV page itself listens for "stop"
        // While dragging, the iframe must not swallow the pointer.
        style: { border: 0, width: '100%', height: size.h - HEADER - 10, borderRadius: 10, background: '#0B1630', pointerEvents: drag ? 'none' : 'auto' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: mw.cardRaised,
    borderRadius: 14,
    padding: 5,
    borderWidth: 2,
    borderColor: mw.accent,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  header: { height: HEADER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  title: { color: mw.text, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  actions: { flexDirection: 'row' },
  action: { color: mw.text, fontSize: 15, fontWeight: '800', paddingHorizontal: 6 },
  reopen: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: mw.cardRaised,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: mw.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reopenText: { color: mw.text, fontSize: 14, fontWeight: '800' },
});
