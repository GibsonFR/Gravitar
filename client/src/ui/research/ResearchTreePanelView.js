function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const PACK_LABELS = {
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
  construction_foundations: [80, 180],
  industry_smelting_control: [80, 410],

  automation_routing: [365, 80],
  automation_sorting: [650, 80],

  energy_distribution: [365, 300],
  advanced_industry: [365, 520],

  resource_scanning: [760, 210],
  electronics_processing: [760, 420],
  bio_processing: [760, 630],
  defense_turrets: [760, 840],

  logistics_basic: [1070, 90],
  logistics_fast: [1370, 90],
  logistics_advanced: [1670, 90],
  advanced_logistics: [1670, 90],

  advanced_research: [1100, 390],
  equipment_mark_ii: [1390, 300],
  equipment_rd_station: [1680, 300],
  equipment_mark_iii: [1970, 300],
  alien_anomaly_analysis: [2260, 440],
  equipment_mark_iv: [2550, 300],
  equipment_mark_v: [2840, 300],

  pirate_reverse_engineering: [1410, 690]
};

const NODE_SIZE = {
  width: 210,
  height: 82,
  gapX: 56,
  gapY: 42
};

function projectPosition(project, index = 0) {
  if (NODE_POS[project?.id]) return NODE_POS[project.id];
  const col = index % 4;
  const row = Math.floor(index / 4);
  return [90 + col * 300, 920 + row * 130];
}

function packCost(cost = {}) {
  const entries = Object.entries(cost || {}).filter(([, amount]) => (amount | 0) > 0);
  if (!entries.length) return 'Aucun';
  return entries.map(([key, amount]) => `${amount | 0}× ${PACK_LABELS[key] || key}`).join(' · ');
}

function secondsLabel(seconds) {
  const s = Math.max(0, seconds | 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function totalCost(project) {
  return project.totalCost || Object.fromEntries(Object.entries(project.pointCost || {}).map(([k, v]) => [k, (v | 0) * (project.points | 0)]));
}

function prereqIds(project) {
  return Array.isArray(project?.prereq) ? project.prereq : (Array.isArray(project?.prerequisites) ? project.prerequisites : []);
}

function listBlock(items = [], emptyLabel = 'Aucun') {
  if (!items.length) return `<div class="research-tree-panel__empty-line">${escapeHtml(emptyLabel)}</div>`;
  return `<ul class="research-tree-panel__unlock-list">${items.map((it) => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`;
}

function nodeState(project, activeIds) {
  if (project.completed) return 'done';
  if (activeIds.has(project.id)) return 'active';
  if (project.canStart) return 'ready';
  if (project.available) return 'missing';
  return 'locked';
}

function statusLabel(state) {
  return {
    done: 'Terminé',
    active: 'En cours',
    ready: 'Disponible',
    missing: 'Packs manquants',
    locked: 'Verrouillé'
  }[state] || state;
}

function sortedProjects(projects = []) {
  return [...projects].sort((a, b) => {
    const ax = NODE_POS[a.id]?.[0] ?? 99999;
    const bx = NODE_POS[b.id]?.[0] ?? 99999;
    if (ax !== bx) return ax - bx;
    const ay = NODE_POS[a.id]?.[1] ?? 99999;
    const by = NODE_POS[b.id]?.[1] ?? 99999;
    if (ay !== by) return ay - by;
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
  });
}

function defaultProject(projects = []) {
  return projects.find((p) => p.canStart) || projects.find((p) => p.available) || projects[0] || null;
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
      const viewport = ev.target.closest('.research-tree-panel__viewport');
      if (!viewport || ev.target.closest('button')) return;
      if (ev.target.closest('.research-tree-panel__node')) return;
      this.drag = { x: ev.clientX, y: ev.clientY, panX: this.panX, panY: this.panY };
      viewport.setPointerCapture?.(ev.pointerId);
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
      if (!ev.target.closest('.research-tree-panel__viewport')) return;
      this.zoom = Math.max(0.56, Math.min(1.42, this.zoom + (ev.deltaY < 0 ? 0.08 : -0.08)));
      this.applyTransform();
      ev.preventDefault();
    }, { passive: false });
    this.el.addEventListener('click', (ev) => {
      const node = ev.target.closest('[data-research-node]');
      if (node) {
        this.selectedId = node.dataset.project || '';
        this.renderSelection();
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
    const z = this.el.querySelector('[data-research-zoom]');
    if (z) z.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  ensureSelection() {
    const projects = this.projects || [];
    if (!projects.length) return;
    if (!projects.some((p) => p.id === this.selectedId)) this.selectedId = defaultProject(projects)?.id || projects[0].id;
  }

  renderSelection() {
    const data = this.data;
    const projects = this.projects || [];
    this.ensureSelection();
    const project = projects.find((p) => p.id === this.selectedId) || projects[0] || null;
    const side = this.el.querySelector('.research-tree-panel__side');
    if (!side || !project) return;
    const map = new Map(projects.map((p) => [p.id, p]));
    const activeIds = new Set((data.active || []).map((a) => a.projectId));
    const state = nodeState(project, activeIds);
    const branch = (data.branches || []).find((b) => b.id === project.branch) || null;
    const prereq = prereqIds(project).map((id) => map.get(id)?.name || id);
    const pointSeconds = data.pointSeconds | 0 || 30;
    const estimatedOneStation = (project.points | 0) * pointSeconds;
    side.innerHTML = `
      <div class="research-tree-panel__branch" style="--branch:${escapeHtml(branch?.colorHex || '#7edcff')}">${escapeHtml(project.branchName || branch?.name || '')}</div>
      <h2>${escapeHtml(project.name)}</h2>
      <div class="research-tree-panel__status is-${state}">${escapeHtml(statusLabel(state))}</div>
      <section>
        <h3>Coût par point</h3>
        <p>${escapeHtml(packCost(project.pointCost || {}))}</p>
      </section>
      <section>
        <h3>Recherche</h3>
        <p>${project.points | 0} points · ${secondsLabel(estimatedOneStation)} avec 1 station · ${project.energyUse | 0} énergie/station</p>
      </section>
      <section>
        <h3>Prérequis</h3>
        <p>${prereq.length ? prereq.map(escapeHtml).join(' + ') : 'Aucun'}</p>
      </section>
      <div class="research-tree-panel__split">
        <section>
          <h3>Bâtiments débloqués</h3>
          ${listBlock(project.unlockBuildings || [], 'Aucun bâtiment')}
        </section>
        <section>
          <h3>Recettes débloquées</h3>
          ${listBlock(project.unlockRecipes || [], 'Aucune recette')}
        </section>
      </div>
      <section>
        <h3>Coût total</h3>
        <p>${escapeHtml(packCost(totalCost(project)))}</p>
      </section>
      ${state === 'ready'
        ? `<button type="button" data-research-start="1" data-project="${escapeHtml(project.id)}">Lancer cette recherche</button>`
        : state === 'done'
          ? '<button type="button" disabled>Déjà terminé</button>'
          : state === 'active'
            ? '<button type="button" disabled>Recherche en cours</button>'
            : '<button type="button" disabled>Packs ou prérequis manquants</button>'}
    `;
    this.el.querySelectorAll('.research-tree-panel__node').forEach((n) => n.classList.toggle('is-selected', n.dataset.project === project.id));
  }

  update(store) {
    const data = store.myState?.researchOverview || null;
    if (!data) {
      this.el.innerHTML = '<div class="research-tree-panel__empty">Aucune donnée de recherche.</div>';
      return;
    }
    const projects = sortedProjects(data.projects || []);
    this.data = data;
    this.projects = projects;
    this.ensureSelection();

    const key = JSON.stringify({
      selected: this.selectedId,
      completed: data.completed,
      active: data.active,
      science: data.science,
      stations: [data.stationCount, data.poweredStations],
      projects: projects.map((p) => [p.id, p.canStart, p.available, p.completed])
    });
    if (key === this.lastKey) return;
    this.lastKey = key;

    const active = (data.active || [])[0] || null;
    const activeIds = new Set((data.active || []).map((a) => a.projectId));
    const nodeW = NODE_SIZE.width;
    const nodeH = NODE_SIZE.height;
    const positions = new Map(projects.map((p, i) => [p.id, projectPosition(p, i)]));
    const maxX = Math.max(1800, ...projects.map((p, i) => (positions.get(p.id)?.[0] ?? projectPosition(p, i)[0]) + nodeW + NODE_SIZE.gapX));
    const maxY = Math.max(980, ...projects.map((p, i) => (positions.get(p.id)?.[1] ?? projectPosition(p, i)[1]) + nodeH + NODE_SIZE.gapY));
    const lines = projects.flatMap((p) => prereqIds(p).map((id) => {
      const a = positions.get(id);
      const b = positions.get(p.id);
      if (!a || !b) return '';
      const done = !!projects.find((x) => x.id === id)?.completed;
      return `<path class="research-tree-panel__edge ${done ? 'is-done' : ''}" d="M${a[0] + nodeW},${a[1] + nodeH / 2} C${a[0] + nodeW + 80},${a[1] + nodeH / 2} ${b[0] - 80},${b[1] + nodeH / 2} ${b[0]},${b[1] + nodeH / 2}" />`;
    })).join('');

    this.el.innerHTML = `
      <div class="research-tree-panel__top">
        <div>
          <div class="research-tree-panel__eyebrow">Recherche globale</div>
          <div class="research-tree-panel__title">Arbre technologique</div>
          <div class="research-tree-panel__meta">${data.poweredStations | 0}/${data.stationCount | 0} station(s) alimentée(s) · ${data.pointSeconds | 0 || 30}s / point / station</div>
        </div>
        <div class="research-tree-panel__summary">
          <span>${(data.completed || []).length} terminées</span>
          <span data-research-zoom>${Math.round(this.zoom * 100)}%</span>
        </div>
      </div>
      <div class="research-tree-panel__active">
        <strong>${active ? escapeHtml(active.name) : 'Aucune recherche active'}</strong>
        <div class="research-tree-panel__bar"><span style="width:${Math.round((active?.progress || 0) * 100)}%"></span></div>
        <span>${active ? `${active.pointsDone | 0}/${active.pointsTotal | 0} pts` : '—'}</span>
        <button type="button" data-research-cancel="1" ${active ? '' : 'disabled'}>Annuler</button>
      </div>
      <div class="research-tree-panel__main">
        <div class="research-tree-panel__viewport">
          <div class="research-tree-panel__canvas" style="width:${maxX}px;height:${maxY}px">
            <svg class="research-tree-panel__edges" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">${lines}</svg>
            ${projects.map((p) => {
              const pos = positions.get(p.id) || projectPosition(p, 0);
              const branch = (data.branches || []).find((b) => b.id === p.branch) || {};
              const state = nodeState(p, activeIds);
              return `<button type="button" class="research-tree-panel__node is-${state}" data-research-node="1" data-project="${escapeHtml(p.id)}" style="--x:${pos[0]}px;--y:${pos[1]}px;--branch:${escapeHtml(branch.colorHex || '#7edcff')}">
                <i></i><strong>${escapeHtml(p.name)}</strong><small>${p.points | 0} pts · ${escapeHtml(packCost(p.pointCost || {}))}</small>
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
    this.renderSelection();
  }
}
