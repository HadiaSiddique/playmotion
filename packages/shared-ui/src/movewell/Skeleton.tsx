// Mirrored skeleton drawn from the phone's pose landmarks ([x, y, z, visibility] x 33, normalised).
import React from 'react';
import { View } from 'react-native';
import { mw } from './theme';

export type CompactLandmark = [number, number, number, number];

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const MIN_VISIBILITY = 0.5;

interface Props {
  landmarks: CompactLandmark[] | null;
  height: number;
  aspect: number; // camera width / height
  mirrored: boolean; // front camera: draw like a mirror
  color?: string;
}

export default function Skeleton({ landmarks, height, aspect, mirrored, color = mw.accent }: Props) {
  const width = Math.round(height * aspect);
  const thickness = Math.max(4, Math.round(height / 90));
  const point = (i: number) => {
    const [x, y] = landmarks![i];
    return { x: (mirrored ? 1 - x : x) * width, y: y * height };
  };
  const visible = (i: number) => (landmarks?.[i]?.[3] ?? 0) >= MIN_VISIBILITY;

  return (
    <View style={{ width, height, backgroundColor: mw.card, borderRadius: 16, overflow: 'hidden' }}>
      {landmarks
        ? BONES.filter(([a, b]) => visible(a) && visible(b)).map(([a, b]) => {
            const p = point(a);
            const q = point(b);
            const length = Math.hypot(q.x - p.x, q.y - p.y);
            const angle = Math.atan2(q.y - p.y, q.x - p.x);
            return (
              <View
                key={`${a}-${b}`}
                style={{
                  position: 'absolute',
                  left: (p.x + q.x) / 2 - length / 2,
                  top: (p.y + q.y) / 2 - thickness / 2,
                  width: length,
                  height: thickness,
                  borderRadius: thickness / 2,
                  backgroundColor: color,
                  transform: [{ rotate: `${angle}rad` }],
                }}
              />
            );
          })
        : null}
      {landmarks
        ? JOINTS.filter(visible).map((i) => {
            const p = point(i);
            const r = i === 0 ? thickness * 2.2 : thickness * 1.2;
            return (
              <View
                key={i}
                style={{ position: 'absolute', left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: mw.white }}
              />
            );
          })
        : null}
    </View>
  );
}
