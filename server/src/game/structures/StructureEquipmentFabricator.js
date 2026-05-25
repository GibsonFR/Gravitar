import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { addResource, canAddResource, removeResource } from '../inventory/InventorySystem.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { createNeutralCraftedEquipment, getNeutralBaseBonuses } from '../../../../shared/content/equipment/EquipmentRoller.js';
import { addCustomEquipmentDef } from '../equipment/PlayerEquipmentDefs.js';
import { getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { EQUIPMENT_FABRICATOR_RECIPES, getEquipmentFabricatorRecipe } from '../../../../shared/content/equipment/EquipmentCraftingDefs.js';
import { getRecipeResearchRequirement, getResearchName, isResearchCompleted } from '../../../../shared/content/research/ScienceResearchDefs.js';

const FABRICATOR_RANGE = 280;
const FABRICATOR_INPUT_CAPACITY = 96;
const FABRICATOR_OUTPUT_CAPACITY = 16;

function isFabricator(st) {
  return String(st?.type || '').toLowerCase() === 'equipment_fabricator';
}

function canAccess(state, player, st) {
  if (!player || !isFabricator(st)) return false;
  if (String(player.worldId || 'endless') !== String(st.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (st.sx | 0) || (player.sy | 0) !== (st.sy | 0)) return false;
  if (!isStructureOwner(player, st)) return false;
  return distanceSqToStructureRect(st, player.x || 0, player.y || 0) <= FABRICATOR_RANGE * FABRICATOR_RANGE;
}

function clean(map = {}) {
  for (const key of Object.keys(map)) if ((map[key] | 0) <= 0) delete map[key];
  return map;
}

function usedCapacity(map = {}) {
  let total = 0;
  for (const [key, amount] of Object.entries(map || {})) {
    total += (Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1) * (amount | 0);
  }
  return total;
}

function inputMap(st) {
  if (!st.machineInput || typeof st.machineInput !== 'object') st.machineInput = {};
  return st.machineInput;
}

function outputItems(st) {
  if (!Array.isArray(st.equipmentOutputItems)) st.equipmentOutputItems = [];
  return st.equipmentOutputItems;
}

function resourceEntry(key, amount, player, stored = 0) {
  const def = RESOURCE_DEFS[key] || null;
  const have = Math.max(0, player?.inv?.resources?.[key] | 0);
  return {
    key,
    name: def?.name || key,
    amount: amount | 0,
    have,
    stored: stored | 0,
    missing: Math.max(0, (amount | 0) - (stored | 0)),
    colorHex: def?.colorHex || '#ffffff'
  };
}

function mapRows(map = {}) {
  return Object.entries(clean(map || {}))
    .filter(([, amount]) => (amount | 0) > 0)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, amount]) => ({
      key,
      amount: amount | 0,
      name: RESOURCE_DEFS[key]?.name || key,
      colorHex: RESOURCE_DEFS[key]?.colorHex || '#fff'
    }));
}

function hasBufferedResources(st, input = {}) {
  const map = inputMap(st);
  for (const [key, amount] of Object.entries(input || {})) {
    if ((map[key] | 0) < (amount | 0)) return false;
  }
  return true;
}

function consumeBufferedResources(st, input = {}) {
  if (!hasBufferedResources(st, input)) return false;
  const map = inputMap(st);
  for (const [key, amount] of Object.entries(input || {})) map[key] = (map[key] | 0) - (amount | 0);
  clean(map);
  return true;
}

function completed(player) {
  return Array.isArray(player?.research?.completed) ? player.research.completed : [];
}

function scalePreviewLauncherProfile(baseProfile = {}, mark = 1) {
  const m = Math.max(1, Math.min(5, mark | 0));
  const volleyByMark = [0, 1, 1, 2, 2, 3];
  const damageMultByMark = [0, 1.00, 1.13, 1.28, 1.48, 1.72];
  const cooldownByMark = [0, 4.4, 4.0, 4.7, 4.25, 5.1];
  const energyByMark = [0, 7, 8, 11, 13, 17];
  const rangeByMark = [0, 1500, 1580, 1660, 1760, 1880];
  const splashByMark = [0, 88, 94, 100, 108, 118];
  const dispersionByMark = [0, 0, 0, 5, 4, 7];
  return {
    ...baseProfile,
    volley: volleyByMark[m],
    damageMult: damageMultByMark[m],
    cooldown: cooldownByMark[m],
    energyCost: energyByMark[m],
    range: rangeByMark[m],
    splashRadius: splashByMark[m],
    dispersionDeg: dispersionByMark[m],
    projectileSpeed: Math.round((baseProfile.projectileSpeed || 980) * (1 + (m - 1) * 0.035))
  };
}

function recipeSnapshot(player, recipe, st = null) {
  const base = getItemDef(recipe.baseItemId);
  const requiredResearchId = getRecipeResearchRequirement(recipe.id) || recipe.researchId || '';
  const researchDone = isResearchCompleted(completed(player), requiredResearchId);
  const map = st ? inputMap(st) : {};
  const buffered = hasBufferedResources(st || { machineInput: {} }, recipe.input);
  const outputFree = !st || outputItems(st).length < FABRICATOR_OUTPUT_CAPACITY;
  return {
    id: recipe.id,
    baseItemId: recipe.baseItemId,
    name: recipe.name,
    categoryId: base?.categoryId || recipe.categoryId,
    categoryName: getItemCategoryName(base?.categoryId || recipe.categoryId),
    mark: recipe.mark | 0,
    description: '',
    seconds: recipe.seconds | 0,
    input: Object.entries(recipe.input || {}).map(([key, amount]) => resourceEntry(key, amount | 0, player, map[key] | 0)),
    baseBonuses: getNeutralBaseBonuses(recipe.baseItemId, recipe.mark),
    launcherProfile: base?.categoryId === 'launcher' ? scalePreviewLauncherProfile(base.launcherProfile || {}, recipe.mark) : null,
    locked: !researchDone,
    requiredResearchId,
    requiredResearchName: requiredResearchId ? getResearchName(requiredResearchId) : '',
    affordable: buffered,
    outputFree,
    canCraft: !!base && researchDone && buffered && outputFree
  };
}

function equipmentOutputSnapshot(player, st) {
  return outputItems(st).map((def) => ({
    itemId: def.id,
    name: def.name,
    shortName: def.shortName || def.name,
    categoryId: def.categoryId,
    categoryName: getItemCategoryName(def.categoryId),
    mark: def.mark || 1,
    neutralBase: !!def.neutralBase,
    bonuses: { ...(def.bonuses || {}) },
    launcherProfile: def.launcherProfile || null
  }));
}

export function buildEquipmentFabricatorSnapshot(state, player) {
  const id = player?.openEquipmentFabricatorId | 0;
  if (!id) return null;
  const st = state?.structures?.get?.(id);
  if (!canAccess(state, player, st)) {
    player.openEquipmentFabricatorId = 0;
    return null;
  }
  const def = getStructureDef(st.type);
  const core = findAliveCoreForStructure(state, st);
  const map = inputMap(st);
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def?.name || 'Atelier d’équipement',
    powered: !!st.powered,
    energyUse: Number(def?.energyUse) || 0,
    baseEnergy: core?.energyState || null,
    lastCraftedItemId: player?.equipment?.lastCraftedItemId || '',
    input: mapRows(map),
    inputUsed: usedCapacity(map),
    inputCapacity: FABRICATOR_INPUT_CAPACITY,
    outputItems: equipmentOutputSnapshot(player, st),
    outputUsed: outputItems(st).length,
    outputCapacity: FABRICATOR_OUTPUT_CAPACITY,
    recipes: EQUIPMENT_FABRICATOR_RECIPES.map((recipe) => recipeSnapshot(player, recipe, st))
  };
}

export function openEquipmentFabricator(state, player, structureId) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  player.openEquipmentFabricatorId = st.id | 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeEquipmentFabricator(player) {
  if (!player) return false;
  player.openEquipmentFabricatorId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}

export function transferEquipmentFabricatorResource(state, player, structureId, resourceKey, direction = 'deposit', amount = 1, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  const key = String(resourceKey || '');
  if (!RESOURCE_DEFS[key]) return { ok: false, error: 'bad_resource' };
  const n = Math.max(1, Math.min(9999, amount | 0 || 1));
  const map = inputMap(st);
  if (direction === 'withdraw') {
    const take = Math.min(map[key] | 0, n);
    if (take <= 0 || !canAddResource(player.inv, key, take)) return { ok: false, error: 'empty' };
    map[key] = (map[key] | 0) - take;
    clean(map);
    addResource(player.inv, key, take);
  } else {
    const per = Number(RESOURCE_DEFS[key]?.cargoPerUnit) || 1;
    const free = Math.max(0, FABRICATOR_INPUT_CAPACITY - usedCapacity(map));
    const maxByCapacity = Math.floor(free / per);
    const put = Math.min(player.inv?.resources?.[key] | 0, n, maxByCapacity);
    if (put <= 0) return { ok: false, error: 'full' };
    removeResource(player.inv, key, put);
    map[key] = (map[key] | 0) + put;
  }
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function claimEquipmentFabricatorOutput(state, player, structureId, itemId = '', timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  const list = outputItems(st);
  const wanted = String(itemId || '');
  const idx = wanted ? list.findIndex((it) => it.id === wanted) : 0;
  if (idx < 0) return { ok: false, error: 'empty' };
  const [item] = list.splice(idx, 1);
  player.equipment ??= {};
  if (!Array.isArray(player.equipment.ownedItemIds)) player.equipment.ownedItemIds = [];
  addCustomEquipmentDef(player, item);
  player.equipment.ownedItemIds = [...new Set([...player.equipment.ownedItemIds, item.id])].sort();
  player.equipment.lastCraftedItemId = item.id;
  player.equipment.lastChangedAt = timeMs | 0;
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function craftEquipmentItem(state, player, structureId, recipeId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  if (!st.powered) return { ok: false, error: 'no_power' };
  const recipe = getEquipmentFabricatorRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'bad_recipe' };
  const snap = recipeSnapshot(player, recipe, st);
  if (snap.locked) return { ok: false, error: 'research_required' };
  if (!snap.affordable || !consumeBufferedResources(st, recipe.input)) return { ok: false, error: 'missing_resources' };
  if (outputItems(st).length >= FABRICATOR_OUTPUT_CAPACITY) return { ok: false, error: 'output_full' };

  player.equipment ??= {};
  player.equipment.craftedItemCounter = Math.max(0, player.equipment.craftedItemCounter | 0) + 1;
  const crafted = createNeutralCraftedEquipment({
    baseItemId: recipe.baseItemId,
    recipeId: recipe.id,
    recipeName: recipe.name,
    mark: recipe.mark,
    ownerKey: player.accountKey || player.pseudo || player.id || '',
    craftedIndex: player.equipment.craftedItemCounter,
    timeMs
  });
  if (!crafted) return { ok: false, error: 'craft_failed' };
  outputItems(st).push(crafted);
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  player.hint = `Sortie atelier : ${crafted.name}`;
  state.structureStore?.saveFromState?.(state);
  return { ok: true };
}
