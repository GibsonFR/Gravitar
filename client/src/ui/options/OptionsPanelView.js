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
    this.el = document.createElement('section');
    this.el.className = 'options-panel';
    this.el.innerHTML = `
      <div class="options-panel__head">
        <h2>Options</h2>
        <span>Audio · Graphismes</span>
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
    this.refreshAll();
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
    this.onChange?.(this.settings);
  }

  getSettings() { return { ...this.settings }; }
}
