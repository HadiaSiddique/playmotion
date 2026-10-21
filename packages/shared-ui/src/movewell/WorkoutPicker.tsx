// "Choose my workout": any playable game or just one move, instead of the recommended session.
// The coach still recommends (⭐), the person decides. Every choice is already filtered for safety
// (seated when needed, nothing that loads a sore joint), exactly like the planned sessions.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { exerciseName, gameForMove, GAMES, moveKind, movesFor, pickableGames, singleMoves } from './catalog';
import MwButton from './MwButton';
import { mw } from './theme';
import { Plan, PlanExercise, Today } from './types';
import { OptionCard, text, useColumnWidth } from './ui';

const s = scaledPixels;

export interface WorkoutChoice {
  game: string;
  moves: PlanExercise[];
}

interface Props {
  plan: Plan | null;
  today: Today | null;
  isKid: boolean;
  recommended: string; // today's recommended game
  onPick: (choice: WorkoutChoice) => void;
  onClose: () => void;
}

export default function WorkoutPicker({ plan, today, isKid, recommended, onPick, onClose }: Props) {
  const games = pickableGames(isKid);
  const moves = singleMoves(plan, today, isKid);
  const gameWidth = useColumnWidth(3);
  const moveWidth = useColumnWidth(5);
  const rows: PlanExercise[][] = [];
  for (let i = 0; i < moves.length; i += 5) rows.push(moves.slice(i, i + 5));

  return (
    <View style={styles.wrap}>
      <Text style={text.h1}>Choose your workout</Text>
      <Text style={[text.muted, styles.sub]}>⭐ is what your coach recommends today, but it's your choice. Every option uses moves that are safe for you.</Text>

      <Text style={styles.label}>Games</Text>
      <SpatialNavigationView direction="vertical">
        <SpatialNavigationView direction="horizontal" style={styles.row}>
          {games.map((g, i) => {
            const card = (
              <OptionCard
                key={g}
                icon={GAMES[g].icon}
                label={`${g === recommended ? '⭐ ' : ''}${GAMES[g].name}`}
                sub={GAMES[g].blurb}
                width={gameWidth}
                onSelect={() => onPick({ game: g, moves: movesFor(g, plan, today, isKid) })}
              />
            );
            return i === 0 ? <DefaultFocus key={g}>{card}</DefaultFocus> : card;
          })}
        </SpatialNavigationView>

        <Text style={styles.label}>Or just one move</Text>
        {rows.map((row, r) => (
          <SpatialNavigationView key={r} direction="horizontal" style={styles.row}>
            {row.map((m) => (
              <OptionCard
                key={m.id}
                label={exerciseName(m.id)}
                sub={moveKind(m.id) === 'hold' ? `${m.target} seconds` : m.id === 'breathing' ? `${m.target} slow breaths` : `${m.target} reps`}
                width={moveWidth}
                onSelect={() => onPick({ game: gameForMove(m.id, isKid), moves: [m] })}
              />
            ))}
          </SpatialNavigationView>
        ))}

        <SpatialNavigationView direction="horizontal" style={styles.row}>
          <MwButton label="← Back" onSelect={onClose} />
        </SpatialNavigationView>
      </SpatialNavigationView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  sub: { marginTop: s(6), marginBottom: s(12) },
  label: { color: mw.accent, fontSize: s(24), fontWeight: '800', marginTop: s(12), marginBottom: s(10) },
  row: { flexDirection: 'row', marginBottom: s(14) },
});
