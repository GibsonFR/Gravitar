import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { addResource, removeResource, canAddResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { getMachineRecipe, getRecipesForMachine } from '../../../../shared/content/crafting/MachineRecipes.js';
import { getRecipeResearchRequirement, getResearchName, isRecipeUnlockedByResearch } from '../../../../shared/content/research/ScienceResearchDefs.js';
import { isMachineJobActive } from './StructureMachineRuntime.js';

const MACHINE_RANGE = 280;
const MACHINE_INPUT_CAPACITY = 160;
const MACHINE_OUTPUT_CAPACITY = 160;


function playerResearchCompleted(player) {
  return Array.isArray(player?.research?.completed) ? player.research.completed : [];
}

function recipeLockSnapshot(recipe, player) {
  const researchId = getRecipeResearchRequirement(recipe);
  if (!researchId || isRecipeUnlockedByResearch(recipe, playerResearchCompleted(player))) return { locked: false, requiredResearchId: '', requiredResearchName: '' };
  return { locked: true, requiredResearchId: researchId, requiredResearchName: getResearchName(researchId) };
}

function recipeUnlockedForPlayer(recipe, player) {
  return !recipeLockSnapshot(recipe, player).locked;
}

function isExtractorStructure(structure) {
  return String(structure?.type || '').toLowerCase() === 'mining_extractor';
}

export function isMachineStructure(structure) {
  const def = getStructureDef(structure?.type);
  return !!def?.machineType || isExtractorStructure(structure);
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

function getRecipeEnergyUse(structure, recipe) {
  const def = getStructureDef(structure?.type);
  return Math.max(0, Number(recipe?.energyUse ?? def?.energyUse ?? structure?.energyUse) || 0);
}

function canBaseStartRecipe(core, structure, recipe) {
  const need = getRecipeEnergyUse(structure, recipe);
  if (need <= 0) return true;
  const energy = core?.energyState || null;
  if (!energy) return false;
  const production = Number(energy.production) || 0;
  const surplus = Number(energy.surplus) || 0;
  return production > 0 && surplus >= need;
}

function buildExtractorSnapshot(state, player, st, def, core) {
  const resources = mapRows(st.storage?.resources || {});
  const selectedKey = st.depositResourceKey || resources[0]?.key || '';
  const resDef = RESOURCE_DEFS[selectedKey] || null;
  const powerLabel = st.machineEnabled === false ? 'Arrêté' : st.powered ? 'Alimenté' : 'Manque d’énergie';
  const statusMap = {
    no_deposit: 'Aucun gisement à portée de l’extracteur',
    no_power: 'Manque d’énergie',
    buffer_full: 'Buffer plein',
    disabled: 'Arrêté',
    blocked: 'Sortie bloquée',
    no_output: 'Sortie absente'
  };
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def.name || 'Extracteur minier',
    machineType: 'extractor',
    powered: !!st.powered,
    enabled: st.machineEnabled !== false,
    energyUse: Number(def.energyUse) || 0,
    baseCoreId: core?.id | 0 || 0,
    baseEnergy: core?.energyState || null,
    depositId: st.depositId | 0 || 0,
    depositResourceKey: selectedKey,
    depositLabel: st.depositLabel || resDef?.name || selectedKey || '—',
    extractionProgress: Math.max(0, Math.min(1, Number(st.extractionProgress || st.automationItem?.progress || 0))),
    automationStatus: st.automationStatus || '',
    statusLabel: statusMap[st.automationStatus] || powerLabel,
    output: resources,
    outputUsed: usedCapacity(st.storage?.resources || {}),
    outputCapacity: Number(st.storage?.capacity ?? def.storageCapacity) || 8,
    input: [],
    recipes: [],
    selectedRecipe: null,
    selectedRecipeId: '',
    canProduce: false,
    canRun: !!st.powered && st.machineEnabled !== false && !!selectedKey
  };
}

function buildJobSnapshot(st) {
  const job = st?.machineJob || null;
  if (!job || Number(job.totalMs) <= 0) return null;
  const totalMs = Math.max(1, Number(job.totalMs) || 1);
  const remainingMs = Math.max(0, Number(job.remainingMs) || 0);
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  return {
    recipeId: job.recipeId || '',
    batches: Math.max(1, job.batches | 0 || 1),
    totalMs: Math.round(totalMs),
    remainingMs: Math.round(remainingMs),
    elapsedMs: Math.round(elapsedMs),
    totalSeconds: Math.round(totalMs / 100) / 10,
    remainingSeconds: Math.round(remainingMs / 100) / 10,
    progress: Math.max(0, Math.min(1, elapsedMs / totalMs)),
    active: remainingMs > 0,
    paused: !!job.paused
  };
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
  if (isExtractorStructure(st)) return buildExtractorSnapshot(state, player, st, def, core);
  const allRecipes = getRecipesForMachine(def.machineType);
  const recipes = allRecipes.map((recipe) => {
    const lock = recipeLockSnapshot(recipe, player);
    return {
      id: recipe.id,
      name: recipe.name,
      seconds: Number(recipe.seconds) || 0,
      energyUse: getRecipeEnergyUse(st, recipe),
      input: recipeEntries(recipe.input).map(([key, amount]) => ({ ...resourceEntry(key, amount | 0), have: player?.inv?.resources?.[key] | 0 })),
      output: recipeEntries(recipe.output).map(([key, amount]) => resourceEntry(key, amount | 0)),
      ...lock
    };
  });
  const firstUnlockedRecipe = allRecipes.find((recipe) => recipeUnlockedForPlayer(recipe, player));
  const currentRecipe = getMachineRecipe(st.machineRecipeId);
  if (!currentRecipe || !recipeUnlockedForPlayer(currentRecipe, player)) st.machineRecipeId = firstUnlockedRecipe?.id || '';
  const selectedRecipe = getMachineRecipe(st.machineRecipeId) || firstUnlockedRecipe || null;
  const input = resourceMap(st, 'input');
  const output = resourceMap(st, 'output');
  const job = buildJobSnapshot(st);
  const selectedLock = selectedRecipe ? recipeLockSnapshot(selectedRecipe, player) : { locked: false, requiredResearchId: '', requiredResearchName: '' };
  const canRun = !!selectedRecipe
    && !selectedLock.locked
    && canBaseStartRecipe(core, st, selectedRecipe)
    && hasMachineInputs(st, selectedRecipe, 1)
    && canFitMachineOutput(st, selectedRecipe, 1);
  const canProduce = canRun && !job?.active;
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def.name || 'Machine',
    machineType: def.machineType,
    powered: !!st.powered,
    enabled: st.machineEnabled !== false,
    energyUse: Number(def.energyUse) || 0,
    baseCoreId: core?.id | 0 || 0,
    baseEnergy: core?.energyState || null,
    selectedRecipeId: selectedRecipe?.id || '',
    selectedRecipe: selectedRecipe ? {
      id: selectedRecipe.id,
      name: selectedRecipe.name,
      seconds: Number(selectedRecipe.seconds) || 0,
      energyUse: getRecipeEnergyUse(st, selectedRecipe),
      input: recipeEntries(selectedRecipe.input).map(([key, amount]) => resourceEntry(key, amount | 0, { stored: input[key] | 0, have: player?.inv?.resources?.[key] | 0 })),
      output: recipeEntries(selectedRecipe.output).map(([key, amount]) => resourceEntry(key, amount | 0)),
      canProduce,
      canRun,
      ...selectedLock
    } : null,
    recipes,
    input: mapRows(input),
    output: mapRows(output),
    cargoResources: selectedRecipe ? relevantCargoRows(player, selectedRecipe) : [],
    inputUsed: usedCapacity(input),
    inputCapacity: MACHINE_INPUT_CAPACITY,
    outputUsed: usedCapacity(output),
    outputCapacity: MACHINE_OUTPUT_CAPACITY,
    job,
    canProduce,
    canRun
  };
}

export function selectMachineRecipe(state, player, structureId, recipeId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return { ok: false, error: 'machine_locked' };
  if (isMachineJobActive(st)) return { ok: false, error: 'machine_busy' };
  const def = getStructureDef(st.type);
  const recipe = getMachineRecipe(recipeId);
  if (!recipe || recipe.machineType !== def.machineType) return { ok: false, error: 'bad_recipe' };
  if (!recipeUnlockedForPlayer(recipe, player)) return { ok: false, error: 'research_required' };
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
  if (isExtractorStructure(st)) {
    if (direction !== 'withdraw') return { ok: false, error: 'extractor_output_only' };
    const map = st.storage?.resources || {};
    const take = Math.min(map[key] | 0, n);
    if (take <= 0 || !canAddResource(player.inv, key, take)) return { ok: false, error: 'cannot_withdraw' };
    map[key] = (map[key] | 0) - take;
    addResource(player.inv, key, take);
    cleanMap(map);
    st.updatedAt = timeMs;
    player.forceFullUiSnapshot = true;
    if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
    return { ok: true };
  }
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
  if (!recipeUnlockedForPlayer(recipe, player)) return { ok: false, error: 'research_required' };
  st.machineRecipeId = recipe.id;
  st.machineEnabled = true;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function toggleMachine(state, player, structureId, enabled = null, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessMachine(state, player, st)) return { ok: false, error: 'machine_locked' };
  const next = enabled === null || enabled === undefined ? !(st.machineEnabled !== false) : !!enabled;
  st.machineEnabled = next;
  if (!next && st.machineJob) st.machineJob.paused = true;
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
