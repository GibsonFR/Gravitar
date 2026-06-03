function ensureStatus(state) {
  if (!state) return null;
  if (!Array.isArray(state.pendingStatusEvents)) state.pendingStatusEvents = [];
  return state.pendingStatusEvents;
}

function ensurePassive(state) {
  if (!state) return null;
  if (!Array.isArray(state.pendingPassiveEvents)) state.pendingPassiveEvents = [];
  return state.pendingPassiveEvents;
}

export function queueStatusAppliedEvent(state, source, target, result, options = {}) {
  const arr = ensureStatus(state);
  if (!arr || !target || !result?.ok) return;
  arr.push({
    type: 'applied',
    sourceId: source?.id ?? result.sourceId ?? options.sourceId ?? 0,
    sourceKind: source?.kind || source?.type || options.sourceKind || '',
    targetId: target.id ?? 0,
    targetKind: target.kind || target.type || '',
    sx: target.sx | 0,
    sy: target.sy | 0,
    x: target.x,
    y: target.y,
    effectId: result.effectId || options.effectId || '',
    key: result.key || '',
    refreshed: !!result.refreshed,
    duration: Number.isFinite(Number(result.duration)) ? Number(result.duration) : Number(options.duration || 0),
    value: Number.isFinite(Number(result.value)) ? Number(result.value) : Number(options.value || 0),
    stacks: Number.isFinite(Number(result.stacks)) ? Number(result.stacks) : Number(options.stacks || 1),
    label: result.label || options.label || '',
    hostile: !!(result.hostile ?? options.hostile)
  });
  if (arr.length > 512) arr.splice(0, arr.length - 512);
}

export function queuePassiveChangedEvent(state, player, passiveId, payload = {}) {
  const arr = ensurePassive(state);
  if (!arr || !player) return;
  arr.push({
    playerId: player.id | 0,
    frameId: player.frameId || '',
    passiveId: String(passiveId || player.frameId || 'passive'),
    sx: player.sx | 0,
    sy: player.sy | 0,
    x: player.x,
    y: player.y,
    payload: { ...payload }
  });
  if (arr.length > 256) arr.splice(0, arr.length - 256);
}

export function peekStatusEventsForPlayer(state, player) {
  if (!Array.isArray(state?.pendingStatusEvents) || !state.pendingStatusEvents.length || !player) return [];
  const sx = player.sx | 0;
  const sy = player.sy | 0;
  return state.pendingStatusEvents.filter((ev) => Math.abs((ev.sx | 0) - sx) <= 1 && Math.abs((ev.sy | 0) - sy) <= 1);
}

export function peekPassiveEventsForPlayer(state, player) {
  if (!Array.isArray(state?.pendingPassiveEvents) || !state.pendingPassiveEvents.length || !player) return [];
  const sx = player.sx | 0;
  const sy = player.sy | 0;
  return state.pendingPassiveEvents.filter((ev) => Math.abs((ev.sx | 0) - sx) <= 1 && Math.abs((ev.sy | 0) - sy) <= 1);
}

export function clearStatusPassiveEvents(state) {
  if (Array.isArray(state?.pendingStatusEvents)) state.pendingStatusEvents = [];
  if (Array.isArray(state?.pendingPassiveEvents)) state.pendingPassiveEvents = [];
}
