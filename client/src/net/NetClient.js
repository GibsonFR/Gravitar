export class NetClient {
  constructor(store, onStatus) {
    this.store = store;
    this.onStatus = onStatus;
    this.ws = null;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);

    this.ws.onopen = () => {
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
      this.onStatus?.('Déconnecté.');
      setTimeout(() => this.connect(), 500);
    };
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(obj));
  }
}
