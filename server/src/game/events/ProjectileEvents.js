import { queueServerEvent, peekServerEventsForPlayer } from './ServerEventBus.js';

function q(v, decimals = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function entityRef(entity) {
  return entity ? {
    id: entity.id | 0,
    kind: String(entity.kind || entity.type || ''),
    type: String(entity.type || ''),
    sx: entity.sx | 0,
    sy: entity.sy | 0,
    worldId: String(entity.worldId || 'endless'),
    x: q(entity.x),
    y: q(entity.y),
    radius: q(entity.radius || 0)
  } : null;
}

function projectilePayload(projectile) {
  if (!projectile) return null;
  return {
    id: projectile.id | 0,
    kind: 'projectile',
    sx: projectile.sx | 0,
    sy: projectile.sy | 0,
    worldId: String(projectile.worldId || 'endless'),
    x: q(projectile.x),
    y: q(projectile.y),
    vx: q(projectile.vx || 0, 3),
    vy: q(projectile.vy || 0, 3),
    radius: q(projectile.radius),
    damage: q(projectile.damage || 0),
    rangeLeft: q(projectile.rangeLeft || 0),
    splashRadius: q(projectile.splashRadius || 0),
    tint: projectile.tint || null,
    sourceId: projectile.sourceId | 0,
    sourceKind: String(projectile.sourceKind || ''),
    bornAt: projectile.bornAt || 0,
    visualKind: projectile.visualKind || 'auto',
    visualSlot: projectile.visualSlot || '',
    visualAmmoEffect: projectile.visualAmmoEffect || '',
    visualAmmoId: projectile.visualAmmoId || '',
    sourceAbilitySlot: projectile.sourceAbilitySlot || '',
    sourceFrameId: projectile.sourceFrameId || '',
    crit: !!projectile.crit,
    empoweredAutoUsed: !!projectile.empoweredAutoUsed,
    ultAutoUsed: !!projectile.ultAutoUsed,
    maxLifetimeMs: projectile.maxLifetimeMs || 0
  };
}

function projectileScope(projectile, radius = 1600) {
  return {
    kind: 'sector',
    worldId: String(projectile?.worldId || 'endless'),
    sx: projectile?.sx | 0,
    sy: projectile?.sy | 0,
    x: q(projectile?.x || 0),
    y: q(projectile?.y || 0),
    radius
  };
}

function toLegacyProjectileEvent(ev) {
  if (!ev) return null;
  const payload = ev.payload || {};
  return {
    id: ev.id | 0,
    type: ev.type || '',
    serverTime: Number(ev.serverTime || 0),
    action: String(payload.action || ''),
    projectileId: payload.projectileId | 0,
    projectile: payload.projectile || null,
    target: payload.target || null,
    x: q(payload.x || 0),
    y: q(payload.y || 0),
    reason: String(payload.reason || ''),
    impact: payload.impact || null
  };
}

export function queueProjectileSpawnEvent(state, projectile, timeMs = Date.now()) {
  if (!projectile) return null;
  const payload = {
    action: 'spawn',
    projectileId: projectile.id | 0,
    projectile: projectilePayload(projectile),
    x: q(projectile.x),
    y: q(projectile.y)
  };
  const ev = queueServerEvent(state, 'projectile.spawn', {
    category: 'projectiles',
    timeMs,
    scope: projectileScope(projectile),
    payload,
    ttlMs: 450
  });
  return toLegacyProjectileEvent(ev);
}

export function queueProjectileImpactEvent(state, projectile, target = null, timeMs = Date.now(), options = {}) {
  if (!projectile) return null;
  const impactX = Number.isFinite(Number(options.x)) ? Number(options.x) : projectile.x;
  const impactY = Number.isFinite(Number(options.y)) ? Number(options.y) : projectile.y;
  const payload = {
    action: 'impact',
    projectileId: projectile.id | 0,
    projectile: projectilePayload(projectile),
    target: entityRef(target),
    x: q(impactX),
    y: q(impactY),
    reason: String(options.reason || 'hit'),
    impact: {
      splashRadius: q(projectile.splashRadius || 0),
      visualKind: projectile.visualKind || '',
      sourceAbilitySlot: projectile.sourceAbilitySlot || '',
      crit: !!projectile.crit
    }
  };
  const ev = queueServerEvent(state, 'projectile.impact', {
    category: 'projectiles',
    timeMs,
    scope: projectileScope(projectile),
    payload,
    ttlMs: 450
  });
  return toLegacyProjectileEvent(ev);
}

export function queueProjectileDestroyEvent(state, projectile, timeMs = Date.now(), reason = 'destroyed') {
  if (!projectile) return null;
  const payload = {
    action: 'destroy',
    projectileId: projectile.id | 0,
    projectile: projectilePayload(projectile),
    x: q(projectile.x),
    y: q(projectile.y),
    reason: String(reason || 'destroyed')
  };
  const ev = queueServerEvent(state, 'projectile.destroy', {
    category: 'projectiles',
    timeMs,
    scope: projectileScope(projectile),
    payload,
    ttlMs: 450
  });
  return toLegacyProjectileEvent(ev);
}

export function peekProjectileEventsForPlayer(state, player) {
  return peekServerEventsForPlayer(state, player, { category: 'projectiles' })
    .map(toLegacyProjectileEvent)
    .filter(Boolean);
}
