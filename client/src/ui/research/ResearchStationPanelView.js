import { ScrollPreserver } from '../common/ScrollPreserver.js';
import { escapeHtml } from '../common/EscapeHtml.js';
import { renderMachineHeader, renderMachineMetricStrip, renderMachineProgress, machineStateClass } from '../common/MachineUiComponents.js';

function describeStatus(status, powered, enabled) {
  if (!enabled) return 'Station désactivée';
  if (!powered) return 'Sans énergie';
  switch (String(status || '')) {
    case 'science': return 'Packs insuffisants';
    case 'complete': return 'Recherche terminée';
    case 'cancelled': return 'Recherche annulée';
    default: return 'Prête';
  }
}

function progressPercent(v) {
  return Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 100);
}

function rows(entries = [], stationId, direction) {
  if (!entries.length) {
    return `<div class="research-station-lite__empty">Vide.</div>`;
  }
  const action = direction === 'deposit' ? 'Déposer' : 'Retirer';
  return entries.map((r) => `
    <div class="research-station-lite__row">
      <span class="research-station-lite__item" style="--pack:${escapeHtml(r.colorHex || '#fff')}">
        <i></i><b>${escapeHtml(r.name)}</b><small>×${r.amount | 0}</small>
      </span>
      <span class="research-station-lite__actions">
        <button type="button" data-research-transfer="1" data-direction="${direction}" data-resource="${escapeHtml(r.key)}" data-structure="${stationId | 0}" data-amount="1">${action} 1</button>
        <button type="button" data-research-transfer="1" data-direction="${direction}" data-resource="${escapeHtml(r.key)}" data-structure="${stationId | 0}" data-amount="${r.amount | 0}">Tout</button>
      </span>
    </div>
  `).join('');
}

export class ResearchStationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-station-lite';
    this.el.hidden = true;
    this.lastKey = '';
    this.scrollPreserver = new ScrollPreserver(this.el);
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-close-research-station]');
      if (close) {
        this.sendCmd('research_station_close', {});
        this.el.hidden = true;
        ev.preventDefault();
        return;
      }
      const toggle = ev.target.closest('[data-research-toggle]');
      if (toggle) {
        this.sendCmd('research_station_toggle', { structureId: toggle.dataset.structure | 0, enabled: toggle.dataset.enabled !== 'true' });
        ev.preventDefault();
        return;
      }
      const transfer = ev.target.closest('[data-research-transfer]');
      if (transfer) {
        this.sendCmd('research_station_transfer', {
          structureId: transfer.dataset.structure | 0,
          resourceKey: transfer.dataset.resource || '',
          direction: transfer.dataset.direction || 'deposit',
          amount: Math.max(1, transfer.dataset.amount | 0 || 1)
        });
        ev.preventDefault();
      }
    });
  }

  update(store) {
    const data = store.myState?.researchStation || null;
    if (!data) {
      this.el.hidden = true;
      this.lastKey = '';
      return;
    }

    const key = JSON.stringify({
      id: data.id,
      powered: data.powered,
      enabled: data.enabled,
      status: data.status,
      activeProjectId: data.activeProjectId,
      progress: Math.round((data.progress || 0) * 1000),
      points: [data.pointsDone, data.pointsTotal],
      scienceInput: data.scienceInput,
      cargoScience: data.cargoScience
    });
    if (key === this.lastKey) return;
    const scroll = this.scrollPreserver?.capture() || new Map();
    this.lastKey = key;
    this.el.hidden = false;

    const status = describeStatus(data.status, data.powered, data.enabled);
    const hasActive = !!data.activeProjectId;
    const progress = progressPercent(data.progress);

    const uiState = machineStateClass({ powered: !!data.powered, enabled: data.enabled !== false, busy: hasActive });
    const headerHtml = renderMachineHeader({
      eyebrow: 'Station de recherche',
      title: data.name || 'Station de recherche',
      meta: `${status} · ${data.inputUsed | 0}/${data.inputCapacity | 0} packs · ${data.pointSeconds | 0}s / point`,
      state: uiState,
      closeAttr: 'data-close-research-station="1"',
      badges: [
        { label: data.powered ? 'Alimentée' : 'Sans énergie', className: data.powered ? 'is-ok' : 'is-warning' },
        { label: data.enabled ? 'Active' : 'Désactivée', className: data.enabled ? 'is-ok' : 'is-warning' }
      ]
    });
    const metricsHtml = renderMachineMetricStrip([
      { label: 'Packs', value: `${data.inputUsed | 0}/${data.inputCapacity | 0}` },
      { label: 'Recherche', value: hasActive ? `${data.pointsDone | 0}/${data.pointsTotal | 0} points` : 'Aucune' },
      { label: 'Cycle', value: `${data.pointSeconds | 0}s / point` }
    ]);
    const progressHtml = renderMachineProgress({
      label: hasActive ? (data.activeProjectName || 'Recherche active') : 'Recherche active',
      value: progress,
      right: hasActive ? `${progress}%` : '—',
      state: uiState
    });

    this.el.innerHTML = `
      ${headerHtml}
      ${metricsHtml}

      <section class="research-station-lite__active machine-ui__status-card ${uiState}">
        <div>
          <h3>Recherche active</h3>
          <strong>${hasActive ? escapeHtml(data.activeProjectName || '') : 'Aucune recherche active'}</strong>
          <p>${hasActive ? `${data.pointsDone | 0}/${data.pointsTotal | 0} points · ${progress}% · lancée depuis l’onglet Recherche` : 'Choisis une technologie dans l’onglet Recherche. Cette station consommera les packs chargés ici.'}</p>
        </div>
        <div class="research-station-lite__right">
          ${progressHtml}
          <button type="button" data-research-toggle="1" data-structure="${data.id | 0}" data-enabled="${data.enabled ? 'true' : 'false'}">${data.enabled ? 'Désactiver' : 'Activer'}</button>
        </div>
      </section>

      <main class="research-station-lite__grid">
        <section class="research-station-lite__box" data-scroll-key="research-station-input">
          <h3>Packs dans la station</h3>
          ${rows(data.scienceInput || [], data.id, 'withdraw')}
        </section>
        <section class="research-station-lite__box" data-scroll-key="research-station-cargo">
          <h3>Packs dans le cargo</h3>
          ${rows(data.cargoScience || [], data.id, 'deposit')}
        </section>
      </main>
    `;
    this.scrollPreserver?.restore(scroll);
  }
}
