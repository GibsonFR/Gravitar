import { StationCommandQueue } from '../station/StationCommandQueue.js';
import { formatCredits } from '../cargo/CargoFormat.js';

const PIN_STORAGE_KEY = 'gravitar.activeQuestPinnedId';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pct(q) {
  if (Number.isFinite(q?.progressPct)) return Math.max(0, Math.min(100, q.progressPct | 0));
  return Math.max(0, Math.min(100, Math.round((Math.max(0, q?.current | 0) / Math.max(1, q?.required | 0 || 1)) * 100)));
}

function loadPinnedQuestId() {
  try { return String(localStorage.getItem(PIN_STORAGE_KEY) || '').toLowerCase(); }
  catch { return ''; }
}

function savePinnedQuestId(questId) {
  const value = String(questId || '').toLowerCase();
  try {
    if (value) localStorage.setItem(PIN_STORAGE_KEY, value);
    else localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {}
  window.__gravitarPinnedQuestId = value;
}

function objectiveLabel(q) {
  if (q?.type === 'kill_mob') return q.targetName || q.targetMobId || 'Cible';
  return q.resourceName || q.resourceKey || 'Ressource';
}

function questIcon(q) {
  return q?.type === 'kill_mob' ? '✦' : '☠';
}

function questColor(q) {
  return q?.type === 'kill_mob' ? (q.targetColorHex || '#ffbf7a') : (q.resourceColorHex || '#cfd7e6');
}

function questCard(q, selectedId, pinnedId) {
  const selected = q.questId === selectedId;
  const pinned = q.questId === pinnedId;
  const readyClass = q.ready ? 'is-ready' : '';
  const pinnedClass = pinned ? 'is-pinned' : '';
  const station = q.stationSx != null ? `[${q.stationSx | 0},${q.stationSy | 0}]` : 'station origine';
  const status = q.canComplete ? 'À rendre' : q.ready ? 'Prête' : q.isAtOriginStation ? 'À compléter' : 'En cours';
  return `
    <button type="button" class="active-quest-card ${selected ? 'is-selected' : ''} ${readyClass} ${pinnedClass}" data-quest-id="${escapeHtml(q.questId)}">
      <span class="active-quest-card__icon" style="--quest-color:${escapeHtml(questColor(q))}">${questIcon(q)}</span>
      <span class="active-quest-card__body">
        <span class="active-quest-card__top"><strong>${escapeHtml(q.name || 'Quête pirate')}</strong><em>${escapeHtml(status)}</em></span>
        <span class="active-quest-card__goal">${escapeHtml(objectiveLabel(q))} ${Math.max(0, q.current | 0)} / ${Math.max(1, q.required | 0 || 1)}</span>
        <span class="active-quest-card__bar"><i style="width:${pct(q)}%"></i></span>
        <span class="active-quest-card__meta">${escapeHtml(q.stationName || 'Station pirate')} · ${escapeHtml(station)}${pinned ? ' · épinglée' : ''}</span>
      </span>
    </button>`;
}

export class ActiveQuestPanelView {
  constructor(sendCmd) {
    this.cmdQueue = new StationCommandQueue(typeof sendCmd === 'function' ? sendCmd : null);
    this.snapshot = null;
    this.selectedQuestId = '';
    this.pinnedQuestId = loadPinnedQuestId();
    window.__gravitarPinnedQuestId = this.pinnedQuestId;

    this.el = document.createElement('div');
    this.el.className = 'active-quests-panel';
    this.el.innerHTML = `
      <div class="active-quests-panel__head">
        <div>
          <div class="active-quests-panel__eyebrow">Journal</div>
          <h2>Quêtes actives</h2>
        </div>
        <div class="active-quests-panel__summary" data-role="summary"></div>
      </div>
      <div class="active-quests-panel__body">
        <section class="active-quests-panel__list" data-role="list"></section>
        <aside class="active-quests-panel__details" data-role="details"></aside>
      </div>
    `;
    this.summaryEl = this.el.querySelector('[data-role="summary"]');
    this.listEl = this.el.querySelector('[data-role="list"]');
    this.detailsEl = this.el.querySelector('[data-role="details"]');

    this.el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const action = ev.target?.closest?.('button[data-quest-action]');
      if (action) {
        ev.preventDefault();
        ev.stopPropagation();
        if (action.disabled) return;
        const questId = action.dataset.questId || this.selectedQuestId || '';
        if (!questId) return;
        const kind = action.dataset.questAction || '';
        if (kind === 'abandon') this.cmdQueue.send('abandon_pirate_quest', { questId });
        else if (kind === 'complete') this.cmdQueue.send('complete_pirate_quest', { questId });
        else if (kind === 'pin') {
          this.pinnedQuestId = this.pinnedQuestId === questId ? '' : questId;
          savePinnedQuestId(this.pinnedQuestId);
          this.render();
        }
        return;
      }
      const card = ev.target?.closest?.('button[data-quest-id]');
      if (card) {
        ev.preventDefault();
        ev.stopPropagation();
        this.selectedQuestId = String(card.dataset.questId || '').toLowerCase();
        this.render();
      }
    });
  }

  quests() {
    return Array.isArray(this.snapshot?.active) ? this.snapshot.active : [];
  }

  focusedQuest() {
    const list = this.quests();
    const key = this.selectedQuestId || this.pinnedQuestId || list[0]?.questId || '';
    return list.find((q) => q.questId === key) || list[0] || null;
  }

  renderList() {
    const list = this.quests();
    if (!list.length) {
      this.listEl.innerHTML = '<div class="active-quests-panel__empty">Aucune quête active. Les contrats acceptés en station pirate apparaîtront ici.</div>';
      return;
    }
    const key = this.focusedQuest()?.questId || '';
    this.listEl.innerHTML = list.map((q) => questCard(q, key, this.pinnedQuestId)).join('');
  }

  renderDetails() {
    const q = this.focusedQuest();
    if (!q) {
      this.detailsEl.innerHTML = '<div class="active-quests-panel__muted">Sélectionne une quête active.</div>';
      return;
    }
    const pinned = q.questId === this.pinnedQuestId;
    const station = q.stationSx != null ? `[${q.stationSx | 0},${q.stationSy | 0}]` : 'Secteur inconnu';
    const completeHint = q.canComplete
      ? 'Tu es à la station d’origine : la quête peut être rendue.'
      : q.ready
        ? 'Objectif atteint. Retourne à la station d’origine pour rendre la quête.'
        : 'Objectif en cours.';
    this.detailsEl.innerHTML = `
      <section class="active-quests-panel__detailbox">
        <div class="active-quests-panel__detailtop">
          <div>
            <div class="active-quests-panel__eyebrow">${escapeHtml(q.type === 'kill_mob' ? 'Contrat de chasse' : 'Livraison')}</div>
            <h3>${escapeHtml(q.name || 'Quête pirate')}</h3>
          </div>
          <span class="active-quests-panel__status ${q.ready ? 'is-ready' : ''}">${escapeHtml(q.ready ? 'Prête' : 'En cours')}</span>
        </div>
        <p>${escapeHtml(q.description || '')}</p>
      </section>
      <section class="active-quests-panel__detailbox">
        <h4>Objectif</h4>
        <div class="active-quests-panel__line"><span>${escapeHtml(objectiveLabel(q))}</span><b>${Math.max(0, q.current | 0)} / ${Math.max(1, q.required | 0 || 1)}</b></div>
        <div class="active-quest-card__bar"><i style="width:${pct(q)}%"></i></div>
        <p class="active-quests-panel__hint">${escapeHtml(completeHint)}</p>
      </section>
      <section class="active-quests-panel__detailbox">
        <h4>Station d’origine</h4>
        <div class="active-quests-panel__line"><span>${escapeHtml(q.stationName || 'Station pirate')}</span><b>${escapeHtml(station)}</b></div>
      </section>
      <section class="active-quests-panel__detailbox">
        <h4>Récompenses</h4>
        <div class="active-quests-panel__chips"><span>+${formatCredits(q.rewardCredits || 0)}</span><span>+${Math.max(0, q.rewardReputationXp | 0)} réputation</span></div>
      </section>
      <div class="active-quests-panel__actions">
        <button class="ui-btn" data-quest-action="complete" data-quest-id="${escapeHtml(q.questId)}" ${q.canComplete ? '' : 'disabled'}>Terminer</button>
        <button class="ui-btn ui-btn--ghost" data-quest-action="pin" data-quest-id="${escapeHtml(q.questId)}">${pinned ? 'Désépingler' : 'Épingler HUD'}</button>
        <button class="ui-btn ui-btn--ghost" data-quest-action="abandon" data-quest-id="${escapeHtml(q.questId)}">Abandonner</button>
      </div>`;
  }

  render() {
    const list = this.quests();
    if (this.selectedQuestId && !list.some((q) => q.questId === this.selectedQuestId)) this.selectedQuestId = '';
    if (this.pinnedQuestId && !list.some((q) => q.questId === this.pinnedQuestId)) {
      this.pinnedQuestId = '';
      savePinnedQuestId('');
    }
    const ready = this.snapshot?.readyCount | 0 || 0;
    const total = this.snapshot?.activeCount | 0 || list.length;
    this.summaryEl.textContent = total ? `${total} active${total > 1 ? 's' : ''}${ready ? ` · ${ready} prête${ready > 1 ? 's' : ''}` : ''}` : 'Aucune';
    this.renderList();
    this.renderDetails();
  }

  update(myState) {
    this.snapshot = myState?.activeQuests || null;
    this.render();
  }
}
