function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
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

function packCost(cost = {}) {
  return Object.entries(cost || {})
    .filter(([, amount]) => (amount | 0) > 0)
    .map(([key, amount]) => {
      const short = key
        .replace('SciencePack', '')
        .replace('basic', 'Base')
        .replace('automation', 'Auto')
        .replace('industrial', 'Indus')
        .replace('energy', 'Énergie')
        .replace('biology', 'Bio')
        .replace('combat', 'Défense')
        .replace('advanced', 'Avancée')
        .replace('anomaly', 'Anomalie');
      return `${amount | 0}× ${short}`;
    })
    .join(' · ');
}

function describeStatus(status) {
  switch (String(status || '')) {
    case 'no_power': return 'Sans énergie';
    case 'off': return 'Station désactivée';
    case 'science': return 'Packs insuffisants';
    case 'complete': return 'Recherche terminée';
    case 'cancelled': return 'Recherche annulée';
    default: return 'Opérationnel';
  }
}

function renderUnlockList(items = [], emptyText = 'Aucun') {
  if (!items.length) return `<div class="research-station__empty">${escapeHtml(emptyText)}</div>`;
  return `<ul class="research-station__unlock-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
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
      const start = ev.target.closest('[data-start-station-research]');
      if (start) {
        this.sendCmd('research_station_start', {
          structureId: start.dataset.structure | 0,
          projectId: start.dataset.startStationResearch || ''
        });
        ev.preventDefault();
        return;
      }
      const cancel = ev.target.closest('[data-cancel-station-research]');
      if (cancel) {
        this.sendCmd('research_cancel', {});
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
      input: data.scienceInput,
      powered: data.powered,
      enabled: data.enabled,
      status: data.status,
      activeProjectId: data.activeProjectId,
      progress: data.progress,
      points: [data.pointsDone, data.pointsTotal],
      projects: (data.projects || []).map((p) => [p.id, p.completed, p.canStart, p.available])
    });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const activeCard = data.activeProjectId
      ? `
        <section class="research-station__branch">
          <h3>Recherche active</h3>
          <div class="research-station__active-name">${escapeHtml(data.activeProjectName || '')}</div>
          <div class="research-station__bar"><span style="width:${Math.round(Math.max(0, Math.min(1, Number(data.progress) || 0)) * 100)}%"></span></div>
          <div class="research-station__active-meta">${data.pointsDone | 0}/${data.pointsTotal | 0} pts · ${data.pointSeconds | 0}s / pt · ${escapeHtml(describeStatus(data.status))}</div>
          <button type="button" data-cancel-station-research="1">Annuler la recherche</button>
        </section>
      `
      : `
        <section class="research-station__branch">
          <h3>Recherche active</h3>
          <div class="research-station__empty">Aucune recherche active.</div>
        </section>
      `;

    const cards = (data.projects || []).map((project) => `
      <article class="research-station__card ${project.completed ? 'is-done' : project.locked ? 'is-locked' : ''}" style="--branch:${escapeHtml((data.branches || []).find((b) => b.id === project.branch)?.colorHex || '#b58cff')}">
        <div class="research-station__card-title">${escapeHtml(project.name)}</div>
        <div class="research-station__card-meta">${escapeHtml(project.branchName || '')} · ${project.points | 0} pts · ${data.pointSeconds | 0}s / pt</div>
        <div class="research-station__card-cost">Coût / point : ${escapeHtml(packCost(project.pointCost || {}) || 'Aucun')}</div>
        <div class="research-station__detail-grid">
          <div>
            <div class="research-station__card-subtitle">Bâtiments</div>
            ${renderUnlockList(project.unlockBuildings || [], 'Aucun bâtiment')}
          </div>
          <div>
            <div class="research-station__card-subtitle">Recettes</div>
            ${renderUnlockList(project.unlockRecipes || [], 'Aucune recette')}
          </div>
        </div>
        ${project.completed
          ? '<button type="button" disabled>Déjà recherché</button>'
          : project.canStart
            ? `<button type="button" data-start-station-research="${escapeHtml(project.id)}" data-structure="${data.id | 0}">Rechercher</button>`
            : '<button type="button" disabled>Packs ou prérequis manquants</button>'}
      </article>
    `).join('');

    this.el.innerHTML = `
      <div class="research-station__head">
        <div>
          <div class="research-station__eyebrow">Station de recherche</div>
          <div class="research-station__title">${escapeHtml(data.name || 'Station de recherche')}</div>
          <div class="research-station__meta">${data.powered ? 'Alimentée' : 'Sans énergie'} · ${data.inputUsed | 0}/${data.inputCapacity | 0} packs · ${escapeHtml(describeStatus(data.status))}</div>
        </div>
        <button type="button" class="research-station__close" data-close-research-station="1">×</button>
      </div>
      <div class="research-station__status">
        <section>
          <h3>Commande</h3>
          <strong>${data.enabled ? 'Station active' : 'Station désactivée'}</strong>
          <div class="research-station__meta">1 point de recherche = coût / point consommé dans cette station.</div>
          <button type="button" data-research-toggle="1" data-structure="${data.id | 0}" data-enabled="${data.enabled ? 'true' : 'false'}">${data.enabled ? 'Désactiver' : 'Activer'}</button>
        </section>
        ${activeCard}
        <section>
          <h3>Déposer un pack</h3>
          <div class="research-station__pack-buttons">
            ${(data.packs || []).map((p) => `<button type="button" data-research-transfer="1" data-direction="deposit" data-resource="${escapeHtml(p.id)}" data-structure="${data.id | 0}">${escapeHtml(p.name)}</button>`).join('')}
          </div>
        </section>
      </div>
      <div class="research-station__tree">
        <section class="research-station__branch">
          <h3>Packs chargés</h3>
          ${packRows(data.scienceInput || [], data.id)}
        </section>
        <section class="research-station__branch">
          <h3>Projets</h3>
          <div class="research-station__cards">${cards}</div>
        </section>
      </div>
    `;
  }
}
