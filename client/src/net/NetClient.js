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
        if (msg.protocol === 'net_v2_reset' || msg.net?.netV2Reset) this.store.applyStateV2?.(msg);
        else this.store.applySnapshot(msg);
      }
      if (msg.t === 'state_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordSnapshot(msg, raw.length);
        this.store.applyStateV2?.(msg);
      }
      if (msg.t === 'input_ack_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordAckPacket?.(msg, raw.length);
        this.store.applyInputAckV2?.(msg);
      }
      if (msg.t === 'player_status_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordStatusPacket?.(msg, raw.length);
        this.store.applyPlayerStatusV2?.(msg);
      }
      if (msg.t === 'player_session_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordSessionPacket?.(msg, raw.length);
        this.store.applyPlayerSessionV2?.(msg);
      }
      if (msg.t === 'player_pose_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordPosePacket?.(msg, raw.length);
        this.store.applyPlayerPoseV2?.(msg);
      }
      if (msg.t === 'projectile_events_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordProjectilePacket?.(msg, raw.length);
        this.store.applyProjectileEventsV2?.(msg);
      }
      if (msg.t === 'combat_events_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordCombatPacket?.(msg, raw.length);
        this.store.applyCombatEventsV2?.(msg);
      }
      if (msg.t === 'network_events_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordNetworkEventsPacket?.(msg, raw.length);
        this.store.applyNetworkEventsV2?.(msg);
      }
      if (msg.t === 'world_events_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordWorldEventsPacket?.(msg, raw.length);
        (this.store.applyWorldEventsV2 ? this.store.applyWorldEventsV2(msg) : console.warn('[net] missing store.applyWorldEventsV2', msg));
      }
      if (msg.t === 'cargo_v2' || msg.t === 'cargo_bootstrap_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordCargoPacket?.(msg, raw.length);
        (this.store.applyCargoV2 ? this.store.applyCargoV2(msg) : console.warn('[net] missing store.applyCargoV2', msg));
      }
      if (msg.t === 'cargo_delta_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordCargoDeltaPacket?.(msg, raw.length);
        (this.store.applyCargoDeltaV2 ? this.store.applyCargoDeltaV2(msg) : console.warn('[net] missing store.applyCargoDeltaV2', msg));
      }
      if (msg.t === 'mob_pose_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordMobPosePacket?.(msg, raw.length);
        this.store.applyMobPoseV2?.(msg);
      }
      if (msg.t === 'player_enter_sector_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordLifecyclePacket?.(msg, raw.length);
        this.store.applyPlayerEnterSectorV2?.(msg);
      }
      if (msg.t === 'player_leave_sector_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordLifecyclePacket?.(msg, raw.length);
        this.store.applyPlayerLeaveSectorV2?.(msg);
      }
      if (msg.t === 'sector_unload_v2') {
        this.networkClock.updateFromSnapshot(msg, performance.now());
        this.netStats.recordLifecyclePacket?.(msg, raw.length);
        this.store.applySectorUnloadV2?.(msg);
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

  sendLootPickup(lootId) {
    const id = lootId | 0;
    if (!id) return false;
    this.lootPickupSeq = (this.lootPickupSeq | 0) + 1;
    return this.send({ t: 'loot_pickup_v2', seq: this.lootPickupSeq, lootId: id });
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
