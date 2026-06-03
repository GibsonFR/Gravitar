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
    this.snapshotsInWindow = 0;
    this.inputsOutWindow = 0;
    this.commandsOutWindow = 0;
    this.cmdAcksInWindow = 0;
    this.eventsInWindow = 0;
    this.sfxInWindow = 0;

    this.bytesInPerSec = 0;
    this.bytesOutPerSec = 0;
    this.snapshotsPerSec = 0;
    this.inputsPerSec = 0;
    this.commandsPerSec = 0;
    this.cmdAcksPerSec = 0;
    this.eventsPerSec = 0;
    this.sfxPerSec = 0;

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
    this.serverTime = 0;
    this.inputSeq = 0;
    this.ackInputSeq = 0;
    this.pendingInputs = 0;
    this.correctionCount = 0;
    this.correctionDistanceAvg = 0;
    this.correctionDistanceMax = 0;
    this.entityCounts = {};
    this.snapshotSections = {};
    this.wsBufferedAmount = 0;
    this.skippedSnapshots = 0;
    this.droppedByBackpressure = 0;
    this.clock = null;
    this.interpolation = null;
  }

  setClock(clock) {
    this.clock = clock || null;
  }

  setInterpolationStore(store) {
    this.interpolation = store || null;
  }

  setEnabled(value) {
    this.enabled = !!value;
  }

  setVisible(value) {
    this.visible = !!value;
    this.setEnabled(this.visible || this.enabled);
  }

  recordInboundBytes(bytes) {
    const b = finite(bytes, 0);
    this.bytesInWindow += b;
  }

  recordOutboundBytes(bytes) {
    const b = finite(bytes, 0);
    this.bytesOutWindow += b;
  }

  recordSnapshot(msg, bytes = 0) {
    const now = nowMs();
    const b = finite(bytes, 0);
    this.snapshotsInWindow += 1;
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
    this.serverTime = finite(msg?.time, this.serverTime);
    if (Number.isFinite(Number(msg?.ackInputSeq))) this.ackInputSeq = Number(msg.ackInputSeq) | 0;
    if (Number.isFinite(Number(msg?.net?.skippedSnapshots))) this.skippedSnapshots = Number(msg.net.skippedSnapshots) | 0;

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
    this.snapshotSections = Object.fromEntries(Object.entries(msg || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : (v && typeof v === 'object' ? 1 : 0)]));
    this.eventsInWindow += (Array.isArray(msg?.combatFx) ? msg.combatFx.length : 0) + (Array.isArray(msg?.worldSfx) ? msg.worldSfx.length : 0);
    this.sfxInWindow += (Array.isArray(msg?.worldSfx) ? msg.worldSfx.length : 0) + (Array.isArray(msg?.me?.sfx) ? msg.me.sfx.length : 0);
  }

  recordInput(obj, bytes = 0, wsBufferedAmount = 0) {
    this.inputsOutWindow += 1;
    this.lastInputAt = nowMs();
    this.lastInputBytes = finite(bytes, 0);
    this.avgInputBytes = ema(this.avgInputBytes, this.lastInputBytes, 0.12);
    this.maxInputBytes = Math.max(this.maxInputBytes, this.lastInputBytes);
    this.wsBufferedAmount = finite(wsBufferedAmount, 0);
    if (Number.isFinite(Number(obj?.inputSeq))) this.inputSeq = Number(obj.inputSeq) | 0;
    this.pendingInputs = Math.max(0, (this.inputSeq | 0) - (this.ackInputSeq | 0));
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

  recordBackpressureDrop(count = 1) {
    this.droppedByBackpressure += Math.max(1, count | 0);
  }

  tick() {
    const now = nowMs();
    const elapsed = Math.max(0.25, (now - this.windowStartedAt) / 1000);
    if (elapsed < 1) return;
    this.bytesInPerSec = this.bytesInWindow / elapsed;
    this.bytesOutPerSec = this.bytesOutWindow / elapsed;
    this.snapshotsPerSec = this.snapshotsInWindow / elapsed;
    this.inputsPerSec = this.inputsOutWindow / elapsed;
    this.commandsPerSec = this.commandsOutWindow / elapsed;
    this.cmdAcksPerSec = this.cmdAcksInWindow / elapsed;
    this.eventsPerSec = this.eventsInWindow / elapsed;
    this.sfxPerSec = this.sfxInWindow / elapsed;
    this.bytesInWindow = 0;
    this.bytesOutWindow = 0;
    this.snapshotsInWindow = 0;
    this.inputsOutWindow = 0;
    this.commandsOutWindow = 0;
    this.cmdAcksInWindow = 0;
    this.eventsInWindow = 0;
    this.sfxInWindow = 0;
    this.windowStartedAt = now;
    this.pendingInputs = Math.max(0, (this.inputSeq | 0) - (this.ackInputSeq | 0));
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
      entityCounts: { ...this.entityCounts },
      eventsPerSec: this.eventsPerSec,
      sfxPerSec: this.sfxPerSec,
      wsBufferedAmount: this.wsBufferedAmount,
      skippedSnapshots: this.skippedSnapshots,
      droppedByBackpressure: this.droppedByBackpressure,
      serverTick: this.serverTick,
      serverTime: this.serverTime,
      clock: this.clock?.snapshot?.() || null,
      interpolation: this.interpolation?.stats?.() || null
    };
  }
}
