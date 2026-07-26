function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

export class CoreManagementPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.currentId = 0;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'core-management is-hidden';
    const stop = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
    };
    this.el.addEventListener('pointerdown', (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest('[data-core-close]')) {
        stop(ev);
        this.close();
      } else if (target?.closest('[data-core-upgrade]')) {
        stop(ev);
        this.sendCmd?.('core_upgrade', { structureId: this.currentId });
      } else if (target?.closest('[data-core-share]')) {
        stop(ev);
        const shared = target.closest('[data-core-share]')?.getAttribute('data-core-share') !== '1';
        this.sendCmd?.('clan_claim_core', { structureId: this.currentId, shared });
      } else {
        ev.stopPropagation();
      }
    }, { capture: true });
    this.el.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true });
  }

  close() {
    this.currentId = 0;
    this.lastKey = '';
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
    this.sendCmd?.('core_close', {});
  }

  update(store) {
    const data = store?.myState?.coreManagement || null;
    this.el.classList.toggle('is-hidden', !data);
    if (!data) {
      this.currentId = 0;
      this.lastKey = '';
      this.el.innerHTML = '';
      return;
    }
    this.currentId = data.id | 0;
    const clan = store?.myState?.clan || null;
    const key = JSON.stringify({ data, clan });
    if (key === this.lastKey) return;
    this.lastKey = key;
    const next = data.next;
    const disabled = !next || !next.researchReady || !next.affordable;
    const threat = store?.myState?.baseThreat || null;
    this.el.innerHTML = `
      <header class="core-management__head">
        <div><small>Base personnelle</small><h2>${esc(data.name)}</h2></div>
        <button type="button" data-core-close="1" aria-label="Fermer">×</button>
      </header>
      <div class="core-management__grid">
        <span>Intégrité <strong>${data.hp | 0} / ${data.maxHp | 0}</strong></span>
        <span>Régénération <strong>${data.regen | 0}/s</strong></span>
        <span>Zone <strong>${Math.round((data.claimRadius || 0) * 2 / 64)} × ${Math.round((data.claimRadius || 0) * 2 / 64)}</strong></span>
        <span>Énergie <strong>+${data.energy | 0}</strong></span>
        <span>Structures <strong>${data.structureCount | 0} / ${data.structureLimit | 0}</strong></span>
        <span>Signal industriel <strong>${Math.round(threat?.signal || 0)} · ${esc(threat?.level || 'faible')}</strong></span>
        ${threat?.activeAttackers ? `<span>Attaquants <strong>${threat.activeAttackers | 0}</strong></span>` : ''}
      </div>
      ${clan?.joined ? `<button class="core-management__share" type="button" data-core-share="${data.clanShared ? '1' : '0'}">${data.clanShared ? 'Retirer du territoire du clan' : `Partager avec [${esc(clan.tag)}]`}</button>` : ''}
      ${next ? `
        <section class="core-management__upgrade">
          <h3>${esc(next.name)}</h3>
          <div class="core-management__cost">${(next.cost || []).map((row) => `<span>${row.amount | 0} ${esc(row.name)}</span>`).join('')}</div>
          ${!next.researchReady ? '<p>Recherche requise.</p>' : ''}
          ${next.researchReady && !next.affordable ? '<p>Matériaux insuffisants.</p>' : ''}
          <button type="button" data-core-upgrade="1" ${disabled ? 'disabled' : ''}>Améliorer le noyau</button>
        </section>
      ` : '<div class="core-management__max">Niveau maximal atteint.</div>'}
    `;
  }
}
