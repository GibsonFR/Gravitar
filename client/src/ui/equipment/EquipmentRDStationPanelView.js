function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function resourcePill(r) {
  return `<span class="equipment-fab__res ${r.have <= 0 ? 'is-missing' : ''}" style="--res:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)}<em>${r.have | 0}</em></span>`;
}


function scienceScore(sciences = [], scienceDefs = []) {
  return sciences.reduce((sum, key) => {
    const def = scienceDefs.find((s) => s.key === key);
    return sum + (def?.tier | 0);
  }, 0);
}

function bonusList(bonuses = {}) {
  const entries = Object.entries(bonuses || {}).filter(([, v]) => Number(v) !== 0);
  if (!entries.length) return '<span class="equipment-fab__muted">Base</span>';
  return entries.map(([key, value]) => `<span>${escapeHtml(formatStat(key, value))}</span>`).join('');
}

export class EquipmentRDStationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'equipment-fab equipment-rd';
    this.el.hidden = true;
    this.lastKey = '';
    this.selectedItemId = '';
    this.selectedSciences = [];
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
      const sci = ev.target.closest('[data-equipment-rd-science]');
      if (sci) {
        const key = sci.dataset.equipmentRdScience || '';
        const idx = Number(sci.dataset.index ?? -1);
        if (idx >= 0) this.selectedSciences.splice(idx, 1);
        else if (this.selectedSciences.length < 3) this.selectedSciences.push(key);
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
          sciences: this.selectedSciences.slice(0, 3)
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
    this.selectedSciences = this.selectedSciences.filter((key) => (data.sciences || []).some((s) => s.key === key && s.have > 0)).slice(0, data.maxSciences || 3);

    const key = JSON.stringify({ data, selected: this.selectedItemId, sciences: this.selectedSciences });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const selected = items.find((it) => it.itemId === this.selectedItemId) || null;
    const active = data.activeJob || null;

    const itemCards = items.map((it) => `
      <button type="button" class="equipment-rd__item ${it.itemId === this.selectedItemId ? 'is-selected' : ''}" data-equipment-rd-select="${escapeHtml(it.itemId)}">
        <strong>${escapeHtml(it.name)}</strong>
        <small>${escapeHtml(it.categoryName)} · Mk ${it.mark | 0}</small>
      </button>
    `).join('') || '<div class="equipment-fab__muted">Aucun objet</div>';

    const scienceSlots = Array.from({ length: data.maxSciences || 3 }, (_, i) => {
      const key = this.selectedSciences[i] || '';
      const sci = (data.sciences || []).find((s) => s.key === key);
      return `<button type="button" class="equipment-rd__slot ${key ? 'is-filled' : ''}" ${key ? `data-equipment-rd-science="${escapeHtml(key)}" data-index="${i}"` : ''}>
        ${key ? `${escapeHtml(sci?.name || key)} <small>retirer</small>` : '<span>Science</span>'}
      </button>`;
    }).join('');

    const sciences = (data.sciences || []).map((s) => {
      const countUsed = this.selectedSciences.filter((key) => key === s.key).length;
      const disabled = active || s.have <= countUsed || this.selectedSciences.length >= (data.maxSciences || 3);
      return `<button type="button" class="equipment-rd__science" data-equipment-rd-science="${escapeHtml(s.key)}" ${disabled ? 'disabled' : ''}>${resourcePill({ ...s, have: Math.max(0, (s.have | 0) - countUsed) })}<small>tier ${s.tier | 0} · ajouter</small></button>`;
    }).join('');

    const activeHtml = active ? `
      <div class="equipment-fab__result">
        <div>
          <span>En cours</span>
          <strong>${escapeHtml(active.itemName)}</strong>
          <small>${Math.ceil((active.remainingMs | 0) / 1000)}s</small>
        </div>
        <div>
          <div class="equipment-fab__bar"><span style="width:${Math.round((active.progress || 0) * 100)}%"></span></div>
          <button type="button" data-equipment-rd-cancel="1" data-structure="${data.id | 0}">Annuler</button>
        </div>
      </div>` : '';

    const canStart = !!selected && this.selectedSciences.length > 0 && !active && data.powered;

    this.el.innerHTML = `
      <div class="equipment-fab__head">
        <div>
          <div class="equipment-fab__eyebrow">R&D</div>
          <div class="equipment-fab__title">${escapeHtml(data.name || 'Station R&D')}</div>
          <div class="equipment-fab__meta">${data.powered ? 'Alimentée' : 'Sans énergie'} · ${data.seconds | 0}s</div>
        </div>
        <button type="button" class="equipment-fab__close" data-equipment-rd-close="1">×</button>
      </div>
      ${activeHtml}
      <div class="equipment-rd__layout">
        <section>
          <h3>Objet</h3>
          <div class="equipment-rd__items">${itemCards}</div>
          ${selected ? `<div class="equipment-rd__selected"><b>${escapeHtml(selected.name)}</b><div class="equipment-fab__bonus">${bonusList(selected.bonuses || {})}</div></div>` : ''}
        </section>
        <section>
          <h3>Sciences</h3>
          <div class="equipment-rd__hint">Clique une science pour l’ajouter. Clique un slot rempli pour la retirer.</div>
          <div class="equipment-rd__slots">${scienceSlots}</div>
          <div class="equipment-rd__score">Score science : <b>${scienceScore(this.selectedSciences, data.sciences || [])}</b> · variation finale ±60%</div>
          <div class="equipment-rd__science-list">${sciences}</div>
          <button class="equipment-rd__start" type="button" data-equipment-rd-start="1" data-structure="${data.id | 0}" ${canStart ? '' : 'disabled'}>Lancer R&D</button>
        </section>
      </div>
    `;
  }
}
