import { PLAYER_EQUIPMENT_RULES } from '../../../../shared/content/items/ItemDefs.js';

export function createInventoryState() {
  return {
    credits: PLAYER_EQUIPMENT_RULES.starterCredits || 0,
    cargoMax: 60,
    cargoUsed: 0,
    resources: {}
  };
}
