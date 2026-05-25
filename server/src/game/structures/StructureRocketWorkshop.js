import { getStructureDef, STRUCTURE_TYPES } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { addResource, removeResource, canAddResource } from '../inventory/InventorySystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { addRocketAmmo } from '../rocket/RocketAmmoRules.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { ROCKET_WORKSHOP_RECIPE } from '../../../../shared/content/rockets/RocketWorkshopDefs.js';

const WORKSHOP_RANGE = 280;
const INPUT_CAPACITY = 180;
const OUTPUT_CAPACITY = 120;
const SAVE_INTERVAL_MS = 5000;

function inputMap(st) {
  if (!st.rocketWorkshopInput || typeof st.rocketWorkshopInput !== 'object') st.rocketWorkshopInput = {};
  return st.rocketWorkshopInput;
}

function outputMap(st) {
  if (!st.rocketWorkshopOutput || typeof st.rocketWorkshopOutput !== 'object') st.rocketWorkshopOutput = {};
  return st.rocketWorkshopOutput;
}

function cleanMap(map = {}) {
  for (const key of Object.keys(map || {})) if ((map[key] | 0) <= 0) delete map[key];
  return map;
}

function recipeEntries(obj) {
  return Object.entries(obj || {}).filter(([, amount]) => (amount | 0) > 0);
}

function resourceEntry(key, amount, extra = {}) {
  const def = RESOURCE_DEFS[key] || null;
  return { key, name: def?.name || key, amount: amount | 0, colorHex: def?.colorHex || '#ffffff', ...extra };
}

function usedResourceCapacity(resources = {}) {
  let used = 0;
  for (const [key, amount] of Object.entries(resources || {})) {
    const n = amount | 0;
    if (n <= 0) continue;
    const def = RESOURCE_DEFS[key];
    used += (Number(def?.cargoPerUnit) || 1) * n;
  }
  return used;
}

function canFitInput(st, key, amount) {
  const def = RESOURCE_DEFS[key];
  const per = Number(def?.cargoPerUnit) || 1;
  return usedResourceCapacity(inputMap(st)) + per * Math.max(0, amount | 0) <= INPUT_CAPACITY;
}

function outputUsed(st) {
  let used = 0;
  for (const amount of Object.values(outputMap(st))) used += Math.max(0, amount | 0);
  return used;
}

function canFitOutput(st) {
  return outputUsed(st) + Math.max(1, ROCKET_WORKSHOP_RECIPE.ammoOutput.amount | 0) <= OUTPUT_CAPACITY;
}

function hasInputs(st) {
  const input = inputMap(st);
  for (const [key, amount] of recipeEntries(ROCKET_WORKSHOP_RECIPE.input)) {
    if ((input[key] | 0) < (amount | 0)) return false;
  }
  return true;
}

function consumeInputs(st) {
  const input = inputMap(st);
  for (const [key, amount] of recipeEntries(ROCKET_WORKSHOP_RECIPE.input)) input[key] = (input[key] | 0) - (amount | 0);
  cleanMap(input);
}

function addAmmoOutput(st, timeMs) {
  const out = outputMap(st);
  const { itemId, amount } = ROCKET_WORKSHOP_RECIPE.ammoOutput;
  const n = Math.max(1, amount | 0);
  out[itemId] = (out[itemId] | 0) + n;
  st.lastRocketWorkshopProduced = { itemId, amount: n, at: timeMs };
}

function isWorkshop(st) {
  return String(st?.type || '') === STRUCTURE_TYPES.ROCKET_WORKSHOP;
}

export function canPlayerAccessRocketWorkshop(state, player, st) {
  if (!player || !st || !isWorkshop(st)) return false;
  if (String(player.worldId || 'endless') !== String(st.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (st.sx | 0) || (player.sy | 0) !== (st.sy | 0)) return false;
  if (!isStructureOwner(player, st)) return false;
  return distanceSqToStructureRect(st, player.x || 0, player.y || 0) <= WORKSHOP_RANGE * WORKSHOP_RANGE;
}

function buildJobSnapshot(st) {
  const job = st?.rocketWorkshopJob || null;
  if (!job || Number(job.totalMs) <= 0) return null;
  const totalMs = Math.max(1, Number(job.totalMs) || 1);
  const remainingMs = Math.max(0, Number(job.remainingMs) || 0);
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  return {
    recipeId: ROCKET_WORKSHOP_RECIPE.id,
    totalMs: Math.round(totalMs),
    remainingMs: Math.round(remainingMs),
    totalSeconds: Math.round(totalMs / 100) / 10,
    remainingSeconds: Math.round(remainingMs / 100) / 10,
    progress: Math.max(0, Math.min(1, elapsedMs / totalMs)),
    active: remainingMs > 0,
    paused: !!job.paused
  };
}

function outputRows(st) {
  return Object.entries(outputMap(st)).filter(([, amount]) => (amount | 0) > 0).map(([itemId, amount]) => {
    const def = getItemDef(itemId) || null;
    return {
      itemId,
      name: def?.name || itemId,
      shortName: def?.shortName || def?.name || itemId,
      amount: amount | 0,
      tier: Math.max(1, def?.tier | 0),
      summary: def?.ammoProfile?.summary || '',
      damage: Math.round(def?.ammoProfile?.damage || 0),
      splashRadius: Math.round(def?.ammoProfile?.splashRadius || 0)
    };
  });
}

export function buildRocketWorkshopSnapshot(state, player) {
  const id = player?.openRocketWorkshopId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessRocketWorkshop(state, player, st)) {
    if (player) player.openRocketWorkshopId = 0;
    return null;
  }
  const def = getStructureDef(st.type);
  const core = findAliveCoreForStructure(state, st);
  const input = inputMap(st);
  const job = buildJobSnapshot(st);
  const canRun = st.rocketWorkshopEnabled !== false && !!st.powered && hasInputs(st) && canFitOutput(st) && !job?.active;
  const previewOutput = outputRows({ rocketWorkshopOutput: { [ROCKET_WORKSHOP_RECIPE.ammoOutput.itemId]: ROCKET_WORKSHOP_RECIPE.ammoOutput.amount } })[0] || null;
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def?.name || 'Atelier de roquettes',
    powered: !!st.powered,
    enabled: st.rocketWorkshopEnabled !== false,
    energyUse: Number(ROCKET_WORKSHOP_RECIPE.energyUse || def?.energyUse) || 0,
    baseCoreId: core?.id | 0 || 0,
    baseEnergy: core?.energyState || null,
    recipe: {
      id: ROCKET_WORKSHOP_RECIPE.id,
      name: ROCKET_WORKSHOP_RECIPE.name,
      seconds: ROCKET_WORKSHOP_RECIPE.seconds | 0,
      energyUse: ROCKET_WORKSHOP_RECIPE.energyUse | 0,
      input: recipeEntries(ROCKET_WORKSHOP_RECIPE.input).map(([key, amount]) => resourceEntry(key, amount | 0, { stored: input[key] | 0, have: player?.inv?.resources?.[key] | 0 })),
      ammoOutput: previewOutput,
      description: ROCKET_WORKSHOP_RECIPE.description
    },
    input: Object.entries(cleanMap(input)).map(([key, amount]) => resourceEntry(key, amount | 0)),
    cargoResources: recipeEntries(ROCKET_WORKSHOP_RECIPE.input)
      .map(([key]) => resourceEntry(key, player?.inv?.resources?.[key] | 0))
      .filter((entry) => entry.amount > 0),
    inputUsed: usedResourceCapacity(input),
    inputCapacity: INPUT_CAPACITY,
    output: outputRows(st),
    outputUsed: outputUsed(st),
    outputCapacity: OUTPUT_CAPACITY,
    job,
    canRun,
    lastProduced: st.lastRocketWorkshopProduced || null
  };
}

export function openRocketWorkshop(state, player, structureId) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessRocketWorkshop(state, player, st)) return { ok: false };
  player.openRocketWorkshopId = st.id | 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeRocketWorkshop(player) {
  if (!player) return false;
  player.openRocketWorkshopId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function transferRocketWorkshopResource(state, player, structureId, resourceKey, direction = 'deposit', amount = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessRocketWorkshop(state, player, st)) return { ok: false };
  const key = String(resourceKey || '');
  if (!RESOURCE_DEFS[key]) return { ok: false };
  const n = Math.max(1, Math.min(9999, amount | 0 || 1));
  const input = inputMap(st);
  if (direction === 'withdraw') {
    const take = Math.min(input[key] | 0, n);
    if (take <= 0 || !canAddResource(player.inv, key, take)) return { ok: false };
    input[key] = (input[key] | 0) - take;
    addResource(player.inv, key, take);
  } else {
    const take = Math.min(player?.inv?.resources?.[key] | 0, n);
    let fit = take;
    while (fit > 0 && !canFitInput(st, key, fit)) fit -= 1;
    if (fit <= 0) return { ok: false };
    const removed = removeResource(player.inv, key, fit);
    if (removed <= 0) return { ok: false };
    input[key] = (input[key] | 0) + removed;
  }
  cleanMap(input);
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function claimRocketWorkshopAmmo(state, player, structureId, itemId = '', amount = 9999, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessRocketWorkshop(state, player, st)) return { ok: false };
  const key = String(itemId || ROCKET_WORKSHOP_RECIPE.ammoOutput.itemId).toLowerCase();
  const out = outputMap(st);
  const take = Math.min(out[key] | 0, Math.max(1, amount | 0 || 9999));
  if (take <= 0) return { ok: false };
  if (!addRocketAmmo(player, key, take, timeMs)) return { ok: false };
  out[key] = (out[key] | 0) - take;
  cleanMap(out);
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function startRocketWorkshop(state, player, structureId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessRocketWorkshop(state, player, st)) return { ok: false };
  st.rocketWorkshopEnabled = true;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function toggleRocketWorkshop(state, player, structureId, enabled = null, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canPlayerAccessRocketWorkshop(state, player, st)) return { ok: false };
  const next = enabled === null || enabled === undefined ? !(st.rocketWorkshopEnabled !== false) : !!enabled;
  st.rocketWorkshopEnabled = next;
  if (!next && st.rocketWorkshopJob) st.rocketWorkshopJob.paused = true;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function getRocketWorkshopActiveEnergyUse(st) {
  if (!isWorkshop(st)) return 0;
  const job = st.rocketWorkshopJob || null;
  if (!job || Number(job.remainingMs) <= 0 || st.rocketWorkshopEnabled === false) return 0;
  return Math.max(0, Number(ROCKET_WORKSHOP_RECIPE.energyUse) || 0);
}

function canStart(st) {
  if (!isWorkshop(st)) return false;
  if (st.rocketWorkshopEnabled === false) return false;
  if (st.rocketWorkshopJob && Number(st.rocketWorkshopJob.remainingMs) > 0) return false;
  if (!st.powered) return false;
  if (!hasInputs(st)) return false;
  if (!canFitOutput(st)) return false;
  return true;
}

function startJob(st, timeMs) {
  consumeInputs(st);
  const totalMs = Math.max(250, Math.round((Number(ROCKET_WORKSHOP_RECIPE.seconds) || 1) * 1000));
  st.rocketWorkshopJob = { recipeId: ROCKET_WORKSHOP_RECIPE.id, totalMs, remainingMs: totalMs, startedAt: timeMs, paused: false };
  st.updatedAt = timeMs;
  return true;
}

export function updateRocketWorkshops(state, dt, timeMs = Date.now()) {
  if (!state?.structures) return false;
  const stepMs = Math.max(0, Number(dt) || 0) * 1000;
  if (stepMs <= 0) return false;
  let shouldSave = false;
  for (const st of state.structures.values()) {
    if (!isWorkshop(st)) continue;
    if (!st.rocketWorkshopJob && canStart(st)) {
      startJob(st, timeMs);
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
    }
    const job = st.rocketWorkshopJob || null;
    if (!job) continue;
    if (st.rocketWorkshopEnabled === false || !st.powered) {
      job.paused = true;
      continue;
    }
    job.paused = false;
    job.remainingMs = Math.max(0, Number(job.remainingMs) - stepMs);
    st.updatedAt = timeMs;
    if (job.remainingMs <= 0) {
      if (canFitOutput(st)) addAmmoOutput(st, timeMs);
      st.rocketWorkshopJob = null;
      shouldSave ||= String(st.worldId || 'endless') === 'endless';
      if (canStart(st)) startJob(st, timeMs);
    } else if (String(st.worldId || 'endless') === 'endless' && timeMs - (st.lastRocketWorkshopSaveAt || 0) > SAVE_INTERVAL_MS) {
      st.lastRocketWorkshopSaveAt = timeMs;
      shouldSave = true;
    }
  }
  if (shouldSave) state.structureStore?.saveFromState?.(state);
  return shouldSave;
}
