// XP, levels, streaks, gentle badges, the weekly garden and kids' stars/stickers. Pure functions.
import { STICKERS } from './shared/catalog.mjs';
import { daysBetween, mondayOf } from './util.mjs';

// Garden stages: seed, sprout, seedling, bud, flower, full bloom.
export const GARDEN_STAGE_DROPS = [0, 15, 40, 80, 130, 200];

export function initialProgress() {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    sessions: 0,
    totalMinutes: 0,
    totalReps: 0,
    calmSessions: 0,
    moodLifts: 0,
    bestChairStands: null,
    badges: [],
    garden: { weekOf: null, drops: 0, stage: 0, gardensGrown: 0 },
    stars: 0,
    stickers: [],
  };
}

export const levelForXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;

export const xpForLevel = (level) => 50 * (level - 1) ** 2;

export function xpForSession(s) {
  const completion = s.stoppedEarly ? 0 : 10;
  return Math.round(s.reps + s.minutes * 5 + (s.formScore ?? 0) / 10 + completion);
}

export const gardenStage = (drops) => GARDEN_STAGE_DROPS.filter((t) => drops >= t).length - 1;

/**
 * Applies a finished session to progress. Returns the new progress (input is not mutated)
 * and what was gained, for the celebration screen.
 */
export function applySession(previous, s, today) {
  const p = structuredClone(previous ?? initialProgress());
  const newBadges = [];
  const award = (id) => {
    if (!p.badges.includes(id)) {
      p.badges.push(id);
      newBadges.push(id);
    }
  };

  // Streak (one active day counts once).
  if (p.lastActiveDate !== today) {
    const gap = p.lastActiveDate ? daysBetween(p.lastActiveDate, today) : null;
    p.streak = gap === 1 ? p.streak + 1 : 1;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    p.lastActiveDate = today;
  }

  p.sessions += 1;
  p.totalMinutes += s.minutes;
  p.totalReps += s.reps;
  if (s.game === 'calm_river') p.calmSessions += 1;
  const lifted = Number.isFinite(s.moodBefore) && Number.isFinite(s.moodAfter) && s.moodAfter > s.moodBefore;
  if (lifted) p.moodLifts += 1;

  // Garden: every rep (or calm minute) is a drop of water; a new plant each week.
  const week = mondayOf(today);
  if (p.garden.weekOf !== week) {
    if (p.garden.stage >= GARDEN_STAGE_DROPS.length - 1) p.garden.gardensGrown += 1;
    p.garden = { weekOf: week, drops: 0, stage: 0, gardensGrown: p.garden.gardensGrown };
  }
  const stageBefore = p.garden.stage;
  p.garden.drops += s.game === 'calm_river' ? s.minutes * 4 : s.reps;
  p.garden.stage = gardenStage(p.garden.drops);

  // XP + level
  const levelBefore = p.level;
  const xp = xpForSession(s);
  p.xp += xp;
  p.level = levelForXp(p.xp);

  // Badges
  if (p.sessions === 1) award('first_steps');
  if (p.streak >= 3) award('streak_3');
  if (p.streak >= 7) award('streak_7');
  if (p.moodLifts >= 3) award('mood_lifter');
  if (p.garden.stage === GARDEN_STAGE_DROPS.length - 1) award('garden_bloom');
  if (p.totalReps >= 100) award('moves_100');
  if (p.totalReps >= 500) award('moves_500');
  if ((s.balanceSeconds ?? 0) >= 30) award('steady_feet');
  if (p.calmSessions >= 3) award('calm_keeper');
  if (Number.isFinite(s.chairStands)) {
    if (p.bestChairStands !== null && s.chairStands > p.bestChairStands) award('chair_champ');
    p.bestChairStands = Math.max(p.bestChairStands ?? 0, s.chairStands);
  }

  // Kids: stars for effort (never for speed or score) and a sticker every session.
  let sticker = null;
  if (s.mode === 'kids') {
    p.stars += s.minutes >= 8 ? 3 : s.minutes >= 4 ? 2 : 1;
    sticker = STICKERS[p.stickers.length % STICKERS.length];
    p.stickers.push(sticker);
  }

  return {
    progress: p,
    gained: {
      xp,
      level: p.level,
      levelUp: p.level > levelBefore,
      nextLevelXp: xpForLevel(p.level + 1),
      streak: p.streak,
      newBadges,
      gardenStage: p.garden.stage,
      gardenGrew: p.garden.stage > stageBefore,
      moodLift: lifted ? s.moodAfter - s.moodBefore : 0,
      sticker,
    },
  };
}
