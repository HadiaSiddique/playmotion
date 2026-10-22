// Onboarding, plan, daily check-in, session results and the weekly report.
import { cleanLine, converse, converseJson } from '../lib/ai.mjs';
import { getItem, loadUser, publicView, putItem, queryPrefix, userPk } from '../lib/db.mjs';
import { HttpError, parseBody, query, requireUserId } from '../lib/http.mjs';
import { addNotice, publish } from '../lib/notify.mjs';
import { adaptToday, buildBasePlan, cleanPlanExplanation, normalizeAnswers, normalizeKid, planForAi, profileForAi } from '../lib/planner.mjs';
import { applySession, initialProgress } from '../lib/progress.mjs';
import { buildWeeklyStats } from '../lib/report.mjs';
import { screenCheckin, supportPayload } from '../lib/safety.mjs';
import { setUpReminders } from '../lib/schedule.mjs';
import { EXERCISES, GAMES, LANGUAGES, PAIN_AREAS } from '../lib/shared/catalog.mjs';
import { DISCLAIMER, celebrationLine, coachLine, familyCompletionText, planExplanation, reportSummary } from '../lib/templates.mjs';
import { avg, hashPin, isValidTimeZone, localDate, newId, nowIso, num, round1, sum, verifyPin } from '../lib/util.mjs';
import { speak } from '../lib/voice.mjs';

const languageName = (code) => LANGUAGES[code] ?? 'English';
const intIn = (v, lo, hi) => {
  const n = num(v, lo, hi, null);
  return n === null ? null : Math.round(n);
};

// ------------------------------------------------------------------ POST /onboard
export async function onboard(event) {
  const body = parseBody(event);
  const userId = body.userId ? requireUserId(body.userId) : newId('u');
  const pk = userPk(userId);
  const existing = body.userId ? await getItem(pk, 'PROFILE') : null;
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : existing?.timezone ?? 'UTC';
  const country = typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : existing?.country ?? null;
  const answers = normalizeAnswers(body.answers);
  const isKid = answers.who === 'kid';
  const at = nowIso();
  const pin = String(body.kid?.parentPin ?? body.parentPin ?? '');

  // Kids profiles are parent-controlled: changing one (or turning it into an adult one) needs the PIN.
  if (existing?.parentPinHash && !verifyPin(pin, existing.parentPinHash)) {
    throw new HttpError(403, 'PIN_INCORRECT', 'This profile is parent-controlled. Enter the parent PIN.');
  }

  let profile;
  if (isKid) {
    const kid = normalizeKid(body.kid);
    if (!kid) throw new HttpError(400, 'KID_NICKNAME_REQUIRED', 'Kids profiles need a nickname. No real name needed.');
    if (!existing?.parentPinHash && !/^\d{4,6}$/.test(pin)) throw new HttpError(400, 'PIN_REQUIRED', 'A parent needs to set a 4-6 digit PIN.');
    // Only what the games need. No other personal data is stored for kids.
    profile = {
      pk, sk: 'PROFILE', userId, kind: 'kid', kid, mobility: answers.mobility, language: answers.language, timezone, country,
      parentPinHash: existing?.parentPinHash ?? hashPin(pin), createdAt: existing?.createdAt ?? at, updatedAt: at,
    };
  } else {
    profile = {
      pk, sk: 'PROFILE', userId, kind: 'adult', answers, displayName: answers.displayName, language: answers.language, timezone, country,
      familyEnabled: existing?.familyEnabled ?? false, gsi1pk: existing?.gsi1pk, gsi1sk: existing?.gsi1sk,
      createdAt: existing?.createdAt ?? at, updatedAt: at,
    };
  }

  const plan = buildBasePlan(answers);
  let explanation;
  if (isKid) {
    explanation = {
      summary: 'Ten-minute story adventures where every jump, balance and stomp moves the story forward.',
      why: ['Short sessions with a move break built in.', 'Only safe moves: no flips or high jumps.', 'No ads, no chat, no accounts. A grown-up stays nearby.'],
      swaps: [],
      firstCoachLine: `Hi ${profile.kid.nickname}! Ready for an adventure?`,
      source: 'template',
    };
  } else {
    explanation = { ...planExplanation(answers, plan), source: 'template' };
    const prompt = [
      'A new PlayMotion user finished onboarding. Their anonymous answers:',
      JSON.stringify(profileForAi(answers)),
      'The app already built this safe weekly plan. Do not change its games, moves or minutes:',
      JSON.stringify(planForAi(plan)),
      answers.bodyNeutral ? 'Body-neutral mode is ON: do not mention weight, body size, calories or BMI.' : '',
      `Write in ${languageName(answers.language)}. Reply with JSON only, no markdown:`,
      '{"summary": "max 45 words, second person: what this week looks like and how it helps their goal",',
      ' "why": ["3 short reasons this plan fits them, each max 18 words, referring to their answers"],',
      ' "swaps": ["up to 3 small, realistic food swaps that fit their food habits, each max 16 words"],',
      ' "firstCoachLine": "max 14 words, spoken aloud at the start of their first session"}',
    ].filter(Boolean).join('\n');
    const ai = await converseJson({ prompt, maxTokens: 700, timeoutMs: 9000 }, (o) => cleanPlanExplanation(o, { bodyNeutral: answers.bodyNeutral }));
    if (ai) {
      explanation = { ...explanation, ...ai.data, firstCoachLine: ai.data.firstCoachLine ?? explanation.firstCoachLine, source: 'ai', model: ai.modelId };
      if (ai.data.swaps.length && plan.nutrition) plan.nutrition.swaps = ai.data.swaps;
    }
  }

  await Promise.all([
    putItem(profile),
    putItem({ pk, sk: 'PLAN', ...plan, explanation, createdAt: at }),
    putItem({ pk, sk: 'PROGRESS', ...initialProgress() }, { ConditionExpression: 'attribute_not_exists(pk)' }).catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }),
  ]);

  const reminders = isKid
    ? { session: false, water: false }
    : await setUpReminders({ userId, timezone, reminderTime: answers.reminderTime, water: answers.waterReminders });

  return { userId, profile: publicView(profile), plan: { ...plan, explanation }, reminders, disclaimer: DISCLAIMER };
}

// ------------------------------------------------------------------ GET /plan  (home dashboard)
export async function getPlan(event) {
  const userId = requireUserId(query(event).userId);
  const { profile, plan, progress } = await loadUser(userId);
  if (!plan) throw new HttpError(404, 'NO_PLAN', 'No plan yet. Run onboarding first.');
  const pk = userPk(userId);
  const date = localDate(profile.timezone);
  const [[lastCheckin], notices] = await Promise.all([queryPrefix(pk, 'CHECKIN#', { limit: 1 }), queryPrefix(pk, 'NOTICE#', { limit: 5 })]);
  const checkinToday = lastCheckin?.date === date ? lastCheckin : null;
  const nowSec = Date.now() / 1000;
  return {
    profile: publicView(profile),
    plan: publicView(plan),
    today: checkinToday?.today ?? adaptToday(plan, null, date),
    checkedInToday: Boolean(checkinToday),
    // So a workout started later today still gets "mood before" for the mood-lift graph.
    todayCheckin: checkinToday ? { mood: checkinToday.mood ?? null, energy: checkinToday.energy ?? null } : null,
    progress: publicView({ ...initialProgress(), ...progress }),
    notices: notices.filter((n) => !n.ttl || n.ttl > nowSec).map((n) => ({ kind: n.kind, text: n.text, at: n.at })),
    disclaimer: DISCLAIMER,
  };
}

// ------------------------------------------------------------------ POST /checkin
const ADAPT_REASON = {
  planned: 'as planned',
  feeling_good: 'a little harder because they feel good',
  low_mood: 'shorter and gentler because their mood is low',
  low_energy: 'shorter and gentler because their energy is low',
  pain: 'seated moves only because they reported pain',
};

export async function checkin(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const { profile, plan } = await loadUser(userId);
  if (!plan) throw new HttpError(404, 'NO_PLAN', 'No plan yet. Run onboarding first.');
  const pk = userPk(userId);
  const isKid = profile.kind === 'kid';
  const c = {
    mood: intIn(body.mood, 1, 5) ?? 3,
    energy: intIn(body.energy, 1, 5) ?? 3,
    sleep: intIn(body.sleep, 1, 5) ?? 3,
    pain: body.pain === true,
    painAreas: Array.isArray(body.painAreas) ? body.painAreas.filter((p) => PAIN_AREAS.includes(p)) : [],
  };
  // The free-text note is screened here and never stored or sent to a model.
  const screen = screenCheckin({ ...c, note: body.note });
  const date = localDate(profile.timezone);
  const at = nowIso();

  if (screen.level === 'support') {
    await putItem({ pk, sk: `CHECKIN#${at}`, date, at, ...c, safety: 'support' });
    const support = isKid
      ? { title: "Let's take a break", message: "It's okay to feel this way. Find a grown-up you trust and tell them how you feel.", helplines: [], gentleOption: { game: 'calm_river', minutes: 2, label: 'Slow breathing with the river (optional)' } }
      : supportPayload(profile.country);
    return { safety: { level: 'support', reasons: screen.reasons, ...support }, today: null, disclaimer: DISCLAIMER };
  }

  const today = adaptToday(plan, c, date);
  let line = coachLine(today, profile.language);
  let lineSource = 'template';
  if (!isKid) {
    const ai = await converse({
      prompt: [
        `Today's check-in (1 = low, 5 = high): mood ${c.mood}, energy ${c.energy}, sleep ${c.sleep}${c.pain ? ', reported some pain' : ''}.`,
        `The app picked today's session: ${GAMES[today.game].name}, ${today.minutes} minutes (${ADAPT_REASON[today.adapted]}).`,
        `Write ONE warm spoken line, max 22 words, that acknowledges how they feel and invites them to start. No emojis, no quotes. Write in ${languageName(profile.language)}.`,
      ].join('\n'),
      maxTokens: 120,
      timeoutMs: 3500,
    });
    const cleaned = cleanLine(ai?.text);
    if (cleaned) {
      line = cleaned;
      lineSource = 'ai';
    }
  }
  today.coachLine = line;
  const style = isKid ? 'kids' : today.game === 'calm_river' ? 'calm' : 'coach';
  const [voice] = await Promise.all([
    body.withVoice === false ? null : speak({ text: line, style, language: profile.language }),
    putItem({ pk, sk: `CHECKIN#${at}`, date, at, ...c, safety: screen.level, today }),
  ]);
  return { safety: { level: screen.level }, today, coach: { line, source: lineSource, audioUrl: voice?.url ?? null }, disclaimer: DISCLAIMER };
}

// ------------------------------------------------------------------ POST /session/complete
export async function completeSession(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const { profile, plan, progress } = await loadUser(userId);
  if (!GAMES[body.game]) throw new HttpError(400, 'BAD_GAME', `Unknown game "${body.game}".`);
  const pk = userPk(userId);
  const isKid = profile.kind === 'kid';

  const exercises = (Array.isArray(body.exercises) ? body.exercises : [])
    .filter((e) => e && EXERCISES[e.id])
    .slice(0, 12)
    .map((e) => ({ id: e.id, reps: intIn(e.reps, 0, 1000) ?? 0, seconds: intIn(e.seconds, 0, 3600) ?? 0, formScore: intIn(e.formScore, 0, 100) }));
  const durationSec = num(body.durationSec, 0, 3 * 3600, null);
  const forms = exercises.map((e) => e.formScore).filter(Number.isFinite);
  const s = {
    game: body.game,
    mode: plan?.mode ?? (isKid ? 'kids' : 'fit'),
    minutes: round1(durationSec !== null ? durationSec / 60 : num(body.minutes, 0, 180, 0)),
    reps: intIn(body.reps, 0, 5000) ?? sum(exercises.map((e) => e.reps)),
    formScore: intIn(body.formScore, 0, 100) ?? (forms.length ? Math.round(avg(forms)) : null),
    exercises,
    moodBefore: intIn(body.moodBefore, 1, 5),
    moodAfter: intIn(body.moodAfter, 1, 5),
    energyBefore: intIn(body.energyBefore, 1, 5),
    energyAfter: intIn(body.energyAfter, 1, 5),
    balanceSeconds: intIn(body.balanceSeconds, 0, 600),
    chairStands: body.fallTest?.type === 'chair_stand_30s' ? intIn(body.fallTest.stands, 0, 60) : null,
    stoppedEarly: body.stoppedEarly === true,
    stopReason: ['user', 'pain', 'safety', 'time'].includes(body.stopReason) ? body.stopReason : null,
  };

  const date = localDate(profile.timezone);
  const at = nowIso();
  const { progress: next, gained } = applySession({ ...initialProgress(), ...publicView(progress) }, s, date);
  const writes = [putItem({ pk, sk: `SESSION#${at}`, date, at, ...s }), putItem({ ...next, pk, sk: 'PROGRESS' })];
  if (Number.isFinite(s.chairStands)) writes.push(putItem({ pk, sk: `FALLTEST#${at}`, date, at, type: 'chair_stand_30s', stands: s.chairStands }));
  await Promise.all(writes);

  let sharedWithFamily = false;
  if (!isKid && profile.familyEnabled && !s.stoppedEarly) {
    const name = profile.displayName || 'Your family member';
    sharedWithFamily = await publish({
      userId,
      audience: 'family',
      subject: `${name} moved today ✓`,
      message: `${familyCompletionText(name, GAMES[s.game].name, Math.round(s.minutes))}\n\n${DISCLAIMER}`,
    });
    if (sharedWithFamily) await addNotice(userId, 'shared', 'Shared with your family circle ✓');
  }

  const line = celebrationLine(gained, isKid, profile.language);
  const voice = body.withVoice === false ? null : await speak({ text: line, style: isKid ? 'kids' : 'coach', language: profile.language });
  return {
    session: { date, ...s },
    gained,
    progress: publicView(next),
    celebration: { line, audioUrl: voice?.url ?? null },
    sharedWithFamily,
    followUp: s.stopReason === 'pain' ? { suggestSeated: true, message: 'Next time we can start with seated moves. If pain continues, please talk to a health professional.' } : null,
  };
}

// ------------------------------------------------------------------ GET /report, POST /report/share
async function buildReport(userId, { withAi = true } = {}) {
  const { profile, progress } = await loadUser(userId);
  const isKid = profile.kind === 'kid';
  const pk = userPk(userId);
  const from = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const [sessions, fallTests] = await Promise.all([queryPrefix(pk, 'SESSION#', { from }), queryPrefix(pk, 'FALLTEST#', { limit: 12 })]);
  const stats = buildWeeklyStats({ sessions, fallTests, progress: { ...initialProgress(), ...progress }, today: localDate(profile.timezone), isKid });

  let summary = reportSummary(stats, isKid, profile.language);
  let source = 'template';
  let model;
  if (withAi && !isKid && stats.sessions > 0) {
    const forAi = {
      activeMinutes: stats.activeMinutes, whoPercent: stats.whoPercent, sessions: stats.sessions, activeDays: stats.activeDays,
      reps: stats.reps, avgFormScore: stats.avgFormScore, moodLiftAfterSessions: stats.moodLift, energyLift: stats.energyLift,
      chairStand30s: stats.chairStand && { latest: stats.chairStand.latest, previous: stats.chairStand.previous, change: stats.chairStand.change },
      streakDays: stats.streak, level: stats.level, gamesPlayed: stats.games,
    };
    const bodyNeutral = profile.answers?.bodyNeutral !== false;
    const ai = await converse({
      prompt: [
        'Write a short weekly wellness report for a PlayMotion user. It is read aloud on their TV and may be shared with family.',
        `Stats for the last 7 days: ${JSON.stringify(forAi)}`,
        "Rules: plain language, max 90 words, second person, warm and honest. Compare active minutes with the WHO's 150 minutes a week.",
        'Mention the mood lift after sessions and the chair-stand trend only if present. End with one small, specific goal for next week.',
        bodyNeutral ? 'Never mention weight, body size or calories.' : '',
        `No medical claims, no markdown, no lists. Write in ${languageName(profile.language)}.`,
      ].filter(Boolean).join('\n'),
      maxTokens: 400,
      timeoutMs: 9000,
    });
    const text = ai?.text?.replace(/[*#`]/g, '').trim();
    if (text && text.length > 40) {
      summary = text.slice(0, 1200);
      source = 'ai';
      model = ai.modelId;
    }
  }
  return { profile, stats, summary, source, model, isKid };
}

export async function getReport(event) {
  const q = query(event);
  const report = await buildReport(requireUserId(q.userId), { withAi: q.ai !== '0' });
  const voice = q.voice === '1' ? await speak({ text: report.summary, style: 'coach', language: report.profile.language }) : null;
  return { stats: report.stats, summary: report.summary, source: report.source, model: report.model, audioUrl: voice?.url ?? null, disclaimer: DISCLAIMER };
}

export async function shareReport(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const report = await buildReport(userId, { withAi: body.ai !== false });
  if (report.isKid) throw new HttpError(403, 'KIDS_NOT_SHARED', 'Kids reports stay on the parent dashboard.');
  if (!report.profile.familyEnabled) throw new HttpError(409, 'NO_FAMILY', 'Add someone to your family circle first.');
  const name = report.profile.displayName || 'Your family member';
  const s = report.stats;
  const message = [
    `${name}'s PlayMotion week (${s.weekStart} to ${s.weekEnd})`,
    '',
    report.summary,
    '',
    `Active minutes: ${s.activeMinutes} of 150 (WHO guideline)`,
    `Sessions: ${s.sessions} | Streak: ${s.streak} days | Level ${s.level}`,
    s.moodLift !== null ? `Average mood lift after sessions: ${s.moodLift > 0 ? '+' : ''}${s.moodLift}` : null,
    s.chairStand ? `30-second chair stands: ${s.chairStand.latest}` : null,
    '',
    DISCLAIMER,
  ].filter((x) => x !== null).join('\n');
  const shared = await publish({ userId, audience: 'family', subject: `${name}'s PlayMotion week`, message });
  if (shared) await addNotice(userId, 'shared', 'Weekly report shared with your family ✓');
  return { shared, summary: report.summary };
}
