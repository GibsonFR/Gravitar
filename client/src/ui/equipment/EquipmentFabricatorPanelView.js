function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

const CATEGORY_ORDER = ['engine', 'weapon', 'launcher', 'defense', 'module'];
const CATEGORY_LABELS = {
  engine: 'Propulseurs',
  weapon: 'Armes',
  launcher: 'Lance-roquettes',
  defense: 'Boucliers',
  module: 'Modules'
};

const MODULE_FAMILY_LABELS = {
  cargo: 'Soute',
  damage: 'Dégâts',
  energy: 'Énergie',
  repair: 'Réparation',
  targeting: 'Ciblage'
};

function moduleFamily(recipe) {
  const id = String(recipe?.id || '');
  const m = id.match(/^fab_module_([^_]+)_mk\d+$/);
  return m ? m[1] : 'cargo';
}

function statLabel(key) {
  return ({
    enginePct: 'engine power',
    damageFlat: 'attack damage',
    damageMultPct: 'damage',
    rocketDamagePct: 'rocket damage',
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



function bufferRows(entries = [], structureId, slot = 'input') {
  if (!entries.length) return '<div class="equipment-fab__empty">Vide.</div>';
  return entries.map((r) => `
    <div class="equipment-fab__buffer-row">
      <span class="equipment-fab__dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span>
      <span>${escapeHtml(r.name)}</span>
      <b>${r.amount | 0}</b>
      <button type="button" data-equipment-fab-transfer="withdraw" data-key="${escapeHtml(r.key)}" data-amount="1" data-structure="${structureId | 0}">1</button>
      <button type="button" data-equipment-fab-transfer="withdraw" data-key="${escapeHtml(r.key)}" data-amount="all" data-structure="${structureId | 0}">Tout</button>
    </div>`).join('');
}

function cargoDepositRows(recipe, structureId) {
  const entries = recipe?.input || [];
  if (!entries.length) return '';
  return entries.map((r) => `
    <button type="button" class="equipment-fab__deposit ${r.have <= 0 ? 'is-empty' : ''}" data-equipment-fab-transfer="deposit" data-key="${escapeHtml(r.key)}" data-amount="all" data-structure="${structureId | 0}" ${r.have <= 0 ? 'disabled' : ''}>
      <span class="equipment-fab__dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span>
      ${escapeHtml(r.name)} <b>${r.stored | 0}/${r.amount | 0}</b>
    </button>`).join('');
}

function outputItemRows(items = [], structureId) {
  if (!items.length) return '<div class="equipment-fab__empty">Vide.</div>';
  return items.map((it) => `
    <div class="equipment-fab__output-item">
      <div><strong>${escapeHtml(it.name)}</strong><small>${escapeHtml(it.categoryName || '')} · Mk ${it.mark | 0}</small></div>
      <button type="button" data-equipment-fab-claim="${escapeHtml(it.itemId)}" data-structure="${structureId | 0}">Récupérer</button>
    </div>`).join('');
}

export class EquipmentFabricatorPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'equipment-fab equipment-fabricator';
    this.el.hidden = true;
    this.selectedRecipeId = '';
    this.category = 'engine';
    this.moduleFamily = 'cargo';
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
      const modFamily = ev.target.closest('[data-equipment-fab-module-family]');
      if (modFamily) {
        this.moduleFamily = modFamily.dataset.equipmentFabModuleFamily || this.moduleFamily;
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
      const transfer = ev.target.closest('[data-equipment-fab-transfer]');
      if (transfer) {
        this.sendCmd('equipment_fabricator_transfer', {
          structureId: transfer.dataset.structure | 0,
          resourceKey: transfer.dataset.key || '',
          direction: transfer.dataset.equipmentFabTransfer || 'deposit',
          amount: transfer.dataset.amount || '1'
        });
        ev.preventDefault();
        return;
      }
      const claim = ev.target.closest('[data-equipment-fab-claim]');
      if (claim) {
        this.sendCmd('equipment_fabricator_claim', {
          structureId: claim.dataset.structure | 0,
          itemId: claim.dataset.equipmentFabClaim || ''
        });
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
    let filtered = recipes.filter((r) => r.categoryId === this.category);
    const moduleFamilies = [...new Set(recipes.filter((r) => r.categoryId === 'module').map(moduleFamily))];
    if (this.category === 'module') {
      if (!moduleFamilies.includes(this.moduleFamily)) this.moduleFamily = moduleFamilies[0] || 'cargo';
      filtered = filtered.filter((r) => moduleFamily(r) === this.moduleFamily);
    }
    if (!filtered.some((r) => r.id === this.selectedRecipeId)) this.selectedRecipeId = filtered[0]?.id || '';
    const key = JSON.stringify({ data, selected: this.selectedRecipeId, category: this.category, moduleFamily: this.moduleFamily });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const selected = filtered.find((r) => r.id === this.selectedRecipeId) || null;

    const tabs = availableCategories.map((cat) => `
      <button type="button" class="equipment-fab__tab ${cat === this.category ? 'is-active' : ''}" data-equipment-fab-category="${escapeHtml(cat)}">${escapeHtml(CATEGORY_LABELS[cat] || cat)}</button>
    `).join('');

    const moduleSubtabs = this.category === 'module' ? `
      <div class="equipment-fab__subtabs">
        ${moduleFamilies.map((fam) => `<button type="button" class="equipment-fab__subtab ${fam === this.moduleFamily ? 'is-active' : ''}" data-equipment-fab-module-family="${escapeHtml(fam)}">${escapeHtml(MODULE_FAMILY_LABELS[fam] || fam)}</button>`).join('')}
      </div>
    ` : '';

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
      ${moduleSubtabs}
      <div class="equipment-fab__io-strip">
        <section>
          <h3>Input</h3>
          <div class="equipment-fab__cap">${data.inputUsed | 0}/${data.inputCapacity | 0}</div>
          ${bufferRows(data.input || [], data.id, 'input')}
        </section>
        <section>
          <h3>Output</h3>
          <div class="equipment-fab__cap">${data.outputUsed | 0}/${data.outputCapacity | 0}</div>
          ${outputItemRows(data.outputItems || [], data.id)}
        </section>
      </div>
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
                <span>${selected.locked ? 'Verrouillé' : !selected.outputFree ? 'Sortie pleine' : selected.canCraft ? 'Prêt' : 'Input'}</span>
              </div>
              <div class="equipment-fab__sub">Entrée requise</div>
              <div class="equipment-fab__resources">${resourceList(selected.input || [])}</div>
              <div class="equipment-fab__sub">Charger depuis le cargo</div>
              <div class="equipment-fab__deposit-grid">${cargoDepositRows(selected, data.id)}</div>
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
