// Amazon SNS: one topic for the whole app; subscription filter policies route each message
// to the right person. audience 'family' = family circle, 'self' = the user's own reminders.
import { PublishCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { putItem, userPk } from './db.mjs';
import { nowIso, ttlIn } from './util.mjs';

const sns = new SNSClient({});
const TOPIC_ARN = process.env.FAMILY_TOPIC_ARN;

export async function subscribeEmail({ userId, email, audience }) {
  const res = await sns.send(
    new SubscribeCommand({
      TopicArn: TOPIC_ARN,
      Protocol: 'email',
      Endpoint: email,
      ReturnSubscriptionArn: true,
      Attributes: { FilterPolicy: JSON.stringify({ userId: [userId], audience: [audience] }) },
    }),
  );
  return res.SubscriptionArn; // "pending confirmation" until the person clicks the email link
}

export async function publish({ userId, audience, subject, message }) {
  try {
    await sns.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Subject: subject.slice(0, 99),
        Message: message,
        MessageAttributes: {
          userId: { DataType: 'String', StringValue: userId },
          audience: { DataType: 'String', StringValue: audience },
        },
      }),
    );
    return true;
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'sns_failed', error: err.name, detail: String(err.message).slice(0, 200) }));
    return false;
  }
}

/** A notice shows on the TV home screen (reminders, "shared with family ✓"). Kept for 3 days. */
export async function addNotice(userId, kind, text) {
  const at = nowIso();
  await putItem({ pk: userPk(userId), sk: `NOTICE#${at}`, kind, text, at, ttl: ttlIn(3 * 86_400) });
}
