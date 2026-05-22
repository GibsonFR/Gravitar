export class NetClient {
  constructor(store, onStatus) {
    this.store = store;
    this.onStatus = onStatus;
    this.ws = null;
    this.reconnectTimer = 0;
    this.sessionTokenKey = 'gravitar.sessionToken.v1';
    this.manualClose = false;
  }

  getSessionToken() {
    try { return localStorage.getItem(this.sessionTokenKey) || ''; } catch { return ''; }
  }

  setSessionToken(token) {
    const clean = String(token || '').trim();
    try {
      if (clean) localStorage.setItem(this.sessionTokenKey, clean);
      else localStorage.removeItem(this.sessionTokenKey);
    } catch {}
  }

  connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = 0;
    }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const token = this.getSessionToken();
    const qs = token ? `?resume=${encodeURIComponent(token)}` : '';
    this.ws = new WebSocket(`${proto}://${location.host}${qs}`);

    this.ws.onopen = () => {
      this.onStatus?.(token ? 'Reconnecté.' : 'Connecté.');
    };

    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'hello') {
        if (msg.sessionToken) this.setSessionToken(msg.sessionToken);
        this.store.applyHello(msg.id, msg.sessionToken || '', !!msg.resumed);
      }
      if (msg.t === 'snap') this.store.applySnapshot(msg);
      if (msg.t === 'chat') this.store.applyChatMessage(msg);
      if (msg.t === 'cmd_ack') this.store.applyCommandAck?.(msg);
    };

    this.ws.onclose = () => {
      if (this.manualClose) return;
      this.onStatus?.('Déconnecté. Reconnexion…');
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 500);
    };
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }
}
