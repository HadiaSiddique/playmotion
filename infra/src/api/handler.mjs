// HTTP API router (API Gateway HTTP API, payload format 2.0).
import { HttpError, json } from '../lib/http.mjs';
import { addFamily, listFamily, verifyKidPin } from './family.mjs';
import { meal, story, tts, voicePack } from './media.mjs';
import { checkin, completeSession, getPlan, getReport, onboard, shareReport } from './coach.mjs';

const routes = {
  'GET /health': async () => ({ ok: true, service: 'movewell', time: new Date().toISOString() }),
  'POST /onboard': onboard,
  'GET /plan': getPlan,
  'POST /checkin': checkin,
  'POST /session/complete': completeSession,
  'GET /report': getReport,
  'POST /report/share': shareReport,
  'POST /meal': meal,
  'GET /family': listFamily,
  'POST /family': addFamily,
  'POST /tts': tts,
  'GET /voice/pack': voicePack,
  'POST /story': story,
  'POST /kids/verify-pin': verifyKidPin,
};

export async function handler(event) {
  const route = routes[event.routeKey];
  if (!route) return json(404, { error: 'NOT_FOUND', message: `No route ${event.routeKey}` });
  try {
    return json(200, await route(event));
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.message });
    console.error(JSON.stringify({ msg: 'api_error', route: event.routeKey, error: err.name, detail: String(err.message).slice(0, 500), stack: err.stack?.split('\n').slice(0, 4) }));
    return json(500, { error: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' });
  }
}
