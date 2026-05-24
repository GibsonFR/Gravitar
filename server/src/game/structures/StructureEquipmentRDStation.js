import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { getPlayerItemDef, addCustomEquipmentDef } from '../equipment/PlayerEquipmentDefs.js';
import { getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { EQUIPMENT_RD_PROGRAMS, getEquipmentRDProgram } from '../../../../shared/content/equipment/EquipmentCraftingDefs.js';
import { rollRDEquipment } from '../../../../shared/content/equipment/EquipmentRoller.js';
import { getResearchName, isResearchCompleted } from '../../../../shared/content/research/ScienceResearchDefs.js';

const RD_RANGE = 280;

function isRDStation(st) {
  return String(st?.type || '').toLowerCase() === 'equipment_rd_station';
}

function canAccess(state, player, st) {
  if (!player || !isRDStation(st)) return false;
  if (String(player.worldId || 'endless') !== String(st.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (st.sx | 0) || (player.sy | 0) !== (st.sy | 0)) return false;
  if (!isStructureOwner(player, st)) return false;
  return distanceSqToStructureRect(st, player.x || 0, player.y || 0) <= RD_RANGE * RD_RANGE;
}

function completed(player) {
  return Array.isArray(player?.research?.completed) ? player.research.completed : [];
}

function hasResources(player, input = {}) {
  for (const [key, amount] of Object.entries(input || {})) {
    if ((player?.inv?.resources?.[key] | 0) < (amount | 0)) return false;
  }
  return true;
}

function payResources(player, input = {}) {
  if (!hasResources(player, input)) return false;
  for (const [key, amount] of Object.entries(input || {})) removeResource(player.inv, key, amount | 0);
  return true;
}

function resourceEntry(key, amount, player) {
  const def = RESOURCE_DEFS[key] || null;
  const have = Math.max(0, player?.inv?.resources?.[key] | 0);
  return {
    key,
    name: def?.name || key,
    amount: amount | 0,
    have,
    missing: Math.max(0, (amount | 0) - have),
    colorHex: def?.colorHex || '#ffffff'
  };
}

function ownedNeutralItems(player) {
  const ids = Array.isArray(player?.equipment?.ownedItemIds) ? player.equipment.ownedItemIds : [];
  return ids.map((id) => getPlayerItemDef(player, id)).filter((def) => def?.neutralBase && !def?.rdEnhanced);
}

function itemSnapshot(def) {
  return {
    itemId: def.id,
    name: def.name,
    shortName: def.shortName || def.name,
    categoryId: def.categoryId,
    categoryName: getItemCategoryName(def.categoryId),
    tier: def.tier || 1,
    mark: def.mark || 1,
    bonuses: def.bonuses || {},
    description: def.description || ''
  };
}

function programSnapshot(player, program) {
  const unlocked = isResearchCompleted(completed(player), program.requiresResearchId);
  return {
    id: program.id,
    name: program.name,
    description: program.description || '',
    seconds: program.seconds | 0,
    qualityBoost: program.qualityBoost | 0,
    maxSciencePacks: program.maxSciencePacks | 0,
    input: Object.entries(program.scienceInput || {}).map(([key, amount]) => resourceEntry(key, amount | 0, player)),
    locked: !unlocked,
    requiredResearchId: program.requiresResearchId || '',
    requiredResearchName: program.requiresResearchId ? getResearchName(program.requiresResearchId) : '',
    affordable: hasResources(player, program.scienceInput || {}),
    canStart: unlocked && hasResources(player, program.scienceInput || {})
  };
}

function activeJobSnapshot(st) {
  const job = st?.rdJob || null;
  if (!job?.itemDef) return null;
  const total = Math.max(1, job.totalMs | 0);
  const remaining = Math.max(0, job.remainingMs | 0);
  return {
    itemName: job.itemDef.name || '',
    programId: job.programId || '',
    programName: getEquipmentRDProgram(job.programId)?.name || '',
    progress: Math.max(0, Math.min(1, 1 - remaining / total)),
    remainingMs: remaining,
    totalMs: total
  };
}

export function buildEquipmentRDStationSnapshot(state, player) {
  const id = player?.openEquipmentRDStationId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canAccess(state, player, st)) {
    player.openEquipmentRDStationId = 0;
    return null;
  }
  const def = getStructureDef(st.type);
  const core = findAliveCoreForStructure(state, st);
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def?.name || 'Station R&D',
    powered: !!st.powered,
    energyUse: Number(def?.energyUse) || 0,
    baseEnergy: core?.energyState || null,
    activeJob: activeJobSnapshot(st),
    neutralItems: ownedNeutralItems(player).map(itemSnapshot),
    programs: EQUIPMENT_RD_PROGRAMS.map((program) => programSnapshot(player, program)),
    lastCraftedItemId: player?.equipment?.lastCraftedItemId || ''
  };
}

export function openEquipmentRDStation(state, player, structureId) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  player.openEquipmentRDStationId = st.id | 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeEquipmentRDStation(player) {
  if (!player) return false;
  player.openEquipmentRDStationId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function startEquipmentRDJob(state, player, structureId, itemId, programId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  if (!st.powered) return { ok: false, error: 'no_power' };
  if (st.rdJob?.itemDef) return { ok: false, error: 'busy' };
  const item = getPlayerItemDef(player, itemId);
  if (!item?.neutralBase || item.rdEnhanced) return { ok: false, error: 'bad_item' };
  const program = getEquipmentRDProgram(programId);
  if (!program) return { ok: false, error: 'bad_program' };
  if (program.requiresResearchId && !isResearchCompleted(completed(player), program.requiresResearchId)) return { ok: false, error: 'research_required' };
  if (!payResources(player, program.scienceInput || {})) return { ok: false, error: 'missing_resources' };

  player.equipment.ownedItemIds = (player.equipment.ownedItemIds || []).filter((id) => id !== item.id);
  player.equipment.equippedItemIds = (player.equipment.equippedItemIds || []).filter((id) => id !== item.id);
  st.rdJob = {
    itemDef: JSON.parse(JSON.stringify(item)),
    ownerId: player.id | 0,
    ownerKey: player.accountKey || player.pseudo || player.id || '',
    programId: program.id,
    qualityBoost: program.qualityBoost | 0,
    startedAt: timeMs,
    totalMs: Math.max(1000, (program.seconds | 0) * 1000),
    remainingMs: Math.max(1000, (program.seconds | 0) * 1000)
  };
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function cancelEquipmentRDJob(state, player, structureId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  const job = st.rdJob;
  if (!job?.itemDef) return { ok: false, error: 'empty' };
  player.equipment.ownedItemIds = [...new Set([...(player.equipment.ownedItemIds || []), job.itemDef.id])].sort();
  st.rdJob = null;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function updateEquipmentRDStations(state, timeMs, dtMs) {
  if (!state?.structures) return false;
  let changed = false;
  const stepMs = Math.max(0, Number(dtMs) || 0);
  for (const st of state.structures.values()) {
    if (!isRDStation(st)) continue;
    const job = st.rdJob;
    if (!job?.itemDef) continue;
    if (!st.powered) continue;
    job.remainingMs = Math.max(0, (job.remainingMs | 0) - stepMs);
    st.updatedAt = timeMs;
    if (job.remainingMs > 0) continue;
    const owner = [...(state.players?.values?.() || [])].find((p) => (p.id | 0) === (job.ownerId | 0) && String(p.worldId || 'endless') === String(st.worldId || 'endless'));
    if (owner) {
      owner.equipment ??= {};
      if (!Array.isArray(owner.equipment.ownedItemIds)) owner.equipment.ownedItemIds = [];
      owner.equipment.craftedItemCounter = Math.max(0, owner.equipment.craftedItemCounter | 0) + 1;
      const crafted = rollRDEquipment({
        neutralItemDef: job.itemDef,
        programId: job.programId,
        ownerKey: job.ownerKey || owner.accountKey || owner.pseudo || owner.id || '',
        craftedIndex: owner.equipment.craftedItemCounter,
        timeMs,
        qualityBoost: job.qualityBoost | 0
      });
      if (crafted) {
        addCustomEquipmentDef(owner, crafted);
        owner.equipment.ownedItemIds = [...new Set([...owner.equipment.ownedItemIds, crafted.id])].sort();
        owner.equipment.lastCraftedItemId = crafted.id;
        owner.equipment.lastChangedAt = timeMs | 0;
        owner.forceFullUiSnapshot = true;
        owner.hint = `R&D terminée : ${crafted.name}`;
      }
    }
    st.rdJob = null;
    changed = true;
  }
  if (changed) state.structureStore?.saveFromState?.(state);
  return changed;
}
