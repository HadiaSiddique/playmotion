// Pretends to be the TV so you can test the phone app end to end before the TV app exists.
// Prints a pairing code + link, shows everything the phone sends, and lets you send TV commands.
//   node scripts/fake-tv.mjs
// Keys:  1 sit to stand   2 arm raises   3 arm raises (seated)   p pause   r resume   e end   q quit
// Needs Node 22+ (built-in WebSocket).
import { readFileSync } from 'node:fs';
import readline from 'node:readline';

const url = process.argv[2] ?? JSON.parse(readFileSync(new URL('../infra/.stack-outputs.json', import.meta.url), 'utf8')).WebSocketUrl;
const ws = new WebSocket(`${url}?role=tv`);
const send = (message) => ws.send(JSON.stringify(message));
const control = (payload) => {
  send({ action: 'relay', type: 'control', payload });
  console.log('→ control', JSON.stringify(payload));
};

let poseFrames = 0;
let poseBytes = 0;

ws.onopen = () => send({ action: 'host', userId: process.env.MOVEWELL_USER_ID });
ws.onclose = () => {
  console.log('Socket closed.');
  process.exit(0);
};
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'paired.code') {
    console.log(`\nPairing code: ${m.code}\nOpen on the phone (or make a QR of it): ${m.joinUrl}\n`);
    console.log('Keys: 1 sit to stand | 2 arm raises | 3 seated arm raises | p pause | r resume | e end | q quit\n');
  } else if (m.type === 'peer.joined') {
    console.log(`Connected ✓  (${m.role} joined)`);
  } else if (m.type === 'peer.left') {
    console.log(`${m.role} left`);
  } else if (m.type === 'error') {
    console.log(`error: ${m.message}`);
  } else if (m.type === 'event') {
    if (m.event === 'pose') {
      poseFrames += 1;
      poseBytes += e.data.length;
    } else if (!(m.event === 'game' && m.payload?.kind === 'signal')) {
      console.log(`← ${m.event.padEnd(6)} ${JSON.stringify(m.payload)}`);
    }
  }
};

setInterval(() => {
  if (!poseFrames) return;
  console.log(`   pose: ${(poseFrames / 5).toFixed(1)} frames/s, ~${Math.round(poseBytes / poseFrames)} bytes each (landmarks only)`);
  poseFrames = 0;
  poseBytes = 0;
}, 5000);

setInterval(() => send({ action: 'ping' }), 4 * 60_000);

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
  if (str === 'q' || (key?.ctrl && key.name === 'c')) process.exit(0);
  if (str === '1') control({ cmd: 'start', exercise: 'sit_to_stand', seated: false, target: 10 });
  if (str === '2') control({ cmd: 'start', exercise: 'arm_raise', seated: false, target: 12 });
  if (str === '3') control({ cmd: 'start', exercise: 'arm_raise', seated: true, target: 12 });
  if (str === 'p') control({ cmd: 'pause' });
  if (str === 'r') control({ cmd: 'resume' });
  if (str === 'e') control({ cmd: 'end' });
});
