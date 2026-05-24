function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function resourceList(entries = []) {
  if (!entries.length) return '<span class="equipment-fab__muted">Aucun</span>';
  return entries.map((r) => `<span class="equipment-fab__res ${r.missing > 0 ? 'is-missing' : ''}" style="--res:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)} ×${r.amount | 0}<em>${r.have | 0}</em></span>`).join('');
}

function bonusList(bonuses = {}) {
  const entries = Object.entries(bonuses || {}).filter(([, v]) => Number(v) !== 0);
  if (!entries.length) return '<span class="equipment-fab__muted">Stats de base seulement</span>';
  return entries.map(([key, value]) => `<span>${escapeHtml(key)} ${Number(value) > 0 ? '+' : ''}${Math.round(Number(value) * 1000) / 10}${Math.abs(Number(value)) < 1 ? '%' : ''}</span>`).join('');
}

export class EquipmentRDStationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'equipment-fab equipment-rd';
    this.el.hidden = true;
    this.lastKey = '';
    this.selectedItemId = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-equipment-rd-close]');
      if (close) {
        this.sendCmd('equipment_rd_close', {});
        this.el.hidden = true;
        ev.preventDefault();
        return;
      }
      const select = ev.target.closest('[data-equipment-rd-select]');
      if (select) {
        this.selectedItemId = select.dataset.equipmentRdSelect || '';
        this.lastKey = '';
        this.update(this.store);
        ev.preventDefault();
        return;
      }
      const start = ev.target.closest('[data-equipment-rd-start]');
      if (start) {
        this.sendCmd('equipment_rd_start', {
          structureId: start.dataset.structure | 0,
          itemId: this.selectedItemId,
          programId: start.dataset.equipmentRdStart || ''
        });
        ev.preventDefault();
        return;
      }
      const cancel = ev.target.closest('[data-equipment-rd-cancel]');
      if (cancel) {
        this.sendCmd('equipment_rd_cancel', { structureId: cancel.dataset.structure | 0 });
        ev.preventDefault();
      }
    });
  }

  update(store) {
    this.store = store;
    const data = store.myState?.equipmentRDStation || null;
    if (!data) {
      this.el.hidden = true;
      this.lastKey = '';
      return;
    }
    const items = data.neutralItems || [];
    if (!items.some((it) => it.itemId === this.selectedItemId)) this.selectedItemId = items[0]?.itemId || '';
    const key = JSON.stringify({ data, selected: this.selectedItemId });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const selected = items.find((it) => it.itemId === this.selectedItemId) || null;
    const active = data.activeJob || null;
    const itemCards = items.map((it) => `
      <button type="button" class="equipment-rd__item ${it.itemId === this.selectedItemId ? 'is-selected' : ''}" data-equipment-rd-select="${escapeHtml(it.itemId)}">
        <strong>${escapeHtml(it.name)}</strong>
        <small>${escapeHtml(it.categoryName)} · Mark ${it.mark | 0}</small>
      </button>
    `).join('') || '<div class="equipment-fab__muted">Aucun objet neutre disponible. Fabrique d’abord un objet dans l’atelier.</div>';

    const programs = (data.programs || []).map((p) => `
      <article class="equipment-fab__card ${p.locked ? 'is-locked' : ''}">
        <div class="equipment-fab__card-top">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <small>${p.seconds | 0}s · max ${p.maxSciencePacks | 0} science(s)</small>
          </div>
          <span>${p.locked ? 'Verrouillé' : p.canStart && selected && !active ? 'Prêt' : 'Indisponible'}</span>
        </div>
        <p>${escapeHtml(p.description || '')}</p>
        <div class="equipment-fab__sub">Sciences consommées</div>
        <div class="equipment-fab__resources">${resourceList(p.input || [])}</div>
        ${p.locked ? `<div class="equipment-fab__lock">Requiert : ${escapeHtml(p.requiredResearchName || p.requiredResearchId || 'recherche')}</div>` : ''}
        <button type="button" data-equipment-rd-start="${escapeHtml(p.id)}" data-structure="${data.id | 0}" ${p.canStart && selected && !active ? '' : 'disabled'}>Lancer R&D</button>
      </article>
    `).join('');

    const activeHtml = active ? `
      <div class="equipment-fab__result">
        <div>
          <span>R&D en cours</span>
          <strong>${escapeHtml(active.itemName)}</strong>
          <small>${escapeHtml(active.programName)} · ${Math.ceil((active.remainingMs | 0) / 1000)}s restantes</small>
        </div>
        <div>
          <div class="equipment-fab__bar"><span style="width:${Math.round((active.progress || 0) * 100)}%"></span></div>
          <button type="button" data-equipment-rd-cancel="1" data-structure="${data.id | 0}">Annuler</button>
        </div>
      </div>` : '';

    this.el.innerHTML = `
      <div class="equipment-fab__head">
        <div>
          <div class="equipment-fab__eyebrow">Station R&D</div>
          <div class="equipment-fab__title">${escapeHtml(data.name || 'Station R&D')}</div>
          <div class="equipment-fab__meta">${data.powered ? 'Alimentée' : 'Sans énergie'} · amélioration procédurale en 60s</div>
        </div>
        <button type="button" class="equipment-fab__close" data-equipment-rd-close="1">×</button>
      </div>
      <div class="equipment-fab__notice">Choisis un objet neutre, puis injecte 1 à 3 sciences. L’objet sera consommé et remplacé par une version avec stats, passifs et tags.</div>
      ${activeHtml}
      <div class="equipment-rd__layout">
        <section>
          <h3>Objets neutres</h3>
          <div class="equipment-rd__items">${itemCards}</div>
          ${selected ? `<div class="equipment-rd__selected"><b>${escapeHtml(selected.name)}</b><div>${bonusList(selected.bonuses || {})}</div></div>` : ''}
        </section>
        <section>
          <h3>Programmes R&D</h3>
          <div class="equipment-rd__programs">${programs}</div>
        </section>
      </div>
    `;
  }
}
