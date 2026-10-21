// Weekly report: plain-language summary (Bedrock, template fallback) read aloud by Polly, active minutes vs the
// WHO's 150 a week, minutes per day, mood before/after, chair-stand trend, food swaps, share with family.
// Kids profiles get a parent view: minutes moved, stars and stickers.
import { useIsFocused, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationScrollView, SpatialNavigationView } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { api } from './api';
import { playVoice, stopVoice } from './audio';
import { STICKER_EMOJI } from './catalog';
import MwButton from './MwButton';
import { mw } from './theme';
import { ReportDay, ReportResponse } from './types';
import { ErrorBox, Loading, Screen, text, useColumnWidth } from './ui';
import { useUser } from './UserContext';

const s = scaledPixels;
// Validated with the dataviz palette checker against the card surface (#13224A, dark):
// lightness band, chroma, CVD and normal-vision separation, contrast all pass.
const BEFORE = '#4F7FE0';
const AFTER = '#22A861';
const DAILY_TARGET = Math.round(150 / 7); // the WHO weekly guideline spread over 7 days

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function ReportScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { userId, data } = useUser();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const width = useColumnWidth(1);
  const isKid = data?.profile.kind === 'kid';
  const name = isKid ? data?.profile.kid?.nickname : data?.profile.displayName;

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const r = await api.report(userId, !isKid);
      setReport(r);
      const voice = await api.tts({ userId, text: r.summary, style: isKid ? 'kids' : 'coach' }).catch(() => null);
      if (voice?.url) {
        setVoiceUrl(voice.url);
        playVoice(voice.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [userId, isKid]);

  useEffect(() => {
    load();
    return () => stopVoice();
  }, [load]);

  const share = async () => {
    if (!userId) return;
    setShareState('sending');
    try {
      await api.shareReport(userId);
      setShareState('sent');
    } catch {
      setShareState('failed');
    }
  };

  if (!report && !error) return <Loading text="Putting your week together…" />;

  const st = report?.stats;
  const daysWithMood = (st?.byDay ?? []).filter((d) => d.moodBefore !== null && d.moodAfter !== null);
  const swaps = data?.plan?.nutrition?.swaps ?? [];
  const familyEnabled = Boolean(data?.profile.familyEnabled);

  return (
    <SpatialNavigationRoot key={`${Boolean(report)}-${shareState}`} isActive={isFocused}>
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {st && report ? (
          <ReportScroll>
            <View style={styles.header}>
              <View>
                <Text style={text.brand}>{isKid ? 'Parent view' : 'Weekly report'}</Text>
                <Text style={text.h2}>{isKid ? `${name}'s week of moving` : `Your week${name ? `, ${name}` : ''}`}</Text>
              </View>
              <Text style={text.muted}>
                {shortDate(st.weekStart)} – {shortDate(st.weekEnd)}
              </Text>
            </View>

            <View style={styles.tiles}>
              {isKid ? (
                <>
                  <Tile big={`${st.activeMinutes} min`} small={`moved over ${st.activeDays} day${st.activeDays === 1 ? '' : 's'}`} />
                  <Tile big={`🌟 ${st.stars ?? 0}`} small="stars collected" />
                  <Tile big={`${st.stickers?.length ?? 0}`} small="stickers in the book" />
                  <Tile big={`${st.sessions}`} small="story sessions" />
                </>
              ) : (
                <>
                  <WhoTile minutes={st.activeMinutes} percent={st.whoPercent ?? 0} />
                  <Tile big={`${st.sessions}`} small={`sessions on ${st.activeDays} day${st.activeDays === 1 ? '' : 's'}`} />
                  <Tile big={st.moodLift === null ? '–' : `${st.moodLift > 0 ? '+' : ''}${st.moodLift}`} small="average mood lift after moving" />
                  <Tile big={`🔥 ${st.streak}`} small={`day streak · level ${st.level}`} />
                </>
              )}
            </View>

            <View style={styles.charts}>
              <MinutesChart days={st.byDay} width={Math.floor(width * (isKid ? 0.6 : 0.52))} showTarget={!isKid} />
              {isKid ? (
                <StickerBook stickers={st.stickers ?? []} />
              ) : daysWithMood.length ? (
                <MoodChart days={daysWithMood} width={Math.floor(width * 0.45)} />
              ) : (
                <View style={[styles.card, styles.flex]}>
                  <Text style={styles.cardTitle}>Mood before and after</Text>
                  <Text style={text.muted}>Rate your mood before and after a session to see your mood lift here.</Text>
                </View>
              )}
            </View>

            <View style={styles.bottom}>
              <View style={[styles.card, styles.summary]}>
                <Text style={styles.cardTitle}>{report.source === 'ai' ? 'Your coach says (PlayMotion AI)' : 'Your week in a nutshell'}</Text>
                <Text style={text.body}>{report.summary}</Text>
              </View>
              <View style={[styles.card, styles.side]}>
                {st.chairStand ? (
                  <>
                    <Text style={styles.cardTitle}>30-second chair stands</Text>
                    <Text style={styles.sideBig}>{st.chairStand.latest}</Text>
                    <Text style={text.muted}>
                      {st.chairStand.change === null ? 'Your first result' : st.chairStand.change > 0 ? `+${st.chairStand.change} since last time` : st.chairStand.change === 0 ? 'Same as last time' : 'Keep going: every week counts'}
                    </Text>
                  </>
                ) : swaps.length ? (
                  <>
                    <Text style={styles.cardTitle}>Small food swaps for you</Text>
                    {swaps.slice(0, 2).map((sw) => (
                      <Text key={sw} style={[text.muted, styles.swap]}>
                        🥗 {sw}
                      </Text>
                    ))}
                  </>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>Tip</Text>
                    <Text style={text.muted}>Short sessions on most days beat one long one. Even 5 minutes counts.</Text>
                  </>
                )}
              </View>
            </View>

            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <DefaultFocus>
                <MwButton label="🔊 Read aloud" onSelect={() => playVoice(voiceUrl)} />
              </DefaultFocus>
              {!isKid && familyEnabled ? (
                <MwButton
                  label={shareState === 'sent' ? 'Shared ✓' : shareState === 'sending' ? 'Sharing…' : shareState === 'failed' ? 'Try sharing again' : 'Share with family'}
                  onSelect={share}
                />
              ) : null}
              <MwButton label="← Back home" onSelect={() => navigation.goBack()} />
            </SpatialNavigationView>
            <Text style={text.small}>
              {isKid
                ? 'Only minutes, stars and stickers are kept for kids. No names, photos or video.'
                : 'WHO guideline: at least 150 minutes of moderate activity a week. Wellness coaching, not a medical device.'}
            </Text>
          </ReportScroll>
        ) : null}
      </Screen>
    </SpatialNavigationRoot>
  );
}

/**
 * The report is taller than the screen. In a browser the whole Screen already scrolls (mouse wheel,
 * scrollbar). On a TV: the spatial-navigation scroll view, which follows the remote's focus.
 */
function ReportScroll({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') return <View style={styles.scrollContent}>{children}</View>;
  return (
    <SpatialNavigationScrollView offsetFromStart={s(160)} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {children}
    </SpatialNavigationScrollView>
  );
}

function Tile({ big, small }: { big: string; small: string }) {
  return (
    <View style={[styles.card, styles.tile]}>
      <Text style={styles.tileBig}>{big}</Text>
      <Text style={text.muted}>{small}</Text>
    </View>
  );
}

/** Hero number: active minutes against the WHO's 150 a week. */
function WhoTile({ minutes, percent }: { minutes: number; percent: number }) {
  return (
    <View style={[styles.card, styles.tile, styles.whoTile]}>
      <Text style={styles.tileBig}>
        {minutes} <Text style={styles.tileUnit}>of 150 min</Text>
      </Text>
      <View style={styles.track} accessibilityLabel={`${percent} percent of the WHO weekly target`}>
        <View style={[styles.fill, { width: `${Math.min(100, percent)}%` }]} />
      </View>
      <Text style={text.muted}>{percent}% of the WHO weekly target</Text>
    </View>
  );
}

/** Minutes moved per day: one series (no legend needed), value labels on bars, dashed daily target. */
function MinutesChart({ days, width, showTarget }: { days: ReportDay[]; width: number; showTarget: boolean }) {
  const chartH = s(190);
  const max = Math.max(showTarget ? DAILY_TARGET * 1.3 : 10, ...days.map((d) => d.minutes));
  const y = (v: number) => (v / max) * chartH;
  return (
    <View style={[styles.card, { width }]}>
      <Text style={styles.cardTitle}>Minutes moved per day</Text>
      <View style={[styles.plot, { height: chartH + s(36) }]}>
        {showTarget ? (
          <View style={[styles.targetLine, { bottom: s(36) + y(DAILY_TARGET) }]}>
            <Text style={styles.targetLabel}>{DAILY_TARGET} min a day ≈ 150 a week</Text>
          </View>
        ) : null}
        <View style={styles.bars}>
          {days.map((d) => (
            <View key={d.date} style={styles.barCol} accessibilityLabel={`${weekday(d.date)}: ${d.minutes} minutes`}>
              {d.minutes > 0 ? <Text style={styles.barValue}>{d.minutes}</Text> : null}
              <View style={[styles.bar, { height: Math.max(d.minutes > 0 ? s(6) : 0, y(d.minutes)) }]} />
              <View style={styles.baseline} />
              <Text style={styles.barLabel}>{weekday(d.date)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Mood before vs after, per day with a session: two series, legend + direct labels (not colour alone). */
function MoodChart({ days, width }: { days: ReportDay[]; width: number }) {
  const chartH = s(170);
  const y = (v: number) => (v / 5) * chartH;
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.legendRow}>
        <Text style={styles.cardTitle}>Mood before → after</Text>
        <Legend color={BEFORE} label="Before" />
        <Legend color={AFTER} label="After" />
      </View>
      <View style={[styles.bars, { height: chartH + s(36), marginTop: s(14) }]}>
        {days.slice(-5).map((d) => (
          <View key={d.date} style={styles.pairCol}>
            <View style={styles.pair}>
              {[
                { v: d.moodBefore ?? 0, c: BEFORE },
                { v: d.moodAfter ?? 0, c: AFTER },
              ].map((b, i) => (
                <View key={i} style={styles.pairBarWrap}>
                  <Text style={styles.barValue}>{b.v}</Text>
                  <View style={[styles.pairBar, { height: y(b.v), backgroundColor: b.c }]} />
                </View>
              ))}
            </View>
            <View style={styles.baseline} />
            <Text style={styles.barLabel}>{weekday(d.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={text.small}>{label}</Text>
    </View>
  );
}

function StickerBook({ stickers }: { stickers: string[] }) {
  return (
    <View style={[styles.card, styles.flex]}>
      <Text style={styles.cardTitle}>Sticker book</Text>
      <View style={styles.stickers}>
        {stickers.length ? (
          stickers.map((st, i) => (
            <Text key={`${st}-${i}`} style={styles.sticker}>
              {STICKER_EMOJI[st] ?? '⭐'}
            </Text>
          ))
        ) : (
          <Text style={text.muted}>Finish a story to earn the first sticker.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: s(24) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  tiles: { flexDirection: 'row', marginTop: s(20) },
  card: { backgroundColor: mw.card, borderRadius: s(24), padding: s(22) },
  tile: { flex: 1, marginRight: s(16) },
  whoTile: { flex: 1.4 },
  tileBig: { color: mw.text, fontSize: s(48), fontWeight: '900' },
  tileUnit: { color: mw.muted, fontSize: s(26), fontWeight: '700' },
  track: { height: s(14), backgroundColor: mw.bg, borderRadius: s(7), overflow: 'hidden', marginVertical: s(8) },
  fill: { height: '100%', backgroundColor: mw.accent, borderRadius: s(7) },
  charts: { flexDirection: 'row', marginTop: s(18), justifyContent: 'space-between' },
  cardTitle: { color: mw.accent, fontSize: s(24), fontWeight: '800', marginBottom: s(6) },
  plot: { marginTop: s(10), justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: s(44), backgroundColor: mw.accent, borderTopLeftRadius: s(4), borderTopRightRadius: s(4) },
  baseline: { alignSelf: 'stretch', height: s(2), backgroundColor: mw.cardRaised },
  barValue: { color: mw.text, fontSize: s(20), fontWeight: '700', marginBottom: s(4) },
  barLabel: { color: mw.muted, fontSize: s(20), marginTop: s(6) },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: s(2), borderStyle: 'dashed', borderColor: mw.muted },
  targetLabel: { position: 'absolute', right: 0, top: -s(28), color: mw.muted, fontSize: s(18) },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', marginLeft: s(18) },
  swatch: { width: s(18), height: s(18), borderRadius: s(4), marginRight: s(6) },
  pairCol: { alignItems: 'center', flex: 1 },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: s(2) },
  pairBarWrap: { alignItems: 'center' },
  pairBar: { width: s(34), borderTopLeftRadius: s(4), borderTopRightRadius: s(4) },
  bottom: { flexDirection: 'row', marginTop: s(18) },
  summary: { flex: 1.6, marginRight: s(16) },
  side: { flex: 1 },
  sideBig: { color: mw.text, fontSize: s(56), fontWeight: '900' },
  swap: { marginTop: s(6) },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', marginTop: s(8) },
  sticker: { fontSize: s(64), marginRight: s(14), marginBottom: s(10) },
  buttons: { flexDirection: 'row', marginTop: s(18), marginBottom: s(8) },
});
