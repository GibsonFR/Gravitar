import { getStructureDef } from './StructureDefs.js';
import { getMachineRecipe, isRecipeAllowedForLabSpecialization } from '../../../../shared/content/crafting/MachineRecipes.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

const MACHINE_SAVE_INTERVAL_MS = 5000;
const MACHINE_INPUT_CAPACITY = 160;
const MACHINE_OUTPUT_CAPACITY = 160;

function recipeEntries(obj) {
  return Object.entries(obj || {}).filter(([, amount]) => (amount | 0) > 0);
}

function resourceMap(structure, slot) {
  const key = slot === 'output' ? 'machineOutput' : 'machineInput';
  if (!structure[key] || typeof structure[key] !== 'object') structure[key] = {};
  return structure[key];
}

function cleanMap(resources = {}) {
  for (const key of Object.keys(resources || {})) {
    if ((resources[key] | 0) <= 0) delete resources[key];
  }
  return resources;
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

function canFitRecipeOutput(structure, recipe) {
  const output = resourceMap(structure, 'output');
  let used = usedCapacity(output);
  for (const [key, amount] of recipeEntries(recipe.output)) {
    const def = RESOURCE_DEFS[key];
    used += (Number(def?.cargoPerUnit) || 1) * (amount | 0);
  }
  return used <= MACHINE_OUTPUT_CAPACITY;
}

function hasRecipeInputs(structure, recipe) {
  const input = resourceMap(structure, 'input');
  for (const [key, amount] of recipeEntries(recipe.input)) {
    if ((input[key] | 0) < (amount | 0)) return false;
  }
  return true;
}

function consumeRecipeInputs(structure, recipe) {
  const input = resourceMap(structure, 'input');
  for (const [key, amount] of recipeEntries(recipe.input)) {
    input[key] = (input[key] | 0) - (amount | 0);
  }
  cleanMap(input);
}

function addRecipeOutput(structure, recipe) {
  const output = resourceMap(structure, 'output');
  const produced = [];
  for (const [key, amount] of recipeEntries(recipe.output)) {
    const n = amount | 0;
    output[key] = (output[key] | 0) + n;
    if (n > 0) produced.push({ key, amount: n });
  }
  cleanMap(output);
  structure.lastMachineProduced = {
    recipeId: recipe?.id || '',
    at: Date.now(),
    output: produced
  };
}

export function isMachineJobActive(structure) {
  const job = structure?.machineJob;
  return !!job && Number(job.remainingMs) > 0 && Number(job.totalMs) > 0;
}

export function getMachineActiveEnergyUse(structure) {
  if (!isMachineJobActive(structure)) return 0;
  if (structure.machineEnabled === false) return 0;
  const def = getStructureDef(structure.type);
  if (!def?.machineType) return 0;
  const recipe = getMachineRecipe(structure.machineJob.recipeId || structure.machineRecipeId || '');
  return Math.max(0, Number(recipe?.energyUse ?? def.energyUse) || 0);
}

function getSelectedRecipe(structure) {
  const def = getStructureDef(structure?.type);
  if (!def?.machineType) return null;
  const recipe = getMachineRecipe(structure.machineRecipeId || '');
  if (!recipe || recipe.machineType !== def.machineType || !isRecipeAllowedForLabSpecialization(recipe, def.labSpecialization)) return null;
  return recipe;
}

function canStartNextJob(structure, recipe) {
  if (!structure?.machineEnabled) return false;
  if (!recipe) return false;
  if (isMachineJobActive(structure)) return false;
  if (!structure.powered) return false;
  if (!hasRecipeInputs(structure, recipe)) return false;
  if (!canFitRecipeOutput(structure, recipe)) return false;
  return true;
}

function startNextJob(state, structure, recipe, timeMs) {
  consumeRecipeInputs(structure, recipe);
  const totalMs = Math.max(250, Math.round((Number(recipe.seconds) || 1) * 1000));
  structure.machineJob = {
    recipeId: recipe.id,
    batches: 1,
    totalMs,
    remainingMs: totalMs,
    startedAt: timeMs,
    paused: false
  };
  structure.updatedAt = timeMs;
  queueWorldSfx(state, SFX_EVENT_TYPES.MACHINE_START, structure.sx, structure.sy, structure.x, structure.y, structure.id | 0);
  return true;
}

export function updateMachineProcesses(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return false;
  const stepMs = Math.max(0, Number(dt) || 0) * 1000;
  if (stepMs <= 0) return false;
  let shouldSave = false;

  for (const st of state.structures.values()) {
    const def = getStructureDef(st?.type);
    if (!def?.machineType) continue;

    let recipe = getSelectedRecipe(st);
    if (!recipe && st.machineRecipeId) {
      st.machineRecipeId = '';
      st.machineJob = null;
      st.updatedAt = timeMs;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
      continue;
    }

    if (!isMachineJobActive(st) && canStartNextJob(st, recipe)) {
      startNextJob(state, st, recipe, timeMs);
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
    }

    if (!st.machineJob) continue;

    const job = st.machineJob;
    recipe = getMachineRecipe(job.recipeId || st.machineRecipeId || '');
    if (!recipe || recipe.machineType !== def.machineType || !isRecipeAllowedForLabSpecialization(recipe, def.labSpecialization)) {
      st.machineJob = null;
      st.updatedAt = timeMs;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
      continue;
    }

    if (Number(job.remainingMs) <= 0) {
      if (canFitRecipeOutput(st, recipe)) addRecipeOutput(st, recipe);
      queueWorldSfx(state, SFX_EVENT_TYPES.MACHINE_COMPLETE, st.sx, st.sy, st.x, st.y, st.id | 0);
      st.machineJob = null;
      st.updatedAt = timeMs;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
      const nextRecipe = getSelectedRecipe(st);
      if (canStartNextJob(st, nextRecipe)) startNextJob(state, st, nextRecipe, timeMs);
      continue;
    }

    if (st.machineEnabled === false || !st.powered) {
      job.paused = true;
      continue;
    }

    job.paused = false;
    job.remainingMs = Math.max(0, Number(job.remainingMs) - stepMs);
    st.updatedAt = timeMs;

    if (job.remainingMs <= 0) {
      addRecipeOutput(st, recipe);
      queueWorldSfx(state, SFX_EVENT_TYPES.MACHINE_COMPLETE, st.sx, st.sy, st.x, st.y, st.id | 0);
      st.machineJob = null;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
      const nextRecipe = getSelectedRecipe(st);
      if (canStartNextJob(st, nextRecipe)) {
        startNextJob(state, st, nextRecipe, timeMs);
      }
    } else if (String(st.worldId || 'endless') === 'endless' && timeMs - (st.lastMachineSaveAt || 0) > MACHINE_SAVE_INTERVAL_MS) {
      st.lastMachineSaveAt = timeMs;
      shouldSave = true;
    }
  }

  if (shouldSave) state.structureStore?.saveFromState?.(state);
  return shouldSave;
}
