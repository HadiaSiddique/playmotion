// TV side of the PlayMotion WebSocket: asks for a 6-digit pairing code, tracks connected phones,
// passes phone events (pose, rep, form, game, safety, status) to listeners and sends control commands.
// Protocol: docs/PROTOCOL.md

export type PairingStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'reconnecting' | 'error';

export interface PairingState {
  status: PairingStatus;
  code: string | null;
  joinUrl: string | null;
  phones: number;
  error: string | null;
}

export interface PhoneEvent {
  event: string;
  from: string;
  payload: any;
  t: number;
}

type StateListener = (state: PairingState) => void;
type EventListener = (event: PhoneEvent) => void;

const PING_MS = 4 * 60_000;

export class PairingClient {
  private ws: WebSocket | null = null;
  private retry = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private stateListeners = new Set<StateListener>();
  private eventListeners = new Set<EventListener>();
  private userId: string | null = null;
  // Lets the backend give this TV its old code back after a reconnect, even before onboarding.
  private deviceId = `tv_${Math.random().toString(36).slice(2, 12)}`;

  state: PairingState = { status: 'idle', code: null, joinUrl: null, phones: 0, error: null };

  constructor(private url: string) {}

  onState(listener: StateListener) {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  onEvent(listener: EventListener) {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private setState(patch: Partial<PairingState>) {
    this.state = { ...this.state, ...patch };
    this.stateListeners.forEach((l) => l(this.state));
  }

  connect() {
    if (!this.url) {
      this.setState({ status: 'error', error: 'The backend address is missing. Run scripts/write-env.ps1, then restart Metro.' });
      return;
    }
    this.closedByUser = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.setState({ status: this.retry ? 'reconnecting' : 'connecting', error: null });

    const ws = new WebSocket(`${this.url}?role=tv`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      // Resume the same code after a reconnect so the phone doesn't need to scan again.
      this.send({ action: 'host', userId: this.userId ?? undefined, deviceId: this.deviceId, code: this.state.code ?? undefined });
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ action: 'ping' }), PING_MS);
    };
    ws.onmessage = (e) => this.handle(String(e.data));
    ws.onerror = () => {
      /* onclose follows and handles the retry */
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.closedByUser || ws !== this.ws) return;
      this.setState({ status: 'reconnecting' });
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private handle(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'paired.code': {
        const phones = msg.resumed ? Number(msg.peers ?? 0) : 0;
        this.setState({ code: msg.code, joinUrl: msg.joinUrl, phones, status: phones > 0 ? 'connected' : 'waiting', error: null });
        if (this.userId) this.relay('hello', { userId: this.userId });
        break;
      }
      case 'peer.joined':
        this.setState({ phones: this.state.phones + 1, status: 'connected' });
        if (this.userId) this.relay('hello', { userId: this.userId });
        break;
      case 'peer.left': {
        const phones = Math.max(0, this.state.phones - 1);
        this.setState({ phones, status: phones > 0 ? 'connected' : 'waiting' });
        break;
      }
      case 'event':
        this.eventListeners.forEach((l) => l({ event: msg.event, from: msg.from, payload: msg.payload, t: msg.t }));
        break;
      case 'error':
        this.setState({ error: msg.message ?? 'Something went wrong.' });
        break;
      default:
        break;
    }
  }

  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId && this.state.status === 'connected') this.relay('hello', { userId });
  }

  send(message: object) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  relay(type: string, payload: object, to?: 'phone' | 'guest') {
    return this.send({ action: 'relay', type, payload, ...(to ? { to } : {}) });
  }

  /** Tell the phone which exercise to track. */
  startExercise(exercise: string, options: { seated?: boolean; target?: number } = {}) {
    return this.relay('control', { cmd: 'start', exercise, seated: Boolean(options.seated), target: options.target ?? null });
  }

  control(cmd: 'pause' | 'resume' | 'end') {
    return this.relay('control', { cmd });
  }

  /** Forget the code and ask for a new one (e.g. "New code" button). */
  newCode() {
    this.setState({ code: null, joinUrl: null, phones: 0 });
    this.closedByUser = true;
    this.ws?.close();
    this.retry = 0;
    this.connect();
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }
}
