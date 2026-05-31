function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function rows(resources = []) {
  if (!resources.length) return '<div class="logistics-empty">Vide.</div>';
  return resources.map((r) => `<div class="logistics-resource-row"><span class="logistics-dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span><span>${escapeHtml(r.name)}</span><b>${r.amount | 0}</b></div>`).join('');
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
      if (target.closest('[data-logistic-chest-close]')) {
        ev.preventDefault();
        ev.stopPropagation();
        this.closeLocal();
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
    this.el.innerHTML = `
      <header class="logistics-panel__head">
        <div>
          <div class="logistics-panel__eyebrow">Coffre logistique · ${escapeHtml(chest.modeLabel)}</div>
          <h2>${escapeHtml(chest.name)}</h2>
          <div class="logistics-panel__meta">Secteur [${chest.sx | 0}, ${chest.sy | 0}] · capacité ${chest.capacity | 0}</div>
        </div>
        <button type="button" class="logistics-panel__close" data-logistic-chest-close="1">×</button>
      </header>
      <div class="logistics-panel__body">
        <section class="logistics-card">
          <div class="logistics-card__title">Rôle</div>
          <div class="logistics-empty">${escapeHtml(chest.description || '')}</div>
        </section>
        <section class="logistics-card">
          <div class="logistics-card__title">Contenu</div>
          <div class="logistics-resources">${rows(chest.resources || [])}</div>
        </section>
        <section class="logistics-card logistics-card--muted">
          <div class="logistics-card__title">Configuration</div>
          <div class="logistics-empty">La configuration des demandes arrive avec les missions intra-secteur.</div>
        </section>
      </div>
    `;
  }
}
