import { getSessionFrameCards } from './SessionSetupCatalog.js';
import { drawSessionShipGlyph } from './SessionShipVisuals.js';
import { drawSessionRealAbilityDemo } from './SessionAbilityDemoRenderer.js';

const STORAGE_KEY = 'spacefrontier.session.setup';
const STEPS = ['auth', 'mode', 'ship', 'waiting'];

function normalizePseudo(value) {
  let raw = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) raw = 'Pilote';
  raw = raw.slice(0, 18).trim();
  return raw || 'Pilote';
}

function loadStoredSetup() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      pseudo: normalizePseudo(parsed.pseudo || 'Pilote'),
      frameId: String(parsed.frameId || 'vanguard'),
      mode: String(parsed.mode || 'endless'),
      battleSessionId: String(parsed.battleSessionId || ''),
      accountName: normalizePseudo(parsed.accountName || parsed.pseudo || 'Pilote')
    };
  } catch {
    return { pseudo: 'Pilote', frameId: 'vanguard', mode: 'endless', battleSessionId: '', accountName: 'Pilote' };
  }
}

function storeSetup(payload) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
}

export class SessionSetupOverlay {
  constructor(onCommit, onCancelWaiting = null, onAuth = null) {
    this.onCommit = onCommit;
    this.onCancelWaiting = typeof onCancelWaiting === 'function' ? onCancelWaiting : null;
    this.onAuth = typeof onAuth === 'function' ? onAuth : null;
    this.cards = getSessionFrameCards();
    const stored = loadStoredSetup();
    this.selectedFrameId = this.cards.some((card) => card.id === stored.frameId) ? stored.frameId : this.cards[0]?.id || 'vanguard';
    this.selectedMode = ['endless', 'battle_next', 'battle_server'].includes(stored.mode) ? stored.mode : 'endless';
    this.selectedBattleSessionId = stored.battleSessionId || '';
    this.selectedAbilityIndex = 0;
    this.selectedPreviewPhase = 1;
    this.previewRaf = 0;
    this.accountAction = 'guest';
    this.step = 'auth';
    this.modes = null;
    this.serverPending = true;
    this.waitingAck = false;
    this.inputDirty = false;
    this.authStatus = null;
    this.authRequestPending = false;
    this.authenticatedAccountName = '';
    this.authenticatedPassword = '';

    this.el = document.createElement('div');
    this.el.className = 'session-setup';
    this.el.innerHTML = `
      <div class="session-setup__backdrop"></div>
      <div class="session-setup__shell session-setup__shell--flow">
        <div class="session-setup__steps">
          <span data-step-dot="auth">Compte</span>
          <span data-step-dot="mode">Serveur</span>
          <span data-step-dot="ship">Vaisseau</span>
        </div>

        <section class="session-setup__page session-setup__page--auth" data-step="auth">
          <div class="session-setup__eyebrow">Accès</div>
          <h1 class="session-setup__title">Connexion</h1>
          <p class="session-setup__subtitle">Choisis un accès invité ou un compte sauvegardé. Le pseudo du compte devient aussi le pseudo du vaisseau.</p>
          <div class="session-setup__auth-status" data-auth-status></div>
          <div class="session-setup__auth-grid session-setup__auth-grid--three">
            <div class="session-setup__auth-card">
              <h2>Invité</h2>
              <p class="session-setup__hint">Accès libre aux modes, sans sauvegarde de progression ni statistiques persistantes.</p>
              <label class="session-setup__label" for="session-pseudo">Pseudo</label>
              <input id="session-pseudo" class="session-setup__input" maxlength="18" autocomplete="off" spellcheck="false" />
              <button type="button" class="session-setup__primary" data-auth-start="guest">Continuer en invité</button>
            </div>
            <div class="session-setup__auth-card">
              <h2>Connexion</h2>
              <p class="session-setup__hint">Utilise un compte existant.</p>
              <label class="session-setup__label">Pseudo</label>
              <input class="session-setup__input session-login-name" maxlength="18" autocomplete="username" spellcheck="false" />
              <label class="session-setup__label">Mot de passe</label>
              <input class="session-setup__input session-login-password" maxlength="80" type="password" autocomplete="current-password" />
              <button type="button" data-auth-start="login" class="session-setup__primary">Se connecter</button>
            </div>
            <div class="session-setup__auth-card">
              <h2>Créer un compte</h2>
              <p class="session-setup__hint">Pseudo + mot de passe. Aucun email demandé.</p>
              <label class="session-setup__label">Pseudo</label>
              <input class="session-setup__input session-register-name" maxlength="18" autocomplete="username" spellcheck="false" />
              <label class="session-setup__label">Mot de passe</label>
              <input class="session-setup__input session-register-password" maxlength="80" type="password" autocomplete="new-password" />
              <button type="button" data-auth-start="register" class="session-setup__primary">Créer le compte</button>
            </div>
          </div>
        </section>

        <section class="session-setup__page session-setup__page--mode" data-step="mode">
          <div class="session-setup__eyebrow">Serveurs</div>
          <h1 class="session-setup__title">Choisir un serveur</h1>
          <p class="session-setup__subtitle">Choisis explicitement le serveur Battle à rejoindre. La file d’attente du prochain serveur est séparée et ne lance pas de partie jouable avant son ouverture.</p>
          <div class="session-setup__account-line">Pseudo actuel : <b class="session-setup__current-pseudo">Pilote</b></div>
          <div class="session-setup__server-list">
            <button type="button" data-mode="endless" class="session-setup__server-card session-setup__server-card--endless">
              <div class="session-setup__server-main">
                <b>Endless</b>
                <span>Monde libre permanent</span>
              </div>
              <div class="session-setup__server-meta">
                <span class="session-setup__endless-count">0 joueur</span>
                <span>Sauvegarde avec compte</span>
              </div>
            </button>
            <div class="session-setup__server-section-title">Serveurs Battle Royale ouverts</div>
            <div class="session-setup__battle-server-list"></div>
            <div class="session-setup__queue-card">
              <div class="session-setup__server-main">
                <b>File d’attente du prochain serveur Battle Royale</b>
                <span class="session-setup__battle-next">Ouverture bientôt</span>
              </div>
              <div class="session-setup__server-meta">
                <span class="session-setup__battle-waiting-count">0 en attente</span>
                <span>Non jouable avant ouverture</span>
              </div>
              <button type="button" data-mode="battle_next" class="session-setup__queue-button">Se mettre en attente</button>
            </div>
          </div>
          <div class="session-setup__mode-footer">
            <div class="session-setup__selection-summary" data-selection-summary>Serveur sélectionné : Endless</div>
            <button type="button" class="session-setup__secondary" data-step-back>Retour</button>
            <button type="button" class="session-setup__primary" data-step-next>Continuer</button>
          </div>
        </section>

        <section class="session-setup__page session-setup__page--ship" data-step="ship">
          <section class="session-setup__left session-setup__left--ship">
            <div class="session-setup__ship-head">
              <div>
                <div class="session-setup__eyebrow">Vaisseaux</div>
                <h1 class="session-setup__title session-setup__title--compact">Sélection</h1>
              </div>
              
            </div>
            <div class="session-setup__ship-list"></div>
          </section>
          <section class="session-setup__right session-setup__right--ship">
            <div class="session-setup__hero session-setup__hero--compact">
              <canvas class="session-setup__glyph" width="128" height="128"></canvas>
              <div>
                <div class="session-setup__ship-name"></div>
                <div class="session-setup__ship-meta"></div>
                <div class="session-setup__tagline"></div>
              </div>
            </div>
            <div class="session-setup__ship-main">
              <div class="session-setup__preview-wrap">
                <canvas class="session-setup__preview" width="760" height="330"></canvas>
              </div>
              <aside class="session-setup__side-panel">
                <div class="session-setup__stats"></div>
                <div class="session-setup__ability-detail">
                  <div class="session-setup__ability-detail-key"></div>
                  <div>
                    <div class="session-setup__ability-detail-title"></div>
                    <div class="session-setup__ability-detail-text"></div>
                  </div>
                </div>
              </aside>
            </div>
            <div class="session-setup__ability-controls">
              <div class="session-setup__abilities"></div>
              <div class="session-setup__phase-buttons"></div>
            </div>
            <div class="session-setup__footer">
              <button type="button" class="session-setup__secondary" data-step-back>Retour</button>
              <button type="button" class="session-setup__launch">Déployer</button>
            </div>
          </section>
        </section>

        <section class="session-setup__page session-setup__page--waiting" data-step="waiting">
          <div class="session-setup__waiting-card">
            <div class="session-setup__eyebrow">File Battle Royale</div>
            <h1 class="session-setup__title">En attente du prochain serveur</h1>
            <p class="session-setup__subtitle">Tu n’es pas déployé dans un secteur jouable. Le vaisseau sera placé dans le hub du serveur Battle dès son ouverture.</p>
            <div class="session-setup__waiting-timer" data-waiting-timer>Ouverture bientôt</div>
            <button type="button" class="session-setup__secondary" data-wait-cancel>Quitter</button>
          </div>
        </section>
      </div>
    `;

    this.inputEl = this.el.querySelector('#session-pseudo');
    this.modePseudoEl = this.el.querySelector('.session-pseudo-mirror');
    this.currentPseudoEl = this.el.querySelector('.session-setup__current-pseudo');
    this.selectionSummaryEl = this.el.querySelector('[data-selection-summary]');
    this.loginNameEl = this.el.querySelector('.session-login-name');
    this.loginPasswordEl = this.el.querySelector('.session-login-password');
    this.registerNameEl = this.el.querySelector('.session-register-name');
    this.registerPasswordEl = this.el.querySelector('.session-register-password');
    this.authStatusEl = this.el.querySelector('[data-auth-status]');
    this.waitingTimerEl = this.el.querySelector('[data-waiting-timer]');
    this.shipListEl = this.el.querySelector('.session-setup__ship-list');
    this.modeButtons = [...this.el.querySelectorAll('[data-mode]')];
    this.battleServerListEl = this.el.querySelector('.session-setup__battle-server-list');
    this.endlessCountEl = this.el.querySelector('.session-setup__endless-count');
    this.battleWaitingCountEl = this.el.querySelector('.session-setup__battle-waiting-count');
    this.battleNextEl = this.el.querySelector('.session-setup__battle-next');
    const selectBattleFromEvent = (ev) => {
      const btn = ev.target?.closest?.('[data-mode="battle_server"][data-server-id]');
      if (!btn || !this.battleServerListEl?.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.selectMode('battle_server', btn.dataset.serverId || '');
    };
    this.battleServerListEl?.addEventListener('click', selectBattleFromEvent);
    this.battleServerListEl?.addEventListener('pointerdown', selectBattleFromEvent);
    this.glyphEl = this.el.querySelector('.session-setup__glyph');
    this.previewEl = this.el.querySelector('.session-setup__preview');
    this.previewCtx = this.previewEl?.getContext('2d') || null;
    this.nameEl = this.el.querySelector('.session-setup__ship-name');
    this.metaEl = this.el.querySelector('.session-setup__ship-meta');
    this.taglineEl = this.el.querySelector('.session-setup__tagline');
    this.summaryEl = null;
    this.statsEl = this.el.querySelector('.session-setup__stats');
    this.abilitiesEl = this.el.querySelector('.session-setup__abilities');
    this.phaseButtonsEl = this.el.querySelector('.session-setup__phase-buttons');
    this.abilityDetailKeyEl = this.el.querySelector('.session-setup__ability-detail-key');
    this.abilityDetailTitleEl = this.el.querySelector('.session-setup__ability-detail-title');
    this.abilityDetailTextEl = this.el.querySelector('.session-setup__ability-detail-text');
    this.launchBtn = this.el.querySelector('.session-setup__launch');
    this.shipHelpEl = this.el.querySelector('.session-setup__ship-help');

    this.inputEl.value = stored.pseudo;
    if (this.modePseudoEl) this.modePseudoEl.value = stored.pseudo;
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = stored.pseudo;
    this.loginNameEl.value = stored.accountName || stored.pseudo;
    this.registerNameEl.value = stored.accountName || stored.pseudo;

    this.el.querySelectorAll('[data-auth-start]').forEach((btn) => btn.addEventListener('click', () => this.startAuth(btn.dataset.authStart || 'guest')));
    this.el.querySelectorAll('[data-step-back]').forEach((btn) => btn.addEventListener('click', () => this.goBack()));
    this.el.querySelectorAll('[data-step-next]').forEach((btn) => btn.addEventListener('click', () => this.continueFromMode()));
    this.el.querySelector('[data-wait-cancel]')?.addEventListener('click', () => {
      this.selectedMode = 'endless';
      this.selectedBattleSessionId = '';
      this.waitingAck = false;
      this.onCancelWaiting?.();
      this.goToStep('mode');
      this.renderModeList();
    });
    this.launchBtn.addEventListener('click', () => this.commit());
    this.startPreviewLoop();
    for (const btn of this.modeButtons) btn.addEventListener('click', () => this.selectMode(btn.dataset.mode, btn.dataset.serverId || ''));

    const syncPseudo = (from, to) => {
      this.inputDirty = true;
      const pseudo = normalizePseudo(from.value);
      if (to) to.value = pseudo;
      if (this.currentPseudoEl) this.currentPseudoEl.textContent = pseudo;
      this.saveStored();
    };
    this.inputEl.addEventListener('input', () => syncPseudo(this.inputEl, this.modePseudoEl));
    this.modePseudoEl?.addEventListener('input', () => syncPseudo(this.modePseudoEl, this.inputEl));
    this.loginNameEl.addEventListener('input', () => this.saveStored());
    this.registerNameEl.addEventListener('input', () => this.saveStored());
    this.el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      if (this.step === 'auth') this.startAuth(this.accountAction || 'guest');
      else if (this.step === 'mode') this.continueFromMode();
      else if (this.step === 'ship') this.commit();
    });

    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
    this.goToStep('auth');
    this.applyVisibility();
  }

  saveStored() {
    storeSetup({
      pseudo: normalizePseudo(this.inputEl.value),
      frameId: this.selectedFrameId,
      mode: this.selectedMode,
      battleSessionId: this.selectedBattleSessionId || '',
      accountName: normalizePseudo(this.loginNameEl?.value || this.registerNameEl?.value || this.inputEl.value)
    });
  }

  setAuthStatus(message, ok = null) {
    this.authStatus = message ? { message, ok } : null;
    if (!this.authStatusEl) return;
    this.authStatusEl.textContent = message || '';
    this.authStatusEl.classList.toggle('is-visible', !!message);
    this.authStatusEl.classList.toggle('is-error', ok === false);
    this.authStatusEl.classList.toggle('is-ok', ok === true);
  }

  startAuth(action) {
    this.accountAction = action || 'guest';
    if (this.accountAction === 'guest') {
      const pseudo = normalizePseudo(this.inputEl.value);
      this.inputEl.value = pseudo;
      if (this.modePseudoEl) this.modePseudoEl.value = pseudo;
      if (this.currentPseudoEl) this.currentPseudoEl.textContent = pseudo;
      this.setAuthStatus('Mode invité sélectionné.', true);
      this.goToStep('mode');
      return;
    }
    const isRegister = this.accountAction === 'register';
    const nameEl = isRegister ? this.registerNameEl : this.loginNameEl;
    const passEl = isRegister ? this.registerPasswordEl : this.loginPasswordEl;
    const name = normalizePseudo(nameEl.value);
    const pass = String(passEl.value || '');
    if (name.length < 2) { this.setAuthStatus('Pseudo trop court.', false); return; }
    if (pass.length < 4) { this.setAuthStatus('Mot de passe trop court.', false); return; }
    nameEl.value = name;
    this.inputEl.value = name;
    if (this.modePseudoEl) this.modePseudoEl.value = name;
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = name;
    this.authRequestPending = true;
    this.authenticatedAccountName = '';
    this.authenticatedPassword = '';
    this.setAuthStatus(isRegister ? 'Création du compte…' : 'Connexion…', null);
    this.onAuth?.({
      pseudo: name,
      accountAction: this.accountAction,
      accountName: name,
      accountPassword: pass
    });
  }

  goToStep(step) {
    if (!STEPS.includes(step)) return;
    this.step = step;
    this.el.querySelectorAll('[data-step]').forEach((page) => page.classList.toggle('is-active', page.dataset.step === step));
    this.el.querySelectorAll('[data-step-dot]').forEach((dot) => dot.classList.toggle('is-active', dot.dataset.stepDot === step));
    this.renderModeList();
    this.renderDetails();
  }

  goBack() {
    const index = STEPS.indexOf(this.step);
    this.goToStep(STEPS[Math.max(0, index - 1)] || 'auth');
  }

  continueFromMode() {
    if (this.selectedMode === 'battle_server' && !this.selectedBattleSessionId) {
      if (this.selectionSummaryEl) this.selectionSummaryEl.textContent = 'Sélectionne un serveur Battle ouvert ou choisis Endless.';
      return;
    }
    this.goToStep('ship');
  }

  renderShipList() {
    this.shipListEl.innerHTML = '';
    for (const card of this.cards) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'session-setup__ship-card';
      if (card.id === this.selectedFrameId) button.classList.add('is-selected');
      button.style.setProperty('--ship-accent', card.accent);
      button.innerHTML = `
        <canvas class="session-setup__ship-card-glyph" width="72" height="72"></canvas>
        <span class="session-setup__ship-card-copy">
          <span class="session-setup__ship-card-name">${card.name}</span>
          <span class="session-setup__ship-card-meta">${card.role}</span>
        </span>
      `;
      button.addEventListener('click', () => this.selectFrame(card.id));
      this.shipListEl.appendChild(button);
      const canvas = button.querySelector('canvas');
      const ctx = canvas?.getContext('2d');
      if (ctx) drawSessionShipGlyph(ctx, 1, 36, 36, 13, card.id, -0.46, performance.now() / 1000, { thrust: 0.35, emphasize: card.id === this.selectedFrameId });
    }
  }

  renderAbilityControls(card) {
    if (!this.abilitiesEl || !this.phaseButtonsEl) return;
    this.abilitiesEl.innerHTML = '';
    card.abilities.forEach((ability, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'session-setup__ability';
      if (index === this.selectedAbilityIndex) button.classList.add('is-selected');
      button.innerHTML = `
        <span class="session-setup__ability-key">${ability.key}</span>
        <span class="session-setup__ability-label">${ability.label}</span>
      `;
      button.addEventListener('click', () => {
        this.selectedAbilityIndex = index;
        this.renderDetails();
      });
      this.abilitiesEl.appendChild(button);
    });

    this.phaseButtonsEl.innerHTML = '';
    for (let i = 1; i <= 5; i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'session-setup__phase-button';
      if (i === this.selectedPreviewPhase) button.classList.add('is-selected');
      button.textContent = `Phase ${i}`;
      button.addEventListener('click', () => {
        this.selectedPreviewPhase = i;
        this.renderDetails();
      });
      this.phaseButtonsEl.appendChild(button);
    }
  }

  formatDuration(ms) {
    const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  renderModeList() {
    for (const btn of this.modeButtons) {
      const mode = btn.dataset.mode;
      const serverId = btn.dataset.serverId || '';
      btn.classList.toggle('is-selected', mode === this.selectedMode && (!serverId || serverId === this.selectedBattleSessionId));
    }
    if (this.endlessCountEl) {
      const n = this.modes?.endlessPlayerCount ?? 0;
      this.endlessCountEl.textContent = `${n} joueur${n > 1 ? 's' : ''}`;
    }
    if (this.battleWaitingCountEl) {
      const n = this.modes?.battleWaitingCount ?? 0;
      this.battleWaitingCountEl.textContent = `${n} en attente`;
    }
    const nextText = `Ouverture dans ${this.formatDuration(this.modes?.battleNextInMs || 0)}`;
    if (this.battleNextEl) this.battleNextEl.textContent = nextText;
    if (this.waitingTimerEl) this.waitingTimerEl.textContent = nextText;
    if (this.battleServerListEl) {
      const sessions = [...(this.modes?.battleSessions ?? [])]
        .filter((s) => s && s.state === 'lobby' && s.joinable !== false)
        .sort((a, b) => Number(b.startsAtMs || 0) - Number(a.startsAtMs || 0));
      if (this.selectedMode === 'battle_server' && this.selectedBattleSessionId && !sessions.some((s) => String(s.id || '') === this.selectedBattleSessionId)) {
        this.selectedMode = 'endless';
        this.selectedBattleSessionId = '';
      }
      if (!sessions.length) {
        this.battleServerListEl.innerHTML = '<div class="session-setup__server-empty">Aucun serveur Battle ouvert. Utilise la file d’attente du prochain serveur si tu veux attendre.</div>';
      } else {
        this.battleServerListEl.innerHTML = '';
        for (const session of sessions) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'session-setup__server-card session-setup__server-card--battle';
          btn.dataset.mode = 'battle_server';
          btn.dataset.serverId = session.id || '';
          if (this.selectedMode === 'battle_server' && this.selectedBattleSessionId === String(session.id || '')) btn.classList.add('is-selected');
          const phase = 'Préparation ouverte';
          const timeLabel = `finale dans ${this.formatDuration(session.remainingMs)}`;
          const opened = this.formatDuration(session.startedAgoMs || 0);
          btn.innerHTML = `
            <div class="session-setup__server-main">
              <b>Battle Royale #${session.seq ?? '?'}</b>
              <span>${phase} · ouvert depuis ${opened}</span>
            </div>
            <div class="session-setup__server-meta">
              <span>${session.playerCount ?? 0} joueur${(session.playerCount ?? 0) > 1 ? 's' : ''}</span>
              <span>${timeLabel}</span>
              <span class="session-setup__server-join" data-mode="battle_server" data-server-id="${session.id || ''}">Sélectionner</span>
            </div>
          `;
          btn.addEventListener('click', () => this.selectMode('battle_server', session.id || ''));
          this.battleServerListEl.appendChild(btn);
        }
      }
    }
    if (this.selectionSummaryEl) {
      const label = this.selectedMode === 'endless'
        ? 'Serveur sélectionné : Endless'
        : (this.selectedMode === 'battle_next'
          ? 'Action sélectionnée : attente du prochain serveur Battle, sans gameplay avant ouverture'
          : `Serveur sélectionné : ${this.selectedBattleSessionId || 'Battle non sélectionné'}`);
      this.selectionSummaryEl.textContent = label;
    }
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = this.getActiveAccountName();

  }

  selectMode(mode, battleSessionId = '') {
    if (!['endless', 'battle_next', 'battle_server'].includes(mode)) return;
    this.selectedMode = mode;
    this.selectedBattleSessionId = mode === 'battle_server' ? String(battleSessionId || '') : '';
    this.saveStored();
    this.renderModeList();
  }

  getSelectedCard() { return this.cards.find((card) => card.id === this.selectedFrameId) || this.cards[0]; }

  selectFrame(frameId) {
    if (!this.cards.some((card) => card.id === frameId)) return;
    this.selectedFrameId = frameId;
    this.saveStored();
    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
  }

  renderDetails() {
    const card = this.getSelectedCard();
    if (!card) return;
    if (this.selectedAbilityIndex >= card.abilities.length) this.selectedAbilityIndex = 0;
    this.el.style.setProperty('--session-accent', card.accent);
    this.nameEl.textContent = card.name;
    this.metaEl.textContent = `${card.role} · ${card.difficulty}`;
    this.taglineEl.textContent = card.tagline;
    this.statsEl.innerHTML = card.stats.map((stat) => `
      <div class="session-setup__stat-row">
        <div class="session-setup__stat-top"><span>${stat.label}</span><span>${stat.value}</span></div>
        <div class="session-setup__stat-bar"><div class="session-setup__stat-fill" style="width:${Math.round(28 + stat.fill01 * 72)}%"></div></div>
      </div>
    `).join('');
    this.renderAbilityControls(card);
    const ability = card.abilities[this.selectedAbilityIndex] || card.abilities[0];
    if (this.abilityDetailKeyEl) this.abilityDetailKeyEl.textContent = ability?.key || '';
    if (this.abilityDetailTitleEl) this.abilityDetailTitleEl.textContent = ability?.name || ability?.label || '';
    if (this.abilityDetailTextEl) this.abilityDetailTextEl.textContent = ability?.text || '';
    this.drawPreview(performance.now() / 1000);
  }

  startPreviewLoop() {
    const tick = (now) => {
      this.previewRaf = requestAnimationFrame(tick);
      if (this.step !== 'ship' || this.el.classList.contains('is-hidden')) return;
      this.drawPreview(now / 1000);
    };
    this.previewRaf = requestAnimationFrame(tick);
  }

  drawPreview(time) {
    const card = this.getSelectedCard();
    if (!card) return;
    if (this.glyphEl instanceof HTMLCanvasElement) {
      const rect = this.glyphEl.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const w = Math.max(1, Math.floor(rect.width || 92));
      const h = Math.max(1, Math.floor(rect.height || 92));
      if (this.glyphEl.width !== Math.floor(w * dpr) || this.glyphEl.height !== Math.floor(h * dpr)) {
        this.glyphEl.width = Math.floor(w * dpr);
        this.glyphEl.height = Math.floor(h * dpr);
      }
      const ctx = this.glyphEl.getContext('2d');
      ctx.clearRect(0, 0, this.glyphEl.width, this.glyphEl.height);
      drawSessionShipGlyph(ctx, dpr, w * 0.5, h * 0.5, Math.min(w, h) * 0.18, card.id, -0.48 + Math.sin(time * 1.2) * 0.06, time, { thrust: 0.54, emphasize: true });
    }
    if (this.previewCtx && this.previewEl) {
      drawSessionRealAbilityDemo(this.previewCtx, this.previewEl, card, this.selectedAbilityIndex, this.selectedPreviewPhase, time);
    }
  }

  getActiveAccountName() {
    if (this.accountAction === 'login') return normalizePseudo(this.loginNameEl.value);
    if (this.accountAction === 'register') return normalizePseudo(this.registerNameEl.value);
    return normalizePseudo(this.inputEl.value);
  }

  getActivePassword() {
    if (this.accountAction === 'login') return this.loginPasswordEl.value;
    if (this.accountAction === 'register') return this.registerPasswordEl.value;
    return '';
  }

  commit() {
    const pseudo = this.accountAction === 'guest' ? normalizePseudo(this.inputEl.value) : this.getActiveAccountName();
    const payload = {
      pseudo,
      frameId: this.selectedFrameId,
      mode: this.selectedMode,
      battleSessionId: this.selectedBattleSessionId || '',
      accountAction: this.accountAction === 'guest' ? 'guest' : 'login',
      accountName: this.accountAction === 'guest' ? '' : (this.authenticatedAccountName || this.getActiveAccountName()),
      accountPassword: this.accountAction === 'guest' ? '' : (this.authenticatedPassword || this.getActivePassword())
    };
    this.inputEl.value = payload.pseudo;
    if (this.modePseudoEl) this.modePseudoEl.value = payload.pseudo;
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = payload.pseudo;
    storeSetup(payload);
    this.inputDirty = false;
    this.waitingAck = true;
    this.launchBtn.textContent = payload.mode === 'battle_next' ? 'Mise en attente…' : 'Déploiement…';
    this.onCommit?.(payload);
  }

  sync(storeState, connected, modes = null) {
    this.modes = modes;
    const pending = !!connected && (storeState?.sessionSetup?.pending ?? true);
    const queuedNext = !!modes?.battleQueuedNext;
    const requestedStep = String(storeState?.sessionSetup?.step || '');
    const auth = storeState?.sessionSetup?.authStatus || null;
    if (auth?.message && auth.message !== this.authStatus?.message) {
      this.setAuthStatus(auth.message, auth.ok !== false);
      if (auth.ok === false) {
        this.authRequestPending = false;
        this.authenticatedAccountName = '';
        this.authenticatedPassword = '';
        this.waitingAck = false;
        this.goToStep('auth');
      } else if (this.authRequestPending && this.step === 'auth') {
        this.authRequestPending = false;
        this.authenticatedAccountName = this.getActiveAccountName();
        this.authenticatedPassword = this.getActivePassword();
        this.accountAction = 'login';
        this.goToStep('mode');
      }
    }
    if (pending && (queuedNext || requestedStep === 'waiting') && this.step !== 'waiting') this.goToStep('waiting');
    else if (pending && requestedStep === 'mode' && !['mode', 'ship'].includes(this.step)) this.goToStep('mode');
    else if (pending && !queuedNext && !requestedStep && !this.serverPending && this.step !== 'auth') this.goToStep('auth');
    this.serverPending = pending;
    if (storeState?.pseudo && !this.waitingAck && !this.inputDirty && document.activeElement !== this.inputEl && document.activeElement !== this.modePseudoEl) {
      const syncedPseudo = normalizePseudo(storeState.pseudo);
      this.inputEl.value = syncedPseudo;
      if (this.modePseudoEl) this.modePseudoEl.value = syncedPseudo;
      if (this.currentPseudoEl) this.currentPseudoEl.textContent = syncedPseudo;
      if (!this.loginNameEl.value) this.loginNameEl.value = syncedPseudo;
      if (!this.registerNameEl.value) this.registerNameEl.value = syncedPseudo;
    }
    if (!this.serverPending) {
      this.waitingAck = false;
      this.launchBtn.textContent = 'Déployer';
    }
    this.renderModeList();
    this.applyVisibility(queuedNext);
  }

  applyVisibility(queuedNext = false) {
    this.el.classList.toggle('is-hidden', !this.serverPending && !queuedNext);
  }
}
