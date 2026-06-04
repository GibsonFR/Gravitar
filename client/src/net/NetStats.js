function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ema(previous, value, alpha = 0.12) {
  if (!Number.isFinite(previous) || previous <= 0) return value;
  return previous + (value - previous) * alpha;
}

export class NetStats {
  constructor() {
    this.enabled = false;
    this.visible = false;
    this.windowStartedAt = nowMs();
    this.lastSnapshotAt = 0;
    this.lastInputAt = 0;
    this.lastPongAt = 0;
    this.lastPingSentAt = 0;
    this.pingSeq = 0;

    this.bytesInWindow = 0;
    this.bytesOutWindow = 0;
    this.packetsInWindow = 0;
    this.packetsOutWindow = 0;
    this.framesWindow = 0;
    this.snapshotsInWindow = 0;
    this.stateV2InWindow = 0;
    this.posePacketsInWindow = 0;
    this.lifecyclePacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.lifecyclePacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.lastPosePacketAt = 0;
    this.posePacketGapMs = 0;
    this.posePacketGapMaxMs = 0;
    this.inputsOutWindow = 0;
    this.commandsOutWindow = 0;
    this.cmdAcksInWindow = 0;
    this.eventsInWindow = 0;
    this.sfxInWindow = 0;
    this.serverEventsInWindow = 0;
    this.logisticEventsInWindow = 0;
    this.projectileEventsInWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.serverEventsInWindow = 0;
    this.logisticEventsInWindow = 0;
    this.projectileEventsInWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;

    this.bytesInPerSec = 0;
    this.bytesOutPerSec = 0;
    this.packetsInPerSec = 0;
    this.packetsOutPerSec = 0;
    this.fps = 0;
    this.frameMs = 0;
    this.frameMsAvg = 0;
    this.frameMsMax = 0;
    this.lastFrameAt = 0;
    this.snapshotsPerSec = 0;
    this.stateV2PerSec = 0;
    this.posePacketsPerSec = 0;
    this.lifecyclePacketsPerSec = 0;
    this.ackPacketsPerSec = 0;
    this.statusPacketsPerSec = 0;
    this.sessionPacketsPerSec = 0;
    this.inputsPerSec = 0;
    this.commandsPerSec = 0;
    this.cmdAcksPerSec = 0;
    this.eventsPerSec = 0;
    this.sfxPerSec = 0;
    this.serverEventsPerSec = 0;
    this.logisticEventsPerSec = 0;
    this.projectileEventsPerSec = 0;
    this.projectilePacketV2PerSec = 0;
    this.combatPacketV2PerSec = 0;
    this.networkPacketV2PerSec = 0;

    this.lastPacketInBytes = 0;
    this.lastPacketOutBytes = 0;
    this.lastPacketType = '';
    this.packetTypeInWindow = {};
    this.packetTypeOutWindow = {};
    this.packetTypeInPerSec = {};
    this.packetTypeOutPerSec = {};
    this.totalPacketsIn = 0;
    this.totalPacketsOut = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.debugHistoryMs = 10000;
    this.debugHistory = [];
    this.debugSequence = 0;
    this.lastSnapshotBytes = 0;
    this.avgSnapshotBytes = 0;
    this.maxSnapshotBytes = 0;
    this.lastInputBytes = 0;
    this.avgInputBytes = 0;
    this.maxInputBytes = 0;

    this.rttMs = 0;
    this.rttMinMs = 0;
    this.rttMaxMs = 0;
    this.jitterMs = 0;
    this.serverOffsetMs = 0;
    this.serverOffsetEmaMs = 0;
    this.snapshotGapMs = 0;
    this.snapshotGapJitterMs = 0;

    this.serverTick = 0;
    this.netV2Reset = false;
    this.lastProtocol = '';
    this.lastSectorBootstrap = false;
    this.sectorBootstrapCounts = {};
    this.serverTime = 0;
    this.serverEventAgeAvgMs = 0;
    this.serverEventAgeMaxMs = 0;
    this.projectileEventAgeAvgMs = 0;
    this.projectileEventAgeMaxMs = 0;
    this.logisticEventAgeAvgMs = 0;
    this.logisticEventAgeMaxMs = 0;
    this.lastSnapshotEventCounts = {};
    this.lastProjectilePacket = null;
    this.lastCombatPacket = null;
    this.lastNetworkEventsPacket = null;
    this.lastLifecyclePacket = null;
    this.lastStatusPacket = null;
    this.lastSessionPacket = null;
    this.clientEntityCounts = {};
    this.clientEventCounts = {};
    this.inputSeq = 0;
    this.ackInputSeq = 0;
    this.pendingInputs = 0;
    this.correctionCount = 0;
    this.correctionDistanceAvg = 0;
    this.correctionDistanceMax = 0;
    this.softReconciliationCount = 0;
    this.softReconciliationApplied = 0;
    this.softReconciliationAvg = 0;
    this.softReconciliationMax = 0;
    this.hardReconciliationCount = 0;
    this.entityCounts = {};
    this.snapshotSections = {};
    this.snapshotSectionBytes = {};
    this.wsBufferedAmount = 0;
    this.skippedSnapshots = 0;
    this.droppedByBackpressure = 0;
    this.clock = null;
    this.interpolation = null;
    this.inputHistory = null;
    this.eventDeduper = null;
    this.eventDrivenHudSource = null;
  }

  setClock(clock) {
    this.clock = clock || null;
  }

  setInterpolationStore(store) {
    this.interpolation = store || null;
  }

  setInputHistory(history) {
    this.inputHistory = history || null;
  }

  setEventDeduper(deduper) {
    this.eventDeduper = deduper || null;
  }

  setEventDrivenHudSource(source) {
    this.eventDrivenHudSource = source || null;
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  setVisible(value) {
    this.visible = !!value;
    this.setEnabled(this.visible || this.enabled);
  }

  recordClientState(store) {
    if (!store) return;
    this.clientEntityCounts = {
      projectiles: store.projectiles?.size || 0,
      players: store.players?.size || 0,
      mobs: store.mobs?.size || 0,
      asteroids: store.asteroids?.size || 0,
      structures: store.structures?.size || 0,
      loots: store.loots?.size || 0,
      drones: store.logisticDrones?.size || 0,
      areaEffects: store.areaEffects?.size || 0
    };
    this.clientEventCounts = {
      projectileTombstones: store.projectileEventTombstones?.size || 0,
      projectileEventIds: store.projectileEventIds?.size || 0,
      logisticVisuals: store.logisticTransferVisuals?.size || 0,
      logisticCompleted: store.logisticCompletedVisualItems?.size || 0,
      networkEvents: Array.isArray(store.networkEvents) ? store.networkEvents.length : 0,
      pendingCombatFx: Array.isArray(store.pendingCombatFx) ? store.pendingCombatFx.length : 0,
      pendingSfx: Array.isArray(store.pendingSfx) ? store.pendingSfx.length : 0,
      lastRemotePlayerPruneReason: store.lastRemotePlayerPruneReason || '',
      lastRemotePlayerClearReason: store.lastRemotePlayerClearReason || ''
    };
  }

  pushDebugHistory(entry = {}) {
    if (!Array.isArray(this.debugHistory)) this.debugHistory = [];
    if (!Number.isFinite(Number(this.debugHistoryMs))) this.debugHistoryMs = 10000;
    if (!Number.isFinite(Number(this.debugSequence))) this.debugSequence = 0;
    const now = nowMs();
    const item = {
      seq: ++this.debugSequence,
      at: now,
      wallTime: Date.now(),
      ...entry
    };
    this.debugHistory.push(item);
    const cutoff = now - this.debugHistoryMs;
    while (this.debugHistory.length && Number(this.debugHistory[0].at || 0) < cutoff) this.debugHistory.shift();
  }

  getDebugHistory() {
    if (!Array.isArray(this.debugHistory)) return [];
    const historyMs = Number.isFinite(Number(this.debugHistoryMs)) ? Number(this.debugHistoryMs) : 10000;
    const cutoff = nowMs() - historyMs;
    return this.debugHistory.filter((entry) => Number(entry.at || 0) >= cutoff);
  }

  downloadDebugLog() {
    const snapshot = this.snapshot();
    const history = this.getDebugHistory();
    const payload = {
      kind: 'gravitar_net_debug_log',
      version: 1,
      exportedAt: new Date().toISOString(),
      durationMs: this.debugHistoryMs,
      current: snapshot,
      history
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gravitar-net-debug-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  recordFrame() {
    const now = nowMs();
    if (this.lastFrameAt > 0) {
      const ms = Math.max(0, now - this.lastFrameAt);
      this.frameMs = ms;
      this.frameMsAvg = ema(this.frameMsAvg, ms, 0.10);
      this.frameMsMax = Math.max(this.frameMsMax, ms);
    }
    this.lastFrameAt = now;
    this.framesWindow += 1;
  }

  recordInboundBytes(bytes) {
    const b = finite(bytes, 0);
    this.bytesInWindow += b;
    this.totalBytesIn += b;
  }

  recordOutboundBytes(bytes) {
    const b = finite(bytes, 0);
    this.bytesOutWindow += b;
    this.totalBytesOut += b;
  }

  recordInboundPacket(type = '', bytes = 0) {
    this.packetsInWindow += 1;
    this.totalPacketsIn += 1;
    this.lastPacketInBytes = finite(bytes, 0);
    this.lastPacketType = String(type || '');
    const key = String(type || 'unknown');
    this.packetTypeInWindow[key] = (this.packetTypeInWindow[key] || 0) + 1;
    this.pushDebugHistory({
      kind: 'packet_in',
      type: key,
      bytes: finite(bytes, 0)
    });
  }

  recordOutboundPacket(type = '', bytes = 0) {
    this.packetsOutWindow += 1;
    this.totalPacketsOut += 1;
    this.lastPacketOutBytes = finite(bytes, 0);
    const key = String(type || 'unknown');
    this.packetTypeOutWindow[key] = (this.packetTypeOutWindow[key] || 0) + 1;
    this.pushDebugHistory({
      kind: 'packet_out',
      type: key,
      bytes: finite(bytes, 0)
    });
  }

  recordAckPacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    this.ackPacketsInWindow += 1;
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.serverTime = finite(msg?.time, this.serverTime);
    if (Number.isFinite(Number(msg?.ackInputSeq))) {
      this.ackInputSeq = Number(msg.ackInputSeq) | 0;
      this.inputHistory?.ack?.(this.ackInputSeq);
      this.pendingInputs = this.inputHistory?.stats?.().pending ?? Math.max(0, (this.inputSeq | 0) - (this.ackInputSeq | 0));
    }
    this.pushDebugHistory({
      kind: 'input_ack_v2',
      type: msg?.t || 'input_ack_v2',
      bytes: b,
      ackInputSeq: this.ackInputSeq,
      serverTime: this.serverTime,
      serverTick: this.serverTick
    });
  }

  recordStatusPacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    this.statusPacketsInWindow += 1;
    this.lastStatusPacket = {
      players: Array.isArray(msg?.players) ? msg.players.length : 0,
      ackInputSeq: msg?.ackInputSeq | 0,
      time: msg?.time || 0
    };
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.serverTime = finite(msg?.time, this.serverTime);
    if (Number.isFinite(Number(msg?.ackInputSeq))) {
      this.ackInputSeq = Number(msg.ackInputSeq) | 0;
      this.inputHistory?.ack?.(this.ackInputSeq);
      this.pendingInputs = this.inputHistory?.stats?.().pending ?? Math.max(0, (this.inputSeq | 0) - (this.ackInputSeq | 0));
    }
    this.pushDebugHistory({
      kind: 'player_status_v2',
      type: msg?.t || 'player_status_v2',
      bytes: b,
      players: this.lastStatusPacket.players,
      ackInputSeq: this.ackInputSeq,
      serverTime: this.serverTime,
      serverTick: this.serverTick
    });
  }

  recordSessionPacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    this.sessionPacketsInWindow += 1;
    this.lastSessionPacket = {
      players: Array.isArray(msg?.players) ? msg.players.length : 0,
      time: msg?.time || 0
    };
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.serverTime = finite(msg?.time, this.serverTime);
    this.pushDebugHistory({
      kind: 'player_session_v2',
      type: msg?.t || 'player_session_v2',
      bytes: b,
      players: this.lastSessionPacket.players,
      serverTime: this.serverTime,
      serverTick: this.serverTick
    });
  }

  recordLifecyclePacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    this.lifecyclePacketsInWindow += 1;
    this.lastLifecyclePacket = {
      type: msg?.t || '',
      ids: Array.isArray(msg?.ids) ? msg.ids.map((id) => id | 0) : [],
      players: Array.isArray(msg?.players) ? msg.players.map((p) => p.id | 0) : [],
      reason: msg?.reason || '',
      time: msg?.time || 0
    };
    this.pushDebugHistory({
      kind: 'lifecycle',
      type: msg?.t || 'unknown',
      bytes: b,
      protocol: msg?.protocol || '',
      ids: this.lastLifecyclePacket.ids,
      players: this.lastLifecyclePacket.players,
      reason: this.lastLifecyclePacket.reason,
      serverTime: msg?.time || 0,
      serverTick: msg?.tick || 0
    });
  }

  recordNetworkEventsPacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    const events = Array.isArray(msg?.events) ? msg.events : [];
    this.networkPacketV2InWindow += 1;
    this.serverEventsInWindow += events.length;
    this.lastNetworkEventsPacket = {
      events: events.length,
      bytes: b,
      time: msg?.time || 0
    };
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.serverTime = finite(msg?.time, this.serverTime);
    this.pushDebugHistory({
      kind: 'network_events_v2',
      type: msg?.t || 'network_events_v2',
      bytes: b,
      count: events.length,
      serverTime: this.serverTime,
      serverTick: this.serverTick,
      events: events.slice(0, 12).map((ev) => ({
        id: ev?.id | 0,
        type: ev?.type || '',
        source: ev?.source || '',
        targetPlayerId: ev?.targetPlayerId | 0,
        slot: ev?.payload?.slot || '',
        sfxType: ev?.payload?.sfxType || '',
        cooldownLeft: ev?.payload?.cooldownLeft
      }))
    });
  }

  recordProjectilePacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    const events = Array.isArray(msg?.events) ? msg.events : [];
    this.projectilePacketV2InWindow += 1;
    this.projectileEventsInWindow += events.length;
    this.lastProjectilePacket = {
      events: events.length,
      bytes: b,
      time: msg?.time || 0
    };
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.serverTime = finite(msg?.time, this.serverTime);
    this.pushDebugHistory({
      kind: 'projectile_events_v2',
      type: msg?.t || 'projectile_events_v2',
      bytes: b,
      count: events.length,
      serverTime: this.serverTime,
      serverTick: this.serverTick,
      events: events.slice(0, 8).map((ev) => ({
        id: ev?.id | 0,
        action: ev?.action || '',
        projectileId: ev?.projectileId | 0,
        x: ev?.x,
        y: ev?.y,
        targetId: ev?.target?.id | 0,
        targetKind: ev?.target?.kind || ''
      }))
    });
  }

  recordCombatPacket(msg, bytes = 0) {
    const b = finite(bytes, 0);
    const events = Array.isArray(msg?.events) ? msg.events : [];
    this.combatPacketV2InWindow += 1;
    this.lastCombatPacket = {
      events: events.length,
      bytes: b,
      time: msg?.time || 0
    };
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.serverTime = finite(msg?.time, this.serverTime);
    this.pushDebugHistory({
      kind: 'combat_events_v2',
      type: msg?.t || 'combat_events_v2',
      bytes: b,
      count: events.length,
      serverTime: this.serverTime,
      serverTick: this.serverTick,
      events: events.slice(0, 8).map((ev) => ({
        id: ev?.id | 0,
        type: ev?.type || '',
        targetId: ev?.targetId | 0,
        targetKind: ev?.targetKind || '',
        amount: ev?.amount || 0,
        x: ev?.x,
        y: ev?.y
      }))
    });
  }

  recordPosePacket(msg, bytes = 0) {
    const now = nowMs();
    const b = finite(bytes, 0);
    this.posePacketsInWindow += 1;
    if (this.lastPosePacketAt > 0) {
      const gap = now - this.lastPosePacketAt;
      this.posePacketGapMs = ema(this.posePacketGapMs, gap, 0.18);
      this.posePacketGapMaxMs = Math.max(this.posePacketGapMaxMs, gap);
    }
    this.lastPosePacketAt = now;
    this.lastSnapshotBytes = b;
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.netV2Reset = !!msg?.net?.netV2Reset || msg?.protocol === 'net_v2_reset';
    this.lastProtocol = msg?.protocol || (this.netV2Reset ? 'net_v2_reset' : this.lastProtocol);
    this.serverTime = finite(msg?.time, this.serverTime);
    this.pushDebugHistory({
      kind: 'player_pose_v2',
      type: msg?.t || 'player_pose_v2',
      bytes: b,
      protocol: msg?.protocol || '',
      serverTime: this.serverTime,
      serverTick: this.serverTick,
      counts: {
        players: Array.isArray(msg?.players) ? msg.players.length : 0
      }
    });
  }

  recordSnapshot(msg, bytes = 0) {
    const now = nowMs();
    const b = finite(bytes, 0);
    if (msg?.t === 'state_v2') this.stateV2InWindow += 1;
    else this.snapshotsInWindow += 1;
    this.lastSnapshotBytes = b;
    this.avgSnapshotBytes = ema(this.avgSnapshotBytes, b, 0.10);
    this.maxSnapshotBytes = Math.max(this.maxSnapshotBytes, b);
    if (this.lastSnapshotAt > 0) {
      const gap = now - this.lastSnapshotAt;
      this.snapshotGapJitterMs = ema(this.snapshotGapJitterMs, Math.abs(gap - (this.snapshotGapMs || gap)), 0.12);
      this.snapshotGapMs = ema(this.snapshotGapMs, gap, 0.16);
    }
    this.lastSnapshotAt = now;
    this.serverTick = finite(msg?.tick, this.serverTick);
    this.netV2Reset = !!msg?.net?.netV2Reset || msg?.protocol === 'net_v2_reset';
    this.lastSectorBootstrap = !!msg?.sectorBootstrap;
    this.sectorBootstrapCounts = msg?.sectorBootstrap ? {
      asteroids: Array.isArray(msg.sectorBootstrap.asteroids) ? msg.sectorBootstrap.asteroids.length : 0,
      mobs: Array.isArray(msg.sectorBootstrap.mobs) ? msg.sectorBootstrap.mobs.length : 0,
      stations: Array.isArray(msg.sectorBootstrap.stations) ? msg.sectorBootstrap.stations.length : 0,
      structures: Array.isArray(msg.sectorBootstrap.structures) ? msg.sectorBootstrap.structures.length : 0,
      portals: Array.isArray(msg.sectorBootstrap.portals) ? msg.sectorBootstrap.portals.length : 0,
      loots: Array.isArray(msg.sectorBootstrap.loots) ? msg.sectorBootstrap.loots.length : 0
    } : this.sectorBootstrapCounts;
    this.lastProtocol = msg?.protocol || (this.netV2Reset ? 'net_v2_reset' : this.lastProtocol);
    this.serverTime = finite(msg?.time, this.serverTime);
    if (Number.isFinite(Number(msg?.ackInputSeq))) {
      this.ackInputSeq = Number(msg.ackInputSeq) | 0;
      this.inputHistory?.ack?.(this.ackInputSeq);
    }
    if (Number.isFinite(Number(msg?.net?.skippedSnapshots))) this.skippedSnapshots = Number(msg.net.skippedSnapshots) | 0;
    this.projectileLabMinimal = !!msg?.net?.projectileLabMinimal;

    const serverTime = finite(msg?.time, 0);
    if (serverTime > 0) {
      const offset = serverTime - Date.now();
      this.serverOffsetMs = offset;
      this.serverOffsetEmaMs = ema(this.serverOffsetEmaMs, offset, 0.04);
    }

    this.entityCounts = {
      players: Array.isArray(msg?.players) ? msg.players.length : 0,
      mobs: Array.isArray(msg?.mobs) ? msg.mobs.length : 0,
      projectiles: Array.isArray(msg?.projectiles) ? msg.projectiles.length : 0,
      asteroids: Array.isArray(msg?.asteroids) ? msg.asteroids.length : 0,
      structures: Array.isArray(msg?.structures) ? msg.structures.length : 0,
      loots: Array.isArray(msg?.loots) ? msg.loots.length : 0,
      drones: Array.isArray(msg?.logisticDrones) ? msg.logisticDrones.length : 0,
      areaEffects: Array.isArray(msg?.areaEffects) ? msg.areaEffects.length : 0
    };
    this.snapshotSections = msg?.net?.slim?.sectionCounts || Object.fromEntries(Object.entries(msg || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : (v && typeof v === 'object' ? 1 : 0)]));
    this.snapshotSectionBytes = msg?.net?.slim?.sectionBytes || {};
    const genericEvents = (Array.isArray(msg?.events) ? msg.events.length : 0);
    const combatFx = (Array.isArray(msg?.combatFx) ? msg.combatFx.length : 0);
    const worldSfx = (Array.isArray(msg?.worldSfx) ? msg.worldSfx.length : 0);
    const logistics = (Array.isArray(msg?.logisticTransferEvents) ? msg.logisticTransferEvents.length : 0);
    const projectiles = (Array.isArray(msg?.projectileEvents) ? msg.projectileEvents.length : 0);
    this.lastSnapshotEventCounts = {
      events: genericEvents,
      combatFx,
      worldSfx,
      logistics,
      projectiles,
      meSfx: Array.isArray(msg?.me?.sfx) ? msg.me.sfx.length : 0
    };
    const eventAge = (arr) => {
      if (!Array.isArray(arr) || !arr.length || this.serverTime <= 0) return null;
      let sum = 0;
      let max = 0;
      let count = 0;
      for (const ev of arr) {
        const age = Math.max(0, this.serverTime - finite(ev?.serverTime, this.serverTime));
        sum += age;
        max = Math.max(max, age);
        count += 1;
      }
      return count ? { avg: sum / count, max } : null;
    };
    const logAge = eventAge(msg?.logisticTransferEvents);
    const projAge = eventAge(msg?.projectileEvents);
    const allAges = [
      ...(Array.isArray(msg?.events) ? msg.events : []),
      ...(Array.isArray(msg?.logisticTransferEvents) ? msg.logisticTransferEvents : []),
      ...(Array.isArray(msg?.projectileEvents) ? msg.projectileEvents : [])
    ];
    const allAge = eventAge(allAges);
    if (logAge) {
      this.logisticEventAgeAvgMs = ema(this.logisticEventAgeAvgMs, logAge.avg, 0.18);
      this.logisticEventAgeMaxMs = Math.max(this.logisticEventAgeMaxMs, logAge.max);
    }
    if (projAge) {
      this.projectileEventAgeAvgMs = ema(this.projectileEventAgeAvgMs, projAge.avg, 0.18);
      this.projectileEventAgeMaxMs = Math.max(this.projectileEventAgeMaxMs, projAge.max);
    }
    if (allAge) {
      this.serverEventAgeAvgMs = ema(this.serverEventAgeAvgMs, allAge.avg, 0.18);
      this.serverEventAgeMaxMs = Math.max(this.serverEventAgeMaxMs, allAge.max);
    }
    this.eventsInWindow += genericEvents + combatFx + worldSfx + logistics + projectiles;
    this.serverEventsInWindow += logistics + projectiles;
    this.logisticEventsInWindow += logistics;
    this.projectileEventsInWindow += projectiles;
    this.sfxInWindow += worldSfx + (Array.isArray(msg?.me?.sfx) ? msg.me.sfx.length : 0);
    this.pushDebugHistory({
      kind: msg?.t === 'state_v2' ? 'state_v2' : 'snapshot',
      type: msg?.t || 'unknown',
      bytes: b,
      protocol: msg?.protocol || '',
      netV2Reset: !!this.netV2Reset,
      staticWorld: !!msg?.staticWorld || !!msg?.net?.staticWorld,
      fullUi: !!msg?.fullUi || !!msg?.net?.fullUi,
      sectorBootstrap: !!msg?.sectorBootstrap,
      serverTime: this.serverTime,
      serverTick: this.serverTick,
      ackInputSeq: msg?.ackInputSeq | 0,
      counts: {
        players: Array.isArray(msg?.players) ? msg.players.length : 0,
        asteroids: Array.isArray(msg?.asteroids) ? msg.asteroids.length : 0,
        mobs: Array.isArray(msg?.mobs) ? msg.mobs.length : 0,
        projectiles: Array.isArray(msg?.projectiles) ? msg.projectiles.length : 0,
        structures: Array.isArray(msg?.structures) ? msg.structures.length : 0,
        loots: Array.isArray(msg?.loots) ? msg.loots.length : 0,
        sectorAsteroids: Array.isArray(msg?.sectorBootstrap?.asteroids) ? msg.sectorBootstrap.asteroids.length : 0,
        sectorMobs: Array.isArray(msg?.sectorBootstrap?.mobs) ? msg.sectorBootstrap.mobs.length : 0,
        sectorStructures: Array.isArray(msg?.sectorBootstrap?.structures) ? msg.sectorBootstrap.structures.length : 0
      },
      events: { ...this.lastSnapshotEventCounts },
      sectionBytes: { ...this.lastSectionBytes },
      posePreview: Array.isArray(msg?.players) ? msg.players.slice(0, 3).map((p) => ({
        id: p.id | 0,
        x: Number(p.x || 0),
        y: Number(p.y || 0),
        vx: Number(p.vx || 0),
        vy: Number(p.vy || 0),
        hasMoveTarget: !!p.hasMoveTarget,
        moveTx: Number(p.moveTx || 0),
        moveTy: Number(p.moveTy || 0),
        moveIntentSeq: p.moveIntentSeq | 0
      })) : []
    });
  }

  recordInput(obj, bytes = 0, wsBufferedAmount = 0) {
    this.inputsOutWindow += 1;
    this.lastInputAt = nowMs();
    this.lastInputBytes = finite(bytes, 0);
    this.avgInputBytes = ema(this.avgInputBytes, this.lastInputBytes, 0.12);
    this.maxInputBytes = Math.max(this.maxInputBytes, this.lastInputBytes);
    this.wsBufferedAmount = finite(wsBufferedAmount, 0);
    if (Number.isFinite(Number(obj?.inputSeq))) this.inputSeq = Number(obj.inputSeq) | 0;
    this.inputHistory?.record?.(obj);
    this.pendingInputs = this.inputHistory?.stats?.().pending ?? Math.max(0, (this.inputSeq | 0) - (this.ackInputSeq | 0));
  }

  recordCommand(bytes = 0, wsBufferedAmount = 0) {
    this.commandsOutWindow += 1;
    this.recordOutboundBytes(bytes);
    this.wsBufferedAmount = finite(wsBufferedAmount, 0);
  }

  recordCommandAck() {
    this.cmdAcksInWindow += 1;
  }

  recordPingSent(seq) {
    this.lastPingSentAt = nowMs();
    this.pingSeq = seq | 0;
  }

  recordPong(msg) {
    const now = nowMs();
    const sentAt = finite(msg?.clientSentAt, 0);
    if (sentAt <= 0) return;
    const rtt = Math.max(0, now - sentAt);
    const prev = this.rttMs || rtt;
    this.rttMs = ema(this.rttMs, rtt, 0.18);
    this.rttMinMs = this.rttMinMs > 0 ? Math.min(this.rttMinMs, rtt) : rtt;
    this.rttMaxMs = Math.max(this.rttMaxMs, rtt);
    this.jitterMs = ema(this.jitterMs, Math.abs(rtt - prev), 0.16);
    this.lastPongAt = now;
    const serverTime = finite(msg?.serverTime, 0);
    if (serverTime > 0) {
      const offset = serverTime - Date.now() + rtt * 0.5;
      this.serverOffsetMs = offset;
      this.serverOffsetEmaMs = ema(this.serverOffsetEmaMs, offset, 0.08);
    }
  }

  recordCorrection(distance) {
    const d = Math.max(0, finite(distance, 0));
    if (d <= 0.001) return;
    this.correctionCount += 1;
    this.correctionDistanceAvg = ema(this.correctionDistanceAvg, d, 0.10);
    this.correctionDistanceMax = Math.max(this.correctionDistanceMax, d);
  }

  recordSoftReconciliation(distance, applied = 0, mode = 'soft') {
    const d = Math.max(0, finite(distance, 0));
    const a = Math.max(0, finite(applied, 0));
    if (mode === 'hard') {
      this.hardReconciliationCount += 1;
    } else if (d > 0.001 || a > 0.001) {
      this.softReconciliationCount += 1;
      this.softReconciliationAvg = ema(this.softReconciliationAvg, d, 0.10);
      this.softReconciliationMax = Math.max(this.softReconciliationMax, d);
      this.softReconciliationApplied = ema(this.softReconciliationApplied, a, 0.10);
    }
  }

  recordBackpressureDrop(count = 1) {
    this.droppedByBackpressure += Math.max(1, count | 0);
  }

  tick() {
    const now = nowMs();
    const elapsed = Math.max(0.25, (now - this.windowStartedAt) / 1000);
    if (elapsed < 1) return;
    this.bytesInPerSec = this.bytesInWindow / elapsed;
    this.bytesOutPerSec = this.bytesOutWindow / elapsed;
    this.packetsInPerSec = this.packetsInWindow / elapsed;
    this.packetsOutPerSec = this.packetsOutWindow / elapsed;
    this.fps = this.framesWindow / elapsed;
    this.snapshotsPerSec = this.snapshotsInWindow / elapsed;
    this.stateV2PerSec = this.stateV2InWindow / elapsed;
    this.posePacketsPerSec = this.posePacketsInWindow / elapsed;
    this.lifecyclePacketsPerSec = this.lifecyclePacketsInWindow / elapsed;
    this.ackPacketsPerSec = this.ackPacketsInWindow / elapsed;
    this.statusPacketsPerSec = this.statusPacketsInWindow / elapsed;
    this.sessionPacketsPerSec = this.sessionPacketsInWindow / elapsed;
    this.inputsPerSec = this.inputsOutWindow / elapsed;
    this.commandsPerSec = this.commandsOutWindow / elapsed;
    this.cmdAcksPerSec = this.cmdAcksInWindow / elapsed;
    this.eventsPerSec = this.eventsInWindow / elapsed;
    this.sfxPerSec = this.sfxInWindow / elapsed;
    this.pushDebugHistory({
      kind: 'aggregate',
      fps: this.fps,
      frameMsAvg: this.frameMsAvg,
      frameMsMax: this.frameMsMax,
      rttMs: this.rttMs,
      jitterMs: this.jitterMs,
      snapshotsPerSec: this.snapshotsPerSec,
      stateV2PerSec: this.stateV2PerSec,
      posePacketsPerSec: this.posePacketsPerSec,
      lifecyclePacketsPerSec: this.lifecyclePacketsPerSec,
      ackPacketsPerSec: this.ackPacketsPerSec,
      statusPacketsPerSec: this.statusPacketsPerSec,
      sessionPacketsPerSec: this.sessionPacketsPerSec,
      lastStatusPacket: this.lastStatusPacket,
      lastSessionPacket: this.lastSessionPacket,
      lastLifecyclePacket: this.lastLifecyclePacket,
      packetsInPerSec: this.packetsInPerSec,
      packetsOutPerSec: this.packetsOutPerSec,
      bytesInPerSec: this.bytesInPerSec,
      bytesOutPerSec: this.bytesOutPerSec,
      inputsPerSec: this.inputsPerSec,
      pendingInputs: this.pendingInputs,
      avgSnapshotBytes: this.avgSnapshotBytes,
      maxSnapshotBytes: this.maxSnapshotBytes,
      clientEntityCounts: { ...this.clientEntityCounts },
      clientEventCounts: { ...this.clientEventCounts },
      packetTypeInPerSec: { ...this.packetTypeInPerSec },
      packetTypeOutPerSec: { ...this.packetTypeOutPerSec }
    });
    this.bytesInWindow = 0;
    this.bytesOutWindow = 0;
    this.packetsInWindow = 0;
    this.packetsOutWindow = 0;
    this.framesWindow = 0;
    this.snapshotsInWindow = 0;
    this.stateV2InWindow = 0;
    this.posePacketsInWindow = 0;
    this.lifecyclePacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.lifecyclePacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.ackPacketsInWindow = 0;
    this.statusPacketsInWindow = 0;
    this.sessionPacketsInWindow = 0;
    this.lastPosePacketAt = 0;
    this.posePacketGapMs = 0;
    this.posePacketGapMaxMs = 0;
    this.inputsOutWindow = 0;
    this.commandsOutWindow = 0;
    this.cmdAcksInWindow = 0;
    this.eventsInWindow = 0;
    this.sfxInWindow = 0;
    this.serverEventsInWindow = 0;
    this.logisticEventsInWindow = 0;
    this.projectileEventsInWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.serverEventsInWindow = 0;
    this.logisticEventsInWindow = 0;
    this.projectileEventsInWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.projectilePacketV2InWindow = 0;
    this.combatPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.networkPacketV2InWindow = 0;
    this.windowStartedAt = now;
    this.pendingInputs = this.inputHistory?.stats?.().pending ?? Math.max(0, (this.inputSeq | 0) - (this.ackInputSeq | 0));
  }

  snapshot() {
    this.tick();
    return {
      enabled: this.enabled,
      visible: this.visible,
      rttMs: this.rttMs,
      rttMinMs: this.rttMinMs,
      rttMaxMs: this.rttMaxMs,
      jitterMs: this.jitterMs,
      serverOffsetMs: this.serverOffsetEmaMs,
      snapshotGapMs: this.snapshotGapMs,
      snapshotGapJitterMs: this.snapshotGapJitterMs,
      snapshotsPerSec: this.snapshotsPerSec,
      stateV2PerSec: this.stateV2PerSec,
      posePacketsPerSec: this.posePacketsPerSec,
      lifecyclePacketsPerSec: this.lifecyclePacketsPerSec,
      ackPacketsPerSec: this.ackPacketsPerSec,
      statusPacketsPerSec: this.statusPacketsPerSec,
      sessionPacketsPerSec: this.sessionPacketsPerSec,
      lastStatusPacket: this.lastStatusPacket,
      lastSessionPacket: this.lastSessionPacket,
      lastLifecyclePacket: this.lastLifecyclePacket,
      packetsInPerSec: this.packetsInPerSec,
      packetsOutPerSec: this.packetsOutPerSec,
      totalPacketsIn: this.totalPacketsIn,
      totalPacketsOut: this.totalPacketsOut,
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      debugHistoryCount: this.getDebugHistory().length,
      lastPacketInBytes: this.lastPacketInBytes,
      lastPacketOutBytes: this.lastPacketOutBytes,
      lastPacketType: this.lastPacketType,
      packetTypeInPerSec: { ...this.packetTypeInPerSec },
      packetTypeOutPerSec: { ...this.packetTypeOutPerSec },
      fps: this.fps,
      frameMs: this.frameMs,
      frameMsAvg: this.frameMsAvg,
      frameMsMax: this.frameMsMax,
      inputsPerSec: this.inputsPerSec,
      commandsPerSec: this.commandsPerSec,
      cmdAcksPerSec: this.cmdAcksPerSec,
      bytesInPerSec: this.bytesInPerSec,
      bytesOutPerSec: this.bytesOutPerSec,
      avgSnapshotBytes: this.avgSnapshotBytes,
      maxSnapshotBytes: this.maxSnapshotBytes,
      lastSnapshotBytes: this.lastSnapshotBytes,
      avgInputBytes: this.avgInputBytes,
      maxInputBytes: this.maxInputBytes,
      pendingInputs: this.pendingInputs,
      inputSeq: this.inputSeq,
      ackInputSeq: this.ackInputSeq,
      correctionCount: this.correctionCount,
      correctionDistanceAvg: this.correctionDistanceAvg,
      correctionDistanceMax: this.correctionDistanceMax,
      softReconciliationCount: this.softReconciliationCount,
      softReconciliationAvg: this.softReconciliationAvg,
      softReconciliationMax: this.softReconciliationMax,
      softReconciliationApplied: this.softReconciliationApplied,
      hardReconciliationCount: this.hardReconciliationCount,
      entityCounts: { ...this.entityCounts },
      eventsPerSec: this.eventsPerSec,
      serverEventsPerSec: this.serverEventsPerSec,
      logisticEventsPerSec: this.logisticEventsPerSec,
      projectileEventsPerSec: this.projectileEventsPerSec,
      projectilePacketV2PerSec: this.projectilePacketV2PerSec,
      combatPacketV2PerSec: this.combatPacketV2PerSec,
      networkPacketV2PerSec: this.networkPacketV2PerSec,
      lastNetworkEventsPacket: this.lastNetworkEventsPacket,
      lastProjectilePacket: this.lastProjectilePacket,
      lastCombatPacket: this.lastCombatPacket,
      sfxPerSec: this.sfxPerSec,
      wsBufferedAmount: this.wsBufferedAmount,
      skippedSnapshots: this.skippedSnapshots,
      droppedByBackpressure: this.droppedByBackpressure,
      serverTick: this.serverTick,
      netV2Reset: !!this.netV2Reset,
      protocol: this.lastProtocol,
      lastSectorBootstrap: !!this.lastSectorBootstrap,
      sectorBootstrapCounts: { ...this.sectorBootstrapCounts },
      serverTime: this.serverTime,
      projectileLabMinimal: !!this.projectileLabMinimal,
      serverEventAgeAvgMs: this.serverEventAgeAvgMs,
      serverEventAgeMaxMs: this.serverEventAgeMaxMs,
      projectileEventAgeAvgMs: this.projectileEventAgeAvgMs,
      projectileEventAgeMaxMs: this.projectileEventAgeMaxMs,
      logisticEventAgeAvgMs: this.logisticEventAgeAvgMs,
      logisticEventAgeMaxMs: this.logisticEventAgeMaxMs,
      lastSnapshotEventCounts: { ...this.lastSnapshotEventCounts },
      clientEntityCounts: { ...this.clientEntityCounts },
      clientEventCounts: { ...this.clientEventCounts },
      clock: this.clock?.snapshot?.() || null,
      interpolation: this.interpolation?.stats?.() || null,
      inputHistory: this.inputHistory?.stats?.() || null,
      eventDeduper: this.eventDeduper?.stats?.() || null,
      eventDrivenHud: this.eventDrivenHudSource?.getEventDrivenHudStats?.() || null,
      snapshotSectionBytes: { ...this.snapshotSectionBytes },
      snapshotSections: { ...this.snapshotSections }
    };
  }
}
