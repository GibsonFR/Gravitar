import { getStructureDef, STRUCTURE_TYPES } from './StructureDefs.js';
import { canPlayerRepairStructure, distanceSqToStructureRect } from './StructureSystem.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';

function ownerKey(player) {
  return String(player.accountKey || player.accountName || player.pseudo || `guest-${player.id | 0}`).toLowerCase();
}

function isTestPlayer(player) {
  return String(player.gameMode || '').toLowerCase().includes('test') || String(player.worldId || '').toLowerCase().startsWith('test');
}

function repairDistanceOk(player, structure) {
  return distanceSqToStructureRect(structure, player.x || 0, player.y || 0) <= 1400 * 1400;
}

export function getRepairCost(structure) {
  const def = getStructureDef(structure?.type);
  const baseCost = def?.cost || {};
  const hp = Math.max(0, Number(structure?.stats?.hp) || 0);
  const maxHp = Math.max(1, Number(structure?.stats?.maxHp) || def?.maxHp || 1);
  const missingRatio = Math.max(0, Math.min(1, (maxHp - hp) / maxHp));
  const cost = {};
  for (const [key, amount] of Object.entries(baseCost)) {
    if (!RESOURCE_DEFS[key]) continue;
    const need = Math.ceil(Math.max(0, Number(amount) || 0) * missingRatio);
    if (need > 0) cost[key] = need;
  }
  return cost;
}

function hasResources(inv, cost) {
  for (const [key, amount] of Object.entries(cost || {})) {
    if (!RESOURCE_DEFS[key]) return false;
    if ((inv?.resources?.[key] || 0) < (amount | 0)) return false;
  }
  return true;
}

function payResources(inv, cost) {
  for (const [key, amount] of Object.entries(cost || {})) removeResource(inv, key, amount | 0);
}

export function repairStructure(state, player, structureId, timeMs = Date.now()) {
  const id = Number(structureId) | 0;
  if (!id) return { ok: false, error: 'invalid_structure' };
  const st = state.structures?.get?.(id);
  if (!st) return { ok: false, error: 'not_found' };
  if (st.type === STRUCTURE_TYPES.BASE_CORE) return { ok: false, error: 'core_cannot_repair' };
  if (String(st.worldId || 'endless') !== String(player.worldId || 'endless')) return { ok: false, error: 'wrong_world' };
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return { ok: false, error: 'wrong_sector' };
  const owned = String(st.worldId || 'endless') === 'endless'
    ? String(st.ownerKey || '').toLowerCase() === ownerKey(player)
    : (st.ownerId | 0) === (player.id | 0);
  if (!owned) return { ok: false, error: 'not_owner' };
  if (!canPlayerRepairStructure(player, st)) return { ok: false, error: 'not_damaged' };
  if (!repairDistanceOk(player, st)) return { ok: false, error: 'too_far' };
  const cost = getRepairCost(st);
  if (!isTestPlayer(player) && !hasResources(player.inv, cost)) return { ok: false, error: 'missing_resources', cost };
  if (!isTestPlayer(player)) payResources(player.inv, cost);
  st.stats.hp = Math.max(1, Number(st.stats.maxHp) || 1);
  st.updatedAt = timeMs;
  if (!isTestPlayer(player) && String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true, structure: st, cost };
}
