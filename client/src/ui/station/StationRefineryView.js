import { REFINERY_RECIPES } from '../../../../shared/content/crafting/RefineryRecipes.js';
import { RESOURCE_DEFS } from '../../../../shared/content/resources/ResourceDefs.js';
import { formatInt } from '../cargo/CargoFormat.js';
import { StationCommandQueue } from './StationCommandQueue.js';

function invAmount(inv, key) {
  const row = (inv?.resources || []).find((entry) => entry.key === key);
  return Math.max(0, row?.amount || 0);
}

function resourceName(key) {
  return RESOURCE_DEFS[key]?.name || key;
}

function resourceColor(key) {
  return RESOURCE_DEFS[key]?.colorHex || '#d0d7e4';
}

function formatCostMap(map, inv, cycles = 1) {
  return Object.entries(map || {}).map(([key, amount]) => {
    const need = Math.max(0, amount | 0) * cycles;
    const have = invAmount(inv, key);
    const ok = have >= need;
    return `
      <div class="station-shop__recipe-line" style="color:${ok ? '#cfe8bf' : '#f0b8b0'}">
        ${resourceName(key)} : ${formatInt(need)} • stock ${formatInt(have)}${ok ? '' : ` • manque ${formatInt(need - have)}`}
      </div>
    `;
  }).join('');
}

function formatOutputMap(map, cycles = 1) {
  return Object.entries(map || {}).map(([key, amount]) => {
    const out = Math.max(0, amount | 0) * cycles;
    return `
      <div class="station-shop__recipe-line" style="color:#bfe5ff">
        ${resourceName(key)} : +${formatInt(out)}
      </div>
    `;
  }).join('');
}

function canRunRecipe(recipe, inv, cycles) {
  for (const [key, amount] of Object.entries(recipe?.input || {})) {
    if (invAmount(inv, key) < Math.max(0, amount | 0) * cycles) return false;
  }
  return true;
}

export class StationRefineryView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.selectedRecipeId = REFINERY_RECIPES[0]?.id || '';
    this.cycles = 1;
    this.inv = null;
    this.docked = false;

    this.el = document.createElement('div');
    this.el.className = 'station-shop station-refinery';
    this.el.innerHTML = `
      <div class="station-shop__body">
        <section class="station-shop__grid-panel">
          <div class="station-shop__grid" data-role="grid"></div>
        </section>
        <aside class="station-shop__details">
          <div class="station-shop__details-head">
            <div class="station-shop__details-title" data-role="title">Raffinage industriel</div>
            <div class="station-shop__details-meta" data-role="meta">Recettes V1</div>
          </div>
          <div class="station-shop__details-content" data-role="content"></div>
          <div class="station-shop__footer">
            <button class="ui-btn ui-btn--ghost" type="button" data-cycle="1">x1</button>
            <button class="ui-btn ui-btn--ghost" type="button" data-cycle="5">x5</button>
            <button class="ui-btn ui-btn--ghost" type="button" data-cycle="10">x10</button>
            <button class="ui-btn" type="button" data-role="actionBtn">Raffiner</button>
          </div>
        </aside>
      </div>
    `;

    this.gridEl = this.el.querySelector('[data-role="grid"]');
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.metaEl = this.el.querySelector('[data-role="meta"]');
    this.contentEl = this.el.querySelector('[data-role="content"]');
    this.actionBtn = this.el.querySelector('[data-role="actionBtn"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const recipeBtn = ev.target?.closest?.('button[data-recipe-id]');
      if (recipeBtn) {
        this.selectedRecipeId = recipeBtn.dataset.recipeId || this.selectedRecipeId;
        this.render();
        return;
      }
      const cycleBtn = ev.target?.closest?.('button[data-cycle]');
      if (cycleBtn) {
        this.cycles = Math.max(1, Math.min(25, Number(cycleBtn.dataset.cycle) || 1));
        this.render();
        return;
      }
      const actionBtn = ev.target?.closest?.('button[data-role="actionBtn"]');
      if (actionBtn && !actionBtn.disabled) {
        ev.preventDefault();
        this.refine();
      }
    });
    this.el.addEventListener('dblclick', (ev) => {
      const recipeBtn = ev.target?.closest?.('button[data-recipe-id]');
      if (!recipeBtn) return;
      this.selectedRecipeId = recipeBtn.dataset.recipeId || this.selectedRecipeId;
      this.refine();
    });
  }

  getRecipe() {
    return REFINERY_RECIPES.find((r) => r.id === this.selectedRecipeId) || REFINERY_RECIPES[0] || null;
  }

  refine() {
    const recipe = this.getRecipe();
    if (!recipe || !this.docked || !this.sendCmd) return;
    this.cmdQueue.send('refine_resource', { recipeId: recipe.id, cycles: this.cycles });
  }

  update(inv, docked) {
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }

  render() {
    const inv = this.inv || { resources: [] };
    const cycles = Math.max(1, this.cycles | 0);
    const groups = new Map();
    for (const recipe of REFINERY_RECIPES) {
      const arr = groups.get(recipe.category) || [];
      arr.push(recipe);
      groups.set(recipe.category, arr);
    }

    this.gridEl.innerHTML = [...groups.entries()].map(([category, recipes]) => `
      <div class="station-shop__section">
        <div class="station-shop__section-title">${category}</div>
        <div class="station-shop__items">
          ${recipes.map((recipe) => {
            const selected = recipe.id === this.selectedRecipeId;
            const ok = canRunRecipe(recipe, inv, cycles);
            const outKey = Object.keys(recipe.output || {})[0] || '';
            return `
              <button class="station-item-btn ${selected ? 'is-selected' : ''} ${ok ? 'is-affordable' : ''}" type="button" data-recipe-id="${recipe.id}" title="${recipe.name}">
                <span class="station-item-btn__icon" style="background:${resourceColor(outKey)}; box-shadow:0 0 18px ${resourceColor(outKey)}66"></span>
                <span class="station-item-btn__name">${recipe.name}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    const recipe = this.getRecipe();
    if (!recipe) {
      this.contentEl.innerHTML = '<div class="station-shop__empty">Aucune recette.</div>';
      this.actionBtn.disabled = true;
      return;
    }

    const ok = canRunRecipe(recipe, inv, cycles);
    this.titleEl.textContent = recipe.name;
    this.metaEl.textContent = `${recipe.station} • ${recipe.seconds}s / cycle`;
    this.contentEl.innerHTML = `
      <div class="station-shop__info-block">
        <div class="station-shop__info-title">Entrée x${cycles}</div>
        ${formatCostMap(recipe.input, inv, cycles)}
      </div>
      <div class="station-shop__info-block">
        <div class="station-shop__info-title">Sortie</div>
        ${formatOutputMap(recipe.output, cycles)}
      </div>
      <div class="station-shop__info-block">
        <div class="station-shop__info-title">Logique industrielle</div>
        <div class="station-shop__recipe-line">${recipe.description || ''}</div>
      </div>
    `;
    this.actionBtn.disabled = !this.docked || !ok;
    this.actionBtn.textContent = ok ? `Raffiner x${cycles}` : 'Ressources insuffisantes';

    for (const btn of this.el.querySelectorAll('button[data-cycle]')) {
      btn.classList.toggle('is-active', Number(btn.dataset.cycle) === cycles);
    }
  }
}
