function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function fmt(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function resourceRows(entries = [], actionLabel, direction, structureId, disabled = false) {
  if (!entries.length) return `<div class="rocket-workshop__empty">Vide.</div>`;
  return entries.map((r) => {
    const amount = r.amount | 0;
    return `
      <div class="rocket-workshop__row" data-resource="${escapeHtml(r.key)}" data-amount="${amount}" data-structure="${structureId | 0}">
        <span class="rocket-workshop__dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span>
        <span class="rocket-workshop__row-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
        <span class="rocket-workshop__qty">${amount}</span>
        <button type="button" class="rocket-workshop__mini" data-rocket-transfer="${escapeHtml(direction)}" data-amount="1" ${disabled ? 'disabled' : ''}>1</button>
        <button type="button" class="rocket-workshop__main-btn" data-rocket-transfer="${escapeHtml(direction)}" data-amount="all" ${disabled ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>
      </div>`;
  }).join('');
}

function recipeNeedRows(entries = []) {
  if (!entries.length) return '<span class="rocket-workshop__muted">—</span>';
  return entries.map((entry) => {
    const ok = (entry.stored | 0) >= (entry.amount | 0);
    return `<span class="rocket-workshop__chip ${ok ? 'is-ok' : 'is-missing'}" style="--res:${escapeHtml(entry.colorHex || '#fff')}"><i></i>${escapeHtml(entry.name)} ${entry.stored | 0}/${entry.amount | 0}</span>`;
  }).join('');
}



function costText(cost = []) {
  const entries = Array.isArray(cost) ? cost : [];
  if (!entries.length) return '';
  return entries.map((entry) => `${entry.amount || 0} ${entry.key || ''}`).join(' · ');
}

function roleCardsMarkup(recipe = {}) {
  const roles = Array.isArray(recipe.roleCards) ? recipe.roleCards : [];
  const additives = Array.isArray(recipe.roles?.additives) ? recipe.roles.additives : [];
  if (!roles.length && !additives.length) return '';
  return `
    <div class="rocket-workshop__roles">
      ${roles.map((role) => `
        <div class="rocket-workshop__role-card">
          <div class="rocket-workshop__role-kind">${escapeHtml(role.kind || 'Rôle')}</div>
          <div class="rocket-workshop__role-name">${escapeHtml(role.name || '—')}</div>
          <div class="rocket-workshop__role-summary">${escapeHtml(role.summary || '')}</div>
          <div class="rocket-workshop__role-cost">${escapeHtml(costText(role.cost || []))}</div>
        </div>
      `).join('')}
      ${additives.length ? `
        <div class="rocket-workshop__role-card rocket-workshop__role-card--addons">
          <div class="rocket-workshop__role-kind">Additifs</div>
          <div class="rocket-workshop__role-name">${escapeHtml(additives.map((a) => `${a.name || a.id} ×${a.amount || 1}`).join(' · '))}</div>
          <div class="rocket-workshop__role-summary">${escapeHtml(additives.map((a) => a.summary || '').filter(Boolean).join(' · '))}</div>
        </div>` : ''}
    </div>
  `;
}

function previewLines(lines = [], warnings = []) {
  const safeLines = (lines || []).filter(Boolean);
  const safeWarnings = (warnings || []).filter(Boolean);
  if (!safeLines.length && !safeWarnings.length) return '';
  return `
    <div class="rocket-workshop__preview">
      ${safeLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}
      ${safeWarnings.map((line) => `<span class="is-warning">${escapeHtml(line)}</span>`).join('')}
    </div>
  `;
}

function outputCards(entries = [], structureId = 0) {
  if (!entries.length) return '<div class="rocket-workshop__empty">Aucune roquette prête.</div>';
  return entries.map((item) => `
    <div class="rocket-output-card">
      <div class="rocket-output-card__glyph">☄</div>
      <div>
        <div class="rocket-output-card__name">${escapeHtml(item.name)}</div>
        <div class="rocket-output-card__meta">${item.amount | 0} en sortie · ${item.damage | 0} dégâts · ${item.splashRadius | 0} rayon</div>
        <div class="rocket-output-card__summary">${escapeHtml(item.summary || 'standard')}</div>
      </div>
      <button type="button" class="rocket-workshop__claim" data-rocket-claim="1" data-item-id="${escapeHtml(item.itemId)}" data-structure="${structureId | 0}">Récupérer</button>
    </div>
  `).join('');
}

export class RocketWorkshopPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.lastKey = '';
    this.el = document.createElement('div');
    this.el.className = 'rocket-workshop is-hidden';

    const stop = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    };

    const stopBubbleOnly = (ev) => {
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    };

    const isNativeScrollbarEvent = (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return false;
      const scrollBox = target.closest('.rocket-workshop__body');
      if (!scrollBox) return false;
      const rect = scrollBox.getBoundingClientRect();
      const nativeScrollbarWidth = Math.max(0, scrollBox.offsetWidth - scrollBox.clientWidth);
      if (nativeScrollbarWidth <= 0) return false;
      const grabZone = Math.max(18, nativeScrollbarWidth + 6);
      return ev.clientX >= rect.right - grabZone && ev.clientX <= rect.right + 4;
    };

    const handle = (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return false;
      if (target.closest('[data-close-rocket-workshop]')) {
        stop(ev);
        this.closeLocal();
        return true;
      }
      const transfer = target.closest('[data-rocket-transfer]');
      if (transfer) {
        stop(ev);
        if (!transfer.disabled) this.transferFromButton(transfer);
        return true;
      }
      const toggle = target.closest('[data-rocket-toggle]');
      if (toggle) {
        stop(ev);
        if (!toggle.disabled && this.currentId) this.sendCmd('rocket_workshop_toggle', { structureId: this.currentId, enabled: toggle.dataset.enabled === '1' });
        return true;
      }
      const start = target.closest('[data-rocket-start]');
      if (start) {
        stop(ev);
        if (!start.disabled && this.currentId) this.sendCmd('rocket_workshop_start', { structureId: this.currentId });
        return true;
      }
      const claim = target.closest('[data-rocket-claim]');
      if (claim) {
        stop(ev);
        const itemId = claim.dataset.itemId || '';
        if (this.currentId && itemId) this.sendCmd('rocket_workshop_claim', { structureId: this.currentId, itemId, amount: 9999 });
        return true;
      }
      return false;
    };

    for (const name of ['pointerdown', 'mousedown', 'click']) {
      this.el.addEventListener(name, (ev) => {
        if (name !== 'click' && isNativeScrollbarEvent(ev)) return;
        if (handle(ev)) return;
        // Ne pas empêcher le comportement natif de la zone scrollable :
        // sinon l'ascenseur vertical ne peut plus être attrapé à la souris.
        if (ev.target instanceof Element && ev.target.closest('.rocket-workshop__body')) stopBubbleOnly(ev);
        else stop(ev);
      }, { capture: true });
    }
    this.el.addEventListener('pointerup', (ev) => {
      if (isNativeScrollbarEvent(ev)) return;
      if (ev.target instanceof Element && ev.target.closest('.rocket-workshop__body')) stopBubbleOnly(ev);
      else stop(ev);
    }, { capture: true });
    this.el.addEventListener('contextmenu', stop, { capture: true });
  }

  closeLocal() {
    this.currentId = 0;
    this.lastKey = '';
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.sendCmd('rocket_workshop_close', {});
  }

  transferFromButton(btn) {
    const row = btn.closest('[data-resource]');
    const structureId = row?.dataset?.structure | 0;
    const resourceKey = row?.dataset?.resource || '';
    const rowAmount = row?.dataset?.amount | 0;
    const amount = btn.dataset.amount === 'all' ? rowAmount : Math.min(1, rowAmount);
    const direction = btn.dataset.rocketTransfer || 'deposit';
    if (!structureId || !resourceKey || amount <= 0) return;
    this.sendCmd('rocket_workshop_transfer', { structureId, resourceKey, amount, direction });
  }

  update(store) {
    const workshop = store?.myState?.rocketWorkshop || null;
    if (!workshop) {
      this.currentId = 0;
      this.el.classList.add('is-hidden');
      this.el.innerHTML = '';
      this.lastKey = '';
      return;
    }
    this.currentId = workshop.id | 0;
    this.el.classList.remove('is-hidden');
    const key = JSON.stringify({ workshop, t: Math.floor(Date.now() / 250) });
    if (key === this.lastKey) return;
    this.lastKey = key;

    const job = workshop.job || null;
    const progressPct = job ? Math.round((job.progress || 0) * 100) : 0;
    const powered = !!workshop.powered && workshop.enabled !== false;
    const status = workshop.enabled === false ? 'Arrêté' : (job?.active ? (job.paused ? 'En pause' : 'Production') : (powered ? 'Prêt' : 'Manque d’énergie'));
    const recipe = workshop.recipe || {};
    const out = recipe.ammoOutput || null;

    this.el.innerHTML = `
      <div class="rocket-workshop__head">
        <div>
          <div class="rocket-workshop__eyebrow">Industrie · munitions</div>
          <div class="rocket-workshop__title">${escapeHtml(workshop.name || 'Atelier de roquettes')}</div>
          <div class="rocket-workshop__meta ${powered ? 'is-powered' : 'is-unpowered'}">${escapeHtml(status)} · ${workshop.energyUse | 0} énergie active</div>
        </div>
        <button class="rocket-workshop__close" type="button" data-close-rocket-workshop="1">×</button>
      </div>
      <div class="rocket-workshop__body">
        <section class="rocket-workshop__recipe-card">
          <div class="rocket-workshop__recipe-glyph">☄</div>
          <div class="rocket-workshop__recipe-main">
            <div class="rocket-workshop__recipe-title">${escapeHtml(recipe.name || 'Lot de roquettes')}</div>
            <div class="rocket-workshop__recipe-sub">${escapeHtml(recipe.description || '')}</div>
            ${roleCardsMarkup(recipe)}
            <div class="rocket-workshop__chips">${recipeNeedRows(recipe.input || [])}</div>
            ${previewLines(recipe.previewLines || out?.previewLines || [], recipe.warnings || out?.warnings || [])}
            <div class="rocket-workshop__out">Sortie : <b>${out ? `${out.amount | 0} ${escapeHtml(out.name || out.shortName || 'roquettes')}` : '—'}</b></div>
          </div>
        </section>
        <div class="rocket-workshop__inline-actions">
          <div>
            <div class="rocket-workshop__inline-title">Contrôle de production</div>
            <div class="rocket-workshop__inline-sub">Lance ou arrête l’atelier sans descendre en bas du panneau.</div>
          </div>
          <div class="rocket-workshop__inline-buttons">
            <button class="rocket-workshop__produce ${workshop.enabled !== false ? 'is-off' : 'is-on'}" type="button" data-rocket-toggle="1" data-enabled="${workshop.enabled !== false ? '0' : '1'}">${workshop.enabled !== false ? 'Arrêter' : 'Activer'}</button>
            <button class="rocket-workshop__produce" type="button" data-rocket-start="1" ${workshop.canRun ? '' : 'disabled'}>Lancer production</button>
          </div>
        </div>
        <div class="rocket-workshop__progress">
          <div class="rocket-workshop__progress-head"><span>${escapeHtml(status)}</span><b>${job ? `${progressPct}% · ${fmt(job.remainingSeconds)}s` : '—'}</b></div>
          <div class="rocket-workshop__bar"><span style="width:${progressPct}%"></span></div>
        </div>
        <div class="rocket-workshop__cols">
          <section class="rocket-workshop__box">
            <h3>Cargo utile <span>corps · charge · stabilisateur · additifs</span></h3>
            ${resourceRows(workshop.cargoResources || [], 'Déposer', 'deposit', workshop.id, false)}
          </section>
          <section class="rocket-workshop__box">
            <h3>Mix en entrée <span>${Math.round(workshop.inputUsed || 0)} / ${Math.round(workshop.inputCapacity || 0)}</span></h3>
            ${resourceRows(workshop.input || [], 'Reprendre', 'withdraw', workshop.id, false)}
          </section>
          <section class="rocket-workshop__box rocket-workshop__box--output">
            <h3>Sortie roquettes <span>${Math.round(workshop.outputUsed || 0)} / ${Math.round(workshop.outputCapacity || 0)}</span></h3>
            ${outputCards(workshop.output || [], workshop.id)}
          </section>
        </div>
        <div class="rocket-workshop__actions">
          <button class="rocket-workshop__produce ${workshop.enabled !== false ? 'is-off' : 'is-on'}" type="button" data-rocket-toggle="1" data-enabled="${workshop.enabled !== false ? '0' : '1'}">${workshop.enabled !== false ? 'Arrêter' : 'Activer'}</button>
          <button class="rocket-workshop__produce" type="button" data-rocket-start="1" ${workshop.canRun ? '' : 'disabled'}>Lancer production</button>
        </div>
      </div>
    `;
  }
}
