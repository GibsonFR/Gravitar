function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function resourceList(entries = []) {
  if (!entries.length) return '<span class="equipment-fab__muted">Aucun</span>';
  return entries.map((r) => `<span class="equipment-fab__res ${r.missing > 0 ? 'is-missing' : ''}" style="--res:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)} ×${r.amount | 0}<em>${r.have | 0}</em></span>`).join('');
}

function bonusList(bonuses = {}) {
  const entries = Object.entries(bonuses || {}).filter(([, v]) => Number(v) !== 0);
  if (!entries.length) return '<span class="equipment-fab__muted">Stats de base uniquement</span>';
  return entries.map(([key, value]) => `<span>${escapeHtml(key)} ${Number(value) > 0 ? '+' : ''}${Math.round(Number(value) * 1000) / 10}${Math.abs(Number(value)) < 1 ? '%' : ''}</span>`).join('');
}

export class EquipmentFabricatorPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'equipment-fab';
    this.el.hidden = true;
    this.lastKey = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-equipment-fab-close]');
      if (close) {
        this.sendCmd('equipment_fabricator_close', {});
        this.el.hidden = true;
        ev.preventDefault();
        return;
      }
      const craft = ev.target.closest('[data-equipment-fab-craft]');
      if (craft) {
        this.sendCmd('equipment_fabricator_craft', {
          structureId: craft.dataset.structure | 0,
          recipeId: craft.dataset.equipmentFabCraft || ''
        });
        ev.preventDefault();
      }
    });
  }

  update(store) {
    const data = store.myState?.equipmentFabricator || null;
    if (!data) {
      this.el.hidden = true;
      this.lastKey = '';
      return;
    }
    const key = JSON.stringify(data);
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    const cards = (data.recipes || []).map((r) => `
      <article class="equipment-fab__card ${r.locked ? 'is-locked' : ''}">
        <div class="equipment-fab__card-top">
          <div>
            <strong>${escapeHtml(r.name)}</strong>
            <small>${escapeHtml(r.categoryName)} · Mark ${r.mark | 0} · ${r.seconds | 0}s</small>
          </div>
          <span>${r.locked ? 'Verrouillé' : r.canCraft ? 'Prêt' : 'Ressources'}</span>
        </div>
        <p>${escapeHtml(r.description || '')}</p>
        <div class="equipment-fab__sub">Coût</div>
        <div class="equipment-fab__resources">${resourceList(r.input || [])}</div>
        <div class="equipment-fab__sub">Stats de base</div>
        <div class="equipment-fab__bonus">${bonusList(r.baseBonuses || {})}</div>
        ${r.locked ? `<div class="equipment-fab__lock">Requiert : ${escapeHtml(r.requiredResearchName || r.requiredResearchId || 'recherche')}</div>` : ''}
        <button type="button" data-equipment-fab-craft="${escapeHtml(r.id)}" data-structure="${data.id | 0}" ${r.canCraft ? '' : 'disabled'}>Fabriquer l’objet neutre</button>
      </article>
    `).join('');

    this.el.innerHTML = `
      <div class="equipment-fab__head">
        <div>
          <div class="equipment-fab__eyebrow">Atelier d’équipement</div>
          <div class="equipment-fab__title">${escapeHtml(data.name || 'Atelier d’équipement')}</div>
          <div class="equipment-fab__meta">${data.powered ? 'Alimenté' : 'Sans énergie'} · fabrique des objets neutres sans roll</div>
        </div>
        <button type="button" class="equipment-fab__close" data-equipment-fab-close="1">×</button>
      </div>
      <div class="equipment-fab__notice">Étape 1 : fabrique ici un objet Mark I/II sans effet procédural. Étape 2 : améliore-le dans la Station R&D avec 1 à 3 sciences.</div>
      <div class="equipment-fab__grid">${cards}</div>
    `;
  }
}
