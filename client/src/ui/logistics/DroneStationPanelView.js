function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function pct(value, max) {
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / Math.max(1, Number(max) || 1) * 100)));
}

function missionRows(missions = []) {
  if (!missions.length) return '<div class="logistics-empty">Aucune livraison récente. Configure un coffre demandeur et remplis un coffre de chargement.</div>';
  return missions.map((m) => {
    const isFlight = m.kind === 'flight_start';
    const isReturn = m.kind === 'drone_return';
    const destroyed = m.kind === 'drone_destroyed';
    const failed = m.kind === 'delivery_failed' || destroyed;
    const state = destroyed ? 'Drone détruit' : isFlight ? 'Départ station' : isReturn ? 'Retour station' : failed ? 'Échec' : 'Livré';
    return `<div class="logistics-mission-row ${m.interSector ? 'is-intersector' : ''} ${isFlight ? 'is-flight' : ''} ${failed ? 'is-failed' : ''}">
      <span class="logistics-mission-row__icon">${destroyed ? '✖' : isReturn ? '↩' : isFlight ? '✈' : m.interSector ? '⇆' : '⇄'}</span>
      <div><b>${state} · ${escapeHtml(m.resourceName || m.resourceKey || 'Ressource')} ×${m.amount | 0}</b><span>${escapeHtml(m.fromLabel || 'source')} → ${escapeHtml(m.toLabel || 'destination')}${m.attackerName ? ` · ${escapeHtml(m.attackerName)}` : ''}</span></div>
    </div>`;
  }).join('');
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
    const fill = pct(station.installedDrones, station.droneCapacity);
    const chargeFill = pct(station.droneCharge, station.droneChargeMax);
    const rechargeFill = Math.max(0, Math.min(100, station.rechargeProgressPct | 0));
    const connected = station.connectedStations || [];
    const local = station.localChests || {};
    const chargeLabel = station.droneChargeMax > 0 ? `${station.droneCharge | 0}/${station.droneChargeMax | 0} livraisons` : 'aucun drone';
    const available = station.availableDrones | 0;
    const charging = station.chargingDrones | 0;
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
          <div class="logistics-card__title">Hangar de drones</div>
          <div class="logistics-drone-hero">
            <div class="logistics-drone-meter"><strong>${station.installedDrones | 0}</strong><span>/ ${station.droneCapacity | 0} drones</span></div>
            <div class="logistics-drone-status ${available > 0 ? 'is-ok' : 'is-empty'}">${chargeLabel} · ${available} dispo · ${station.activeFlights | 0}/${station.maxActiveFlights | 0} en vol · ${charging} recharge</div>
          </div>
          <div class="logistics-meter-block">
            <div class="logistics-meter-label"><span>Places station</span><b>${fill}%</b></div>
            <div class="logistics-bar"><span style="width:${fill}%"></span></div>
          </div>
          <div class="logistics-meter-block">
            <div class="logistics-meter-label"><span>Autonomie drones</span><b>${chargeFill}%</b></div>
            <div class="logistics-bar logistics-bar--charge"><span style="width:${chargeFill}%"></span></div>
          </div>
          <div class="logistics-meter-block">
            <div class="logistics-meter-label"><span>Recharge drones vides</span><b>${station.droneCharge >= station.droneChargeMax ? 'plein' : `${rechargeFill}%`}</b></div>
            <div class="logistics-bar logistics-bar--recharge"><span style="width:${station.droneCharge >= station.droneChargeMax ? 100 : rechargeFill}%"></span></div>
          </div>
          <div class="logistics-card__sub">${station.cargoDrones | 0} drone(s) dans le cargo · ${station.deliveriesPerCharge | 0} livraisons par drone avant recharge · ${station.activeFlights | 0} mission(s) visible(s) · cadence ${station.nextMissionSeconds > 0 ? `${station.nextMissionSeconds}s` : 'prête'}</div>
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
          <div class="logistics-hint ${station.powered && station.droneCharge > 0 ? 'is-ok' : 'is-warn'}">
            ${!station.powered ? 'Station non alimentée : les drones ne partent pas et ne rechargent pas.' : station.installedDrones <= 0 ? 'Aucun drone installé : insère des drones logistiques basiques dans la station.' : station.droneCharge <= 0 ? 'Tous les drones disponibles sont vides : ils attendent une recharge complète avant de repartir.' : 'Réseau opérationnel : les demandes sont servies automatiquement si une source existe.'}
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
