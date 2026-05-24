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
  construction_foundations: [80, 90],
  industry_smelting_control: [300, 80],
  automation_routing: [300, 210],
  energy_distribution: [520, 80],
  exploration_scanning: [520, 210],
  industry_advanced_components: [740, 80],
  electronics_control: [740, 210],
  biology_sampling: [740, 340],
  defense_systems: [960, 210],
  advanced_research: [1180, 160],
  anomaly_science: [1400, 160]
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
  return 'missing';
}

export class ResearchTreePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-tree-panel';
    this.zoom = 1;
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

  updateSelection() {
    const data = this.current || null;
    const projects = data?.projects || [];
    const selected = projects.find((p) => p.id === this.selectedId) || projects[0] || null;
    const side = this.el.querySelector('.research-tree-panel__side');
    if (!side || !selected) return;
    const completed = new Set(data.completed || []);
    const activeIds = new Set((data.active || []).map((a) => a.projectId));
    const state = projectState(selected, completed, activeIds);
    const prereq = (selected.prerequisites || []).map((id) => projects.find((p) => p.id === id)?.name || id);
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
      projects: (data.projects || []).map((p) => [p.id, p.locked, p.canStart, p.completed])
    });
    if (key === this.lastKey) return;
    this.lastKey = key;

    const projects = data.projects || [];
    if (!this.selectedId && projects[0]) this.selectedId = projects[0].id;
    const completed = new Set(data.completed || []);
    const activeIds = new Set((data.active || []).map((a) => a.projectId));
    const active = data.active?.[0] || null;
    const maxX = Math.max(1550, ...projects.map((p) => (NODE_POS[p.id]?.[0] || 0) + 220));
    const maxY = Math.max(520, ...projects.map((p) => (NODE_POS[p.id]?.[1] || 0) + 130));

    const lines = projects.flatMap((p) => (p.prerequisites || []).map((pre) => {
      const a = NODE_POS[pre] || [0, 0];
      const b = NODE_POS[p.id] || [0, 0];
      const done = completed.has(pre);
      return `<line class="research-edge ${done ? 'is-done' : ''}" x1="${a[0] + 160}" y1="${a[1] + 42}" x2="${b[0]}" y2="${b[1] + 42}" />`;
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
