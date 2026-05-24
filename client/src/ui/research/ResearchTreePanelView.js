function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const PACK_NAMES = {
  basicSciencePack: 'Base',
  automationSciencePack: 'Auto',
  industrialSciencePack: 'Indus.',
  energySciencePack: 'Énergie',
  biologySciencePack: 'Bio',
  combatSciencePack: 'Défense',
  advancedSciencePack: 'Avancée',
  anomalySciencePack: 'Anomalie'
};

const NODE_POS = {
  construction_foundations: [70, 160],
  industry_smelting_control: [70, 300],

  automation_routing: [340, 90],
  energy_distribution: [340, 220],
  advanced_industry: [340, 350],

  electronics_processing: [610, 80],
  resource_scanning: [610, 210],
  bio_processing: [610, 340],
  defense_turrets: [610, 470],

  advanced_research: [900, 200],
  pirate_reverse_engineering: [900, 360],

  alien_anomaly_analysis: [1180, 210]
};

function packCost(cost = {}) {
  const entries = Object.entries(cost || {});
  if (!entries.length) return '';
  return entries.map(([key, amount]) => `${PACK_NAMES[key] || key} ×${amount | 0}`).join(' · ');
}

function projectState(project, completed, activeIds) {
  if (completed.has(project.id)) return 'done';
  if (activeIds.has(project.id)) return 'active';
  if (project.locked) return 'locked';
  if (project.canStart) return 'ready';
  if (project.available) return 'missing';
  return 'locked';
}

function getPrereq(project) {
  return Array.isArray(project?.prereq) ? project.prereq : (Array.isArray(project?.prerequisites) ? project.prerequisites : []);
}

function sortedProjects(projects = []) {
  return [...projects].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    const ay = NODE_POS[a.id]?.[1] ?? 9999;
    const by = NODE_POS[b.id]?.[1] ?? 9999;
    if (ay !== by) return ay - by;
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
  });
}

function pickDefaultProject(projects = []) {
  if (!projects.length) return null;
  return projects.find((p) => p.completed) || projects.find((p) => p.canStart) || projects.find((p) => p.available) || projects[0];
}

export class ResearchTreePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-tree-panel';
    this.zoom = 0.92;
    this.panX = 0;
    this.panY = 0;
    this.selectedId = '';
    this.drag = null;
    this.lastKey = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => {
      const graph = ev.target.closest('.research-tree-panel__viewport');
      if (!graph || ev.target.closest('button') || ev.target.closest('.research-node')) return;
      this.drag = { x: ev.clientX, y: ev.clientY, panX: this.panX, panY: this.panY };
      graph.setPointerCapture?.(ev.pointerId);
      ev.preventDefault();
    });
    this.el.addEventListener('pointermove', (ev) => {
      if (!this.drag) return;
      this.panX = this.drag.panX + (ev.clientX - this.drag.x);
      this.panY = this.drag.panY + (ev.clientY - this.drag.y);
      this.applyTransform();
    });
    this.el.addEventListener('pointerup', () => { this.drag = null; });
    this.el.addEventListener('wheel', (ev) => {
      const graph = ev.target.closest('.research-tree-panel__viewport');
      if (!graph) return;
      this.zoom = Math.max(0.55, Math.min(1.45, this.zoom + (ev.deltaY < 0 ? 0.08 : -0.08)));
      this.applyTransform();
      ev.preventDefault();
    }, { passive: false });
    this.el.addEventListener('click', (ev) => {
      const node = ev.target.closest('[data-research-node]');
      if (node) {
        this.selectedId = node.dataset.project || '';
        this.updateSelection();
        ev.preventDefault();
        return;
      }
      const start = ev.target.closest('[data-research-start]');
      if (start) {
        this.sendCmd('research_tree_start', { projectId: start.dataset.project || '' });
        ev.preventDefault();
        return;
      }
      const cancel = ev.target.closest('[data-research-cancel]');
      if (cancel) {
        this.sendCmd('research_tree_cancel', {});
        ev.preventDefault();
      }
    });
  }

  applyTransform() {
    const canvas = this.el.querySelector('.research-tree-panel__canvas');
    if (canvas) canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    const zoom = this.el.querySelector('[data-research-zoom]');
    if (zoom) zoom.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  ensureSelection(projects) {
    if (!projects.length) {
      this.selectedId = '';
      return;
    }
    if (!projects.some((p) => p.id === this.selectedId)) {
      this.selectedId = pickDefaultProject(projects)?.id || projects[0].id;
    }
  }

  updateSelection() {
    const data = this.current || null;
    const projects = sortedProjects(data?.projects || []);
    this.ensureSelection(projects);
    const selected = projects.find((p) => p.id === this.selectedId) || projects[0] || null;
    const side = this.el.querySelector('.research-tree-panel__side');
    if (!side || !selected) return;
    const completed = new Set(data.completed || []);
    const activeIds = new Set((data.active || []).map((a) => a.projectId));
    const state = projectState(selected, completed, activeIds);
    const prereq = getPrereq(selected).map((id) => projects.find((p) => p.id === id)?.name || id);
    side.innerHTML = `
      <div class="research-tree-panel__side-head">
        <span>${escapeHtml(selected.branchName || selected.branch || '')}</span>
        <strong>${escapeHtml(selected.name)}</strong>
      </div>
      <div class="research-tree-panel__state is-${state}">${state === 'done' ? 'Déjà recherché' : state === 'active' ? 'Recherche en cours' : state === 'locked' ? 'Verrouillé' : state === 'ready' ? 'Disponible' : 'Packs manquants'}</div>
      <div class="research-tree-panel__detail">
        <b>Coût</b>
        <p>${escapeHtml(packCost(selected.scienceCost || {}) || 'Aucun')}</p>
        <b>Durée</b>
        <p>${selected.seconds | 0}s · ${selected.energyUse | 0} énergie / station</p>
        <b>Prérequis</b>
        <p>${prereq.length ? prereq.map(escapeHtml).join(' + ') : 'Aucun'}</p>
        <b>Débloque</b>
        <p>${(selected.unlocks || []).map(escapeHtml).join(' · ') || '—'}</p>
      </div>
      <button type="button" data-research-start="1" data-project="${escapeHtml(selected.id)}" ${state === 'ready' ? '' : 'disabled'}>Lancer cette recherche</button>
    `;
    this.el.querySelectorAll('.research-node').forEach((n) => n.classList.toggle('is-selected', n.dataset.project === selected.id));
  }

  update(store) {
    const data = store.myState?.researchOverview || null;
    if (!data) {
      this.el.innerHTML = '<div class="research-tree-panel__empty">Aucune donnée de recherche.</div>';
      return;
    }
    this.current = data;
    const key = JSON.stringify({
      c: data.completed,
      a: data.active,
      s: data.science,
      stationCount: data.stationCount,
      selected: this.selectedId,
      projects: (data.projects || []).map((p) => [p.id, p.locked, p.canStart, p.completed, p.available])
    });
    if (key === this.lastKey) return;
    this.lastKey = key;

    const projects = sortedProjects(data.projects || []);
    this.ensureSelection(projects);
    const completed = new Set(data.completed || []);
    const activeIds = new Set((data.active || []).map((a) => a.projectId));
    const active = data.active?.[0] || null;
    const maxX = Math.max(1460, ...projects.map((p) => (NODE_POS[p.id]?.[0] || 0) + 220));
    const maxY = Math.max(640, ...projects.map((p) => (NODE_POS[p.id]?.[1] || 0) + 120));

    const lines = projects.flatMap((p) => getPrereq(p).map((pre) => {
      const a = NODE_POS[pre] || [0, 0];
      const b = NODE_POS[p.id] || [0, 0];
      const done = completed.has(pre);
      return `<line class="research-edge ${done ? 'is-done' : ''}" x1="${a[0] + 176}" y1="${a[1] + 38}" x2="${b[0]}" y2="${b[1] + 38}" />`;
    })).join('');

    this.el.innerHTML = `
      <div class="research-tree-panel__top">
        <div>
          <div class="research-tree-panel__eyebrow">Recherche globale</div>
          <div class="research-tree-panel__title">Arbre technologique</div>
        </div>
        <div class="research-tree-panel__summary">
          <span>${data.stationCount | 0} stations</span>
          <span>${data.poweredStations | 0} actives</span>
          <span>${(data.completed || []).length} terminées</span>
          <span data-research-zoom>${Math.round(this.zoom * 100)}%</span>
        </div>
      </div>
      <div class="research-tree-panel__active">
        <strong>${active ? escapeHtml(active.name) : 'Aucune recherche active'}</strong>
        <div class="research-tree-panel__bar"><span style="width:${Math.round((active?.progress || 0) * 100)}%"></span></div>
        <button type="button" data-research-cancel="1" ${active ? '' : 'disabled'}>Annuler</button>
      </div>
      <div class="research-tree-panel__main">
        <div class="research-tree-panel__viewport">
          <div class="research-tree-panel__canvas" style="width:${maxX}px;height:${maxY}px">
            <svg class="research-tree-panel__edges" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">${lines}</svg>
            ${projects.map((p) => {
              const pos = NODE_POS[p.id] || [80, 80];
              const state = projectState(p, completed, activeIds);
              const branch = (data.branches || []).find((b) => b.id === p.branch) || {};
              return `<button type="button" class="research-node is-${state}" data-research-node="1" data-project="${escapeHtml(p.id)}" style="--x:${pos[0]}px;--y:${pos[1]}px;--branch:${escapeHtml(branch.colorHex || '#7edcff')}">
                <i></i><span>${escapeHtml(p.name)}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
        <aside class="research-tree-panel__side"></aside>
      </div>
      <div class="research-tree-panel__packs">
        ${(data.science || []).length ? (data.science || []).map((p) => `<span style="--pack:${escapeHtml(p.colorHex || '#fff')}"><i></i>${escapeHtml(p.name)} ×${p.amount | 0}</span>`).join('') : '<em>Aucun pack chargé dans les stations.</em>'}
      </div>
    `;
    this.applyTransform();
    this.updateSelection();
  }
}
