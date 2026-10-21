// Meal photo tips (Bedrock vision), Polly voice lines, the in-game voice pack and kids' story narration.
import { VISION_MODELS, converse, converseJson } from '../lib/ai.mjs';
import { getItem, loadUser, putItem, userPk } from '../lib/db.mjs';
import { HttpError, parseBody, query, requireUserId } from '../lib/http.mjs';
import { GAMES, LANGUAGES } from '../lib/shared/catalog.mjs';
import { cueLines, mealFallback, storyExerciseNames, storyFallback } from '../lib/templates.mjs';
import { mapLimit, nowIso, num, ttlIn } from '../lib/util.mjs';
import { speak } from '../lib/voice.mjs';

const STYLES = ['coach', 'calm', 'kids'];
const MAX_IMAGE_BYTES = 3_500_000;
const languageName = (code) => LANGUAGES[code] ?? 'English';
const pickLanguage = (code) => (LANGUAGES[code] ? code : 'en-US');

// ------------------------------------------------------------------ POST /meal
export function decodeImage(image, mediaType) {
  if (typeof image !== 'string' || !image) throw new HttpError(400, 'IMAGE_REQUIRED', 'Send the photo as a base64 string in "image".');
  const match = image.match(/^data:(image\/[a-z]+);base64,(.*)$/s);
  const type = (match?.[1] ?? mediaType ?? 'image/jpeg').toLowerCase();
  const format = { 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  if (!format) throw new HttpError(400, 'IMAGE_TYPE', 'Use a JPEG, PNG or WebP photo.');
  const bytes = Buffer.from(match ? match[2] : image, 'base64');
  if (bytes.length < 100) throw new HttpError(400, 'IMAGE_EMPTY', 'That photo looks empty. Please try again.');
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Photo is too large. Resize it to about 1024 px wide before sending.');
  return { format, bytes };
}

const WEIGHT_WORDS = /\b(weight|kg|kilo|pounds?|lbs?|bmi|fat|diet)\b/i;
const CALORIE_WORDS = /\b(k?cal|calories?)\b/i;

function cleanMeal(settings) {
  return (o) => {
    if (!o || typeof o.isFood !== 'boolean') return null;
    if (!o.isFood) return { isFood: false, message: "That doesn't look like a meal. Want to try another photo?" };
    const ok = (s) => typeof s === 'string' && s.trim() && (!settings.bodyNeutral || !WEIGHT_WORDS.test(s)) && (settings.calorieCounting || !CALORIE_WORDS.test(s));
    const list = (xs, n) => (Array.isArray(xs) ? xs.filter(ok).map((s) => s.trim().slice(0, 160)).slice(0, n) : []);
    const tips = list(o.tips, 3);
    if (!tips.length) return null;
    return {
      isFood: true,
      looksLike: ok(o.looksLike) ? o.looksLike.trim().slice(0, 80) : null,
      positives: list(o.positives, 2),
      tips,
      swap: ok(o.swap) ? o.swap.trim().slice(0, 160) : null,
      waterNudge: ok(o.waterNudge) ? o.waterNudge.trim().slice(0, 120) : null,
      calories: settings.calorieCounting && typeof o.calories === 'string' ? o.calories.slice(0, 40) : undefined,
    };
  };
}

export async function meal(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const { profile } = await loadUser(userId);
  if (profile.kind === 'kid') throw new HttpError(403, 'NOT_FOR_KIDS', 'Meal photos are not part of Kids mode.');
  const image = decodeImage(body.image, body.mediaType);
  const a = profile.answers ?? {};
  const settings = { bodyNeutral: a.bodyNeutral !== false, calorieCounting: a.calorieCounting === true };
  const eating = { mostly_home: 'mostly home-cooked food', mixed: 'a mix of home and outside food', mostly_outside: 'mostly outside food' }[a.food?.eatingOut] ?? 'a mix of home and outside food';

  const prompt = [
    'Look at this photo of a meal and give gentle, practical food-balance feedback.',
    `About the person: ${a.food?.mealsPerDay ?? 3} meals a day, sugary drinks: ${a.food?.sugaryDrinks ?? 'some'}, eats ${eating}.`,
    settings.calorieCounting ? 'They turned calorie estimates ON: you may give one rough calorie range.' : 'Calorie counting is OFF: never mention calories.',
    settings.bodyNeutral ? 'Body-neutral mode is ON: never mention weight, body size, BMI or dieting.' : '',
    'Be kind and specific. Never call food good or bad. Respect cultural dishes (for example South Asian, Middle Eastern or Latin food).',
    `Write in ${languageName(profile.language)}. Reply with JSON only, no markdown:`,
    '{"isFood": true, "looksLike": "short name of the meal", "positives": ["1-2 genuine positives"], "tips": ["up to 3 gentle balance tips, max 16 words each"], "swap": "one small swap that fits their habits, or null", "waterNudge": "one short hydration nudge", "calories": "range like 500-650 kcal, or null"}',
    'If the photo is not food, reply {"isFood": false}.',
  ].filter(Boolean).join('\n');

  const ai = await converseJson({ prompt, images: [image], maxTokens: 500, timeoutMs: 12000, models: VISION_MODELS }, cleanMeal(settings));
  const result = ai ? { ...ai.data, source: 'ai', model: ai.modelId } : { ...mealFallback(a.food), source: 'template' };
  const at = nowIso();
  // The photo itself is never stored.
  await putItem({ pk: userPk(userId), sk: `MEAL#${at}`, at, looksLike: result.looksLike ?? null, tips: result.tips ?? [], source: result.source, ttl: ttlIn(30 * 86_400) });
  return { ...result, disclaimer: 'Gentle tips, not medical or dietary advice.' };
}

// ------------------------------------------------------------------ POST /tts
export async function tts(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const profile = await getItem(userPk(userId), 'PROFILE');
  if (!profile) throw new HttpError(404, 'USER_NOT_FOUND', 'Unknown userId.');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 600) throw new HttpError(400, 'BAD_TEXT', 'Send 1-600 characters of text.');
  // No language given: speak in the person's coach language (kids profiles are English).
  const language = pickLanguage(body.language ?? (profile.kind === 'kid' ? 'en-US' : profile.language));
  return speak({ text, style: STYLES.includes(body.style) ? body.style : 'coach', language });
}

// ------------------------------------------------------------------ GET /voice/pack?style=coach&language=en-US
// Pre-synthesises the short in-game cues so the TV can play them instantly (cached in S3 after the first call).
export async function voicePack(event) {
  const q = query(event);
  const style = STYLES.includes(q.style) ? q.style : 'coach';
  const language = pickLanguage(q.language);
  // Kids mode is English only; adults hear their coach language.
  const entries = Object.entries(cueLines(style, style === 'kids' ? 'en-US' : language));
  const results = await mapLimit(entries, 5, async ([id, text]) => {
    const r = await speak({ text, style, language });
    return [id, { text, url: r.url }];
  });
  return { style, language, cues: Object.fromEntries(results) };
}

// ------------------------------------------------------------------ POST /story  (Kids mode narrator)
const KIDS_SYSTEM =
  'You write narration for PlayMotion Kids, a movement game for children aged 5 to 12, played on a TV with a grown-up nearby. ' +
  'Always playful, excited and encouraging, like a fun storyteller, with simple words and short sentences. Never scary or violent, no brand names or characters ' +
  'from films, TV or games, no comments about food or bodies, and never suggest flips, high jumps or anything unsafe.';

export async function story(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const { profile } = await loadUser(userId);
  if (profile.kind !== 'kid') throw new HttpError(403, 'KIDS_ONLY', 'Story narration is part of Kids mode.');
  const game = GAMES[body.game]?.story ? body.game : 'jungle_quest';
  const chapter = Math.round(num(body.chapter, 0, 4, 0));
  const moves = storyExerciseNames(game);
  const move = moves[chapter % moves.length];

  let text = storyFallback(game, chapter);
  let source = 'template';
  // The child's nickname is never sent to the model: it writes {{name}} and we fill it in.
  const ai = await converse({
    system: KIDS_SYSTEM,
    prompt: [
      `Story game: "${GAMES[game].name}". Chapter ${chapter + 1} of 5${chapter === 4 ? ' (the happy ending, celebrate the hero)' : ''}.`,
      chapter === 4 ? '' : `The move for this chapter: ${move}.`,
      'Write 2 or 3 short sentences (max 40 words) that continue the adventure and tell the hero what to do now.',
      `Call the hero exactly {{name}} (keep the curly braces). Write in ${languageName(profile.language)}. Reply with the narration only.`,
    ].filter(Boolean).join('\n'),
    maxTokens: 200,
    timeoutMs: 4000,
  });
  const line = ai?.text?.replace(/[*#`"]/g, '').replace(/\s+/g, ' ').trim();
  if (line && line.includes('{{name}}') && line.length < 400 && !/[<>]/.test(line)) {
    text = line;
    source = 'ai';
  }
  const spoken = text.replaceAll('{{name}}', profile.kid.nickname);
  const voice = await speak({ text: spoken, style: 'kids', language: profile.language });
  return { game, chapter, lastChapter: chapter >= 4, move: chapter === 4 ? null : move, text: spoken, source, audioUrl: voice.url };
}
