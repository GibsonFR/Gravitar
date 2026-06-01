import { ScrollPreserver } from '../common/ScrollPreserver.js';
import { renderMachineHeader, renderMachineMetricStrip, machineStateClass } from '../common/MachineUiComponents.js';
function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function fmt(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const RESOURCE_GROUPS = [
  { id: 'body', title: 'Corps', subtitle: 'Structure', keys: ['steelPlate', 'titaniumPlate'] },
  { id: 'charge', title: 'Charge', subtitle: 'Propulsion & charge', keys: ['propellant', 'biofuel', 'waterIce', 'ammoniaIce'] },
  { id: 'control', title: 'Stabilisation', subtitle: 'Contrôle & guidage', keys: ['controlCircuit', 'lithiumBattery', 'copperWire'] },
  { id: 'additives', title: 'Additifs', subtitle: 'Effets spéciaux', keys: ['graphite', 'sulfur', 'unknownTechFragment'] }
];

function groupEntries(entries = []) {
  const remaining = [...entries];
  const groups = [];
  for (const group of RESOURCE_GROUPS) {
    const bucket = [];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const entry = remaining[i];
      if (group.keys.includes(entry.key)) {
        bucket.unshift(entry);
        remaining.splice(i, 1);
      }
    }
    groups.push({ ...group, entries: bucket });
  }
  if (remaining.length) groups[groups.length - 1].entries.push(...remaining);
  return groups;
}

function chipList(entries = []) {
  if (!entries.length) return '<span class="rocket-workshop__muted">Aucun composant</span>';
  return entries.map((entry) => `<span class="rocket-workshop__component-chip" style="--res:${escapeHtml(entry.colorHex || '#fff')}"><i></i>${escapeHtml(entry.name)} ×${entry.amount | 0}</span>`).join('');
}

function compositionCards(entries = []) {
  const groups = groupEntries(entries);
  const filled = entries.reduce((sum, entry) => sum + (entry.amount | 0), 0);
  return `
    <div class="rocket-workshop__composition-summary">
      <div class="rocket-workshop__composition-total">
        <span>Quantité dans le mix</span>
        <strong>${filled}</strong>
      </div>
      <div class="rocket-workshop__composition-slots">
        ${groups.map((group) => {
          const amount = group.entries.reduce((sum, entry) => sum + (entry.amount | 0), 0);
          const filledClass = amount > 0 ? 'is-filled' : '';
          return `
            <article class="rocket-workshop__composition-slot ${filledClass}">
              <div class="rocket-workshop__composition-title-row">
                <span>${escapeHtml(group.title)}</span>
                <b>${amount}</b>
              </div>
              <div class="rocket-workshop__component-list">${chipList(group.entries)}</div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function requirementRows(entries = []) {
  if (!entries.length) return '<div class="rocket-workshop__empty">Aucun prérequis.</div>';
  return entries.map((entry) => {
    const ok = (entry.stored | 0) >= (entry.amount | 0);
    return `
      <div class="rocket-workshop__requirement ${ok ? 'is-ok' : 'is-missing'}">
        <span class="rocket-workshop__dot" style="background:${escapeHtml(entry.colorHex || '#fff')}"></span>
        <span class="rocket-workshop__requirement-name">${escapeHtml(entry.name)}</span>
        <span class="rocket-workshop__requirement-count">${entry.stored | 0}/${entry.amount | 0}</span>
      </div>
    `;
  }).join('');
}

function statCard(label, value, accent = '') {
  return `
    <div class="rocket-workshop__stat-card ${accent ? `is-${accent}` : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function previewPills(lines = [], warnings = []) {
  const safeLines = (lines || []).filter(Boolean);
  const safeWarnings = (warnings || []).filter(Boolean);
  if (!safeLines.length && !safeWarnings.length) return '<div class="rocket-workshop__empty">Aucun effet spécial.</div>';
  return `
    <div class="rocket-workshop__preview-pills">
      ${safeLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}
      ${safeWarnings.map((line) => `<span class="is-warning">${escapeHtml(line)}</span>`).join('')}
    </div>
  `;
}

function resourceRow(entry, actionLabel, direction, structureId, disabled = false) {
  const amount = entry.amount | 0;
  const plusPrefix = direction === 'withdraw' ? '-' : '+';
  const buttonAttrs = `data-rocket-transfer="${escapeHtml(direction)}" data-resource-key="${escapeHtml(entry.key)}" data-row-amount="${amount}" data-structure="${structureId | 0}"`;
  return `
    <div class="rocket-workshop__row" data-resource="${escapeHtml(entry.key)}" data-amount="${amount}" data-structure="${structureId | 0}">
      <span class="rocket-workshop__dot" style="background:${escapeHtml(entry.colorHex || '#fff')}"></span>
      <div class="rocket-workshop__row-copy">
        <span class="rocket-workshop__row-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
        <span class="rocket-workshop__row-sub">${amount} unité${amount > 1 ? 's' : ''}</span>
      </div>
      <div class="rocket-workshop__row-actions">
        <button type="button" class="rocket-workshop__mini" ${buttonAttrs} data-amount="1" ${disabled ? 'disabled' : ''}>${plusPrefix}1</button>
        <button type="button" class="rocket-workshop__mini" ${buttonAttrs} data-amount="5" ${disabled ? 'disabled' : ''}>${plusPrefix}5</button>
        <button type="button" class="rocket-workshop__main-btn" ${buttonAttrs} data-amount="all" ${disabled ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>
      </div>
    </div>
  `;
}

function resourceGroups(entries = [], actionLabel, direction, structureId, emptyLabel = 'Vide.') {
  if (!entries.length) return `<div class="rocket-workshop__empty">${escapeHtml(emptyLabel)}</div>`;
  const groups = groupEntries(entries).filter((group) => group.entries.length);
  if (!groups.length) return `<div class="rocket-workshop__empty">${escapeHtml(emptyLabel)}</div>`;
  return groups.map((group) => `
    <section class="rocket-workshop__resource-group">
      <div class="rocket-workshop__group-head">
        <span>${escapeHtml(group.title)}</span>
        <b>${group.entries.reduce((sum, entry) => sum + (entry.amount | 0), 0)}</b>
      </div>
      <div class="rocket-workshop__rows">${group.entries.map((entry) => resourceRow(entry, actionLabel, direction, structureId)).join('')}</div>
    </section>
  `).join('');
}

function outputCards(entries = [], structureId = 0) {
  if (!entries.length) return '<div class="rocket-workshop__empty">Aucune roquette prête.</div>';
  return entries.map((item) => `
    <article class="rocket-output-card">
      <div class="rocket-output-card__glyph">☄</div>
      <div class="rocket-output-card__main">
        <div class="rocket-output-card__name">${escapeHtml(item.name)}</div>
        <div class="rocket-output-card__meta">${item.amount | 0} en sortie · ${item.damage | 0} dégâts · ${item.splashRadius | 0} rayon</div>
        <div class="rocket-output-card__summary">${escapeHtml(item.summary || 'standard')}</div>
      </div>
      <button type="button" class="rocket-workshop__claim" data-rocket-claim="1" data-item-id="${escapeHtml(item.itemId)}" data-structure="${structureId | 0}">Récupérer</button>
    </article>
  `).join('');
}

function buildRenderKey(workshop) {
  return JSON.stringify({
    id: workshop?.id | 0,
    powered: !!workshop?.powered,
    enabled: workshop?.enabled !== false,
    energyUse: workshop?.energyUse | 0,
    recipe: workshop?.recipe || null,
    input: workshop?.input || [],
    cargoResources: workshop?.cargoResources || [],
    inputUsed: workshop?.inputUsed | 0,
    inputCapacity: workshop?.inputCapacity | 0,
    output: workshop?.output || [],
    outputUsed: workshop?.outputUsed | 0,
    outputCapacity: workshop?.outputCapacity | 0,
    canRun: !!workshop?.canRun,
    jobShape: workshop?.job ? {
      recipeId: workshop.job.recipeId || '',
      totalMs: workshop.job.totalMs | 0,
      active: !!workshop.job.active,
      paused: !!workshop.job.paused
    } : null,
    lastProduced: workshop?.lastProduced || null
  });
}

export class RocketWorkshopPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.lastKey = '';
    this.dynamic = null;
    this.scrollPreserver = null;
    this.el = document.createElement('div');
    this.el.className = 'rocket-workshop is-hidden';
    this.scrollPreserver = new ScrollPreserver(this.el);

    const routePointerAction = (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      if (target.closest('button, [data-rocket-transfer], [data-rocket-toggle], [data-rocket-start], [data-rocket-claim], [data-close-rocket-workshop]')) {
        this.handleActionEvent(ev);
      } else {
        ev.stopPropagation();
      }
    };
    this.el.addEventListener('pointerdown', routePointerAction, { capture: true });
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), { capture: true });
    this.el.addEventListener('mouseup', (ev) => ev.stopPropagation(), { capture: true });
    this.el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    }, { capture: true });
    this.el.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true, capture: true });
    this.el.addEventListener('contextmenu', (ev) => ev.stopPropagation(), { capture: true });
  }

  handleActionEvent(ev) {
    ev.stopPropagation();
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-close-rocket-workshop]')) {
      ev.preventDefault();
      this.closeLocal();
      return;
    }
    const transfer = target.closest('[data-rocket-transfer]');
    if (transfer) {
      ev.preventDefault();
      if (!transfer.disabled) this.transferFromButton(transfer);
      return;
    }
    const toggle = target.closest('[data-rocket-toggle]');
    if (toggle) {
      ev.preventDefault();
      if (!toggle.disabled && this.currentId) this.sendCmd('rocket_workshop_toggle', { structureId: this.currentId, enabled: toggle.dataset.enabled === '1' });
      return;
    }
    const start = target.closest('[data-rocket-start]');
    if (start) {
      ev.preventDefault();
      if (!start.disabled && this.currentId) this.sendCmd('rocket_workshop_start', { structureId: this.currentId });
      return;
    }
    const claim = target.closest('[data-rocket-claim]');
    if (claim) {
      ev.preventDefault();
      const itemId = claim.dataset.itemId || '';
      if (this.currentId && itemId) this.sendCmd('rocket_workshop_claim', { structureId: this.currentId, itemId, amount: 9999 });
    }
  }

  closeLocal() {
    this.currentId = 0;
    this.lastKey = '';
    this.dynamic = null;
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.sendCmd('rocket_workshop_close', {});
  }

  transferFromButton(btn) {
    const row = btn.closest('[data-resource]');
    const structureId = (btn.dataset.structure | 0) || (row?.dataset?.structure | 0);
    const resourceKey = btn.dataset.resourceKey || row?.dataset?.resource || '';
    const rowAmount = (btn.dataset.rowAmount | 0) || (row?.dataset?.amount | 0);
    let amount = 1;
    if (btn.dataset.amount === 'all') amount = rowAmount;
    else if (btn.dataset.amount === '5') amount = Math.min(5, rowAmount);
    else amount = Math.min(1, rowAmount);
    const direction = btn.dataset.rocketTransfer || 'deposit';
    if (!structureId || !resourceKey || amount <= 0) return;
    this.sendCmd('rocket_workshop_transfer', { structureId, resourceKey, amount, direction });
  }

  captureScroll() {
    return this.scrollPreserver.capture();
  }

  restoreScroll(map) {
    this.scrollPreserver.restore(map);
  }

  setDynamicRefs() {
    this.dynamic = {
      titleStatus: this.el.querySelector('[data-role="status-line"]'),
      dockStatus: this.el.querySelector('[data-role="dock-status"]'),
      dockHint: this.el.querySelector('[data-role="dock-hint"]'),
      progressLabel: this.el.querySelector('[data-role="progress-label"]'),
      progressBar: this.el.querySelector('[data-role="progress-bar"]'),
      progressFill: this.el.querySelector('[data-role="progress-fill"]'),
      startBtn: this.el.querySelector('[data-rocket-start]'),
      toggleBtn: this.el.querySelector('[data-rocket-toggle]')
    };
  }

  updateDynamicStatus(workshop) {
    if (!this.dynamic) return;
    const job = workshop?.job || null;
    const progressPct = job ? Math.round((job.progress || 0) * 100) : 0;
    const powered = !!workshop?.powered && workshop?.enabled !== false;
    const status = workshop?.enabled === false
      ? 'Arrêté'
      : (job?.active ? (job.paused ? 'En pause' : 'Production en cours') : (powered ? 'Prêt à produire' : 'Manque d’énergie'));
    const hint = workshop?.canRun
      ? 'Composition valide : vous pouvez lancer ou laisser l’atelier redémarrer automatiquement.'
      : (workshop?.enabled === false ? 'Réactivez l’atelier pour reprendre la fabrication.' : (powered ? 'Ajoutez les composants requis ou libérez la sortie.' : 'Alimentez la base pour relancer la chaîne.'));

    if (this.dynamic.titleStatus) {
      this.dynamic.titleStatus.textContent = `${status} · ${workshop?.energyUse | 0} énergie active`;
      this.dynamic.titleStatus.classList.toggle('is-powered', powered);
      this.dynamic.titleStatus.classList.toggle('is-unpowered', !powered);
    }
    if (this.dynamic.dockStatus) this.dynamic.dockStatus.textContent = status;
    if (this.dynamic.dockHint) this.dynamic.dockHint.textContent = hint;
    if (this.dynamic.progressLabel) this.dynamic.progressLabel.textContent = job ? `${progressPct}% · ${fmt(job.remainingSeconds)}s` : '—';
    if (this.dynamic.progressBar) this.dynamic.progressBar.textContent = job?.active ? 'Production' : status;
    if (this.dynamic.progressFill) this.dynamic.progressFill.style.width = `${progressPct}%`;
    if (this.dynamic.startBtn) this.dynamic.startBtn.disabled = !workshop?.canRun;
    if (this.dynamic.toggleBtn) {
      const enabled = workshop?.enabled !== false;
      this.dynamic.toggleBtn.dataset.enabled = enabled ? '0' : '1';
      this.dynamic.toggleBtn.textContent = enabled ? 'Arrêter' : 'Activer';
      this.dynamic.toggleBtn.classList.toggle('is-secondary', !enabled);
    }
  }

  render(workshop) {
    const recipe = workshop.recipe || {};
    const out = recipe.ammoOutput || {};
    const heroStats = [
      statCard('Lot', `${out.amount | 0}`),
      statCard('Dégâts', `${out.damage | 0}`),
      statCard('Rayon', `${out.splashRadius | 0}`),
      statCard('Cycle', `${recipe.seconds | 0}s`),
      statCard('Énergie', `${workshop.energyUse | 0}`)
    ].join('');
    const uiState = machineStateClass({ powered: !!workshop.powered, enabled: workshop.enabled !== false, busy: !!workshop.job?.active, danger: workshop.enabled !== false && !workshop.powered });
    const headerHtml = renderMachineHeader({
      eyebrow: 'Industrie · munitions',
      title: workshop.name || 'Atelier de roquettes',
      meta: `${workshop.powered ? 'Alimenté' : 'Sans énergie'} · ${workshop.energyUse | 0} énergie active`,
      state: uiState,
      closeAttr: 'data-close-rocket-workshop="1"',
      badges: [
        { label: workshop.enabled !== false ? 'Activé' : 'Arrêté', className: workshop.enabled !== false ? 'is-ok' : 'is-warning' },
        { label: workshop.powered ? 'Alimenté' : 'Sans énergie', className: workshop.powered ? 'is-ok' : 'is-danger' },
        workshop.job?.active ? { label: 'Production', className: 'is-warning' } : null
      ]
    });
    const metricsHtml = renderMachineMetricStrip([
      { label: 'Mix', value: `${Math.round(workshop.inputUsed || 0)} / ${Math.round(workshop.inputCapacity || 0)}` },
      { label: 'Sortie', value: `${Math.round(workshop.outputUsed || 0)} / ${Math.round(workshop.outputCapacity || 0)}` },
      { label: 'Énergie', value: `${workshop.energyUse | 0}` },
      { label: 'Statut', value: workshop.canRun ? 'Prêt' : 'En attente' }
    ]);

    return `
      ${headerHtml}
      <div class="rocket-workshop__meta" data-role="status-line" hidden></div>
      ${metricsHtml}
      <div class="rocket-workshop__body">
        <div class="rocket-workshop__layout">
          <section class="rocket-workshop__panel rocket-workshop__panel--hero">
            <div class="rocket-workshop__hero">
              <div class="rocket-workshop__hero-top">
                <div class="rocket-workshop__hero-glyph">☄</div>
                <div>
                  <div class="rocket-workshop__hero-title">${escapeHtml(recipe.name || 'Lot de roquettes')}</div>
                  <div class="rocket-workshop__hero-sub">${escapeHtml(recipe.description || '')}</div>
                </div>
              </div>
              <div class="rocket-workshop__stats-grid">${heroStats}</div>
            </div>
            <div class="rocket-workshop__panel-block">
              <div class="rocket-workshop__panel-title">Lecture du mix</div>
              ${previewPills(recipe.previewLines || out.previewLines || [], recipe.warnings || out.warnings || [])}
            </div>
            <div class="rocket-workshop__panel-block">
              <div class="rocket-workshop__panel-title">Pré requis minimums</div>
              <div class="rocket-workshop__requirements">${requirementRows(recipe.input || [])}</div>
            </div>
            <div class="rocket-workshop__panel-block rocket-workshop__panel-block--grow">
              <div class="rocket-workshop__panel-title">Composition actuelle</div>
              <div class="rocket-workshop__composition-grid">${compositionCards(workshop.input || [])}</div>
            </div>
          </section>

          <section class="rocket-workshop__panel">
            <div class="rocket-workshop__section-head">
              <div>
                <div class="rocket-workshop__section-title">Cargo utile</div>
                <div class="rocket-workshop__section-sub">Déposez uniquement les ressources utiles au mix.</div>
              </div>
              <div class="rocket-workshop__section-pill">Cargo</div>
            </div>
            <div class="rocket-workshop__scroll" data-scroll-key="rocket-cargo">${resourceGroups(workshop.cargoResources || [], 'Tout déposer', 'deposit', workshop.id, 'Aucune ressource utile disponible.')}</div>
          </section>

          <section class="rocket-workshop__panel">
            <div class="rocket-workshop__section-head">
              <div>
                <div class="rocket-workshop__section-title">Entrée & sortie</div>
                <div class="rocket-workshop__section-sub">Retirez du mix ou récupérez les lots terminés.</div>
              </div>
              <div class="rocket-workshop__section-pill">${Math.round(workshop.inputUsed || 0)} / ${Math.round(workshop.inputCapacity || 0)}</div>
            </div>
            <div class="rocket-workshop__stack">
              <div class="rocket-workshop__subpanel">
                <div class="rocket-workshop__subhead">
                  <span>Mélange actuel</span>
                  <b>${Math.round(workshop.inputUsed || 0)} / ${Math.round(workshop.inputCapacity || 0)}</b>
                </div>
                <div class="rocket-workshop__scroll" data-scroll-key="rocket-input">${resourceGroups(workshop.input || [], 'Tout reprendre', 'withdraw', workshop.id, 'Aucune ressource dans l’entrée.')}</div>
              </div>
              <div class="rocket-workshop__subpanel">
                <div class="rocket-workshop__subhead">
                  <span>Sortie roquettes</span>
                  <b>${Math.round(workshop.outputUsed || 0)} / ${Math.round(workshop.outputCapacity || 0)}</b>
                </div>
                <div class="rocket-workshop__scroll" data-scroll-key="rocket-output">${outputCards(workshop.output || [], workshop.id)}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div class="rocket-workshop__dock">
        <div class="rocket-workshop__dock-main">
          <div class="rocket-workshop__dock-status" data-role="dock-status"></div>
          <div class="rocket-workshop__dock-hint" data-role="dock-hint"></div>
        </div>
        <div class="rocket-workshop__dock-progress">
          <div class="rocket-workshop__dock-progress-head">
            <span data-role="progress-bar"></span>
            <b data-role="progress-label"></b>
          </div>
          <div class="rocket-workshop__bar"><span data-role="progress-fill"></span></div>
        </div>
        <div class="rocket-workshop__actions">
          <button class="rocket-workshop__produce rocket-workshop__produce--secondary" type="button" data-rocket-toggle="1"></button>
          <button class="rocket-workshop__produce" type="button" data-rocket-start="1">Lancer production</button>
        </div>
      </div>
    `;
  }

  update(store) {
    const workshop = store?.myState?.rocketWorkshop || null;
    if (!workshop) {
      this.currentId = 0;
      this.dynamic = null;
      this.el.classList.add('is-hidden');
      this.el.innerHTML = '';
      this.lastKey = '';
      return;
    }

    this.currentId = workshop.id | 0;
    this.el.classList.remove('is-hidden');
    const key = buildRenderKey(workshop);
    if (key !== this.lastKey) {
      const scroll = this.captureScroll();
      this.el.innerHTML = this.render(workshop);
      this.setDynamicRefs();
      this.restoreScroll(scroll);
      this.lastKey = key;
    }
    this.updateDynamicStatus(workshop);
  }
}
