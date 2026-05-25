import { formatCredits, formatInt } from '../cargo/CargoFormat.js';
import { StationCommandQueue } from './StationCommandQueue.js';

export class StationTradeView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);

    this.el = document.createElement('div');
    this.el.className = 'station-trade';
    this.el.innerHTML = `
      <div class="station-trade__summary">
        <div class="station-trade__metric">
          <div class="station-trade__label" data-role="creditsLabel">Crédits pirates</div>
          <div class="station-trade__value" data-role="credits">0 cr</div>
        </div>
        <div class="station-trade__metric">
          <div class="station-trade__label">Valeur acceptée</div>
          <div class="station-trade__value" data-role="cargoValue">0 cr</div>
        </div>
        <div class="station-trade__metric">
          <div class="station-trade__label">Soute</div>
          <div class="station-trade__value" data-role="cargoFill">0 / 0</div>
        </div>
      </div>

      <div class="station-trade__section-title" data-role="demandTitle">Ressources demandées</div>
      <div class="station-trade__table-head">
        <span>Ressource</span>
        <span>Qté</span>
        <span>Prix/u</span>
        <span>Total</span>
        <span></span>
      </div>
      <div class="station-trade__rows" data-role="rows"></div>

      <div class="station-trade__footer">
        <button class="ui-btn" data-act="sellAll">Vendre tout accepté</button>
        <div class="station-trade__total">Total : <span data-role="total">0 cr</span></div>
      </div>

      <div class="station-trade__section-title" data-role="supplyTitle">Ressources pirates en vente</div>
      <div class="station-trade__table-head station-trade__table-head--supply">
        <span>Ressource</span>
        <span>Lot</span>
        <span>Prix</span>
        <span>Stock</span>
        <span></span>
      </div>
      <div class="station-trade__rows" data-role="supplyRows"></div>
    `;

    this.creditsLabelEl = this.el.querySelector('[data-role="creditsLabel"]');
    this.creditsEl = this.el.querySelector('[data-role="credits"]');
    this.cargoValueEl = this.el.querySelector('[data-role="cargoValue"]');
    this.cargoFillEl = this.el.querySelector('[data-role="cargoFill"]');
    this.totalEl = this.el.querySelector('[data-role="total"]');
    this.rowsEl = this.el.querySelector('[data-role="rows"]');
    this.supplyRowsEl = this.el.querySelector('[data-role="supplyRows"]');

    this.el.addEventListener('contextmenu', (ev) => ev.preventDefault());

    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 && ev.button !== 2) return;

      const btn = ev.target?.closest?.('button[data-act]');
      if (!btn) return;
      if (!this.sendCmd) return;
      if (btn.disabled) return;

      if (ev.button === 2) ev.preventDefault();

      const act = btn.dataset.act;
      if (act === 'sellAll') {
        ev.preventDefault();
        this.cmdQueue.send('sell_all', {});
        return;
      }

      const row = btn.closest('[data-resource]');
      const key = row?.dataset?.resource;
      if (!key) return;

      const amt = Number.isFinite(+row?.dataset?.amount) ? Math.floor(+row.dataset.amount) : 0;
      ev.preventDefault();
      if (act === 'sell1') this.cmdQueue.send('sell', { resourceKey: key, amount: 1 });
      if (act === 'sellall') this.cmdQueue.send('sell', { resourceKey: key, amount: Math.max(0, amt) });
      if (act === 'buyResource') this.cmdQueue.send('buy_station_resource', { resourceKey: key, amount: 1 });
    });
  }

  update(inv, docked, stationShop = null) {
    const safeInv = inv || { credits: 0, cargoUsed: 0, cargoMax: 0, totalSellValue: 0, resources: [] };
    const pirate = !!stationShop?.pirate;
    if (this.creditsLabelEl) this.creditsLabelEl.textContent = safeInv.creditsLabel || 'Crédits pirates';
    this.creditsEl.textContent = formatCredits(safeInv.credits || 0);
    this.cargoValueEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.totalEl.textContent = formatCredits(safeInv.totalSellValue || 0);
    this.cargoFillEl.textContent = `${formatInt(safeInv.cargoUsed || 0)} / ${formatInt(safeInv.cargoMax || 0)}`;

    const rows = (safeInv.resources?.length ? safeInv.resources : [])
      .filter((e) => (e?.amount || 0) > 0 && (!pirate || e.sellable || e.demanded));

    this.rowsEl.innerHTML = rows.map((entry) => {
      const stocked = (entry.amount || 0) > 0;
      const sellable = !pirate || !!entry.sellable || !!entry.demanded;
      return `
        <div class="station-trade-row ${stocked && sellable ? 'is-stocked' : ''}" data-resource="${entry.key}" data-amount="${entry.amount || 0}">
          <div class="station-trade-row__resource">
            <span class="station-trade-row__swatch" style="background:${entry.colorHex || '#d0d7e4'}"></span>
            <span>${entry.name}${pirate && !sellable ? ' <small>non demandée</small>' : ''}</span>
          </div>
          <span>${formatInt(entry.amount || 0)}</span>
          <span>${formatCredits(entry.sellUnitPrice || 0)}</span>
          <span>${formatCredits(entry.sellTotalValue || 0)}</span>
          <div class="station-trade-row__actions">
            <button class="ui-btn ui-btn--ghost" data-act="sell1" ${docked && stocked && sellable ? '' : 'disabled'}>Vendre 1</button>
            <button class="ui-btn" data-act="sellall" ${docked && stocked && sellable ? '' : 'disabled'}>Tout</button>
          </div>
        </div>
      `;
    }).join('') || `<div class="station-trade__empty">${pirate ? 'Aucune ressource demandée dans votre soute.' : 'Aucune ressource.'}</div>`;

    const supplyRows = stationShop?.resourceSupply || [];
    this.supplyRowsEl.innerHTML = supplyRows.map((entry) => {
      const canBuy = docked && !!entry.canAfford;
      return `
        <div class="station-trade-row station-trade-row--supply" data-resource="${entry.resourceKey}" data-amount="${entry.amount || 1}">
          <div class="station-trade-row__resource">
            <span class="station-trade-row__swatch" style="background:${entry.colorHex || '#d0d7e4'}"></span>
            <span>${entry.name}</span>
          </div>
          <span>${formatInt(entry.amount || 1)}</span>
          <span>${formatCredits(entry.priceCredits || 0)}</span>
          <span>${formatInt(entry.stock || 0)}</span>
          <div class="station-trade-row__actions">
            <button class="ui-btn" data-act="buyResource" ${canBuy ? '' : 'disabled'}>Acheter</button>
          </div>
        </div>
      `;
    }).join('') || `<div class="station-trade__empty">${pirate ? 'Aucune ressource rare en vente.' : 'Cette station ne vend pas de ressources.'}</div>`;

    const sellAllBtn = this.el.querySelector('button[data-act="sellAll"]');
    if (sellAllBtn) sellAllBtn.disabled = !docked || !(safeInv.totalSellValue > 0);
  }
}
