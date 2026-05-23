function esc(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function resourceRows(resources = [], actionLabel, action, structureId) {
  if (!resources.length) return `<div class="storage-panel__empty">Vide.</div>`;
  return resources.map((r) => `
    <div class="storage-panel__row" data-resource="${esc(r.key)}" data-amount="${r.amount | 0}" data-structure="${structureId | 0}">
      <span class="storage-panel__swatch" style="background:${esc(r.colorHex || '#d0d7e4')}"></span>
      <span class="storage-panel__name">${esc(r.name || r.key)}</span>
      <span class="storage-panel__qty">${r.amount | 0}</span>
      <button class="ui-btn ui-btn--ghost" data-act="${action}" data-amount="1">1</button>
      <button class="ui-btn" data-act="${action}" data-amount="all">${actionLabel}</button>
    </div>
  `).join('');
}

export class StoragePanelView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'storage-panel';
    this.el.innerHTML = '';
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-close-storage]');
      if (close) { this.sendCmd?.('storage_close', {}); return; }
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const row = btn.closest('[data-resource]');
      const key = row?.dataset?.resource || '';
      const structureId = row?.dataset?.structure | 0;
      const rowAmount = Math.max(0, row?.dataset?.amount | 0);
      const amount = btn.dataset.amount === 'all' ? rowAmount : 1;
      const act = btn.dataset.act;
      if (!key || !structureId || amount <= 0) return;
      this.sendCmd?.('storage_transfer', {
        structureId,
        resourceKey: key,
        amount,
        direction: act === 'withdraw' ? 'withdraw' : 'deposit'
      });
    });
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
    this.el.innerHTML = `
      <div class="storage-panel__head">
        <div>
          <div class="storage-panel__eyebrow">Stockage</div>
          <h2>${esc(title)}</h2>
        </div>
        <button class="storage-panel__close" data-close-storage="1" type="button">×</button>
      </div>
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
