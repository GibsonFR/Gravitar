function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const RESOURCE_NAMES = {
  basicSciencePack: 'Science de base',
  automationSciencePack: 'Science automatisation',
  industrialSciencePack: 'Science industrielle',
  energySciencePack: 'Science énergétique',
  biologySciencePack: 'Science biologique',
  combatSciencePack: 'Science défense',
  advancedSciencePack: 'Science avancée',
  anomalySciencePack: 'Science anomalie'
};

function pct(v) {
  return `${Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 100)}%`;
}

function costHtml(cost = {}) {
  const entries = Object.entries(cost || {});
  if (!entries.length) return '—';
  return entries.map(([key, amount]) => `${escapeHtml(RESOURCE_NAMES[key] || key)} ×${amount | 0}`).join(' · ');
}

function packRows(entries = [], stationId) {
  if (!entries.length) return `<div class="research-station__empty">Aucun pack chargé.</div>`;
  return entries.map((r) => `
    <div class="research-station__row">
      <span class="research-station__pack" style="--pack:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)} ×${r.amount | 0}</span>
      <button type="button" data-research-transfer="1" data-direction="withdraw" data-resource="${escapeHtml(r.key)}" data-structure="${stationId | 0}">Retirer</button>
    </div>
  `).join('');
}

export class ResearchStationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-station';
    this.el.hidden = true;
    this.lastKey = '';
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
          amount: ev.shiftKey ? 25 : 1
        });
        ev.preventDefault();
        return;
      }

      const start = ev.target.closest('[data-research-start]');
      if (start) {
        this.sendCmd('research_station_start', { structureId: start.dataset.structure | 0, projectId: start.dataset.project || '' });
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
      progress: Math.round((data.progress || 0) * 100),
      input: data.scienceInput,
      active: data.activeProjectId,
      completed: data.completed,
      powered: data.powered,
      status: data.status,
      enabled: data.enabled
    });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const completed = new Set(data.completed || []);
    const activeName = data.activeProjectName || 'Aucune recherche active';
    const branches = data.branches || [];
    const projects = data.projects || [];
    const inputByKey = new Map((data.scienceInput || []).map((r) => [r.key, r.amount | 0]));
    const busy = !!data.activeProjectId;

    this.el.innerHTML = `
      <div class="research-station__head">
        <div>
          <div class="research-station__eyebrow">Station de recherche</div>
          <div class="research-station__title">${escapeHtml(data.name || 'Station de recherche')}</div>
          <div class="research-station__meta">${completed.size} technologies débloquées · ${data.inputUsed | 0}/${data.inputCapacity | 0} packs chargés</div>
        </div>
        <button type="button" class="research-station__close" data-close-research-station="1">×</button>
      </div>

      <div class="research-station__status">
        <section>
          <h3>Recherche active</h3>
          <strong>${escapeHtml(activeName)}</strong>
          <div class="research-station__bar"><span style="width:${pct(data.progress)}"></span></div>
          <small>${data.powered === false && busy ? 'Énergie insuffisante' : busy ? `${data.energyUse | 0} énergie active` : 'Choisis une technologie'}</small>
        </section>
        <section>
          <h3>Packs chargés</h3>
          ${packRows(data.scienceInput || [], data.id)}
        </section>
        <section>
          <h3>Déposer un pack</h3>
          <div class="research-station__pack-buttons">
            ${(data.packs || []).map((p) => `<button type="button" data-research-transfer="1" data-direction="deposit" data-resource="${escapeHtml(p.id)}" data-structure="${data.id | 0}">${escapeHtml(p.name)}</button>`).join('')}
          </div>
        </section>
      </div>

      <div class="research-station__note">
        La station sert à stocker les packs et à fournir de la puissance de recherche. Le choix de la technologie se fait dans l’onglet <b>Recherche</b>.
      </div>
    `;
  }
}
