import { getStructureDef } from './StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect, findAliveCoreForStructure } from './StructureSystem.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { createNeutralCraftedEquipment } from '../../../../shared/content/equipment/EquipmentRoller.js';
import { addCustomEquipmentDef } from '../equipment/PlayerEquipmentDefs.js';
import { getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { EQUIPMENT_FABRICATOR_RECIPES, getEquipmentFabricatorRecipe } from '../../../../shared/content/equipment/EquipmentCraftingDefs.js';
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

function completed(player) {
  return Array.isArray(player?.research?.completed) ? player.research.completed : [];
}

function recipeSnapshot(player, recipe) {
  const base = getItemDef(recipe.baseItemId);
  const researchDone = isResearchCompleted(completed(player), recipe.researchId);
  const affordable = hasResources(player, recipe.input);
  return {
    id: recipe.id,
    baseItemId: recipe.baseItemId,
    name: recipe.name,
    categoryId: base?.categoryId || recipe.categoryId,
    categoryName: getItemCategoryName(base?.categoryId || recipe.categoryId),
    mark: recipe.mark | 0,
    description: `Objet neutre Mark ${recipe.mark | 0}. Aucun tag, aucun roll. Compatible avec la R&D.`,
    seconds: recipe.seconds | 0,
    input: Object.entries(recipe.input || {}).map(([key, amount]) => resourceEntry(key, amount | 0, player)),
    baseBonuses: base?.bonuses ? { ...base.bonuses } : {},
    locked: !researchDone,
    requiredResearchId: recipe.researchId || '',
    requiredResearchName: recipe.researchId ? getResearchName(recipe.researchId) : '',
    affordable,
    canCraft: !!base && researchDone && affordable
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
    lastCraftedItemId: player?.equipment?.lastCraftedItemId || '',
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
  const recipe = getEquipmentFabricatorRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'bad_recipe' };
  const snap = recipeSnapshot(player, recipe);
  if (snap.locked) return { ok: false, error: 'research_required' };
  if (!snap.affordable || !payResources(player, recipe.input)) return { ok: false, error: 'missing_resources' };

  player.equipment ??= {};
  if (!Array.isArray(player.equipment.ownedItemIds)) player.equipment.ownedItemIds = [];
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
  addCustomEquipmentDef(player, crafted);
  player.equipment.ownedItemIds = [...new Set([...player.equipment.ownedItemIds, crafted.id])].sort();
  player.equipment.lastCraftedItemId = crafted.id;
  player.equipment.lastChangedAt = timeMs | 0;
  player.forceFullUiSnapshot = true;
  player.hint = `Fabriqué : ${crafted.name}`;
  return { ok: true };
}
