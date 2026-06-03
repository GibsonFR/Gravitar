function localNowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function wallNowMs() {
  return Date.now();
}

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function ema(prev, next, alpha) {
  if (!Number.isFinite(prev) || prev === 0) return next;
  return prev + (next - prev) * alpha;
}

export class NetworkClock {
  constructor() {
    this.localStartedAt = localNowMs();
    this.offsetMs = 0;
    this.offsetRawMs = 0;
    this.rttMs = 0;
    this.jitterMs = 0;
    this.lastServerTimeMs = 0;
    this.lastSampleLocalMs = 0;
    this.lastSnapshotServerTimeMs = 0;
    this.lastSnapshotLocalMs = 0;
    this.snapshotGapMs = 72;
    this.snapshotGapJitterMs = 0;
    this.interpolationDelayMs = 120;
    this.minInterpolationDelayMs = 85;
    this.maxInterpolationDelayMs = 240;
    this.snapshotCount = 0;
    this.locked = false;
  }

  updateFromPong(msg = {}, localReceivedMs = localNowMs()) {
    const clientSentAt = finite(msg.clientSentAt, 0);
    const serverTime = finite(msg.serverTime, 0);
    if (clientSentAt <= 0 || serverTime <= 0) return;
    const rtt = Math.max(0, localReceivedMs - clientSentAt);
    const serverAtReceive = serverTime + rtt * 0.5;
    const offset = serverAtReceive - wallNowMs();

    const prevRtt = this.rttMs || rtt;
    this.rttMs = ema(this.rttMs, rtt, 0.18);
    this.jitterMs = ema(this.jitterMs, Math.abs(rtt - prevRtt), 0.16);
    this.offsetRawMs = offset;
    this.offsetMs = ema(this.offsetMs, offset, this.locked ? 0.035 : 0.18);
    this.lastServerTimeMs = serverAtReceive;
    this.lastSampleLocalMs = localReceivedMs;
    this.locked = true;
    this.recomputeInterpolationDelay();
  }

  updateFromSnapshot(msg = {}, localReceivedMs = localNowMs()) {
    const serverTime = finite(msg.time, 0);
    if (serverTime <= 0) return;

    if (this.lastSnapshotLocalMs > 0) {
      const gap = Math.max(1, localReceivedMs - this.lastSnapshotLocalMs);
      this.snapshotGapJitterMs = ema(this.snapshotGapJitterMs, Math.abs(gap - this.snapshotGapMs), 0.14);
      this.snapshotGapMs = ema(this.snapshotGapMs, gap, 0.16);
    }

    const offset = serverTime - wallNowMs();
    this.offsetRawMs = offset;
    this.offsetMs = ema(this.offsetMs, offset, this.locked ? 0.018 : 0.12);
    this.lastSnapshotServerTimeMs = serverTime;
    this.lastSnapshotLocalMs = localReceivedMs;
    this.snapshotCount += 1;
    this.locked = true;
    this.recomputeInterpolationDelay();
  }

  recomputeInterpolationDelay() {
    const base = Math.max(70, this.snapshotGapMs * 1.55);
    const jitterPad = Math.max(12, this.jitterMs * 2.8 + this.snapshotGapJitterMs * 1.7);
    const rttPad = Math.min(45, this.rttMs * 0.18);
    const target = clamp(base + jitterPad + rttPad, this.minInterpolationDelayMs, this.maxInterpolationDelayMs);
    this.interpolationDelayMs = ema(this.interpolationDelayMs, target, 0.08);
  }

  estimatedServerNowMs() {
    return wallNowMs() + this.offsetMs;
  }

  renderServerTimeMs() {
    return this.estimatedServerNowMs() - this.interpolationDelayMs;
  }

  ageOfLastSnapshotMs() {
    if (!this.lastSnapshotLocalMs) return 0;
    return Math.max(0, localNowMs() - this.lastSnapshotLocalMs);
  }

  snapshot() {
    return {
      offsetMs: this.offsetMs,
      offsetRawMs: this.offsetRawMs,
      rttMs: this.rttMs,
      jitterMs: this.jitterMs,
      snapshotGapMs: this.snapshotGapMs,
      snapshotGapJitterMs: this.snapshotGapJitterMs,
      interpolationDelayMs: this.interpolationDelayMs,
      estimatedServerNowMs: this.estimatedServerNowMs(),
      renderServerTimeMs: this.renderServerTimeMs(),
      ageOfLastSnapshotMs: this.ageOfLastSnapshotMs(),
      locked: this.locked,
      snapshotCount: this.snapshotCount
    };
  }
}
