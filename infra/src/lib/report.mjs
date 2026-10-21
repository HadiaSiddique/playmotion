// Weekly report numbers. Pure: takes stored items, returns the stats the TV charts and the AI summarises.
import { addDays, avg, round1, sum } from './util.mjs';

export const WHO_WEEKLY_MINUTES = 150;

const finite = (xs) => xs.filter((x) => Number.isFinite(x));

export function last7Dates(today) {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

export function buildWeeklyStats({ sessions = [], fallTests = [], progress = {}, today, isKid = false }) {
  const days = last7Dates(today);
  const week = sessions.filter((s) => days.includes(s.date));

  const activeMinutes = Math.round(sum(week.map((s) => s.minutes ?? 0)));
  const lifts = week.filter((s) => Number.isFinite(s.moodBefore) && Number.isFinite(s.moodAfter)).map((s) => s.moodAfter - s.moodBefore);
  const energyLifts = week.filter((s) => Number.isFinite(s.energyBefore) && Number.isFinite(s.energyAfter)).map((s) => s.energyAfter - s.energyBefore);
  const form = finite(week.map((s) => s.formScore));

  const byDay = days.map((date) => {
    const ds = week.filter((s) => s.date === date);
    const before = avg(finite(ds.map((s) => s.moodBefore)));
    const after = avg(finite(ds.map((s) => s.moodAfter)));
    return {
      date,
      minutes: Math.round(sum(ds.map((s) => s.minutes ?? 0))),
      sessions: ds.length,
      moodBefore: before === null ? null : round1(before),
      moodAfter: after === null ? null : round1(after),
    };
  });

  const games = {};
  for (const s of week) games[s.game] = (games[s.game] ?? 0) + 1;

  const tests = [...fallTests].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = tests.at(-1) ?? null;
  const previous = tests.length > 1 ? tests.at(-2) : null;

  return {
    weekStart: days[0],
    weekEnd: days[6],
    activeMinutes,
    whoTargetMinutes: isKid ? null : WHO_WEEKLY_MINUTES,
    whoPercent: isKid ? null : Math.min(100, Math.round((activeMinutes / WHO_WEEKLY_MINUTES) * 100)),
    sessions: week.length,
    activeDays: byDay.filter((d) => d.sessions > 0).length,
    reps: sum(week.map((s) => s.reps ?? 0)),
    avgFormScore: form.length ? Math.round(avg(form)) : null,
    moodLift: lifts.length ? round1(avg(lifts)) : null,
    energyLift: energyLifts.length ? round1(avg(energyLifts)) : null,
    byDay,
    games,
    chairStand: latest
      ? { latest: latest.stands, latestDate: latest.date, previous: previous?.stands ?? null, change: previous ? latest.stands - previous.stands : null, history: tests.slice(-8).map((t) => ({ date: t.date, stands: t.stands })) }
      : null,
    streak: progress.streak ?? 0,
    level: progress.level ?? 1,
    xp: progress.xp ?? 0,
    badges: progress.badges ?? [],
    garden: progress.garden ?? null,
    stars: isKid ? progress.stars ?? 0 : undefined,
    stickers: isKid ? progress.stickers ?? [] : undefined,
  };
}
