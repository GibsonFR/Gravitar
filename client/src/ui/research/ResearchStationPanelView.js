function escapeHtml(txt) {
  return String(txt || '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function packRows(entries = [], stationId) {
  if (!entries.length) return `<div class="research-station__empty">Aucun pack chargé.</div>`;
  return entries.map((r) => `
    <div class="research-station__row">
      <span class="research-station__pack" style="--pack:${escapeHtml(r.colorHex || '#fff')}"><i></i>${escapeHtml(r.name)} ×${r.amount | 0}</span>
      <button type="button" data-research-transfer="1" data-direction="withdraw" data-resource="${escapeHtml(r.key)}" data-structure="${stationId | 0}">Retirer</button>
    </div>
  `).join('');
}

export class ResearchStationPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.el = document.createElement('section');
    this.el.className = 'research-station research-station--compact';
    this.el.hidden = true;
    this.lastKey = '';
    this.bind();
  }

  bind() {
    this.el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('mousedown', (ev) => ev.stopPropagation(), true);
    this.el.addEventListener('click', (ev) => {
      const close = ev.target.closest('[data-close-research-station]');
      if (close) {
        this.sendCmd('research_station_close', {});
        this.el.hidden = true;
        ev.preventDefault();
        return;
      }
      const toggle = ev.target.closest('[data-research-toggle]');
      if (toggle) {
        this.sendCmd('research_station_toggle', { structureId: toggle.dataset.structure | 0, enabled: toggle.dataset.enabled !== 'true' });
        ev.preventDefault();
        return;
      }
      const transfer = ev.target.closest('[data-research-transfer]');
      if (transfer) {
        this.sendCmd('research_station_transfer', {
          structureId: transfer.dataset.structure | 0,
          resourceKey: transfer.dataset.resource || '',
          direction: transfer.dataset.direction || 'deposit',
          amount: ev.shiftKey ? 25 : 1
        });
        ev.preventDefault();
      }
    });
  }

  update(store) {
    const data = store.myState?.researchStation || null;
    if (!data) {
      this.el.hidden = true;
      this.lastKey = '';
      return;
    }
    const key = JSON.stringify({ id: data.id, input: data.scienceInput, powered: data.powered, enabled: data.enabled, status: data.status });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = false;

    this.el.innerHTML = `
      <div class="research-station__head">
        <div>
          <div class="research-station__eyebrow">Station de recherche</div>
          <div class="research-station__title">${escapeHtml(data.name || 'Station de recherche')}</div>
          <div class="research-station__meta">${data.powered ? 'Alimentée' : 'Sans énergie'} · ${data.inputUsed | 0}/${data.inputCapacity | 0} packs</div>
        </div>
        <button type="button" class="research-station__close" data-close-research-station="1">×</button>
      </div>
      <div class="research-station__status research-station__status--compact">
        <section>
          <h3>Rôle</h3>
          <strong>Consomme les packs</strong>
          <small>Le choix des technologies se fait dans l’onglet Recherche.</small>
          <button type="button" data-research-toggle="1" data-structure="${data.id | 0}" data-enabled="${data.enabled ? 'true' : 'false'}">${data.enabled ? 'Désactiver' : 'Activer'}</button>
        </section>
        <section>
          <h3>Packs chargés</h3>
          ${packRows(data.scienceInput || [], data.id)}
        </section>
        <section>
          <h3>Déposer un pack</h3>
          <div class="research-station__pack-buttons">
            ${(data.packs || []).map((p) => `<button type="button" data-research-transfer="1" data-direction="deposit" data-resource="${escapeHtml(p.id)}" data-structure="${data.id | 0}">${escapeHtml(p.name)}</button>`).join('')}
          </div>
        </section>
      </div>
    `;
  }
}
