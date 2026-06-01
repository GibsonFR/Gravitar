import { ScrollPreserver } from '../common/ScrollPreserver.js';
function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function resourcePill(r) {
  return `<span class="equipment-fab__res ${r.have <= 0 ? 'is-missing' : ''}" style="--res:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)}<em>${r.have | 0}</em></span>`;
}




function rdScienceRows(entries = [], structureId) {
  if (!entries.length) return '<div class="equipment-fab__empty">Vide.</div>';
  return entries.map((r) => `
    <div class="equipment-fab__buffer-row">
      <span class="equipment-fab__dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span>
      <span>${escapeHtml(r.name)}</span>
      <b>${r.amount | 0}</b>
      <button type="button" data-equipment-rd-transfer="withdraw" data-key="${escapeHtml(r.key)}" data-amount="1" data-structure="${structureId | 0}">1</button>
      <button type="button" data-equipment-rd-transfer="withdraw" data-key="${escapeHtml(r.key)}" data-amount="all" data-structure="${structureId | 0}">Tout</button>
    </div>`).join('');
}

function rdItemSlot(item, kind, structureId, placeholder) {
  if (!item) return `<div class="equipment-rd__big-slot is-empty"><span>${escapeHtml(placeholder)}</span></div>`;
  const action = kind === 'output'
    ? `<button type="button" data-equipment-rd-unload-item="output" data-structure="${structureId | 0}">Récupérer</button>`
    : `<button type="button" data-equipment-rd-unload-item="input" data-structure="${structureId | 0}">Retirer</button>`;
  return `<div class="equipment-rd__big-slot is-filled">
    <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.categoryName || '')} · Mk ${item.mark | 0}</small></div>
    ${action}
  </div>`;
}

function scienceScore(sciences = [], scienceDefs = []) {
  return sciences.reduce((sum, key) => {
    const def = scienceDefs.find((s) => s.key === key);
    return sum + ((def?.tier ?? 0) | 0);
  }, 0);
}

function statLabel(key) {
  return ({
    damageFlat: 'attack damage',
    enginePct: 'engine power',
    damageMultPct: 'damage',
    fireRatePct: 'fire rate',
    critChancePct: 'crit chance',
    critDamagePct: 'crit damage',
    armorPenFlat: 'armor pen',
    hpFlat: 'hull',
    shieldFlat: 'shield',
    armorFlat: 'armor',
    hpPct: 'hull',
    shieldPenPct: 'shield pen',
    hullRegenFlat: 'repair',
    energyRegenFlat: 'energy regen',
    energyFlat: 'energy',
    cooldownReductionPct: 'cooldown',
    cargoFlat: 'cargo'
  })[key] || key;
}

function timeLabel(seconds) {
  const s = Math.max(0, seconds | 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function formatStat(key, value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? '+' : '';
  if (String(key).endsWith('Pct')) return `${sign}${Math.round(n * 100)}% ${statLabel(key)}`;
  if (Math.abs(n) < 1 && !String(key).endsWith('Flat')) return `${sign}${Math.round(n * 100)}% ${statLabel(key)}`;
  return `${sign}${Math.round(n * 10) / 10} ${statLabel(key)}`;
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
    this.scrollPreserver = new ScrollPreserver(this.el);
    this.bind();
  }

  bind() {
    this.lastPointerActionAt = 0;

    const stopPanelPointer = (ev) => {
      ev.stopPropagation();
      this.tryHandleAction(ev, true);
    };

    this.el.addEventListener('pointerdown', stopPanelPointer, true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (performance.now() - (this.lastPointerActionAt || 0) < 260) {
        ev.preventDefault();
        return;
      }
      this.tryHandleAction(ev, false);
    });
  }

  tryHandleAction(ev, fromPointer = false) {
    const target = ev.target;
    if (!target?.closest) return false;
    const actionable = target.closest([
      '[data-equipment-rd-close]',
      '[data-equipment-rd-transfer]',
      '[data-equipment-rd-unload-item]',
      '[data-equipment-rd-select]',
      '[data-equipment-rd-science]',
      '[data-equipment-rd-start]',
      '[data-equipment-rd-cancel]'
    ].join(','));
    if (!actionable) return false;
    if (fromPointer && ev.button != null && ev.button !== 0) return false;

    const close = target.closest('[data-equipment-rd-close]');
    if (close) {
      this.sendCmd('equipment_rd_close', {});
      this.el.hidden = true;
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    const transfer = target.closest('[data-equipment-rd-transfer]');
    if (transfer && !transfer.disabled) {
      this.sendCmd('equipment_rd_transfer', {
        structureId: transfer.dataset.structure | 0,
        resourceKey: transfer.dataset.key || '',
        direction: transfer.dataset.equipmentRdTransfer || 'deposit',
        amount: transfer.dataset.amount || '1'
      });
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    const unload = target.closest('[data-equipment-rd-unload-item]');
    if (unload && !unload.disabled) {
      this.sendCmd('equipment_rd_unload_item', {
        structureId: unload.dataset.structure | 0,
        slot: unload.dataset.equipmentRdUnloadItem || 'input'
      });
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    const select = target.closest('[data-equipment-rd-select]');
    if (select && !select.disabled) {
      this.selectedItemId = select.dataset.equipmentRdSelect || '';
      this.sendCmd('equipment_rd_load_item', {
        structureId: select.dataset.structure | 0,
        itemId: this.selectedItemId
      });
      this.selectedItemId = '';
      this.lastKey = '';
      this.update(this.store);
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    const sci = target.closest('[data-equipment-rd-science]');
    if (sci && !sci.disabled) {
      const key = sci.dataset.equipmentRdScience || '';
      const idx = Number(sci.dataset.index ?? -1);
      if (idx >= 0) this.selectedSciences.splice(idx, 1);
      else if (this.selectedSciences.length < 3) this.selectedSciences.push(key);
      this.lastKey = '';
      this.update(this.store);
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    const start = target.closest('[data-equipment-rd-start]');
    if (start && !start.disabled) {
      this.sendCmd('equipment_rd_start', {
        structureId: start.dataset.structure | 0,
        itemId: start.dataset.item || '',
        sciences: this.selectedSciences.slice(0, 3)
      });
      start.setAttribute('disabled', 'disabled');
      start.textContent = 'Lancement…';
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    const cancel = target.closest('[data-equipment-rd-cancel]');
    if (cancel && !cancel.disabled) {
      this.sendCmd('equipment_rd_cancel', { structureId: cancel.dataset.structure | 0 });
      this.lastPointerActionAt = performance.now();
      ev.preventDefault();
      return true;
    }
    return false;
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
    this.selectedSciences = this.selectedSciences.filter((key) => (data.sciences || []).some((s) => s.key === key && (s.stored | 0) > 0)).slice(0, data.maxSciences || 3);

    const key = JSON.stringify({
      id: data.id,
      powered: data.powered,
      inputItem: data.inputItem?.itemId || '',
      outputItem: data.outputItem?.itemId || '',
      activeRemaining: data.activeJob?.remainingMs | 0,
      activeProgress: Math.round((data.activeJob?.progress || 0) * 1000),
      scienceInput: data.scienceInput || [],
      sciences: data.sciences || [],
      selected: this.selectedItemId,
      selectedSciences: this.selectedSciences
    });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const selected = items.find((it) => it.itemId === this.selectedItemId) || null;
    const active = data.activeJob || null;
    if (active && Array.isArray(active.sciences)) this.selectedSciences = active.sciences.slice(0, data.maxSciences || 3);

    const itemCards = items.map((it) => `
      <button type="button" class="equipment-rd__item ${it.itemId === this.selectedItemId ? 'is-selected' : ''}" data-equipment-rd-select="${escapeHtml(it.itemId)}" data-structure="${data.id | 0}">
        <strong>${escapeHtml(it.name)}</strong>
        <small>${escapeHtml(it.categoryName)} · Mk ${it.mark | 0} · charger</small>
      </button>
    `).join('') || '<div class="equipment-fab__muted">Aucun objet</div>';

    const scienceDepositRows = (data.sciences || []).map((s) => `
      <button type="button" class="equipment-fab__deposit ${s.have <= 0 ? 'is-empty' : ''}" data-equipment-rd-transfer="deposit" data-key="${escapeHtml(s.key)}" data-amount="all" data-structure="${data.id | 0}" ${s.have <= 0 ? 'disabled' : ''}>
        <span class="equipment-fab__dot" style="background:${escapeHtml(s.colorHex || '#fff')}"></span>
        ${escapeHtml(s.name)} <b>${s.stored | 0}</b>
      </button>`).join('');

    const scienceSlots = Array.from({ length: data.maxSciences || 3 }, (_, i) => {
      const key = this.selectedSciences[i] || '';
      const sci = (data.sciences || []).find((s) => s.key === key);
      return `<button type="button" class="equipment-rd__slot ${key ? 'is-filled' : ''}" ${key ? `data-equipment-rd-science="${escapeHtml(key)}" data-index="${i}"` : ''}>
        ${key ? `${escapeHtml(sci?.name || key)} <small>retirer</small>` : '<span>Science</span>'}
      </button>`;
    }).join('');

    const sciences = (Array.isArray(data.sciences) ? data.sciences : []).filter(Boolean).map((s) => {
      const key = String(s.key || '');
      const countUsed = this.selectedSciences.filter((k) => k === key).length;
      const disabled = !!active || ((s.stored | 0) <= countUsed) || this.selectedSciences.length >= (data.maxSciences || 3);
      return `<button type="button" class="equipment-rd__science" data-equipment-rd-science="${escapeHtml(key)}" ${disabled ? 'disabled' : ''}>${resourcePill({ ...s, have: Math.max(0, (s.stored | 0) - countUsed) })}<small>tier ${s.tier | 0} · choisir</small></button>`;
    }).join('');

    const activeProgress = Math.max(0, Math.min(1, active?.progress || 0));
    const activeRemaining = Math.ceil((active?.remainingMs | 0) / 1000);
    const activeTotal = Math.max(1, Math.ceil((active?.totalMs | 0) / 1000));
    const activeSciences = Array.isArray(active?.sciences) ? active.sciences : [];
    const activeHtml = active ? `
      <div class="equipment-rd__progress-card">
        <div class="equipment-rd__progress-top">
          <div>
            <span>R&D en cours</span>
            <strong>${escapeHtml(active.itemName || 'Objet')}</strong>
          </div>
          <b>${Math.round(activeProgress * 100)}%</b>
        </div>
        <div class="equipment-rd__progress-bar"><span style="width:${Math.round(activeProgress * 100)}%"></span></div>
        <div class="equipment-rd__progress-meta">
          <span>${timeLabel(activeRemaining)} restant</span>
          <span>${timeLabel(activeTotal)} total</span>
          <span>score ${active.scienceScore | 0}</span>
        </div>
        ${activeSciences.length ? `<div class="equipment-rd__progress-sciences">${activeSciences.map((key) => `<i>${escapeHtml(key.replace('SciencePack', '').replace(/([A-Z])/g, ' $1').trim())}</i>`).join('')}</div>` : ''}
        <button type="button" data-equipment-rd-cancel="1" data-structure="${data.id | 0}">Annuler</button>
      </div>` : '';

    const canStart = !!data.inputItem && this.selectedSciences.length > 0 && !active && data.powered && !data.outputItem;

    const scroll = this.scrollPreserver.capture();
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
          <h3>Input / Output</h3>
          ${rdItemSlot(data.inputItem, 'input', data.id, 'Glisse/charge un objet')}
          ${rdItemSlot(data.outputItem, 'output', data.id, 'Sortie R&D')}
          <h3>Objets disponibles</h3>
          <div class="equipment-rd__items equipment-fab__scroll ${active || data.inputItem ? 'is-busy' : ''}" data-scroll-key="equipment-rd-items">${itemCards}</div>
        </section>
        <section>
          <h3>Sciences en machine</h3>
          <div class="equipment-rd__hint">Dépose des sciences dans le buffer, puis choisis jusqu’à 3 slots.</div>
          <div class="equipment-fab__deposit-grid equipment-fab__scroll" data-scroll-key="equipment-rd-cargo-science">${scienceDepositRows}</div>
          <div class="equipment-fab__io-mini equipment-fab__scroll" data-scroll-key="equipment-rd-buffer-science">${rdScienceRows(data.scienceInput || [], data.id)}</div>
          <div class="equipment-rd__slots">${scienceSlots}</div>
          <div class="equipment-rd__score">Score science : <b>${scienceScore(this.selectedSciences, data.sciences || [])}</b> · variation finale ±60%</div>
          <div class="equipment-rd__science-list equipment-fab__scroll ${active ? 'is-busy' : ''}" data-scroll-key="equipment-rd-sciences">${sciences}</div>
          <button class="equipment-rd__start" type="button" data-equipment-rd-start="1" data-structure="${data.id | 0}" data-item="${escapeHtml(data.inputItem?.itemId || '')}" ${canStart ? '' : 'disabled'}>Lancer R&D</button>
        </section>
      </div>
    `;
    this.scrollPreserver.restore(scroll);
  }
}
