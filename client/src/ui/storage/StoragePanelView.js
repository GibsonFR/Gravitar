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
      }
    }, { capture: true });

    this.el.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-close-storage], button[data-storage-act]')) {
        stopUiEvent(ev);
      }
    }, { capture: true });
  }

  transferFromButton(btn) {
    const row = btn.closest('[data-resource]');
    const key = row?.dataset?.resource || '';
    const structureId = row?.dataset?.structure | 0;
    const rowAmount = normalizeAmount(row?.dataset?.amount);
    const amount = btn.dataset.amount === 'all' ? rowAmount : Math.min(1, rowAmount);
    const act = btn.dataset.storageAct;
    if (!key || !structureId || amount <= 0) return;
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
    const cargo = store?.myState?.inv?.resources || [];
    const cargoRows = cargo.filter((r) => (r?.amount || 0) > 0);
    const key = JSON.stringify({ s: storage, c: cargoRows.map((r) => [r.key, r.amount]) });
    if (key === this.lastKey) return;
    this.lastKey = key;
    const title = storage.owned ? 'Coffre' : 'Coffre non claim';
    const used = Number(storage.used) || 0;
    const cap = Number(storage.capacity) || 0;
    const fill = Math.max(0, Math.min(1, Number(storage.fill01) || (cap > 0 ? used / cap : 0)));
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
          <h3>Cargo</h3>
          ${resourceRows(cargoRows, 'Déposer', 'deposit', storage.id)}
        </div>
        <div class="storage-panel__col">
          <h3>Coffre</h3>
          ${resourceRows(storage.resources || [], 'Retirer', 'withdraw', storage.id)}
        </div>
      </div>
    `;
  }
}
