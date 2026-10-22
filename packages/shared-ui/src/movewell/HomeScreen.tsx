// Home dashboard: today's session, streak/level/garden/badges, the five modes, phone connection.
import { CommonActions, useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { RootStackParamList } from '../navigation/types';
import { adaptedText, AVATARS, BADGE_NAMES, exerciseName, GAMES, GARDEN_STAGES, ModeInfo, MODES, movesFor, pickableGames, playableGame } from './catalog';
import { LaptopCameraButton } from './LaptopCamera';
import MwButton from './MwButton';
import WorkoutPicker, { WorkoutChoice } from './WorkoutPicker';
import { usePairing } from './PairingContext';
import { gradient, mw, shade } from './theme';
import { ErrorBox, Loading, OptionCard, Screen, text, useColumnWidth } from './ui';
import { useUser } from './UserContext';

const s = scaledPixels;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, error, refresh, signOut, loading, userId } = useUser();
  const { state: pairing } = usePairing();
  const [openMode, setOpenMode] = useState<ModeInfo | null>(null);
  const [picking, setPicking] = useState(false);
  const modeWidth = useColumnWidth(4);
  const tileWidth = useColumnWidth(5);

  // No profile on this device yet (browser opened at "/"): start onboarding.
  useEffect(() => {
    if (!loading && !userId) navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] }));
  }, [loading, userId, navigation]);

  // Fresh numbers every time we come back from a session or check-in.
  useEffect(() => {
    if (isFocused) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  if (!data) {
    if (loading) return <Loading text="Loading your plan…" />;
    return (
      <SpatialNavigationRoot isActive={isFocused}>
        <Screen style={styles.center}>
          <ErrorBox message={error ?? 'We could not load your plan.'} onRetry={refresh} />
        </Screen>
      </SpatialNavigationRoot>
    );
  }

  const { profile, plan, today, progress, checkedInToday, notices } = data;
  const isKid = profile.kind === 'kid';
  const name = isKid ? profile.kid?.nickname : profile.displayName;
  const todayGame = GAMES[today.game];
  const playable = Boolean(todayGame?.playable);
  const phoneConnected = pairing.status === 'connected';
  const modes = isKid ? MODES.filter((m) => m.id === 'kids') : MODES.filter((m) => m.id !== 'kids');
  const level = progress.level ?? 1;
  const xpThis = 50 * (level - 1) ** 2;
  const xpNext = 50 * level ** 2;
  const xpPct = Math.min(100, Math.round(((progress.xp - xpThis) / Math.max(1, xpNext - xpThis)) * 100));

  // Today's check-in answers, so a later workout still shows the mood-lift graph at the end.
  const moodBefore = {
    moodBefore: data.todayCheckin?.mood ?? undefined,
    energyBefore: data.todayCheckin?.energy ?? undefined,
  };

  /** game = a game picked from a mode; undefined = today's planned session (the check-in may change it). */
  const startGame = (game?: string) => {
    if (!checkedInToday) navigation.navigate('Checkin', game ? { game: playableGame(game) } : undefined);
    else {
      const playGame = playableGame(game ?? today.game);
      navigation.navigate('Session', { game: playGame, moves: movesFor(playGame, plan, today, isKid), ...moodBefore });
    }
  };

  /** The person's own choice from "Choose my workout". The daily check-in still comes first (mood and pain screening). */
  const startChoice = (choice: WorkoutChoice) => {
    setPicking(false);
    if (!checkedInToday) navigation.navigate('Checkin', choice);
    else navigation.navigate('Session', { ...choice, ...moodBefore });
  };

  const startOver = async () => {
    await signOut();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] }));
  };

  return (
    <SpatialNavigationRoot key={picking ? 'pick' : openMode ? `mode-${openMode.id}` : 'home'} isActive={isFocused}>
      <Screen>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {isKid ? <Text style={styles.avatar}>{AVATARS[profile.kid?.avatar ?? 'fox']}</Text> : null}
            <View>
              <Text style={text.brand}>PlayMotion</Text>
              <Text style={text.h2}>
                {greeting()}
                {name ? `, ${name}` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.chips}>
            <Chip label={`🔥 ${progress.streak} day${progress.streak === 1 ? '' : 's'}`} />
            <Chip label={`⭐ Level ${level}`} />
            {isKid ? <Chip label={`🌟 ${progress.stars} stars`} /> : null}
            <Chip label={phoneConnected ? '📷 Camera connected ✓' : '📷 No camera connected'} color={phoneConnected ? mw.ok : mw.warn} />
          </View>
        </View>
        {notices[0] ? <Text style={[text.muted, styles.notice]}>🔔 {notices[0].text}</Text> : null}

        {picking ? (
          <WorkoutPicker plan={plan} today={today} isKid={isKid} recommended={playableGame(today.game)} onPick={startChoice} onClose={() => setPicking(false)} />
        ) : openMode ? (
          <ModePanel mode={openMode} onPlay={startGame} onClose={() => setOpenMode(null)} />
        ) : (
          <>
            <View style={styles.main}>
              <View style={[styles.card, styles.todayCard, gradient(shade(todayGame?.color ?? mw.accent, -0.35), shade(todayGame?.color ?? mw.accent, -0.7), 135)]}>
                <View style={styles.todayTop}>
                  <Text style={styles.cardLabelLight}>Today's session</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>⭐ Recommended for you</Text>
                  </View>
                </View>
                <View style={styles.todayHead}>
                  <View style={styles.todayIconBubble}>
                    <Text style={styles.todayIcon}>{todayGame?.icon}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={text.h2}>{todayGame?.name ?? today.game}</Text>
                    <Text style={text.muted}>
                      {today.minutes} min · {today.exercises.map((e) => exerciseName(e.id)).join(', ')}
                    </Text>
                    <Text style={[text.small, styles.adapted]}>{checkedInToday ? adaptedText(today.adapted) : 'Check in first so we can adapt it to how you feel'}</Text>
                  </View>
                </View>
                <SpatialNavigationView direction="horizontal" style={styles.buttons}>
                  <DefaultFocus>
                    <MwButton label={checkedInToday ? "Start today's session" : 'Check in and start'} onSelect={() => startGame()} />
                  </DefaultFocus>
                  <MwButton label="🎯 Choose my workout" onSelect={() => setPicking(true)} />
                  {!phoneConnected ? <MwButton label="Connect phone" onSelect={() => navigation.navigate('Pairing')} /> : null}
                  {!phoneConnected ? <LaptopCameraButton /> : null}
                </SpatialNavigationView>
              </View>

              <View style={[styles.card, styles.progressCard]}>
                <Text style={styles.cardLabel}>Your progress</Text>
                <Text style={text.body}>
                  Level {level} · {progress.xp} XP
                </Text>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
                </View>
                <View style={styles.garden}>
                  <Text style={styles.gardenIcon}>{GARDEN_STAGES[progress.garden?.stage ?? 0]}</Text>
                  <Text style={[text.muted, styles.flex]}>
                    {isKid ? `${progress.stickers.length} stickers collected` : `Your garden this week: stage ${progress.garden?.stage ?? 0} of 5. Every rep waters it.`}
                  </Text>
                </View>
                <Text style={[text.small, styles.badgesLabel]}>Badges</Text>
                <Text style={text.body} numberOfLines={2}>
                  {progress.badges.length ? progress.badges.map((b) => `🏅 ${BADGE_NAMES[b] ?? b}`).join('   ') : 'Finish a session to earn "First steps".'}
                </Text>
              </View>
            </View>

            <Text style={[styles.cardLabel, styles.modesLabel]}>{isKid ? 'All games' : 'All workouts'} · pick any</Text>
            <SpatialNavigationView direction="horizontal" style={styles.modes}>
              {pickableGames(isKid).map((g) => (
                <GameTile
                  key={g}
                  game={g}
                  width={tileWidth}
                  recommended={g === playableGame(today.game)}
                  onSelect={() => startChoice({ game: g, moves: movesFor(g, plan, today, isKid) })}
                />
              ))}
            </SpatialNavigationView>

            {isKid ? null : (
              <>
                <Text style={[styles.cardLabel, styles.modesLabel]}>Modes</Text>
                <SpatialNavigationView direction="horizontal" style={styles.modes}>
                  {modes.map((m) => (
                    <OptionCard key={m.id} icon={m.icon} label={m.name} sub={m.blurb} width={modeWidth} accent={m.color} selected={m.id === plan.mode} onSelect={() => setOpenMode(m)} />
                  ))}
                </SpatialNavigationView>
              </>
            )}

            <SpatialNavigationView direction="horizontal" style={styles.footer}>
              <MwButton label={isKid ? '📊 Parent view' : '📊 Weekly report'} onSelect={() => navigation.navigate('Report')} />
              <MwButton label="Phone pairing" onSelect={() => navigation.navigate('Pairing')} />
              <MwButton label="Start over" onSelect={startOver} />
            </SpatialNavigationView>
            <Text style={text.small}>Wellness coaching, not a medical device. Your video never leaves your phone.</Text>
          </>
        )}
      </Screen>
    </SpatialNavigationRoot>
  );
}

/** A colourful, focusable game tile: the game's colour as a gradient, big icon, name and a short line. */
function GameTile({ game, width, recommended, onSelect }: { game: string; width: number; recommended: boolean; onSelect: () => void }) {
  const g = GAMES[game];
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <View
          accessibilityLabel={`${g.name}. ${g.blurb}${recommended ? '. Recommended today' : ''}`}
          style={[styles.tile, { width }, gradient(g.color, shade(g.color, -0.55), 150), isFocused && styles.tileFocused]}
        >
          {recommended ? <Text style={styles.tileStar}>⭐</Text> : null}
          <Text style={styles.tileIcon}>{g.icon}</Text>
          <Text style={styles.tileName} numberOfLines={1}>
            {g.name}
          </Text>
          <Text style={styles.tileBlurb} numberOfLines={2}>
            {g.blurb}
          </Text>
        </View>
      )}
    </SpatialNavigationFocusableView>
  );
}

function Chip({ label, color = mw.text }: { label: string; color?: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

function ModePanel({ mode, onPlay, onClose }: { mode: ModeInfo; onPlay: (game: string) => void; onClose: () => void }) {
  const cardWidth = useColumnWidth(4);
  return (
    <View style={styles.modePanel}>
      <Text style={text.h1}>
        {mode.icon} {mode.name}
      </Text>
      <Text style={[text.muted, styles.modeBlurb]}>{mode.blurb}</Text>
      <SpatialNavigationView direction="horizontal" style={styles.modes}>
        {mode.games.map((g, i) => {
          const game = GAMES[g];
          const card = (
            <OptionCard
              key={g}
              icon={game.icon}
              label={game.name}
              sub={game.playable ? game.blurb : 'Coming soon'}
              width={cardWidth}
              accent={mode.color}
              disabled={!game.playable}
              onSelect={() => onPlay(g)}
            />
          );
          return i === 0 ? <DefaultFocus key={g}>{card}</DefaultFocus> : card;
        })}
      </SpatialNavigationView>
      <SpatialNavigationView direction="horizontal" style={styles.buttons}>
        <MwButton label="← Back to home" onSelect={onClose} />
      </SpatialNavigationView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { fontSize: s(80), marginRight: s(20) },
  chips: { flexDirection: 'row' },
  chip: { backgroundColor: mw.glass, borderWidth: s(2), borderColor: mw.line, borderRadius: s(999), paddingVertical: s(10), paddingHorizontal: s(22), marginLeft: s(14) },
  todayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(12) },
  cardLabelLight: { color: 'rgba(255,255,255,0.85)', fontSize: s(24), fontWeight: '800', letterSpacing: 1 },
  pill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: s(999), paddingHorizontal: s(16), paddingVertical: s(6) },
  pillText: { color: mw.white, fontSize: s(20), fontWeight: '800' },
  todayIconBubble: { width: s(130), height: s(130), borderRadius: s(65), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: s(24) },
  tile: { borderRadius: s(26), padding: s(20), marginRight: s(20), minHeight: s(190), borderWidth: s(3), borderColor: 'rgba(255,255,255,0.12)' },
  tileFocused: { borderColor: mw.white, transform: [{ scale: 1.06 }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: s(24), elevation: 10 },
  tileStar: { position: 'absolute', top: s(12), right: s(14), fontSize: s(30) },
  tileIcon: { fontSize: s(56) },
  tileName: { color: mw.white, fontSize: s(28), fontWeight: '900', marginTop: s(8) },
  tileBlurb: { color: 'rgba(255,255,255,0.82)', fontSize: s(19), marginTop: s(4) },
  chipText: { fontSize: s(24), fontWeight: '700' },
  notice: { marginTop: s(8) },
  main: { flexDirection: 'row', marginTop: s(24) },
  card: { backgroundColor: mw.glass, borderRadius: s(30), padding: s(30), borderWidth: s(2), borderColor: mw.line },
  todayCard: { flex: 1.35, marginRight: s(24) },
  progressCard: { flex: 1 },
  cardLabel: { color: mw.accent, fontSize: s(24), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) },
  todayHead: { flexDirection: 'row', alignItems: 'center' },
  todayIcon: { fontSize: s(80) },
  adapted: { marginTop: s(6) },
  soon: { marginTop: s(14) },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', marginTop: s(24), rowGap: s(14) },
  xpTrack: { height: s(14), backgroundColor: mw.bg, borderRadius: s(7), marginTop: s(10), overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: mw.accent },
  garden: { flexDirection: 'row', alignItems: 'center', marginTop: s(18) },
  gardenIcon: { fontSize: s(64), marginRight: s(16) },
  badgesLabel: { marginTop: s(14) },
  modesLabel: { marginTop: s(28) },
  modes: { flexDirection: 'row' },
  footer: { flexDirection: 'row', marginTop: s(20), marginBottom: s(8) },
  modePanel: { flex: 1, justifyContent: 'center' },
  modeBlurb: { marginTop: s(6), marginBottom: s(28) },
});
