import { formatCredits } from '../cargo/CargoFormat.js';
import { buildItemIconButton, buildItemIconMarkup, getItemMetaText, getItemTagText, renderItemSections, renderStationInfoSection } from './StationItemVisuals.js';
import { StationCommandQueue } from './StationCommandQueue.js';

function sortAmmoItems(items) {
  return [...(items || [])].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function slotIndexFromId(slotId) {
  const m = String(slotId || '').match(/(\d+)$/);
  return m ? Math.max(0, Math.min(1, Number(m[1]) | 0)) : 0;
}

export class StationAmmoView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.equipment = null;
    this.shop = null;
    this.inv = null;
    this.docked = false;

    this.selectedItemId = '';
    this.selectedSource = 'inventory';
    this.selectedSlotId = '';
    this.hoverItemId = '';
    this.hoverSource = '';
    this.hoverSlotId = '';

    this.pointerDrag = null;
    this.dragGhostEl = null;
    this.dropSlotId = '';
    this.dropToInventory = false;
    this.suppressClickUntil = 0;

    this.el = document.createElement('div');
    this.el.className = 'station-ammo station-ammo--dropmode';
    this.el.innerHTML = `
      <div class="station-ammo-drop">
        <section class="station-ammo-drop__slots">
          <div class="station-equipment__panel-head">Lance-roquettes</div>
          <div class="station-ammo-drop__slotlist" data-role="slots"></div>
        </section>
        <section class="station-ammo-drop__inventory" data-ammo-inventory-drop="1">
          <div class="station-equipment__panel-head">Munitions en soute</div>
          <div class="station-ammo-drop__grid" data-role="inventory"></div>
        </section>
        <section class="station-ammo-drop__shop">
          <div class="station-equipment__panel-head">Boutique munitions</div>
          <div class="station-ammo-drop__grid" data-role="shop"></div>
        </section>
        <section class="station-ammo-drop__details" data-role="details"></section>
      </div>
    `;

    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.inventoryPanelEl = this.el.querySelector('[data-ammo-inventory-drop="1"]');
    this.inventoryEl = this.el.querySelector('[data-role="inventory"]');
    this.shopEl = this.el.querySelector('[data-role="shop"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');

    this._boundPointerMove = (ev) => this.onPointerDragMove(ev);
    this._boundPointerUp = (ev) => this.onPointerDragEnd(ev);

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('dragstart', (ev) => ev.preventDefault());

    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;

      const dragNode = ev.target?.closest?.('[data-ammo-id]');
      if (dragNode) {
        const itemId = dragNode.dataset.ammoId || '';
        if (itemId) {
          ev.preventDefault();
          this.selectedItemId = itemId;
          this.selectedSource = dragNode.dataset.source || 'inventory';
          this.selectedSlotId = dragNode.dataset.slotId || '';
          this.pointerDrag = {
            itemId,
            source: this.selectedSource,
            slotId: dragNode.dataset.slotId || '',
            startX: ev.clientX,
            startY: ev.clientY,
            active: false
          };
          window.addEventListener('pointermove', this._boundPointerMove, { passive: false });
          window.addEventListener('pointerup', this._boundPointerUp, { passive: false, once: true });
          this.render();
          return;
        }
      }

      const slotNode = ev.target?.closest?.('[data-ammo-slot-id]');
      if (slotNode) {
        ev.preventDefault();
        this.handleSlotClick(slotNode.dataset.ammoSlotId || '');
      }
    });

    this.el.addEventListener('click', (ev) => {
      if (performance.now() < this.suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const itemNode = ev.target?.closest?.('[data-ammo-id]');
      if (itemNode) {
        ev.preventDefault();
        this.selectedItemId = itemNode.dataset.ammoId || '';
        this.selectedSource = itemNode.dataset.source || 'inventory';
        this.selectedSlotId = itemNode.dataset.slotId || '';
        this.render();
        return;
      }
      const slotNode = ev.target?.closest?.('[data-ammo-slot-id]');
      if (slotNode) {
        ev.preventDefault();
        this.handleSlotClick(slotNode.dataset.ammoSlotId || '');
      }
    });

    this.el.addEventListener('dblclick', (ev) => {
      const itemNode = ev.target?.closest?.('[data-ammo-id]');
      if (!itemNode) return;
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = itemNode.dataset.ammoId || '';
      const source = itemNode.dataset.source || 'inventory';
      if (!itemId) return;
      if (source === 'slot') {
        const slot = slotIndexFromId(itemNode.dataset.slotId || '0');
        this.unassignAmmo(slot);
        return;
      }
      const target = this.getSlots().find((slot) => !slot.item) || this.getSlots()[0] || null;
      if (target) this.assignAmmo(itemId, source, target.slot);
    });

    this.el.addEventListener('mouseover', (ev) => {
      const itemNode = ev.target?.closest?.('[data-ammo-id]');
      const slotNode = ev.target?.closest?.('[data-ammo-slot-id]');
      if (itemNode) {
        this.hoverItemId = itemNode.dataset.ammoId || '';
        this.hoverSource = itemNode.dataset.source || 'inventory';
      }
      if (slotNode) this.hoverSlotId = slotNode.dataset.ammoSlotId || '';
      this.renderDetails();
    });

    this.el.addEventListener('mouseout', (ev) => {
      const leaving = ev.target?.closest?.('[data-ammo-id], [data-ammo-slot-id]');
      if (!leaving) return;
      const nextInside = (ev.relatedTarget && typeof ev.relatedTarget.closest === 'function')
        ? ev.relatedTarget.closest('[data-ammo-id], [data-ammo-slot-id]')
        : null;
      if (nextInside) return;
      this.hoverItemId = '';
      this.hoverSource = '';
      this.hoverSlotId = '';
      this.renderDetails();
    });
  }

  assignAmmo(itemId, source, slot) {
    if (!itemId || !this.sendCmd || !this.docked) return;
    const slotIndex = Math.max(0, Math.min(1, slot | 0));
    if (source === 'shop') {
      this.cmdQueue.send('buy_and_assign_rocket_ammo', { itemId, slot: slotIndex });
      return;
    }
    this.cmdQueue.send('assign_rocket_ammo', { itemId, slot: slotIndex });
  }

  unassignAmmo(slot) {
    if (!this.sendCmd || !this.docked) return;
    this.cmdQueue.send('unassign_rocket_ammo', { slot: Math.max(0, Math.min(1, slot | 0)) });
  }

  handleSlotClick(slotId) {
    const slot = this.getSlots().find((entry) => entry.id === slotId) || null;
    if (!slot) return;
    if (this.selectedItemId && this.selectedSource !== 'slot') {
      this.assignAmmo(this.selectedItemId, this.selectedSource, slot.slot);
      this.selectedSlotId = slot.id;
      this.render();
      return;
    }
    this.selectedSlotId = slot.id;
    if (slot.item) {
      this.cmdQueue.send('switch_rocket_slot', { slot: slot.slot });
      this.selectedItemId = slot.item.itemId;
      this.selectedSource = 'slot';
    } else {
      this.selectedItemId = '';
      this.selectedSource = 'inventory';
    }
    this.render();
  }

  getAssignedAmmoIds() {
    return new Set(this.getSlots().map((slot) => slot.item?.itemId).filter(Boolean));
  }

  getInventoryItems() {
    const assigned = this.getAssignedAmmoIds();
    return sortAmmoItems(this.equipment?.rocketAmmo?.inventory || []).filter((item) => !assigned.has(item.itemId));
  }

  getShopItems() {
    return sortAmmoItems((this.shop?.offers || []).filter((item) => item?.categoryId === 'ammo'));
  }

  getSlots() {
    const rocketAmmo = this.equipment?.rocketAmmo || { slots: [], activeSlot: 0 };
    return [0, 1].map((slot) => {
      const entry = rocketAmmo.slots?.[slot] || null;
      return {
        id: `rocket-ammo-slot-${slot}`,
        label: `Roquette ${slot + 1}`,
        slot,
        active: !!entry?.active,
        item: entry?.item || null
      };
    });
  }

  getItemById(itemId, source = '') {
    if (!itemId) return null;
    const slotItem = this.getSlots().map((slot) => slot.item).find((item) => item?.itemId === itemId) || null;
    const invItem = this.getInventoryItems().find((item) => item.itemId === itemId) || null;
    const shopItem = this.getShopItems().find((item) => item.itemId === itemId) || null;
    if (source === 'shop') return shopItem || invItem || slotItem;
    if (source === 'slot') return slotItem || invItem || shopItem;
    return invItem || slotItem || shopItem;
  }

  getFocusedSlot() {
    const slotId = this.hoverSlotId || this.selectedSlotId;
    return this.getSlots().find((entry) => entry.id === slotId) || null;
  }

  getFocusedItem() {
    const itemId = this.hoverItemId || this.selectedItemId;
    const source = this.hoverSource || this.selectedSource;
    if (itemId) return this.getItemById(itemId, source);
    return this.getFocusedSlot()?.item || null;
  }

  startPointerDrag(ev) {
    if (!this.pointerDrag || this.pointerDrag.active) return;
    const item = this.getItemById(this.pointerDrag.itemId, this.pointerDrag.source);
    this.pointerDrag.active = true;
    this.suppressClickUntil = performance.now() + 250;
    this.el.classList.add('is-dragging-equipment');
    this.dragGhostEl = document.createElement('div');
    this.dragGhostEl.className = 'station-equipment__drag-ghost station-ammo-drop__ghost';
    this.dragGhostEl.innerHTML = item ? buildItemIconMarkup(item, { selected: true, compact: true }, 'div') : '';
    document.body.appendChild(this.dragGhostEl);
    this.moveDragGhost(ev.clientX, ev.clientY);
  }

  moveDragGhost(x, y) {
    if (!this.dragGhostEl) return;
    this.dragGhostEl.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 16)}px)`;
  }

  getNodeAt(x, y, selector) {
    const oldPointerEvents = this.dragGhostEl?.style.pointerEvents;
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = 'none';
    const node = document.elementFromPoint(x, y);
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = oldPointerEvents || 'none';
    return node?.closest?.(selector) || null;
  }

  getDropSlotAt(x, y) {
    return this.getNodeAt(x, y, '[data-ammo-slot-id]');
  }

  getInventoryDropAt(x, y) {
    return this.getNodeAt(x, y, '[data-ammo-inventory-drop="1"]');
  }

  clearDropTarget() {
    this.el.querySelectorAll('.station-ammo-drop-slot.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
    this.inventoryPanelEl?.classList.remove('is-drop-target');
    this.dropSlotId = '';
    this.dropToInventory = false;
  }

  markDropTarget(slotNode, inventoryNode) {
    this.clearDropTarget();
    if (slotNode) {
      const slotId = slotNode.dataset?.ammoSlotId || '';
      this.dropSlotId = slotId;
      slotNode.classList.add('is-drop-target');
      return;
    }
    if (inventoryNode) {
      this.dropToInventory = true;
      inventoryNode.classList.add('is-drop-target');
    }
  }

  onPointerDragMove(ev) {
    if (!this.pointerDrag) return;
    const dx = ev.clientX - this.pointerDrag.startX;
    const dy = ev.clientY - this.pointerDrag.startY;
    if (!this.pointerDrag.active && ((dx * dx + dy * dy) >= 25)) this.startPointerDrag(ev);
    if (!this.pointerDrag.active) return;
    ev.preventDefault();
    this.moveDragGhost(ev.clientX, ev.clientY);
    const slotNode = this.getDropSlotAt(ev.clientX, ev.clientY);
    const invNode = !slotNode && this.pointerDrag.source === 'slot' ? this.getInventoryDropAt(ev.clientX, ev.clientY) : null;
    if (slotNode || invNode) this.markDropTarget(slotNode, invNode);
    else this.clearDropTarget();
  }

  onPointerDragEnd(ev) {
    window.removeEventListener('pointermove', this._boundPointerMove);
    const drag = this.pointerDrag;
    this.pointerDrag = null;
    if (!drag) return;

    const wasActive = !!drag.active;
    if (wasActive) {
      ev.preventDefault();
      this.suppressClickUntil = performance.now() + 250;
    }

    this.el.classList.remove('is-dragging-equipment');
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }

    const slotNode = this.getDropSlotAt(ev.clientX, ev.clientY);
    const invNode = !slotNode && drag.source === 'slot' ? this.getInventoryDropAt(ev.clientX, ev.clientY) : null;
    this.clearDropTarget();
    if (!wasActive) return;

    if (slotNode) {
      const slot = this.getSlots().find((entry) => entry.id === (slotNode.dataset.ammoSlotId || '')) || null;
      if (slot) this.assignAmmo(drag.itemId, drag.source, slot.slot);
      return;
    }
    if (invNode && drag.source === 'slot') {
      this.unassignAmmo(slotIndexFromId(drag.slotId));
    }
  }

  renderSlots() {
    const selectedId = this.hoverSlotId || this.selectedSlotId;
    this.slotsEl.innerHTML = this.getSlots().map((slot) => {
      const selected = slot.id === selectedId;
      const content = slot.item
        ? buildItemIconMarkup(slot.item, { selected, compact: true }, 'div')
        : '<span class="station-ammo-drop-slot__empty">Dépose ici</span>';
      const quantity = slot.item ? `x${Math.max(0, slot.item.ammoQuantity | 0)}` : 'vide';
      const dataItem = slot.item ? `data-ammo-id="${slot.item.itemId}" data-source="slot" data-slot-id="${slot.id}"` : '';
      return `
        <div class="station-ammo-drop-slot ${selected ? 'is-selected' : ''} ${slot.active ? 'is-active' : ''} ${slot.id === this.dropSlotId ? 'is-drop-target' : ''}" data-ammo-slot-id="${slot.id}" ${dataItem}>
          <div class="station-ammo-drop-slot__icon">${content}</div>
          <div class="station-ammo-drop-slot__body">
            <div class="station-ammo-drop-slot__title">${slot.label}${slot.active ? ' • actif' : ''}</div>
            <div class="station-ammo-drop-slot__name">${slot.item?.name || 'Aucune munition'}</div>
            <div class="station-ammo-drop-slot__meta">${quantity}${slot.item ? ' • glisse vers la soute pour retirer' : ''}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderInventory() {
    const items = this.getInventoryItems();
    this.inventoryEl.innerHTML = items.map((item) => this.renderAmmoCard(item, 'inventory')).join('') || '<div class="station-equipment__empty">Aucune roquette libre en soute.</div>';
  }

  renderShop() {
    const items = this.getShopItems();
    this.shopEl.innerHTML = items.map((item) => this.renderAmmoCard(item, 'shop')).join('') || '<div class="station-equipment__empty">Aucune munition proposée.</div>';
  }

  renderAmmoCard(item, source) {
    const selected = item.itemId === (this.hoverItemId || this.selectedItemId) && source === (this.hoverSource || this.selectedSource);
    const canAfford = source !== 'shop' || item.canAfford !== false;
    const icon = buildItemIconButton(item, { selected, showName: false, compact: true })
      .replace('<button ', `<button data-ammo-id="${item.itemId}" data-source="${source}" `);
    const price = source === 'shop' ? formatCredits(item.priceCredits || 0) : `x${Math.max(0, item.ammoQuantity | 0)}`;
    const hint = source === 'shop'
      ? (canAfford ? 'Glisser vers un slot pour acheter' : 'Crédits insuffisants')
      : 'Glisser vers un slot';
    return `
      <div class="station-ammo-drop-card ${selected ? 'is-selected' : ''} ${canAfford ? '' : 'is-unaffordable'}" data-ammo-id="${item.itemId}" data-source="${source}">
        ${icon}
        <div class="station-ammo-drop-card__body">
          <div class="station-ammo-drop-card__name">${item.shortName || item.name}</div>
          <div class="station-ammo-drop-card__meta">T${Math.max(1, item.tier | 0)} • ${price}</div>
          <div class="station-ammo-drop-card__hint">${hint}</div>
        </div>
      </div>
    `;
  }

  renderSummaryDetails(slot) {
    const active = this.equipment?.rocketAmmo?.activeItem || null;
    const slotText = slot
      ? `${slot.label} : ${slot.item ? `${slot.item.name} x${Math.max(0, slot.item.ammoQuantity | 0)}` : 'vide'}${slot.active ? ' • actif' : ''}`
      : 'Sélectionnez une munition ou un emplacement.';
    const activeText = active ? `Active : ${active.name} x${Math.max(0, active.ammoQuantity | 0)}` : 'Active : aucune';
    this.detailsEl.innerHTML = `
      <div class="station-ammo-drop__details-title">Munitions</div>
      ${renderStationInfoSection('Slots', [slotText, activeText])}
    `;
  }

  renderAmmoDetails(item, slot) {
    const source = this.hoverSource || this.selectedSource;
    const assignedSlots = item.assignedRocketSlots || [];
    const assignedText = source === 'slot'
      ? `assignée à ${slot?.label || 'un slot'}`
      : (assignedSlots.length ? assignedSlots.map((index) => `Roquette ${index + 1}`).join(' / ') : 'libre');
    this.detailsEl.innerHTML = `
      <div class="station-ammo-drop__details-head">
        <strong>${item.name}</strong>
        <span>${source === 'shop' ? `Achat ${formatCredits(item.priceCredits || 0)}` : `Quantité ${Math.max(0, item.ammoQuantity | 0)}`}</span>
      </div>
      ${renderItemSections(item, {
        status: `État : ${assignedText}${item.active ? ' • actif' : ''}`,
        source: getItemMetaText(item)
      })}
      ${source === 'shop' && item.canAfford === false ? renderStationInfoSection('Achat', ['Crédits insuffisants']) : ''}
    `;
  }

  renderDetails() {
    const item = this.getFocusedItem();
    const slot = this.getFocusedSlot();
    if (item) this.renderAmmoDetails(item, slot);
    else this.renderSummaryDetails(slot);
  }

  render() {
    const existingIds = new Set([
      ...this.getInventoryItems().map((item) => item.itemId),
      ...this.getShopItems().map((item) => item.itemId),
      ...this.getSlots().map((slot) => slot.item?.itemId).filter(Boolean)
    ]);
    if (this.selectedItemId && !existingIds.has(this.selectedItemId)) this.selectedItemId = '';
    if (this.hoverItemId && !existingIds.has(this.hoverItemId)) this.hoverItemId = '';
    this.renderSlots();
    this.renderInventory();
    this.renderShop();
    this.renderDetails();
  }

  update(equipment, shop, inv, docked) {
    this.equipment = equipment || null;
    this.shop = shop || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
}
