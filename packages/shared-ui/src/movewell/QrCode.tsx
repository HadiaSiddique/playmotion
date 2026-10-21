// QR code drawn with plain Views (no native SVG module needed). Dark modules in a row are merged
// into one View per run, so a typical code is a few hundred Views.
import qrcode from 'qrcode-generator';
import React, { useMemo } from 'react';
import { View } from 'react-native';

const QUIET_ZONE = 4; // modules of white border required around a QR code

type Run = { dark: boolean; length: number };

function buildRows(value: string): { size: number; rows: Run[][] } {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const rows: Run[][] = [];
  for (let r = 0; r < n; r++) {
    const runs: Run[] = [];
    for (let c = 0; c < n; c++) {
      const dark = qr.isDark(r, c);
      const last = runs[runs.length - 1];
      if (last && last.dark === dark) last.length += 1;
      else runs.push({ dark, length: 1 });
    }
    rows.push(runs);
  }
  return { size: n, rows };
}

export default function QrCode({ value, size }: { value: string; size: number }) {
  const matrix = useMemo(() => buildRows(value), [value]);
  // Whole pixels per module keep edges crisp (no hairline gaps between rows).
  const cell = Math.max(2, Math.floor(size / (matrix.size + QUIET_ZONE * 2)));
  const total = cell * (matrix.size + QUIET_ZONE * 2);

  return (
    <View
      accessible
      accessibilityLabel="QR code to connect your phone"
      style={{ width: total, height: total, backgroundColor: '#FFFFFF', padding: cell * QUIET_ZONE, borderRadius: cell * 2 }}
    >
      {matrix.rows.map((runs, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {runs.map((run, i) => (
            <View key={i} style={{ width: run.length * cell, height: cell, backgroundColor: run.dark ? '#000000' : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
