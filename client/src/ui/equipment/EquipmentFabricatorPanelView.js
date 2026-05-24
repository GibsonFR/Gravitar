function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function resourceList(entries = []) {
  if (!entries.length) return '<span class="equipment-fab__muted">Aucun</span>';
  return entries.map((r) => `<span class="equipment-fab__res ${r.missing > 0 ? 'is-missing' : ''}" style="--res:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)} ×${r.amount | 0}<em>${r.have | 0}</em></span>`).join('');
}

function bonusList(bonuses = {}) {
  const entries = Object.entries(bonuses || {}).filter(([, v]) => Number(v) !== 0);
  if (!entries.length) return '<span class="equipment-fab__muted">Base</span>';
  return entries.map(([key, value]) => `<span>${escapeHtml(key)} ${Number(value) > 0 ? '+' : ''}${Math.round(Number(value) * 1000) / 10}${Math.abs(Number(value)) < 1 ? '%' : ''}</span>`).join('');
}

export class EquipmentFabricatorPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'equipment-fab equipment-fabricator';
    this.el.hidden = true;
    this.selectedRecipeId = '';
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
    if (!recipes.some((r) => r.id === this.selectedRecipeId)) this.selectedRecipeId = recipes[0]?.id || '';
    const key = JSON.stringify({ data, selected: this.selectedRecipeId });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const selected = recipes.find((r) => r.id === this.selectedRecipeId) || null;
    const list = recipes.map((r) => `
      <button type="button" class="equipment-fab__recipe ${r.id === this.selectedRecipeId ? 'is-selected' : ''} ${r.locked ? 'is-locked' : ''}" data-equipment-fab-select="${escapeHtml(r.id)}">
        <strong>${escapeHtml(r.name)}</strong>
        <small>${escapeHtml(r.categoryName)} · Mk ${r.mark | 0} · ${r.seconds | 0}s</small>
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
                  <small>${escapeHtml(selected.categoryName)} · Mark ${selected.mark | 0}</small>
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
