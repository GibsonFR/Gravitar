import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getPlayerItemDef, pruneMissingCustomEquipmentDefs } from './PlayerEquipmentDefs.js';
import { buildEquippedCountByCategory } from './EquipmentBonuses.js';


function setConverterEnabled(player, itemId, enabled) {
  const table = player?.equipment?.converterEnabledById ?? (player.equipment.converterEnabledById = {});
  table[itemId] = !!enabled;
}

export function isConverterEnabled(player, itemId) {
  const def = getPlayerItemDef(player, itemId);
  if (!def || def.categoryId !== ITEM_CATEGORY_IDS.CONVERTER) return false;
  if (!isItemEquipped(player, itemId)) return false;
  const table = player?.equipment?.converterEnabledById ?? {};
  return table[itemId] !== false;
}

export function setConverterEnabledExplicit(player, itemId, enabled, timeMs = 0) {
  const def = getPlayerItemDef(player, itemId);
  if (!def || def.categoryId !== ITEM_CATEGORY_IDS.CONVERTER) return false;
  if (!isItemEquipped(player, itemId)) return false;
  setConverterEnabled(player, itemId, !!enabled);
  const runtime = player?.equipment?.converterRuntimeById?.[itemId];
  if (runtime) {
    runtime.enabled = !!enabled;
    if (enabled) {
      runtime.blockedReason = runtime.blockedReason === 'disabled' ? '' : (runtime.blockedReason || 'running');
      runtime.blockedLabel = runtime.blockedLabel === 'coupé' ? 'actif' : (runtime.blockedLabel || 'actif');
    } else {
      runtime.blockedReason = 'disabled';
      runtime.blockedLabel = 'coupé';
    }
  }
  player.equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function toggleConverterEnabled(player, itemId, timeMs = 0) {
  const def = getPlayerItemDef(player, itemId);
  if (!def || def.categoryId !== ITEM_CATEGORY_IDS.CONVERTER) return false;
  if (!isItemEquipped(player, itemId)) return false;
  const next = !isConverterEnabled(player, itemId);
  return setConverterEnabledExplicit(player, itemId, next, timeMs);
}

export function hasOwnedItem(player, itemId) {
  return (player?.equipment?.ownedItemIds ?? []).includes(itemId)
    || (player?.equipment?.equippedItemIds ?? []).includes(itemId);
}

export function isItemEquipped(player, itemId) {
  return (player?.equipment?.equippedItemIds ?? []).includes(itemId);
}

export function canEquipItem(player, itemId) {
  const def = getPlayerItemDef(player, itemId);
  if (!def) return { ok: false, reason: 'item_unknown' };
  if (!hasOwnedItem(player, itemId)) return { ok: false, reason: 'item_not_owned' };
  if (isItemEquipped(player, itemId)) return { ok: false, reason: 'item_already_equipped' };

  const counts = buildEquippedCountByCategory(player);
  const caps = player?.equipment?.slotCaps ?? {};
  const cap = Math.max(0, caps[def.categoryId] ?? 0);
  const cur = Math.max(0, counts[def.categoryId] ?? 0);
  if (cur >= cap) {
    return { ok: false, reason: `category_full:${def.categoryId}` };
  }

  return { ok: true, def };
}

export function canUnequipItem(player, itemId) {
  if (!isItemEquipped(player, itemId)) return { ok: false, reason: 'item_not_equipped' };
  return { ok: true };
}

export function equipOwnedItem(player, itemId, timeMs = 0) {
  const check = canEquipItem(player, itemId);
  if (!check.ok) return false;
  player.equipment.equippedItemIds = [...player.equipment.equippedItemIds, itemId];
  if (check.def?.categoryId === ITEM_CATEGORY_IDS.CONVERTER) setConverterEnabled(player, itemId, true);
  player.equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function unequipOwnedItem(player, itemId, timeMs = 0) {
  const check = canUnequipItem(player, itemId);
  if (!check.ok) return false;
  player.equipment.ownedItemIds = [...new Set([...(player.equipment.ownedItemIds || []), itemId])];
  player.equipment.equippedItemIds = player.equipment.equippedItemIds.filter((id) => id !== itemId);
  const def = getPlayerItemDef(player, itemId);
  if (def?.categoryId === ITEM_CATEGORY_IDS.CONVERTER) setConverterEnabled(player, itemId, false);
  player.equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function sortEquipmentIdsStable(itemIds) {
  return [...new Set(itemIds)].sort((a, b) => a.localeCompare(b));
}


export function removeOwnedItem(player, itemId, timeMs = 0) {
  if (!hasOwnedItem(player, itemId)) return false;
  if (isItemEquipped(player, itemId)) return false;
  player.equipment.ownedItemIds = player.equipment.ownedItemIds.filter((id) => id !== itemId);
  pruneMissingCustomEquipmentDefs(player);
  player.equipment.lastChangedAt = timeMs | 0;
  return true;
}


export function repairEquipmentOwnership(player, timeMs = 0) {
  if (!player?.equipment) return false;
  const before = (player.equipment.ownedItemIds || []).length;
  player.equipment.ownedItemIds = [...new Set([
    ...(player.equipment.ownedItemIds || []),
    ...(player.equipment.equippedItemIds || [])
  ])].sort();
  const changed = player.equipment.ownedItemIds.length !== before;
  if (changed) player.equipment.lastChangedAt = timeMs | 0;
  return changed;
}
