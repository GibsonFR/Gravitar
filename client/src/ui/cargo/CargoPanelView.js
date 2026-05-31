import { formatInt } from './CargoFormat.js';

function toInt(value) {
  const n = Math.floor(Number(value) || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function escapeAttr(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

export class CargoPanelView {
  constructor(sendCmd) {
    this.el = document.createElement('section');
    this.el.className = 'cargo-panel';

    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;

    this.el.innerHTML = `
      <div class="cargo-panel__header">
        <div>
          <div class="cargo-panel__eyebrow">Soute</div>
          <h2 class="cargo-panel__title">Cargo</h2>
        </div>
        <div class="cargo-panel__capacity-wrap">
          <div class="cargo-panel__eyebrow">Capacité</div>
          <div class="cargo-panel__capacity" data-role="capacityText">0 / 0</div>
        </div>
      </div>
      <div class="cargo-panel__meter-block">
        <div class="cargo-panel__meter-topline">
          <span data-role="cargoLabel">0 / 0</span>
          <span data-role="cargoPercent">0%</span>
        </div>
        <div class="cargo-panel__meter-track">
          <div class="cargo-panel__meter-fill" data-role="cargoFill"></div>
        </div>
      </div>
      <div class="cargo-panel__table-head" data-role="head">
        <span>Ressource</span>
        <span>Qté</span>
        <span>Larguer</span>
      </div>
      <div class="cargo-panel__rows" data-role="rows"></div>
    `;

    this.capacityTextEl = this.el.querySelector('[data-role="capacityText"]');
    this.cargoLabelEl = this.el.querySelector('[data-role="cargoLabel"]');
    this.cargoPercentEl = this.el.querySelector('[data-role="cargoPercent"]');
    this.cargoFillEl = this.el.querySelector('[data-role="cargoFill"]');
    this.rowsEl = this.el.querySelector('[data-role="rows"]');
    this.headEl = this.el.querySelector('[data-role="head"]');

    this.rowsEl.addEventListener('pointerdown', (ev) => this.handlePointerDown(ev));
    this.rowsEl.addEventListener('click', (ev) => {
      if (ev.target?.closest?.('button[data-cargo-jettison]')) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
  }

  handlePointerDown(ev) {
    const btn = ev.target?.closest?.('button[data-cargo-jettison]');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!this.sendCmd || btn.disabled) return;

    const key = String(btn.dataset.resourceKey || '');
    const available = toInt(btn.dataset.available);
    if (!key || available <= 0) return;

    const amountMode = btn.dataset.amount || '1';
    const amount = amountMode === 'all' ? available : Math.min(available, toInt(amountMode));
    if (amount <= 0) return;

    this.sendCmd('jettison', { resourceKey: key, amount });
  }

  update(inv, ctx) {
    const safeInv = inv || {
      cargoUsed: 0,
      cargoMax: 0,
      cargoFill01: 0,
      resources: []
    };

    const isDocked = !!ctx?.isDocked;
    const canJettison = !isDocked;
    this.el.classList.toggle('cargo-panel--jettison', canJettison);
    this.el.classList.toggle('cargo-panel--docked', isDocked);

    const cargoText = `${formatInt(safeInv.cargoUsed || 0)} / ${formatInt(safeInv.cargoMax || 0)}`;
    this.capacityTextEl.textContent = cargoText;
    this.cargoLabelEl.textContent = cargoText;
    this.cargoPercentEl.textContent = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;
    this.cargoFillEl.style.width = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;

    const rows = (safeInv.resources?.length ? safeInv.resources : []).filter((e) => (e?.amount || 0) > 0);

    this.headEl.innerHTML = `<span>Ressource</span><span>Qté</span><span>Larguer</span>`;

    this.rowsEl.innerHTML = rows.map((entry) => {
      const amount = toInt(entry.amount || 0);
      const stocked = amount > 0;
      const key = escapeAttr(entry.key || '');
      const actions = canJettison
        ? `<div class="cargo-row__actions">
            <button class="cargo-row__jettison cargo-row__jettison--ghost" type="button" data-cargo-jettison="1" data-resource-key="${key}" data-available="${amount}" data-amount="1" ${stocked ? '' : 'disabled'}>Jeter 1</button>
            <button class="cargo-row__jettison" type="button" data-cargo-jettison="1" data-resource-key="${key}" data-available="${amount}" data-amount="all" ${stocked ? '' : 'disabled'}>Tout</button>
          </div>`
        : '<span class="cargo-row__locked">—</span>';

      return `
        <div class="cargo-row ${stocked ? 'is-stocked' : ''}" data-resource="${key}" data-amount="${amount}">
          <div class="cargo-row__resource">
            <span class="cargo-row__swatch" style="background:${escapeAttr(entry.colorHex || '#d0d7e4')}"></span>
            <span>${escapeAttr(entry.name)}</span>
          </div>
          <span class="cargo-row__qty">${formatInt(amount)}</span>
          ${actions}
        </div>
      `;
    }).join('') || `<div class="cargo-panel__empty">Soute vide.</div>`;
  }
}
