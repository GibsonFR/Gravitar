import { formatCredits } from '../cargo/CargoFormat.js';
import { renderStationInfoSection, renderStationChips } from './StationItemVisuals.js';
import { StationCommandQueue } from './StationCommandQueue.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sortAmmoItems(items) {
  return [...(items || [])].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function ammoEffectLines(item) {
  const ammo = item?.ammoProfile || {};
  const lines = [];
  if (Number.isFinite(Number(ammo.damage))) lines.push(`${Math.round(Number(ammo.damage) || 0)} dégâts`);
  if (Number.isFinite(Number(ammo.radius))) lines.push(`${Math.round(Number(ammo.radius) || 0)} rayon`);
  if (Number.isFinite(Number(ammo.speed))) lines.push(`${Math.round(Number(ammo.speed) || 0)} vitesse`);
  if (ammo.effectType) {
    const duration = Number(ammo.effectDuration || 0);
    const magnitude = Number(ammo.effectMagnitude || 0);
    if (ammo.effectType === 'slow') lines.push(`Ralentissement ${Math.round(magnitude * 100)}% · ${duration.toFixed(1)}s`);
    else if (ammo.effectType === 'burn') lines.push(`Brûlure ${magnitude.toFixed(1)}/s · ${duration.toFixed(1)}s`);
    else if (ammo.effectType === 'stun') lines.push(`Étourdissement · ${duration.toFixed(1)}s`);
    else lines.push(ammo.summary || ammo.effectType);
  }
  return lines.filter(Boolean);
}

function ammoTooltip(item) {
  const lines = [];
  lines.push(`${item?.name || 'Roquettes'} [T${Math.max(1, item?.tier | 0)}]`);
  lines.push(`Pack : ${Math.max(1, item?.ammoQuantity | 0)} roquettes`);
  lines.push(...ammoEffectLines(item));
  return lines.join('\n');
}

export class StationAmmoView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.shop = null;
    this.inv = null;
    this.docked = false;
    this.selectedItemId = '';
    this.hoverItemId = '';

    this.el = document.createElement('div');
    this.el.className = 'station-ammo-market';
    this.el.innerHTML = `
      <section class="station-ammo-market__grid-panel">
        <div class="station-ammo-market__grid" data-role="grid"></div>
      </section>
      <aside class="station-ammo-market__details">
        <div class="station-ammo-market__head">
          <div>
            <div class="station-ammo-market__eyebrow">Marché munitions</div>
            <div class="station-ammo-market__title" data-role="title">Roquettes pirates</div>
          </div>
          <div class="station-ammo-market__credits" data-role="credits">—</div>
        </div>
        <div class="station-ammo-market__content" data-role="content"></div>
        <button class="ui-btn station-ammo-market__buy" type="button" data-role="buyBtn">Acheter le pack</button>
      </aside>
    `;

    this.gridEl = this.el.querySelector('[data-role="grid"]');
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.creditsEl = this.el.querySelector('[data-role="credits"]');
    this.contentEl = this.el.querySelector('[data-role="content"]');
    this.buyBtn = this.el.querySelector('[data-role="buyBtn"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('pointermove', (ev) => {
      const card = ev.target?.closest?.('[data-ammo-shop-id]');
      const next = card?.dataset?.ammoShopId || '';
      if (next === this.hoverItemId) return;
      this.hoverItemId = next;
      this.renderGrid();
      this.renderDetails();
    });
    this.el.addEventListener('pointerleave', () => {
      if (!this.hoverItemId) return;
      this.hoverItemId = '';
      this.renderGrid();
      this.renderDetails();
    });
    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const card = ev.target?.closest?.('[data-ammo-shop-id]');
      if (!card) return;
      ev.preventDefault();
      this.selectedItemId = card.dataset.ammoShopId || '';
      this.render();
    });
    this.el.addEventListener('dblclick', (ev) => {
      const card = ev.target?.closest?.('[data-ammo-shop-id]');
      if (!card) return;
      ev.preventDefault();
      this.selectedItemId = card.dataset.ammoShopId || '';
      this.buySelected();
    });
    this.buyBtn.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.buySelected();
    });
  }

  getShopItems() {
    return sortAmmoItems((this.shop?.offers || []).filter((item) => item?.categoryId === 'ammo'));
  }

  getFocusedItem() {
    const items = this.getShopItems();
    const key = this.selectedItemId || this.hoverItemId || items[0]?.itemId || '';
    return items.find((item) => item.itemId === key) || null;
  }

  renderAmmoCard(item, focused = false) {
    const locked = !!item.lockedByReputation;
    const canAfford = item.canAfford !== false && !locked;
    const stats = ammoEffectLines(item).slice(0, 3);
    return `
      <button type="button" class="station-ammo-pack ${focused ? 'is-selected' : ''} ${canAfford ? '' : 'is-unaffordable'} ${locked ? 'is-locked' : ''}" data-ammo-shop-id="${escapeHtml(item.itemId)}" title="${escapeHtml(ammoTooltip(item))}">
        <span class="station-ammo-pack__tier">T${Math.max(1, item.tier | 0)}</span>
        <span class="station-ammo-pack__glyph">☄</span>
        <span class="station-ammo-pack__name">${escapeHtml(item.shortName || item.name || 'Roquettes')}</span>
        <span class="station-ammo-pack__qty">Pack ×${Math.max(1, item.ammoQuantity | 0)}</span>
        <span class="station-ammo-pack__stats">${escapeHtml(stats.join(' • ') || 'Munition standard')}</span>
        <span class="station-ammo-pack__price">${locked ? `Réputation ${item.reputationRequired || 0}` : formatCredits(item.priceCredits || 0)}</span>
      </button>`;
  }

  renderGrid() {
    const items = this.getShopItems();
    const focusId = this.selectedItemId || this.hoverItemId || items[0]?.itemId || '';
    this.gridEl.innerHTML = items.map((item) => this.renderAmmoCard(item, item.itemId === focusId)).join('') || '<div class="station-equipment__empty">Aucune roquette proposée par cette station.</div>';
  }

  renderDetails() {
    const item = this.getFocusedItem();
    const credits = Math.max(0, this.inv?.credits | 0);
    this.creditsEl.textContent = `${formatCredits(credits)} crédits pirates`;
    if (!item) {
      this.titleEl.textContent = 'Roquettes pirates';
      this.contentEl.innerHTML = renderStationInfoSection('Achat', ['Choisis un pack de roquettes. Les roquettes achetées vont dans la soute et s’équipent depuis le panneau Vaisseau.']);
      this.buyBtn.disabled = true;
      this.buyBtn.textContent = 'Acheter le pack';
      return;
    }
    const locked = !!item.lockedByReputation;
    const canAfford = item.canAfford !== false && !locked;
    this.titleEl.textContent = item.name || 'Pack de roquettes';
    this.contentEl.innerHTML = [
      renderStationInfoSection('Pack', [
        `Quantité : ${Math.max(1, item.ammoQuantity | 0)} roquettes`,
        `Prix : ${formatCredits(item.priceCredits || 0)} crédits pirates`,
        locked ? `Réputation pirate niveau ${item.reputationRequired || 0} requise.` : canAfford ? 'Achat disponible.' : 'Crédits insuffisants.'
      ]),
      renderStationInfoSection('Stats', renderStationChips(ammoEffectLines(item), 'Aucune stat spéciale'))
    ].join('');
    this.buyBtn.disabled = !this.docked || !canAfford;
    this.buyBtn.textContent = locked ? `Réputation ${item.reputationRequired || 0} requise` : canAfford ? 'Acheter le pack' : 'Crédits insuffisants';
  }

  buySelected() {
    const item = this.getFocusedItem();
    if (!item || !this.sendCmd || !this.docked || item.canAfford === false || item.lockedByReputation) return;
    this.cmdQueue.send('buy_item', { itemId: item.itemId });
  }

  render() {
    const ids = new Set(this.getShopItems().map((item) => item.itemId));
    if (this.selectedItemId && !ids.has(this.selectedItemId)) this.selectedItemId = '';
    if (this.hoverItemId && !ids.has(this.hoverItemId)) this.hoverItemId = '';
    this.renderGrid();
    this.renderDetails();
  }

  update(equipment, shop, inv, docked) {
    this.shop = shop || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
}
