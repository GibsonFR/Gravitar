import { formatCredits } from '../cargo/CargoFormat.js';
import { ITEM_CATEGORY_IDS, ITEM_CATEGORY_ORDER, getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { buildItemIconButton, renderItemSections, renderStationInfoSection, renderStationChips } from './StationItemVisuals.js';
import { StationCommandQueue } from './StationCommandQueue.js';

const CONVERSION_RECIPE_CATEGORY = 'conversion_recipes';

function itemKeyOf(item) {
  return String(item?.itemId || '');
}

function renderResourceCosts(item) {
  const costs = item?.resourceCosts || [];
  if (!costs.length) return '<div class="station-shop__recipe-line">Aucun coût matière.</div>';
  return costs.map((entry) => {
    const affordable = !!entry.affordable;
    const state = affordable ? 'ok' : `manque ${Math.max(0, entry.missing | 0)}`;
    return `<div class="station-shop__recipe-line" style="color:${affordable ? '#cfe8bf' : '#f0b8b0'}">${entry.name} : ${Math.max(0, entry.amount | 0)} • stock ${Math.max(0, entry.have | 0)} • ${state}</div>`;
  }).join('');
}

function renderRecipeList(entries = []) {
  if (!entries.length) return '<span class="station-shop__muted">—</span>';
  return entries.map((entry) => `${entry.name} ×${entry.amount}`).join(', ');
}

function compactRecipeList(entries = []) {
  if (!entries.length) return '—';
  return entries
    .slice(0, 2)
    .map((entry) => `${entry.amount} ${entry.shortName || entry.name || '?'}`)
    .join(' • ');
}

function recipeStatusLine(recipe) {
  if (recipe.owned) return 'Débloquée';
  if (recipe.lockedByReputation) return `Réputation ${recipe.reputationRequired || 0}`;
  return 'À acheter';
}

function recipeButton(recipe, selected = false) {
  const locked = recipe.lockedByReputation || false;
  const owned = recipe.owned || false;
  const cls = ['station-recipe-card', selected ? 'is-selected' : '', locked ? 'is-locked' : '', owned ? 'is-owned' : ''].filter(Boolean).join(' ');
  const summaryIn = compactRecipeList(recipe.input || []);
  const summaryOut = compactRecipeList(recipe.output || []);
  const tooltip = [
    recipe.name || 'Recette',
    `Entrée : ${renderRecipeList(recipe.input || []).replace(/<[^>]*>/g, '')}`,
    `Sortie : ${renderRecipeList(recipe.output || []).replace(/<[^>]*>/g, '')}`,
    `Durée : ${Math.max(0, recipe.seconds | 0)}s`,
    `Énergie : ${Math.max(0, recipe.energyUse | 0)}`,
    recipeStatusLine(recipe)
  ].join('\n');
  return `<button type="button" class="${cls}" data-recipe-id="${recipe.recipeId}" title="${escapeHtml(tooltip)}">
    <span class="station-recipe-card__tier">T${Math.max(1, recipe.tier | 0)}</span>
    <span class="station-recipe-card__glyph">⇄</span>
    <span class="station-recipe-card__name">${escapeHtml(recipe.name)}</span>
    <span class="station-recipe-card__io"><strong>IN</strong> ${escapeHtml(summaryIn)}</span>
    <span class="station-recipe-card__io"><strong>OUT</strong> ${escapeHtml(summaryOut)}</span>
    <span class="station-recipe-card__meta">${escapeHtml(recipeStatusLine(recipe))}</span>
  </button>`;
}

function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function getStockLines(shop) {
  if (!shop) return [];
  const pool = shop.localResourcePool || {};
  const current = (pool.currentSectorKeys || []).slice(0, 4);
  const nearby = (pool.resourceKeys || []).filter((key) => !current.includes(key)).slice(0, 4);
  return [
    `Palier station : T${Math.max(1, shop.tierGate | 0)}`,
    `Secteur : ${current.length ? current.join(', ') : 'aucune'}`,
    `Voisinage : ${nearby.length ? nearby.join(', ') : 'aucune'}`
  ];
}

function sortItems(items) {
  return [...(items || [])].sort((a, b) => {
    const ac = ITEM_CATEGORY_ORDER.indexOf(a?.categoryId);
    const bc = ITEM_CATEGORY_ORDER.indexOf(b?.categoryId);
    if (ac !== bc) return ac - bc;
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

export class StationShopView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.shopCategoryOrder = [CONVERSION_RECIPE_CATEGORY, ...ITEM_CATEGORY_ORDER.filter((categoryId) => categoryId !== ITEM_CATEGORY_IDS.AMMO && categoryId !== ITEM_CATEGORY_IDS.CONVERTER)];
    this.activeCategory = this.shopCategoryOrder[0];
    this.selectedItemId = '';
    this.hoverItemId = '';
    this.shop = null;
    this.inv = null;
    this.docked = false;

    this.el = document.createElement('div');
    this.el.className = 'station-shop';
    this.el.innerHTML = `
      <div class="station-shop__cats" data-role="cats"></div>
      <div class="station-shop__body">
        <section class="station-shop__grid-panel">
          <div class="station-shop__grid" data-role="grid"></div>
        </section>
        <aside class="station-shop__details">
          <div class="station-shop__details-head">
            <div class="station-shop__details-title" data-role="title">Boutique</div>
            <div class="station-shop__details-meta" data-role="meta">—</div>
          </div>
          <div class="station-shop__details-content" data-role="content"></div>
          <div class="station-shop__footer">
            <button class="ui-btn" type="button" data-role="actionBtn">Acheter</button>
          </div>
        </aside>
      </div>
    `;

    this.catsEl = this.el.querySelector('[data-role="cats"]');
    this.gridEl = this.el.querySelector('[data-role="grid"]');
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.metaEl = this.el.querySelector('[data-role="meta"]');
    this.contentEl = this.el.querySelector('[data-role="content"]');
    this.actionBtn = this.el.querySelector('[data-role="actionBtn"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('pointermove', (ev) => {
      const recipeBtn = ev.target?.closest?.('button[data-recipe-id]');
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      const hoveredKey = recipeBtn?.dataset?.recipeId || itemBtn?.dataset?.itemId || '';
      if (hoveredKey !== this.hoverItemId) {
        this.hoverItemId = hoveredKey;
        this.renderGrid();
        this.renderDetails();
      }
    });
    this.el.addEventListener('pointerleave', () => {
      if (!this.hoverItemId) return;
      this.hoverItemId = '';
      this.renderGrid();
      this.renderDetails();
    });

    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const tabBtn = ev.target?.closest?.('button[data-cat]');
      if (tabBtn) {
        this.activeCategory = tabBtn.dataset.cat || this.shopCategoryOrder[0];
        this.selectedItemId = '';
        this.render();
        return;
      }
      const recipeBtn = ev.target?.closest?.('button[data-recipe-id]');
      if (recipeBtn) {
        this.selectedItemId = recipeBtn.dataset.recipeId || '';
        this.render();
        return;
      }
      const iconBtn = ev.target?.closest?.('button[data-item-id]');
      if (iconBtn) {
        this.selectedItemId = iconBtn.dataset.itemId || '';
        this.render();
      }
    });
    this.el.addEventListener('dblclick', (ev) => {
      const recipeBtn = ev.target?.closest?.('button[data-recipe-id]');
      if (recipeBtn) {
        this.selectedItemId = recipeBtn.dataset.recipeId || '';
        this.triggerAction();
        return;
      }
      const iconBtn = ev.target?.closest?.('button[data-item-id]');
      if (!iconBtn) return;
      this.selectedItemId = iconBtn.dataset.itemId || '';
      this.triggerAction();
    });
    this.actionBtn.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.triggerAction();
    });
  }

  getOffers() {
    if (this.activeCategory === CONVERSION_RECIPE_CATEGORY) return this.shop?.conversionRecipes || [];
    const offers = sortItems(this.shop?.offers || []);
    return offers.filter((item) => item?.categoryId === this.activeCategory && item?.categoryId !== ITEM_CATEGORY_IDS.AMMO && item?.categoryId !== ITEM_CATEGORY_IDS.CONVERTER);
  }

  getFocusedItem() {
    if (this.activeCategory === CONVERSION_RECIPE_CATEGORY) {
      const recipes = this.shop?.conversionRecipes || [];
      const key = this.selectedItemId || this.hoverItemId || recipes[0]?.recipeId || '';
      return recipes.find((recipe) => String(recipe.recipeId || '') === key) || null;
    }
    const offers = this.shop?.offers || [];
    const key = this.selectedItemId || this.hoverItemId || this.getOffers()[0]?.itemId || '';
    return offers.find((item) => itemKeyOf(item) === key) || null;
  }

  renderCats() {
    this.catsEl.innerHTML = this.shopCategoryOrder.map((categoryId) => {
      const active = categoryId === this.activeCategory ? 'is-active' : '';
      const label = categoryId === CONVERSION_RECIPE_CATEGORY ? 'Recettes' : getItemCategoryName(categoryId);
      return `<button class="station-shop__cat ${active}" type="button" data-cat="${categoryId}">${label}</button>`;
    }).join('');
  }

  renderGrid() {
    const items = this.getOffers();
    const isRecipeGrid = this.activeCategory === CONVERSION_RECIPE_CATEGORY;
    this.gridEl.classList.toggle('is-recipes', isRecipeGrid);
    if (isRecipeGrid) {
      const focusId = this.selectedItemId || this.hoverItemId || items[0]?.recipeId || '';
      this.gridEl.innerHTML = items.map((recipe) => recipeButton(recipe, recipe.recipeId === focusId)).join('') || '<div class="station-shop__empty">Aucune recette pirate proposée.</div>';
      return;
    }
    const focusId = this.selectedItemId || this.hoverItemId || items[0]?.itemId || '';
    this.gridEl.innerHTML = items.map((item) => {
      const selected = item.itemId === focusId;
      return buildItemIconButton(item, { selected, showName: false, compact: true });
    }).join('') || '<div class="station-shop__empty">Aucun item proposé dans cette catégorie.</div>';
  }

  renderDetails() {
    const item = this.getFocusedItem();
    if (!item) {
      this.titleEl.textContent = 'Boutique';
      this.metaEl.textContent = 'Sélectionnez un item';
      this.contentEl.innerHTML = [
        renderStationInfoSection('Station', getStockLines(this.shop)),
        renderStationInfoSection('Détails item', '', { emptyText: 'Aucun item sélectionné' })
      ].join('');
      this.actionBtn.disabled = true;
      this.actionBtn.textContent = 'Acheter';
      return;
    }

    const credits = Math.max(0, this.inv?.credits | 0);
    if (this.activeCategory === CONVERSION_RECIPE_CATEGORY) {
      this.titleEl.textContent = `${item.name || 'Recette'} [T${Math.max(1, item.tier | 0)}]`;
      this.metaEl.textContent = item.owned ? 'Recette déjà débloquée' : `${formatCredits(item.priceCredits || 0)} / ${formatCredits(credits)} crédits pirates`;
      const status = item.owned ? 'Débloquée' : (item.lockedByReputation ? `Réputation pirate ${item.reputationRequired} requise` : 'Disponible en station pirate');
      this.contentEl.innerHTML = [
        renderStationInfoSection('Recette de conversion', [
          `État : ${status}`,
          `Durée : ${item.seconds | 0}s`,
          `Énergie : ${item.energyUse | 0}`,
          'Déblocage permanent pour tes convertisseurs industriels.'
        ]),
        renderStationInfoSection('Entrée', renderStationChips((item.input || []).map((entry) => `${entry.name} ×${entry.amount}`), 'Aucune ressource')),
        renderStationInfoSection('Sortie', renderStationChips((item.output || []).map((entry) => `${entry.name} ×${entry.amount}`), 'Aucune ressource'))
      ].join('');
      this.actionBtn.disabled = !this.docked || item.owned || item.lockedByReputation || !item.canAfford;
      this.actionBtn.textContent = item.owned ? 'Déjà achetée' : 'Acheter recette';
      return;
    }
    const isAmmo = item.categoryId === ITEM_CATEGORY_IDS.AMMO;
    const status = isAmmo
      ? `${Math.max(0, item.ammoQuantity | 0)} en soute${item.assignedRocketSlots?.length ? ` • slot ${item.assignedRocketSlots.map((slot) => slot + 1).join('/')}` : ''}`
      : item.equipped ? 'équipé' : item.owned ? 'possédé' : 'à acheter';
    this.titleEl.textContent = `${item.name || 'Item'} [T${Math.max(1, item.tier | 0)}]`;
    this.metaEl.textContent = `${formatCredits(item.priceCredits || 0)} / ${formatCredits(credits)} crédits`;
    this.contentEl.innerHTML = [
      renderItemSections(item, {
        status: `État : ${status}`,
        source: `${item.categoryName || ''}`
      }),
      renderStationInfoSection('Coûts matières', renderResourceCosts(item))
    ].join('');

    const needsPurchase = isAmmo || (!item.owned && !item.equipped);
    this.actionBtn.disabled = !this.docked || (needsPurchase && !item.canAfford);
    this.actionBtn.textContent = isAmmo ? 'Acheter pack' : item.equipped ? 'Retirer' : item.owned ? 'Équiper' : 'Acheter';
  }

  triggerAction() {
    const item = this.getFocusedItem();
    if (!item || !this.sendCmd) return;
    if (this.activeCategory === CONVERSION_RECIPE_CATEGORY) {
      if (!item.owned && !item.lockedByReputation && item.canAfford) this.cmdQueue.send('buy_conversion_recipe', { recipeId: item.recipeId });
      return;
    }
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      this.cmdQueue.send('buy_item', { itemId: item.itemId });
      return;
    }
    if (item.equipped) this.cmdQueue.send('unequip_item', { itemId: item.itemId });
    else if (item.owned) this.cmdQueue.send('equip_item', { itemId: item.itemId });
    else this.cmdQueue.send('buy_item', { itemId: item.itemId });
  }

  render() {
    if (!this.shopCategoryOrder.includes(this.activeCategory)) this.activeCategory = this.shopCategoryOrder[0];
    const offers = this.activeCategory === CONVERSION_RECIPE_CATEGORY ? (this.shop?.conversionRecipes || []) : (this.shop?.offers || []);
    if (this.selectedItemId && !offers.some((item) => (item.itemId || item.recipeId) === this.selectedItemId)) this.selectedItemId = '';
    this.renderCats();
    this.renderGrid();
    this.renderDetails();
  }

  update(shop, inv, docked) {
    this.shop = shop || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
}
