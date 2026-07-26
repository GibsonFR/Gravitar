import { createDockIconButton } from './DockIconButton.js';

export class TopRightDock {
  constructor(root) {
    this.root = root;
    this.items = new Map();
    this.activeId = null;

    this.dockEl = document.createElement('div');
    this.dockEl.className = 'ui-dock ui-dock--top-right';

    this.gameDockEl = document.createElement('div');
    this.gameDockEl.className = 'ui-dock__group ui-dock__group--game';
    this.utilityDockEl = document.createElement('div');
    this.utilityDockEl.className = 'ui-dock__group ui-dock__group--utility';
    this.dockEl.append(this.gameDockEl, this.utilityDockEl);

    this.panelHostEl = document.createElement('div');
    this.panelHostEl.className = 'ui-panel-host ui-panel-host--top-right';

    this.root.append(this.dockEl, this.panelHostEl);
  }

  _groupEl(group = 'game') {
    return group === 'utility' ? this.utilityDockEl : this.gameDockEl;
  }

  registerToggle({ id, title, iconMarkup, onToggle, isActive, group = 'game' }) {
    const { button, badge } = createDockIconButton({ id, title, iconMarkup });
    button.addEventListener('click', () => {
      if (button.disabled) return;
      if (typeof onToggle === 'function') onToggle();
      this._refresh();
    });

    this._groupEl(group).appendChild(button);
    this.items.set(id, { id, button, badge, type: 'toggle', isActiveFn: isActive, group });
    this._refresh();
    return id;
  }

  registerPanel({ id, title, iconMarkup, panelEl, shellClass = '', group = 'game' }) {
    const { button, badge } = createDockIconButton({ id, title, iconMarkup });
    button.addEventListener('click', () => {
      if (button.disabled) return;
      this.toggle(id);
    });

    panelEl.classList.add('ui-panel-shell');
    if (shellClass) panelEl.classList.add(shellClass);
    panelEl.hidden = true;

    this._groupEl(group).appendChild(button);
    this.panelHostEl.appendChild(panelEl);

    this.items.set(id, { id, button, badge, panelEl, enabled: true, type: 'panel', group });
    this._refresh();
    return id;
  }

  setEnabled(id, enabled) {
    const item = this.items.get(id);
    if (!item) return;
    item.enabled = !!enabled;
    item.button.disabled = !item.enabled;
    item.button.classList.toggle('is-disabled', !item.enabled);
    if (!item.enabled && this.activeId === id) this.activeId = null;
    this._refresh();
  }

  setVisible(id, visible) {
    const item = this.items.get(id);
    if (!item) return;
    const next = !!visible;
    if (item.visible === next) return;
    item.visible = next;
    item.button.hidden = !item.visible;
    if (!item.visible && this.activeId === id) this.activeId = null;
    this._refresh();
  }

  toggle(id) {
    this.activeId = this.activeId === id ? null : id;
    this._refresh();
  }

  setBadge(id, text) {
    const item = this.items.get(id);
    if (!item) return;
    item.badge.textContent = text || '';
    item.badge.hidden = !text;
  }

  _refresh() {
    for (const item of this.items.values()) {
      if (item.visible === false) {
        if (item.panelEl) {
          item.panelEl.hidden = true;
          item.panelEl.style.display = 'none';
        }
        continue;
      }
      if (item.type === 'toggle') {
        const active = typeof item.isActiveFn === 'function' ? !!item.isActiveFn() : false;
        item.button.classList.toggle('is-active', active);
        continue;
      }
      const active = item.id === this.activeId;
      item.button.classList.toggle('is-active', active);
      item.panelEl.hidden = !active;
      item.panelEl.style.display = active ? '' : 'none';
    }
  }
}
