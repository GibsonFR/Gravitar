function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function rows(resources = [], opts = {}) {
  if (!resources.length) return '<div class="logistics-empty">Vide.</div>';
  const { action = '', direction = '', structureId = 0 } = opts;
  return resources.map((r) => {
    const amount = Math.max(0, r.amount | 0);
    const actions = action ? `<div class="logistics-resource-row__actions">
      <button type="button" data-logistic-transfer="${escapeHtml(direction)}" data-resource-key="${escapeHtml(r.key)}" data-amount="1" data-structure="${structureId | 0}">1</button>
      <button type="button" data-logistic-transfer="${escapeHtml(direction)}" data-resource-key="${escapeHtml(r.key)}" data-amount="5" data-structure="${structureId | 0}">5</button>
      <button type="button" data-logistic-transfer="${escapeHtml(direction)}" data-resource-key="${escapeHtml(r.key)}" data-amount="all" data-row-amount="${amount}" data-structure="${structureId | 0}">${escapeHtml(action)}</button>
    </div>` : '';
    return `<div class="logistics-resource-row logistics-resource-row--interactive">
      <span class="logistics-dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span>
      <span class="logistics-resource-row__name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
      <b>${amount}</b>
      ${actions}
    </div>`;
  }).join('');
}

function requestRows(requests = []) {
  if (!requests.length) return '<div class="logistics-empty">Aucune demande configurée.</div>';
  return requests.map((r) => {
    const pct = Math.max(0, Math.min(100, Math.round(((r.stored | 0) / Math.max(1, r.target | 0)) * 100)));
    const missing = Math.max(0, (r.target | 0) - (r.stored | 0));
    return `<div class="logistics-request-row">
      <div class="logistics-request-row__top">
        <span><i style="background:${escapeHtml(r.colorHex || '#fff')}"></i>${escapeHtml(r.name)}</span>
        <b>${r.stored | 0}/${r.target | 0}</b>
      </div>
      <div class="logistics-request-row__sub">Manquant : ${missing}</div>
      <div class="logistics-bar mini"><span style="width:${pct}%"></span></div>
      <div class="logistics-request-row__actions logistics-request-row__actions--wide">
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="-50">-50</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="-10">-10</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="-1">-1</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="1">+1</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="10">+10</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="50">+50</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-set-target="0">Retirer</button>
      </div>
    </div>`;
  }).join('');
}

function candidateRows(candidates = []) {
  if (!candidates.length) return '<div class="logistics-empty">Aucune ressource détectée dans le réseau.</div>';
  return candidates.map((r) => `<div class="logistics-candidate-row">
    <span><i style="background:${escapeHtml(r.colorHex || '#fff')}"></i>${escapeHtml(r.name)}</span>
    <b>${r.target | 0 ? `cible ${r.target | 0}` : ''}</b>
    <div class="logistics-candidate-row__actions">
      <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="1">+1</button>
      <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="10">+10</button>
      <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="50">+50</button>
    </div>
  </div>`).join('');
}

export class LogisticChestPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'logistics-panel logistics-panel--chest is-hidden';

    this.el.addEventListener('pointerdown', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const close = target.closest('[data-logistic-chest-close]');
      const req = target.closest('[data-logistic-request]');
      const transfer = target.closest('[data-logistic-transfer]');
      if (close || req || transfer) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        if (close) this.closeLocal();
        else if (req && !req.disabled) this.setRequest(req);
        else if (transfer && !transfer.disabled) this.transferResource(transfer);
      } else {
        ev.stopPropagation();
      }
    }, { capture: true });
    this.el.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true });
    this.el.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true });
  }

  closeLocal() {
    this.currentId = 0;
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.lastKey = '';
    this.sendCmd('logistic_chest_close', {});
  }

  setRequest(btn) {
    if (!this.currentId) return;
    const resourceKey = btn.dataset.logisticRequest || '';
    const payload = { structureId: this.currentId, resourceKey };
    if (btn.dataset.setTarget !== undefined) payload.setTarget = Math.max(0, btn.dataset.setTarget | 0);
    else payload.delta = btn.dataset.delta | 0;
    this.sendCmd('logistic_chest_set_request', payload);
  }

  transferResource(btn) {
    const structureId = btn.dataset.structure | 0 || this.currentId;
    const resourceKey = btn.dataset.resourceKey || '';
    const direction = btn.dataset.logisticTransfer || 'deposit';
    const rowAmount = btn.dataset.rowAmount | 0;
    let amount = 1;
    if (btn.dataset.amount === 'all') amount = rowAmount;
    else amount = Math.max(1, btn.dataset.amount | 0 || 1);
    if (!structureId || !resourceKey || amount <= 0) return;
    this.sendCmd('logistic_chest_transfer', { structureId, resourceKey, amount, direction });
  }

  captureScroll() {
    const out = new Map();
    this.el.querySelectorAll('[data-scroll-key]').forEach((node) => out.set(node.dataset.scrollKey || '', node.scrollTop));
    const body = this.el.querySelector('.logistics-panel__body');
    if (body) out.set('__body__', body.scrollTop);
    return out;
  }

  restoreScroll(map) {
    if (!map?.size) return;
    this.el.querySelectorAll('[data-scroll-key]').forEach((node) => {
      const key = node.dataset.scrollKey || '';
      if (map.has(key)) node.scrollTop = map.get(key) || 0;
    });
    const body = this.el.querySelector('.logistics-panel__body');
    if (body && map.has('__body__')) body.scrollTop = map.get('__body__') || 0;
  }

  update(store) {
    const chest = store?.myState?.logisticChest || null;
    if (!chest) {
      this.currentId = 0;
      this.el.classList.add('is-hidden');
      this.el.innerHTML = '';
      this.lastKey = '';
      return;
    }
    this.currentId = chest.id | 0;
    this.el.classList.remove('is-hidden');
    const key = JSON.stringify(chest);
    if (key === this.lastKey) return;
    const scroll = this.captureScroll();
    this.lastKey = key;
    const isRequester = chest.logisticType === 'requester';
    const isProvider = chest.logisticType === 'provider';
    const isBuffer = chest.logisticType === 'buffer';
    this.el.innerHTML = `
      <header class="logistics-panel__head">
        <div>
          <div class="logistics-panel__eyebrow">Coffre logistique · ${escapeHtml(chest.modeLabel)}</div>
          <h2>${escapeHtml(chest.name)}</h2>
          <div class="logistics-panel__meta">Secteur [${chest.sx | 0}, ${chest.sy | 0}] · ${Math.round(chest.used || 0)} / ${chest.capacity | 0} cargo</div>
        </div>
        <button type="button" class="logistics-panel__close" data-logistic-chest-close="1">×</button>
      </header>
      <div class="logistics-panel__body logistics-panel__body--chest-v214" data-scroll-key="body">
        <section class="logistics-card logistics-card--role">
          <div class="logistics-card__title">Rôle</div>
          <div class="logistics-empty">${escapeHtml(chest.description || '')}</div>
          ${isProvider ? '<div class="logistics-hint">Les drones prélèvent ici pour remplir les coffres demandeurs du réseau.</div>' : ''}
          ${isBuffer ? '<div class="logistics-hint">Le tampon sert de source ou destination de secours selon le réseau.</div>' : ''}
          ${isRequester ? '<div class="logistics-hint">Le coffre demandeur reçoit les livraisons. Tu peux aussi déposer ou récupérer les ressources manuellement ici.</div>' : ''}
        </section>
        ${isRequester ? `<section class="logistics-card logistics-card--wide">
          <div class="logistics-card__title">Gestion manuelle</div>
          <div class="logistics-transfer-grid">
            <div class="logistics-transfer-box">
              <h3>Cargo du joueur</h3>
              <div class="logistics-scroll" data-scroll-key="cargo">${rows(chest.cargoResources || [], { action: 'Déposer', direction: 'deposit', structureId: chest.id })}</div>
            </div>
            <div class="logistics-transfer-box">
              <h3>Contenu du coffre</h3>
              <div class="logistics-scroll" data-scroll-key="chest">${rows(chest.resources || [], { action: 'Récupérer', direction: 'withdraw', structureId: chest.id })}</div>
            </div>
          </div>
        </section>` : `<section class="logistics-card"><div class="logistics-card__title">Contenu</div><div class="logistics-resources">${rows(chest.resources || [])}</div></section>`}
        ${isRequester ? `<section class="logistics-card logistics-card--hero">
          <div class="logistics-card__title">Demandes actives</div>
          <div class="logistics-requests logistics-scroll" data-scroll-key="requests">${requestRows(chest.requests || [])}</div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Ajouter / augmenter une demande</div>
          <div class="logistics-candidates logistics-scroll" data-scroll-key="candidates">${candidateRows(chest.requestCandidates || [])}</div>
        </section>` : ''}
      </div>
    `;
    this.restoreScroll(scroll);
  }
}
