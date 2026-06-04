function ensure(state) {
  if (!state) return null;
  if (!Array.isArray(state.pendingServerEvents)) state.pendingServerEvents = [];
  return state.pendingServerEvents;
}

function nextId(state) {
  state.nextServerEventId = (state.nextServerEventId | 0) + 1;
  if (state.nextServerEventId > 2147483000) state.nextServerEventId = 1;
  return state.nextServerEventId;
}

function q(v, decimals = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function scopeFrom(options = {}) {
  const scope = options.scope && typeof options.scope === 'object' ? options.scope : {};
  const ref = options.carrier || options.source || options.target || null;
  const sx = Number.isFinite(Number(scope.sx)) ? Number(scope.sx) | 0 : (ref?.sx | 0 || 0);
  const sy = Number.isFinite(Number(scope.sy)) ? Number(scope.sy) | 0 : (ref?.sy | 0 || 0);
  const worldId = String(scope.worldId || ref?.worldId || 'endless');
  const kind = String(scope.kind || 'sector');
  return {
    kind,
    sx,
    sy,
    worldId,
    x: q(scope.x ?? ref?.x ?? 0),
    y: q(scope.y ?? ref?.y ?? 0),
    radius: Math.max(0, Number(scope.radius || 0) || 0)
  };
}

function inInterest(ev, player) {
  if (!ev || !player) return false;
  const scope = ev.scope || {};
  const kind = String(scope.kind || 'sector');
  if (kind === 'global') return true;
  const worldId = String(player.worldId || 'endless');
  if (String(scope.worldId || 'endless') !== worldId) return false;
  if (kind === 'sector') return (scope.sx | 0) === (player.sx | 0) && (scope.sy | 0) === (player.sy | 0);
  if (kind === 'zone') {
    if ((scope.sx | 0) !== (player.sx | 0) || (scope.sy | 0) !== (player.sy | 0)) return false;
    const dx = (Number(player.x) || 0) - (Number(scope.x) || 0);
    const dy = (Number(player.y) || 0) - (Number(scope.y) || 0);
    const r = Math.max(1, Number(scope.radius) || 1);
    return dx * dx + dy * dy <= r * r;
  }
  return false;
}

export function queueServerEvent(state, type, options = {}) {
  const arr = ensure(state);
  if (!arr) return null;
  const timeMs = Number(options.serverTime ?? options.timeMs ?? Date.now());
  const ev = {
    id: nextId(state),
    type: String(type || ''),
    category: String(options.category || 'generic'),
    serverTime: timeMs,
    scope: scopeFrom(options),
    payload: options.payload && typeof options.payload === 'object' ? { ...options.payload } : {},
    ttlMs: Math.max(250, Number(options.ttlMs || 1800) || 1800)
  };
  arr.push(ev);
  if (arr.length > 4096) arr.splice(0, arr.length - 4096);
  return ev;
}

export function peekServerEventsForPlayer(state, player, filter = {}) {
  if (!Array.isArray(state?.pendingServerEvents) || !player) return [];
  const category = filter.category ? String(filter.category) : '';
  const type = filter.type ? String(filter.type) : '';
  return state.pendingServerEvents.filter((ev) => {
    if (category && String(ev.category || '') !== category) return false;
    if (type && String(ev.type || '') !== type) return false;
    return inInterest(ev, player);
  });
}

export function pruneServerEvents(state, timeMs = Date.now()) {
  if (!Array.isArray(state?.pendingServerEvents)) return;
  const now = Number(timeMs) || Date.now();
  state.pendingServerEvents = state.pendingServerEvents.filter((ev) => {
    const ttl = Math.max(250, Number(ev.ttlMs || 1800) || 1800);
    return Number(ev.serverTime || 0) + ttl >= now;
  });
}

export function getServerEventBusStats(state) {
  const events = Array.isArray(state?.pendingServerEvents) ? state.pendingServerEvents : [];
  const byCategory = {};
  const byType = {};
  for (const ev of events) {
    const category = String(ev.category || 'generic');
    const type = String(ev.type || 'unknown');
    byCategory[category] = (byCategory[category] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }
  return { pending: events.length, byCategory, byType };
}
