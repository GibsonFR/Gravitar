import { buildItemIconMarkup } from '../station/StationItemVisuals.js';

function esc(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function byCategory(equipment) {
  const map = new Map();
  for (const item of equipment?.ownedItems || []) {
    if (!item?.categoryId) continue;
    const list = map.get(item.categoryId) || [];
    list.push(item);
    map.set(item.categoryId, list);
  }
  for (const item of equipment?.equippedItems || []) {
    if (!item?.categoryId) continue;
    const list = map.get(item.categoryId) || [];
    if (!list.some((x) => x.itemId === item.itemId)) list.push(item);
    map.set(item.categoryId, list);
  }
  return map;
}

function equipmentSlots(equipment) {
  const equipped = equipment?.equippedItems || [];
  const cats = [
    ['engine', 'Propulseur'],
    ['weapon', 'Arme'],
    ['defense', 'Bouclier'],
    ['module', 'Module']
  ];
  const slots = [];
  for (const [cat, label] of cats) {
    const items = equipped.filter((it) => it.categoryId === cat);
    if (cat === 'module') {
      const cap = Math.max(items.length, 4);
      for (let i = 0; i < cap; i += 1) slots.push({ id: `${cat}-${i}`, categoryId: cat, label: `${label} ${i + 1}`, item: items[i] || null });
    } else {
      slots.push({ id: cat, categoryId: cat, label, item: items[0] || null });
    }
  }
  return slots;
}

function converterSlots(equipment) {
  const converters = equipment?.converters || null;
  const equipped = [...(converters?.equipped || [])];
  const slotCap = Math.max(0, converters?.slotCap | 0);
  const slots = [];
  for (let i = 0; i < slotCap; i += 1) {
    const item = equipped[i] || null;
    slots.push({
      id: `converter-${i}`,
      index: i,
      label: `Convertisseur ${i + 1}`,
      item,
      active: !!item?.converterEnabled
    });
  }
  return slots;
}

function bonusLines(item) {
  const bonuses = item?.bonuses || {};
  const labels = {
    damageFlat: 'attack damage',
    enginePct: 'engine power',
    damageMultPct: 'damage',
    fireRatePct: 'fire rate',
    critChancePct: 'crit chance',
    armorPenFlat: 'armor pen',
    hpFlat: 'hull',
    shieldFlat: 'shield',
    armorFlat: 'armor',
    energyFlat: 'energy',
    energyRegenFlat: 'energy regen',
    cooldownReductionPct: 'cooldown',
    cargoFlat: 'cargo'
  };
  return Object.entries(bonuses).slice(0, 8).map(([key, raw]) => {
    const n = Number(raw) || 0;
    const sign = n > 0 ? '+' : '';
    const value = key.endsWith('Pct') ? `${sign}${Math.round(n * 100)}%` : `${sign}${Math.round(n * 10) / 10}`;
    return `${value} ${labels[key] || key}`;
  });
}

export class ShipPanelView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.equipment = null;
    this.tab = 'equipment';
    this.selectedId = '';

    this.el = document.createElement('section');
    this.el.className = 'ship-panel';
    this.el.innerHTML = '';

    this.el.addEventListener('click', (ev) => {
      const tab = ev.target?.closest?.('[data-ship-tab]');
      if (tab) {
        this.tab = tab.dataset.shipTab || this.tab;
        this.render();
        return;
      }
      const item = ev.target?.closest?.('[data-ship-item]');
      if (item) {
        this.selectedId = item.dataset.shipItem || '';
        this.render();
        return;
      }
      const btn = ev.target?.closest?.('[data-ship-act]');
      if (btn && this.sendCmd) {
        const itemId = btn.dataset.itemId || this.selectedId || '';
        if (!itemId) return;
        if (btn.dataset.shipAct === 'toggle-converter') {
          const item = this.findItem(itemId);
          this.sendCmd('toggle_converter', { itemId, enabled: !(item?.converterEnabled) });
        }
      }
    });
  }

  findItem(itemId) {
    const id = String(itemId || '');
    return [
      ...(this.equipment?.ownedItems || []),
      ...(this.equipment?.equippedItems || []),
      ...(this.equipment?.converters?.equipped || [])
    ].find((it) => it?.itemId === id) || null;
  }

  renderEquipmentTab() {
    const slots = equipmentSlots(this.equipment);
    const cats = byCategory(this.equipment);
    const selected = this.findItem(this.selectedId) || slots.find((s) => s.item)?.item || null;
    if (!this.selectedId && selected?.itemId) this.selectedId = selected.itemId;

    const slotHtml = slots.map((slot) => {
      const item = slot.item;
      const selectedCls = item?.itemId && item.itemId === this.selectedId ? 'is-selected' : '';
      return `
        <button class="ship-slot ${item ? 'is-filled' : ''} ${selectedCls}" type="button" ${item ? `data-ship-item="${esc(item.itemId)}"` : ''}>
          <span class="ship-slot__label">${esc(slot.label)}</span>
          <span class="ship-slot__icon">${item ? buildItemIconMarkup(item, { compact: true }, 'span') : '—'}</span>
          <span class="ship-slot__name">${item ? esc(item.shortName || item.name) : 'Vide'}</span>
        </button>`;
    }).join('');

    const inventoryHtml = [...cats.entries()].map(([cat, items]) => `
      <section class="ship-inventory-group">
        <h3>${esc(items[0]?.categoryName || cat)}</h3>
        <div class="ship-inventory-list">
          ${items.map((item) => `
            <button class="ship-inventory-item ${item.itemId === this.selectedId ? 'is-selected' : ''} ${item.equipped ? 'is-equipped' : ''}" type="button" data-ship-item="${esc(item.itemId)}">
              <span>${esc(item.shortName || item.name)}</span>
              <b>Mk ${item.mark || item.tier || 1}</b>
            </button>`).join('')}
        </div>
      </section>
    `).join('');

    const detail = selected ? `
      <div class="ship-detail">
        <h3>${esc(selected.name || selected.shortName)}</h3>
        <div class="ship-detail__meta">Mk ${selected.mark || selected.tier || 1} · ${esc(selected.categoryName || '')}${selected.equipped ? ' · équipé' : ''}</div>
        <div class="ship-detail__tags">${(selected.tags || []).map((t) => `<span>${esc(t)}</span>`).join('') || '<span>standard</span>'}</div>
        <ul>${bonusLines(selected).map((line) => `<li>${esc(line)}</li>`).join('') || '<li>Aucune stat spéciale.</li>'}</ul>
      </div>
    ` : `<div class="ship-detail"><h3>Aucun équipement</h3><p>Fabrique ou récupère des équipements pour les gérer ici.</p></div>`;

    return `
      <div class="ship-panel__grid">
        <section class="ship-panel__slots">${slotHtml}</section>
        <section class="ship-panel__inventory">${inventoryHtml || '<div class="ship-panel__empty">Aucun équipement.</div>'}</section>
        ${detail}
      </div>`;
  }

  renderConvertersTab() {
    const converters = this.equipment?.converters || null;
    const slots = converterSlots(this.equipment);
    const summary = converters?.summary || { equippedCount: 0, enabledCount: 0, totalCycles: 0 };
    const selected = this.findItem(this.selectedId) || slots.find((s) => s.item)?.item || null;
    const runtime = selected?.converterRuntime || null;
    const profile = selected?.converterProfile || null;
    const progress = runtime && profile ? clamp01(Number(runtime.progress || 0) / Math.max(0.1, Number(profile.seconds || 1))) : 0;

    return `
      <div class="ship-converters">
        <div class="ship-converters__summary">${summary.enabledCount | 0} / ${summary.equippedCount | 0} actifs · ${summary.totalCycles | 0} cycles</div>
        <div class="ship-converters__slots">
          ${slots.map((slot) => `
            <button class="ship-converter-slot ${slot.active ? 'is-active' : ''} ${slot.item?.itemId === this.selectedId ? 'is-selected' : ''}" type="button" ${slot.item ? `data-ship-item="${esc(slot.item.itemId)}"` : ''}>
              <span>${slot.item ? buildItemIconMarkup(slot.item, { compact: true }, 'span') : '—'}</span>
              <b>${esc(slot.label)}</b>
              <small>${slot.item ? esc(slot.item.shortName || slot.item.name) : 'Vide'}</small>
            </button>`).join('')}
        </div>
        <div class="ship-detail">
          ${selected ? `
            <h3>${esc(selected.name || selected.shortName)}</h3>
            <div class="ship-detail__meta">${selected.converterEnabled ? 'Actif' : 'Coupé'}${profile ? ` · ${Number(profile.seconds || 0).toFixed(1)}s/cycle` : ''}</div>
            <div class="ship-progress"><span style="width:${Math.round(progress * 100)}%"></span></div>
            <button class="ui-btn" type="button" data-ship-act="toggle-converter" data-item-id="${esc(selected.itemId)}">${selected.converterEnabled ? 'Couper' : 'Relancer'}</button>
          ` : '<h3>Aucun convertisseur</h3><p>Les convertisseurs équipés apparaîtront ici.</p>'}
        </div>
      </div>`;
  }

  renderAmmoTab() {
    const ammoSlots = this.equipment?.rocketAmmo?.slots || [];
    const ammo = this.equipment?.rocketAmmo?.inventory || [];
    return `
      <div class="ship-ammo">
        <section>
          <h3>Munitions assignées</h3>
          ${ammoSlots.map((slot, i) => `
            <div class="ship-ammo-row">
              <span>Slot ${i + 1}</span>
              <b>${slot?.item ? esc(slot.item.shortName || slot.item.name) : 'Vide'}</b>
            </div>`).join('') || '<div class="ship-panel__empty">Aucun slot.</div>'}
        </section>
        <section>
          <h3>Stock munitions</h3>
          ${ammo.map((it) => `
            <div class="ship-ammo-row">
              <span>${esc(it.shortName || it.name)}</span>
              <b>${it.ammoQuantity | 0}</b>
            </div>`).join('') || '<div class="ship-panel__empty">Aucune munition.</div>'}
        </section>
      </div>`;
  }

  render() {
    const body = this.tab === 'converters'
      ? this.renderConvertersTab()
      : this.tab === 'ammo'
        ? this.renderAmmoTab()
        : this.renderEquipmentTab();

    this.el.innerHTML = `
      <div class="ship-panel__head">
        <div>
          <div class="ship-panel__eyebrow">Vaisseau</div>
          <h2>Gestion du vaisseau</h2>
        </div>
        <div class="ship-panel__tabs">
          <button type="button" data-ship-tab="equipment" class="${this.tab === 'equipment' ? 'is-active' : ''}">Équipement</button>
          <button type="button" data-ship-tab="converters" class="${this.tab === 'converters' ? 'is-active' : ''}">Convertisseurs</button>
          <button type="button" data-ship-tab="ammo" class="${this.tab === 'ammo' ? 'is-active' : ''}">Munitions</button>
        </div>
      </div>
      ${body}
    `;
  }

  update(equipment) {
    this.equipment = equipment || null;
    this.render();
  }
}
