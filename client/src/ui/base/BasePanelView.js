const BASE_TILE = 64;
const BUILD_RANGE = 1100;

function iconSvg(kind) {
  if (kind === 'core') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="14" width="36" height="36" rx="7" fill="rgba(99,208,255,.16)" stroke="currentColor" stroke-width="3"/><path d="M24 32h16M32 24v16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="25" y="25" width="14" height="14" rx="3" fill="currentColor" opacity=".18"/></svg>`;
  if (kind === 'wall') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="24" width="48" height="16" rx="3" fill="rgba(120,190,255,.13)" stroke="currentColor" stroke-width="3"/><path d="M18 24v16M31 24v16M44 24v16" stroke="currentColor" stroke-width="2" opacity=".7"/></svg>`;
  if (kind === 'storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 22l18-9 18 9v21l-18 9-18-9V22z" fill="rgba(111,240,197,.13)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 22l18 9 18-9M32 31v21" fill="none" stroke="currentColor" stroke-width="2" opacity=".75"/></svg>`;
  return '';
}

export const BUILD_STRUCTURES = [
  {
    type: 'base_core',
    category: 'core',
    title: 'Noyau',
    subtitle: 'Claim',
    icon: 'core',
    orientation: 'h',
    tilesX: 3,
    tilesY: 3,
    w: 192,
    h: 192,
    claimRadius: 1024,
    cost: '40 scrap · 20 fer · 10 cuivre'
  },
  {
    type: 'wall',
    category: 'walls',
    title: 'Mur',
    subtitle: '3 × 1',
    icon: 'wall',
    orientation: 'h',
    rotatable: true,
    tilesX: 3,
    tilesY: 1,
    w: 192,
    h: 64,
    cost: '8 scrap · 10 fer'
  },
  {
    type: 'storage',
    category: 'storage',
    title: 'Coffre',
    subtitle: '2 × 2',
    icon: 'storage',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    cost: '18 scrap · 8 fer · 4 cuivre'
  }
];

const BUILD_CATEGORIES = [
  { id: 'core', label: 'Base', icon: 'core' },
  { id: 'walls', label: 'Murs', icon: 'wall' },
  { id: 'storage', label: 'Stockage', icon: 'storage' }
];

function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function snap(v, grid = BASE_TILE) {
  return Math.round((Number(v) || 0) / grid) * grid;
}

function structureDef(type) {
  return BUILD_STRUCTURES.find((s) => s.type === type) || null;
}

function orientedSize(def, orientation = 'h') {
  const vertical = def.type === 'wall' && orientation === 'v';
  return {
    w: vertical ? def.h : def.w,
    h: vertical ? def.w : def.h,
    tilesX: vertical ? def.tilesY : def.tilesX,
    tilesY: vertical ? def.tilesX : def.tilesY
  };
}

function rectFor(def, x, y, orientation = 'h') {
  const size = orientedSize(def, orientation);
  return { left: x - size.w * 0.5, right: x + size.w * 0.5, top: y - size.h * 0.5, bottom: y + size.h * 0.5, ...size };
}

function rectsOverlap(a, b, pad = 10) {
  return a.left - pad <= b.right && a.right + pad >= b.left && a.top - pad <= b.bottom && a.bottom + pad >= b.top;
}

function entityRect(e) {
  const w = Number(e?.w) || (Number(e?.radius) || 0) * 2;
  const h = Number(e?.h) || (Number(e?.radius) || 0) * 2;
  return { left: (e?.x || 0) - w * 0.5, right: (e?.x || 0) + w * 0.5, top: (e?.y || 0) - h * 0.5, bottom: (e?.y || 0) + h * 0.5, w, h };
}

function sameSector(a, b) {
  return (a?.sx | 0) === (b?.sx | 0) && (a?.sy | 0) === (b?.sy | 0);
}

function isInsideCoreSquare(core, x, y) {
  const half = Math.max(1, Number(core?.claimRadius) || 1024);
  return Math.abs((core?.x || 0) - x) <= half && Math.abs((core?.y || 0) - y) <= half;
}

function findOwnCore(store, me, x, y) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type !== 'base_core' || !st.owned || !sameSector(st, me)) continue;
    if (!isInsideCoreSquare(st, x, y)) continue;
    const dx = (st.x || 0) - x;
    const dy = (st.y || 0) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}

function hasOwnCore(store) {
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type === 'base_core' && st.owned) return true;
  }
  return false;
}

function validatePreview(store, me, def, x, y, orientation) {
  if (!me) return { ok: false, reason: 'Aucun vaisseau actif' };
  const dist = Math.hypot(x - (me.x || 0), y - (me.y || 0));
  if (dist > BUILD_RANGE) return { ok: false, reason: 'Trop loin' };
  if (Math.abs(x) > 2400 - 140 || Math.abs(y) > 2400 - 140) return { ok: false, reason: 'Bord du secteur' };
  const ownCore = def.type === 'base_core' ? null : findOwnCore(store, me, x, y);
  if (def.type === 'base_core') {
    if (hasOwnCore(store)) return { ok: false, reason: 'Noyau déjà posé' };
  } else if (!ownCore) {
    return { ok: false, reason: 'Hors claim' };
  }

  const r = rectFor(def, x, y, orientation);
  for (const st of store?.structures?.values?.() || []) {
    if (!sameSector(st, me)) continue;
    if (rectsOverlap(r, entityRect(st), 8)) return { ok: false, reason: 'Occupé' };
  }
  for (const a of store?.asteroids?.values?.() || []) {
    if (!sameSector(a, me)) continue;
    if (!a.solid && !a.bastionWall) continue;
    if (rectsOverlap(r, entityRect(a), 12)) return { ok: false, reason: 'Obstacle' };
  }
  for (const station of store?.stations?.values?.() || []) {
    if (!sameSector(station, me)) continue;
    const d = Math.hypot((station.x || 0) - x, (station.y || 0) - y);
    if (d < (station.radius || 80) + Math.max(r.w, r.h) * 0.5 + 80) return { ok: false, reason: 'Station proche' };
  }
  return { ok: true, reason: 'OK', ownCore };
}

export class BasePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.store = null;
    this.activeBuild = null;
    this.lastPreview = null;
    this.category = 'core';
    this.el = document.createElement('div');
    this.el.className = 'base-panel';
    this.el.innerHTML = `
      <div class="base-panel__head">
        <div>
          <div class="base-panel__eyebrow">Build</div>
          <div class="base-panel__title">Base</div>
        </div>
        <button class="base-panel__cancel" type="button" title="Annuler">×</button>
      </div>
      <div class="base-panel__body">
        <div class="base-panel__cats"></div>
        <div class="base-panel__content">
          <div class="base-panel__grid"></div>
          <div class="base-panel__keys"><span>LMB poser</span><span>O tourner</span><span>Échap annuler</span></div>
          <div class="base-panel__status"></div>
        </div>
      </div>
    `;
    this.cats = this.el.querySelector('.base-panel__cats');
    this.grid = this.el.querySelector('.base-panel__grid');
    this.status = this.el.querySelector('.base-panel__status');
    this.cancelBtn = this.el.querySelector('.base-panel__cancel');
    this.cats.innerHTML = BUILD_CATEGORIES.map((c) => `
      <button class="base-panel__cat" data-category="${c.id}" title="${escapeHtml(c.label)}">
        ${iconSvg(c.icon)}<span>${escapeHtml(c.label)}</span>
      </button>
    `).join('');
    this.cats.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-category]');
      if (!btn) return;
      this.category = btn.dataset.category;
      this.refresh();
    });
    this.grid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.select(btn.dataset.type);
    });
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.refresh();
  }

  select(type) {
    const def = structureDef(type);
    if (!def) return;
    const prev = this.activeBuild;
    const orientation = prev?.type === type ? prev.orientation : def.orientation;
    this.activeBuild = { type, orientation };
    this.refresh();
    this.status.textContent = `${def.title} sélectionné`;
  }

  cancel() {
    this.activeBuild = null;
    this.lastPreview = null;
    this.refresh();
    this.status.textContent = '';
  }

  rotate() {
    if (!this.activeBuild) return false;
    const def = structureDef(this.activeBuild.type);
    if (!def?.rotatable) return false;
    this.activeBuild.orientation = this.activeBuild.orientation === 'v' ? 'h' : 'v';
    this.status.textContent = this.activeBuild.orientation === 'v' ? 'Vertical' : 'Horizontal';
    this.refresh();
    return true;
  }

  hasActivePlacement() {
    return !!this.activeBuild;
  }

  refresh() {
    const activeType = this.activeBuild?.type || '';
    for (const btn of this.cats.querySelectorAll('button[data-category]')) {
      btn.classList.toggle('is-active', btn.dataset.category === this.category);
    }
    this.grid.innerHTML = BUILD_STRUCTURES
      .filter((s) => s.category === this.category)
      .map((s) => `
        <button class="base-panel__btn ${s.type === activeType ? 'is-active' : ''}" data-type="${s.type}">
          <span class="base-panel__icon">${iconSvg(s.icon)}</span>
          <span class="base-panel__meta">
            <strong>${escapeHtml(s.title)}</strong>
            <small>${escapeHtml(s.subtitle)} · ${s.tilesX}×${s.tilesY}</small>
            <em>${escapeHtml(s.cost)}</em>
          </span>
        </button>
      `).join('');
    this.cancelBtn.classList.toggle('is-visible', !!this.activeBuild);
  }

  getPreview(store, mouseWorld) {
    this.store = store || this.store;
    if (!this.activeBuild || !mouseWorld) return null;
    const me = this.store?.getMe?.();
    const def = structureDef(this.activeBuild.type);
    if (!def) return null;
    const x = snap(mouseWorld.x);
    const y = snap(mouseWorld.y);
    const orientation = this.activeBuild.orientation || 'h';
    const rect = rectFor(def, x, y, orientation);
    const validation = validatePreview(this.store, me, def, x, y, orientation);
    this.lastPreview = {
      type: def.type,
      title: def.title,
      x,
      y,
      sx: me?.sx | 0,
      sy: me?.sy | 0,
      w: rect.w,
      h: rect.h,
      tilesX: rect.tilesX,
      tilesY: rect.tilesY,
      gridSize: BASE_TILE,
      buildRange: BUILD_RANGE,
      radius: Math.max(rect.w, rect.h) * 0.5,
      orientation,
      claimRadius: def.claimRadius || 0,
      ok: validation.ok,
      reason: validation.reason,
      ownCore: validation.ownCore ? { x: validation.ownCore.x, y: validation.ownCore.y, claimRadius: validation.ownCore.claimRadius || 1024 } : null
    };
    return this.lastPreview;
  }

  placeCurrent(store, mouseWorld) {
    const preview = this.getPreview(store, mouseWorld);
    if (!preview) return false;
    if (!preview.ok) {
      this.status.textContent = preview.reason || 'Impossible';
      return false;
    }
    this.sendCmd('build_structure', { structureType: preview.type, orientation: preview.orientation, x: preview.x, y: preview.y });
    this.status.textContent = 'Placement envoyé';
    return true;
  }

  update(store) {
    this.store = store;
    if (this.activeBuild && this.lastPreview) {
      this.status.textContent = this.lastPreview.ok ? `${this.lastPreview.title} prêt` : this.lastPreview.reason;
      return;
    }
    this.status.textContent = '';
  }
}
