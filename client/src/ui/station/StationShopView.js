import { formatCredits } from '../cargo/CargoFormat.js';
import { ITEM_CATEGORY_IDS, ITEM_CATEGORY_ORDER, getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { buildItemIconButton, renderItemSections, renderStationInfoSection, renderStationChips } from './StationItemVisuals.js';
import { StationCommandQueue } from './StationCommandQueue.js';

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
    this.shopCategoryOrder = ITEM_CATEGORY_ORDER.filter((categoryId) => categoryId !== ITEM_CATEGORY_IDS.AMMO);
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
    this.el.addEventListener('mouseover', (ev) => {
      const btn = ev.target?.closest?.('button[data-item-id]');
      if (!btn) return;
      this.hoverItemId = btn.dataset.itemId || '';
      this.renderDetails();
    });
    this.el.addEventListener('mouseout', (ev) => {
      const leavingItem = ev.target?.closest?.('button[data-item-id]');
      if (!leavingItem) return;
      const nextInsideItem = (ev.relatedTarget && typeof ev.relatedTarget.closest === 'function') ? ev.relatedTarget.closest('button[data-item-id]') : null;
      if (nextInsideItem) return;
      this.hoverItemId = '';
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
      const iconBtn = ev.target?.closest?.('button[data-item-id]');
      if (iconBtn) {
        this.selectedItemId = iconBtn.dataset.itemId || '';
        this.render();
      }
    });
    this.el.addEventListener('dblclick', (ev) => {
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
    const offers = sortItems(this.shop?.offers || []);
    return offers.filter((item) => item?.categoryId === this.activeCategory && item?.categoryId !== ITEM_CATEGORY_IDS.AMMO);
  }

  getFocusedItem() {
    const offers = this.shop?.offers || [];
    const key = this.hoverItemId || this.selectedItemId || this.getOffers()[0]?.itemId || '';
    return offers.find((item) => itemKeyOf(item) === key) || null;
  }

  renderCats() {
    this.catsEl.innerHTML = this.shopCategoryOrder.map((categoryId) => {
      const active = categoryId === this.activeCategory ? 'is-active' : '';
      return `<button class="station-shop__cat ${active}" type="button" data-cat="${categoryId}">${getItemCategoryName(categoryId)}</button>`;
    }).join('');
  }

  renderGrid() {
    const items = this.getOffers();
    this.gridEl.innerHTML = items.map((item) => {
      const selected = item.itemId === (this.hoverItemId || this.selectedItemId);
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
    const offers = this.shop?.offers || [];
    if (this.selectedItemId && !offers.some((item) => item.itemId === this.selectedItemId)) this.selectedItemId = '';
    if (this.hoverItemId && !offers.some((item) => item.itemId === this.hoverItemId)) this.hoverItemId = '';
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
