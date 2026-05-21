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

export function peekCombatFx(state) {
  return state?.combatFx?.pending ?? [];
}

export function clearCombatFx(state) {
  if (!state?.combatFx?.pending) return;
  state.combatFx.pending = [];
}
