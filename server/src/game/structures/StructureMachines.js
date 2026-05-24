import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { addResource, removeResource, canAddResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { getMachineRecipe, getRecipesForMachine } from '../../../../shared/content/crafting/MachineRecipes.js';

const MACHINE_RANGE = 280;

export function isMachineStructure(structure) {
  const def = getStructureDef(structure?.type);
  return !!def?.machineType;
}

function recipeEntries(obj) {
  return Object.entries(obj || {}).filter(([, amount]) => (amount | 0) > 0);
}

function resourceEntry(key, amount) {
  const def = RESOURCE_DEFS[key] || null;
  return {
    key,
    name: def?.name || key,
    amount: amount | 0,
    colorHex: def?.colorHex || '#ffffff'
  };
}

function hasInputs(player, recipe, batches = 1) {
  for (const [key, amount] of recipeEntries(recipe.input)) {
    if ((player?.inv?.resources?.[key] | 0) < (amount | 0) * batches) return false;
  }
  return true;
}

function canFitOutputs(player, recipe, batches = 1) {
  for (const [key, amount] of recipeEntries(recipe.output)) {
    if (!canAddResource(player.inv, key, (amount | 0) * batches)) return false;
  }
  return true;
}

export function canPlayerAccessMachine(state, player, structure) {
  if (!player || !structure || !isMachineStructure(structure)) return false;
  if (String(player.worldId || 'endless') !== String(structure.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (structure.sx | 0) || (player.sy | 0) !== (structure.sy | 0)) return false;
  if (!isStructureOwner(player, structure)) return false;
  const d2 = distanceSqToStructureRect(structure, player.x || 0, player.y || 0);
  return d2 <= MACHINE_RANGE * MACHINE_RANGE;
}

export function buildMachineSnapshot(state, player) {
  const id = player?.openMachineId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessMachine(state, player, st)) {
    if (player) player.openMachineId = 0;
    return null;
  }
  const def = getStructureDef(st.type);
  const core = findAliveCoreForStructure(state, st);
  const recipes = getRecipesForMachine(def.machineType).map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description || '',
    seconds: Number(recipe.seconds) || 0,
    energyUse: Number(recipe.energyUse ?? def.energyUse ?? 0) || 0,
    input: recipeEntries(recipe.input).map(([key, amount]) => ({ ...resourceEntry(key, amount | 0), have: player?.inv?.resources?.[key] | 0 })),
    output: recipeEntries(recipe.output).map(([key, amount]) => resourceEntry(key, amount | 0)),
    canCraft: hasInputs(player, recipe, 1) && canFitOutputs(player, recipe, 1) && !!st.powered
  }));
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def.name || 'Machine',
    machineType: def.machineType,
    powered: !!st.powered,
    energyUse: Number(def.energyUse) || 0,
    baseCoreId: core?.id | 0 || 0,
    baseEnergy: core?.energyState || null,
    recipes
  };
}

export function processMachineRecipe(state, player, structureId, recipeId, batches = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return { ok: false, error: 'machine_locked' };
  const def = getStructureDef(st.type);
  const recipe = getMachineRecipe(recipeId);
  if (!recipe || recipe.machineType !== def.machineType) return { ok: false, error: 'bad_recipe' };
  const count = Math.max(1, Math.min(10, batches | 0 || 1));
  if (!st.powered) return { ok: false, error: 'no_power' };
  if (!hasInputs(player, recipe, count)) return { ok: false, error: 'missing_input' };
  if (!canFitOutputs(player, recipe, count)) return { ok: false, error: 'cargo_full' };
  for (const [key, amount] of recipeEntries(recipe.input)) {
    const moved = removeResource(player.inv, key, (amount | 0) * count);
    if (moved !== (amount | 0) * count) return { ok: false, error: 'missing_input' };
  }
  for (const [key, amount] of recipeEntries(recipe.output)) {
    addResource(player.inv, key, (amount | 0) * count);
  }
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function findAccessibleMachineNearPlayer(state, player) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of state?.structures?.values?.() || []) {
    if (!isMachineStructure(st)) continue;
    if (!canPlayerAccessMachine(state, player, st)) continue;
    const d2 = distanceSqToStructureRect(st, player.x || 0, player.y || 0);
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}
