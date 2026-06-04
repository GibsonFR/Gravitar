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

function clientCountLine(counts = {}) {
  return `P:${counts.players || 0} M:${counts.mobs || 0} Pr:${counts.projectiles || 0} A:${counts.asteroids || 0} S:${counts.structures || 0} L:${counts.loots || 0}`;
}

function eventCountLine(counts = {}) {
  return `E:${counts.events || 0} FX:${counts.combatFx || 0} WS:${counts.worldSfx || 0} L:${counts.logistics || 0} P:${counts.projectiles || 0}`;
}

function sectorBootstrapLine(counts = {}) {
  return `A:${counts.asteroids || 0} M:${counts.mobs || 0} S:${counts.structures || 0} St:${counts.stations || 0} P:${counts.portals || 0} L:${counts.loots || 0}`;
}

function localEventLine(counts = {}) {
  return `pT:${counts.projectileTombstones || 0} pIds:${counts.projectileEventIds || 0} log:${counts.logisticVisuals || 0} fx:${counts.pendingCombatFx || 0}`;
}

function topSectionLine(bytes = {}) {
  const items = Object.entries(bytes || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([k, v]) => `${k}:${fmtBytes(v)}`);
  return items.length ? items.join(' ') : '—';
}

function topPacketLine(counts = {}) {
  const items = Object.entries(counts || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([k, v]) => `${k}:${Number(v).toFixed(Number(v) < 10 ? 1 : 0)}`);
  return items.length ? items.join(' ') : '—';
}

export class NetDebugOverlay {
  constructor(netStats) {
    this.netStats = netStats;
    this.el = document.createElement('div');
    this.el.className = 'net-debug-overlay';
    this.lastRenderAt = 0;
    this.visible = true;
    document.body.appendChild(this.el);
    const handleDownloadClick = (ev) => {
      const btn = ev.target?.closest?.('[data-action="net-debug-download-log"]');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.netStats?.downloadDebugLog?.();
    };
    this.el.addEventListener('click', handleDownloadClick, true);
    this.el.addEventListener('pointerdown', handleDownloadClick, true);
    this.el.addEventListener('mousedown', handleDownloadClick, true);
    window.addEventListener('keydown', (ev) => {
      if (!this.visible) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.code === 'KeyL') {
        ev.preventDefault();
        this.netStats?.downloadDebugLog?.();
      }
    });
    this.netStats?.setVisible?.(true);
    this.render(true);
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
    if (!force && now - this.lastRenderAt < 500) return;
    this.lastRenderAt = now;
    const s = this.netStats.snapshot();
    this.el.innerHTML = `
      <div class="net-debug-overlay__head">
        <div class="net-debug-overlay__title">DEBUG NET/PERF</div>
        <button class="net-debug-overlay__btn" type="button" data-action="net-debug-download-log">Download log</button>
      </div>
      <div class="net-debug-overlay__grid">
        <span>Protocol</span><b>${s.netV2Reset ? 'NET V2 RESET' : (s.protocol || 'legacy')}</b>
        <span>Log 10s</span><b>${s.debugHistoryCount || 0} entrées</b>
        <span>Sector boot</span><b>${s.lastSectorBootstrap ? 'received' : '—'} · ${sectorBootstrapLine(s.sectorBootstrapCounts)}</b>
        <span>Projectile lab</span><b>${s.projectileLabMinimal ? 'MINIMAL SNAPSHOT' : 'normal'}</b>
        <span>FPS</span><b>${fmtRate(s.fps)} · ${fmtMs(s.frameMsAvg)}</b>
        <span>Frame max</span><b>${fmtMs(s.frameMsMax)}</b>
        <span>Packets in</span><b>${fmtRate(s.packetsInPerSec)}/s · ${s.totalPacketsIn || 0}</b>
        <span>Packets out</span><b>${fmtRate(s.packetsOutPerSec)}/s · ${s.totalPacketsOut || 0}</b>
        <span>Packets types in</span><b>${topPacketLine(s.packetTypeInPerSec)}</b>
        <span>Packets types out</span><b>${topPacketLine(s.packetTypeOutPerSec)}</b>
        <span>Total in/out</span><b>${fmtBytes(s.totalBytesIn)} / ${fmtBytes(s.totalBytesOut)}</b>
        <span>Last packet</span><b>${s.lastPacketType || '—'} · ${fmtBytes(s.lastPacketInBytes)}</b>
        <span>RTT</span><b>${fmtMs(s.rttMs)}</b>
        <span>Jitter</span><b>${fmtMs(s.jitterMs)}</b>
        <span>Snap gap</span><b>${fmtMs(s.snapshotGapMs)}</b>
        <span>Interp delay</span><b>${fmtMs(s.clock?.interpolationDelayMs)}</b>
        <span>Clock offset</span><b>${fmtMs(Math.abs(s.clock?.offsetMs || 0))}</b>
        <span>Snap age</span><b>${fmtMs(s.clock?.ageOfLastSnapshotMs)}</b>
        <span>Snap/s</span><b>${fmtRate(s.snapshotsPerSec)}</b>
        <span>StateV2/s</span><b>${fmtRate(s.stateV2PerSec)}</b>
        <span>Input/s</span><b>${fmtRate(s.inputsPerSec)}</b>
        <span>Pending input</span><b>${s.inputHistory?.pending ?? (s.pendingInputs | 0)}</b>
        <span>Input age</span><b>${fmtMs(s.inputHistory?.oldestPendingAgeMs)}</b>
        <span>Ack age</span><b>${fmtMs(s.inputHistory?.lastAckAgeMs)}</b>
        <span>In</span><b>${fmtBytes(s.bytesInPerSec)}/s</b>
        <span>Out</span><b>${fmtBytes(s.bytesOutPerSec)}/s</b>
        <span>Snap size</span><b>${fmtBytes(s.avgSnapshotBytes)} avg</b>
        <span>Snap max</span><b>${fmtBytes(s.maxSnapshotBytes)}</b>
        <span>Snap top</span><b>${topSectionLine(s.snapshotSectionBytes)}</b>
        <span>Correction</span><b>${Math.round(s.correctionDistanceAvg || 0)} / ${Math.round(s.correctionDistanceMax || 0)}</b>
        <span>Soft rec</span><b>${Math.round(s.softReconciliationAvg || 0)} / ${Math.round(s.softReconciliationApplied || 0)}</b>
        <span>Hard rec</span><b>${s.hardReconciliationCount | 0}</b>
        <span>Entities</span><b>${countLine(s.entityCounts)}</b>
        <span>Interp buf</span><b>E:${s.interpolation?.entities || 0} S:${s.interpolation?.samples || 0}</b>
        <span>Events/s</span><b>${fmtRate(s.eventsPerSec)}</b>
        <span>Server events</span><b>${fmtRate(s.serverEventsPerSec)} · L:${fmtRate(s.logisticEventsPerSec)} P:${fmtRate(s.projectileEventsPerSec)}</b>
        <span>Event age</span><b>${fmtMs(s.serverEventAgeAvgMs)} / ${fmtMs(s.serverEventAgeMaxMs)}</b>
        <span>Proj ev age</span><b>${fmtMs(s.projectileEventAgeAvgMs)} / ${fmtMs(s.projectileEventAgeMaxMs)}</b>
        <span>Log ev age</span><b>${fmtMs(s.logisticEventAgeAvgMs)} / ${fmtMs(s.logisticEventAgeMaxMs)}</b>
        <span>Last snap ev</span><b>${eventCountLine(s.lastSnapshotEventCounts)}</b>
        <span>Client entities</span><b>${clientCountLine(s.clientEntityCounts)}</b>
        <span>Local event buf</span><b>${localEventLine(s.clientEventCounts)}</b>
        <span>Event dedup</span><b>${s.eventDeduper?.accepted || 0}/${s.eventDeduper?.duplicates || 0}</b>
        <span>Event HUD</span><b>A:${s.eventDrivenHud?.abilityUpdates || 0} D:${s.eventDrivenHud?.damageUpdates || 0} S:${s.eventDrivenHud?.statusUpdates || 0} P:${s.eventDrivenHud?.passiveUpdates || 0}</b>
        <span>Last reject</span><b>${s.eventDrivenHud?.lastAbilityReject ? `${s.eventDrivenHud.lastAbilityReject.slot}:${s.eventDrivenHud.lastAbilityReject.reason}` : '—'}</b>
        <span>SFX/s</span><b>${fmtRate(s.sfxPerSec)}</b>
        <span>WS buffer</span><b>${fmtBytes(s.wsBufferedAmount)}</b>
        <span>Drops</span><b>${s.droppedByBackpressure | 0}</b>
        <span>Input max</span><b>${s.inputHistory?.maxPendingObserved ?? 0} / ${fmtMs(s.inputHistory?.maxPendingAgeObservedMs)}</b>
        <span>Tick</span><b>${s.serverTick | 0}</b>
      </div>
      <div class="net-debug-overlay__hint">F9 : masquer/afficher · Ctrl+Shift+L : download log</div>
    `;
  }
}
