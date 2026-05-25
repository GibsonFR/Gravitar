import { StationCommandQueue } from './StationCommandQueue.js';
import { formatCredits } from '../cargo/CargoFormat.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pct(current, required) {
  return Math.max(0, Math.min(100, Math.round((Math.max(0, current | 0) / Math.max(1, required | 0 || 1)) * 100)));
}

function questCard(q, selected) {
  const statusLabel = q.completed ? 'Terminée' : q.active ? 'En cours' : 'Disponible';
  const stateClass = q.completed ? 'is-completed' : q.active ? 'is-active-quest' : '';
  const progressPct = pct(q.have, q.required);
  return `
    <button type="button" class="pirate-quest-card ${selected ? 'is-selected' : ''} ${stateClass}" data-quest-id="${escapeHtml(q.questId)}">
      <span class="pirate-quest-card__icon" style="--quest-color:${escapeHtml(q.resourceColorHex || '#ffbf7a')}">☠</span>
      <span class="pirate-quest-card__body">
        <span class="pirate-quest-card__top"><strong>${escapeHtml(q.name || 'Quête pirate')}</strong><em>${escapeHtml(statusLabel)}</em></span>
        <span class="pirate-quest-card__goal">${escapeHtml(q.resourceName || q.resourceKey || 'Ressource')} ${Math.max(0, q.have | 0)} / ${Math.max(1, q.required | 0 || 1)}</span>
        <span class="pirate-quest-card__bar"><i style="width:${progressPct}%"></i></span>
        <span class="pirate-quest-card__reward">+${formatCredits(q.rewardCredits || 0)} · +${Math.max(0, q.rewardReputationXp | 0)} réputation</span>
      </span>
    </button>`;
}

export class PirateQuestView {
  constructor(sendCmd) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.cmdQueue = new StationCommandQueue(this.sendCmd);
    this.selectedQuestId = '';
    this.shop = null;
    this.docked = false;
    this.el = document.createElement('div');
    this.el.className = 'pirate-quests';
    this.el.innerHTML = `
      <section class="pirate-quests__board" data-role="board"></section>
      <aside class="pirate-quests__details" data-role="details"></aside>
    `;
    this.boardEl = this.el.querySelector('[data-role="board"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');

    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const questBtn = ev.target?.closest?.('button[data-quest-id]');
      if (questBtn) {
        this.selectedQuestId = questBtn.dataset.questId || '';
        this.render();
        return;
      }
      const action = ev.target?.closest?.('button[data-quest-action]');
      if (!action || action.disabled) return;
      const questId = action.dataset.questId || this.selectedQuestId || '';
      if (!questId) return;
      const kind = action.dataset.questAction || '';
      if (kind === 'accept') this.cmdQueue.send('accept_pirate_quest', { questId });
      else if (kind === 'complete') this.cmdQueue.send('complete_pirate_quest', { questId });
      else if (kind === 'abandon') this.cmdQueue.send('abandon_pirate_quest', { questId });
    });
  }

  quests() {
    return this.shop?.quests?.available || [];
  }

  focusedQuest() {
    const list = this.quests();
    const key = this.selectedQuestId || list[0]?.questId || '';
    return list.find((q) => q.questId === key) || null;
  }

  renderBoard() {
    const quests = this.quests();
    if (!quests.length) {
      this.boardEl.innerHTML = '<div class="pirate-quests__empty">Cette station ne propose aucune quête pirate.</div>';
      return;
    }
    const key = this.selectedQuestId || quests[0]?.questId || '';
    this.boardEl.innerHTML = quests.map((q) => questCard(q, q.questId === key)).join('');
  }

  renderDetails() {
    const q = this.focusedQuest();
    const rep = this.shop?.quests || {};
    const currentXp = Math.max(0, rep.reputationXp | 0 || 0);
    const nextXp = Math.max(currentXp + 1, rep.nextReputationXp | 0 || 100);
    const repPct = Math.max(0, Math.min(100, Math.round((currentXp / nextXp) * 100)));
    if (!q) {
      this.detailsEl.innerHTML = `
        <div class="pirate-quests__header"><span>Réputation pirate</span><b>Niv. ${Math.max(0, rep.reputationLevel | 0 || 0)}</b></div>
        <div class="pirate-quests__repbar"><i style="width:${repPct}%"></i></div>
        <div class="pirate-quests__muted">Sélectionne une quête.</div>`;
      return;
    }
    const progressPct = pct(q.have, q.required);
    const action = q.completed
      ? `<button class="ui-btn" disabled>Déjà terminée</button>`
      : q.active
        ? `<button class="ui-btn" data-quest-action="complete" data-quest-id="${escapeHtml(q.questId)}" ${q.canComplete ? '' : 'disabled'}>Terminer</button><button class="ui-btn ui-btn--ghost" data-quest-action="abandon" data-quest-id="${escapeHtml(q.questId)}">Abandonner</button>`
        : `<button class="ui-btn" data-quest-action="accept" data-quest-id="${escapeHtml(q.questId)}" ${q.canAccept ? '' : 'disabled'}>Accepter</button>`;
    this.detailsEl.innerHTML = `
      <div class="pirate-quests__header"><span>Réputation pirate</span><b>Niv. ${Math.max(0, rep.reputationLevel | 0 || 0)}</b></div>
      <div class="pirate-quests__repbar"><i style="width:${repPct}%"></i></div>
      <div class="pirate-quests__xp">${currentXp} / ${nextXp} XP</div>
      <section class="pirate-quests__detailbox">
        <h3>${escapeHtml(q.name || 'Quête pirate')}</h3>
        <p>${escapeHtml(q.description || '')}</p>
      </section>
      <section class="pirate-quests__detailbox">
        <h4>Objectif</h4>
        <div class="pirate-quests__line"><span>${escapeHtml(q.resourceName || q.resourceKey || 'Ressource')}</span><b>${Math.max(0, q.have | 0)} / ${Math.max(1, q.required | 0 || 1)}</b></div>
        <div class="pirate-quests__bar"><i style="width:${progressPct}%"></i></div>
      </section>
      <section class="pirate-quests__detailbox">
        <h4>Récompenses</h4>
        <div class="pirate-quests__chips"><span>+${formatCredits(q.rewardCredits || 0)}</span><span>+${Math.max(0, q.rewardReputationXp | 0)} réputation</span></div>
      </section>
      <div class="pirate-quests__actions">${action}</div>`;
  }

  render() {
    const quests = this.quests();
    if (this.selectedQuestId && !quests.some((q) => q.questId === this.selectedQuestId)) this.selectedQuestId = '';
    this.renderBoard();
    this.renderDetails();
  }

  update(shop, docked) {
    this.shop = shop || null;
    this.docked = !!docked;
    this.render();
  }
}
