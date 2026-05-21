function fmtSector(p) {
  if (p?.inBastion) return 'Bastion';
  return `[${p?.sx | 0},${p?.sy | 0}]`;
}

function fmtBastions(p) {
  const list = p?.bastions || [];
  if (!list.length) return '<span class="players-panel__empty">aucun</span>';
  return list.map((b) => `<span class="players-panel__tag" title="${escapeHtml(b.name || b.sourceLabel || 'Bastion')}">${escapeHtml(b.glyph || 'BST')}</span>`).join('');
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTimer(session) {
  const ms = Math.max(0, session?.remainingMs ?? 0);
  const totalSec = Math.ceil(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export class PlayersPanelView {
  constructor() {
    this.el = document.createElement('aside');
    this.el.className = 'players-panel';
    this.open = true;
    this.activeTab = 'players';
    this.lastChatCount = -1;
    this.lastUnread = -1;
    this.sendChat = null;
    this.el.innerHTML = `
      <div class="players-panel__tabs">
        <button class="players-panel__toggle is-active" type="button" data-role="tab-players">Players</button>
        <button class="players-panel__toggle players-panel__toggle--chat" type="button" data-role="tab-chat">Chat <span class="players-panel__unread" data-role="chat-unread"></span></button>
      </div>
      <div class="players-panel__body" data-role="body">
        <section class="players-panel__page is-active" data-role="page-players">
          <div class="players-panel__top">
            <div class="players-panel__title">Pilotes</div>
            <div class="players-panel__timer" data-role="timer">60:00</div>
          </div>
          <div class="players-panel__list" data-role="list"></div>
        </section>
        <section class="players-panel__page players-panel__page--chat" data-role="page-chat">
          <div class="players-panel__top">
            <div class="players-panel__title">Chat</div>
            <div class="players-panel__timer players-panel__timer--chat">Entrée</div>
          </div>
          <div class="players-panel__chat-log" data-role="chat-log"></div>
          <form class="players-panel__chat-form" data-role="chat-form" autocomplete="off">
            <input class="players-panel__chat-input" data-role="chat-input" maxlength="220" placeholder="Écrire un message…" />
          </form>
        </section>
      </div>
    `;
    this.bodyEl = this.el.querySelector('[data-role="body"]');
    this.listEl = this.el.querySelector('[data-role="list"]');
    this.timerEl = this.el.querySelector('[data-role="timer"]');
    this.tabPlayersEl = this.el.querySelector('[data-role="tab-players"]');
    this.tabChatEl = this.el.querySelector('[data-role="tab-chat"]');
    this.pagePlayersEl = this.el.querySelector('[data-role="page-players"]');
    this.pageChatEl = this.el.querySelector('[data-role="page-chat"]');
    this.chatLogEl = this.el.querySelector('[data-role="chat-log"]');
    this.chatFormEl = this.el.querySelector('[data-role="chat-form"]');
    this.chatInputEl = this.el.querySelector('[data-role="chat-input"]');
    this.chatUnreadEl = this.el.querySelector('[data-role="chat-unread"]');

    this.tabPlayersEl.addEventListener('click', () => this.setTab('players'));
    this.tabChatEl.addEventListener('click', () => this.setTab('chat', { focus: true }));
    this.chatFormEl.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const text = this.chatInputEl.value.trim();
      if (!text) return;
      this.sendChat?.(text);
      this.chatInputEl.value = '';
    });
    this.chatInputEl.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') {
        this.chatInputEl.blur();
        this.setTab('players');
        ev.preventDefault();
      }
    });
  }

  setTab(tab, options = {}) {
    this.activeTab = tab === 'chat' ? 'chat' : 'players';
    this.tabPlayersEl.classList.toggle('is-active', this.activeTab === 'players');
    this.tabChatEl.classList.toggle('is-active', this.activeTab === 'chat');
    this.pagePlayersEl.classList.toggle('is-active', this.activeTab === 'players');
    this.pageChatEl.classList.toggle('is-active', this.activeTab === 'chat');
    this.el.classList.remove('is-collapsed');
    this.open = true;
    if (this.activeTab === 'chat') {
      options.store?.clearChatUnread?.();
      if (options.focus) setTimeout(() => this.chatInputEl.focus(), 0);
    }
  }

  bindChat(sendChat) {
    this.sendChat = sendChat;
    window.addEventListener('keydown', (ev) => {
      const tag = String(ev.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || ev.target?.isContentEditable) return;
      if (ev.key === 'Enter') {
        this.setTab('chat', { focus: true });
        ev.preventDefault();
      }
    });
  }

  update(players, session, myId = 0, modes = null, store = null) {
    if (modes?.currentMode === 'battle') {
      const br = modes.battleSessions?.find?.((s) => s.id === modes.battleSessionId);
      this.timerEl.textContent = br ? `BR ${fmtTimer({ remainingMs: br.remainingMs })}` : (modes.battleQueuedNext ? `BR ${fmtTimer({ remainingMs: modes.battleNextInMs })}` : 'BR');
    } else {
      this.timerEl.textContent = 'Endless';
    }
    const arr = Array.isArray(players) ? [...players] : [];
    arr.sort((a, b) => ((b.level | 0) - (a.level | 0)) || ((a.id | 0) === (myId | 0) ? -1 : ((b.id | 0) === (myId | 0) ? 1 : 0)) || String(a.pseudo || '').localeCompare(String(b.pseudo || '')));
    if (!arr.length) {
      this.listEl.innerHTML = '<div class="players-panel__emptyline">Aucun pilote déployé</div>';
    } else {
      this.listEl.innerHTML = arr.map((p) => `
        <div class="players-panel__row ${((p.id | 0) === (myId | 0)) ? 'is-me' : ''}">
          <div class="players-panel__main">
            <span class="players-panel__name">${escapeHtml(p.pseudo || `Joueur ${p.id}`)}</span>
            <span class="players-panel__ship">${escapeHtml(p.frameName || p.frameId || 'Vaisseau')}</span>
          </div>
          <div class="players-panel__meta">
            <span>Lv ${p.level | 0}</span>
            <span>${escapeHtml(fmtSector(p))}</span>
          </div>
          <div class="players-panel__tags">${fmtBastions(p)}</div>
        </div>
      `).join('');
    }
    if (store) this.updateChat(store);
  }

  updateChat(store) {
    const messages = store?.chatMessages || [];
    const unread = store?.chatUnread || 0;
    if (this.activeTab === 'chat' && unread > 0) store.clearChatUnread?.();
    const shownUnread = this.activeTab === 'chat' ? 0 : unread;
    if (shownUnread > 0) {
      this.chatUnreadEl.textContent = shownUnread > 9 ? '9+' : String(shownUnread);
      this.tabChatEl.classList.add('has-unread');
    } else {
      this.chatUnreadEl.textContent = '';
      this.tabChatEl.classList.remove('has-unread');
    }
    if (messages.length === this.lastChatCount && shownUnread === this.lastUnread) return;
    this.lastChatCount = messages.length;
    this.lastUnread = shownUnread;
    if (!messages.length) {
      this.chatLogEl.innerHTML = '<div class="players-panel__emptyline">Aucun message</div>';
      return;
    }
    this.chatLogEl.innerHTML = messages.slice(-60).map((m) => `
      <div class="players-panel__chat-msg">
        <span class="players-panel__chat-name">${escapeHtml(m.name)}</span>
        <span class="players-panel__chat-text">${escapeHtml(m.text)}</span>
      </div>
    `).join('');
    this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
  }
}
