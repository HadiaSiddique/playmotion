// WebSocket protocol shared by the TV app, phone app and the relay Lambda.
// Full description: docs/PROTOCOL.md

// Client -> server actions (the "action" field of every message).
export const ACTIONS = {
  HOST: 'host', // TV asks for a 6-digit pairing code (or resumes one)
  JOIN: 'join', // phone / guest joins with a code
  RELAY: 'relay', // forward an event to the other devices in the session
  PING: 'ping', // keep-alive (API Gateway closes idle sockets after 10 min)
  LEAVE: 'leave',
};

// Event types allowed through the relay. Video never leaves the phone:
// "pose" carries landmark points only.
export const RELAY_TYPES = [
  'pose', // { lm: [[x,y,z,visibility] x 33], t }  (phone -> TV, ~10-15 fps)
  'rep', // { exercise, count, formScore }
  'form', // { exercise, cue, severity }
  'game', // game-specific events (power attack, bubble pop, freeze check...)
  'safety', // { kind: 'stop' | 'pain', source: 'voice' | 'tap' }  highest priority
  'control', // TV -> phone: { cmd: 'start' | 'pause' | 'resume' | 'end', exercise, seated }
  'mood', // before/after mood + energy rating entered on the phone
  'meal', // meal-photo tips (text only, the photo never leaves the phone except for the one tip request)
  'status', // device status: camera ready, person in frame, fps
  'hello', // free-form handshake
];

// Server -> client message types.
export const SERVER_TYPES = {
  CODE: 'paired.code',
  JOINED: 'joined',
  PEER_JOINED: 'peer.joined',
  PEER_LEFT: 'peer.left',
  EVENT: 'event',
  PONG: 'pong',
  ERROR: 'error',
};

export const MAX_MESSAGE_BYTES = 16 * 1024;
export const MAX_PEERS = 6;
