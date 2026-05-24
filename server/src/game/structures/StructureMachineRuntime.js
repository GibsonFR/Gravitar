import { getStructureDef } from './StructureDefs.js';
import { getMachineRecipe } from '../../../../shared/content/crafting/MachineRecipes.js';

const MACHINE_SAVE_INTERVAL_MS = 5000;

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

function addRecipeOutput(structure, recipe, batches = 1) {
  const output = resourceMap(structure, 'output');
  for (const [key, amount] of recipeEntries(recipe.output)) {
    output[key] = (output[key] | 0) + (amount | 0) * batches;
  }
  cleanMap(output);
}

export function isMachineJobActive(structure) {
  const job = structure?.machineJob;
  return !!job && Number(job.remainingMs) > 0 && Number(job.totalMs) > 0;
}

export function getMachineActiveEnergyUse(structure) {
  if (!isMachineJobActive(structure)) return 0;
  const def = getStructureDef(structure.type);
  if (!def?.machineType) return 0;
  const recipe = getMachineRecipe(structure.machineJob.recipeId || structure.machineRecipeId || '');
  return Math.max(0, Number(recipe?.energyUse ?? def.energyUse) || 0);
}

export function updateMachineProcesses(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return false;
  const stepMs = Math.max(0, Number(dt) || 0) * 1000;
  if (stepMs <= 0) return false;
  let shouldSave = false;

  for (const st of state.structures.values()) {
    const def = getStructureDef(st?.type);
    if (!def?.machineType || !st.machineJob) continue;

    const job = st.machineJob;
    const recipe = getMachineRecipe(job.recipeId || st.machineRecipeId || '');
    if (!recipe || recipe.machineType !== def.machineType) {
      st.machineJob = null;
      st.updatedAt = timeMs;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
      continue;
    }

    if ((job.remainingMs | 0) <= 0) {
      st.machineJob = null;
      st.updatedAt = timeMs;
      continue;
    }

    if (!st.powered) {
      job.paused = true;
      continue;
    }

    job.paused = false;
    job.remainingMs = Math.max(0, Number(job.remainingMs) - stepMs);
    st.updatedAt = timeMs;

    if (job.remainingMs <= 0) {
      addRecipeOutput(st, recipe, Math.max(1, job.batches | 0 || 1));
      st.machineJob = null;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
    } else if (String(st.worldId || 'endless') === 'endless' && timeMs - (st.lastMachineSaveAt || 0) > MACHINE_SAVE_INTERVAL_MS) {
      st.lastMachineSaveAt = timeMs;
      shouldSave = true;
    }
  }

  if (shouldSave) state.structureStore?.saveFromState?.(state);
  return shouldSave;
}
