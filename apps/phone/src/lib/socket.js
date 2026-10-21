// WebSocket client: joins the TV's session by code, relays events, reconnects and re-joins on its own.
// Only landmark points and events are ever sent. There is no code path that sends video or images.

export class PlayMotionSocket {
  constructor(url, { onMessage, onStatus }) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.code = null;
    this.role = 'phone';
    this.retry = 0;
    this.closedByUser = false;
    this.ws = null;
  }

  connect() {
    if (!this.url) {
      this.onStatus('error', 'This page is missing its server address (VITE_WS_URL). Run scripts/write-env.ps1 and rebuild.');
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.onStatus(this.retry ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(`${this.url}?role=${this.role}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('open');
      if (this.code) this.send({ action: 'join', code: this.code, role: this.role });
      clearInterval(this.pingTimer);
      // API Gateway closes sockets that are idle for 10 minutes.
      this.pingTimer = setInterval(() => this.send({ action: 'ping' }), 4 * 60_000);
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.onMessage(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.closedByUser || ws !== this.ws) return;
      this.onStatus('reconnecting');
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  join(code) {
    this.code = code;
    if (this.ws?.readyState === WebSocket.OPEN) this.send({ action: 'join', code, role: this.role });
    else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.connect();
  }

  forgetCode() {
    this.code = null;
  }

  send(message) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  relay(type, payload, to) {
    // Drop pose frames (never safety or rep events) when the network can't keep up.
    if (type === 'pose' && (this.ws?.bufferedAmount ?? 0) > 64_000) return false;
    return this.send({ action: 'relay', type, payload, ...(to ? { to } : {}) });
  }

  close() {
    this.closedByUser = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    this.ws?.close();
  }
}
