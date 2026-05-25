import { renderStationInfoSection, renderStationChips } from '../station/StationItemVisuals.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    else if (ammo.effectType === 'poison') lines.push(`Poison ${magnitude.toFixed(1)}/s · ${duration.toFixed(1)}s`);
    else if (ammo.effectType === 'stun') lines.push(`Étourdissement · ${duration.toFixed(1)}s`);
    else lines.push(ammo.summary || ammo.effectType);
  }
  return lines.filter(Boolean);
}

function ammoTooltip(item) {
  if (!item) return 'Munition';
  const lines = [];
  lines.push(`${item.name || 'Roquettes'} [T${Math.max(1, item.tier | 0)}]`);
  lines.push(`Stock : ${Math.max(0, item.ammoQuantity | 0)}`);
  lines.push(...ammoEffectLines(item));
  return lines.join('\n');
}

function sortAmmo(items) {
  return [...(items || [])].sort((a, b) => {
    if ((a.tier | 0) !== (b.tier | 0)) return (a.tier | 0) - (b.tier | 0);
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function normalizeSlots(equipment) {
  const slots = Array.isArray(equipment?.rocketAmmo?.slots) ? equipment.rocketAmmo.slots : [];
  return [0, 1].map((slot) => {
    const entry = slots.find((s) => (s?.slot | 0) === slot) || slots[slot] || null;
    return {
      slot,
      active: !!entry?.active || ((equipment?.rocketAmmo?.activeSlot | 0) === slot),
      item: entry?.item || null
    };
  });
}

export class ShipAmmoView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.equipment = null;
    this.selectedItemId = '';
    this.selectedSlot = 0;
    this.focusKind = 'inventory';

    this.el = document.createElement('div');
    this.el.className = 'ship-ammo-panel';
    this.el.innerHTML = `
      <section class="ship-ammo-panel__slots" data-role="slots"></section>
      <section class="ship-ammo-panel__inventory">
        <div class="ship-ammo-panel__section-head">
          <div>
            <div class="ship-ammo-panel__eyebrow">Soute munitions</div>
            <div class="ship-ammo-panel__title">Roquettes disponibles</div>
          </div>
          <div class="ship-ammo-panel__count" data-role="count">—</div>
        </div>
        <div class="ship-ammo-panel__grid" data-role="grid"></div>
      </section>
      <aside class="ship-ammo-panel__details">
        <div class="ship-ammo-panel__section-head">
          <div>
            <div class="ship-ammo-panel__eyebrow">Gestion</div>
            <div class="ship-ammo-panel__title" data-role="title">Munitions</div>
          </div>
        </div>
        <div class="ship-ammo-panel__content" data-role="content"></div>
        <div class="ship-ammo-panel__actions" data-role="actions"></div>
      </aside>
    `;

    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.gridEl = this.el.querySelector('[data-role="grid"]');
    this.countEl = this.el.querySelector('[data-role="count"]');
    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.contentEl = this.el.querySelector('[data-role="content"]');
    this.actionsEl = this.el.querySelector('[data-role="actions"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const slotBtn = ev.target?.closest?.('[data-ship-ammo-slot]');
      if (slotBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        this.focusKind = 'slot';
        this.selectedSlot = Math.max(0, Math.min(1, slotBtn.dataset.shipAmmoSlot | 0));
        this.selectedItemId = slotBtn.dataset.itemId || '';
        this.render();
        return;
      }
      const ammoCard = ev.target?.closest?.('[data-ship-ammo-id]');
      if (ammoCard) {
        ev.preventDefault();
        ev.stopPropagation();
        this.focusKind = 'inventory';
        this.selectedItemId = ammoCard.dataset.shipAmmoId || '';
        this.render();
        return;
      }
      const action = ev.target?.closest?.('[data-ship-ammo-action]');
      if (action) {
        ev.preventDefault();
        ev.stopPropagation();
        this.runAction(action);
      }
    });
  }

  getInventory() {
    return sortAmmo(this.equipment?.rocketAmmo?.inventory || []);
  }

  getSlots() {
    return normalizeSlots(this.equipment);
  }

  getAllAmmoItems() {
    const map = new Map();
    for (const item of this.getInventory()) if (item?.itemId) map.set(item.itemId, item);
    for (const slot of this.getSlots()) if (slot.item?.itemId) map.set(slot.item.itemId, slot.item);
    return [...map.values()];
  }

  getFocusedItem() {
    if (this.focusKind === 'slot') return this.getSlots()[this.selectedSlot]?.item || null;
    if (this.selectedItemId) return this.getAllAmmoItems().find((item) => item.itemId === this.selectedItemId) || null;
    return this.getInventory()[0] || this.getSlots().find((slot) => slot.item)?.item || null;
  }

  renderSlots() {
    const slots = this.getSlots();
    this.slotsEl.innerHTML = `
      <div class="ship-ammo-panel__section-head">
        <div>
          <div class="ship-ammo-panel__eyebrow">Slots de tir</div>
          <div class="ship-ammo-panel__title">Roquettes chargées</div>
        </div>
      </div>
      <div class="ship-ammo-slots">
        ${slots.map((slot) => {
          const item = slot.item;
          const selected = this.focusKind === 'slot' && this.selectedSlot === slot.slot;
          return `
            <button type="button" class="ship-ammo-slot ${slot.active ? 'is-active' : ''} ${selected ? 'is-selected' : ''} ${item ? 'is-loaded' : 'is-empty'}" data-ship-ammo-slot="${slot.slot}" data-item-id="${escapeHtml(item?.itemId || '')}">
              <span class="ship-ammo-slot__index">Slot ${slot.slot + 1}${slot.active ? ' · actif' : ''}</span>
              <span class="ship-ammo-slot__body">
                <span class="ship-ammo-slot__glyph">☄</span>
                <span class="ship-ammo-slot__text">
                  <b>${escapeHtml(item?.shortName || item?.name || 'Vide')}</b>
                  <small>${item ? `${Math.max(0, item.ammoQuantity | 0)} en stock` : 'Aucune munition chargée'}</small>
                </span>
              </span>
            </button>`;
        }).join('')}
      </div>`;
  }

  renderInventory() {
    const items = this.getInventory();
    const activeId = this.focusKind === 'inventory' ? (this.selectedItemId || items[0]?.itemId || '') : '';
    const total = this.getAllAmmoItems().reduce((sum, item) => sum + Math.max(0, item.ammoQuantity | 0), 0);
    this.countEl.textContent = `${total} roquettes`;
    this.gridEl.innerHTML = items.map((item) => {
      const selected = item.itemId === activeId;
      const stats = ammoEffectLines(item).slice(0, 3).join(' • ') || 'Munition standard';
      return `
        <button type="button" class="ship-ammo-card ${selected ? 'is-selected' : ''}" data-ship-ammo-id="${escapeHtml(item.itemId)}" title="${escapeHtml(ammoTooltip(item))}">
          <span class="ship-ammo-card__tier">T${Math.max(1, item.tier | 0)}</span>
          <span class="ship-ammo-card__glyph">☄</span>
          <span class="ship-ammo-card__name">${escapeHtml(item.shortName || item.name || 'Roquettes')}</span>
          <span class="ship-ammo-card__qty">Stock ×${Math.max(0, item.ammoQuantity | 0)}</span>
          <span class="ship-ammo-card__stats">${escapeHtml(stats)}</span>
        </button>`;
    }).join('') || '<div class="ship-ammo-panel__empty">Aucune roquette libre en soute. Produis-en dans l’atelier de roquettes ou achète-en en station pirate.</div>';
  }

  renderDetails() {
    const item = this.getFocusedItem();
    const slots = this.getSlots();
    const assignedSlot = item ? slots.find((slot) => slot.item?.itemId === item.itemId) : null;
    const focusSlot = slots[this.selectedSlot] || slots[0];

    if (!item) {
      this.titleEl.textContent = 'Aucune munition';
      this.contentEl.innerHTML = renderStationInfoSection('Soute vide', [
        'Cet onglet sert seulement à charger les roquettes possédées dans les slots de tir.',
        'Les achats se font en station pirate, et la production dans l’atelier de roquettes.'
      ]);
      this.actionsEl.innerHTML = '';
      return;
    }

    this.titleEl.textContent = item.name || 'Roquettes';
    this.contentEl.innerHTML = [
      renderStationInfoSection('Stock', [
        `Quantité : ${Math.max(0, item.ammoQuantity | 0)}`,
        assignedSlot ? `Chargée dans le slot ${assignedSlot.slot + 1}${assignedSlot.active ? ' · actif' : ''}` : 'Non chargée',
        `Tier : ${Math.max(1, item.tier | 0)}`
      ]),
      renderStationInfoSection('Stats', renderStationChips(ammoEffectLines(item), 'Munition standard'))
    ].join('');

    if (this.focusKind === 'slot' && focusSlot?.item) {
      this.actionsEl.innerHTML = `
        <button class="ui-btn" type="button" data-ship-ammo-action="switch" data-slot="${focusSlot.slot}" ${focusSlot.active ? 'disabled' : ''}>Définir actif</button>
        <button class="ui-btn ui-btn--ghost" type="button" data-ship-ammo-action="unassign" data-slot="${focusSlot.slot}">Décharger le slot</button>`;
      return;
    }

    this.actionsEl.innerHTML = `
      <button class="ui-btn" type="button" data-ship-ammo-action="assign" data-slot="0" data-item-id="${escapeHtml(item.itemId)}">Charger slot 1</button>
      <button class="ui-btn" type="button" data-ship-ammo-action="assign" data-slot="1" data-item-id="${escapeHtml(item.itemId)}">Charger slot 2</button>
      ${assignedSlot ? `<button class="ui-btn ui-btn--ghost" type="button" data-ship-ammo-action="switch" data-slot="${assignedSlot.slot}" ${assignedSlot.active ? 'disabled' : ''}>Définir actif</button>` : ''}`;
  }

  runAction(btn) {
    if (!btn || !this.sendCmd) return;
    const action = btn.dataset.shipAmmoAction || '';
    const slot = Math.max(0, Math.min(1, btn.dataset.slot | 0));
    const itemId = btn.dataset.itemId || this.selectedItemId || this.getFocusedItem()?.itemId || '';
    if (action === 'assign' && itemId) this.sendCmd('assign_rocket_ammo', { itemId, slot });
    else if (action === 'unassign') this.sendCmd('unassign_rocket_ammo', { slot });
    else if (action === 'switch') this.sendCmd('switch_rocket_slot', { slot });
  }

  render() {
    const ids = new Set(this.getAllAmmoItems().map((item) => item.itemId));
    if (this.selectedItemId && !ids.has(this.selectedItemId)) this.selectedItemId = '';
    this.renderSlots();
    this.renderInventory();
    this.renderDetails();
  }

  update(equipment) {
    this.equipment = equipment || null;
    this.render();
  }
}
