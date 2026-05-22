import { EQUIPMENT_CATEGORY_ORDER, ITEM_CATEGORY_IDS, getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { formatCredits } from '../cargo/CargoFormat.js';
import { buildItemIconButton, buildItemIconMarkup, getItemMetaText, renderItemSections, renderStationInfoSection } from './StationItemVisuals.js';

function buildSlots(equipment) {
  const ownedById = new Map((equipment?.ownedItems || []).map((item) => [item.itemId, item]));
  const equippedItems = (equipment?.equippedItems || []).map((item) => ownedById.get(item.itemId) || item);
  const takeFirst = (categoryId, used) => {
    const idx = equippedItems.findIndex((item) => item?.categoryId === categoryId && !used.has(item.itemId));
    if (idx < 0) return null;
    const item = equippedItems[idx];
    used.add(item.itemId);
    return item;
  };

  const used = new Set();
  const slots = [];
  const oneSlots = [
    ITEM_CATEGORY_IDS.WEAPON,
    ITEM_CATEGORY_IDS.LAUNCHER,
    ITEM_CATEGORY_IDS.DEFENSE,
    ITEM_CATEGORY_IDS.ENGINE
  ];

  for (const categoryId of oneSlots) {
    slots.push({ id: categoryId, label: getItemCategoryName(categoryId), categoryId, index: 0, item: takeFirst(categoryId, used), kind: 'equipment' });
  }

  const moduleCap = Math.max(0, equipment?.slotCaps?.[ITEM_CATEGORY_IDS.MODULE] || 0);
  for (let i = 0; i < moduleCap; i += 1) slots.push({ id: `module-${i}`, label: `Module ${i + 1}`, categoryId: ITEM_CATEGORY_IDS.MODULE, index: i, item: takeFirst(ITEM_CATEGORY_IDS.MODULE, used), kind: 'equipment' });

  return slots;
}

function sortInventoryItems(items) {
  return [...(items || [])].sort((a, b) => {
    const ac = EQUIPMENT_CATEGORY_ORDER.indexOf(a?.categoryId);
    const bc = EQUIPMENT_CATEGORY_ORDER.indexOf(b?.categoryId);
    if (ac !== bc) return ac - bc;
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function renderTagSummary(equipment) {
  const tags = (equipment?.tags || []).filter((entry) => entry?.active);
  const supers = equipment?.superTags || [];
  const lines = [];
  if (tags.length > 0) lines.push(`Tags : ${tags.map((entry) => `${entry.name} ${'●'.repeat(Math.max(1, entry.points | 0))}`).join(' • ')}`);
  if (supers.length > 0) lines.push(`Super-tags : ${supers.map((entry) => `${entry.name} R${Math.max(1, entry.rank | 0)}`).join(' • ')}`);
  return lines;
}

export class StationEquipmentView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.equipment = null;
    this.inv = null;
    this.docked = false;
    this.slots = [];
    this.selectedItemId = '';
    this.hoverItemId = '';
    this.selectedSlotId = '';
    this.hoverSlotId = '';
    this.dragItemId = '';
    this.dragSourceSlotId = '';
    this.dropSlotId = '';
    this.pointerDrag = null;
    this.dragGhostEl = null;
    this.suppressClickUntil = 0;

    this.el = document.createElement('div');
    this.el.className = 'station-equipment';
    this.el.innerHTML = `
      <div class="station-equipment__frame">
        <section class="station-equipment__left">
          <div class="station-equipment__panel-head">Équipé</div>
          <div class="station-equipment__slots" data-role="slots"></div>
        </section>
        <section class="station-equipment__right">
          <div class="station-equipment__panel-head">Inventaire</div>
          <div class="station-equipment__inventory" data-role="inventory"></div>
        </section>
        <section class="station-equipment__details" data-role="details"></section>
      </div>
    `;

    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.inventoryEl = this.el.querySelector('[data-role="inventory"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('mouseover', (ev) => {
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (itemBtn) this.hoverItemId = itemBtn.dataset.itemId || '';
      if (slotNode) this.hoverSlotId = slotNode.dataset.slotId || '';
      this.renderDetails();
    });
    this.el.addEventListener('mouseout', (ev) => {
      const leavingItem = ev.target?.closest?.('button[data-item-id], [data-slot-id]');
      if (!leavingItem) return;
      const nextInsideItem = (ev.relatedTarget && typeof ev.relatedTarget.closest === 'function') ? ev.relatedTarget.closest('button[data-item-id], [data-slot-id]') : null;
      if (nextInsideItem) return;
      this.hoverItemId = '';
      this.hoverSlotId = '';
      this.renderDetails();
    });
    this.el.addEventListener('dragstart', (ev) => ev.preventDefault());
    this._boundPointerMove = (ev) => this.onPointerDragMove(ev);
    this._boundPointerUp = (ev) => this.onPointerDragEnd(ev);
    this.el.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (slotNode) return;
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      if (itemBtn) {
        this.selectedItemId = itemBtn.dataset.itemId || '';
        this.selectedSlotId = '';
        this.render();
      }
    });
    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const actionBtn = ev.target?.closest?.('button[data-act]');
      if (actionBtn && this.sendCmd && !actionBtn.disabled) {
        ev.preventDefault();
        ev.stopPropagation();
        this.suppressClickUntil = performance.now() + 250;
        this.runActionButton(actionBtn);
        return;
      }

      const dragNode = ev.target?.closest?.('[data-drag-item-id]');
      if (!dragNode) return;
      const itemId = dragNode.dataset.dragItemId || '';
      if (!itemId) return;
      this.pointerDrag = {
        itemId,
        sourceSlotId: dragNode.dataset.dragSourceSlotId || '',
        startX: ev.clientX,
        startY: ev.clientY,
        x: ev.clientX,
        y: ev.clientY,
        active: false
      };
      window.addEventListener('pointermove', this._boundPointerMove, { passive: false });
      window.addEventListener('pointerup', this._boundPointerUp, { passive: false, once: true });
    });

    this.el.addEventListener('click', (ev) => {
      if (performance.now() < this.suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const actionBtn = ev.target?.closest?.('button[data-act]');
      if (actionBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.sendCmd && !actionBtn.disabled) this.runActionButton(actionBtn);
        return;
      }

      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      if (itemBtn) {
        this.selectedItemId = itemBtn.dataset.itemId || '';
        this.selectedSlotId = '';
        this.render();
        return;
      }

      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (!slotNode) return;
      const clickedSlotId = slotNode.dataset.slotId || '';
      const slot = this.slots.find((entry) => entry.id === clickedSlotId) || null;
      const selectedInventoryItem = this.getInventoryItems().find((entry) => entry.itemId === this.selectedItemId) || null;
      if (selectedInventoryItem && this.canDropItemOnSlot(selectedInventoryItem, slot)) {
        this.equipItemToSlot(selectedInventoryItem.itemId, slot);
        return;
      }
      this.selectedSlotId = clickedSlotId;
      this.selectedItemId = slot?.item?.itemId || '';
      this.render();
    });
    this.el.addEventListener('dblclick', (ev) => {
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      if (itemBtn) {
        this.performPrimaryAction(itemBtn.dataset.itemId || '');
        return;
      }
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (!slotNode) return;
      const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || '')) || null;
      if (slot?.item?.itemId) this.sendStationCommand('unequip_item', { itemId: slot.item.itemId });
    });
  }


  sendStationCommand(cmd, payload = {}) {
    if (!this.sendCmd || !cmd) return '';
    return this.sendCmd(cmd, payload, { station: true, source: 'equipment' }) || '';
  }

  getItemById(itemId) {
    if (!itemId) return null;
    return this.getInventoryItems().find((entry) => entry.itemId === itemId) || this.getOwnedEquipmentItem(itemId) || null;
  }

  startPointerDrag(ev) {
    if (!this.pointerDrag || this.pointerDrag.active) return;
    const item = this.getItemById(this.pointerDrag.itemId);
    this.pointerDrag.active = true;
    this.dragItemId = this.pointerDrag.itemId;
    this.dragSourceSlotId = this.pointerDrag.sourceSlotId || '';
    this.el.classList.add('is-dragging-equipment');
    this.suppressClickUntil = performance.now() + 250;
    this.dragGhostEl = document.createElement('div');
    this.dragGhostEl.className = 'station-equipment__drag-ghost';
    this.dragGhostEl.innerHTML = item ? buildItemIconMarkup(item, { selected: true, compact: true }, 'div') : '';
    document.body.appendChild(this.dragGhostEl);
    this.moveDragGhost(ev.clientX, ev.clientY);
  }

  moveDragGhost(x, y) {
    if (!this.dragGhostEl) return;
    this.dragGhostEl.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 14)}px)`;
  }

  getDropInfoAt(x, y) {
    const oldPointerEvents = this.dragGhostEl?.style.pointerEvents;
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = 'none';
    const node = document.elementFromPoint(x, y);
    if (this.dragGhostEl) this.dragGhostEl.style.pointerEvents = oldPointerEvents || 'none';
    const slotNode = node?.closest?.('[data-slot-id]') || null;
    const inventoryDrop = node?.closest?.('[data-role="inventory"]') || null;
    return { slotNode, inventoryDrop };
  }

  onPointerDragMove(ev) {
    if (!this.pointerDrag) return;
    const dx = ev.clientX - this.pointerDrag.startX;
    const dy = ev.clientY - this.pointerDrag.startY;
    if (!this.pointerDrag.active && ((dx * dx + dy * dy) >= 36)) this.startPointerDrag(ev);
    if (!this.pointerDrag.active) return;
    ev.preventDefault();
    this.pointerDrag.x = ev.clientX;
    this.pointerDrag.y = ev.clientY;
    this.moveDragGhost(ev.clientX, ev.clientY);
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    if (inventoryDrop && this.pointerDrag.sourceSlotId) {
      this.clearDropTarget();
      this.el.classList.add('is-inventory-drop-target');
      return;
    }
    this.el.classList.remove('is-inventory-drop-target');
    if (!slotNode) {
      this.clearDropTarget();
      return;
    }
    const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || '')) || null;
    const item = this.getItemById(this.pointerDrag.itemId);
    if (!this.canDropItemOnSlot(item, slot)) {
      this.clearDropTarget();
      return;
    }
    this.markDropTarget(slotNode, slot.id);
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
    this.el.classList.remove('is-dragging-equipment', 'is-inventory-drop-target');
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }
    this.dragItemId = '';
    this.dragSourceSlotId = '';
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    this.clearDropTarget();
    if (!wasActive) return;
    if (inventoryDrop && drag.sourceSlotId) {
      this.sendStationCommand('unequip_item', { itemId: drag.itemId });
      return;
    }
    if (!slotNode) return;
    const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || '')) || null;
    const item = this.getItemById(drag.itemId);
    if (!this.canDropItemOnSlot(item, slot)) return;
    this.equipItemToSlot(drag.itemId, slot);
  }


  runActionButton(actionBtn) {
    if (!actionBtn || !this.sendCmd) return;
    const act = actionBtn.dataset.act;
    const itemId = actionBtn.dataset.itemId || this.getFocusedItem()?.itemId || this.selectedItemId || '';
    const slot = Number.isFinite(Number(actionBtn.dataset.slot)) ? Math.max(0, Math.min(1, Number(actionBtn.dataset.slot) | 0)) : 0;
    if (act === 'equip' && itemId) {
      this.performPrimaryAction(itemId);
      return;
    }
    if (act === 'unequip' && itemId) {
      this.sendStationCommand('unequip_item', { itemId });
      return;
    }
    if (act === 'sellItem' && itemId) {
      this.sendStationCommand('sell_item', { itemId });
      return;
    }
    if (act === 'assignAmmo' && itemId) {
      this.sendStationCommand('assign_rocket_ammo', { itemId, slot });
      return;
    }
    if (act === 'switchRocketSlot') {
      this.sendStationCommand('switch_rocket_slot', { slot });
      return;
    }
    if (act === 'toggleConverter' && itemId) this.sendStationCommand('toggle_converter', { itemId });
  }


  clearDropTarget() {
    this.el.querySelectorAll('.station-equipment-slot.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
    this.dropSlotId = '';
  }

  markDropTarget(slotNode, slotId) {
    if (!slotNode || !slotId) return;
    if (this.dropSlotId === slotId && slotNode.classList.contains('is-drop-target')) return;
    this.clearDropTarget();
    this.dropSlotId = slotId;
    slotNode.classList.add('is-drop-target');
  }


  canDropItemOnSlot(item, slot) {
    if (!this.docked || !item || !slot) return false;
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO || item.categoryId === ITEM_CATEGORY_IDS.CONVERTER) return false;
    return item.categoryId === slot.categoryId;
  }

  equipItemToSlot(itemId, slot) {
    if (!itemId || !slot || !this.sendCmd) return;
    this.selectedItemId = itemId;
    this.selectedSlotId = slot.id;
    this.sendStationCommand('equip_item_to_slot', {
      itemId,
      categoryId: slot.categoryId,
      slotId: slot.id,
      index: slot.index | 0
    });
  }

  getInventoryItems() {
    const equippedIds = new Set((this.equipment?.equippedItems || []).map((item) => item?.itemId).filter(Boolean));
    const equipmentItems = (this.equipment?.ownedItems || []).filter((item) => {
      if (!item) return false;
      if (item.categoryId === ITEM_CATEGORY_IDS.CONVERTER || item.categoryId === ITEM_CATEGORY_IDS.AMMO) return false;
      return !equippedIds.has(item.itemId);
    });
    return sortInventoryItems(equipmentItems);
  }

  getOwnedEquipmentItem(itemId) {
    if (!itemId) return null;
    return (this.equipment?.ownedItems || []).find((item) => item?.itemId === itemId) || null;
  }

  getFocusedSlot() {
    const slotId = this.hoverSlotId || this.selectedSlotId;
    return this.slots.find((entry) => entry.id === slotId) || null;
  }

  getFocusedItem() {
    const slot = this.getFocusedSlot();
    if (slot?.item) return slot.item;
    const itemId = this.hoverItemId || this.selectedItemId;
    if (itemId) return this.getInventoryItems().find((item) => item.itemId === itemId) || this.getOwnedEquipmentItem(itemId);
    return null;
  }

  performPrimaryAction(itemId) {
    if (!itemId || !this.sendCmd) return;
    const item = this.getInventoryItems().find((entry) => entry.itemId === itemId) || null;
    if (!item) return;
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      const selectedSlot = this.getFocusedSlot();
      const slot = selectedSlot?.kind === 'ammo' ? selectedSlot.ammoSlot : (item.assignedRocketSlots?.[0] ?? this.equipment?.rocketAmmo?.activeSlot ?? 0);
      this.sendStationCommand('assign_rocket_ammo', { itemId, slot });
      return;
    }
    if (item.equipped) this.sendStationCommand('unequip_item', { itemId });
    else {
      const selectedSlot = this.getFocusedSlot();
      const target = (selectedSlot && this.canDropItemOnSlot(item, selectedSlot))
        ? selectedSlot
        : (this.slots.find((slot) => this.canDropItemOnSlot(item, slot) && !slot.item) || this.slots.find((slot) => this.canDropItemOnSlot(item, slot)) || null);
      if (target) this.equipItemToSlot(itemId, target);
      else this.sendStationCommand('equip_item', { itemId });
    }
  }

  renderSlots() {
    this.slotsEl.innerHTML = this.slots.map((slot) => {
      const selected = slot.id === (this.hoverSlotId || this.selectedSlotId);
      const isDropTarget = slot.id === this.dropSlotId;
      const content = slot.item
        ? buildItemIconMarkup(slot.item, { selected, compact: true }, 'div')
        : `<span class="station-equipment-slot__emptybox"></span>`;
      return `
        <div class="station-equipment-slot ${selected ? 'is-selected' : ''} ${isDropTarget ? 'is-drop-target' : ''} ${slot.active ? 'is-active' : ''}" data-slot-id="${slot.id}" data-category-id="${slot.categoryId || ''}" ${slot.item ? `data-drag-item-id="${slot.item.itemId}" data-drag-source-slot-id="${slot.id}"` : ''} title="${slot.label}">
          <span class="station-equipment-slot__iconwrap">${content}</span>
          <span class="station-equipment-slot__label">${slot.label}${slot.active ? ' *' : ''}</span>
        </div>
      `;
    }).join('');
  }

  renderInventory() {
    const items = this.getInventoryItems();
    this.inventoryEl.innerHTML = items.map((item) => {
      const selected = item.itemId === (this.hoverItemId || this.selectedItemId);
      const button = buildItemIconButton(item, { selected, showName: false, compact: true });
      return button.replace('<button', `<button data-drag-item-id="${item.itemId}" data-drag-source="inventory"`);
    }).join('') || '<div class="station-equipment__empty">Aucun item possédé.</div>';
  }

  renderSummaryDetails(slot) {
    const summaryLines = this.equipment?.summary?.effectLines || [];
    const tagLines = renderTagSummary(this.equipment);
    const slotText = slot
      ? `${slot.label} : ${slot.item ? (slot.item.shortName || slot.item.name) : 'vide'}${slot.active ? ' • actif' : ''}`
      : 'Glissez un item de l’inventaire vers un emplacement compatible.';
    const blocks = [
      `<div class="station-equipment__details-text">${slotText}</div>`,
      ...tagLines.map((line) => `<div class="station-equipment__details-text">${line}</div>`),
      ...(summaryLines.length > 0
        ? [`<div class="station-equipment__details-text">Effets actifs : ${summaryLines.join(' • ')}</div>`]
        : [])
    ];
    this.detailsEl.innerHTML = blocks.join('');
  }

  renderAmmoDetails(item, slot) {
    const assignedSlots = item.assignedRocketSlots || [];
    const slotText = assignedSlots.length ? assignedSlots.map((index) => `S${index + 1}`).join(' / ') : 'aucun';
    const activateButtons = assignedSlots.map((index) => `<button class="ui-btn ui-btn--ghost" type="button" data-act="switchRocketSlot" data-slot="${index}" ${this.docked ? '' : 'disabled'}>Activer S${index + 1}</button>`).join('');
    this.detailsEl.innerHTML = `
      <div class="station-equipment__details-headline">
        <span class="station-equipment__details-name">${item.name}</span>
        <span class="station-equipment__details-price">Quantité ${Math.max(0, item.ammoQuantity | 0)}</span>
      </div>
      ${renderItemSections(item, {
        status: `Slots : ${slotText}${item.active ? ' • actif' : ''}`,
        source: getItemMetaText(item)
      })}
      <div class="station-equipment__details-actions">
        <button class="ui-btn" type="button" data-act="assignAmmo" data-slot="0" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Assigner S1</button>
        <button class="ui-btn" type="button" data-act="assignAmmo" data-slot="1" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Assigner S2</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="sellItem" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Vendre</button>
        ${activateButtons}
      </div>
    `;
  }

  renderEquipmentDetails(item) {
    const meta = `${item.categoryName || ''} • T${Math.max(1, item.tier | 0)}${item.equipped ? ' • équipé' : ''}`;
    let actions = '';
    if (item.equipped) {
      actions = `<button class="ui-btn ui-btn--ghost" type="button" data-act="unequip" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Retirer</button>`;
    } else {
      actions = `
        <button class="ui-btn" type="button" data-act="equip" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Équiper</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="sellItem" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Vendre</button>
      `;
    }

    this.detailsEl.innerHTML = `
      <div class="station-equipment__details-headline">
        <span class="station-equipment__details-name">${item.name}</span>
        <span class="station-equipment__details-price">Revente ${formatCredits(item.sellPriceCredits || 0)}</span>
      </div>
      ${renderItemSections(item, {
        status: item.equipped ? 'État : équipé' : 'État : en inventaire',
        source: meta
      })}
      <div class="station-equipment__details-actions">${actions}</div>
    `;
  }

  renderDetails() {
    const item = this.getFocusedItem();
    const slot = this.getFocusedSlot();
    if (!item) {
      this.renderSummaryDetails(slot);
      return;
    }
    if (item.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      this.renderAmmoDetails(item, slot);
      return;
    }
    this.renderEquipmentDetails(item);
  }

  render() {
    this.slots = buildSlots(this.equipment);
    const invIds = new Set(this.getInventoryItems().map((item) => item.itemId));
    const slotIds = new Set(this.slots.map((slot) => slot?.item?.itemId).filter(Boolean));
    if (this.selectedItemId && !invIds.has(this.selectedItemId) && !slotIds.has(this.selectedItemId)) this.selectedItemId = '';
    if (this.hoverItemId && !invIds.has(this.hoverItemId) && !slotIds.has(this.hoverItemId)) this.hoverItemId = '';
    this.renderSlots();
    this.renderInventory();
    this.renderDetails();
  }

  update(equipment, inv, docked) {
    this.equipment = equipment || null;
    this.inv = inv || null;
    this.docked = !!docked;
    this.render();
  }
}
