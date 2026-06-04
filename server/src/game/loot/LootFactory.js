import { newEntityId } from '../state/GameState.js';
import { LOOT_DEFS } from './LootDefs.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { queueLootSpawnedEvent } from '../events/WorldEntityEvents.js';

const LEGACY_LOOT_ALIASES = {
  ore: 'ironVein',
  metal: 'scrap',
  ferrite: 'scrap',
  crystalShard: 'crystal',
  biomass: 'bioFiber'
};

function resolveLootKey(defKey) {
  const key = String(defKey || '').trim();
  if (LOOT_DEFS[key]) return key;
  const alias = LEGACY_LOOT_ALIASES[key];
  if (alias && LOOT_DEFS[alias]) return alias;
  return '';
}

export function spawnLoot(state, x, y, defKey, timeMs, sourceKind = '', sourceId = 0, velocity = null) {
  return spawnLootInSector(state, 0, 0, x, y, defKey, timeMs, sourceKind, sourceId, velocity);
}

export function spawnLootInSector(state, sx, sy, x, y, defKey, timeMs, sourceKind = '', sourceId = 0, velocity = null) {
  const resolvedKey = resolveLootKey(defKey);
  const def = resolvedKey ? LOOT_DEFS[resolvedKey] : null;
  if (!def) {
    console.warn('[loot] ignored unknown loot def:', defKey);
    return 0;
  }

  const id = newEntityId(state);

  const loot = {
    kind: 'loot',
    id,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    vx: velocity?.x ?? 0,
    vy: velocity?.y ?? 0,
    radius: def.radius,
    pickupPadding: def.pickupPadding,
    pickupImmunityLeft: def.pickupImmunitySec,
    resource: def.resource || resolvedKey,
    amount: def.amount,
    color: def.color,
    drag: def.drag,
    bornAt: timeMs,
    despawnAt: timeMs + def.lifetimeSec * 1000,
    sourceKind,
    sourceId
  };
  state.loots.set(id, loot);
  queueLootSpawnedEvent(state, loot);

  return id;
}


export function spawnItemLootInSector(state, sx, sy, x, y, itemId, timeMs, options = {}) {
  const def = getItemDef(itemId);
  if (!def) throw new Error(`unknown item loot def: ${itemId}`);
  const id = newEntityId(state);
  const tier = Math.max(1, def.tier | 0);
  const c = options.color || (tier >= 3 ? { r: 255, g: 124, b: 229 } : tier >= 2 ? { r: 255, g: 205, b: 98 } : { r: 124, g: 233, b: 255 });
  const loot = {
    kind: 'loot',
    id,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    vx: options.velocity?.x ?? 0,
    vy: options.velocity?.y ?? 0,
    radius: options.radius ?? 16,
    pickupPadding: options.pickupPadding ?? 18,
    pickupImmunityLeft: options.pickupImmunitySec ?? 0.65,
    resource: '',
    amount: 1,
    itemId: def.id,
    itemName: def.shortName || def.name,
    itemCategoryId: def.categoryId,
    bastionReward: !!options.bastionReward,
    color: c,
    drag: options.drag ?? 0.92,
    bornAt: timeMs,
    despawnAt: timeMs + (options.lifetimeSec ?? 300) * 1000,
    sourceKind: options.sourceKind || '',
    sourceId: options.sourceId || 0
  };
  state.loots.set(id, loot);
  queueLootSpawnedEvent(state, loot);
  return id;
}
