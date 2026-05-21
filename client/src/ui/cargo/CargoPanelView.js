import { formatCredits, formatInt } from './CargoFormat.js';

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

    this.rowsEl.addEventListener('click', (ev) => {
      const btn = ev.target?.closest?.('button[data-act]');
      if (!btn) return;
      if (!this.sendCmd) return;

      const row = btn.closest('[data-resource]');
      const key = row?.dataset?.resource;
      if (!key) return;

      const act = btn.dataset.act;
      if (act === 'jett1') this.sendCmd('jettison', { resourceKey: key, amount: 1 });
      if (act === 'jettall') {
        const amt = Number.isFinite(+row?.dataset?.amount) ? Math.floor(+row.dataset.amount) : 0;
        this.sendCmd('jettison', { resourceKey: key, amount: Math.max(0, amt) });
      }
    });
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
    const cargoFull = (safeInv.cargoMax || 0) > 0 && (safeInv.cargoUsed || 0) >= (safeInv.cargoMax || 0);
    const canJettison = !isDocked && cargoFull;
    this.el.classList.toggle('cargo-panel--jettison', canJettison);

    this.totalValueEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.creditsEl.textContent = formatCredits(safeInv.credits || 0);
    this.cargoLabelEl.textContent = `${formatInt(safeInv.cargoUsed || 0)} / ${formatInt(safeInv.cargoMax || 0)}`;
    this.cargoPercentEl.textContent = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;
    this.cargoFillEl.style.width = `${Math.round((safeInv.cargoFill01 || 0) * 100)}%`;

    const rows = (safeInv.resources?.length ? safeInv.resources : []).filter((e) => (e?.amount || 0) > 0);

    this.headEl.innerHTML = canJettison
      ? `<span>Ressource</span><span>Qté</span><span>Prix/u</span><span>Total</span><span></span>`
      : `<span>Ressource</span><span>Qté</span><span>Prix/u</span><span>Total</span>`;

    this.rowsEl.innerHTML = rows.map((entry) => {
      const stocked = (entry.amount || 0) > 0;
      const actions = canJettison
        ? `<div class="cargo-row__actions">
            <button class="ui-btn ui-btn--ghost" data-act="jett1" ${stocked ? '' : 'disabled'}>Jeter 1</button>
            <button class="ui-btn" data-act="jettall" ${stocked ? '' : 'disabled'}>Tout</button>
          </div>`
        : '';

      return `
        <div class="cargo-row ${stocked ? 'is-stocked' : ''}" data-resource="${entry.key}" data-amount="${entry.amount || 0}">
          <div class="cargo-row__resource">
            <span class="cargo-row__swatch" style="background:${entry.colorHex || '#d0d7e4'}"></span>
            <span>${entry.name}</span>
          </div>
          <span>${formatInt(entry.amount || 0)}</span>
          <span>${formatCredits(entry.sellUnitPrice || 0)}</span>
          <span>${formatCredits(entry.sellTotalValue || 0)}</span>
          ${actions}
        </div>
      `;
    }).join('') || `<div class="cargo-panel__empty">Soute vide.</div>`;
  }
}
