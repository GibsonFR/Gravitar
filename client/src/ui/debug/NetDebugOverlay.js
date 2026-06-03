function fmtMs(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n)} ms` : '—';
}

function fmtRate(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(n < 10 ? 1 : 0) : '0';
}

function fmtBytes(v) {
  const n = Number(v) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

function countLine(counts = {}) {
  return `P:${counts.players || 0} M:${counts.mobs || 0} Pr:${counts.projectiles || 0} A:${counts.asteroids || 0} S:${counts.structures || 0} L:${counts.loots || 0}`;
}

export class NetDebugOverlay {
  constructor(netStats) {
    this.netStats = netStats;
    this.el = document.createElement('div');
    this.el.className = 'net-debug-overlay is-hidden';
    this.lastRenderAt = 0;
    this.visible = false;
    document.body.appendChild(this.el);
  }

  setVisible(value) {
    this.visible = !!value;
    this.el.classList.toggle('is-hidden', !this.visible);
    this.netStats?.setVisible?.(this.visible);
    if (this.visible) this.render(true);
  }

  toggle() {
    this.setVisible(!this.visible);
  }

  render(force = false) {
    if (!this.visible || !this.netStats) return;
    const now = performance.now();
    if (!force && now - this.lastRenderAt < 250) return;
    this.lastRenderAt = now;
    const s = this.netStats.snapshot();
    this.el.innerHTML = `
      <div class="net-debug-overlay__title">NET V263</div>
      <div class="net-debug-overlay__grid">
        <span>RTT</span><b>${fmtMs(s.rttMs)}</b>
        <span>Jitter</span><b>${fmtMs(s.jitterMs)}</b>
        <span>Snap gap</span><b>${fmtMs(s.snapshotGapMs)}</b>
        <span>Interp delay</span><b>${fmtMs(s.clock?.interpolationDelayMs)}</b>
        <span>Clock offset</span><b>${fmtMs(Math.abs(s.clock?.offsetMs || 0))}</b>
        <span>Snap age</span><b>${fmtMs(s.clock?.ageOfLastSnapshotMs)}</b>
        <span>Snap/s</span><b>${fmtRate(s.snapshotsPerSec)}</b>
        <span>Input/s</span><b>${fmtRate(s.inputsPerSec)}</b>
        <span>Pending input</span><b>${s.inputHistory?.pending ?? (s.pendingInputs | 0)}</b>
        <span>Input age</span><b>${fmtMs(s.inputHistory?.oldestPendingAgeMs)}</b>
        <span>Ack age</span><b>${fmtMs(s.inputHistory?.lastAckAgeMs)}</b>
        <span>In</span><b>${fmtBytes(s.bytesInPerSec)}/s</b>
        <span>Out</span><b>${fmtBytes(s.bytesOutPerSec)}/s</b>
        <span>Snap size</span><b>${fmtBytes(s.avgSnapshotBytes)} avg</b>
        <span>Snap max</span><b>${fmtBytes(s.maxSnapshotBytes)}</b>
        <span>Correction</span><b>${Math.round(s.correctionDistanceAvg || 0)} / ${Math.round(s.correctionDistanceMax || 0)}</b>
        <span>Soft rec</span><b>${Math.round(s.softReconciliationAvg || 0)} / ${Math.round(s.softReconciliationApplied || 0)}</b>
        <span>Hard rec</span><b>${s.hardReconciliationCount | 0}</b>
        <span>Entities</span><b>${countLine(s.entityCounts)}</b>
        <span>Interp buf</span><b>E:${s.interpolation?.entities || 0} S:${s.interpolation?.samples || 0}</b>
        <span>Events/s</span><b>${fmtRate(s.eventsPerSec)}</b>
        <span>Event dedup</span><b>${s.eventDeduper?.accepted || 0}/${s.eventDeduper?.duplicates || 0}</b>
        <span>Event HUD</span><b>A:${s.eventDrivenHud?.abilityUpdates || 0} D:${s.eventDrivenHud?.damageUpdates || 0} S:${s.eventDrivenHud?.statusUpdates || 0} P:${s.eventDrivenHud?.passiveUpdates || 0}</b>
        <span>Last reject</span><b>${s.eventDrivenHud?.lastAbilityReject ? `${s.eventDrivenHud.lastAbilityReject.slot}:${s.eventDrivenHud.lastAbilityReject.reason}` : '—'}</b>
        <span>SFX/s</span><b>${fmtRate(s.sfxPerSec)}</b>
        <span>WS buffer</span><b>${fmtBytes(s.wsBufferedAmount)}</b>
        <span>Drops</span><b>${s.droppedByBackpressure | 0}</b>
        <span>Input max</span><b>${s.inputHistory?.maxPendingObserved ?? 0} / ${fmtMs(s.inputHistory?.maxPendingAgeObservedMs)}</b>
        <span>Tick</span><b>${s.serverTick | 0}</b>
      </div>
      <div class="net-debug-overlay__hint">F9 : masquer · audit instrumentation seulement</div>
    `;
  }
}
