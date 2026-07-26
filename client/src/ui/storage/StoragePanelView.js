import { ScrollPreserver } from '../common/ScrollPreserver.js';
function esc(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function fmt(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function normalizeAmount(v) {
  const n = Number(v) || 0;
  return Math.max(0, Math.floor(n));
}

function turretStatusLabel(status) {
  const id = String(status || '').toLowerCase();
  if (id === 'off') return 'OFF';
  if (id === 'no_power') return 'Sans énergie';
  if (id === 'no_ammo') return 'Sans roquette';
  if (id === 'cooldown') return 'Recharge';
  if (id === 'firing') return 'Tir';
  if (id === 'idle') return 'En veille';
  return id || 'En veille';
}

function turretModeControls(storage) {
  const turret = storage?.turret || null;
  if (!turret) return '';
  const mode = String(turret.mode || 'auto');
  const modes = [
    ['auto', 'Défense auto', 'Tire sur tout joueur ennemi dans son rayon.'],
    ['intrusion', 'Intrusion', 'Tire seulement si la cible est dans un claim allié.'],
    ['off', 'OFF', 'Ne tire jamais.']
  ];
  const buttons = modes.map(([id, label, title]) => `
    <button class="storage-panel__mode-btn ${mode === id ? 'is-active' : ''}" data-turret-mode="${esc(id)}" data-structure="${storage.id | 0}" title="${esc(title)}" type="button">${esc(label)}</button>
  `).join('');
  const target = (turret.targetId | 0) > 0 ? `#${turret.targetId | 0}` : 'aucune';
  const weaponName = {
    rocket: 'missiles',
    kinetic: 'cinétique',
    laser: 'laser'
  }[String(turret.weapon || '').toLowerCase()] || String(turret.weapon || 'défense');
  return `
    <div class="storage-panel__turret-card">
      <div class="storage-panel__turret-head">
        <div>
          <strong>${esc(storage.name || `Tourelle ${weaponName}`)}</strong>
          <small>Mode : ${esc(turret.modeLabel || mode)} · État : ${esc(turretStatusLabel(turret.status))}</small>
        </div>
        <span class="storage-panel__turret-pill ${turret.powered ? 'is-powered' : 'is-off'}">${turret.powered ? 'alimentée' : 'sans énergie'}</span>
      </div>
      <div class="storage-panel__turret-metrics">
        <span>Portée <strong>${fmt(turret.range || 0)}</strong></span>
        <span>Énergie <strong>${fmt(turret.energyUse || 0)}</strong></span>
        <span>Cadence <strong>${fmt((turret.cooldownMs || 0) / 1000)} s</strong></span>
        <span>Cible <strong>${esc(target)}</strong></span>
      </div>
      <div class="storage-panel__mode-row">${buttons}</div>
    </div>
  `;
}

function itemTitle(row) {
  const tier = row.tier ? ` T${row.tier}` : '';
  const cat = row.categoryName ? ` · ${row.categoryName}` : '';
  const mark = row.mark ? ` · Mk ${row.mark}` : '';
  const quality = row.qualityName ? ` · ${row.qualityName}` : '';
  const equipped = row.equipped ? ' · équipé' : '';
  return `${row.shortName || row.name || row.itemId}${tier}${mark}${quality}${cat}${equipped}`;
}

function resourceRows(resources = [], actionLabel, action, structureId) {
  if (!resources.length) return `<div class="storage-panel__empty">Vide.</div>`;
  return resources.map((r) => {
    const amount = normalizeAmount(r.amount);
    return `
      <div class="storage-panel__row" data-resource="${esc(r.key)}" data-search-name="${esc(String(r.name || r.key).toLowerCase())}" data-amount="${amount}" data-structure="${structureId | 0}">
        <span class="storage-panel__swatch" style="background:${esc(r.colorHex || '#d0d7e4')}"></span>
        <span class="storage-panel__name" title="${esc(r.name || r.key)}">${esc(r.name || r.key)}</span>
        <span class="storage-panel__qty">${amount}</span>
        <button class="ui-btn ui-btn--ghost storage-panel__mini" data-storage-act="${action}" data-amount="1" type="button">1</button>
        <button class="ui-btn storage-panel__main" data-storage-act="${action}" data-amount="all" type="button">${actionLabel}</button>
      </div>
    `;
    this.scrollPreserver?.restore(scroll);
  }).join('');
}

function itemRows(items = [], actionLabel, action, structureId, kind = 'equipment') {
  if (!items.length) return `<div class="storage-panel__empty">Vide.</div>`;
  return items.map((it) => {
    const amount = normalizeAmount(it.amount || 1);
    const qty = kind === 'ammo'
      ? `<span class="storage-panel__qty">${amount}</span>`
      : `<span class="storage-panel__qty">Mk ${it.mark || it.tier || 1}</span>`;
    const equippedBadge = kind === 'equipment' && it.equipped ? `<small class="storage-panel__badge">équipé</small>` : '';
    const label = kind === 'equipment' && it.equipped && action === 'deposit' ? 'Déséquiper' : actionLabel;
    return `
      <div class="storage-panel__row storage-panel__row--item ${it.equipped ? 'is-equipped' : ''}" data-item="${esc(it.itemId)}" data-search-name="${esc(String(it.shortName || it.name || it.itemId).toLowerCase())}" data-amount="${amount}" data-structure="${structureId | 0}">
        <span class="storage-panel__item-dot"></span>
        <span class="storage-panel__name" title="${esc(itemTitle(it))}">${esc(it.shortName || it.name || it.itemId)}${equippedBadge}</span>
        ${qty}
        ${kind === 'ammo' ? `<button class="ui-btn ui-btn--ghost storage-panel__mini" data-storage-act="${action}" data-amount="1" type="button">1</button>` : ''}
        <button class="ui-btn storage-panel__main" data-storage-act="${action}" data-amount="all" type="button">${label}</button>
      </div>
    `;
    this.scrollPreserver?.restore(scroll);
  }).join('');
}

export class StoragePanelView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.lastKey = '';
    this.search = '';
    this.quantity = 5;
    this.scrollPreserver = null;
    this.el = document.createElement('section');
    this.el.className = 'storage-panel';
    this.el.innerHTML = '';
    this.scrollPreserver = new ScrollPreserver(this.el);

    const stopUiEvent = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    };

    this.el.addEventListener('pointerdown', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const close = target.closest('[data-close-storage]');
      if (close) {
        stopUiEvent(ev);
        this.closeLocal();
        return;
      }
      const modeBtn = target.closest('button[data-turret-mode]');
      if (modeBtn) {
        stopUiEvent(ev);
        this.setTurretMode(modeBtn);
        return;
      }
      const btn = target.closest('button[data-storage-act]');
      const bulk = target.closest('button[data-storage-bulk]');
      if (bulk) {
        stopUiEvent(ev);
        this.transferAll(bulk.dataset.storageBulk || 'deposit');
        return;
      }
      if (btn) {
        stopUiEvent(ev);
        this.transferFromButton(btn);
      } else if (target.closest('input, select')) {
        ev.stopPropagation();
      } else {
        stopUiEvent(ev);
      }
    }, { capture: true });

    this.el.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, select')) {
        ev.stopPropagation();
        return;
      }
      if (target.closest('[data-close-storage], button[data-storage-act], .storage-panel')) stopUiEvent(ev);
    }, { capture: true });
    this.el.addEventListener('input', (ev) => {
      ev.stopPropagation();
      const input = ev.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.matches('[data-storage-search]')) {
        this.search = input.value.slice(0, 40);
        this.applySearch();
      }
      if (input.matches('[data-storage-quantity]')) this.quantity = Math.max(1, Math.min(9999, input.value | 0 || 1));
    }, { capture: true });
  }

  setTurretMode(btn) {
    const structureId = btn?.dataset?.structure | 0;
    const mode = btn?.dataset?.turretMode || 'auto';
    if (!structureId) return;
    this.sendCmd?.('turret_set_mode', { structureId, mode });
  }

  transferFromButton(btn) {
    const row = btn.closest('[data-resource], [data-item]');
    const structureId = row?.dataset?.structure | 0;
    const rowAmount = normalizeAmount(row?.dataset?.amount);
    const amount = btn.dataset.amount === 'all' ? rowAmount : Math.min(this.quantity || 1, rowAmount);
    const act = btn.dataset.storageAct;
    if (!structureId || amount <= 0) return;
    const itemId = row?.dataset?.item || '';
    if (itemId) {
      this.sendCmd?.('storage_transfer', {
        structureId,
        itemId,
        amount,
        direction: act === 'withdraw' ? 'withdraw' : 'deposit'
      });
      return;
    }
    const key = row?.dataset?.resource || '';
    if (!key) return;
    this.sendCmd?.('storage_transfer', {
      structureId,
      resourceKey: key,
      amount,
      direction: act === 'withdraw' ? 'withdraw' : 'deposit'
    });
  }

  transferAll(direction) {
    const side = direction === 'withdraw' ? 'right' : 'left';
    const rows = [...this.el.querySelectorAll(`[data-storage-side="${side}"] .storage-panel__row`)]
      .filter((row) => !row.hidden && normalizeAmount(row.dataset.amount) > 0);
    for (const row of rows) {
      const structureId = row.dataset.structure | 0;
      const amount = normalizeAmount(row.dataset.amount);
      const itemId = row.dataset.item || '';
      const resourceKey = row.dataset.resource || '';
      if (!structureId || (!itemId && !resourceKey) || amount <= 0) continue;
      this.sendCmd?.('storage_transfer', {
        structureId,
        ...(itemId ? { itemId } : { resourceKey }),
        amount,
        direction
      });
    }
  }

  applySearch() {
    const term = String(this.search || '').trim().toLowerCase();
    for (const row of this.el.querySelectorAll('.storage-panel__row[data-search-name]')) {
      row.hidden = !!term && !String(row.dataset.searchName || '').includes(term);
    }
  }

  closeLocal() {
    this.lastKey = '';
    this.el.classList.remove('is-open');
    this.el.innerHTML = '';
    this.sendCmd?.('storage_close', {});
  }

  update(store) {
    const storage = store?.myState?.storage || null;
    this.el.classList.toggle('is-open', !!storage);
    if (!storage) { this.lastKey = ''; this.el.innerHTML = ''; return; }
    const cargoResources = store?.myState?.inv?.resources || [];
    const cargoRows = cargoResources.filter((r) => (r?.amount || 0) > 0);
    const key = JSON.stringify({ s: storage, c: cargoRows.map((r) => [r.key, r.amount]) });
    if (key === this.lastKey) return;
    const scroll = this.scrollPreserver?.capture() || new Map();
    this.lastKey = key;

    const kind = storage.kind || 'resources';
    const title = kind === 'equipment'
      ? (storage.owned ? 'Coffre d’équipement' : 'Équipement non claim')
      : kind === 'ammo'
        ? (storage.owned ? 'Coffre de roquettes' : 'Roquettes non claim')
        : kind === 'fuel'
          ? (storage.owned ? 'Stockage carburant' : 'Carburant non claim')
          : (storage.owned ? 'Coffre de ressources' : 'Ressources non claim');
    const used = Number(storage.used) || 0;
    const cap = Number(storage.capacity) || 0;
    const fill = Math.max(0, Math.min(1, Number(storage.fill01) || (cap > 0 ? used / cap : 0)));

    let leftTitle = 'Cargo';
    let rightTitle = 'Coffre';
    let leftRows = '';
    let rightRows = '';
    if (kind === 'equipment') {
      leftTitle = 'Équipement du vaisseau';
      rightTitle = 'Stocké';
      leftRows = itemRows(storage.cargoItems || [], 'Stocker', 'deposit', storage.id, 'equipment');
      rightRows = itemRows(storage.items || [], 'Reprendre', 'withdraw', storage.id, 'equipment');
    } else if (kind === 'ammo') {
      leftTitle = 'Roquettes cargo';
      rightTitle = 'Roquettes stockées';
      leftRows = itemRows(storage.cargoAmmo || [], 'Stocker', 'deposit', storage.id, 'ammo');
      rightRows = itemRows(storage.ammo || [], 'Reprendre', 'withdraw', storage.id, 'ammo');
    } else if (kind === 'fuel') {
      leftTitle = 'Carburant cargo';
      rightTitle = 'Carburant stocké';
      leftRows = resourceRows(storage.cargoResources || [], 'Déposer', 'deposit', storage.id);
      rightRows = resourceRows(storage.resources || [], 'Retirer', 'withdraw', storage.id);
    } else {
      leftRows = resourceRows(cargoRows, 'Déposer', 'deposit', storage.id);
      rightRows = resourceRows(storage.resources || [], 'Retirer', 'withdraw', storage.id);
    }

    this.el.innerHTML = `
      <div class="storage-panel__head">
        <div>
          <div class="storage-panel__eyebrow">Stockage</div>
          <h2>${esc(title)}</h2>
          <div class="storage-panel__capacity">Capacité : <strong>${fmt(used)}</strong> / ${fmt(cap || 0)}</div>
        </div>
        <button class="storage-panel__close" data-close-storage="1" type="button" aria-label="Fermer">×</button>
      </div>
      <div class="storage-panel__bar"><span style="width:${Math.round(fill * 100)}%"></span></div>
      ${turretModeControls(storage)}
      <div class="storage-panel__tools">
        <label>Recherche <input data-storage-search maxlength="40" value="${esc(this.search)}" placeholder="Filtrer…"></label>
        <label>Quantité <input data-storage-quantity type="number" min="1" max="9999" value="${this.quantity | 0}"></label>
        <button type="button" class="ui-btn ui-btn--ghost" data-storage-bulk="deposit">Déposer tout</button>
        <button type="button" class="ui-btn ui-btn--ghost" data-storage-bulk="withdraw">Retirer tout</button>
      </div>
      <div class="storage-panel__cols">
        <div class="storage-panel__col" data-storage-side="left" data-scroll-key="storage-left">
          <h3>${esc(leftTitle)}</h3>
          ${leftRows}
        </div>
        <div class="storage-panel__col" data-storage-side="right" data-scroll-key="storage-right">
          <h3>${esc(rightTitle)}</h3>
          ${rightRows}
        </div>
      </div>
    `;
    this.applySearch();
    this.scrollPreserver?.restore(scroll);
  }
}
