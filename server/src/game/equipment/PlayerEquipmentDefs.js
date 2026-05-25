import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';

export function ensureCustomEquipmentDefs(player) {
  const eq = player?.equipment ?? (player.equipment = {});
  if (!eq.customItemDefs || typeof eq.customItemDefs !== 'object') eq.customItemDefs = {};
  return eq.customItemDefs;
}

export function getPlayerItemDef(player, itemId) {
  const id = String(itemId || '');
  const exact = player?.equipment?.customItemDefs?.[id] || getItemDef(id) || null;
  if (exact) return exact;
  const lower = id.toLowerCase();
  const key = Object.keys(player?.equipment?.customItemDefs || {}).find((candidate) => String(candidate || '').toLowerCase() === lower);
  return key ? player.equipment.customItemDefs[key] : null;
}

export function addCustomEquipmentDef(player, def) {
  if (!def?.id) return false;
  const table = ensureCustomEquipmentDefs(player);
  table[def.id] = JSON.parse(JSON.stringify(def));
  return true;
}

export function pruneMissingCustomEquipmentDefs(player) {
  const table = ensureCustomEquipmentDefs(player);
  const owned = new Set([...(player?.equipment?.ownedItemIds || []), ...(player?.equipment?.equippedItemIds || [])]);
  for (const id of Object.keys(table)) if (!owned.has(id)) delete table[id];
}


export function canonicalizePlayerItemId(player, itemId) {
  const id = String(itemId || '');
  if (!id) return '';
  if (player?.equipment?.customItemDefs?.[id] || getItemDef(id)) return id;
  const lower = id.toLowerCase();
  const all = [
    ...Object.keys(player?.equipment?.customItemDefs || {}),
    ...(player?.equipment?.ownedItemIds || []),
    ...(player?.equipment?.equippedItemIds || [])
  ];
  const found = all.find((candidate) => String(candidate || '').toLowerCase() === lower);
  return found || id;
}
