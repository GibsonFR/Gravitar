const BASE_TILE = 64;
const SECTOR_HALF = 2000;
const BUILD_RANGE = 1200;
const EDGE_RESERVE_TILES = 1;
const EDGE_RESERVE = BASE_TILE * EDGE_RESERVE_TILES;

const RESOURCE_LABELS = {
  ironOre: 'Minerai de fer',
  copper: 'Cuivre',
  aluminiumOre: 'Minerai d’aluminium',
  titaniumOre: 'Minerai de titane',
  steelPlate: 'Acier',
  copperWire: 'Fil de cuivre',
  silicon: 'Silicium',
  refinedFuel: 'Carburant raffiné',
  biofuel: 'Biocarburant',
  propellant: 'Propergol',
  steelPlate: 'Acier',
  copperWire: 'Fil de cuivre',
  siliconWafer: 'Wafer de silicium',
  carbonFiber: 'Fibre de carbone'
};

function iconSvg(kind) {
  if (kind === 'core') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7l21 12v26L32 57 11 45V19L32 7z" fill="rgba(101,215,255,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="currentColor" opacity=".85"/><path d="M32 12v8M32 44v8M14 22l7 4M43 38l7 4M14 42l7-4M43 26l7-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === 'wall') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="22" width="52" height="20" rx="3" fill="rgba(120,190,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M14 22v20M24 22v20M34 22v20M44 22v20M54 22v20" stroke="currentColor" stroke-width="2" opacity=".72"/><path d="M10 32h44" stroke="currentColor" stroke-width="2" opacity=".45"/></svg>`;
  if (kind === 'door') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="19" width="50" height="26" rx="4" fill="rgba(135,217,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M18 22v20M46 22v20" stroke="currentColor" stroke-width="2.4" opacity=".75"/><path d="M24 32h16M40 32l-5-5M40 32l-5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (kind === 'equipment_storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 16h36v34H14V16z" fill="rgba(139,184,255,.12)" stroke="currentColor" stroke-width="3"/><path d="M22 24h20M22 32h20M22 40h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="45" cy="43" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`;
  if (kind === 'ammo_storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 18h34v28H15V18z" fill="rgba(255,193,111,.12)" stroke="currentColor" stroke-width="3"/><path d="M22 39l9-18 9 18M26 33h10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 48h40" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".65"/></svg>`;
  if (kind === 'storage') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 21l19-10 19 10v22L32 53 13 43V21z" fill="rgba(111,240,197,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M13 21l19 11 19-11M32 32v21" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".82"/><path d="M22 26l19-10M22 39l20-11" stroke="currentColor" stroke-width="2" opacity=".28"/></svg>`;
  if (kind === 'repair') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M39 12l13 13-7 7-5-5-18 18-10 3 3-10 18-18-5-5 11-3z" fill="rgba(112,240,197,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 49h30" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === 'demolish') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 16h24l-2 34H22L20 16z" fill="rgba(255,120,120,.10)" stroke="currentColor" stroke-width="3"/><path d="M17 16h30M26 16l2-5h8l2 5M27 25v17M37 25v17" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  if (kind === 'solar_panel') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="18" width="44" height="28" rx="4" fill="rgba(189,233,146,.13)" stroke="currentColor" stroke-width="3"/><path d="M21 18v28M32 18v28M43 18v28M10 32h44M20 10l-4 5M32 7v7M44 10l4 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>`;
  if (kind === 'fuel_generator') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="13" y="16" width="38" height="34" rx="5" fill="rgba(255,183,97,.13)" stroke="currentColor" stroke-width="3"/><path d="M25 42c-3-7 5-10 4-18 7 5 10 10 8 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 23h8M37 23h8M19 50h26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".72"/></svg>`;
  if (kind === 'fuel_tank') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 13h24l6 8v30H14V21l6-8z" fill="rgba(255,195,111,.12)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M22 29h20M22 38h20M27 13v-4h10v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".75"/></svg>`;
  if (kind === 'machine') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="11" y="18" width="42" height="32" rx="5" fill="rgba(255,180,110,.12)" stroke="currentColor" stroke-width="3"/><circle cx="25" cy="34" r="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M37 27h8M37 34h8M37 41h8M18 18v-6h28v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".72"/></svg>`;
  if (kind === 'power') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M35 6L16 36h14l-3 22 21-34H34l1-18z" fill="rgba(255,213,95,.13)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`;
  return '';
}

export const BUILD_STRUCTURES = [
  {
    type: 'base_core',
    category: 'construction',
    title: 'Noyau de base',
    subtitle: '2 × 2 cases',
    icon: 'core',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    claimRadius: BASE_TILE * 8,
    hp: 1200,
    role: 'Définit ta zone de construction.',
    stats: ['Zone : 16 × 16 cases', '1 noyau actif'],
    cost: { ironOre: 35, copper: 12, aluminiumOre: 8 }
  },
  {
    type: 'wall',
    category: 'construction',
    title: 'Mur métallique',
    subtitle: '3 × 1 cases',
    icon: 'wall',
    orientation: 'h',
    rotatable: true,
    tilesX: 3,
    tilesY: 1,
    w: 192,
    h: 64,
    hp: 760,
    role: 'Protège la base.',
    stats: [],
    cost: { ironOre: 12, copper: 2 }
  },

  {
    type: 'door',
    category: 'construction',
    title: 'Porte renforcée',
    subtitle: '3 × 1 cases',
    icon: 'door',
    orientation: 'h',
    rotatable: true,
    tilesX: 3,
    tilesY: 1,
    w: 192,
    h: 64,
    hp: 680,
    role: 'Entrée de base ouvrable.',
    stats: [],
    cost: { ironOre: 10, copper: 4, aluminiumOre: 2 }
  },
  {
    type: 'storage',
    category: 'storage',
    title: 'Coffre de ressources',
    subtitle: '2 × 2 cases',
    icon: 'storage',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    storageCapacity: 420,
    role: 'Stocke les minerais et matériaux.',
    stats: ['Capacité : 420'],
    cost: { ironOre: 14, copper: 8, aluminiumOre: 4 }
  },
  {
    type: 'equipment_storage',
    category: 'storage',
    title: 'Coffre d’équipement',
    subtitle: '18 objets',
    icon: 'equipment_storage',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    itemCapacity: 18,
    role: 'Stocke armes, lance-roquettes et modules.',
    stats: ['Capacité : 18 objets'],
    cost: { ironOre: 18, copper: 10, aluminiumOre: 8 }
  },
  {
    type: 'solar_panel',
    category: 'power',
    title: 'Panneau solaire',
    subtitle: '+8 énergie',
    icon: 'solar_panel',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyOutput: 8,
    role: 'Produit une énergie stable sans carburant.',
    stats: ['Production : +8 énergie'],
    cost: { silicon: 12, copper: 8, aluminiumOre: 8 }
  },
  {
    type: 'fuel_generator',
    category: 'power',
    title: 'Générateur thermique',
    subtitle: '+34 énergie',
    icon: 'fuel_generator',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyOutput: 34,
    fuelCapacity: 80,
    role: 'Produit beaucoup d’énergie avec du carburant.',
    stats: ['Production : +34 énergie', 'Stock carburant : 80'],
    cost: { ironOre: 18, copper: 10, aluminiumOre: 8 }
  },
  {
    type: 'fuel_tank',
    category: 'power',
    title: 'Réservoir carburant',
    subtitle: '240 carburant',
    icon: 'fuel_tank',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    fuelCapacity: 240,
    role: 'Stocke le carburant de la base.',
    stats: ['Capacité : 240 carburant'],
    cost: { ironOre: 16, copper: 8, aluminiumOre: 8 }
  },

  {
    type: 'furnace',
    category: 'industry',
    title: 'Four basique',
    subtitle: '2 × 2 cases',
    icon: 'machine',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 4,
    role: 'Transforme les minerais communs.',
    stats: ['Consommation : 4 énergie'],
    cost: { ironOre: 18, copper: 4 }
  },
  {
    type: 'high_temp_furnace',
    category: 'industry',
    title: 'Four haute température',
    subtitle: '2 × 2 cases',
    icon: 'machine',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 9,
    role: 'Traite quartz, graphite et matériaux durs.',
    stats: ['Consommation : 9 énergie'],
    cost: { steelPlate: 4, copper: 8, aluminiumOre: 8 }
  },
  {
    type: 'chemical_refinery',
    category: 'industry',
    title: 'Raffinerie chimique',
    subtitle: '2 × 2 cases',
    icon: 'machine',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 6,
    role: 'Produit carburants et composants chimiques.',
    stats: ['Consommation : 6 énergie'],
    cost: { ironOre: 18, copper: 8, aluminiumOre: 6 }
  },
  {
    type: 'electrolyzer',
    category: 'industry',
    title: 'Électrolyseur',
    subtitle: '2 × 2 cases',
    icon: 'machine',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 8,
    role: 'Sépare et stabilise les volatils.',
    stats: ['Consommation : 8 énergie'],
    cost: { aluminiumOre: 14, copper: 10, silicon: 6 }
  },
  {
    type: 'electronics_bench',
    category: 'industry',
    title: 'Atelier électronique',
    subtitle: '2 × 2 cases',
    icon: 'machine',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 7,
    role: 'Produit wafers, transistors et circuits.',
    stats: ['Consommation : 7 énergie'],
    cost: { aluminiumOre: 12, copper: 12, silicon: 8 }
  },
  {
    type: 'industrial_press',
    category: 'industry',
    title: 'Presse industrielle',
    subtitle: '2 × 2 cases',
    icon: 'machine',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    energyUse: 10,
    role: 'Assemble pièces mécaniques et blindage.',
    stats: ['Consommation : 10 énergie'],
    cost: { steelPlate: 5, copper: 8, aluminiumOre: 8 }
  },
  {
    type: 'ammo_storage',
    category: 'storage',
    title: 'Coffre de roquettes',
    subtitle: '260 roquettes',
    icon: 'ammo_storage',
    orientation: 'h',
    tilesX: 2,
    tilesY: 2,
    w: 128,
    h: 128,
    hp: 0,
    ammoCapacity: 260,
    role: 'Stocke uniquement les roquettes.',
    stats: ['Capacité : 260 roquettes'],
    cost: { ironOre: 16, copper: 6, aluminiumOre: 6 }
  }
];

const BUILD_CATEGORIES = [
  { id: 'construction', label: 'Construction de base', icon: 'core' },
  { id: 'storage', label: 'Stockage', icon: 'storage' },
  { id: 'power', label: 'Énergie', icon: 'power' },
  { id: 'industry', label: 'Industrie', icon: 'machine' },
  { id: 'repair', label: 'Réparer', icon: 'repair' },
  { id: 'demolish', label: 'Démolition', icon: 'demolish' }
];

function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function structureDef(type) {
  return BUILD_STRUCTURES.find((s) => s.type === type) || null;
}

function formatCost(cost = {}) {
  const entries = Object.entries(cost || {}).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return 'Aucun coût';
  return entries.map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key] || key}`).join(' · ');
}

function orientedSize(def, orientation = 'h') {
  const vertical = (def.type === 'wall' || def.type === 'door') && orientation === 'v';
  return {
    w: vertical ? def.h : def.w,
    h: vertical ? def.w : def.h,
    tilesX: vertical ? def.tilesY : def.tilesX,
    tilesY: vertical ? def.tilesX : def.tilesY
  };
}

function snapFootprint(rawX, rawY, size, grid = BASE_TILE) {
  const left = Math.round(((Number(rawX) || 0) - size.w * 0.5) / grid) * grid;
  const top = Math.round(((Number(rawY) || 0) - size.h * 0.5) / grid) * grid;
  return { x: left + size.w * 0.5, y: top + size.h * 0.5 };
}

function rectFor(def, x, y, orientation = 'h') {
  const size = orientedSize(def, orientation);
  return { left: x - size.w * 0.5, right: x + size.w * 0.5, top: y - size.h * 0.5, bottom: y + size.h * 0.5, ...size };
}

function rectsOverlap(a, b, pad = 0) {
  const eps = 0.001;
  return a.left + pad < b.right - eps && a.right - pad > b.left + eps && a.top + pad < b.bottom - eps && a.bottom - pad > b.top + eps;
}

function entityRect(e) {
  const w = Number(e?.w) || (Number(e?.radius) || 0) * 2;
  const h = Number(e?.h) || (Number(e?.radius) || 0) * 2;
  return { left: (e?.x || 0) - w * 0.5, right: (e?.x || 0) + w * 0.5, top: (e?.y || 0) - h * 0.5, bottom: (e?.y || 0) + h * 0.5, w, h };
}

function sameSector(a, b) {
  return (a?.sx | 0) === (b?.sx | 0) && (a?.sy | 0) === (b?.sy | 0);
}

function claimRect(core) {
  const half = Math.max(1, Number(core?.claimRadius) || BASE_TILE * 8);
  return { left: (core?.x || 0) - half, right: (core?.x || 0) + half, top: (core?.y || 0) - half, bottom: (core?.y || 0) + half, w: half * 2, h: half * 2 };
}

function isRectInside(a, b) {
  const eps = 0.001;
  return a.left >= b.left - eps && a.right <= b.right + eps && a.top >= b.top - eps && a.bottom <= b.bottom + eps;
}

function sectorBuildRect() {
  return { left: -SECTOR_HALF + EDGE_RESERVE, right: SECTOR_HALF - EDGE_RESERVE, top: -SECTOR_HALF + EDGE_RESERVE, bottom: SECTOR_HALF - EDGE_RESERVE };
}

function findOwnCore(store, me, rect) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (st?.type !== 'base_core' || !st.owned || !sameSector(st, me)) continue;
    if (!isRectInside(rect, claimRect(st))) continue;
    const dx = (st.x || 0) - (rect.left + rect.right) * 0.5;
    const dy = (st.y || 0) - (rect.top + rect.bottom) * 0.5;
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
  const r = rectFor(def, x, y, orientation);
  const dist = Math.hypot(x - (me.x || 0), y - (me.y || 0));
  if (dist > BUILD_RANGE) return { ok: false, reason: 'Trop loin' };
  if (!isRectInside(r, sectorBuildRect())) return { ok: false, reason: 'Bord du secteur' };

  const ownCore = def.type === 'base_core' ? null : findOwnCore(store, me, r);
  if (def.type === 'base_core') {
    if (hasOwnCore(store)) return { ok: false, reason: 'Noyau déjà posé' };
    const claim = { left: x - (def.claimRadius || 0), right: x + (def.claimRadius || 0), top: y - (def.claimRadius || 0), bottom: y + (def.claimRadius || 0) };
    if (!isRectInside(claim, sectorBuildRect())) return { ok: false, reason: 'Zone trop proche du bord' };
  } else if (!ownCore) {
    return { ok: false, reason: 'Hors base' };
  }

  for (const st of store?.structures?.values?.() || []) {
    if (!sameSector(st, me)) continue;
    if (rectsOverlap(r, entityRect(st), 0)) return { ok: false, reason: 'Occupé' };
  }
  for (const a of store?.asteroids?.values?.() || []) {
    if (!sameSector(a, me)) continue;
    if (!a.solid && !a.bastionWall) continue;
    if (rectsOverlap(r, entityRect(a), 0)) return { ok: false, reason: 'Obstacle' };
  }
  for (const station of store?.stations?.values?.() || []) {
    if (!sameSector(station, me)) continue;
    const d = Math.hypot((station.x || 0) - x, (station.y || 0) - y);
    if (d < (station.radius || 80) + Math.max(r.w, r.h) * 0.5 + 80) return { ok: false, reason: 'Station proche' };
  }
  return { ok: true, reason: 'OK', ownCore };
}


function structureHealthRatio(st) {
  const hp = Number(st?.vitals?.hp ?? st?.stats?.hp ?? 0);
  const maxHp = Number(st?.vitals?.maxHp ?? st?.stats?.maxHp ?? 0);
  return { hp, maxHp, damaged: maxHp > 0 && hp > 0 && hp < maxHp };
}

function findRepairableStructureAt(store, me, x, y) {
  let best = null;
  let bestArea = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (!st?.owned || !sameSector(st, me)) continue;
    if (st.type === 'base_core') continue;
    const hp = structureHealthRatio(st);
    if (!hp.damaged) continue;
    const r = entityRect(st);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = Math.max(1, r.w * r.h);
    if (area < bestArea) { best = st; bestArea = area; }
  }
  return best;
}

function findOwnedStructureAt(store, me, x, y) {
  let best = null;
  let bestArea = Infinity;
  for (const st of store?.structures?.values?.() || []) {
    if (!st?.owned || !sameSector(st, me)) continue;
    const r = entityRect(st);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const area = Math.max(1, r.w * r.h);
    if (area < bestArea) { best = st; bestArea = area; }
  }
  return best;
}

export class BasePanelView {
  constructor(sendCmd, onPick = null) {
    this.sendCmd = sendCmd;
    this.onPick = typeof onPick === 'function' ? onPick : null;
    this.store = null;
    this.activeBuild = null;
    this.lastPreview = null;
    this.category = 'construction';
    this.hoveredType = null;
    this.el = document.createElement('div');
    this.el.className = 'base-panel';
    this.el.innerHTML = `
      <div class="base-panel__head">
        <div>
          <div class="base-panel__eyebrow">Construction</div>
          <div class="base-panel__title">Build</div>
        </div>
        <button class="base-panel__cancel" type="button" title="Annuler">×</button>
      </div>
      <div class="base-panel__body">
        <div class="base-panel__cats"></div>
        <div class="base-panel__content">
          <div class="base-panel__grid"></div>
          <div class="base-panel__status"></div>
        </div>
        <aside class="base-panel__details"></aside>
      </div>
    `;
    this.cats = this.el.querySelector('.base-panel__cats');
    this.grid = this.el.querySelector('.base-panel__grid');
    this.status = this.el.querySelector('.base-panel__status');
    this.details = this.el.querySelector('.base-panel__details');
    this.cancelBtn = this.el.querySelector('.base-panel__cancel');
    this.cats.innerHTML = BUILD_CATEGORIES.map((c) => `
      <button class="base-panel__cat ${c.disabled ? 'is-disabled' : ''}" data-category="${c.id}" title="${escapeHtml(c.disabled ? 'À venir' : c.label)}" ${c.disabled ? 'disabled' : ''}>
        ${iconSvg(c.icon)}<span>${escapeHtml(c.label)}</span>
      </button>
    `).join('');
    this.cats.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-category]');
      if (!btn || btn.disabled) return;
      this.category = btn.dataset.category;
      if (this.category === 'demolish') this.selectDemolish();
      else if (this.category === 'repair') this.selectRepair();
      else {
        this.hoveredType = null;
        this.refresh();
      }
    });
    this.grid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.select(btn.dataset.type);
    });
    this.grid.addEventListener('mouseover', (ev) => {
      const btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      this.hoveredType = btn.dataset.type;
      this.renderDetails();
    });
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.refresh();
  }

  select(type) {
    const def = structureDef(type);
    if (!def) return;
    const prev = this.activeBuild;
    const orientation = prev?.type === type ? prev.orientation : def.orientation;
    this.activeBuild = { mode: 'build', type, orientation };
    this.hoveredType = type;
    this.refresh();
    this.status.textContent = `${def.title} prêt`;
    this.onPick?.();
  }

  selectDemolish() {
    this.activeBuild = { mode: 'demolish' };
    this.refresh();
    this.status.textContent = 'Démolition active';
    this.onPick?.();
  }

  selectRepair() {
    this.activeBuild = { mode: 'repair' };
    this.refresh();
    this.status.textContent = 'Réparation active';
    this.onPick?.();
  }

  cancel() {
    this.activeBuild = null;
    this.lastPreview = null;
    this.refresh();
    this.status.textContent = '';
  }

  rotate() {
    if (!this.activeBuild || this.activeBuild.mode !== 'build') return false;
    const def = structureDef(this.activeBuild.type);
    if (!def?.rotatable) return false;
    this.activeBuild.orientation = this.activeBuild.orientation === 'v' ? 'h' : 'v';
    this.status.textContent = this.activeBuild.orientation === 'v' ? 'Vertical' : 'Horizontal';
    return true;
  }

  hasActivePlacement() {
    return !!this.activeBuild;
  }

  getDetailDef() {
    if (this.category === 'demolish' || this.category === 'repair') return null;
    return structureDef(this.hoveredType || this.activeBuild?.type) || BUILD_STRUCTURES.find((s) => s.category === this.category) || null;
  }

  renderDetails() {
    if (this.category === 'repair') {
      this.details.innerHTML = `
        <div class="base-panel__details-icon base-panel__details-icon--repair">${iconSvg('repair')}</div>
        <h3>Réparer</h3>
        <p>Répare une structure endommagée qui t’appartient. Le coût dépend du pourcentage de PV manquants.</p>
        <div class="base-panel__details-section"><strong>Noyau</strong><span>Non réparable : il se régénère seul.</span></div>`;
      return;
    }
    if (this.category === 'demolish') {
      this.details.innerHTML = `
        <div class="base-panel__details-icon base-panel__details-icon--danger">${iconSvg('demolish')}</div>
        <h3>Démolition</h3>
        <p>Retire une structure qui t’appartient. Les retours de matériaux seront ajoutés plus tard.</p>
        <div class="base-panel__details-section"><strong>Utilisation</strong><span>Clique une structure dans le monde.</span></div>`;
      return;
    }
    const def = this.getDetailDef();
    if (!def) {
      this.details.innerHTML = `<h3>À venir</h3><p>Cette catégorie sera remplie dans une prochaine update.</p>`;
      return;
    }
    const sections = [
      `<div class="base-panel__details-section"><strong>Taille</strong><span>${def.tilesX} × ${def.tilesY} cases</span></div>`
    ];
    if (def.storageCapacity) sections.push(`<div class="base-panel__details-section"><strong>Capacité</strong><span>${def.storageCapacity} unités</span></div>`);
    if (def.itemCapacity) sections.push(`<div class="base-panel__details-section"><strong>Capacité</strong><span>${def.itemCapacity} objets</span></div>`);
    if (def.ammoCapacity) sections.push(`<div class="base-panel__details-section"><strong>Capacité</strong><span>${def.ammoCapacity} roquettes</span></div>`);
    if (def.fuelCapacity) sections.push(`<div class="base-panel__details-section"><strong>Carburant</strong><span>${def.fuelCapacity} unités</span></div>`);
    if (def.energyOutput) sections.push(`<div class="base-panel__details-section"><strong>Énergie</strong><span>+${def.energyOutput}</span></div>`);
    if (def.hp) sections.push(`<div class="base-panel__details-section"><strong>Résistance</strong><span>${def.hp} PV</span></div>`);
    sections.push(`<div class="base-panel__details-section"><strong>Coût</strong><span>${escapeHtml(formatCost(def.cost))}</span></div>`);
    this.details.innerHTML = `
      <div class="base-panel__details-icon base-panel__details-icon--${escapeHtml(def.icon)}">${iconSvg(def.icon)}</div>
      <h3>${escapeHtml(def.title)}</h3>
      <p>${escapeHtml(def.role || def.subtitle || '')}</p>
      ${sections.join('')}`;
  }

  refresh() {
    const activeType = this.activeBuild?.type || '';
    const activeMode = this.activeBuild?.mode || '';
    for (const btn of this.cats.querySelectorAll('button[data-category]')) {
      btn.classList.toggle('is-active', btn.dataset.category === this.category || (activeMode === 'demolish' && btn.dataset.category === 'demolish') || (activeMode === 'repair' && btn.dataset.category === 'repair'));
    }
    if (this.category === 'repair') {
      this.grid.innerHTML = `
        <button class="base-panel__btn base-panel__btn--wide ${activeMode === 'repair' ? 'is-active' : ''}" data-repair="1" type="button">
          <span class="base-panel__icon">${iconSvg('repair')}</span>
          <span class="base-panel__meta"><strong>Réparer</strong><small>Structure endommagée</small></span>
        </button>`;
      this.grid.querySelector('[data-repair]')?.addEventListener('click', () => this.selectRepair());
    } else if (this.category === 'demolish') {
      this.grid.innerHTML = `
        <button class="base-panel__btn base-panel__btn--wide ${activeMode === 'demolish' ? 'is-active' : ''}" data-demolish="1" type="button">
          <span class="base-panel__icon">${iconSvg('demolish')}</span>
          <span class="base-panel__meta"><strong>Démolir</strong><small>Retirer une structure</small></span>
        </button>`;
      this.grid.querySelector('[data-demolish]')?.addEventListener('click', () => this.selectDemolish());
    } else {
      this.grid.innerHTML = BUILD_STRUCTURES
        .filter((s) => s.category === this.category)
        .map((s) => `
          <button class="base-panel__btn ${s.type === activeType ? 'is-active' : ''}" data-type="${s.type}" type="button">
            <span class="base-panel__icon base-panel__icon--${escapeHtml(s.icon)}">${iconSvg(s.icon)}</span>
            <span class="base-panel__meta">
              <strong>${escapeHtml(s.title)}</strong>
              <small>${escapeHtml(s.subtitle)}</small>
            </span>
          </button>
        `).join('');
    }
    this.cancelBtn.classList.toggle('is-visible', !!this.activeBuild);
    this.renderDetails();
  }

  getPreview(store, mouseWorld) {
    this.store = store || this.store;
    if (!this.activeBuild || !mouseWorld) return null;
    const me = this.store?.getMe?.();
    if (this.activeBuild.mode === 'repair') {
      const target = findRepairableStructureAt(this.store, me, mouseWorld.x, mouseWorld.y);
      const hp = structureHealthRatio(target);
      this.lastPreview = {
        mode: 'repair',
        targetId: target?.id || 0,
        type: target?.type || 'repair',
        title: target ? `Réparer ${target.name || 'structure'}` : 'Réparation',
        reason: target ? `${Math.ceil(hp.maxHp - hp.hp)} PV manquants` : 'Aucune structure endommagée',
        ok: !!target,
        x: target?.x ?? mouseWorld.x,
        y: target?.y ?? mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: target?.w || BASE_TILE,
        h: target?.h || BASE_TILE,
        tilesX: Math.max(1, Math.round((target?.w || BASE_TILE) / BASE_TILE)),
        tilesY: Math.max(1, Math.round((target?.h || BASE_TILE) / BASE_TILE)),
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    if (this.activeBuild.mode === 'demolish') {
      const target = findOwnedStructureAt(this.store, me, mouseWorld.x, mouseWorld.y);
      this.lastPreview = {
        mode: 'demolish',
        targetId: target?.id || 0,
        type: target?.type || 'demolish',
        title: target ? `Démolir ${target.name || 'structure'}` : 'Démolition',
        reason: target ? 'OK' : 'Aucune structure',
        ok: !!target,
        x: target?.x ?? mouseWorld.x,
        y: target?.y ?? mouseWorld.y,
        sx: me?.sx | 0,
        sy: me?.sy | 0,
        w: target?.w || BASE_TILE,
        h: target?.h || BASE_TILE,
        tilesX: Math.max(1, Math.round((target?.w || BASE_TILE) / BASE_TILE)),
        tilesY: Math.max(1, Math.round((target?.h || BASE_TILE) / BASE_TILE)),
        gridSize: BASE_TILE
      };
      return this.lastPreview;
    }
    const def = structureDef(this.activeBuild.type);
    if (!def) return null;
    const orientation = this.activeBuild.orientation || 'h';
    const size = orientedSize(def, orientation);
    const snapped = snapFootprint(mouseWorld.x, mouseWorld.y, size, BASE_TILE);
    const rect = rectFor(def, snapped.x, snapped.y, orientation);
    const validation = validatePreview(this.store, me, def, snapped.x, snapped.y, orientation);
    this.lastPreview = {
      mode: 'build',
      type: def.type,
      title: def.title,
      x: snapped.x,
      y: snapped.y,
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
      ownCore: validation.ownCore ? { x: validation.ownCore.x, y: validation.ownCore.y, claimRadius: validation.ownCore.claimRadius || BASE_TILE * 8 } : null
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
    if (preview.mode === 'repair') {
      this.sendCmd('repair_structure', { structureId: preview.targetId });
      this.status.textContent = 'Réparation envoyée';
      return true;
    }
    if (preview.mode === 'demolish') {
      this.sendCmd('remove_structure', { structureId: preview.targetId });
      this.status.textContent = 'Démolition envoyée';
      return true;
    }
    this.sendCmd('build_structure', { structureType: preview.type, orientation: preview.orientation, x: preview.x, y: preview.y });
    this.status.textContent = 'Placement envoyé';
    return true;
  }

  update(store) {
    this.store = store;
    if (this.activeBuild && this.lastPreview) {
      this.status.textContent = this.lastPreview.ok ? this.lastPreview.title : this.lastPreview.reason;
      return;
    }
    this.status.textContent = '';
  }
}
