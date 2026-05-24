function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function pct(v) {
  return `${Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 100)}%`;
}

function packCost(cost = {}) {
  return Object.entries(cost || {}).filter(([, amount]) => (amount | 0) > 0).map(([key, amount]) => {
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
  }).join(' · ');
}

function prereqLabel(project, lookup) {
  const ids = Array.isArray(project?.prereq) ? project.prereq : [];
  if (!ids.length) return 'Aucun';
  return ids.map((id) => lookup.get(id)?.name || id).join(' · ');
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

function listBlock(items = [], emptyLabel = 'Aucun') {
  if (!items.length) return `<div class="research-tree__empty-block">${escapeHtml(emptyLabel)}</div>`;
  return `<ul class="research-tree__unlock-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function sortedProjects(projects = []) {
  return [...projects].sort((a, b) => {
    const ta = a.tier | 0;
    const tb = b.tier | 0;
    if (ta !== tb) return ta - tb;
    const sa = (a.completed ? 2 : a.canStart ? 0 : a.available ? 1 : 3);
    const sb = (b.completed ? 2 : b.canStart ? 0 : b.available ? 1 : 3);
    if (sa !== sb) return sa - sb;
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
  });
}

function pickDefaultProject(projects = []) {
  const ordered = sortedProjects(projects);
  return ordered.find((p) => p.canStart) || ordered.find((p) => p.available) || ordered[0] || null;
}

export class ResearchTreePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-tree-panel';
    this.el.hidden = true;
    this.selectedId = '';
    this.lastKey = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-close-research]');
      if (close) {
        this.el.hidden = true;
        ev.preventDefault();
        return;
      }
      const start = ev.target.closest('[data-start-research]');
      if (start) {
        this.sendCmd('research_start', { projectId: start.dataset.startResearch || '' });
        ev.preventDefault();
        return;
      }
      const cancel = ev.target.closest('[data-cancel-research]');
      if (cancel) {
        this.sendCmd('research_cancel', {});
        ev.preventDefault();
        return;
      }
      const node = ev.target.closest('[data-select-research]');
      if (node) {
        this.selectedId = node.dataset.selectResearch || '';
        this.lastKey = '';
        this.update(this.store);
        ev.preventDefault();
      }
    });
  }

  setOpen(open) {
    this.el.hidden = !open;
  }

  update(store) {
    this.store = store;
    const data = store.myState?.researchOverview || null;
    if (!data) {
      this.el.hidden = true;
      this.lastKey = '';
      return;
    }
    if (this.el.hidden) return;

    const orderedProjects = sortedProjects(data.projects || []);
    const map = new Map(orderedProjects.map((p) => [p.id, p]));
    let selected = map.get(this.selectedId);
    if (!selected) {
      selected = pickDefaultProject(orderedProjects);
      this.selectedId = selected?.id || '';
    }

    const key = JSON.stringify({
      selected: this.selectedId,
      active: data.active,
      projects: orderedProjects.map((p) => [p.id, p.completed, p.canStart, p.available]),
      science: data.science,
      stations: [data.stationCount, data.poweredStations]
    });
    if (key === this.lastKey) return;
    this.lastKey = key;

    const active = (data.active || [])[0] || null;
    const selectedBranch = data.branches?.find((b) => b.id === selected?.branch) || null;

    const nodes = orderedProjects.map((project) => {
      const branch = data.branches?.find((b) => b.id === project.branch) || null;
      const classes = [
        'research-tree__node',
        project.completed ? 'is-done' : project.canStart ? 'is-ready' : project.available ? 'is-available' : 'is-locked',
        this.selectedId === project.id ? 'is-selected' : ''
      ].filter(Boolean).join(' ');
      return `
        <button type="button" class="${classes}" style="--branch:${escapeHtml(branch?.colorHex || '#b58cff')}" data-select-research="${escapeHtml(project.id)}">
          <span class="research-tree__dot"></span>
          <strong>${escapeHtml(project.name)}</strong>
          <small>${escapeHtml(project.branchName || '')}</small>
          <small>${project.points | 0} pts · ${escapeHtml(packCost(project.pointCost || {}) || 'Aucun')}</small>
        </button>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="research-tree__head">
        <div>
          <div class="research-tree__eyebrow">Recherche globale</div>
          <div class="research-tree__title">Arbre technologique</div>
          <div class="research-tree__meta">${data.poweredStations | 0}/${data.stationCount | 0} station(s) alimentée(s) · ${data.pointSeconds | 0}s par point / station</div>
        </div>
        <button type="button" class="research-tree__close" data-close-research="1">Fermer</button>
      </div>
      <div class="research-tree__summary">
        <section>
          <h3>Recherche active</h3>
          ${active ? `
            <div class="research-tree__active-name">${escapeHtml(active.name)}</div>
            <div class="research-tree__bar"><span style="width:${pct(active.progress)}"></span></div>
            <div class="research-tree__small">${active.pointsDone | 0}/${active.pointsTotal | 0} pts · ${escapeHtml(describeStatus(active.status))}</div>
            <button type="button" data-cancel-research="1">Annuler</button>
          ` : '<div class="research-tree__small">Aucune recherche active</div>'}
        </section>
        <section>
          <h3>Packs en stock</h3>
          <div class="research-tree__science-list">${(data.science || []).length ? (data.science || []).map((p) => `<span><i style="--pack:${escapeHtml(p.colorHex || '#fff')}"></i>${escapeHtml(p.name)} ×${p.amount | 0}</span>`).join('') : '<span>Aucun pack chargé dans les stations.</span>'}</div>
        </section>
      </div>
      <div class="research-tree__body">
        <div class="research-tree__map">${nodes}</div>
        <aside class="research-tree__side">
          ${selected ? `
            <div class="research-tree__tag" style="--branch:${escapeHtml(selectedBranch?.colorHex || '#b58cff')}">${escapeHtml(selected.branchName || '')}</div>
            <h2>${escapeHtml(selected.name)}</h2>
            <div class="research-tree__detail-block">
              <h4>Coût / point</h4>
              <p>${escapeHtml(packCost(selected.pointCost || {}) || 'Aucun')}</p>
            </div>
            <div class="research-tree__detail-block">
              <h4>Recherche</h4>
              <p>${selected.points | 0} point(s) · ${(selected.points | 0) * (data.pointSeconds | 0)}s estimées avec 1 station</p>
            </div>
            <div class="research-tree__detail-block">
              <h4>Prérequis</h4>
              <p>${escapeHtml(prereqLabel(selected, map))}</p>
            </div>
            <div class="research-tree__detail-grid">
              <div class="research-tree__detail-block">
                <h4>Bâtiments débloqués</h4>
                ${listBlock(selected.unlockBuildings || [], 'Aucun bâtiment')}
              </div>
              <div class="research-tree__detail-block">
                <h4>Recettes débloquées</h4>
                ${listBlock(selected.unlockRecipes || [], 'Aucune recette')}
              </div>
            </div>
            <div class="research-tree__detail-block">
              <h4>Coût total estimé</h4>
              <p>${escapeHtml(packCost(selected.totalCost || {}) || 'Aucun')}</p>
            </div>
            ${selected.completed
              ? '<button type="button" disabled>Déjà recherché</button>'
              : active
                ? '<button type="button" disabled>Une autre recherche est en cours</button>'
                : selected.canStart
                  ? `<button type="button" data-start-research="${escapeHtml(selected.id)}">Lancer cette recherche</button>`
                  : '<button type="button" disabled>Packs ou prérequis manquants</button>'}
          ` : '<div class="research-tree__small">Aucun projet sélectionné</div>'}
        </aside>
      </div>
    `;
  }
}
