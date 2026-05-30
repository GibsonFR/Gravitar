import { formatCredits, formatInt } from './CargoFormat.js';

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
          <div class="cargo-panel__credits" data-role="credits">0 cr</div>
        </div>
        <div class="cargo-panel__total-wrap">
          <div class="cargo-panel__eyebrow">Valeur totale</div>
          <div class="cargo-panel__total" data-role="totalValue">0 cr</div>
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
      <div class="cargo-panel__hint" data-role="hint"></div>
      <div class="cargo-panel__table-head" data-role="head">
        <span>Ressource</span>
        <span>Qté</span>
        <span>Prix/u</span>
        <span>Total</span>
      </div>
      <div class="cargo-panel__rows" data-role="rows"></div>
    `;

    this.totalValueEl = this.el.querySelector('[data-role="totalValue"]');
    this.creditsEl = this.el.querySelector('[data-role="credits"]');
    this.cargoLabelEl = this.el.querySelector('[data-role="cargoLabel"]');
    this.cargoPercentEl = this.el.querySelector('[data-role="cargoPercent"]');
    this.cargoFillEl = this.el.querySelector('[data-role="cargoFill"]');
    this.rowsEl = this.el.querySelector('[data-role="rows"]');
    this.headEl = this.el.querySelector('[data-role="head"]');
    this.hintEl = this.el.querySelector('[data-role="hint"]');

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
      credits: 0,
      cargoUsed: 0,
      cargoMax: 0,
      cargoFill01: 0,
      totalSellValue: 0,
      resources: []
    };

    const isDocked = !!ctx?.isDocked;
    const canJettison = !isDocked;
    this.el.classList.toggle('cargo-panel--jettison', canJettison);
    this.el.classList.toggle('cargo-panel--docked', isDocked);

    this.totalValueEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.creditsEl.textContent = formatCredits(safeInv.credits || 0);
    this.cargoLabelEl.textContent = `${formatInt(safeInv.cargoUsed || 0)} / ${formatInt(safeInv.cargoMax || 0)}`;
    this.cargoPercentEl.textContent = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;
    this.cargoFillEl.style.width = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;

    if (this.hintEl) {
      this.hintEl.textContent = canJettison
        ? 'Hors station : vous pouvez larguer des ressources pour libérer de la soute.'
        : 'Amarré : le largage est désactivé. Utilisez le commerce ou désamarrez.';
    }

    const rows = (safeInv.resources?.length ? safeInv.resources : []).filter((e) => (e?.amount || 0) > 0);

    this.headEl.innerHTML = canJettison
      ? `<span>Ressource</span><span>Qté</span><span>Prix/u</span><span>Total</span><span>Larguer</span>`
      : `<span>Ressource</span><span>Qté</span><span>Prix/u</span><span>Total</span>`;

    this.rowsEl.innerHTML = rows.map((entry) => {
      const amount = toInt(entry.amount || 0);
      const stocked = amount > 0;
      const key = escapeAttr(entry.key || '');
      const actions = canJettison
        ? `<div class="cargo-row__actions">
            <button class="ui-btn ui-btn--ghost cargo-row__jettison" type="button" data-cargo-jettison="1" data-resource-key="${key}" data-available="${amount}" data-amount="1" ${stocked ? '' : 'disabled'}>Jeter 1</button>
            <button class="ui-btn cargo-row__jettison" type="button" data-cargo-jettison="1" data-resource-key="${key}" data-available="${amount}" data-amount="all" ${stocked ? '' : 'disabled'}>Tout</button>
          </div>`
        : '';

      return `
        <div class="cargo-row ${stocked ? 'is-stocked' : ''}" data-resource="${key}" data-amount="${amount}">
          <div class="cargo-row__resource">
            <span class="cargo-row__swatch" style="background:${escapeAttr(entry.colorHex || '#d0d7e4')}"></span>
            <span>${escapeAttr(entry.name)}</span>
          </div>
          <span>${formatInt(amount)}</span>
          <span>${formatCredits(entry.sellUnitPrice || 0)}</span>
          <span>${formatCredits(entry.sellTotalValue || 0)}</span>
          ${actions}
        </div>
      `;
    }).join('') || `<div class="cargo-panel__empty">Soute vide.</div>`;
  }
}
