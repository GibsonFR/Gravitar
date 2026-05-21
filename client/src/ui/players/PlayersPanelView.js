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
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
    this.el.innerHTML = `
      <button class="players-panel__toggle" type="button" data-role="toggle">Players</button>
      <div class="players-panel__body" data-role="body">
        <div class="players-panel__top">
          <div class="players-panel__title">Pilotes</div>
          <div class="players-panel__timer" data-role="timer">60:00</div>
        </div>
        <div class="players-panel__list" data-role="list"></div>
      </div>
    `;
    this.bodyEl = this.el.querySelector('[data-role="body"]');
    this.listEl = this.el.querySelector('[data-role="list"]');
    this.timerEl = this.el.querySelector('[data-role="timer"]');
    this.el.querySelector('[data-role="toggle"]').addEventListener('click', () => {
      this.open = !this.open;
      this.el.classList.toggle('is-collapsed', !this.open);
    });
  }

  update(players, session, myId = 0, modes = null) {
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
      return;
    }
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
}
