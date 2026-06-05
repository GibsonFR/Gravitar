function ensureWorldEntityEvents(state) {
  if (!state.worldEntityEvents) state.worldEntityEvents = { pending: [], nextId: 0 };
  if (!Array.isArray(state.worldEntityEvents.pending)) state.worldEntityEvents.pending = [];
  return state.worldEntityEvents;
}

function nextWorldEntityEventId(state) {
  const s = ensureWorldEntityEvents(state);
  s.nextId = (s.nextId | 0) + 1;
  if (s.nextId > 2147483000) s.nextId = 1;
  return s.nextId;
}

function pushWorldEntityEvent(state, event) {
  if (!event) return null;
  const s = ensureWorldEntityEvents(state);
  const ev = {
    id: nextWorldEntityEventId(state),
    time: state?.time?.currentMs || Date.now(),
    ...event
  };
  s.pending.push(ev);
  return ev;
}

function sameSectorEvent(ev, player) {
  if (!ev || !player) return false;
  if ((ev.sx | 0) !== (player.sx | 0) || (ev.sy | 0) !== (player.sy | 0)) return false;
  return String(ev.worldId || player.worldId || 'endless') === String(player.worldId || 'endless');
}

export function queueAsteroidDamageEvent(state, asteroid) {
  if (!asteroid) return null;
  return pushWorldEntityEvent(state, {
    type: 'asteroid_damage',
    targetKind: 'asteroid',
    targetId: asteroid.id | 0,
    sx: asteroid.sx | 0,
    sy: asteroid.sy | 0,
    worldId: String(asteroid.worldId || 'endless'),
    hpAfter: Math.max(0, Number(asteroid.stats?.hp ?? 0)),
    maxHp: Math.max(0, Number(asteroid.stats?.maxHp ?? asteroid.stats?.hp ?? 0))
  });
}

export function queueAsteroidDestroyedEvent(state, asteroid) {
  if (!asteroid) return null;
  return pushWorldEntityEvent(state, {
    type: 'asteroid_destroyed',
    targetKind: 'asteroid',
    targetId: asteroid.id | 0,
    sx: asteroid.sx | 0,
    sy: asteroid.sy | 0,
    worldId: String(asteroid.worldId || 'endless'),
    x: Number(asteroid.x || 0),
    y: Number(asteroid.y || 0)
  });
}

export function queueLootSpawnedEvent(state, loot) {
  if (!loot) return null;
  return pushWorldEntityEvent(state, {
    type: 'loot_spawned',
    loot: {
      kind: 'loot',
      id: loot.id | 0,
      sx: loot.sx | 0,
      sy: loot.sy | 0,
      worldId: String(loot.worldId || 'endless'),
      x: Number(loot.x || 0),
      y: Number(loot.y || 0),
      vx: Number(loot.vx || 0),
      vy: Number(loot.vy || 0),
      radius: Number(loot.radius || 10),
      pickupPadding: Number(loot.pickupPadding || 0),
      resource: loot.resource || '',
      amount: Number(loot.amount || 0),
      itemId: loot.itemId || '',
      itemName: loot.itemName || '',
      itemCategoryId: loot.itemCategoryId || '',
      color: loot.color || null,
      bornAt: loot.bornAt || 0,
      despawnAt: loot.despawnAt || 0,
      sourceKind: loot.sourceKind || '',
      sourceId: loot.sourceId | 0
    },
    sx: loot.sx | 0,
    sy: loot.sy | 0,
    worldId: String(loot.worldId || 'endless')
  });
}

export function queueLootRemovedEvent(state, loot, reason = 'removed', playerId = 0) {
  if (!loot) return null;
  return pushWorldEntityEvent(state, {
    type: 'loot_removed',
    lootId: loot.id | 0,
    sx: loot.sx | 0,
    sy: loot.sy | 0,
    worldId: String(loot.worldId || 'endless'),
    reason: String(reason || 'removed'),
    playerId: playerId | 0
  });
}

export function peekWorldEntityEventsForPlayer(state, player) {
  const pending = state?.worldEntityEvents?.pending;
  if (!Array.isArray(pending) || !player) return [];
  return pending.filter((ev) => sameSectorEvent(ev, player) || (ev.playerId | 0) === (player.id | 0));
}

export function pruneWorldEntityEvents(state, maxAgeMs = 12000) {
  const pending = state?.worldEntityEvents?.pending;
  if (!Array.isArray(pending)) return;
  const now = state?.time?.currentMs || Date.now();
  state.worldEntityEvents.pending = pending.filter((ev) => now - (ev.time || now) <= maxAgeMs);
}

function areaEffectPayload(effect) {
  if (!effect) return null;
  return {
    id: effect.id | 0,
    kind: effect.kind || 'area_effect',
    ownerId: effect.ownerId | 0,
    frameId: effect.frameId || '',
    slot: effect.slot || '',
    sx: effect.sx | 0,
    sy: effect.sy | 0,
    worldId: String(effect.worldId || 'endless'),
    x: Number(effect.x || 0),
    y: Number(effect.y || 0),
    radius: Number(effect.radius || 0),
    innerRadius: Number(effect.innerRadius || 0),
    durationLeft: Number(effect.durationLeft || 0),
    tickEvery: Number(effect.tickEvery || 0),
    pulseEvery: Number(effect.pulseEvery || 0),
    damage: Number(effect.damage || 0),
    color: effect.color || null,
    visualStyle: effect.visualStyle || '',
    label: effect.label || ''
  };
}

export function queueAreaEffectSpawnedEvent(state, effect) {
  const payload = areaEffectPayload(effect);
  if (!payload) return null;
  return pushWorldEntityEvent(state, {
    type: 'area_spawned',
    area: payload,
    sx: payload.sx,
    sy: payload.sy,
    worldId: payload.worldId
  });
}

export function queueAreaEffectRemovedEvent(state, effect, reason = 'removed') {
  if (!effect) return null;
  return pushWorldEntityEvent(state, {
    type: 'area_removed',
    areaId: effect.id | 0,
    sx: effect.sx | 0,
    sy: effect.sy | 0,
    worldId: String(effect.worldId || 'endless'),
    reason: String(reason || 'removed')
  });
}

