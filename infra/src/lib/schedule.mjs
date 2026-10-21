// Amazon EventBridge Scheduler: one schedule per user reminder, in the user's own time zone.
import { ConflictException, CreateScheduleCommand, SchedulerClient, UpdateScheduleCommand } from '@aws-sdk/client-scheduler';

const scheduler = new SchedulerClient({});

export const dailyCron = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `cron(${m} ${h} * * ? *)`;
};

export const WATER_CRON = 'cron(0 10-20/2 * * ? *)'; // every 2 hours, 10:00-20:00

export async function upsertSchedule({ name, expression, timezone, input }) {
  const params = {
    Name: name.slice(0, 64),
    GroupName: process.env.SCHEDULE_GROUP,
    ScheduleExpression: expression,
    ScheduleExpressionTimezone: timezone,
    FlexibleTimeWindow: { Mode: 'OFF' },
    State: 'ENABLED',
    Target: {
      Arn: process.env.JOBS_FUNCTION_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN,
      Input: JSON.stringify(input),
      RetryPolicy: { MaximumRetryAttempts: 1 },
    },
  };
  try {
    await scheduler.send(new CreateScheduleCommand(params));
  } catch (err) {
    if (!(err instanceof ConflictException) && err.name !== 'ConflictException') throw err;
    await scheduler.send(new UpdateScheduleCommand(params));
  }
}

/** Sets up the user's daily session reminder (+ water reminders). Never throws: reminders are optional. */
export async function setUpReminders({ userId, timezone, reminderTime, water }) {
  const result = { session: false, water: false };
  if (!reminderTime) return result; // "No reminders"
  try {
    await upsertSchedule({ name: `${userId}-session`, expression: dailyCron(reminderTime), timezone, input: { type: 'session-reminder', userId } });
    result.session = true;
    if (water) {
      await upsertSchedule({ name: `${userId}-water`, expression: WATER_CRON, timezone, input: { type: 'water-reminder', userId } });
      result.water = true;
    }
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'scheduler_failed', error: err.name, detail: String(err.message).slice(0, 200) }));
  }
  return result;
}
