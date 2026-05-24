function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function fmt(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtList(entries = [], withHave = false) {
  if (!entries.length) return '<span class="machine-panel__muted">—</span>';
  return entries.map((e) => {
    const have = withHave ? ` <span class="machine-panel__have">stocké ${e.stored | 0} · cargo ${e.have | 0}</span>` : '';
    return `<span class="machine-panel__res" style="--res:${escapeHtml(e.colorHex || '#fff')}"><i></i>${escapeHtml(e.name)} ×${e.amount | 0}${have}</span>`;
  }).join('');
}

function resourceRows(entries = [], actionLabel, direction, slot, structureId, disabled = false) {
  if (!entries.length) return `<div class="machine-panel__empty">Vide.</div>`;
  return entries.map((r) => {
    const amount = r.amount | 0;
    return `
      <div class="machine-panel__row" data-resource="${escapeHtml(r.key)}" data-amount="${amount}" data-slot="${escapeHtml(slot)}" data-structure="${structureId | 0}">
        <span class="machine-panel__dot" style="background:${escapeHtml(r.colorHex || '#fff')}"></span>
        <span class="machine-panel__row-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
        <span class="machine-panel__qty">${amount}</span>
        <button type="button" class="machine-panel__mini" data-machine-transfer="${escapeHtml(direction)}" data-amount="1" ${disabled ? 'disabled' : ''}>1</button>
        <button type="button" class="machine-panel__main-btn" data-machine-transfer="${escapeHtml(direction)}" data-amount="all" ${disabled ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>
      </div>`;
  }).join('');
}

export class MachinePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.tab = 'production';
    this.lastKey = '';
    this.el = document.createElement('div');
    this.el.className = 'machine-panel is-hidden';

    const stopUiEvent = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    };

    const handleAction = (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return false;
      const close = target.closest('[data-close-machine]');
      if (close) {
        stopUiEvent(ev);
        this.closeLocal();
        return true;
      }
      const tab = target.closest('[data-machine-tab]');
      if (tab) {
        stopUiEvent(ev);
        this.tab = tab.dataset.machineTab || 'production';
        this.lastKey = '';
        return true;
      }
      const recipe = target.closest('[data-select-recipe]');
      if (recipe) {
        stopUiEvent(ev);
        const recipeId = recipe.dataset.selectRecipe || '';
        if (this.currentId && recipeId) {
          this.sendCmd('machine_select_recipe', { structureId: this.currentId, recipeId });
          this.tab = 'production';
          this.lastKey = '';
        }
        return true;
      }
      const transfer = target.closest('[data-machine-transfer]');
      if (transfer) {
        stopUiEvent(ev);
        if (!transfer.disabled) this.transferFromButton(transfer);
        return true;
      }
      const produce = target.closest('[data-produce-machine]');
      if (produce) {
        stopUiEvent(ev);
        if (!produce.disabled) {
          const recipeId = produce.dataset.recipe || '';
          const amount = produce.dataset.amount | 0 || 1;
          if (this.currentId && recipeId) this.sendCmd('machine_process', { structureId: this.currentId, recipeId, amount });
        }
        return true;
      }
      return false;
    };

    for (const eventName of ['pointerdown', 'mousedown', 'click']) {
      this.el.addEventListener(eventName, (ev) => {
        if (!handleAction(ev)) stopUiEvent(ev);
      }, { capture: true });
    }
    this.el.addEventListener('pointerup', stopUiEvent, { capture: true });
    this.el.addEventListener('contextmenu', stopUiEvent, { capture: true });
  }

  closeLocal() {
    this.currentId = 0;
    this.lastKey = '';
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.sendCmd('machine_close', {});
  }

  transferFromButton(btn) {
    const row = btn.closest('[data-resource]');
    const structureId = row?.dataset?.structure | 0;
    const resourceKey = row?.dataset?.resource || '';
    const rowAmount = row?.dataset?.amount | 0;
    const amount = btn.dataset.amount === 'all' ? rowAmount : Math.min(1, rowAmount);
    const direction = btn.dataset.machineTransfer || 'deposit';
    const slot = row?.dataset?.slot || 'input';
    if (!structureId || !resourceKey || amount <= 0) return;
    this.sendCmd('machine_transfer', { structureId, resourceKey, amount, direction, slot });
  }

  update(store) {
    const machine = store?.myState?.machine || null;
    if (!machine) {
      this.currentId = 0;
      this.el.classList.add('is-hidden');
      this.el.innerHTML = '';
      this.lastKey = '';
      return;
    }
    this.currentId = machine.id | 0;
    this.el.classList.remove('is-hidden');
    const key = JSON.stringify({ machine, tab: this.tab, t: Math.floor(Date.now() / 250) });
    if (key === this.lastKey) return;
    this.lastKey = key;

    const recipes = Array.isArray(machine.recipes) ? machine.recipes : [];
    const selected = machine.selectedRecipe || null;
    const job = machine.job || null;
    const powerLabel = machine.powered ? 'Alimentée' : 'Sans énergie';
    const powerClass = machine.powered ? 'is-powered' : 'is-unpowered';
    const activeTab = this.tab === 'select' ? 'select' : 'production';
    const busy = !!job?.active;

    const selectHtml = `
      <div class="machine-panel__select-grid">
        ${recipes.map((r) => `
          <button type="button" class="machine-panel__recipe-card ${r.id === machine.selectedRecipeId ? 'is-selected' : ''}" data-select-recipe="${escapeHtml(r.id)}" ${busy ? 'disabled' : ''}>
            <strong>${escapeHtml(r.name)}</strong>
            <em>${r.seconds | 0}s · ${r.energyUse | 0} énergie</em>
            <div class="machine-panel__line"><b>Entrée</b>${fmtList(r.input, false)}</div>
            <div class="machine-panel__line"><b>Sortie</b>${fmtList(r.output, false)}</div>
          </button>`).join('') || '<div class="machine-panel__empty">Aucune recette disponible.</div>'}
      </div>`;

    const progressPct = Math.round((Number(job?.progress) || 0) * 100);
    const progressHtml = job?.active ? `
      <div class="machine-panel__progress">
        <div class="machine-panel__progress-head">
          <span>${job.paused ? 'En pause' : 'Production'}</span>
          <b>${fmt(job.remainingSeconds)}s restantes</b>
        </div>
        <div class="machine-panel__bar"><span style="width:${progressPct}%"></span></div>
      </div>` : '<div class="machine-panel__idle">Aucune production en cours.</div>';

    const productionHtml = selected ? `
      <div class="machine-panel__production">
        <div class="machine-panel__recipe-banner">
          <div class="machine-panel__recipe-title">${escapeHtml(selected.name)}</div>
          <div class="machine-panel__recipe-stats">${selected.seconds | 0}s · ${selected.energyUse | 0} énergie</div>
        </div>
        ${progressHtml}
        <div class="machine-panel__cols">
          <section class="machine-panel__box">
            <h3>Entrée <span>${fmt(machine.inputUsed)} / ${fmt(machine.inputCapacity)}</span></h3>
            <div class="machine-panel__need">${fmtList(selected.input, true)}</div>
            ${resourceRows(machine.cargoResources || [], 'Insérer', 'deposit', 'input', machine.id, busy)}
            <div class="machine-panel__subhead">Dans la machine</div>
            ${resourceRows(machine.input || [], 'Reprendre', 'withdraw', 'input', machine.id, false)}
          </section>
          <section class="machine-panel__box machine-panel__center">
            <button class="machine-panel__produce" type="button" data-produce-machine="1" data-recipe="${escapeHtml(selected.id)}" data-amount="1" ${machine.canProduce ? '' : 'disabled'}>
              Démarrer
            </button>
            <button class="machine-panel__produce is-secondary" type="button" data-produce-machine="1" data-recipe="${escapeHtml(selected.id)}" data-amount="5" ${machine.canProduce ? '' : 'disabled'}>
              ×5
            </button>
            <div class="machine-panel__status ${powerClass}">${escapeHtml(busy && job.paused ? 'En attente d’énergie' : powerLabel)}</div>
          </section>
          <section class="machine-panel__box">
            <h3>Sortie <span>${fmt(machine.outputUsed)} / ${fmt(machine.outputCapacity)}</span></h3>
            <div class="machine-panel__need">${fmtList(selected.output, false)}</div>
            ${resourceRows(machine.output || [], 'Récupérer', 'withdraw', 'output', machine.id, false)}
          </section>
        </div>
      </div>` : '<div class="machine-panel__empty">Choisis une recette.</div>';

    this.el.innerHTML = `
      <div class="machine-panel__head">
        <div>
          <div class="machine-panel__eyebrow">Industrie</div>
          <div class="machine-panel__title">${escapeHtml(machine.name || 'Machine')}</div>
          <div class="machine-panel__meta ${powerClass}">${escapeHtml(powerLabel)} · ${machine.energyUse | 0} énergie active</div>
        </div>
        <button class="machine-panel__close" type="button" data-close-machine="1">×</button>
      </div>
      <div class="machine-panel__tabs">
        <button type="button" data-machine-tab="select" class="${activeTab === 'select' ? 'is-active' : ''}">Recette</button>
        <button type="button" data-machine-tab="production" class="${activeTab === 'production' ? 'is-active' : ''}">Production</button>
      </div>
      <div class="machine-panel__body">
        ${activeTab === 'select' ? selectHtml : productionHtml}
      </div>
    `;
  }
}
