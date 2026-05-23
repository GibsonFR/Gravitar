const GRID = 32;

export const BUILD_STRUCTURES = [
  {
    type: 'base_core',
    title: 'Noyau de base',
    orientation: 'h',
    w: 108,
    h: 108,
    claimRadius: 950,
    note: 'définit la zone de construction',
    cost: '40 scrap · 20 fer · 10 cuivre'
  },
  {
    type: 'wall',
    title: 'Mur métallique',
    orientation: 'h',
    w: 190,
    h: 48,
    note: 'R pour pivoter · bloque les déplacements',
    cost: '8 scrap · 10 fer'
  },
  {
    type: 'storage',
    title: 'Coffre spatial',
    orientation: 'h',
    w: 84,
    h: 84,
    note: 'stockage local V1',
    cost: '18 scrap · 8 fer · 4 cuivre'
  }
];

function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function snap(v, grid = GRID) {
  return Math.round((Number(v) || 0) / grid) * grid;
}

function structureDef(type) {
  return BUILD_STRUCTURES.find((s) => s.type === type) || null;
}

function rectFor(def, x, y, orientation = 'h') {
  const vertical = def.type === 'wall' && orientation === 'v';
  const w = vertical ? def.h : def.w;
  const h = vertical ? def.w : def.h;
  return { left: x - w * 0.5, right: x + w * 0.5, top: y - h * 0.5, bottom: y + h * 0.5, w, h };
}

function rectsOverlap(a, b, pad = 14) {
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

function findOwnCore(store, me, x, y) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type !== 'base_core' || !st.owned || !sameSector(st, me)) continue;
    const dx = (st.x || 0) - x;
    const dy = (st.y || 0) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  const radius = Math.max(1, Number(best?.claimRadius) || 950);
  return best && bestD2 <= radius * radius ? best : null;
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
  if (dist > 820) return { ok: false, reason: 'Trop loin du vaisseau' };
  if (Math.abs(x) > 2400 - 120 || Math.abs(y) > 2400 - 120) return { ok: false, reason: 'Trop proche du bord du secteur' };
  if (def.type === 'base_core') {
    if (hasOwnCore(store)) return { ok: false, reason: 'Noyau déjà existant' };
  } else if (!findOwnCore(store, me, x, y)) {
    return { ok: false, reason: 'Hors zone de ton noyau' };
  }

  const r = rectFor(def, x, y, orientation);
  for (const st of store?.structures?.values?.() || []) {
    if (!sameSector(st, me)) continue;
    if (rectsOverlap(r, entityRect(st), 14)) return { ok: false, reason: 'Chevauche une structure' };
  }
  for (const a of store?.asteroids?.values?.() || []) {
    if (!sameSector(a, me)) continue;
    if (!a.solid && !a.bastionWall) continue;
    if (rectsOverlap(r, entityRect(a), 16)) return { ok: false, reason: 'Obstacle solide' };
  }
  for (const station of store?.stations?.values?.() || []) {
    if (!sameSector(station, me)) continue;
    const d = Math.hypot((station.x || 0) - x, (station.y || 0) - y);
    if (d < (station.radius || 80) + Math.max(r.w, r.h) * 0.5 + 80) return { ok: false, reason: 'Trop proche d’une station' };
  }
  return { ok: true, reason: 'Placement valide' };
}

export class BasePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.store = null;
    this.activeBuild = null;
    this.lastPreview = null;
    this.el = document.createElement('div');
    this.el.className = 'base-panel';
    this.el.innerHTML = `
      <div class="base-panel__head">
        <div>
          <div class="base-panel__eyebrow">Construction V1</div>
          <div class="base-panel__title">Base</div>
        </div>
        <button class="base-panel__cancel" type="button" title="Annuler le placement">Annuler</button>
      </div>
      <div class="base-panel__hint">
        Sélectionne une structure, vise directement dans le monde, puis clique gauche pour la poser. R pivote les murs, Échap annule.
      </div>
      <div class="base-panel__grid"></div>
      <div class="base-panel__controls">
        <span>Clic gauche : poser</span>
        <span>R : pivoter</span>
        <span>Échap : annuler</span>
      </div>
      <div class="base-panel__status"></div>
    `;
    this.grid = this.el.querySelector('.base-panel__grid');
    this.status = this.el.querySelector('.base-panel__status');
    this.cancelBtn = this.el.querySelector('.base-panel__cancel');
    this.grid.innerHTML = BUILD_STRUCTURES.map((s) => `
      <button class="base-panel__btn" data-type="${s.type}">
        <span>${escapeHtml(s.title)}</span>
        <small>${escapeHtml(s.note)}</small>
        <em>${escapeHtml(s.cost)}</em>
      </button>
    `).join('');
    this.grid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.select(btn.dataset.type);
    });
    this.cancelBtn.addEventListener('click', () => this.cancel());
  }

  select(type) {
    const def = structureDef(type);
    if (!def) return;
    const prev = this.activeBuild;
    const orientation = prev?.type === type ? prev.orientation : def.orientation;
    this.activeBuild = { type, orientation };
    this.refreshButtons();
    this.status.textContent = `${def.title} sélectionné. Vise l’emplacement dans le monde puis clique gauche.`;
  }

  cancel() {
    this.activeBuild = null;
    this.lastPreview = null;
    this.refreshButtons();
    this.status.textContent = 'Placement annulé.';
  }

  rotate() {
    if (!this.activeBuild) return false;
    if (this.activeBuild.type !== 'wall') return false;
    this.activeBuild.orientation = this.activeBuild.orientation === 'v' ? 'h' : 'v';
    this.status.textContent = this.activeBuild.orientation === 'v' ? 'Mur vertical.' : 'Mur horizontal.';
    this.refreshButtons();
    return true;
  }

  hasActivePlacement() {
    return !!this.activeBuild;
  }

  refreshButtons() {
    const activeType = this.activeBuild?.type || '';
    for (const btn of this.grid.querySelectorAll('button[data-type]')) {
      btn.classList.toggle('is-active', btn.dataset.type === activeType);
    }
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
      radius: def.type === 'base_core' ? 54 : Math.max(rect.w, rect.h) * 0.5,
      orientation,
      claimRadius: def.claimRadius || 0,
      ok: validation.ok,
      reason: validation.reason
    };
    return this.lastPreview;
  }

  placeCurrent(store, mouseWorld) {
    const preview = this.getPreview(store, mouseWorld);
    if (!preview) return false;
    if (!preview.ok) {
      this.status.textContent = preview.reason || 'Placement impossible.';
      return false;
    }
    this.sendCmd('build_structure', { structureType: preview.type, orientation: preview.orientation, x: preview.x, y: preview.y });
    this.status.textContent = `${preview.title} : placement envoyé…`;
    return true;
  }

  update(store) {
    this.store = store;
    const mode = String(store?.modes?.currentMode || '').toLowerCase();
    const test = mode.includes('test');
    if (this.activeBuild && this.lastPreview) {
      this.status.textContent = this.lastPreview.ok
        ? `${this.lastPreview.title} prêt à poser. ${test ? 'Mode test : gratuit.' : 'Endless : ressources consommées.'}`
        : this.lastPreview.reason;
      return;
    }
    this.status.textContent = test ? 'Mode test : constructions gratuites et non persistantes.' : 'Endless : structures persistantes si tu es connecté.';
  }
}
