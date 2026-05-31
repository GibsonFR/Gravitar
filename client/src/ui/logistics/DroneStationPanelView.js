function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function missionRows(missions = []) {
  if (!missions.length) return '<div class="logistics-empty">Aucune livraison récente. Configure un coffre demandeur et remplis un coffre de chargement.</div>';
  return missions.map((m) => `<div class="logistics-mission-row ${m.interSector ? 'is-intersector' : ''}">
    <span class="logistics-mission-row__icon">${m.interSector ? '⇆' : '⇄'}</span>
    <div><b>${escapeHtml(m.resourceName || m.resourceKey || 'Ressource')} ×${m.amount | 0}</b><span>${escapeHtml(m.fromLabel || 'source')} → ${escapeHtml(m.toLabel || 'destination')}</span></div>
  </div>`).join('');
}

export class DroneStationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'logistics-panel logistics-panel--drone is-hidden';
    this.el.addEventListener('pointerdown', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const close = target.closest('[data-drone-station-close]');
      const transfer = target.closest('[data-drone-station-transfer]');
      if (close || transfer) {
        ev.preventDefault();
        ev.stopPropagation();
        if (close) this.closeLocal();
        else if (!transfer.disabled) this.transfer(transfer);
      } else {
        ev.stopPropagation();
      }
    }, { capture: true });
    this.el.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true });
    this.el.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true });
  }

  closeLocal() {
    this.currentId = 0;
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.lastKey = '';
    this.sendCmd('drone_station_close', {});
  }

  transfer(btn) {
    const direction = btn.dataset.droneStationTransfer || 'deposit';
    const amount = btn.dataset.amount === 'all' ? 9999 : Math.max(1, btn.dataset.amount | 0 || 1);
    if (!this.currentId) return;
    this.sendCmd('drone_station_transfer', { structureId: this.currentId, direction, amount });
  }

  update(store) {
    const station = store?.myState?.droneStation || null;
    if (!station) {
      this.currentId = 0;
      this.el.classList.add('is-hidden');
      this.el.innerHTML = '';
      this.lastKey = '';
      return;
    }
    this.currentId = station.id | 0;
    this.el.classList.remove('is-hidden');
    const key = JSON.stringify(station);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const fill = Math.max(0, Math.min(100, Math.round((station.installedDrones / Math.max(1, station.droneCapacity)) * 100)));
    const connected = station.connectedStations || [];
    const local = station.localChests || {};
    this.el.innerHTML = `
      <header class="logistics-panel__head">
        <div>
          <div class="logistics-panel__eyebrow">Logistique automatisée</div>
          <h2>${escapeHtml(station.name)}</h2>
          <div class="logistics-panel__meta ${station.powered ? 'is-ok' : 'is-warn'}">${station.powered ? 'Alimentée' : 'Non alimentée'} · ${station.energyUse | 0} énergie · capacité ${station.droneCargo | 0}/drone</div>
        </div>
        <button type="button" class="logistics-panel__close" data-drone-station-close="1">×</button>
      </header>
      <div class="logistics-panel__body">
        <section class="logistics-card logistics-card--hero">
          <div class="logistics-card__title">Drones installés</div>
          <div class="logistics-drone-meter">
            <strong>${station.installedDrones | 0}</strong><span>/ ${station.droneCapacity | 0}</span>
          </div>
          <div class="logistics-bar"><span style="width:${fill}%"></span></div>
          <div class="logistics-card__sub">${station.cargoDrones | 0} drone(s) dans le cargo · cadence ${station.nextMissionSeconds > 0 ? `${station.nextMissionSeconds}s` : 'prête'}</div>
          <div class="logistics-actions">
            <button type="button" data-drone-station-transfer="deposit" data-amount="1" ${station.cargoDrones <= 0 || station.freeSlots <= 0 ? 'disabled' : ''}>Insérer 1</button>
            <button type="button" data-drone-station-transfer="deposit" data-amount="all" ${station.cargoDrones <= 0 || station.freeSlots <= 0 ? 'disabled' : ''}>Tout insérer</button>
            <button type="button" data-drone-station-transfer="withdraw" data-amount="1" ${station.installedDrones <= 0 ? 'disabled' : ''}>Retirer 1</button>
          </div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Coffres du réseau</div>
          <div class="logistics-kpis">
            <div><b>${local.provider | 0}</b><span>chargement</span></div>
            <div><b>${local.requester | 0}</b><span>demandeurs</span></div>
            <div><b>${local.buffer | 0}</b><span>tampons</span></div>
            <div><b>${local.sectors | 0}</b><span>secteurs</span></div>
          </div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Missions réseau</div>
          <div class="logistics-missions">${missionRows(station.missions || [])}</div>
        </section>
        <section class="logistics-card logistics-card--muted">
          <div class="logistics-card__title">Stations connectées</div>
          <div class="logistics-station-grid">
            ${connected.map((s) => `<div class="logistics-sector ${s.current ? 'is-current' : ''}"><b>[${s.sx}, ${s.sy}]</b><span>${s.current ? 'Cette station' : 'Station reliée'} · ${s.drones | 0} drones</span></div>`).join('') || '<div class="logistics-empty">Aucune autre station de drones dans les 8 secteurs adjacents.</div>'}
          </div>
        </section>
      </div>
    `;
  }
}
