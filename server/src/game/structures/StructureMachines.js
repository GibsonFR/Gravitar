import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { addResource, removeResource, canAddResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { getMachineRecipe, getRecipesForMachine } from '../../../../shared/content/crafting/MachineRecipes.js';

const MACHINE_RANGE = 280;
const MACHINE_INPUT_CAPACITY = 160;
const MACHINE_OUTPUT_CAPACITY = 160;

export function isMachineStructure(structure) {
  const def = getStructureDef(structure?.type);
  return !!def?.machineType;
}

function resourceMap(structure, slot) {
  const key = slot === 'output' ? 'machineOutput' : 'machineInput';
  if (!structure[key] || typeof structure[key] !== 'object') structure[key] = {};
  return structure[key];
}

function recipeEntries(obj) {
  return Object.entries(obj || {}).filter(([, amount]) => (amount | 0) > 0);
}

function resourceEntry(key, amount, extra = {}) {
  const def = RESOURCE_DEFS[key] || null;
  return {
    key,
    name: def?.name || key,
    amount: amount | 0,
    colorHex: def?.colorHex || '#ffffff',
    ...extra
  };
}

function usedCapacity(resources = {}) {
  let used = 0;
  for (const [key, amount] of Object.entries(resources || {})) {
    const n = amount | 0;
    if (n <= 0) continue;
    const def = RESOURCE_DEFS[key];
    used += (Number(def?.cargoPerUnit) || 1) * n;
  }
  return used;
}

function canFitMachineOutput(structure, recipe, batches = 1) {
  const output = resourceMap(structure, 'output');
  let used = usedCapacity(output);
  for (const [key, amount] of recipeEntries(recipe.output)) {
    const def = RESOURCE_DEFS[key];
    used += (Number(def?.cargoPerUnit) || 1) * (amount | 0) * batches;
  }
  return used <= MACHINE_OUTPUT_CAPACITY;
}

function hasMachineInputs(structure, recipe, batches = 1) {
  const input = resourceMap(structure, 'input');
  for (const [key, amount] of recipeEntries(recipe.input)) {
    if ((input[key] | 0) < (amount | 0) * batches) return false;
  }
  return true;
}

function cleanMap(resources = {}) {
  for (const key of Object.keys(resources || {})) {
    if ((resources[key] | 0) <= 0) delete resources[key];
  }
  return resources;
}

function mapRows(resources = {}) {
  return Object.entries(cleanMap(resources || {}))
    .filter(([, amount]) => (amount | 0) > 0)
    .map(([key, amount]) => resourceEntry(key, amount | 0));
}

function relevantCargoRows(player, recipe) {
  const wanted = new Set(recipeEntries(recipe?.input || {}).map(([key]) => key));
  return Object.entries(player?.inv?.resources || {})
    .filter(([key, amount]) => wanted.has(key) && (amount | 0) > 0)
    .map(([key, amount]) => resourceEntry(key, amount | 0));
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
    output: recipeEntries(recipe.output).map(([key, amount]) => resourceEntry(key, amount | 0))
  }));
  if (!st.machineRecipeId && recipes[0]?.id) st.machineRecipeId = recipes[0].id;
  const selectedRecipe = getMachineRecipe(st.machineRecipeId) || getMachineRecipe(recipes[0]?.id || '');
  const input = resourceMap(st, 'input');
  const output = resourceMap(st, 'output');
  const canProduce = !!selectedRecipe && !!st.powered && hasMachineInputs(st, selectedRecipe, 1) && canFitMachineOutput(st, selectedRecipe, 1);
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def.name || 'Machine',
    machineType: def.machineType,
    powered: !!st.powered,
    energyUse: Number(def.energyUse) || 0,
    baseCoreId: core?.id | 0 || 0,
    baseEnergy: core?.energyState || null,
    selectedRecipeId: selectedRecipe?.id || '',
    selectedRecipe: selectedRecipe ? {
      id: selectedRecipe.id,
      name: selectedRecipe.name,
      description: selectedRecipe.description || '',
      seconds: Number(selectedRecipe.seconds) || 0,
      energyUse: Number(selectedRecipe.energyUse ?? def.energyUse ?? 0) || 0,
      input: recipeEntries(selectedRecipe.input).map(([key, amount]) => resourceEntry(key, amount | 0, { stored: input[key] | 0, have: player?.inv?.resources?.[key] | 0 })),
      output: recipeEntries(selectedRecipe.output).map(([key, amount]) => resourceEntry(key, amount | 0)),
      canProduce
    } : null,
    recipes,
    input: mapRows(input),
    output: mapRows(output),
    cargoResources: selectedRecipe ? relevantCargoRows(player, selectedRecipe) : [],
    inputUsed: usedCapacity(input),
    inputCapacity: MACHINE_INPUT_CAPACITY,
    outputUsed: usedCapacity(output),
    outputCapacity: MACHINE_OUTPUT_CAPACITY,
    canProduce
  };
}

export function selectMachineRecipe(state, player, structureId, recipeId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return { ok: false, error: 'machine_locked' };
  const def = getStructureDef(st.type);
  const recipe = getMachineRecipe(recipeId);
  if (!recipe || recipe.machineType !== def.machineType) return { ok: false, error: 'bad_recipe' };
  st.machineRecipeId = recipe.id;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function transferMachineResource(state, player, structureId, resourceKey, direction = 'deposit', slot = 'input', amount = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return { ok: false, error: 'machine_locked' };
  const key = String(resourceKey || '');
  if (!RESOURCE_DEFS[key]) return { ok: false, error: 'bad_resource' };
  const n = Math.max(1, Math.min(9999, amount | 0 || 1));
  const map = resourceMap(st, slot === 'output' ? 'output' : 'input');
  if (direction === 'withdraw') {
    const take = Math.min(map[key] | 0, n);
    if (take <= 0 || !canAddResource(player.inv, key, take)) return { ok: false, error: 'cannot_withdraw' };
    map[key] = (map[key] | 0) - take;
    addResource(player.inv, key, take);
  } else {
    if (slot === 'output') return { ok: false, error: 'bad_slot' };
    const take = Math.min(player?.inv?.resources?.[key] | 0, n);
    const capLeft = MACHINE_INPUT_CAPACITY - usedCapacity(map);
    const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
    const fit = Math.max(0, Math.floor(capLeft / per));
    const moved = Math.min(take, fit);
    if (moved <= 0) return { ok: false, error: 'cannot_deposit' };
    const removed = removeResource(player.inv, key, moved);
    if (removed <= 0) return { ok: false, error: 'cannot_deposit' };
    map[key] = (map[key] | 0) + removed;
  }
  cleanMap(map);
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function processMachineRecipe(state, player, structureId, recipeId = '', batches = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return { ok: false, error: 'machine_locked' };
  const def = getStructureDef(st.type);
  const recipe = getMachineRecipe(recipeId || st.machineRecipeId || '');
  if (!recipe || recipe.machineType !== def.machineType) return { ok: false, error: 'bad_recipe' };
  const count = Math.max(1, Math.min(10, batches | 0 || 1));
  if (!st.powered) return { ok: false, error: 'no_power' };
  if (!hasMachineInputs(st, recipe, count)) return { ok: false, error: 'missing_input' };
  if (!canFitMachineOutput(st, recipe, count)) return { ok: false, error: 'output_full' };
  const input = resourceMap(st, 'input');
  const output = resourceMap(st, 'output');
  for (const [key, amount] of recipeEntries(recipe.input)) {
    input[key] = (input[key] | 0) - (amount | 0) * count;
  }
  for (const [key, amount] of recipeEntries(recipe.output)) {
    output[key] = (output[key] | 0) + (amount | 0) * count;
  }
  cleanMap(input);
  cleanMap(output);
  st.machineRecipeId = recipe.id;
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
