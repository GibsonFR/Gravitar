import { NetStats } from './NetStats.js';
import { NetworkClock } from './NetworkClock.js';
import { InputHistoryBuffer } from './InputHistoryBuffer.js';

export class NetClient {
  constructor(store, onStatus) {
    this.store = store;
    this.onStatus = onStatus;
    this.ws = null;
    this.reconnectTimer = 0;
    this.sessionTokenKey = 'gravitar.sessionToken.v1';
    this.manualClose = false;
    this.netStats = new NetStats();
    this.networkClock = new NetworkClock();
    this.inputHistory = new InputHistoryBuffer();
    this.netStats.setClock(this.networkClock);
    this.netStats.setInputHistory(this.inputHistory);
    this.pingTimer = 0;
    this.pingSeq = 0;
    this.store.setNetStats?.(this.netStats);
    this.store.setNetworkClock?.(this.networkClock);
    this.store.setInputHistory?.(this.inputHistory);
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

  startPingLoop() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    const sendPing = () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const msg = { t: 'ping', seq: ++this.pingSeq, clientSentAt: performance.now(), clientDate: Date.now() };
      this.netStats.recordPingSent(msg.seq);
      this.send(msg);
    };
    sendPing();
    this.pingTimer = setInterval(sendPing, 1500);
  }

  stopPingLoop() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = 0;
  }

  getNetStats() {
    return this.netStats;
  }

  getNetworkClock() {
    return this.networkClock;
  }

  getInputHistory() {
    return this.inputHistory;
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
      this.startPingLoop();
    };

    this.ws.onmessage = (ev) => {
      const raw = typeof ev.data === 'string' ? ev.data : '';
      if (raw) this.netStats.recordInboundBytes(raw.length);
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      this.netStats.recordInboundPacket(msg?.t || 'unknown', raw.length);
      if (msg.t === 'hello') {
        if (msg.sessionToken) this.setSessionToken(msg.sessionToken);
        this.protocol = msg.protocol || 'legacy';
        this.store.applyHello(msg.id, msg.sessionToken || '', !!msg.resumed);
      }
      if (msg.t === 'pong') {
        this.networkClock.updateFromPong(msg, performance.now());
        this.netStats.recordPong(msg);
      }
      if (msg.t === 'snap') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordSnapshot(msg, raw.length);
        this.store.applySnapshot(msg);
      }
      if (msg.t === 'state_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordSnapshot(msg, raw.length);
        this.store.applyStateV2?.(msg);
      }
      if (msg.t === 'chat') this.store.applyChatMessage(msg);
      if (msg.t === 'cmd_ack') {
        this.netStats.recordCommandAck();
        this.store.applyCommandAck?.(msg);
      }
    };

    this.ws.onclose = () => {
      this.stopPingLoop();
      if (this.manualClose) return;
      this.onStatus?.('Déconnecté. Reconnexion…');
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 500);
    };
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const payload = JSON.stringify(obj);
    this.ws.send(payload);
    this.netStats.recordOutboundBytes(payload.length);
    this.netStats.recordOutboundPacket(obj?.t || 'unknown', payload.length);
    if (obj?.t === 'input') this.netStats.recordInput(obj, payload.length, this.ws.bufferedAmount || 0);
    else if (obj?.t === 'cmd') this.netStats.recordCommand(payload.length, this.ws.bufferedAmount || 0);
    return true;
  }
}
