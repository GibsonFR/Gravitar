export const TURRET_MODES = Object.freeze({
  OFF: 'off',
  AUTO: 'auto',
  INTRUSION: 'intrusion'
});

export const TURRET_MODE_LABELS = Object.freeze({
  [TURRET_MODES.OFF]: 'OFF',
  [TURRET_MODES.AUTO]: 'Défense auto',
  [TURRET_MODES.INTRUSION]: 'Intrusion uniquement'
});

const MODE_SET = new Set(Object.values(TURRET_MODES));

export function normalizeTurretMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'disabled' || mode === 'hold' || mode === 'hold_fire') return TURRET_MODES.OFF;
  if (mode === 'claim' || mode === 'base' || mode === 'intruders') return TURRET_MODES.INTRUSION;
  return MODE_SET.has(mode) ? mode : TURRET_MODES.AUTO;
}

export function getTurretModeLabel(mode) {
  return TURRET_MODE_LABELS[normalizeTurretMode(mode)] || TURRET_MODE_LABELS[TURRET_MODES.AUTO];
}

export function isTurretModeEnabled(mode) {
  return normalizeTurretMode(mode) !== TURRET_MODES.OFF;
}
