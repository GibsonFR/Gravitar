import { StationEquipmentView } from '../station/StationEquipmentView.js';
import { ShipAmmoView } from './ShipAmmoView.js';

export class ShipPanelView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.activeTab = 'equipment';
    this.equipment = null;
    this.inv = null;

    this.el = document.createElement('section');
    this.el.className = 'ship-panel ship-panel--station-style';
    this.el.innerHTML = `
      <div class="ship-panel__head">
        <div>
          <div class="ship-panel__eyebrow">Vaisseau</div>
          <h2>Gestion du vaisseau</h2>
        </div>
        <div class="ship-panel__tabs">
          <button type="button" data-ship-tab="equipment">Équipement</button>
          <button type="button" data-ship-tab="ammo">Munitions</button>
        </div>
      </div>
      <div class="ship-panel__body" data-role="body"></div>
    `;

    this.bodyEl = this.el.querySelector('[data-role="body"]');
    this.equipmentView = new StationEquipmentView(sendCmd);
    this.ammoView = new ShipAmmoView(sendCmd);

    this.pages = new Map([
      ['equipment', this.equipmentView.el],
      ['ammo', this.ammoView.el]
    ]);

    this.el.addEventListener('pointerdown', (ev) => {
      const tab = ev.target?.closest?.('[data-ship-tab]');
      if (!tab) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.setTab(tab.dataset.shipTab || 'equipment');
    });

    this.el.addEventListener('click', (ev) => {
      const tab = ev.target?.closest?.('[data-ship-tab]');
      if (!tab) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.setTab(tab.dataset.shipTab || 'equipment');
    });

    this.setTab(this.activeTab);
  }

  setTab(tabId) {
    const next = this.pages.has(tabId) ? tabId : 'equipment';
    this.activeTab = next;
    for (const btn of this.el.querySelectorAll('[data-ship-tab]')) {
      btn.classList.toggle('is-active', btn.dataset.shipTab === next);
    }
    const page = this.pages.get(next) || this.equipmentView.el;
    if (this.bodyEl.firstElementChild !== page) this.bodyEl.replaceChildren(page);
    this.refreshActivePage();
  }

  refreshActivePage() {
    const docked = true;
    if (this.activeTab === 'equipment') this.equipmentView.update(this.equipment, this.inv, docked);
    else if (this.activeTab === 'ammo') this.ammoView.update(this.equipment);
  }

  update(myStateOrEquipment) {
    const data = myStateOrEquipment?.equipment ? myStateOrEquipment : { equipment: myStateOrEquipment, inv: null };
    this.equipment = data?.equipment || null;
    this.inv = data?.inv || null;
    this.refreshActivePage();
  }
}
