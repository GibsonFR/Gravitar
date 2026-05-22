export class NetClient {
  constructor(store, onStatus) {
    this.store = store;
    this.onStatus = onStatus;
    this.ws = null;
    this.reconnectDelayMs = 500;
    this.reconnectTimer = 0;
    this.sessionToken = this.getOrCreateSessionToken();
  }

  getOrCreateSessionToken() {
    const key = 'gravitar_ws_session_token_v1';
    try {
      let token = String(localStorage.getItem(key) || '').trim();
      if (!/^[a-zA-Z0-9_-]{24,96}$/.test(token)) {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(key, token);
      }
      return token;
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const token = encodeURIComponent(this.sessionToken || '');
    this.ws = new WebSocket(`${proto}://${location.host}?sid=${token}`);

    this.ws.onopen = () => {
      this.reconnectDelayMs = 500;
      this.onStatus?.('Connecté.');
    };

    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'hello') this.store.applyHello(msg.id);
      if (msg.t === 'snap') this.store.applySnapshot(msg);
      if (msg.t === 'chat') this.store.applyChatMessage(msg);
      if (msg.t === 'cmd_ack') this.store.applyCommandAck?.(msg);
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.onStatus?.('Reconnexion…');
      clearTimeout(this.reconnectTimer);
      const delay = this.reconnectDelayMs;
      this.reconnectDelayMs = Math.min(5000, Math.round(this.reconnectDelayMs * 1.6));
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }
}
