// Invoked by EventBridge Scheduler:
//   { type: 'session-reminder' | 'water-reminder', userId }  per-user schedules created at onboarding
//   { type: 'inactivity-scan' }                               daily, defined in template.yaml
import { getItem, putItem, queryGsi1, userPk } from '../lib/db.mjs';
import { addNotice, publish } from '../lib/notify.mjs';
import { inactivityText, reminderText } from '../lib/templates.mjs';
import { daysBetween, localDate } from '../lib/util.mjs';

const INACTIVE_DAYS = 3;

async function reminder(userId, kind) {
  const profile = await getItem(userPk(userId), 'PROFILE');
  if (!profile) return { skipped: 'no_profile' };
  if (kind === 'session') {
    // Skip the nudge if they already moved today.
    const progress = await getItem(userPk(userId), 'PROGRESS');
    if (progress?.lastActiveDate === localDate(profile.timezone)) return { skipped: 'already_active' };
  }
  await addNotice(userId, kind, reminderText[kind]);
  const subject = kind === 'session' ? 'Time to move with PlayMotion' : 'Water break';
  const emailed = await publish({ userId, audience: 'self', subject, message: reminderText[kind] });
  return { notice: true, emailed };
}

async function inactivityScan() {
  const users = await queryGsi1('FAMILY');
  let alerted = 0;
  for (const { gsi1sk: userId } of users) {
    const pk = userPk(userId);
    const [profile, progress] = await Promise.all([getItem(pk, 'PROFILE'), getItem(pk, 'PROGRESS')]);
    if (!profile?.familyEnabled || profile.kind === 'kid') continue;
    const today = localDate(profile.timezone);
    const lastActive = progress?.lastActiveDate ?? profile.createdAt?.slice(0, 10);
    if (!lastActive) continue;
    const idle = daysBetween(lastActive, today);
    // One gentle alert per quiet spell.
    if (idle < INACTIVE_DAYS || (progress?.lastInactivityAlert && progress.lastInactivityAlert >= lastActive)) continue;
    const name = profile.displayName || 'your family member';
    const sent = await publish({ userId, audience: 'family', subject: `Checking in on ${name}`, message: inactivityText(name, idle) });
    if (sent && progress) {
      await putItem({ ...progress, lastInactivityAlert: today });
      alerted += 1;
    }
  }
  return { scanned: users.length, alerted };
}

export async function handler(event) {
  const result =
    event.type === 'inactivity-scan'
      ? await inactivityScan()
      : event.type === 'session-reminder'
        ? await reminder(event.userId, 'session')
        : event.type === 'water-reminder'
          ? await reminder(event.userId, 'water')
          : { skipped: 'unknown_type' };
  console.log(JSON.stringify({ msg: 'job_done', type: event.type, ...result }));
  return result;
}
