// Every demo-coach move and every game scene on one page, for checking animations and taking screenshots.
// Web only: open the TV app with ?demo-gallery (e.g. http://localhost:8082/?demo-gallery).
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { exerciseName } from './catalog';
import DemoCoach, { DEMO_MOVES } from './DemoCoach';
import FloorIsLava from './FloorIsLava';
import FreezeDance from './FreezeDance';
import GardenGrow from './GardenGrow';
import PopBubbles from './PopBubbles';
import { mw } from './theme';
import { useColumnWidth } from './ui';

export default function DemoGallery() {
  // Same size as in a game, so the scenes look exactly as they will on the TV.
  const SCENE = Math.floor(useColumnWidth(1) * 0.58);
  return (
    <ScrollView style={styles.page}>
      <Text style={styles.h}>Game scenes</Text>
      <View style={styles.grid}>
        <Scene label="Pop the Bubbles">
          <PopBubbles count={3} target={8} signal={0.6} pixelWidth={SCENE} />
        </Scene>
        <Scene label="Garden Grow">
          <GardenGrow moveIndex={1} moveCount={3} progress={0.6} count={5} pixelWidth={SCENE} />
        </Scene>
        <Scene label="Freeze Dance: dancing">
          <FreezeDance freeze={false} holding={false} chapter={0} progress={0.4} avatar="🦊" pixelWidth={SCENE} />
        </Scene>
        <Scene label="Freeze Dance: freeze">
          <FreezeDance freeze holding chapter={1} progress={0.5} avatar="🦊" pixelWidth={SCENE} />
        </Scene>
        <Scene label="Floor Is Lava">
          <FloorIsLava chapter={1} progress={0.5} avatar="🐼" pixelWidth={SCENE} />
        </Scene>
      </View>
      <Text style={styles.h}>Demo coach</Text>
      <View style={styles.grid}>
        {DEMO_MOVES.map((id) => (
          <View key={id} style={styles.cell}>
            <DemoCoach move={id} width={170} />
            <Text style={styles.label}>{exerciseName(id)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Scene({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.cell}>
      {children}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: mw.bg },
  h: { color: mw.accent, fontSize: 18, fontWeight: '800', marginTop: 14, marginLeft: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  cell: { backgroundColor: mw.card, borderRadius: 12, margin: 6, padding: 6, alignItems: 'center' },
  label: { color: mw.text, fontSize: 13, marginTop: 4 },
});
