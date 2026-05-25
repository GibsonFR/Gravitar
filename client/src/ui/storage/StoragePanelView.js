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
      <div class="storage-panel__row" data-resource="${esc(r.key)}" data-amount="${amount}" data-structure="${structureId | 0}">
        <span class="storage-panel__swatch" style="background:${esc(r.colorHex || '#d0d7e4')}"></span>
        <span class="storage-panel__name" title="${esc(r.name || r.key)}">${esc(r.name || r.key)}</span>
        <span class="storage-panel__qty">${amount}</span>
        <button class="ui-btn ui-btn--ghost storage-panel__mini" data-storage-act="${action}" data-amount="1" type="button">1</button>
        <button class="ui-btn storage-panel__main" data-storage-act="${action}" data-amount="all" type="button">${actionLabel}</button>
      </div>
    `;
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
    const label = kind === 'equipment' && it.equipped && action === 'deposit' ? 'Déséquiper + stocker' : actionLabel;
    return `
      <div class="storage-panel__row storage-panel__row--item ${it.equipped ? 'is-equipped' : ''}" data-item="${esc(it.itemId)}" data-amount="${amount}" data-structure="${structureId | 0}">
        <span class="storage-panel__item-dot"></span>
        <span class="storage-panel__name" title="${esc(itemTitle(it))}">${esc(it.shortName || it.name || it.itemId)}${equippedBadge}</span>
        ${qty}
        ${kind === 'ammo' ? `<button class="ui-btn ui-btn--ghost storage-panel__mini" data-storage-act="${action}" data-amount="1" type="button">1</button>` : ''}
        <button class="ui-btn storage-panel__main" data-storage-act="${action}" data-amount="all" type="button">${label}</button>
      </div>
    `;
  }).join('');
}

export class StoragePanelView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'storage-panel';
    this.el.innerHTML = '';

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
      const btn = target.closest('button[data-storage-act]');
      if (btn) {
        stopUiEvent(ev);
        this.transferFromButton(btn);
      } else {
        stopUiEvent(ev);
      }
    }, { capture: true });

    this.el.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-close-storage], button[data-storage-act], .storage-panel')) stopUiEvent(ev);
    }, { capture: true });
  }

  transferFromButton(btn) {
    const row = btn.closest('[data-resource], [data-item]');
    const structureId = row?.dataset?.structure | 0;
    const rowAmount = normalizeAmount(row?.dataset?.amount);
    const amount = btn.dataset.amount === 'all' ? rowAmount : Math.min(1, rowAmount);
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
      <div class="storage-panel__cols">
        <div class="storage-panel__col">
          <h3>${esc(leftTitle)}</h3>
          ${leftRows}
        </div>
        <div class="storage-panel__col">
          <h3>${esc(rightTitle)}</h3>
          ${rightRows}
        </div>
      </div>
    `;
  }
}
