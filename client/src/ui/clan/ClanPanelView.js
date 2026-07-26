function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

export class ClanPanelView {
  constructor(sendCmd) {
    this.sendCmd = sendCmd;
    this.lastKey = '';
    this.el = document.createElement('section');
    this.el.className = 'clan-panel';
    this.el.addEventListener('submit', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;
      const data = new FormData(form);
      if (form.dataset.clanCreate) this.sendCmd?.('clan_create', { clanName: data.get('name'), clanTag: data.get('tag') });
      if (form.dataset.clanJoin) this.sendCmd?.('clan_join', { clanTag: data.get('tag') });
    });
    this.el.addEventListener('pointerdown', (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest('[data-clan-leave]')) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        if (window.confirm('Quitter le clan ?')) this.sendCmd?.('clan_leave', {});
      } else {
        ev.stopPropagation();
      }
    }, { capture: true });
    this.el.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true });
  }

  update(store) {
    const clan = store?.myState?.clan || { joined: false, rankings: [] };
    const key = JSON.stringify(clan);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const rankingRows = (clan.rankings || []).map((row, index) => `
      <div class="clan-panel__rank">
        <b>${index + 1}</b><span>[${esc(row.tag)}] ${esc(row.name)}</span>
        <small>${row.territories | 0} secteurs · ${row.members | 0} membres</small>
      </div>
    `).join('');
    this.el.innerHTML = clan.joined ? `
      <div class="clan-panel__hero">
        <small>Clan</small><h2>[${esc(clan.tag)}] ${esc(clan.name)}</h2>
        <div>${clan.members | 0} membres · ${(clan.territories || []).length} territoires</div>
      </div>
      <div class="clan-panel__territories">
        ${(clan.territories || []).map((territory) => `<span>[${territory.sx | 0},${territory.sy | 0}]</span>`).join('') || '<small>Aucun territoire revendiqué.</small>'}
      </div>
      <button type="button" class="ui-btn ui-btn--ghost" data-clan-leave="1">Quitter le clan</button>
      <h3>Classement territorial</h3>
      <div class="clan-panel__ranking">${rankingRows || '<small>Aucun classement.</small>'}</div>
    ` : `
      <div class="clan-panel__hero"><small>Coopération</small><h2>Clans et territoires</h2></div>
      <form class="clan-panel__form" data-clan-create="1">
        <h3>Créer un clan</h3>
        <input name="name" maxlength="24" minlength="3" placeholder="Nom du clan" required>
        <input name="tag" maxlength="5" minlength="2" placeholder="TAG" required>
        <button class="ui-btn" type="submit">Créer</button>
      </form>
      <form class="clan-panel__form" data-clan-join="1">
        <h3>Rejoindre</h3>
        <input name="tag" maxlength="24" minlength="2" placeholder="TAG du clan" required>
        <button class="ui-btn" type="submit">Rejoindre</button>
      </form>
      <h3>Classement territorial</h3>
      <div class="clan-panel__ranking">${rankingRows || '<small>Aucun clan.</small>'}</div>
    `;
  }
}
