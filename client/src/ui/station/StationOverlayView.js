import { formatCredits } from '../cargo/CargoFormat.js';

export class StationOverlayView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;

    this.el = document.createElement('section');
    this.el.className = 'station-overlay';
    this.el.hidden = true;

    this.el.innerHTML = `
      <div class="station-panel ui-panel-shell">
        <div class="station-panel__header">
          <div>
            <div class="station-panel__eyebrow">Station</div>
            <div class="station-panel__title" data-role="title">—</div>
          </div>
          <button class="station-panel__close" data-act="close" aria-label="Fermer">✕</button>
        </div>
        <div class="station-panel__dock" data-role="dockBlock">
          <div class="station-panel__dockline">
            <span data-role="dockLabel">Amarrage…</span>
            <span data-role="dockPercent">0%</span>
          </div>
          <div class="station-panel__docktrack">
            <div class="station-panel__dockfill" data-role="dockFill"></div>
          </div>
        </div>

        <div class="station-panel__body">
          <div class="station-panel__row">
            <span>Crédits</span>
            <span class="station-panel__value" data-role="credits">0 cr</span>
          </div>
          <div class="station-panel__row">
            <span>Valeur cargo</span>
            <span class="station-panel__value" data-role="cargoValue">0 cr</span>
          </div>

          <div class="station-panel__actions">
            <button class="ui-btn" data-act="sellAll">Vendre tout</button>
            <button class="ui-btn ui-btn--ghost" data-act="undock">Désamarrer</button>
          </div>
          <div class="station-panel__hint" data-role="hint">Ouvre l’onglet Cargo pour vendre par ressource.</div>
        </div>
      </div>
    `;

    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.creditsEl = this.el.querySelector('[data-role="credits"]');
    this.cargoValueEl = this.el.querySelector('[data-role="cargoValue"]');
    this.dockLabelEl = this.el.querySelector('[data-role="dockLabel"]');
    this.dockPercentEl = this.el.querySelector('[data-role="dockPercent"]');
    this.dockFillEl = this.el.querySelector('[data-role="dockFill"]');
    this.dockBlockEl = this.el.querySelector('[data-role="dockBlock"]');
    this.hintEl = this.el.querySelector('[data-role="hint"]');
    this.sellAllBtn = this.el.querySelector('button[data-act="sellAll"]');

    this.el.addEventListener('click', (ev) => {
      const act = ev.target?.dataset?.act;
      if (!act) return;
      if (!this.sendCmd) return;

      if (act === 'close' || act === 'undock') this.sendCmd('undock', {});
      if (act === 'sellAll') this.sendCmd('sell_all', {});
    });
  }

  update(myState, stationsById) {
    const phase = myState?.dockPhase || 'none';
    const open = phase !== 'none';
    this.el.hidden = !open;
    this.el.classList.toggle('is-open', open);

    if (!open) return;

    const sid = myState?.dockedStationId || myState?.dockStationId || 0;
    const station = sid ? stationsById?.get?.(sid) : null;
    this.titleEl.textContent = station?.name || 'Station';

    const inv = myState?.inv;
    this.creditsEl.textContent = formatCredits(inv?.credits || 0);
    this.cargoValueEl.textContent = formatCredits(inv?.totalSellValue || 0);

    const prog = Math.max(0, Math.min(1, myState?.dockProg01 || 0));
    this.dockFillEl.style.width = `${Math.round(prog * 100)}%`;
    this.dockPercentEl.textContent = `${Math.round(prog * 100)}%`;

    const docked = myState?.dockedStationId ? true : false;
    this.dockBlockEl.hidden = docked;
    this.dockLabelEl.textContent = docked ? 'Amarré' : 'Amarrage…';

    this.sellAllBtn.disabled = !docked || !(inv?.totalSellValue > 0);
    this.hintEl.textContent = docked
      ? 'Ouvre l’onglet Cargo pour vendre par ressource.'
      : 'Rapproche-toi de la station : D pour amarrer.';
  }
}
