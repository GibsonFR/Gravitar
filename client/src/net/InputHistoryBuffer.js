function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cloneInput(input = {}) {
  return {
    t: input.t || 'input',
    inputSeq: input.inputSeq | 0,
    clientTime: finite(input.clientTime, nowMs()),
    recordedAt: nowMs(),
    vw: finite(input.vw, 0),
    vh: finite(input.vh, 0),
    cx: finite(input.cx, 0),
    cy: finite(input.cy, 0),
    csx: input.csx | 0,
    csy: input.csy | 0,
    cvx: finite(input.cvx, 0),
    cvy: finite(input.cvy, 0),
    crot: finite(input.crot, 0),
    cthrust: finite(input.cthrust, 0),
    aimWorldX: finite(input.aimWorldX, 0),
    aimWorldY: finite(input.aimWorldY, 0),
    moveWorld: !!input.moveWorld,
    moveWorldX: finite(input.moveWorldX, 0),
    moveWorldY: finite(input.moveWorldY, 0),
    primaryHold: !!input.primaryHold,
    primaryClick: !!input.primaryClick,
    selectedKind: input.selectedKind || '',
    selectedId: input.selectedId | 0,
    attackKind: input.attackKind || '',
    attackId: input.attackId | 0,
    actionCount: Array.isArray(input.actions) ? input.actions.length : 0,
    actions: Array.isArray(input.actions)
      ? input.actions.map((a) => ({
        seq: a.seq | 0,
        type: String(a.type || ''),
        slot: String(a.slot || ''),
        kind: String(a.kind || ''),
        id: a.id | 0,
        aimX: finite(a.aimX, 0),
        aimY: finite(a.aimY, 0),
        cx: finite(a.cx, 0),
        cy: finite(a.cy, 0),
        crot: finite(a.crot, 0)
      }))
      : []
  };
}

export class InputHistoryBuffer {
  constructor(options = {}) {
    this.maxEntries = Math.max(32, options.maxEntries || 256);
    this.entries = [];
    this.lastSentSeq = 0;
    this.lastAckSeq = 0;
    this.lastAckAt = 0;
    this.ackCount = 0;
    this.recordCount = 0;
    this.droppedOldCount = 0;
    this.maxPendingObserved = 0;
    this.maxPendingAgeObservedMs = 0;
  }

  record(input) {
    if (!input || input.t !== 'input') return;
    const entry = cloneInput(input);
    if (!entry.inputSeq) return;
    this.entries.push(entry);
    this.lastSentSeq = Math.max(this.lastSentSeq | 0, entry.inputSeq | 0);
    this.recordCount += 1;
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
      this.droppedOldCount += 1;
    }
    this.maxPendingObserved = Math.max(this.maxPendingObserved, this.entries.length);
  }

  ack(ackSeq) {
    const seq = ackSeq | 0;
    if (!seq || seq <= (this.lastAckSeq | 0)) return 0;
    this.lastAckSeq = seq;
    this.lastAckAt = nowMs();
    this.ackCount += 1;
    const before = this.entries.length;
    while (this.entries.length && (this.entries[0].inputSeq | 0) <= seq) this.entries.shift();
    return before - this.entries.length;
  }

  getPendingInputs() {
    return this.entries;
  }

  getPendingAfter(ackSeq = this.lastAckSeq) {
    const seq = ackSeq | 0;
    return this.entries.filter((entry) => (entry.inputSeq | 0) > seq);
  }

  getOldestPendingAgeMs() {
    if (!this.entries.length) return 0;
    return Math.max(0, nowMs() - (this.entries[0].recordedAt || nowMs()));
  }

  getNewestPendingAgeMs() {
    if (!this.entries.length) return 0;
    return Math.max(0, nowMs() - (this.entries[this.entries.length - 1].recordedAt || nowMs()));
  }

  latestPose() {
    const last = this.entries[this.entries.length - 1];
    if (!last) return null;
    return {
      seq: last.inputSeq,
      x: last.cx,
      y: last.cy,
      sx: last.csx,
      sy: last.csy,
      vx: last.cvx,
      vy: last.cvy,
      rot: last.crot
    };
  }

  stats() {
    const oldest = this.getOldestPendingAgeMs();
    this.maxPendingAgeObservedMs = Math.max(this.maxPendingAgeObservedMs, oldest);
    return {
      pending: this.entries.length,
      lastSentSeq: this.lastSentSeq | 0,
      lastAckSeq: this.lastAckSeq | 0,
      oldestPendingAgeMs: oldest,
      newestPendingAgeMs: this.getNewestPendingAgeMs(),
      lastAckAgeMs: this.lastAckAt ? Math.max(0, nowMs() - this.lastAckAt) : 0,
      ackCount: this.ackCount,
      recordCount: this.recordCount,
      droppedOldCount: this.droppedOldCount,
      maxPendingObserved: this.maxPendingObserved,
      maxPendingAgeObservedMs: this.maxPendingAgeObservedMs
    };
  }
}
