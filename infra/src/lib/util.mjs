// Small pure helpers shared by every function. No AWS SDK imports here so tests run without installs.
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export const newId = (prefix = 'u') => `${prefix}_${randomBytes(12).toString('base64url')}`;

export const pairCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const nowIso = () => new Date().toISOString();

export const ttlIn = (seconds) => Math.floor(Date.now() / 1000) + seconds;

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const sha1 = (text) => createHash('sha1').update(text).digest('hex');

export const round1 = (n) => Math.round(n * 10) / 10;

export const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export const avg = (xs) => (xs.length ? sum(xs) / xs.length : null);

/** Number in [lo, hi], or `def` when missing / not numeric. */
export function num(value, lo, hi, def = null) {
  if (value === undefined || value === null || value === '') return def;
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, lo, hi) : def;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) in the user's time zone. */
export function localDate(timeZone = 'UTC', date = new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Whole days from date a to date b (both YYYY-MM-DD). */
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(dateStr, n) {
  return new Date(Date.parse(`${dateStr}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(dateStr) {
  return (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function mondayOf(dateStr) {
  return addDays(dateStr, -weekdayIndex(dateStr));
}

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(pin), Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Keeps letters (any script), digits, spaces and . ' - ; trims to `max` chars. */
export function cleanName(value, max = 24) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return cleaned || null;
}

export function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}

/** Pulls the first JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Runs async `fn(item)` over items with at most `limit` in flight. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
