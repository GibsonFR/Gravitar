const STRUCTURES = [
  { type: 'base_core', title: 'Noyau', orientation: 'h', note: '1 par pilote · zone de construction' },
  { type: 'wall', title: 'Mur horizontal', orientation: 'h', note: 'bloque les déplacements' },
  { type: 'wall', title: 'Mur vertical', orientation: 'v', note: 'bloque les déplacements' },
  { type: 'storage', title: 'Coffre', orientation: 'h', note: 'stockage local V1' }
];

function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function placePoint(me, structureType, orientation) {
  const angle = Number.isFinite(me?.rot) ? me.rot : 0;
  const forward = structureType === 'wall' ? 170 : 145;
  let x = (me?.x || 0) + Math.cos(angle) * forward;
  let y = (me?.y || 0) + Math.sin(angle) * forward;
  if (structureType === 'wall') {
    const grid = 24;
    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;
  }
  return { x, y, orientation };
}

export class BasePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.store = null;
    this.el = document.createElement('div');
    this.el.className = 'base-panel';
    this.el.innerHTML = `
      <div class="base-panel__head">
        <div>
          <div class="base-panel__eyebrow">Construction V1</div>
          <div class="base-panel__title">Base</div>
        </div>
      </div>
      <div class="base-panel__hint">Pose les structures devant ton vaisseau. En serveur de test, les coûts sont gratuits. En Endless, les ressources sont consommées.</div>
      <div class="base-panel__grid"></div>
      <div class="base-panel__status"></div>
    `;
    this.grid = this.el.querySelector('.base-panel__grid');
    this.status = this.el.querySelector('.base-panel__status');
    this.grid.innerHTML = STRUCTURES.map((s) => `
      <button class="base-panel__btn" data-type="${s.type}" data-orientation="${s.orientation}">
        <span>${escapeHtml(s.title)}</span>
        <small>${escapeHtml(s.note)}</small>
      </button>
    `).join('');
    this.grid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.place(btn.dataset.type, btn.dataset.orientation || 'h');
    });
  }

  place(type, orientation) {
    const me = this.store?.getMe?.();
    if (!me) return;
    const pos = placePoint(me, type, orientation);
    this.sendCmd('build_structure', { structureType: type, orientation: pos.orientation, x: pos.x, y: pos.y });
    this.status.textContent = 'Placement envoyé…';
  }

  update(store) {
    this.store = store;
    const mode = String(store?.modes?.currentMode || '').toLowerCase();
    const test = mode.includes('test');
    this.status.textContent = test ? 'Mode test : constructions gratuites et non persistantes.' : 'Endless : structures persistantes si tu es connecté.';
  }
}
