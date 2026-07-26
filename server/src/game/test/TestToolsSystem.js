import { STARTER_AMMO_LOADOUT } from '../../../../shared/content/items/ItemDefs.js';
import { listMobDefs } from '../../../../shared/content/mobs/MobDefs.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { newEntityId } from '../state/GameState.js';
import { addResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS, RESOURCE_KEYS_ORDER } from '../inventory/ResourceDefs.js';
import { spawnMob } from '../mob/MobFactory.js';
import { isTestRuntimePlayer } from './TestToolsPolicy.js';

function ensureTest(player) {
  return isTestRuntimePlayer(player) ? null : { ok: false, error: 'test_only' };
}

export function giveTestResources(_state, player, resourceKey = '', amount = 100) {
  const denied = ensureTest(player);
  if (denied) return denied;
  const qty = Math.max(1, Math.min(9999, amount | 0 || 100));
  const keys = resourceKey && RESOURCE_DEFS[resourceKey] ? [resourceKey] : RESOURCE_KEYS_ORDER;
  player.inv.cargoMax = Math.max(Number(player.inv.cargoMax || 0), 250000);
  for (const key of keys) addResource(player.inv, key, qty);
  player.equipment ??= {};
  player.equipment.rocketAmmoCountsById ??= {};
  for (const [itemId, count] of Object.entries(STARTER_AMMO_LOADOUT.inventory || {})) {
    player.equipment.rocketAmmoCountsById[itemId] = Math.max(player.equipment.rocketAmmoCountsById[itemId] | 0, (count | 0) + 80);
  }
  player.forceFullUiSnapshot = true;
  player.uiHint = resourceKey ? `${RESOURCE_DEFS[resourceKey]?.name || resourceKey} ajouté` : 'Ressources et munitions de test ajoutées';
  player.uiHintTimer = 2;
  return { ok: true };
}

export function spawnTestMob(state, player, mobId = '') {
  const denied = ensureTest(player);
  if (denied) return denied;
  const defs = listMobDefs();
  const def = defs.find((candidate) => candidate.id === mobId) || defs[0];
  if (!def) return { ok: false, error: 'mob_not_found' };
  const mob = spawnMob(state, player.sx, player.sy, def.id, player.x + 340, player.y, {
    seed: newEntityId(state) ^ (player.id | 0),
    mapLevel: 12,
    spawnTimeMs: Date.now()
  });
  mob.worldId = String(player.worldId || 'test');
  mob.testSpawned = true;
  player.uiHint = `${def.name} créé`;
  player.uiHintTimer = 1.5;
  return { ok: true };
}

export function spawnTestDummy(state, player) {
  const denied = ensureTest(player);
  if (denied) return denied;
  const id = newEntityId(state);
  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    sx: player.sx | 0,
    sy: player.sy | 0,
    worldId: String(player.worldId || 'test'),
    x: player.x + 300,
    y: player.y,
    radius: 42,
    stats: createStatBlock({ maxHp: 5000, maxShield: 1000 }),
    resource: 'demo_dummy',
    resourceName: 'Cible blindée',
    color: { r: 120, g: 155, b: 180 },
    rot: 0,
    spin: 0,
    shapeSeed: id % 8,
    secret: false,
    respawnAt: 0,
    rarity: 'demo_dummy',
    diedAt: 0,
    killedById: 0,
    dropsSpawned: false,
    demoDummy: true,
    testSpawned: true
  });
  player.uiHint = 'Cible de test créée';
  player.uiHintTimer = 1.5;
  return { ok: true };
}

export function clearTestZone(state, player) {
  const denied = ensureTest(player);
  if (denied) return denied;
  const sameSector = (entity) => String(entity?.worldId || player.worldId || 'test') === String(player.worldId || 'test')
    && (entity?.sx | 0) === (player.sx | 0)
    && (entity?.sy | 0) === (player.sy | 0);
  for (const [id, structure] of state.structures) {
    if (!sameSector(structure)) continue;
    if ((structure.ownerId | 0) === (player.id | 0) || structure.transient) state.structures.delete(id);
  }
  for (const [id, mob] of state.mobs) if (sameSector(mob) && mob.testSpawned) state.mobs.delete(id);
  for (const [id, asteroid] of state.asteroids) if (sameSector(asteroid) && asteroid.testSpawned) state.asteroids.delete(id);
  for (const [id, projectile] of state.projectiles) if (sameSector(projectile)) state.projectiles.delete(id);
  player.forceFullUiSnapshot = true;
  player.uiHint = 'Zone de test nettoyée';
  player.uiHintTimer = 1.8;
  return { ok: true };
}

export function resetTestZone(state, player) {
  const result = clearTestZone(state, player);
  if (!result.ok) return result;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  giveTestResources(state, player, '', 80);
  player.uiHint = 'Zone réinitialisée — progression non persistante';
  player.uiHintTimer = 2.5;
  return { ok: true };
}
