import { ITEM_TAG_ORDER } from '../../../../shared/content/items/ItemTagIds.js';
import { getItemTagDef } from '../../../../shared/content/items/ItemTagDefs.js';
import { getEquippedEquipmentDefs } from './EquipmentBonuses.js';

export function buildEquippedTagState(player) {
  const totals = new Map();

  for (const def of getEquippedEquipmentDefs(player)) {
    for (const tag of def.tags ?? []) {
      if (!tag?.tagId) continue;
      totals.set(tag.tagId, (totals.get(tag.tagId) || 0) + Math.max(0, tag.points | 0));
    }
  }

  return ITEM_TAG_ORDER.map((tagId) => {
    const def = getItemTagDef(tagId);
    const points = totals.get(tagId) || 0;
    return {
      tagId,
      name: def?.name || tagId,
      short: def?.short || tagId.slice(0, 3).toUpperCase(),
      colorHex: def?.colorHex || '#d0d7e4',
      points,
      stage: points >= 6 ? 3 : points >= 4 ? 2 : points >= 2 ? 1 : 0,
      active: points >= 2
    };
  });
}
