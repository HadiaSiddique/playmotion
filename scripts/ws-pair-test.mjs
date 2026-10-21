// Simulates a TV and a phone against the deployed WebSocket API:
// TV gets a code -> phone joins -> phone relays a rep event -> TV receives it.
//   node scripts/ws-pair-test.mjs            (reads infra/.stack-outputs.json)
//   node scripts/ws-pair-test.mjs wss://...  (explicit URL)
// Needs Node 22+ (built-in WebSocket).
import { readFileSync } from 'node:fs';

const url = process.argv[2] ?? JSON.parse(readFileSync(new URL('../infra/.stack-outputs.json', import.meta.url), 'utf8')).WebSocketUrl;

function open(role) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${url}?role=${role}`);
    ws.inbox = [];
    ws.waiters = [];
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const i = ws.waiters.findIndex((w) => w.match(msg));
      if (i >= 0) ws.waiters.splice(i, 1)[0].resolve(msg);
      else ws.inbox.push(msg);
    };
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`${role} could not connect to ${url}`));
  });
}

function next(ws, type, timeoutMs = 8000) {
  const match = (m) => m.type === type;
  const queued = ws.inbox.findIndex(match);
  if (queued >= 0) return Promise.resolve(ws.inbox.splice(queued, 1)[0]);
  return new Promise((resolve, reject) => {
    ws.waiters.push({ match, resolve });
    setTimeout(() => reject(new Error(`timed out waiting for "${type}"`)), timeoutMs);
  });
}

const t0 = Date.now();
const tv = await open('tv');
tv.send(JSON.stringify({ action: 'host' }));
const { code, joinUrl } = await next(tv, 'paired.code');
console.log(`TV    got code ${code}  (${joinUrl})`);

const phone = await open('phone');
phone.send(JSON.stringify({ action: 'join', code }));
await next(phone, 'joined');
const joined = await next(tv, 'peer.joined');
console.log(`TV    shows "Connected ✓" (${joined.role} joined)`);

const latencies = [];
for (let i = 1; i <= 5; i++) {
  const sent = Date.now();
  phone.send(JSON.stringify({ action: 'relay', type: 'rep', payload: { exercise: 'squats', count: i, formScore: 88 } }));
  const ev = await next(tv, 'event');
  latencies.push(Date.now() - sent);
  console.log(`TV    received ${ev.event} #${ev.payload.count} from ${ev.from}`);
}
const sorted = [...latencies].sort((a, b) => a - b);
console.log(`Relay latency phone -> TV: median ${sorted[2]} ms, max ${sorted[4]} ms`);

tv.send(JSON.stringify({ action: 'relay', type: 'control', payload: { cmd: 'end' } }));
const ctl = await next(phone, 'event');
console.log(`Phone received ${ctl.event}: ${JSON.stringify(ctl.payload)}`);

phone.close();
tv.close();
console.log(`\nPairing + relay OK in ${Date.now() - t0} ms`);
process.exit(0);
