// DynamoDB single-table access.
//
// pk              sk                      what
// USER#<id>       PROFILE                 profile (adults: onboarding answers; kids: nickname + avatar only)
// USER#<id>       PLAN                    current weekly plan + explanation
// USER#<id>       PROGRESS                xp, level, streak, badges, garden, stars
// USER#<id>       CHECKIN#<iso>           daily check-in (mood/energy/sleep; free text is never stored)
// USER#<id>       SESSION#<iso>           finished session (minutes, reps, form, mood before/after)
// USER#<id>       FALLTEST#<iso>          30-second chair-stand result
// USER#<id>       FAMILY#<memberId>       family circle member (+ SNS subscription)
// USER#<id>       NOTICE#<iso>            reminders / family feed shown on the TV home screen (TTL)
// USER#<id>       MEAL#<iso>              meal tips (the photo is never stored) (TTL)
// PAIR#<code>     META                    WebSocket pairing session: members map (TTL)
// CONN#<connId>   META                    WebSocket connection -> pairing code (TTL)
// gsi1: gsi1pk = 'FAMILY', gsi1sk = <userId>  -> users with a family circle (for inactivity alerts)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { HttpError } from './http.mjs';

export const TABLE = process.env.TABLE_NAME;

export const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const userPk = (userId) => `USER#${userId}`;

export async function getItem(pk, sk) {
  const res = await doc.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
  return res.Item ?? null;
}

export async function putItem(item, extra = {}) {
  await doc.send(new PutCommand({ TableName: TABLE, Item: item, ...extra }));
  return item;
}

export async function deleteItem(pk, sk) {
  await doc.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk } }));
}

export async function updateItem(params) {
  return doc.send(new UpdateCommand({ TableName: TABLE, ...params }));
}

/** Items under `pk` whose sk starts with `prefix`, newest first. `from` is an ISO timestamp lower bound. */
export async function queryPrefix(pk, prefix, { limit, from, newestFirst = true } = {}) {
  const range = from ? 'sk BETWEEN :from AND :to' : 'begins_with(sk, :prefix)';
  const values = from ? { ':pk': pk, ':from': `${prefix}${from}`, ':to': `${prefix}￿` } : { ':pk': pk, ':prefix': prefix };
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: `pk = :pk AND ${range}`,
        ExpressionAttributeValues: values,
        ScanIndexForward: !newestFirst,
        Limit: limit,
        ExclusiveStartKey,
      }),
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey && (!limit || items.length < limit));
  return limit ? items.slice(0, limit) : items;
}

export async function queryGsi1(gsi1pk) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :g',
        ExpressionAttributeValues: { ':g': gsi1pk },
        ExclusiveStartKey,
      }),
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function loadUser(userId) {
  const pk = userPk(userId);
  const [profile, plan, progress] = await Promise.all([getItem(pk, 'PROFILE'), getItem(pk, 'PLAN'), getItem(pk, 'PROGRESS')]);
  if (!profile) throw new HttpError(404, 'USER_NOT_FOUND', 'No PlayMotion profile for this userId. Run onboarding first.');
  return { profile, plan, progress };
}

const PRIVATE_FIELDS = ['pk', 'sk', 'gsi1pk', 'gsi1sk', 'ttl', 'parentPinHash', 'pinFailures', 'pinLockedUntil', 'subscriptionArn', 'email'];

/** Removes keys and secrets before an item goes back to a client. */
export function publicView(item) {
  if (!item) return null;
  const out = { ...item };
  for (const f of PRIVATE_FIELDS) delete out[f];
  return out;
}
