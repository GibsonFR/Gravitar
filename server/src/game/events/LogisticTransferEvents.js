import { queueServerEvent, peekServerEventsForPlayer, pruneServerEvents } from './ServerEventBus.js';

export function nextLogisticVisualItemId(state) {
  state.nextLogisticVisualItemId = (state.nextLogisticVisualItemId | 0) + 1;
  if (state.nextLogisticVisualItemId > 2147483000) state.nextLogisticVisualItemId = 1;
  return state.nextLogisticVisualItemId;
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
    worldId: String(st.worldId || 'endless'),
    x: q(st.x),
    y: q(st.y),
    w: q(st.w || 0),
    h: q(st.h || 0),
    orientation: String(st.orientation || 'h')
  } : null;
}

function toLegacyLogisticEvent(ev) {
  if (!ev) return null;
  const payload = ev.payload || {};
  return {
    id: ev.id | 0,
    type: 'logistic.transfer',
    serverTime: Number(ev.serverTime || 0),
    action: String(payload.action || ''),
    visualItemId: payload.visualItemId | 0,
    resourceKey: String(payload.resourceKey || ''),
    colorHex: String(payload.colorHex || ''),
    source: payload.source || null,
    target: payload.target || null,
    carrier: payload.carrier || null,
    slot: String(payload.slot || ''),
    totalMs: Math.max(1, Number(payload.totalMs || 0) || 1)
  };
}

export function queueLogisticTransferEvent(state, action, options = {}) {
  const visualItemId = options.visualItemId | 0 || nextLogisticVisualItemId(state);
  const source = structureRef(options.source || null);
  const target = structureRef(options.target || null);
  const carrier = structureRef(options.carrier || null);
  const totalMs = Math.max(1, Number(options.totalMs || 0) || 1);
  const payload = {
    action: String(action || ''),
    visualItemId,
    resourceKey: String(options.resourceKey || ''),
    colorHex: String(options.colorHex || ''),
    source,
    target,
    carrier,
    slot: String(options.slot || ''),
    totalMs
  };
  const ev = queueServerEvent(state, 'logistic.transfer', {
    category: 'logistics',
    timeMs: options.timeMs,
    carrier: carrier || options.carrier || null,
    source: source || options.source || null,
    target: target || options.target || null,
    payload,
    ttlMs: Math.max(1800, totalMs + 450)
  });
  return toLegacyLogisticEvent(ev);
}

export function peekLogisticTransferEventsForPlayer(state, player) {
  return peekServerEventsForPlayer(state, player, { category: 'logistics', type: 'logistic.transfer' })
    .map(toLegacyLogisticEvent)
    .filter(Boolean);
}

export function pruneLogisticTransferEvents(state, timeMs = Date.now()) {
  pruneServerEvents(state, timeMs);
}
