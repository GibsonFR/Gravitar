import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { EQUIPMENT_FABRICATOR_RECIPES, getEquipmentCraftRecipe } from '../../../../shared/content/equipment/EquipmentCraftingDefs.js';
import { getResearchName, isResearchCompleted } from '../../../../shared/content/research/ScienceResearchDefs.js';

const FABRICATOR_RANGE = 280;

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

function ownsItem(player, itemId) {
  return (player?.equipment?.ownedItemIds || []).includes(itemId);
}

function completed(player) {
  return Array.isArray(player?.research?.completed) ? player.research.completed : [];
}

function recipeSnapshot(player, recipe) {
  const item = getItemDef(recipe.itemId);
  const researchDone = isResearchCompleted(completed(player), recipe.researchId);
  const affordable = hasResources(player, recipe.input);
  const owned = ownsItem(player, recipe.itemId);
  return {
    id: recipe.id,
    itemId: recipe.itemId,
    name: item?.name || recipe.name,
    shortName: item?.shortName || item?.name || recipe.name,
    categoryId: item?.categoryId || recipe.categoryId,
    categoryName: getItemCategoryName(item?.categoryId || recipe.categoryId),
    tier: item?.tier || recipe.tier || 1,
    description: item?.description || '',
    seconds: recipe.seconds | 0,
    input: Object.entries(recipe.input || {}).map(([key, amount]) => resourceEntry(key, amount | 0, player)),
    bonuses: item?.bonuses ? { ...item.bonuses } : {},
    tags: (item?.tags || []).map((tag) => ({ ...tag })),
    owned,
    affordable,
    locked: !researchDone,
    requiredResearchId: recipe.researchId || '',
    requiredResearchName: recipe.researchId ? getResearchName(recipe.researchId) : '',
    canCraft: !!item && researchDone && affordable && !owned
  };
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
  return {
    id: st.id | 0,
    type: st.type,
    name: st.name || def?.name || 'Atelier d’équipement',
    powered: !!st.powered,
    energyUse: Number(def?.energyUse) || 0,
    baseEnergy: core?.energyState || null,
    recipes: EQUIPMENT_FABRICATOR_RECIPES.map((recipe) => recipeSnapshot(player, recipe))
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

export function craftEquipmentItem(state, player, structureId, recipeId, timeMs = Date.now()) {
  const st = state?.structures?.get?.(structureId | 0);
  if (!canAccess(state, player, st)) return { ok: false, error: 'access' };
  if (!st.powered) return { ok: false, error: 'no_power' };
  const recipe = getEquipmentCraftRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'bad_recipe' };
  const snap = recipeSnapshot(player, recipe);
  if (snap.locked) return { ok: false, error: 'research_required' };
  if (snap.owned) return { ok: false, error: 'already_owned' };
  if (!payResources(player, recipe.input)) return { ok: false, error: 'missing_resources' };

  player.equipment ??= {};
  if (!Array.isArray(player.equipment.ownedItemIds)) player.equipment.ownedItemIds = [];
  player.equipment.ownedItemIds = [...new Set([...player.equipment.ownedItemIds, recipe.itemId])].sort();
  player.equipment.lastChangedAt = timeMs | 0;
  player.forceFullUiSnapshot = true;
  player.hint = `Fabriqué : ${snap.name}`;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function findAccessibleEquipmentFabricatorNearPlayer(state, player) {
  let best = null;
  let bestD2 = Infinity;
  for (const st of state?.structures?.values?.() || []) {
    if (!isFabricator(st)) continue;
    if (!canAccess(state, player, st)) continue;
    const d2 = distanceSqToStructureRect(st, player.x || 0, player.y || 0);
    if (d2 < bestD2) { best = st; bestD2 = d2; }
  }
  return best;
}
