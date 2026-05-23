export function createCombatFxState() {
  return { pending: [] };
}

export function queueDamageNumber(state, target, amount, options = {}) {
  if (!state?.combatFx?.pending || !target || !Number.isFinite(amount) || amount <= 0) return;
  state.combatFx.pending.push({
    type: 'damage',
    sx: target.sx | 0,
    sy: target.sy | 0,
    x: target.x,
    y: target.y,
    targetId: target.id ?? 0,
    targetKind: target.kind || '',
    amount: Math.max(0, amount),
    shielded: !!options.shielded,
    crit: !!options.crit,
    periodic: !!options.periodic,
    sourceSlot: options.sourceSlot || '',
    visualKind: options.visualKind || ''
  });
}

export function queueStructureState(state, structure, reason = '') {
  if (!state?.combatFx?.pending || !structure) return;
  state.combatFx.pending.push({
    type: 'structure_state',
    sx: structure.sx | 0,
    sy: structure.sy | 0,
    x: structure.x,
    y: structure.y,
    targetId: structure.id ?? 0,
    targetKind: 'structure',
    structureId: structure.id ?? 0,
    hp: Math.max(0, Math.round(structure.stats?.hp ?? 0)),
    maxHp: Math.max(0, Math.round(structure.stats?.maxHp ?? 0)),
    damageable: structure.damageable !== false,
    reason: String(reason || '').slice(0, 32)
  });
}

export function peekCombatFx(state) {
  return state?.combatFx?.pending ?? [];
}

export function clearCombatFx(state) {
  if (!state?.combatFx?.pending) return;
  state.combatFx.pending = [];
}
