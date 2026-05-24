function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function fmtList(entries = [], withHave = false) {
  if (!entries.length) return '—';
  return entries.map((e) => {
    const have = withHave ? ` <span class="machine-panel__have">${e.have | 0}</span>` : '';
    return `<span class="machine-panel__res" style="--res:${escapeHtml(e.colorHex || '#fff')}"><i></i>${escapeHtml(e.name)} ×${e.amount | 0}${have}</span>`;
  }).join('');
}

export class MachinePanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.el = document.createElement('div');
    this.el.className = 'machine-panel is-hidden';
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const close = ev.target.closest('[data-close]');
      if (close) {
        this.sendCmd('machine_close', {});
        this.el.classList.add('is-hidden');
        return;
      }
      const btn = ev.target.closest('button[data-recipe]');
      if (!btn) return;
      const recipeId = btn.dataset.recipe || '';
      const amount = btn.dataset.amount | 0 || 1;
      if (this.currentId && recipeId) this.sendCmd('machine_process', { structureId: this.currentId, recipeId, amount });
    });
  }

  update(store) {
    const machine = store?.myState?.machine || null;
    if (!machine) {
      this.currentId = 0;
      this.el.classList.add('is-hidden');
      this.el.innerHTML = '';
      return;
    }
    this.currentId = machine.id | 0;
    this.el.classList.remove('is-hidden');
    const recipes = Array.isArray(machine.recipes) ? machine.recipes : [];
    const powerLabel = machine.powered ? 'Alimentée' : 'Sans énergie';
    const powerClass = machine.powered ? 'is-powered' : 'is-unpowered';
    this.el.innerHTML = `
      <div class="machine-panel__head">
        <div>
          <div class="machine-panel__eyebrow">Industrie</div>
          <div class="machine-panel__title">${escapeHtml(machine.name || 'Machine')}</div>
          <div class="machine-panel__meta ${powerClass}">${escapeHtml(powerLabel)} · ${machine.energyUse | 0} énergie</div>
        </div>
        <button class="machine-panel__close" type="button" data-close="1">×</button>
      </div>
      <div class="machine-panel__recipes">
        ${recipes.length ? recipes.map((r) => `
          <div class="machine-panel__recipe ${r.canCraft ? '' : 'is-disabled'}">
            <div class="machine-panel__recipe-main">
              <div class="machine-panel__recipe-title">${escapeHtml(r.name)}</div>
              <div class="machine-panel__recipe-desc">${escapeHtml(r.description || '')}</div>
              <div class="machine-panel__line"><b>Entrée</b>${fmtList(r.input, true)}</div>
              <div class="machine-panel__line"><b>Sortie</b>${fmtList(r.output, false)}</div>
            </div>
            <div class="machine-panel__recipe-actions">
              <div class="machine-panel__time">${r.seconds | 0}s</div>
              <button type="button" data-recipe="${escapeHtml(r.id)}" data-amount="1" ${r.canCraft ? '' : 'disabled'}>Produire</button>
              <button type="button" data-recipe="${escapeHtml(r.id)}" data-amount="5" ${r.canCraft ? '' : 'disabled'}>×5</button>
            </div>
          </div>
        `).join('') : '<div class="machine-panel__empty">Aucune recette disponible.</div>'}
      </div>
    `;
  }
}
