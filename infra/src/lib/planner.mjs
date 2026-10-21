// Deterministic planner. Rules build the plan structure (games, exercises, targets) so it is
// always safe for the person's mobility and pain; Bedrock only personalises the wording.
import {
  ACTIVITY_LEVELS, AGE_BANDS, AVATARS, DAYS, EXERCISES, GAMES, GOAL_TO_MODE, LANGUAGES, MOBILITY,
  PAIN_AREAS, SESSION_MINUTES, WEEK_TEMPLATES, WHO, painLabel, safeExercise,
} from './shared/catalog.mjs';
import { clamp, cleanName, weekdayIndex } from './util.mjs';

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const int = (value, fallback) => {
  const n = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(n) ? fallback : Math.round(n);
};

export function normalizeAnswers(raw = {}) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const who = pick(a.who, WHO, 'adult');
  const food = a.food && typeof a.food === 'object' ? a.food : {};
  return {
    who,
    goal: pick(a.goal, Object.keys(GOAL_TO_MODE), who === 'older_adult' ? 'balance' : 'get_stronger'),
    mobility: pick(a.mobility, MOBILITY, 'unsupported'),
    painAreas: Array.isArray(a.painAreas) ? [...new Set(a.painAreas.filter((p) => PAIN_AREAS.includes(p)))] : [],
    activityLevel: pick(a.activityLevel, ACTIVITY_LEVELS, 'some'),
    food: {
      mealsPerDay: clamp(int(food.mealsPerDay, 3), 1, 6),
      sugaryDrinks: pick(food.sugaryDrinks, ['none', 'some', 'daily'], 'some'),
      eatingOut: pick(food.eatingOut, ['mostly_home', 'mixed', 'mostly_outside'], 'mixed'),
    },
    sleep: clamp(int(a.sleep, 3), 1, 5),
    mood: clamp(int(a.mood, 3), 1, 5),
    sessionMinutes: pick(int(a.sessionMinutes, 10), SESSION_MINUTES, 10),
    language: pick(a.language, Object.keys(LANGUAGES), 'en-US'),
    shareWith: pick(a.shareWith, ['nobody', 'family', 'physio'], 'nobody'),
    displayName: cleanName(a.displayName),
    // 'none' = the person chose "No reminders".
    reminderTime: a.reminderTime === 'none' ? null : typeof a.reminderTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(a.reminderTime) ? a.reminderTime : '18:00',
    waterReminders: a.reminderTime !== 'none' && a.waterReminders !== false,
    calorieCounting: a.calorieCounting === true, // OFF by default
    bodyNeutral: a.bodyNeutral !== false, // ON by default: never show or mention weight
  };
}

/** Kid profile = nickname + avatar (+ optional age band). Nothing else is stored. */
export function normalizeKid(raw = {}) {
  const nickname = cleanName(raw?.nickname, 16);
  if (!nickname) return null;
  return {
    nickname,
    avatar: pick(raw.avatar, AVATARS, AVATARS[0]),
    ageBand: pick(raw.ageBand, AGE_BANDS, null),
  };
}

export const modeFor = (a) => (a.who === 'kid' ? 'kids' : GOAL_TO_MODE[a.goal] ?? 'fit');

/** Highest intensity this person should get, whatever their check-in says. */
export const maxIntensityFor = (a) =>
  a.painAreas?.includes('full_body') ? 1 : a.who === 'older_adult' || a.mobility !== 'unsupported' || a.goal === 'recover' ? 2 : 3;

export function intensityFor(a) {
  let level = { low: 1, some: 2, active: 3 }[a.activityLevel] ?? 2;
  if (a.sleep <= 2) level -= 1;
  return clamp(level, 1, maxIntensityFor(a));
}

const REPS = { 1: 8, 2: 12, 3: 16 };
const HOLD_SECONDS = { 1: 15, 2: 25, 3: 30 };
const BREATHS = { 1: 6, 2: 8, 3: 10 };

export function targetFor(exerciseId, intensity) {
  const unit = EXERCISES[exerciseId]?.unit;
  if (unit === 'seconds') return HOLD_SECONDS[intensity];
  if (unit === 'breaths') return BREATHS[intensity];
  if (unit === 'rounds') return 4 + intensity * 2;
  return REPS[intensity];
}

export function exercisesForGame(gameId, ctx, intensity, max = 3) {
  const out = [];
  for (const id of GAMES[gameId]?.exercises ?? []) {
    const safe = safeExercise(id, ctx);
    if (safe && !out.some((e) => e.id === safe)) out.push({ id: safe, target: targetFor(safe, intensity) });
    if (out.length >= max) break;
  }
  return out;
}

export function foodSwaps(food) {
  const swaps = [];
  if (food.sugaryDrinks === 'daily') swaps.push('Swap one sugary drink a day for water with lemon or mint.');
  else if (food.sugaryDrinks === 'some') swaps.push('Try sparkling water or unsweetened tea instead of one fizzy drink.');
  if (food.eatingOut === 'mostly_outside') swaps.push('When eating out, add a salad or daal and share the fried sides.');
  else swaps.push('Add a handful of vegetables to one home-cooked meal a day.');
  if (food.mealsPerDay <= 2) swaps.push('A small protein snack like yogurt, nuts or an egg can keep your energy steady.');
  else if (food.mealsPerDay >= 5) swaps.push('Keep fruit in sight for between-meal snacks.');
  return swaps.slice(0, 3);
}

export function safetyNotes(a) {
  const notes = [];
  if (a.mobility === 'chair') notes.push('Keep a sturdy chair next to you for support.');
  if (a.mobility === 'seated' || a.mobility === 'wheelchair') notes.push('Every move is seated. If you use a wheelchair, lock the brakes first.');
  if (a.who === 'older_adult') notes.push('Clear the floor around you and wear non-slip shoes.');
  if (a.who === 'kid') notes.push('An adult should be nearby while kids play. No flips or high jumps.');
  if (a.painAreas.includes('full_body')) notes.push('You feel aches all over, so every move is gentle and low-impact. Say "stop" if anything hurts.');
  else if (a.painAreas.length) notes.push(`We skip moves that load your ${a.painAreas.map(painLabel).join(', ')}. Say "stop" if anything hurts.`);
  notes.push('Wellness coaching, not a medical device. If you have a health condition, check with your doctor before starting new exercise.');
  return notes;
}

export function buildBasePlan(a) {
  const mode = modeFor(a);
  const ctx = { mobility: a.mobility, who: a.who, painAreas: a.painAreas };
  const intensity = mode === 'kids' ? 2 : intensityFor(a);
  const minutes = mode === 'kids' ? 10 : a.sessionMinutes;
  let template = WEEK_TEMPLATES[mode];
  // A low starting mood swaps two harder days for gentle Calm River sessions.
  if (a.mood <= 2 && mode !== 'calm' && mode !== 'kids') {
    template = template.map((game, i) => (i === 2 || i === 5 ? 'calm_river' : game));
  }
  const week = template.map((game, i) => {
    const calm = game === 'calm_river';
    const dayIntensity = calm ? 1 : intensity;
    return {
      day: DAYS[i],
      game,
      minutes: calm ? Math.min(minutes, 5) : minutes,
      intensity: dayIntensity,
      exercises: exercisesForGame(game, ctx, dayIntensity),
    };
  });
  return {
    version: 1,
    mode,
    ctx,
    intensity,
    maxIntensity: mode === 'kids' ? 2 : maxIntensityFor(a),
    sessionMinutes: minutes,
    posture: a.mobility === 'seated' || a.mobility === 'wheelchair' ? 'seated' : 'standing',
    week,
    goals: {
      weeklyActiveMinutes: mode === 'kids' ? null : 150, // WHO adult guideline
      plannedMinutes: week.reduce((s, d) => s + d.minutes, 0),
    },
    nutrition:
      mode === 'kids'
        ? null
        : { calorieCounting: a.calorieCounting, bodyNeutral: a.bodyNeutral, waterReminders: a.waterReminders, swaps: foodSwaps(a.food) },
    safetyNotes: safetyNotes(a),
    physioNote: mode === 'recover' ? 'Preview: in the full version your physiotherapist prescribes these exercises.' : undefined,
  };
}

/**
 * Today's session, adapted to the daily check-in:
 *  pain -> seated versions; low mood/energy -> 5-min Calm River; feeling good -> one step harder.
 */
export function adaptToday(plan, checkin, date) {
  const base = plan.week[weekdayIndex(date)];
  const today = { date, ...structuredClone(base), adapted: 'planned' };
  if (!checkin) return today;

  const mood = checkin.mood ?? 3;
  const energy = checkin.energy ?? 3;
  const sleep = checkin.sleep ?? 3;
  const pain = checkin.pain === true;

  if (plan.mode === 'kids') {
    if (energy <= 2) {
      today.game = 'freeze_dance';
      today.exercises = exercisesForGame('freeze_dance', plan.ctx, 1);
      today.adapted = 'low_energy';
    }
    return today;
  }

  const ctx = pain
    ? { ...plan.ctx, mobility: 'seated', painAreas: [...new Set([...(plan.ctx.painAreas ?? []), ...(checkin.painAreas ?? [])])] }
    : plan.ctx;

  if (mood <= 2 || energy <= 2) {
    today.game = 'calm_river';
    today.minutes = Math.min(5, plan.sessionMinutes);
    today.intensity = 1;
    today.exercises = exercisesForGame('calm_river', ctx, 1);
    today.adapted = mood <= 2 ? 'low_mood' : 'low_energy';
  } else if (pain) {
    today.intensity = 1;
    today.exercises = exercisesForGame(today.game, ctx, 1);
    today.adapted = 'pain';
  } else if (mood >= 4 && energy >= 4 && sleep >= 3) {
    if (today.intensity < plan.maxIntensity) {
      today.intensity += 1;
      today.exercises = exercisesForGame(today.game, ctx, today.intensity);
    } else {
      today.minutes = Math.min(20, today.minutes + 2);
    }
    today.adapted = 'feeling_good';
  }
  if (pain) today.posture = 'seated';
  return today;
}

/** Accepts only well-formed model output for the plan explanation; trims every field. */
export function cleanPlanExplanation(o, { bodyNeutral = true } = {}) {
  if (!o || typeof o.summary !== 'string' || !Array.isArray(o.why)) return null;
  const str = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : null);
  const neutral = (s) => !bodyNeutral || !/\b(weight|kgs?|kilos?|pounds?|lbs?|calories?|bmi|fat)\b/i.test(s);
  const why = o.why.map((s) => str(s, 200)).filter(Boolean).filter(neutral).slice(0, 4);
  const summary = str(o.summary, 400);
  if (!summary || !neutral(summary) || !why.length) return null;
  return {
    summary,
    why,
    swaps: Array.isArray(o.swaps) ? o.swaps.map((s) => str(s, 160)).filter(Boolean).filter(neutral).slice(0, 3) : [],
    firstCoachLine: str(o.firstCoachLine, 160),
  };
}

/** What Bedrock sees: no name, no free text, no identifiers. */
export function profileForAi(a) {
  return {
    who: a.who, goal: a.goal, mobility: a.mobility, painAreas: a.painAreas, activityLevel: a.activityLevel,
    food: a.food, sleep1to5: a.sleep, mood1to5: a.mood, sessionMinutes: a.sessionMinutes,
  };
}

export function planForAi(plan) {
  return {
    mode: plan.mode,
    posture: plan.posture,
    intensity: plan.intensity,
    week: plan.week.map((d) => ({ day: d.day, game: GAMES[d.game].name, minutes: d.minutes, moves: d.exercises.map((e) => EXERCISES[e.id].name) })),
  };
}
