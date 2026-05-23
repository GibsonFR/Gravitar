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
      frameByMode: parsed.frameByMode && typeof parsed.frameByMode === 'object' ? parsed.frameByMode : {},
      mode: String(parsed.mode || 'endless'),
      battleSessionId: String(parsed.battleSessionId || ''),
      testWorldId: String(parsed.testWorldId || 'test-hub'),
      accountName: normalizePseudo(parsed.accountName || parsed.pseudo || 'Pilote')
    };
  } catch {
    return { pseudo: 'Pilote', frameId: 'vanguard', frameByMode: {}, mode: 'endless', battleSessionId: '', testWorldId: 'test-hub', accountName: 'Pilote' };
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
    this.frameByMode = stored.frameByMode && typeof stored.frameByMode === 'object' ? { ...stored.frameByMode } : {};
    this.selectedMode = ['endless', 'test_server', 'test_world', 'battle_next', 'battle_server'].includes(stored.mode) ? stored.mode : 'endless';
    const initialFrameId = this.frameByMode[this.getModeProfileKey(this.selectedMode)] || stored.frameId || 'vanguard';
    this.selectedFrameId = this.cards.some((card) => card.id === initialFrameId) ? initialFrameId : this.cards[0]?.id || 'vanguard';
    this.selectedBattleSessionId = stored.battleSessionId || '';
    this.selectedTestWorldId = stored.testWorldId || 'test-hub';
    this.selectedAbilityIndex = 0;
    this.selectedPreviewPhase = 1;
    this.selectedInfoTab = 'ability';
    this.selectedScenarioIndex = 0;
    this.previewRaf = 0;
    this.previewErrorLogged = false;
    this.previewSuspended = true;
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
          <div class="session-setup__server-list">
            <button type="button" data-mode="endless" class="session-setup__server-card session-setup__server-card--endless">
              <div class="session-setup__server-main">
                <b>Endless</b>
              </div>
              <div class="session-setup__server-meta">
                <span class="session-setup__endless-count">0 joueur</span>
              </div>
            </button>
            <div class="session-setup__server-section-title">Test</div>
            <div class="session-setup__test-world-list"></div>
            <div class="session-setup__server-section-title">Battle Royale</div>
            <div class="session-setup__battle-server-list"></div>
            <div class="session-setup__queue-card">
              <div class="session-setup__server-main">
                <b>Prochain Battle Royale</b>
                <span class="session-setup__battle-next">Ouverture bientôt</span>
              </div>
              <div class="session-setup__server-meta">
                <span class="session-setup__battle-waiting-count">0 en attente</span>
              </div>
              <button type="button" data-mode="battle_next" class="session-setup__queue-button">Rejoindre la file</button>
            </div>
          </div>
          <div class="session-setup__mode-footer">
            <div class="session-setup__selection-summary" data-selection-summary>Sélection : Endless</div>
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
                <div class="session-setup__scenario-buttons"></div>
              </div>
              <aside class="session-setup__side-panel">
                <div class="session-setup__stats"></div>
                <div class="session-setup__info-tabs">
                  <button type="button" class="session-setup__info-tab is-selected" data-info-tab="ability">Compétence</button>
                  <button type="button" class="session-setup__info-tab" data-info-tab="guide">Guide</button>
                </div>
                <div class="session-setup__info-panel is-active" data-info-panel="ability">
                  <div class="session-setup__ability-detail">
                    <div class="session-setup__ability-detail-key"></div>
                    <div>
                      <div class="session-setup__ability-detail-title"></div>
                      <div class="session-setup__ability-detail-text"></div>
                    </div>
                  </div>
                </div>
                <div class="session-setup__info-panel" data-info-panel="guide">
                  <div class="session-setup__ship-guide">
                    <div class="session-setup__guide-title">Guide</div>
                    <div class="session-setup__guide-lines"></div>
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
    this.testWorldListEl = this.el.querySelector('.session-setup__test-world-list');
    this.endlessCountEl = this.el.querySelector('.session-setup__endless-count');
    this.testCountEl = this.el.querySelector('.session-setup__test-count');
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
    const selectTestWorldFromEvent = (ev) => {
      const btn = ev.target?.closest?.('[data-mode="test_world"][data-test-world-id]');
      if (!btn || !this.testWorldListEl?.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.selectMode('test_world', btn.dataset.testWorldId || 'test-hub');
    };
    this.testWorldListEl?.addEventListener('click', selectTestWorldFromEvent);
    this.testWorldListEl?.addEventListener('pointerdown', selectTestWorldFromEvent);
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
    this.guideLinesEl = this.el.querySelector('.session-setup__guide-lines');
    this.infoTabs = [...this.el.querySelectorAll('[data-info-tab]')];
    this.infoPanels = [...this.el.querySelectorAll('[data-info-panel]')];
    this.scenarioButtonsEl = this.el.querySelector('.session-setup__scenario-buttons');
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
    this.infoTabs.forEach((btn) => btn.addEventListener('click', () => {
      this.selectedInfoTab = btn.dataset.infoTab || 'ability';
      this.renderDetails();
    }));
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

  getModeProfileKey(mode = this.selectedMode) {
    const m = String(mode || 'endless');
    if (m === 'battle_next' || m === 'battle_server') return 'battle';
    if (m === 'test_server' || m === 'test_world' || m === 'stress_server') return 'test';
    return 'endless';
  }

  saveStored() {
    storeSetup({
      pseudo: normalizePseudo(this.inputEl.value),
      frameId: this.selectedFrameId,
      frameByMode: { ...this.frameByMode, [this.getModeProfileKey()]: this.selectedFrameId },
      mode: this.selectedMode,
      battleSessionId: this.selectedBattleSessionId || '',
      testWorldId: this.selectedTestWorldId || 'test-hub',
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
    this.previewSuspended = step !== 'ship' || this.waitingAck;
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
        this.selectedScenarioIndex = 0;
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
        this.selectedScenarioIndex = 0;
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
    if (this.testCountEl) {
      const n = this.modes?.testPlayerCount ?? 0;
      this.testCountEl.textContent = `${n} joueur${n > 1 ? 's' : ''}`;
    }
    if (this.battleWaitingCountEl) {
      const n = this.modes?.battleWaitingCount ?? 0;
      this.battleWaitingCountEl.textContent = `${n} en attente`;
    }
    const nextText = `Ouverture dans ${this.formatDuration(this.modes?.battleNextInMs || 0)}`;
    if (this.battleNextEl) this.battleNextEl.textContent = nextText;
    if (this.waitingTimerEl) this.waitingTimerEl.textContent = nextText;
    if (this.testWorldListEl) {
      const worlds = Array.isArray(this.modes?.testWorlds) && this.modes.testWorlds.length ? this.modes.testWorlds : [
        { id: 'test-hub', title: 'Server Test', subtitle: '', playerCount: this.modes?.testPlayerCount ?? 0 }
      ];
      this.testWorldListEl.innerHTML = '';
      for (const world of worlds) {
        const id = String(world.id || 'test-hub');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'session-setup__server-card session-setup__server-card--test';
        btn.dataset.mode = 'test_world';
        btn.dataset.testWorldId = id;
        if (this.selectedMode === 'test_world' && this.selectedTestWorldId === id) btn.classList.add('is-selected');
        const n = world.playerCount ?? 0;
        btn.innerHTML = `
          <div class="session-setup__server-main">
            <b>${world.title || 'Server Test'}</b>
          </div>
          <div class="session-setup__server-meta">
            <span>${n} joueur${n > 1 ? 's' : ''}</span>
          </div>
        `;
        btn.addEventListener('click', () => this.selectMode('test_world', id));
        this.testWorldListEl.appendChild(btn);
      }
    }
    if (this.battleServerListEl) {
      const sessions = [...(this.modes?.battleSessions ?? [])]
        .filter((s) => s && s.state === 'lobby' && s.joinable !== false)
        .sort((a, b) => Number(b.startsAtMs || 0) - Number(a.startsAtMs || 0));
      if (this.selectedMode === 'battle_server' && this.selectedBattleSessionId && !sessions.some((s) => String(s.id || '') === this.selectedBattleSessionId)) {
        this.selectedMode = 'endless';
        this.selectedBattleSessionId = '';
      }
      if (!sessions.length) {
        this.battleServerListEl.innerHTML = '<div class="session-setup__server-empty">Aucun serveur Battle ouvert.</div>';
      } else {
        this.battleServerListEl.innerHTML = '';
        for (const session of sessions) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'session-setup__server-card session-setup__server-card--battle';
          btn.dataset.mode = 'battle_server';
          btn.dataset.serverId = session.id || '';
          if (this.selectedMode === 'battle_server' && this.selectedBattleSessionId === String(session.id || '')) btn.classList.add('is-selected');
          const timeLabel = `début dans ${this.formatDuration(session.remainingMs)}`;
          btn.innerHTML = `
            <div class="session-setup__server-main">
              <b>Battle Royale #${session.seq ?? '?'}</b>
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
      let label = 'Battle Royale';
      if (this.selectedMode === 'endless') label = 'Endless';
      else if (this.selectedMode === 'test_world' || this.selectedMode === 'test_server') label = 'Server Test';
      else if (this.selectedMode === 'stress_server') label = 'Stress';
      else if (this.selectedMode === 'battle_next') label = 'File Battle Royale';
      this.selectionSummaryEl.textContent = `Sélection : ${label}`;
    }
    if (this.currentPseudoEl) this.currentPseudoEl.textContent = this.getActiveAccountName();

  }

  selectMode(mode, battleSessionId = '') {
    if (!['endless', 'test_server', 'test_world', 'stress_server', 'battle_next', 'battle_server'].includes(mode)) return;
    this.frameByMode[this.getModeProfileKey(this.selectedMode)] = this.selectedFrameId;
    this.selectedMode = mode;
    this.selectedBattleSessionId = mode === 'battle_server' ? String(battleSessionId || '') : '';
    if (mode === 'test_world') this.selectedTestWorldId = String(battleSessionId || 'test-hub');
    const savedFrame = this.frameByMode[this.getModeProfileKey(mode)];
    if (savedFrame && this.cards.some((card) => card.id === savedFrame)) this.selectedFrameId = savedFrame;
    this.saveStored();
    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
  }

  getSelectedCard() { return this.cards.find((card) => card.id === this.selectedFrameId) || this.cards[0]; }

  selectFrame(frameId) {
    if (!this.cards.some((card) => card.id === frameId)) return;
    this.selectedFrameId = frameId;
    this.frameByMode[this.getModeProfileKey()] = frameId;
    this.selectedScenarioIndex = 0;
    this.saveStored();
    this.renderShipList();
    this.renderModeList();
    this.renderDetails();
  }

  renderScenarioControls(card, ability) {
    if (!this.scenarioButtonsEl) return;
    const scenarios = typeof ability?.getScenarios === 'function' ? ability.getScenarios(this.selectedPreviewPhase) : [];
    const list = Array.isArray(scenarios) && scenarios.length ? scenarios : [{ id: 'base', label: 'Base' }];
    if (this.selectedScenarioIndex >= list.length) this.selectedScenarioIndex = 0;
    this.scenarioButtonsEl.innerHTML = '';
    for (let i = 0; i < list.length; i += 1) {
      const sc = list[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'session-setup__scenario-button';
      if (i === this.selectedScenarioIndex) btn.classList.add('is-selected');
      btn.textContent = sc.label || sc.id || `Scénario ${i + 1}`;
      btn.addEventListener('click', () => {
        this.selectedScenarioIndex = i;
        this.renderDetails();
      });
      this.scenarioButtonsEl.appendChild(btn);
    }
  }

  updateInfoTabs() {
    for (const btn of this.infoTabs || []) btn.classList.toggle('is-selected', (btn.dataset.infoTab || '') === this.selectedInfoTab);
    for (const panel of this.infoPanels || []) panel.classList.toggle('is-active', (panel.dataset.infoPanel || '') === this.selectedInfoTab);
  }

  renderDetails() {
    const card = this.getSelectedCard();
    if (!card) return;
    if (this.selectedAbilityIndex >= card.abilities.length) this.selectedAbilityIndex = 0;
    this.el.style.setProperty('--session-accent', card.accent);
    this.nameEl.textContent = card.name;
    this.metaEl.textContent = '';
    this.taglineEl.textContent = '';
    this.statsEl.innerHTML = card.stats.map((stat) => `
      <div class="session-setup__stat-row">
        <div class="session-setup__stat-top"><span>${stat.label}</span><span>${stat.value}</span></div>
        <div class="session-setup__stat-bar"><div class="session-setup__stat-fill" style="width:${Math.round(28 + stat.fill01 * 72)}%"></div></div>
      </div>
    `).join('');
    this.renderAbilityControls(card);
    const ability = card.abilities[this.selectedAbilityIndex] || card.abilities[0];
    this.renderScenarioControls(card, ability);
    this.updateInfoTabs();
    if (this.abilityDetailKeyEl) this.abilityDetailKeyEl.textContent = ability?.key || '';
    if (this.abilityDetailTitleEl) this.abilityDetailTitleEl.textContent = ability?.name || ability?.label || '';
    if (this.abilityDetailTextEl) {
      const lines = typeof ability?.getLines === 'function' ? ability.getLines(this.selectedPreviewPhase) : (ability?.lines || [ability?.text || '']);
      this.abilityDetailTextEl.innerHTML = lines.filter(Boolean).map((line) => `<div>${line}</div>`).join('');
    }
    if (this.guideLinesEl) {
      this.guideLinesEl.innerHTML = (card.guide || []).map((line) => `<div>${line}</div>`).join('');
    }
    if (!this.previewSuspended) this.safeDrawPreview(performance.now() / 1000);
  }

  startPreviewLoop() {
    let lastPreviewAt = 0;
    const tick = (now) => {
      this.previewRaf = requestAnimationFrame(tick);
      if (this.previewSuspended || this.step !== 'ship' || this.el.classList.contains('is-hidden')) return;
      if (now - lastPreviewAt < 1000 / 30) return;
      lastPreviewAt = now;
      this.safeDrawPreview(now / 1000);
    };
    this.previewRaf = requestAnimationFrame(tick);
  }

  safeDrawPreview(time) {
    try {
      this.drawPreview(time);
    } catch (err) {
      if (!this.previewErrorLogged) {
        this.previewErrorLogged = true;
        console.error('[SessionSetupOverlay] preview disabled after renderer error', err);
      }
      const canvas = this.previewEl;
      const ctx = this.previewCtx;
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const w = Math.max(1, Math.floor(rect.width || 760));
      const h = Math.max(1, Math.floor(rect.height || 330));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(5, 9, 16, 0.98)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(235, 242, 255, 0.86)';
      ctx.font = `700 ${13 * dpr}px var(--ui-font, Segoe UI)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Prévisualisation indisponible', canvas.width * 0.5, canvas.height * 0.5);
    }
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
      drawSessionRealAbilityDemo(this.previewCtx, this.previewEl, card, this.selectedAbilityIndex, this.selectedPreviewPhase, time, this.selectedScenarioIndex);
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
      frameByMode: { ...this.frameByMode, [this.getModeProfileKey()]: this.selectedFrameId },
      mode: this.selectedMode,
      battleSessionId: this.selectedBattleSessionId || '',
      testWorldId: this.selectedTestWorldId || 'test-hub',
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
    this.previewSuspended = true;
    if (this.previewRaf) {
      cancelAnimationFrame(this.previewRaf);
      this.previewRaf = 0;
    }
    this.launchBtn.disabled = true;
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
      this.previewSuspended = true;
      this.launchBtn.disabled = false;
      this.launchBtn.textContent = 'Déployer';
    } else if (this.step === 'ship' && !this.waitingAck) {
      this.previewSuspended = false;
      this.launchBtn.disabled = false;
      if (!this.previewRaf) this.startPreviewLoop();
    }
    this.renderModeList();
    this.applyVisibility(queuedNext);
  }

  applyVisibility(queuedNext = false) {
    this.el.classList.toggle('is-hidden', !this.serverPending && !queuedNext);
  }
}
