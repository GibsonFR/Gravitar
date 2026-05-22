import { STATION_TABS } from './StationTabDefs.js';
import { StationTradeView } from './StationTradeView.js';
import { StationShopView } from './StationShopView.js';
import { StationEquipmentView } from './StationEquipmentView.js';
import { StationAmmoView } from './StationAmmoView.js';
import { StationConvertersView } from './StationConvertersView.js';

export class StationWindowView {
  constructor(sendCmd, store = null) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.store = store;
    this.activeTab = 'trade';

    this.el = document.createElement('section');
    this.el.className = 'station-modal';
    this.el.hidden = true;

    this.el.innerHTML = `
      <div class="station-modal__backdrop" data-act="close"></div>
      <div class="station-window ui-panel-shell ui-panel-shell--xl">
        <div class="station-window__header station-window__header--minimal">
          <div class="station-window__header-actions">
            <button class="ui-btn ui-btn--ghost" data-act="undock">Désamarrer</button>
            <button class="station-window__close" data-act="close" aria-label="Fermer">✕</button>
          </div>
        </div>

        <div class="station-window__pending" data-role="pending" hidden>
          <span class="station-window__pending-spinner"></span>
          <span data-role="pendingText">Synchronisation station…</span>
        </div>

        <div class="station-window__body">
          <nav class="station-window__nav" data-role="nav"></nav>
          <div class="station-window__main" data-role="main"></div>
        </div>
      </div>
    `;

    this.titleEl = this.el.querySelector('[data-role="title"]');
    this.navEl = this.el.querySelector('[data-role="nav"]');
    this.mainEl = this.el.querySelector('[data-role="main"]');
    this.pendingEl = this.el.querySelector('[data-role="pending"]');
    this.pendingTextEl = this.el.querySelector('[data-role="pendingText"]');

    this.tradeView = new StationTradeView(sendCmd);
    this.tradeView.el.classList.add('station-page', 'station-page--trade');

    this.shopView = new StationShopView(sendCmd);
    this.shopView.el.classList.add('station-page', 'station-page--shop');

    this.ammoView = new StationAmmoView(sendCmd);
    this.ammoView.el.classList.add('station-page', 'station-page--ammo');

    this.equipmentView = new StationEquipmentView(sendCmd);
    this.equipmentView.el.classList.add('station-page', 'station-page--equipment');

    this.convertersView = new StationConvertersView(sendCmd);
    this.convertersView.el.classList.add('station-page', 'station-page--converters');

    this.pages = new Map([
      ['trade', this.tradeView.el],
      ['shop', this.shopView.el],
      ['ammo', this.ammoView.el],
      ['equipment', this.equipmentView.el],
      ['converters', this.convertersView.el]
    ]);

    this.navEl.innerHTML = STATION_TABS.map((t) => {
      return `
        <button class="station-tab" type="button" data-tab="${t.id}" title="${t.title}" aria-label="${t.title}">
          <span class="station-tab__icon">${t.iconMarkup}</span>
          <span class="station-tab__label">${t.title}</span>
        </button>
      `;
    }).join('');

    this.el.addEventListener('click', (ev) => {
      const btn = ev.target?.closest?.('button[data-tab]');
      if (btn) {
        const tab = btn.dataset.tab;
        if (tab) this.setTab(tab);
        return;
      }

      const act = ev.target?.dataset?.act;
      if (!act) return;
      if (!this.sendCmd) return;

      if (act === 'close' || act === 'undock') this.sendCmd('undock', {});
    });

    this.setTab(this.activeTab);
  }

  updatePendingUi() {
    const summary = this.store?.getStationPendingSummary?.() || { count: 0, failedCount: 0 };
    const pending = summary.count > 0;
    const failed = summary.failedCount > 0;
    this.el.classList.toggle('has-pending-station-command', pending);
    this.el.classList.toggle('has-failed-station-command', failed);
    if (!this.pendingEl) return;
    this.pendingEl.hidden = !pending && !failed;
    if (this.pendingTextEl) {
      if (pending) this.pendingTextEl.textContent = summary.count > 1 ? `${summary.count} actions en attente…` : 'Action station en attente…';
      else if (failed) this.pendingTextEl.textContent = 'Action refusée ou impossible.';
    }
  }

  setTab(tabId) {
    const nextTab = this.pages.has(tabId) ? tabId : 'trade';
    this.activeTab = nextTab;

    for (const b of this.navEl.querySelectorAll('button[data-tab]')) {
      b.classList.toggle('is-active', b.dataset.tab === nextTab);
    }

    const nextPage = this.pages.get(nextTab) || this.tradeView.el;
    for (const [id, pageEl] of this.pages.entries()) {
      pageEl.classList.toggle('is-active', id === nextTab);
    }

    if (this.mainEl.firstElementChild !== nextPage) {
      this.mainEl.replaceChildren(nextPage);
    }
  }

  update(myState, stationsById) {
    const docked = !!myState?.dockedStationId;
    this.el.hidden = !docked;
    if (!docked) return;

    const sid = myState?.dockedStationId || 0;
    const station = sid ? stationsById?.get?.(sid) : null;
    if (this.titleEl) this.titleEl.textContent = station?.name || 'Station';

    this.updatePendingUi();

    this.tradeView.update(myState?.inv, docked);
    this.shopView.update(myState?.stationShop, myState?.inv, docked);
    this.ammoView.update(myState?.equipment, myState?.stationShop, myState?.inv, docked);
    this.equipmentView.update(myState?.equipment, myState?.inv, docked);
    this.convertersView.update(myState?.equipment, docked);
    this.setTab(this.activeTab);
  }
}
