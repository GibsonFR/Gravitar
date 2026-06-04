function ensure(state) {
  if (!state) return null;
  if (!Array.isArray(state.pendingLogisticTransferEvents)) state.pendingLogisticTransferEvents = [];
  return state.pendingLogisticTransferEvents;
}

function nextId(state) {
  state.nextLogisticTransferEventId = (state.nextLogisticTransferEventId | 0) + 1;
  if (state.nextLogisticTransferEventId > 2147483000) state.nextLogisticTransferEventId = 1;
  return state.nextLogisticTransferEventId;
}

function q(v, decimals = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function structureRef(st) {
  return st ? {
    id: st.id | 0,
    type: String(st.type || ''),
    sx: st.sx | 0,
    sy: st.sy | 0,
    x: q(st.x),
    y: q(st.y),
    w: q(st.w || 0),
    h: q(st.h || 0),
    orientation: String(st.orientation || 'h')
  } : null;
}

export function queueLogisticTransferEvent(state, action, options = {}) {
  const arr = ensure(state);
  if (!arr) return null;
  const timeMs = Number(options.timeMs || Date.now());
  const ev = {
    id: nextId(state),
    type: 'logistic.transfer',
    serverTime: timeMs,
    action: String(action || ''),
    resourceKey: String(options.resourceKey || ''),
    colorHex: String(options.colorHex || ''),
    itemSeq: state.nextLogisticTransferItemSeq = ((state.nextLogisticTransferItemSeq | 0) + 1),
    source: structureRef(options.source || null),
    target: structureRef(options.target || null),
    carrier: structureRef(options.carrier || null),
    slot: String(options.slot || ''),
    totalMs: Math.max(1, Number(options.totalMs || 0) || 1)
  };
  arr.push(ev);
  if (arr.length > 512) arr.splice(0, arr.length - 512);
  return ev;
}

export function peekLogisticTransferEventsForPlayer(state, player) {
  if (!Array.isArray(state?.pendingLogisticTransferEvents) || !player) return [];
  const sx = player.sx | 0;
  const sy = player.sy | 0;
  const worldId = String(player.worldId || 'endless');
  return state.pendingLogisticTransferEvents.filter((ev) => {
    const ref = ev.carrier || ev.source || ev.target || null;
    if (!ref) return false;
    if ((ref.sx | 0) !== sx || (ref.sy | 0) !== sy) return false;
    return true;
  });
}

export function pruneLogisticTransferEvents(state, timeMs = Date.now()) {
  if (!Array.isArray(state?.pendingLogisticTransferEvents)) return;
  const cutoff = Number(timeMs) - 4500;
  state.pendingLogisticTransferEvents = state.pendingLogisticTransferEvents.filter((ev) => Number(ev.serverTime || 0) >= cutoff);
}
