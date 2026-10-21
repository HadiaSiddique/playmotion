// Pure-logic tests: no AWS calls, no installs needed.  Run:  node --test test/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES, GAMES, WEEK_TEMPLATES, safeExercise } from '../lib/shared/catalog.mjs';
import { adaptToday, buildBasePlan, cleanPlanExplanation, normalizeAnswers, normalizeKid } from '../lib/planner.mjs';
import { applySession, initialProgress, levelForXp } from '../lib/progress.mjs';
import { buildWeeklyStats } from '../lib/report.mjs';
import { screenCheckin, supportPayload } from '../lib/safety.mjs';
import { celebrationLine, coachLine, planExplanation, reportSummary, storyFallback } from '../lib/templates.mjs';
import { daysBetween, extractJson, hashPin, localDate, mondayOf, verifyPin, weekdayIndex } from '../lib/util.mjs';

const MONDAY = '2026-10-19';

test('catalog: every game and template references real IDs', () => {
  for (const game of Object.values(GAMES)) for (const id of game.exercises) assert.ok(EXERCISES[id], id);
  for (const week of Object.values(WEEK_TEMPLATES)) {
    assert.equal(week.length, 7);
    for (const g of week) assert.ok(GAMES[g], g);
  }
  for (const [id, ex] of Object.entries(EXERCISES)) {
    for (const alt of [ex.seatedAlt, ex.chairAlt, ex.gentleAlt]) if (alt) assert.ok(EXERCISES[alt], `${id} -> ${alt}`);
  }
});

test('safeExercise: wheelchair users only ever get seated or "any" moves', () => {
  for (const id of Object.keys(EXERCISES)) {
    const safe = safeExercise(id, { mobility: 'wheelchair' });
    assert.ok(safe, id);
    assert.notEqual(EXERCISES[safe].posture, 'standing', `${id} -> ${safe}`);
  }
});

test('safeExercise: substitutions for chair users, older adults and pain', () => {
  assert.equal(safeExercise('squats', { mobility: 'chair' }), 'sit_to_stand');
  assert.equal(safeExercise('jumping_jacks', { who: 'older_adult' }), 'standing_march');
  assert.equal(safeExercise('squats', { painAreas: ['knees'] }), 'seated_knee_lift');
  const kneeSafe = safeExercise('squats', { painAreas: ['knees'] });
  assert.ok(!EXERCISES[kneeSafe].loads.includes('knees'));
  assert.equal(safeExercise('punches', {}), 'punches');
  assert.equal(safeExercise('nope', {}), null);
});

test('normalizeAnswers: rejects junk and applies safe defaults', () => {
  const a = normalizeAnswers({ who: 'robot', mobility: 'flying', painAreas: ['knees', 'bogus', 'knees'], sessionMinutes: 7, mood: 9, reminderTime: '25:00', displayName: '<b>Ammi</b>' });
  assert.equal(a.who, 'adult');
  assert.equal(a.mobility, 'unsupported');
  assert.deepEqual(a.painAreas, ['knees']);
  assert.equal(a.sessionMinutes, 10);
  assert.equal(a.mood, 5);
  assert.equal(a.reminderTime, '18:00');
  assert.equal(a.displayName, 'bAmmib');
  assert.equal(a.calorieCounting, false);
  assert.equal(a.bodyNeutral, true);
});

test('normalizeKid: nickname required, avatar from the list only', () => {
  assert.equal(normalizeKid({}), null);
  assert.deepEqual(normalizeKid({ nickname: '  Zee  ', avatar: 'hacker' }), { nickname: 'Zee', avatar: 'fox', ageBand: null });
});

test('buildBasePlan: older adult on balance goal gets Steady with chair-safe moves', () => {
  const plan = buildBasePlan(normalizeAnswers({ who: 'older_adult', goal: 'balance', mobility: 'chair', activityLevel: 'active', sessionMinutes: 10 }));
  assert.equal(plan.mode, 'steady');
  assert.equal(plan.week.length, 7);
  assert.ok(plan.intensity <= 2, 'older adults are capped at intensity 2');
  for (const day of plan.week) {
    assert.ok(day.exercises.length > 0);
    for (const e of day.exercises) assert.equal(EXERCISES[e.id].impact, 'low', `${day.day} ${e.id}`);
  }
  assert.equal(plan.goals.weeklyActiveMinutes, 150);
  assert.ok(plan.safetyNotes.some((n) => n.includes('not a medical device')));
});

test('buildBasePlan: wheelchair Fit plan is fully seated', () => {
  const plan = buildBasePlan(normalizeAnswers({ goal: 'lose_weight', mobility: 'wheelchair' }));
  assert.equal(plan.mode, 'fit');
  assert.equal(plan.posture, 'seated');
  for (const day of plan.week) for (const e of day.exercises) assert.notEqual(EXERCISES[e.id].posture, 'standing');
});

test('buildBasePlan: low starting mood adds Calm River days; kids get 10-minute stories', () => {
  const low = buildBasePlan(normalizeAnswers({ goal: 'get_stronger', mood: 1 }));
  assert.equal(low.week[2].game, 'calm_river');
  assert.equal(low.week[5].game, 'calm_river');
  const kids = buildBasePlan(normalizeAnswers({ who: 'kid', sessionMinutes: 20 }));
  assert.equal(kids.mode, 'kids');
  assert.equal(kids.sessionMinutes, 10);
  assert.equal(kids.nutrition, null);
  assert.ok(kids.week.every((d) => GAMES[d.game].modes.includes('kids')));
});

test('adaptToday: low mood -> 5-min Calm River, feeling good -> harder, pain -> seated', () => {
  const plan = buildBasePlan(normalizeAnswers({ goal: 'get_stronger', activityLevel: 'some', sessionMinutes: 15 }));
  assert.equal(weekdayIndex(MONDAY), 0);
  const planned = adaptToday(plan, null, MONDAY);
  assert.equal(planned.game, 'boss_battle');
  assert.equal(planned.adapted, 'planned');

  const low = adaptToday(plan, { mood: 2, energy: 3, sleep: 3 }, MONDAY);
  assert.equal(low.game, 'calm_river');
  assert.equal(low.minutes, 5);
  assert.equal(low.adapted, 'low_mood');

  const good = adaptToday(plan, { mood: 5, energy: 5, sleep: 4 }, MONDAY);
  assert.equal(good.adapted, 'feeling_good');
  assert.equal(good.intensity, planned.intensity + 1);
  assert.ok(good.exercises[0].target > planned.exercises[0].target);

  const pain = adaptToday(plan, { mood: 3, energy: 3, sleep: 3, pain: true, painAreas: ['knees'] }, MONDAY);
  assert.equal(pain.adapted, 'pain');
  assert.equal(pain.posture, 'seated');
  for (const e of pain.exercises) {
    assert.notEqual(EXERCISES[e.id].posture, 'standing');
    assert.ok(!EXERCISES[e.id].loads.includes('knees'));
  }
  // The stored plan is never mutated.
  assert.equal(plan.week[0].game, 'boss_battle');
});

test('cleanPlanExplanation: drops weight talk in body-neutral mode and malformed output', () => {
  assert.equal(cleanPlanExplanation(null), null);
  assert.equal(cleanPlanExplanation({ summary: 'x' }), null);
  const ok = cleanPlanExplanation({ summary: 'A gentle week.', why: ['Fits your knees.', 'You will lose weight fast.'], swaps: ['Fewer calories at night', 'Water with lemon'] });
  assert.deepEqual(ok.why, ['Fits your knees.']);
  assert.deepEqual(ok.swaps, ['Water with lemon']);
});

test('screenCheckin: worrying words or mood 1 -> support screen', () => {
  assert.equal(screenCheckin({ mood: 4, energy: 4, note: 'I feel hopeless lately' }).level, 'support');
  assert.equal(screenCheckin({ mood: 3, note: "I don't want to be here anymore" }).level, 'support');
  assert.equal(screenCheckin({ mood: 1, energy: 3 }).level, 'support');
  assert.equal(screenCheckin({ mood: 2, energy: 3 }).level, 'gentle');
  assert.equal(screenCheckin({ mood: 4, energy: 4, note: 'knees a bit sore' }).level, 'ok');
  const support = supportPayload('pk');
  assert.ok(support.helplines.length >= 2);
  assert.ok(support.disclaimer.includes('not therapy'));
});

test('applySession: streak, XP, badges, garden and kids stickers', () => {
  const s = { game: 'boss_battle', mode: 'fit', minutes: 10, reps: 60, formScore: 80, moodBefore: 2, moodAfter: 4 };
  let { progress, gained } = applySession(initialProgress(), s, '2026-10-19');
  assert.equal(progress.streak, 1);
  assert.ok(gained.newBadges.includes('first_steps'));
  assert.equal(gained.moodLift, 2);
  assert.ok(progress.xp > 0);
  ({ progress } = applySession(progress, s, '2026-10-20'));
  ({ progress, gained } = applySession(progress, s, '2026-10-21'));
  assert.equal(progress.streak, 3);
  assert.ok(gained.newBadges.includes('streak_3'));
  assert.ok(progress.badges.includes('mood_lifter'));
  assert.ok(progress.badges.includes('moves_100'));
  // Same day again does not double-count the streak.
  ({ progress } = applySession(progress, s, '2026-10-21'));
  assert.equal(progress.streak, 3);
  // A gap resets the streak to 1.
  ({ progress } = applySession(progress, s, '2026-10-25'));
  assert.equal(progress.streak, 1);
  assert.equal(progress.bestStreak, 3);
  // A new week plants a new garden.
  ({ progress } = applySession(progress, s, '2026-10-26'));
  assert.equal(progress.garden.weekOf, '2026-10-26');

  const kid = applySession(initialProgress(), { game: 'jungle_quest', mode: 'kids', minutes: 10, reps: 20 }, '2026-10-19');
  assert.equal(kid.progress.stars, 3);
  assert.ok(kid.gained.sticker);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(50), 2);
});

test('applySession: chair-stand improvement earns Chair champ', () => {
  const base = { game: 'balance_bridge', mode: 'steady', minutes: 5, reps: 0 };
  let { progress } = applySession(initialProgress(), { ...base, chairStands: 8 }, '2026-10-19');
  assert.ok(!progress.badges.includes('chair_champ'));
  ({ progress } = applySession(progress, { ...base, chairStands: 10 }, '2026-10-26'));
  assert.ok(progress.badges.includes('chair_champ'));
  assert.equal(progress.bestChairStands, 10);
});

test('buildWeeklyStats: WHO minutes, mood lift and chair-stand trend', () => {
  const sessions = [
    { date: '2026-10-19', minutes: 30, reps: 50, formScore: 80, moodBefore: 2, moodAfter: 4, game: 'boss_battle' },
    { date: '2026-10-21', minutes: 45, reps: 70, formScore: 90, moodBefore: 3, moodAfter: 4, game: 'calm_river' },
    { date: '2026-10-01', minutes: 99, reps: 99, game: 'boss_battle' }, // outside the week
  ];
  const fallTests = [{ date: '2026-10-12', stands: 9 }, { date: '2026-10-19', stands: 11 }];
  const stats = buildWeeklyStats({ sessions, fallTests, progress: { streak: 2, level: 3 }, today: '2026-10-21' });
  assert.equal(stats.activeMinutes, 75);
  assert.equal(stats.whoPercent, 50);
  assert.equal(stats.sessions, 2);
  assert.equal(stats.reps, 120);
  assert.equal(stats.avgFormScore, 85);
  assert.equal(stats.moodLift, 1.5);
  assert.equal(stats.byDay.length, 7);
  assert.equal(stats.byDay.at(-1).date, '2026-10-21');
  assert.equal(stats.chairStand.change, 2);
  assert.match(reportSummary(stats, false), /75 minutes, 50% of the 150 minutes/);
});

test('templates: coach lines, celebrations, stories', () => {
  assert.match(coachLine({ game: 'calm_river', adapted: 'low_mood' }), /calm/i);
  assert.match(celebrationLine({ newBadges: ['streak_7'], streak: 7, level: 2 }, false), /7 days moving/);
  assert.match(storyFallback('jungle_quest', 0), /\{\{name\}\}/);
  assert.match(storyFallback('floor_is_lava', 99), /Safe at last/);
  const a = normalizeAnswers({ goal: 'balance', who: 'older_adult', sleep: 1, painAreas: ['knees'] });
  const ex = planExplanation(a, buildBasePlan(a));
  assert.ok(ex.why.length >= 2 && ex.why.length <= 4);
});

test('util: dates, PIN hashing, JSON extraction', () => {
  assert.equal(daysBetween('2026-10-18', '2026-10-21'), 3);
  assert.equal(mondayOf('2026-10-25'), '2026-10-19');
  assert.match(localDate('Asia/Karachi', new Date('2026-10-18T20:30:00Z')), /^2026-10-19$/);
  assert.equal(localDate('Not/AZone', new Date('2026-10-18T20:30:00Z')), '2026-10-18');
  const stored = hashPin('2468');
  assert.ok(verifyPin('2468', stored));
  assert.ok(!verifyPin('1111', stored));
  assert.ok(!verifyPin('2468', undefined));
  assert.deepEqual(extractJson('Sure!\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.equal(extractJson('no json here'), null);
});
