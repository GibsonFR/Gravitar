import { CONTROL_BINDING_DEFS, findControlConflicts, keyCodeToLabel, eventToBindingCode, loadKeyBindings, resetKeyBindings, saveKeyBindings } from '../../input/KeyBindings.js';

const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0,
  musicVolume: -18,
  reactorVolume: -20,
  sfxVolume: -12,
  starDensity: 1,
  showGrid: true,
  showFx: true,
  renderScale: 1
});

const AUDIO_KEYS = new Set(['masterVolume', 'musicVolume', 'reactorVolume', 'sfxVolume']);

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }
function clamp(v, min, max) {
  const n = Number(v);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}
function normalizeAudioDb(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS[key];
  // Migration des anciennes options 0..1 : 0 ne doit plus rendre les sons muets par défaut.
  if ((n === 0 || n <= -60) && key !== 'masterVolume') return DEFAULT_SETTINGS[key];
  if (n > 0 && n <= 1) return Math.round(-60 + n * 60);
  return clamp(n, -60, 0);
}
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('spacefrontier.options') || '{}');
    const merged = { ...DEFAULT_SETTINGS, ...raw };
    for (const key of AUDIO_KEYS) merged[key] = normalizeAudioDb(key, merged[key]);
    merged.starDensity = clamp01(merged.starDensity);
    merged.renderScale = clamp(merged.renderScale, 0.6, 1);
    merged.showGrid = merged.showGrid !== false;
    merged.showFx = merged.showFx !== false;
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class OptionsPanelView {
  constructor(onChange) {
    this.onChange = typeof onChange === 'function' ? onChange : null;
    this.settings = loadSettings();
    this.keyBindings = loadKeyBindings();
    this.captureControlId = '';
    this.boundCapture = null;
    this.el = document.createElement('section');
    this.el.className = 'options-panel';
    this.el.innerHTML = `
      <div class="options-panel__head">
        <h2>Options</h2>
        <span>Audio · Graphismes · Contrôles</span>
      </div>
      <div class="options-panel__body">
        <section class="options-section">
          <div class="options-section__title">Audio</div>
          ${this.renderAudioSlider('Sortie générale', 'masterVolume')}
          ${this.renderAudioSlider('Musique', 'musicVolume')}
          ${this.renderAudioSlider('Réacteur', 'reactorVolume')}
          ${this.renderAudioSlider('Effets', 'sfxVolume')}
        </section>
        <section class="options-section">
          <div class="options-section__title">Graphismes</div>
          ${this.renderSlider('Étoiles', 'starDensity')}
          ${this.renderSlider('Échelle rendu', 'renderScale', 0.6, 1, 0.05)}
          ${this.renderToggle('Grille secteur', 'showGrid')}
          ${this.renderToggle('Effets visuels', 'showFx')}
        </section>
        <section class="options-section">
          <div class="options-section__title options-section__title--split">
            <span>Contrôles</span>
            <button type="button" class="options-reset-controls" data-reset-controls="1">Réinitialiser</button>
          </div>
          <div class="options-controls" data-controls-list="1"></div>
          <div class="options-controls__hint" data-controls-hint="1">Clique sur une touche pour la remplacer. Les doublons sont signalés.</div>
        </section>
      </div>
    `;
    this.el.addEventListener('input', (ev) => {
      const key = ev.target?.dataset?.key;
      if (!key) return;
      if (ev.target.type === 'range') {
        this.settings[key] = AUDIO_KEYS.has(key) ? clamp(ev.target.value, -60, 0) : (key === 'renderScale' ? clamp(ev.target.value, 0.6, 1) : clamp01(ev.target.value));
      }
      this.save();
      this.refreshValue(key);
    });
    this.el.addEventListener('change', (ev) => {
      const key = ev.target?.dataset?.key;
      if (!key) return;
      if (ev.target.type === 'checkbox') this.settings[key] = !!ev.target.checked;
      this.save();
    });
    this.el.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const bind = target.closest('[data-control-bind]');
      if (bind) {
        ev.preventDefault();
        ev.stopPropagation();
        this.startControlCapture(bind.dataset.controlBind || '');
        return;
      }
      const reset = target.closest('[data-reset-controls]');
      if (reset) {
        ev.preventDefault();
        ev.stopPropagation();
        this.keyBindings = resetKeyBindings();
        this.renderControls();
        this.emitChange();
      }
    });
    this.refreshAll();
    this.renderControls();
  }

  emitChange() {
    this.onChange?.({ ...this.settings, controls: this.getKeyBindings() });
  }

  renderControls() {
    const list = this.el.querySelector('[data-controls-list]');
    if (!list) return;
    const conflicts = findControlConflicts(this.keyBindings);
    const conflictIds = new Set(conflicts.flatMap((entry) => entry.ids));
    let currentGroup = '';
    const html = [];
    for (const def of CONTROL_BINDING_DEFS) {
      if (def.group !== currentGroup) {
        currentGroup = def.group;
        html.push(`<div class="options-controls__group">${this.escape(def.group)}</div>`);
      }
      const active = this.captureControlId === def.id;
      const conflict = conflictIds.has(def.id);
      html.push(`
        <button type="button" class="options-control-row ${active ? 'is-capturing' : ''} ${conflict ? 'is-conflict' : ''}" data-control-bind="${this.escape(def.id)}">
          <span>${this.escape(def.label)}</span>
          <b>${active ? 'Appuie sur une touche…' : this.escape(keyCodeToLabel(this.keyBindings[def.id]))}</b>
        </button>
      `);
    }
    list.innerHTML = html.join('');
    const hint = this.el.querySelector('[data-controls-hint]');
    if (hint) {
      hint.textContent = conflicts.length
        ? `Conflit : ${conflicts.map((entry) => keyCodeToLabel(entry.code)).join(', ')} utilisé plusieurs fois.`
        : 'Clique sur une touche pour la remplacer. Les doublons sont signalés.';
      hint.classList.toggle('is-warning', conflicts.length > 0);
    }
  }

  startControlCapture(controlId) {
    if (!CONTROL_BINDING_DEFS.some((def) => def.id === controlId)) return;
    this.stopControlCapture(false);
    this.captureControlId = controlId;
    this.renderControls();
    this.boundCapture = (ev) => this.captureControlEvent(ev);
    window.addEventListener('keydown', this.boundCapture, { capture: true });
    window.addEventListener('mousedown', this.boundCapture, { capture: true });
    window.addEventListener('wheel', this.boundCapture, { capture: true, passive: false });
  }

  stopControlCapture(render = true) {
    if (this.boundCapture) {
      window.removeEventListener('keydown', this.boundCapture, { capture: true });
      window.removeEventListener('mousedown', this.boundCapture, { capture: true });
      window.removeEventListener('wheel', this.boundCapture, { capture: true });
    }
    this.boundCapture = null;
    this.captureControlId = '';
    if (render) this.renderControls();
  }

  captureControlEvent(ev) {
    const controlId = this.captureControlId;
    if (!controlId) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    const code = eventToBindingCode(ev);
    if (!code) return;
    this.keyBindings = saveKeyBindings({ ...this.keyBindings, [controlId]: code });
    this.stopControlCapture(true);
    this.emitChange();
  }

  escape(txt) {
    return String(txt || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  renderSlider(label, key, min = 0, max = 1, step = 0.01) {
    const value = this.settings[key];
    return `<label class="options-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}"><b data-value="${key}">0%</b></label>`;
  }

  renderAudioSlider(label, key) {
    const value = this.settings[key];
    return `<label class="options-row"><span>${label}</span><input type="range" min="-60" max="0" step="1" value="${value}" data-key="${key}"><b data-value="${key}">0 dB</b></label>`;
  }

  renderToggle(label, key) {
    return `<label class="options-row options-row--toggle"><span>${label}</span><input type="checkbox" ${this.settings[key] ? 'checked' : ''} data-key="${key}"></label>`;
  }

  refreshValue(key) {
    const node = this.el.querySelector(`[data-value="${key}"]`);
    if (!node) return;
    if (AUDIO_KEYS.has(key)) {
      const db = clamp(this.settings[key], -60, 0);
      node.textContent = db <= -60 ? 'muet' : `${db} dB`;
      return;
    }
    node.textContent = `${Math.round((Number(this.settings[key]) || 0) * 100)}%`;
  }

  refreshAll() {
    for (const key of ['masterVolume', 'musicVolume', 'reactorVolume', 'sfxVolume', 'starDensity', 'renderScale']) this.refreshValue(key);
  }

  save() {
    localStorage.setItem('spacefrontier.options', JSON.stringify(this.settings));
    this.emitChange();
  }

  getSettings() { return { ...this.settings, controls: this.getKeyBindings() }; }

  getKeyBindings() { return { ...this.keyBindings }; }
}
