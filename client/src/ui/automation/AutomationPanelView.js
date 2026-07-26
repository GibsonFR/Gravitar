function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function statusLabel(status) {
  const labels = {
    blocked: 'Sortie bloquée',
    no_input: 'Entrée vide',
    no_output: 'Aucune sortie',
    no_power: 'Sans énergie',
    disabled: 'Arrêté'
  };
  return labels[String(status || '')] || 'Prêt';
}

export class AutomationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'automation-config is-hidden';

    const stop = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
    };
    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.target instanceof Element && ev.target.closest('[data-automation-close]')) {
        stop(ev);
        this.close();
        return;
      }
      ev.stopPropagation();
    }, { capture: true });
    this.el.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true });
    this.el.addEventListener('change', (ev) => {
      ev.stopPropagation();
      if (!(ev.target instanceof HTMLSelectElement)) return;
      this.apply();
    }, { capture: true });
  }

  close() {
    this.currentId = 0;
    this.lastKey = '';
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.sendCmd?.('automation_close', {});
  }

  apply() {
    if (!this.currentId) return;
    this.sendCmd?.('automation_configure', {
      structureId: this.currentId,
      filterMode: this.el.querySelector('[data-filter-mode]')?.value || 'all',
      filterKey: this.el.querySelector('[data-filter-key]')?.value || '',
      inputPriorityKey: this.el.querySelector('[data-input-priority]')?.value || '',
      outputPriority: this.el.querySelector('[data-output-priority]')?.value || 'round_robin'
    });
  }

  update(store) {
    const data = store?.myState?.automation || null;
    this.el.classList.toggle('is-hidden', !data);
    if (!data) {
      this.currentId = 0;
      this.lastKey = '';
      this.el.innerHTML = '';
      return;
    }
    this.currentId = data.id | 0;
    const key = JSON.stringify(data);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const options = (data.resources || []).map((resource) =>
      `<option value="${esc(resource.key)}">${esc(resource.name)}</option>`
    ).join('');
    const isArm = data.kind === 'robot_arm';
    const isSplitter = data.structureType === 'splitter';
    this.el.innerHTML = `
      <header class="automation-config__head">
        <div><small>Automatisation</small><h2>${esc(data.name)}</h2></div>
        <button type="button" data-automation-close="1" aria-label="Fermer">×</button>
      </header>
      <div class="automation-config__status">${esc(statusLabel(data.status))}</div>
      ${isArm ? `
        <label>Filtre
          <select data-filter-mode>
            <option value="all" ${data.filterMode === 'all' ? 'selected' : ''}>Toutes les ressources</option>
            <option value="include" ${data.filterMode === 'include' ? 'selected' : ''}>Uniquement</option>
            <option value="exclude" ${data.filterMode === 'exclude' ? 'selected' : ''}>Tout sauf</option>
          </select>
        </label>
        <label>Ressource
          <select data-filter-key><option value="">Aucune</option>${options}</select>
        </label>
        <label>Priorité d’entrée
          <select data-input-priority><option value="">Ordre normal</option>${options}</select>
        </label>
      ` : ''}
      ${isSplitter ? `
        <label>Priorité de sortie
          <select data-output-priority>
            <option value="round_robin" ${data.outputPriority === 'round_robin' ? 'selected' : ''}>Alternée</option>
            <option value="upper" ${data.outputPriority === 'upper' ? 'selected' : ''}>Sortie gauche</option>
            <option value="lower" ${data.outputPriority === 'lower' ? 'selected' : ''}>Sortie droite</option>
          </select>
        </label>
      ` : ''}
    `;
    const filter = this.el.querySelector('[data-filter-key]');
    const input = this.el.querySelector('[data-input-priority]');
    if (filter) filter.value = data.filterKey || '';
    if (input) input.value = data.inputPriorityKey || '';
  }
}
