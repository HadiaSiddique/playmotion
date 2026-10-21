// WebSocket API: pairs a TV with phones by a 6-digit code and relays pose / rep / form / game events.
// Video never reaches AWS: the phone sends landmark points and events only.
//
//   TV     -> {action:'host', userId?, code?}        <- {type:'paired.code', code, joinUrl}
//   phone  -> {action:'join', code, role:'phone'}    <- {type:'joined'}; TV gets {type:'peer.joined'}
//   any    -> {action:'relay', type, payload, to?}   -> others get {type:'event', event:type, from, payload, t}
import { ApiGatewayManagementApiClient, DeleteConnectionCommand, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { deleteItem, getItem, putItem, updateItem } from '../lib/db.mjs';
import { MAX_MESSAGE_BYTES, MAX_PEERS, RELAY_TYPES } from '../lib/shared/protocol.mjs';
import { pairCode, ttlIn } from '../lib/util.mjs';

const PAIR_TTL_SECONDS = 4 * 3600;
const PHONE_APP_URL = process.env.PHONE_APP_URL;
const ROLES = ['tv', 'phone', 'guest'];

// Warm-container caches keep the hot path (pose frames) to zero or one DynamoDB read.
const connCache = new Map(); // connId -> { code, role, exp }
const pairCache = new Map(); // code -> { members, exp }
const mgmtClients = new Map();

const pairKey = (code) => ({ pk: `PAIR#${code}`, sk: 'META' });
const connKey = (connId) => ({ pk: `CONN#${connId}`, sk: 'META' });

function mgmt(event) {
  const { domainName, stage } = event.requestContext;
  const endpoint = `https://${domainName}/${stage}`;
  if (!mgmtClients.has(endpoint)) mgmtClients.set(endpoint, new ApiGatewayManagementApiClient({ endpoint }));
  return mgmtClients.get(endpoint);
}

async function send(event, connectionId, message) {
  try {
    await mgmt(event).send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: Buffer.from(JSON.stringify(message)) }));
    return true;
  } catch (err) {
    if (err.name === 'GoneException' || err.$metadata?.httpStatusCode === 410) return false;
    console.warn(JSON.stringify({ msg: 'post_failed', error: err.name }));
    return true;
  }
}

async function getConn(connId) {
  const cached = connCache.get(connId);
  if (cached && cached.exp > Date.now()) return cached;
  const item = await getItem(`CONN#${connId}`, 'META');
  if (!item) return null;
  const value = { code: item.code ?? null, role: item.role, exp: Date.now() + 60_000 };
  connCache.set(connId, value);
  return value;
}

async function getMembers(code, { fresh = false } = {}) {
  const cached = pairCache.get(code);
  if (!fresh && cached && cached.exp > Date.now()) return cached.members;
  const item = await getItem(`PAIR#${code}`, 'META');
  const members = item?.members ?? null;
  if (members) pairCache.set(code, { members, exp: Date.now() + 2_000 });
  return members;
}

async function removeMember(code, connId) {
  pairCache.delete(code);
  await updateItem({
    Key: pairKey(code),
    UpdateExpression: 'REMOVE #m.#c',
    ConditionExpression: 'attribute_exists(pk)',
    ExpressionAttributeNames: { '#m': 'members', '#c': connId },
  }).catch(() => {});
}

/** Sends to every other member (optionally only one role). Cleans up connections that are gone. */
async function broadcast(event, code, fromConnId, message, toRole) {
  const members = (await getMembers(code)) ?? {};
  const targets = Object.entries(members).filter(([id, role]) => id !== fromConnId && (!toRole || role === toRole));
  const results = await Promise.all(targets.map(([id]) => send(event, id, message)));
  await Promise.all(results.map((ok, i) => (ok ? null : removeMember(code, targets[i][0]))));
  return targets.length;
}

const reply = (event, message) => send(event, event.requestContext.connectionId, message);
const error = (event, code, message) => reply(event, { type: 'error', code, message });

async function onConnect(event) {
  const qs = event.queryStringParameters ?? {};
  const role = ROLES.includes(qs.role) ? qs.role : 'phone';
  await putItem({ ...connKey(event.requestContext.connectionId), role, connectedAt: Date.now(), ttl: ttlIn(PAIR_TTL_SECONDS) });
  return { statusCode: 200 };
}

async function onDisconnect(event) {
  const connId = event.requestContext.connectionId;
  const conn = await getConn(connId);
  connCache.delete(connId);
  await deleteItem(`CONN#${connId}`, 'META');
  if (conn?.code) {
    await removeMember(conn.code, connId);
    await broadcast(event, conn.code, connId, { type: 'peer.left', role: conn.role });
  }
  return { statusCode: 200 };
}

async function host(event, body) {
  const connId = event.requestContext.connectionId;
  const userId = typeof body.userId === 'string' ? body.userId.slice(0, 48) : null;
  // Random per-app-launch id, so a TV can resume its code before anyone has onboarded.
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 48) : null;

  // Resume: the TV reconnected (emulator hiccup, network blip) and wants its old code back.
  if (typeof body.code === 'string' && /^\d{6}$/.test(body.code)) {
    const existing = await getItem(`PAIR#${body.code}`, 'META');
    const sameTv = (userId && existing?.hostUserId === userId) || (deviceId && existing?.hostDeviceId === deviceId);
    if (existing && sameTv) {
      await updateItem({
        Key: pairKey(body.code),
        UpdateExpression: 'SET #m.#c = :role, hostConn = :c',
        ExpressionAttributeNames: { '#m': 'members', '#c': connId },
        ExpressionAttributeValues: { ':role': 'tv', ':c': connId },
      });
      await updateItem({ Key: connKey(connId), UpdateExpression: 'SET #k = :code, #r = :role', ExpressionAttributeNames: { '#k': 'code', '#r': 'role' }, ExpressionAttributeValues: { ':code': body.code, ':role': 'tv' } });
      connCache.delete(connId);
      pairCache.delete(body.code);
      const peers = Object.keys(existing.members ?? {}).filter((id) => id !== connId).length;
      await reply(event, { type: 'paired.code', code: body.code, joinUrl: `${PHONE_APP_URL}/?code=${body.code}`, resumed: true, peers });
      return;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = pairCode();
    try {
      await putItem(
        { ...pairKey(code), hostConn: connId, hostUserId: userId, hostDeviceId: deviceId, members: { [connId]: 'tv' }, createdAt: Date.now(), ttl: ttlIn(PAIR_TTL_SECONDS) },
        { ConditionExpression: 'attribute_not_exists(pk)' },
      );
      await updateItem({ Key: connKey(connId), UpdateExpression: 'SET #k = :code, #r = :role', ExpressionAttributeNames: { '#k': 'code', '#r': 'role' }, ExpressionAttributeValues: { ':code': code, ':role': 'tv' } });
      connCache.delete(connId);
      await reply(event, { type: 'paired.code', code, joinUrl: `${PHONE_APP_URL}/?code=${code}`, expiresInSec: PAIR_TTL_SECONDS });
      return;
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  await error(event, 'CODE_UNAVAILABLE', 'Could not create a pairing code. Please try again.');
}

async function join(event, body) {
  const connId = event.requestContext.connectionId;
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const role = body.role === 'guest' ? 'guest' : 'phone';
  if (!/^\d{6}$/.test(code)) return error(event, 'BAD_CODE', 'Enter the 6-digit code shown on your TV.');
  const pair = await getItem(`PAIR#${code}`, 'META');
  const members = pair?.members ?? null;
  if (!members) return error(event, 'CODE_NOT_FOUND', "We couldn't find that code. Check the TV and try again.");
  if (Object.keys(members).length >= MAX_PEERS) return error(event, 'SESSION_FULL', 'This session already has the maximum number of devices.');

  await updateItem({
    Key: pairKey(code),
    UpdateExpression: 'SET #m.#c = :role',
    ConditionExpression: 'attribute_exists(pk)',
    ExpressionAttributeNames: { '#m': 'members', '#c': connId },
    ExpressionAttributeValues: { ':role': role },
  });
  await updateItem({ Key: connKey(connId), UpdateExpression: 'SET #k = :code, #r = :role', ExpressionAttributeNames: { '#k': 'code', '#r': 'role' }, ExpressionAttributeValues: { ':code': code, ':role': role } });
  connCache.delete(connId);
  pairCache.delete(code);
  const peers = Object.keys(members).length;
  // The phone needs the TV user's id for meal tips; the TV can also send it later in a "hello" event.
  await reply(event, { type: 'joined', code, role, peers, userId: pair.hostUserId ?? null });
  await broadcast(event, code, connId, { type: 'peer.joined', role, peers: peers + 1 });
}

async function relay(event, body) {
  const connId = event.requestContext.connectionId;
  if (!RELAY_TYPES.includes(body.type)) return error(event, 'BAD_TYPE', `Unknown event type "${body.type}".`);
  const conn = await getConn(connId);
  if (!conn?.code) return error(event, 'NOT_PAIRED', 'Pair with a TV first.');
  const toRole = ROLES.includes(body.to) ? body.to : null;
  await broadcast(event, conn.code, connId, { type: 'event', event: body.type, from: conn.role, payload: body.payload ?? null, t: Date.now() }, toRole);
}

export async function handler(event) {
  const { routeKey, connectionId } = event.requestContext;
  try {
    if (routeKey === '$connect') return await onConnect(event);
    if (routeKey === '$disconnect') return await onDisconnect(event);

    if ((event.body?.length ?? 0) > MAX_MESSAGE_BYTES) {
      await error(event, 'TOO_LARGE', 'Message too large.');
      return { statusCode: 200 };
    }
    let body;
    try {
      body = JSON.parse(event.body ?? '{}');
    } catch {
      await error(event, 'BAD_JSON', 'Messages must be JSON.');
      return { statusCode: 200 };
    }
    switch (body.action) {
      case 'relay':
        await relay(event, body);
        break;
      case 'host':
        await host(event, body);
        break;
      case 'join':
        await join(event, body);
        break;
      case 'ping':
        await reply(event, { type: 'pong', t: Date.now() });
        break;
      case 'leave':
        await onDisconnect(event);
        await mgmt(event).send(new DeleteConnectionCommand({ ConnectionId: connectionId })).catch(() => {});
        break;
      default:
        await error(event, 'BAD_ACTION', `Unknown action "${body.action}".`);
    }
    return { statusCode: 200 };
  } catch (err) {
    console.error(JSON.stringify({ msg: 'ws_error', routeKey, error: err.name, detail: String(err.message).slice(0, 300) }));
    return { statusCode: 500 };
  }
}
