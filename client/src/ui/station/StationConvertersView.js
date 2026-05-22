import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { formatCredits } from '../cargo/CargoFormat.js';
import { buildItemIconButton, buildItemIconMarkup, renderItemSections, renderStationInfoSection } from './StationItemVisuals.js';
import { StationCommandQueue } from './StationCommandQueue.js';

function sortConverters(items) {
  return [...(items || [])].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

function buildConverterSlots(converters) {
  const equipped = [...(converters?.equipped || [])];
  const slotCap = Math.max(0, converters?.slotCap | 0);
  const slots = [];
  for (let i = 0; i < slotCap; i += 1) {
    const item = equipped[i] || null;
    slots.push({ id: `converter-slot-${i}`, label: `Convertisseur ${i + 1}`, index: i, item, active: !!item?.converterEnabled });
  }
  return slots;
}

function formatRuntimeState(item) {
  if (!item?.equipped) return 'hors ligne';
  if (!item.converterEnabled) return 'coupé';
  const blocked = String(item.converterRuntime?.blockedLabel || '');
  return blocked || 'actif';
}

export class StationConvertersView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.equipment = null;
    this.converters = null;
    this.docked = false;
    this.slots = [];
    this.selectedItemId = '';
    this.hoverItemId = '';
    this.selectedSlotId = '';
    this.hoverSlotId = '';
    this.pointerDrag = null;
    this.dragGhostEl = null;
    this.dropSlotId = '';
    this.suppressClickUntil = 0;

    this.el = document.createElement('div');
    this.el.className = 'station-converters';
    this.el.innerHTML = `
      <div class="station-converters__frame">
        <section class="station-converters__left">
          <div class="station-converters__panel-head">Actifs</div>
          <div class="station-converters__slots" data-role="slots"></div>
        </section>
        <section class="station-converters__right">
          <div class="station-converters__panel-head">Réserve</div>
          <div class="station-converters__inventory" data-role="inventory"></div>
        </section>
        <section class="station-converters__details" data-role="details"></section>
      </div>
    `;

    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.inventoryEl = this.el.querySelector('[data-role="inventory"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('dragstart', (ev) => ev.preventDefault());
    this._boundPointerMove = (ev) => this.onPointerDragMove(ev);
    this._boundPointerUp = (ev) => this.onPointerDragEnd(ev);
    this.el.addEventListener('mouseover', (ev) => {
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (itemBtn) this.hoverItemId = itemBtn.dataset.itemId || '';
      if (slotNode) this.hoverSlotId = slotNode.dataset.slotId || '';
      this.renderDetails();
    });
    this.el.addEventListener('mouseout', (ev) => {
      const leavingNode = ev.target?.closest?.('button[data-item-id], [data-slot-id]');
      if (!leavingNode) return;
      const nextInside = (ev.relatedTarget && typeof ev.relatedTarget.closest === 'function') ? ev.relatedTarget.closest('button[data-item-id], [data-slot-id]') : null;
      if (nextInside) return;
      this.hoverItemId = '';
      this.hoverSlotId = '';
      this.renderDetails();
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
      const dragNode = ev.target?.closest?.('[data-drag-converter-id]');
      if (dragNode) {
        const itemId = dragNode.dataset.dragConverterId || '';
        if (itemId) {
          this.pointerDrag = {
            itemId,
            sourceSlotId: dragNode.dataset.dragSourceSlotId || '',
            startX: ev.clientX,
            startY: ev.clientY,
            active: false
          };
          window.addEventListener('pointermove', this._boundPointerMove, { passive: false });
          window.addEventListener('pointerup', this._boundPointerUp, { passive: false, once: true });
        }
      }
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (slotNode) {
        this.selectedSlotId = slotNode.dataset.slotId || '';
        const slot = this.slots.find((entry) => entry.id === this.selectedSlotId);
        this.selectedItemId = slot?.item?.itemId || '';
        this.render();
        return;
      }
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      if (itemBtn) {
        this.selectedItemId = itemBtn.dataset.itemId || '';
        this.selectedSlotId = '';
        this.render();
      }
    });
    this.el.addEventListener('dblclick', (ev) => {
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (slotNode) {
        this.selectedSlotId = slotNode.dataset.slotId || '';
        const slot = this.slots.find((entry) => entry.id === this.selectedSlotId);
        if (slot?.item?.itemId) this.performPrimaryAction(slot.item.itemId);
        return;
      }
      const itemBtn = ev.target?.closest?.('button[data-item-id]');
      if (itemBtn) this.performPrimaryAction(itemBtn.dataset.itemId || '');
    });
    this.el.addEventListener('click', (ev) => {
      if (performance.now() < this.suppressClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const actionBtn = ev.target?.closest?.('button[data-act]');
      if (!actionBtn || !this.sendCmd || actionBtn.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.runActionButton(actionBtn);
    });
  }

  runActionButton(actionBtn) {
    if (!actionBtn || !this.sendCmd) return;
    const act = actionBtn.dataset.act;
    const itemId = actionBtn.dataset.itemId || this.getFocusedItem()?.itemId || this.selectedItemId || '';
    if (!itemId) return;
    if (act === 'equip') this.cmdQueue.send('equip_item', { itemId });
    if (act === 'unequip') this.cmdQueue.send('unequip_item', { itemId });
    if (act === 'toggle') {
      const item = this.getItemById(itemId);
      this.cmdQueue.send('toggle_converter', { itemId, enabled: !(item?.converterEnabled) }, { station: true });
    }
    if (act === 'sell') this.cmdQueue.send('sell_item', { itemId });
  }

  getItemById(itemId) {
    if (!itemId) return null;
    return this.getInventoryItems().find((item) => item.itemId === itemId)
      || this.slots.find((slot) => slot.item?.itemId === itemId)?.item
      || null;
  }

  startPointerDrag(ev) {
    if (!this.pointerDrag || this.pointerDrag.active) return;
    const item = this.getItemById(this.pointerDrag.itemId);
    this.pointerDrag.active = true;
    this.suppressClickUntil = performance.now() + 250;
    this.el.classList.add('is-dragging-equipment');
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
    return {
      slotNode: node?.closest?.('[data-slot-id]') || null,
      inventoryDrop: node?.closest?.('[data-role="inventory"]') || null
    };
  }

  clearDropTarget() {
    this.el.querySelectorAll('.station-converters-slot.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
    this.dropSlotId = '';
  }

  markDropTarget(slotNode, slotId) {
    if (!slotNode || !slotId) return;
    if (this.dropSlotId === slotId && slotNode.classList.contains('is-drop-target')) return;
    this.clearDropTarget();
    this.dropSlotId = slotId;
    slotNode.classList.add('is-drop-target');
  }

  onPointerDragMove(ev) {
    if (!this.pointerDrag) return;
    const dx = ev.clientX - this.pointerDrag.startX;
    const dy = ev.clientY - this.pointerDrag.startY;
    if (!this.pointerDrag.active && ((dx * dx + dy * dy) >= 36)) this.startPointerDrag(ev);
    if (!this.pointerDrag.active) return;
    ev.preventDefault();
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
    this.markDropTarget(slotNode, slotNode.dataset.slotId || '');
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
    const { slotNode, inventoryDrop } = this.getDropInfoAt(ev.clientX, ev.clientY);
    this.clearDropTarget();
    if (!wasActive) return;
    if (inventoryDrop && drag.sourceSlotId) {
      this.cmdQueue.send('unequip_item', { itemId: drag.itemId });
      return;
    }
    if (!slotNode) return;
    const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || '')) || null;
    if (!slot) return;
    this.cmdQueue.send('equip_item_to_slot', { itemId: drag.itemId, categoryId: ITEM_CATEGORY_IDS.CONVERTER, slotId: slot.id, index: slot.index | 0 });
  }

  getInventoryItems() {
    return sortConverters(this.converters?.inventory || []);
  }

  getFocusedSlot() {
    const slotId = this.hoverSlotId || this.selectedSlotId;
    return this.slots.find((entry) => entry.id === slotId) || null;
  }

  getFocusedItem() {
    const itemId = this.hoverItemId || this.selectedItemId;
    if (itemId) return this.getInventoryItems().find((item) => item.itemId === itemId) || this.slots.find((slot) => slot.item?.itemId === itemId)?.item || null;
    return this.getFocusedSlot()?.item || null;
  }

  performPrimaryAction(itemId) {
    if (!itemId || !this.sendCmd) return;
    const item = this.getInventoryItems().find((entry) => entry.itemId === itemId)
      || this.slots.find((entry) => entry.item?.itemId === itemId)?.item
      || null;
    if (!item || item.categoryId !== ITEM_CATEGORY_IDS.CONVERTER) return;
    if (item.equipped) this.cmdQueue.send('unequip_item', { itemId });
    else this.cmdQueue.send('equip_item', { itemId });
  }

  renderSlots() {
    this.slotsEl.innerHTML = this.slots.map((slot) => {
      const selected = slot.id === (this.hoverSlotId || this.selectedSlotId);
      const content = slot.item
        ? buildItemIconMarkup(slot.item, { selected, compact: true }, 'div')
        : '<span class="station-converters-slot__emptybox"></span>';
      const state = slot.item ? formatRuntimeState(slot.item) : 'vide';
      return `
        <div class="station-converters-slot ${selected ? 'is-selected' : ''} ${slot.id === this.dropSlotId ? 'is-drop-target' : ''} ${slot.active ? 'is-active' : ''}" data-slot-id="${slot.id}" ${slot.item ? `data-drag-converter-id="${slot.item.itemId}" data-drag-source-slot-id="${slot.id}"` : ''} title="${slot.label}">
          <span class="station-converters-slot__iconwrap">${content}</span>
          <span class="station-converters-slot__label">${slot.label} • ${state}</span>
        </div>
      `;
    }).join('');
  }

  renderInventory() {
    const items = this.getInventoryItems();
    this.inventoryEl.innerHTML = items.map((item) => {
      const selected = item.itemId === (this.hoverItemId || this.selectedItemId);
      return buildItemIconButton(item, { selected, showName: false, compact: true }).replace('<button', `<button data-drag-converter-id="${item.itemId}" data-drag-source="inventory"`);
    }).join('') || '<div class="station-converters__empty">Aucun convertisseur possédé.</div>';
  }

  renderSummaryDetails(slot) {
    const summary = this.converters?.summary || { equippedCount: 0, enabledCount: 0, totalCycles: 0 };
    const active = this.converters?.active || [];
    const slotText = slot
      ? `${slot.label} : ${slot.item ? (slot.item.shortName || slot.item.name) : 'vide'}${slot.active ? ' • actif' : ''}`
      : 'Survolez un convertisseur.';
    const lines = [
      slotText,
      `Équipés : ${Math.max(0, summary.equippedCount | 0)}`,
      `Actifs : ${Math.max(0, summary.enabledCount | 0)}`,
      `Cycles : ${Math.max(0, summary.totalCycles | 0)}`
    ];
    if (active.length > 0) {
      lines.push(...active.map((entry) => `${entry.name} • ${entry.blockedLabel || 'actif'} • ${Math.round((entry.progress01 || 0) * 100)}%`));
    }
    this.detailsEl.innerHTML = renderStationInfoSection('Convertisseurs', lines);
  }

  renderConverterDetails(item) {
    const profile = item.converterProfile || {};
    const runtime = item.converterRuntime || { enabled: false, progress: 0, cycles: 0, blockedLabel: 'coupé' };
    const seconds = Math.max(0.1, profile.seconds || 1);
    const progressPct = Math.round(Math.max(0, Math.min(1, Number(runtime.progress || 0) / seconds)) * 100);
    const runtimeState = formatRuntimeState(item);
    const meta = `T${Math.max(1, item.tier | 0)}${item.equipped ? ' • équipé' : ''} • ${runtimeState}`;
    const actions = item.equipped
      ? `
        <button class="ui-btn" type="button" data-act="toggle" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>${item.converterEnabled ? 'Couper' : 'Relancer'}</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="unequip" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Retirer</button>
      `
      : `
        <button class="ui-btn" type="button" data-act="equip" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Équiper</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-act="sell" data-item-id="${item.itemId}" ${this.docked ? '' : 'disabled'}>Vendre</button>
      `;

    this.detailsEl.innerHTML = `
      <div class="station-converters__details-headline">
        <span class="station-converters__details-name">${item.name}</span>
        <span class="station-converters__details-price">Revente ${formatCredits(item.sellPriceCredits || 0)}</span>
      </div>
      ${renderItemSections(item, {
        status: `Runtime : ${runtimeState} • ${progressPct}% • cycles ${Math.max(0, runtime.cycles | 0)}`,
        source: meta
      })}
      ${renderStationInfoSection('Cycle', [`${Math.max(1, profile.inputAmount | 0)} ${profile.inputKey || '?'} → ${Math.max(1, profile.outputAmount | 0)} ${profile.outputKey || '?'}`, `${seconds.toFixed(1)}s`, `${Number(profile.energyPerSecond || 0).toFixed(2)} énergie/s`])}
      <div class="station-converters__details-actions">${actions}</div>
    `;
  }

  renderDetails() {
    const item = this.getFocusedItem();
    const slot = this.getFocusedSlot();
    if (!item) {
      this.renderSummaryDetails(slot);
      return;
    }
    this.renderConverterDetails(item);
  }

  render() {
    this.slots = buildConverterSlots(this.converters);
    const inventoryIds = new Set(this.getInventoryItems().map((item) => item.itemId));
    const slotIds = new Set(this.slots.map((slot) => slot.item?.itemId).filter(Boolean));
    if (this.selectedItemId && !inventoryIds.has(this.selectedItemId) && !slotIds.has(this.selectedItemId)) this.selectedItemId = '';
    if (this.hoverItemId && !inventoryIds.has(this.hoverItemId) && !slotIds.has(this.hoverItemId)) this.hoverItemId = '';
    this.renderSlots();
    this.renderInventory();
    this.renderDetails();
  }

  update(equipment, docked) {
    this.equipment = equipment || null;
    this.converters = equipment?.converters || null;
    this.docked = !!docked;
    this.render();
  }
}
