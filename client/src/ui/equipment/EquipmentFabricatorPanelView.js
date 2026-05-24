function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const CATEGORY_ORDER = ['engine', 'weapon', 'defense', 'module'];
const CATEGORY_LABELS = {
  engine: 'Propulseurs',
  weapon: 'Armes',
  defense: 'Boucliers',
  module: 'Modules'
};

function statLabel(key) {
  return ({
    enginePct: 'engine power',
    damageMultPct: 'damage',
    fireRatePct: 'fire rate',
    critChancePct: 'crit chance',
    critDamagePct: 'crit damage',
    armorPenFlat: 'armor pen',
    hpFlat: 'hull',
    shieldFlat: 'shield',
    armorFlat: 'armor',
    hpPct: 'hull',
    hullRegenFlat: 'repair',
    energyRegenFlat: 'energy regen',
    energyFlat: 'energy',
    cooldownReductionPct: 'cooldown',
    cargoFlat: 'cargo'
  })[key] || key;
}

function formatStat(key, value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? '+' : '';
  if (String(key).endsWith('Pct')) return `${sign}${Math.round(n * 100)}% ${statLabel(key)}`;
  if (Math.abs(n) < 1 && !String(key).endsWith('Flat')) return `${sign}${Math.round(n * 100)}% ${statLabel(key)}`;
  return `${sign}${Math.round(n * 10) / 10} ${statLabel(key)}`;
}

function resourceList(entries = []) {
  if (!entries.length) return '<span class="equipment-fab__muted">Aucun</span>';
  return entries.map((r) => `<span class="equipment-fab__res ${r.missing > 0 ? 'is-missing' : ''}" style="--res:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)} ×${r.amount | 0}<em>${r.have | 0}</em></span>`).join('');
}

function bonusList(bonuses = {}) {
  const entries = Object.entries(bonuses || {}).filter(([, v]) => Number(v) !== 0);
  if (!entries.length) return '<span class="equipment-fab__muted">Base</span>';
  return entries.map(([key, value]) => `<span>${escapeHtml(formatStat(key, value))}</span>`).join('');
}

export class EquipmentFabricatorPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'equipment-fab equipment-fabricator';
    this.el.hidden = true;
    this.selectedRecipeId = '';
    this.category = 'engine';
    this.lastKey = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-equipment-fab-close]');
      if (close) {
        this.sendCmd('equipment_fabricator_close', {});
        this.el.hidden = true;
        ev.preventDefault();
        return;
      }
      const category = ev.target.closest('[data-equipment-fab-category]');
      if (category) {
        this.category = category.dataset.equipmentFabCategory || this.category;
        this.selectedRecipeId = '';
        this.lastKey = '';
        this.update(this.store);
        ev.preventDefault();
        return;
      }
      const select = ev.target.closest('[data-equipment-fab-select]');
      if (select) {
        this.selectedRecipeId = select.dataset.equipmentFabSelect || '';
        this.lastKey = '';
        this.update(this.store);
        ev.preventDefault();
        return;
      }
      const craft = ev.target.closest('[data-equipment-fab-craft]');
      if (craft) {
        this.sendCmd('equipment_fabricator_craft', {
          structureId: craft.dataset.structure | 0,
          recipeId: craft.dataset.equipmentFabCraft || ''
        });
        ev.preventDefault();
      }
    });
  }

  update(store) {
    this.store = store;
    const data = store.myState?.equipmentFabricator || null;
    if (!data) {
      this.el.hidden = true;
      this.lastKey = '';
      return;
    }
    const recipes = data.recipes || [];
    const availableCategories = CATEGORY_ORDER.filter((cat) => recipes.some((r) => r.categoryId === cat));
    if (!availableCategories.includes(this.category)) this.category = availableCategories[0] || 'engine';
    const filtered = recipes.filter((r) => r.categoryId === this.category);
    if (!filtered.some((r) => r.id === this.selectedRecipeId)) this.selectedRecipeId = filtered[0]?.id || '';
    const key = JSON.stringify({ data, selected: this.selectedRecipeId, category: this.category });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const selected = filtered.find((r) => r.id === this.selectedRecipeId) || null;

    const tabs = availableCategories.map((cat) => `
      <button type="button" class="equipment-fab__tab ${cat === this.category ? 'is-active' : ''}" data-equipment-fab-category="${escapeHtml(cat)}">${escapeHtml(CATEGORY_LABELS[cat] || cat)}</button>
    `).join('');

    const list = filtered.map((r) => `
      <button type="button" class="equipment-fab__recipe ${r.id === this.selectedRecipeId ? 'is-selected' : ''} ${r.locked ? 'is-locked' : ''}" data-equipment-fab-select="${escapeHtml(r.id)}">
        <strong>${escapeHtml(r.name)}</strong>
        <small>Mk ${r.mark | 0} · ${r.seconds | 0}s${r.locked ? ` · ${escapeHtml(r.requiredResearchName || '')}` : ''}</small>
      </button>
    `).join('');

    this.el.innerHTML = `
      <div class="equipment-fab__head">
        <div>
          <div class="equipment-fab__eyebrow">Industrie</div>
          <div class="equipment-fab__title">${escapeHtml(data.name || 'Atelier d’équipement')}</div>
          <div class="equipment-fab__meta">${data.powered ? 'Alimenté' : 'Sans énergie'}</div>
        </div>
        <button type="button" class="equipment-fab__close" data-equipment-fab-close="1">×</button>
      </div>
      <div class="equipment-fab__tabs">${tabs}</div>
      <div class="equipment-fab__machine-layout">
        <section>
          <h3>Recettes</h3>
          <div class="equipment-fab__recipe-list">${list}</div>
        </section>
        <section>
          <h3>Production</h3>
          ${selected ? `
            <div class="equipment-fab__selected">
              <div class="equipment-fab__card-top">
                <div>
                  <strong>${escapeHtml(selected.name)}</strong>
                  <small>Mark ${selected.mark | 0}</small>
                </div>
                <span>${selected.locked ? 'Verrouillé' : selected.canCraft ? 'Prêt' : 'Ressources'}</span>
              </div>
              <div class="equipment-fab__sub">Entrée</div>
              <div class="equipment-fab__resources">${resourceList(selected.input || [])}</div>
              <div class="equipment-fab__sub">Base</div>
              <div class="equipment-fab__bonus">${bonusList(selected.baseBonuses || {})}</div>
              ${selected.locked ? `<div class="equipment-fab__lock">Requiert : ${escapeHtml(selected.requiredResearchName || selected.requiredResearchId || 'recherche')}</div>` : ''}
              <button type="button" data-equipment-fab-craft="${escapeHtml(selected.id)}" data-structure="${data.id | 0}" ${selected.canCraft ? '' : 'disabled'}>Fabriquer</button>
            </div>` : '<div class="equipment-fab__muted">Aucune recette</div>'}
        </section>
      </div>
    `;
  }
}
