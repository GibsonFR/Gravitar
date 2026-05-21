import { buildItemIconMarkup } from '../station/StationItemVisuals.js';

function buildConverterSlots(converters) {
  const equipped = [...(converters?.equipped || [])];
  const slotCap = Math.max(0, converters?.slotCap | 0);
  const slots = [];
  for (let i = 0; i < slotCap; i += 1) {
    const item = equipped[i] || null;
    slots.push({
      id: `flight-converter-slot-${i}`,
      index: i,
      label: `Convertisseur ${i + 1}`,
      item,
      active: !!item?.converterEnabled
    });
  }
  return slots;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export class ConvertersPanelView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.equipment = null;
    this.converters = null;
    this.slots = [];
    this.selectedSlotId = '';
    this.hoverSlotId = '';

    this.el = document.createElement('section');
    this.el.className = 'converters-panel';
    this.el.innerHTML = `
      <div class="converters-panel__header">
        <div>
          <div class="converters-panel__eyebrow">Systèmes de bord</div>
          <h2 class="converters-panel__title">Convertisseurs</h2>
          <div class="converters-panel__summary" data-role="summary">0 / 0 actifs</div>
        </div>
      </div>
      <div class="converters-panel__slots" data-role="slots"></div>
      <div class="converters-panel__runtime" data-role="runtime"></div>
      <div class="converters-panel__details" data-role="details"></div>
    `;

    this.summaryEl = this.el.querySelector('[data-role="summary"]');
    this.slotsEl = this.el.querySelector('[data-role="slots"]');
    this.runtimeEl = this.el.querySelector('[data-role="runtime"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');

    this.el.addEventListener('mouseover', (ev) => {
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (!slotNode) return;
      this.hoverSlotId = slotNode.dataset.slotId || '';
      this.renderDetails();
    });

    this.el.addEventListener('mouseout', (ev) => {
      const leavingNode = ev.target?.closest?.('[data-slot-id]');
      if (!leavingNode) return;
      const nextInside = (ev.relatedTarget && typeof ev.relatedTarget.closest === 'function') ? ev.relatedTarget.closest('[data-slot-id]') : null;
      if (nextInside) return;
      this.hoverSlotId = '';
      this.renderDetails();
    });

    this.el.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (!slotNode) return;
      this.selectedSlotId = slotNode.dataset.slotId || '';
      this.render();
    });

    this.el.addEventListener('dblclick', (ev) => {
      const slotNode = ev.target?.closest?.('[data-slot-id]');
      if (!slotNode) return;
      const slot = this.slots.find((entry) => entry.id === (slotNode.dataset.slotId || ''));
      if (slot?.item?.itemId && this.sendCmd) this.sendCmd('toggle_converter', { itemId: slot.item.itemId });
    });

    this.el.addEventListener('click', (ev) => {
      const btn = ev.target?.closest?.('button[data-act]');
      if (!btn || !this.sendCmd) return;
      const itemId = btn.dataset.itemId || this.getFocusedSlot()?.item?.itemId || '';
      if (!itemId) return;
      if (btn.dataset.act === 'toggle') this.sendCmd('toggle_converter', { itemId });
    });
  }

  getFocusedSlot() {
    const slotId = this.hoverSlotId || this.selectedSlotId;
    return this.slots.find((entry) => entry.id === slotId) || null;
  }

  renderSummary() {
    const summary = this.converters?.summary || { equippedCount: 0, enabledCount: 0, totalCycles: 0 };
    this.summaryEl.textContent = `${Math.max(0, summary.enabledCount | 0)} / ${Math.max(0, summary.equippedCount | 0)} actifs • ${Math.max(0, summary.totalCycles | 0)} cycles`;
  }

  renderSlots() {
    this.slotsEl.innerHTML = this.slots.map((slot) => {
      const selected = slot.id === (this.hoverSlotId || this.selectedSlotId);
      const icon = slot.item
        ? buildItemIconMarkup(slot.item, { compact: true, selected }, 'div')
        : '<span class="converters-panel-slot__empty"></span>';
      const progress01 = slot.item?.converterRuntime && slot.item?.converterProfile
        ? clamp01(Number(slot.item.converterRuntime.progress || 0) / Math.max(0.1, Number(slot.item.converterProfile.seconds || 1)))
        : 0;
      return `
        <button class="converters-panel-slot ${selected ? 'is-selected' : ''} ${slot.active ? 'is-active' : ''}" type="button" data-slot-id="${slot.id}" title="${slot.label}">
          <span class="converters-panel-slot__iconwrap">${icon}</span>
          <span class="converters-panel-slot__meta">
            <span class="converters-panel-slot__label">${slot.label}</span>
            <span class="converters-panel-slot__state">${slot.item ? (slot.active ? 'Actif' : 'Coupé') : 'Vide'}</span>
          </span>
          <span class="converters-panel-slot__bar"><span style="width:${Math.round(progress01 * 100)}%"></span></span>
        </button>
      `;
    }).join('') || '<div class="converters-panel__empty">Aucun slot convertisseur.</div>';
  }

  renderRuntime() {
    const active = this.converters?.active || [];
    this.runtimeEl.innerHTML = active.length
      ? active.map((entry) => `
          <div class="converters-runtime-row ${entry.enabled ? 'is-enabled' : ''}">
            <span class="converters-runtime-row__name">${entry.name}</span>
            <span class="converters-runtime-row__flow">${Math.max(0, entry.inputAmount | 0)} ${entry.inputKey || '?'} → ${Math.max(0, entry.outputAmount | 0)} ${entry.outputKey || '?'}</span>
            <span class="converters-runtime-row__pct">${Math.round(clamp01(entry.progress01) * 100)}%</span>
          </div>
        `).join('')
      : '<div class="converters-panel__empty">Aucun convertisseur équipé.</div>';
  }

  renderDetails() {
    const slot = this.getFocusedSlot();
    const item = slot?.item || null;
    if (!item) {
      this.detailsEl.innerHTML = `
        <div class="converters-panel__detail-line">Survole un slot convertisseur pour afficher son runtime.</div>
        <div class="converters-panel__detail-line">Depuis cette fenêtre en vol, tu peux seulement couper ou relancer un convertisseur déjà équipé.</div>
      `;
      return;
    }

    const profile = item.converterProfile || {};
    const runtime = item.converterRuntime || { enabled: false, progress: 0, cycles: 0 };
    const seconds = Math.max(0.1, Number(profile.seconds || 1));
    const progressPct = Math.round(clamp01(Number(runtime.progress || 0) / seconds) * 100);

    this.detailsEl.innerHTML = `
      <div class="converters-panel__detail-head">
        <span class="converters-panel__detail-name">${item.name}</span>
        <span class="converters-panel__detail-state">${item.converterEnabled ? 'Actif' : 'Coupé'}</span>
      </div>
      <div class="converters-panel__detail-line">Cycle : ${Math.max(1, profile.inputAmount | 0)} ${profile.inputKey || '?'} → ${Math.max(1, profile.outputAmount | 0)} ${profile.outputKey || '?'} • ${seconds.toFixed(1)}s</div>
      <div class="converters-panel__detail-line">Runtime : progression ${progressPct}% • cycles ${Math.max(0, runtime.cycles | 0)} • ${Number(profile.energyPerSecond || 0).toFixed(2)} énergie/s</div>
      <div class="converters-panel__detail-line">${item.description || ''}</div>
      <div class="converters-panel__actions">
        <button class="ui-btn" type="button" data-act="toggle" data-item-id="${item.itemId}">${item.converterEnabled ? 'Couper' : 'Relancer'}</button>
      </div>
    `;
  }

  render() {
    this.slots = buildConverterSlots(this.converters);
    if (this.selectedSlotId && !this.slots.some((slot) => slot.id === this.selectedSlotId)) this.selectedSlotId = '';
    if (this.hoverSlotId && !this.slots.some((slot) => slot.id === this.hoverSlotId)) this.hoverSlotId = '';
    this.renderSummary();
    this.renderSlots();
    this.renderRuntime();
    this.renderDetails();
  }

  update(equipment) {
    this.equipment = equipment || null;
    this.converters = equipment?.converters || null;
    this.render();
  }
}
