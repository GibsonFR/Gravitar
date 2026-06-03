import { ScrollPreserver } from '../common/ScrollPreserver.js';
import { escapeHtml } from '../common/EscapeHtml.js';

function pct(value, max) {
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / Math.max(1, Number(max) || 1) * 100)));
}


function routeRows(routes = []) {
  if (!routes.length) return '<div class="logistics-empty">Aucun drone en vol actuellement.</div>';
  return routes.map((r) => {
    const hpPct = pct(r.hp || 0, r.maxHp || 1);
    return `<div class="logistics-route-row ${r.interSector ? 'is-intersector' : ''}">
      <div class="logistics-route-row__top"><b>${escapeHtml(r.phase || 'en vol')} · ${escapeHtml(r.resourceName || 'Ressource')} ×${r.amount | 0}</b><span>${r.progressPct | 0}% · ${Number(r.remainingSeconds || 0).toFixed(1)}s</span></div>
      <div class="logistics-route-row__path">${escapeHtml(r.stationLabel || 'station')} → ${escapeHtml(r.fromLabel || 'source')} → ${escapeHtml(r.toLabel || 'destination')} → retour</div>
      <div class="logistics-route-row__bars"><span style="width:${r.progressPct | 0}%"></span></div>
      <div class="logistics-route-row__hp"><span style="width:${hpPct}%"></span></div>
    </div>`;
  }).join('');
}

function diagnosticRows(diag = null) {
  const notes = diag?.diagnostics || [];
  const lines = diag?.lines || [];
  const noteHtml = notes.length
    ? notes.map((n) => `<div class="logistics-diagnostic-note is-${escapeHtml(n.level || 'info')}">${escapeHtml(n.text || '')}</div>`).join('')
    : '<div class="logistics-empty">Aucun diagnostic disponible.</div>';
  const demandHtml = lines.length
    ? lines.map((line) => {
      const label = line.status === 'incoming' ? 'en vol' : line.status === 'ready' ? 'source trouvée' : 'source absente';
      return `<div class="logistics-demand-row is-${escapeHtml(line.status || 'info')}">
        <div><b>${escapeHtml(line.resourceName || line.resourceKey || 'Ressource')}</b><span>${escapeHtml(line.requesterLabel || 'coffre demandeur')}</span></div>
        <div class="logistics-demand-row__nums">manque ${line.missing | 0} · en vol ${line.incoming | 0} · source ${line.sourceUnits | 0}</div>
        <em>${escapeHtml(label)}</em>
      </div>`;
    }).join('')
    : '<div class="logistics-empty">Aucune demande active en manque.</div>';
  return `${noteHtml}<div class="logistics-demand-list">${demandHtml}</div>`;
}

function missionRows(missions = []) {
  if (!missions.length) return '<div class="logistics-empty">Aucune livraison récente. Configure un coffre demandeur et remplis un coffre de chargement.</div>';
  return missions.map((m) => {
    const isFlight = m.kind === 'flight_start';
    const isReturn = m.kind === 'drone_return';
    const destroyed = m.kind === 'drone_destroyed';
    const cancelled = m.kind === 'mission_cancelled';
    const failed = m.kind === 'delivery_failed' || destroyed || cancelled;
    const state = destroyed ? 'Drone détruit' : cancelled ? 'Mission annulée' : isFlight ? 'Départ station' : isReturn ? 'Retour station' : failed ? 'Échec' : 'Livré';
    const extra = [
      m.reason ? String(m.reason).replaceAll('_', ' ') : '',
      (m.returned | 0) > 0 ? `retourné ${m.returned | 0}` : '',
      (m.lost | 0) > 0 ? `perdu ${m.lost | 0}` : '',
      m.attackerName ? `${escapeHtml(m.attackerName)}` : ''
    ].filter(Boolean).join(' · ');
    return `<div class="logistics-mission-row ${m.interSector ? 'is-intersector' : ''} ${isFlight ? 'is-flight' : ''} ${failed ? 'is-failed' : ''}">
      <span class="logistics-mission-row__icon">${destroyed ? '✖' : cancelled ? '!' : isReturn ? '↩' : isFlight ? '✈' : m.interSector ? '⇆' : '⇄'}</span>
      <div><b>${state} · ${escapeHtml(m.resourceName || m.resourceKey || 'Ressource')} ×${m.amount | 0}</b><span>${escapeHtml(m.fromLabel || 'source')} → ${escapeHtml(m.toLabel || 'destination')}${extra ? ` · ${escapeHtml(extra)}` : ''}</span></div>
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
    this.scrollPreserver = new ScrollPreserver(this.el);
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


  captureScroll() {
    return this.scrollPreserver.capture();
  }

  restoreScroll(map) {
    this.scrollPreserver.restore(map);
  }

  renderKey(station) {
    return JSON.stringify({
      id: station?.id | 0,
      powered: !!station?.powered,
      energyUse: station?.energyUse | 0,
      installedDrones: station?.installedDrones | 0,
      droneCapacity: station?.droneCapacity | 0,
      cargoDrones: station?.cargoDrones | 0,
      freeSlots: station?.freeSlots | 0,
      droneCharge: station?.droneCharge | 0,
      droneChargeMax: station?.droneChargeMax | 0,
      availableDrones: station?.availableDrones | 0,
      chargingDrones: station?.chargingDrones | 0,
      activeFlights: station?.activeFlights | 0,
      maxActiveFlights: station?.maxActiveFlights | 0,
      localChests: station?.localChests || {},
      connectedStations: station?.connectedStations || [],
      missions: station?.missions || [],
      diagnostics: station?.diagnostics || null,
      activeRoutesShape: (station?.activeRoutes || []).map((r) => ({
        id: r.id || '',
        phase: r.phase || '',
        resourceKey: r.resourceKey || '',
        amount: r.amount | 0,
        fromLabel: r.fromLabel || '',
        toLabel: r.toLabel || '',
        stationLabel: r.stationLabel || '',
        interSector: !!r.interSector,
        hp: Math.round(Number(r.hp || 0)),
        maxHp: Math.round(Number(r.maxHp || 0))
      }))
    });
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
    const key = this.renderKey(station);
    if (key === this.lastKey) {
      this.updateDynamic(station);
      return;
    }
    const scrollState = this.captureScroll();
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
          <div class="logistics-panel__meta ${station.powered ? 'is-ok' : 'is-warn'}">${escapeHtml(station.logisticsTierName || 'Logistique basique')} · ${station.powered ? 'Alimentée' : 'Non alimentée'} · ${station.energyUse | 0} énergie · ${station.droneCargo | 0}/drone · portée ${station.rangeSectors | 0} secteur(s)</div>
        </div>
        <button type="button" class="logistics-panel__close" data-drone-station-close="1">×</button>
      </header>
      <div class="logistics-panel__body" data-scroll-key="body">
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
          <div class="logistics-card__sub">${station.cargoDrones | 0} drone(s) dans le cargo · ${station.deliveriesPerCharge | 0} livraisons avant recharge · recharge ${station.rechargeSeconds | 0}s · ${station.activeFlights | 0} mission(s) visible(s) · cadence ${station.nextMissionSeconds > 0 ? `${station.nextMissionSeconds}s` : 'prête'}</div>
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
        <section class="logistics-card logistics-card--wide">
          <div class="logistics-card__title">Diagnostic réseau</div>
          <div class="logistics-diagnostics">${diagnosticRows(station.diagnostics || null)}</div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Drones en vol</div>
          <div class="logistics-routes" data-scroll-key="routes">${routeRows(station.activeRoutes || [])}</div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Historique réseau</div>
          <div class="logistics-missions" data-scroll-key="missions">${missionRows(station.missions || [])}</div>
        </section>
        <section class="logistics-card logistics-card--muted">
          <div class="logistics-card__title">Stations connectées</div>
          <div class="logistics-station-grid">
            ${connected.map((s) => `<div class="logistics-sector ${s.current ? 'is-current' : ''}"><b>[${s.sx}, ${s.sy}]</b><span>${s.current ? 'Cette station' : 'Station reliée'} · ${s.drones | 0} drones</span></div>`).join('') || '<div class="logistics-empty">Aucune autre station de drones dans les 8 secteurs adjacents.</div>'}
          </div>
        </section>
      </div>
    `;
    this.restoreScroll(scrollState);
    this.updateDynamic(station);
  }

  updateDynamic(station) {
    const routes = this.el.querySelector('.logistics-routes');
    if (routes) routes.innerHTML = routeRows(station.activeRoutes || []);
    const status = this.el.querySelector('.logistics-drone-status');
    if (status) {
      const chargeLabel = station.droneChargeMax > 0 ? `${station.droneCharge | 0}/${station.droneChargeMax | 0} livraisons` : 'aucun drone';
      const available = station.availableDrones | 0;
      const charging = station.chargingDrones | 0;
      status.textContent = `${chargeLabel} · ${available} dispo · ${station.activeFlights | 0}/${station.maxActiveFlights | 0} en vol · ${charging} recharge`;
      status.classList.toggle('is-ok', available > 0);
      status.classList.toggle('is-empty', available <= 0);
    }
    const rechargeBar = this.el.querySelector('.logistics-bar--recharge span');
    if (rechargeBar) {
      const rechargeFill = Math.max(0, Math.min(100, station.rechargeProgressPct | 0));
      rechargeBar.style.width = `${station.droneCharge >= station.droneChargeMax ? 100 : rechargeFill}%`;
    }
  }
}
