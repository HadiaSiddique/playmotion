// Family circle (SNS email updates + gentle inactivity alerts) and the Kids-mode parent PIN.
import { getItem, loadUser, putItem, queryPrefix, updateItem, userPk } from '../lib/db.mjs';
import { HttpError, parseBody, query, requireUserId } from '../lib/http.mjs';
import { subscribeEmail } from '../lib/notify.mjs';
import { cleanName, maskEmail, newId, nowIso, verifyPin } from '../lib/util.mjs';

const MAX_MEMBERS = 6;
const PIN_MAX_TRIES = 5;
const PIN_LOCK_MS = 5 * 60_000;

const memberView = (m) => ({
  memberId: m.memberId, name: m.name, relation: m.relation, audience: m.audience,
  email: m.email ? maskEmail(m.email) : null, status: m.status, addedAt: m.addedAt,
});

// ------------------------------------------------------------------ GET /family?userId=
export async function listFamily(event) {
  const userId = requireUserId(query(event).userId);
  const { profile } = await loadUser(userId);
  const pk = userPk(userId);
  const [members, notices] = await Promise.all([queryPrefix(pk, 'FAMILY#'), queryPrefix(pk, 'NOTICE#', { limit: 10 })]);
  return {
    familyEnabled: Boolean(profile.familyEnabled),
    members: members.map(memberView),
    feed: notices.filter((n) => n.kind === 'shared').map((n) => ({ text: n.text, at: n.at })),
  };
}

// ------------------------------------------------------------------ POST /family
// { userId, name, relation?, email?, isMe? }  isMe=true subscribes the user to their own reminders.
export async function addFamily(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const { profile } = await loadUser(userId);
  if (profile.kind === 'kid') throw new HttpError(403, 'NOT_FOR_KIDS', 'Kids profiles do not have a family circle.');
  const name = cleanName(body.name, 30);
  if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'Add a name, for example "Sara" or "My son".');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'BAD_EMAIL', 'That email address does not look right.');
  const audience = body.isMe === true ? 'self' : 'family';

  const pk = userPk(userId);
  const existing = await queryPrefix(pk, 'FAMILY#');
  if (existing.length >= MAX_MEMBERS) throw new HttpError(409, 'CIRCLE_FULL', `A family circle can have up to ${MAX_MEMBERS} people.`);

  const subscriptionArn = email ? await subscribeEmail({ userId, email, audience }) : null;
  const member = {
    pk, sk: `FAMILY#${newId('f')}`, name, relation: cleanName(body.relation, 20), audience, email: email || null, subscriptionArn,
    status: email ? 'email_confirmation_sent' : 'tv_only', addedAt: nowIso(),
  };
  member.memberId = member.sk.slice('FAMILY#'.length);
  await putItem(member);

  if (audience === 'family' && !profile.familyEnabled) {
    await updateItem({
      Key: { pk, sk: 'PROFILE' },
      UpdateExpression: 'SET familyEnabled = :t, gsi1pk = :g, gsi1sk = :u',
      ExpressionAttributeValues: { ':t': true, ':g': 'FAMILY', ':u': userId },
    });
  }
  return {
    member: memberView(member),
    note: email ? 'They will get an email from "AWS Notifications" asking them to confirm. Updates start after they click it.' : 'Added without email: updates show on the TV only.',
  };
}

// ------------------------------------------------------------------ POST /kids/verify-pin  { userId, pin }
export async function verifyKidPin(event) {
  const body = parseBody(event);
  const userId = requireUserId(body.userId);
  const pk = userPk(userId);
  const profile = await getItem(pk, 'PROFILE');
  if (!profile?.parentPinHash) throw new HttpError(404, 'NO_PIN', 'This profile has no parent PIN.');
  const now = Date.now();
  if ((profile.pinLockedUntil ?? 0) > now) throw new HttpError(429, 'PIN_LOCKED', 'Too many tries. Please wait 5 minutes.');
  const ok = verifyPin(String(body.pin ?? ''), profile.parentPinHash);
  const failures = ok ? 0 : (profile.pinFailures ?? 0) + 1;
  const locked = failures >= PIN_MAX_TRIES;
  await updateItem({
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET pinFailures = :f, pinLockedUntil = :l',
    ExpressionAttributeValues: { ':f': locked ? 0 : failures, ':l': locked ? now + PIN_LOCK_MS : 0 },
  });
  return { ok, attemptsLeft: ok ? null : locked ? 0 : PIN_MAX_TRIES - failures };
}
