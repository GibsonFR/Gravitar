function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function rows(resources = []) {
  if (!resources.length) return '<div class="logistics-empty">Vide.</div>';
  return resources.map((r) => `<div class="logistics-resource-row"><span class="logistics-dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span><span>${escapeHtml(r.name)}</span><b>${r.amount | 0}</b></div>`).join('');
}

function requestRows(requests = []) {
  if (!requests.length) return '<div class="logistics-empty">Aucune demande configurée.</div>';
  return requests.map((r) => {
    const pct = Math.max(0, Math.min(100, Math.round(((r.stored | 0) / Math.max(1, r.target | 0)) * 100)));
    return `<div class="logistics-request-row">
      <div class="logistics-request-row__top">
        <span><i style="background:${escapeHtml(r.colorHex || '#fff')}"></i>${escapeHtml(r.name)}</span>
        <b>${r.stored | 0}/${r.target | 0}</b>
      </div>
      <div class="logistics-bar mini"><span style="width:${pct}%"></span></div>
      <div class="logistics-request-row__actions">
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="-10">-10</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="10">+10</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="50">+50</button>
        <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-set-target="0">Retirer</button>
      </div>
    </div>`;
  }).join('');
}

function candidateRows(candidates = []) {
  if (!candidates.length) return '<div class="logistics-empty">Aucune ressource détectée dans le secteur.</div>';
  return candidates.map((r) => `<div class="logistics-candidate-row">
    <span><i style="background:${escapeHtml(r.colorHex || '#fff')}"></i>${escapeHtml(r.name)}</span>
    <b>${r.target | 0 ? `cible ${r.target | 0}` : ''}</b>
    <button type="button" data-logistic-request="${escapeHtml(r.key)}" data-delta="25">Demander +25</button>
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
      if (close || req) {
        ev.preventDefault();
        ev.stopPropagation();
        if (close) this.closeLocal();
        else if (!req.disabled) this.setRequest(req);
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
      <div class="logistics-panel__body">
        <section class="logistics-card ${isRequester ? 'logistics-card--hero' : ''}">
          <div class="logistics-card__title">Rôle</div>
          <div class="logistics-empty">${escapeHtml(chest.description || '')}</div>
          ${isProvider ? '<div class="logistics-hint">Les drones prélèvent ici pour remplir les coffres demandeurs du secteur.</div>' : ''}
          ${isBuffer ? '<div class="logistics-hint">Le tampon peut servir de réserve secondaire pour les prochaines versions du réseau.</div>' : ''}
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Contenu</div>
          <div class="logistics-resources">${rows(chest.resources || [])}</div>
        </section>
        ${isRequester ? `<section class="logistics-card logistics-card--hero">
          <div class="logistics-card__title">Demandes actives</div>
          <div class="logistics-requests">${requestRows(chest.requests || [])}</div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Ajouter une demande</div>
          <div class="logistics-candidates">${candidateRows(chest.requestCandidates || [])}</div>
        </section>` : ''}
      </div>
    `;
  }
}
