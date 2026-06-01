export const CONTROL_BINDING_STORAGE_KEY = 'spacefrontier.controls.v235';

export const CONTROL_BINDING_DEFS = Object.freeze([
  { id: 'abilityA', label: 'Capacité A', group: 'Combat', defaultCode: 'KeyA' },
  { id: 'abilityZ', label: 'Capacité Z', group: 'Combat', defaultCode: 'KeyZ' },
  { id: 'abilityE', label: 'Capacité E', group: 'Combat', defaultCode: 'KeyE' },
  { id: 'abilityR', label: 'Capacité R', group: 'Combat', defaultCode: 'KeyR' },
  { id: 'interact', label: 'Interagir / ouvrir', group: 'Action', defaultCode: 'KeyD' },
  { id: 'rocket', label: 'Tir roquette', group: 'Action', defaultCode: 'KeyF' },
  { id: 'rocketSlot0', label: 'Munition roquette 1', group: 'Action', defaultCode: 'KeyX' },
  { id: 'rocketSlot1', label: 'Munition roquette 2', group: 'Action', defaultCode: 'KeyC' },
  { id: 'cameraLock', label: 'Verrou caméra', group: 'Navigation', defaultCode: 'Space' },
  { id: 'frameVanguard', label: 'Vaisseau 1', group: 'Vaisseau', defaultCode: 'Digit1' },
  { id: 'frameSigil', label: 'Vaisseau 2', group: 'Vaisseau', defaultCode: 'Digit2' },
  { id: 'frameBulwark', label: 'Vaisseau 3', group: 'Vaisseau', defaultCode: 'Digit3' },
  { id: 'buildRotate', label: 'Rotation bâtiment', group: 'Build', defaultCode: 'KeyO' },
  { id: 'buildCancel', label: 'Annuler placement', group: 'Build', defaultCode: 'Escape' }
]);

const DEFAULT_BINDINGS = Object.freeze(Object.fromEntries(CONTROL_BINDING_DEFS.map((def) => [def.id, def.defaultCode])));

const CODE_LABELS = Object.freeze({
  Space: 'Espace',
  Escape: 'Échap',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  MouseLeft: 'Clic gauche',
  MouseRight: 'Clic droit',
  MouseMiddle: 'Clic molette',
  WheelUp: 'Molette haut',
  WheelDown: 'Molette bas'
});

export function getDefaultKeyBindings() {
  return { ...DEFAULT_BINDINGS };
}

export function normalizeKeyBindings(bindings = {}) {
  const out = getDefaultKeyBindings();
  for (const def of CONTROL_BINDING_DEFS) {
    const code = String(bindings?.[def.id] || '').trim();
    if (code) out[def.id] = code;
  }
  return out;
}

export function loadKeyBindings() {
  try {
    return normalizeKeyBindings(JSON.parse(localStorage.getItem(CONTROL_BINDING_STORAGE_KEY) || '{}'));
  } catch {
    return getDefaultKeyBindings();
  }
}

export function saveKeyBindings(bindings = {}) {
  const normalized = normalizeKeyBindings(bindings);
  localStorage.setItem(CONTROL_BINDING_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetKeyBindings() {
  const defaults = getDefaultKeyBindings();
  localStorage.setItem(CONTROL_BINDING_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

export function keyCodeToLabel(code = '') {
  const value = String(code || '').trim();
  if (!value) return '—';
  if (CODE_LABELS[value]) return CODE_LABELS[value];
  if (value.startsWith('Key') && value.length === 4) return value.slice(3).toUpperCase();
  if (value.startsWith('Digit') && value.length === 6) return value.slice(5);
  if (value.startsWith('Numpad')) return `Pavé ${value.slice(6)}`;
  if (value.startsWith('Mouse')) return CODE_LABELS[value] || value;
  if (value.startsWith('Wheel')) return CODE_LABELS[value] || value;
  return value.replace(/^Control/, 'Ctrl ').replace(/^Shift/, 'Maj ').replace(/^Alt/, 'Alt ');
}

export function eventToBindingCode(ev) {
  if (!ev) return '';
  if (ev.type === 'wheel') return Number(ev.deltaY || 0) < 0 ? 'WheelUp' : 'WheelDown';
  if (ev.type === 'mousedown' || ev.type === 'pointerdown') {
    if (ev.button === 0) return 'MouseLeft';
    if (ev.button === 1) return 'MouseMiddle';
    if (ev.button === 2) return 'MouseRight';
  }
  return String(ev.code || ev.key || '').trim();
}

export function isControlMatch(bindings, actionId, ev) {
  const expected = normalizeKeyBindings(bindings)[actionId];
  if (!expected) return false;
  return eventToBindingCode(ev) === expected;
}

export function findControlConflicts(bindings = {}) {
  const normalized = normalizeKeyBindings(bindings);
  const byCode = new Map();
  for (const def of CONTROL_BINDING_DEFS) {
    const code = normalized[def.id];
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(def.id);
  }
  return [...byCode.entries()].filter(([, ids]) => ids.length > 1).map(([code, ids]) => ({ code, ids }));
}
