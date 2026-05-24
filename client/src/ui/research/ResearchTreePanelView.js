function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const SCIENCE_NAMES = {
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
  return entries.map(([key, amount]) => `${escapeHtml(SCIENCE_NAMES[key] || key)} ×${amount | 0}`).join(' · ');
}

function scienceInventoryHtml(list = []) {
  if (!list.length) return '<div class="research-tree__empty">Aucun pack chargé dans les stations.</div>';
  return list.map((r) => `
    <div class="research-tree__science">
      <i style="--pack:${escapeHtml(r.colorHex || '#7edcff')}"></i>
      <span>${escapeHtml(r.name || SCIENCE_NAMES[r.key] || r.key)}</span>
      <b>${r.amount | 0}</b>
    </div>
  `).join('');
}

export class ResearchTreePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-tree';
    this.lastKey = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('click', (ev) => {
      const start = ev.target.closest('[data-research-tree-start]');
      if (start) {
        this.sendCmd('research_tree_start', { projectId: start.dataset.project || '' });
        ev.preventDefault();
        return;
      }
      const cancel = ev.target.closest('[data-research-tree-cancel]');
      if (cancel) {
        this.sendCmd('research_tree_cancel', {});
        ev.preventDefault();
      }
    });
  }

  update(store) {
    const tree = store.myState?.researchTree || null;
    const key = JSON.stringify({
      active: tree?.activeProjectId || '',
      progress: Math.round((tree?.activeProgress || 0) * 100),
      status: tree?.activeStatus || '',
      completed: tree?.completed || [],
      science: tree?.scienceAvailable || [],
      stations: [tree?.stationCount || 0, tree?.poweredStationCount || 0]
    });
    if (key === this.lastKey) return;
    this.lastKey = key;

    if (!tree) {
      this.el.innerHTML = '<div class="research-tree__empty big">Recherche indisponible.</div>';
      return;
    }

    const active = tree.activeProjectName || 'Aucune recherche active';
    const completed = new Set(tree.completed || []);
    const branches = tree.branches || [];
    const projects = tree.projects || [];
    const busy = !!tree.activeProjectId;

    this.el.innerHTML = `
      <div class="research-tree__head">
        <div>
          <div class="research-tree__eyebrow">Recherche globale</div>
          <div class="research-tree__title">Arbre technologique</div>
          <div class="research-tree__meta">${completed.size} technologies terminées · ${tree.poweredStationCount | 0}/${tree.stationCount | 0} stations actives</div>
        </div>
      </div>

      <div class="research-tree__top">
        <section class="research-tree__active">
          <h3>Recherche en cours</h3>
          <strong>${escapeHtml(active)}</strong>
          <div class="research-tree__bar"><span style="width:${pct(tree.activeProgress)}"></span></div>
          <small>${tree.activeStatus === 'no_power' ? 'Aucune station alimentée' : tree.activeStatus === 'no_station' ? 'Aucune station de recherche' : busy ? 'Progression accélérée par les stations alimentées' : 'Choisis une technologie dans l’arbre'}</small>
          <button type="button" data-research-tree-cancel="1" ${busy ? '' : 'disabled'}>Annuler</button>
        </section>

        <section class="research-tree__packs">
          <h3>Packs disponibles dans les stations</h3>
          ${scienceInventoryHtml(tree.scienceAvailable || [])}
        </section>
      </div>

      <div class="research-tree__branches">
        ${branches.map((branch) => {
          const branchProjects = projects.filter((p) => p.branch === branch.id);
          if (!branchProjects.length) return '';
          return `<section class="research-tree__branch" style="--branch:${escapeHtml(branch.colorHex || '#7edcff')}">
            <h3>${escapeHtml(branch.name)}</h3>
            <div class="research-tree__cards">
              ${branchProjects.map((p) => {
                const done = completed.has(p.id);
                const locked = p.locked;
                const canStart = !busy && !done && !locked && p.scienceReady;
                return `<article class="research-tree__card ${done ? 'is-done' : locked ? 'is-locked' : !p.scienceReady ? 'is-missing' : ''}">
                  <div class="research-tree__card-title">${escapeHtml(p.name)}</div>
                  <div class="research-tree__card-meta">${p.seconds | 0}s · ${p.energyUse | 0} énergie/station</div>
                  <div class="research-tree__card-cost">${costHtml(p.scienceCost)}</div>
                  <div class="research-tree__card-unlocks">${(p.unlocks || []).map(escapeHtml).join(' · ') || '—'}</div>
                  <button type="button" data-research-tree-start="1" data-project="${escapeHtml(p.id)}" ${canStart ? '' : 'disabled'}>
                    ${done ? 'Terminé' : locked ? 'Verrouillé' : p.scienceReady ? 'Rechercher' : 'Packs manquants'}
                  </button>
                </article>`;
              }).join('')}
            </div>
          </section>`;
        }).join('')}
      </div>
    `;
  }
}

export function getResearchIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 15h8M9 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
}
