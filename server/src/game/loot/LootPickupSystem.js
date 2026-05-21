import { distSq } from '../util/Math.js';
import { addResource, canAddResource } from '../inventory/InventorySystem.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { addRocketAmmo } from '../rocket/RocketAmmoRules.js';
import { hasOwnedItem, sortEquipmentIdsStable } from '../equipment/EquipmentRules.js';
import { queuePlayerSfx } from '../audio/PlayerSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

export function tryResolveLootPickup(state, loot) {
  if (loot.pickupImmunityLeft > 0) return false;

  let bestPlayer = null;
  let bestD2 = Infinity;
  const extra = loot.pickupPadding ?? 4;

  for (const p of state.players.values()) {
    if ((p.sx | 0) !== (loot.sx | 0) || (p.sy | 0) !== (loot.sy | 0)) continue;
    if (!p.inv) continue;
    if (loot.itemId) {
      const def = getItemDef(loot.itemId);
      if (!def) continue;
      if (def.categoryId !== ITEM_CATEGORY_IDS.AMMO && hasOwnedItem(p, def.id)) continue;
    } else if (!canAddResource(p.inv, loot.resource, loot.amount)) continue;

    const pickR = (loot.radius + p.radius + extra);
    const d2 = distSq(p.x, p.y, loot.x, loot.y);
    if (d2 > pickR * pickR) continue;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestPlayer = p;
    }
  }

  if (!bestPlayer) return false;

  if (loot.itemId) {
    const def = getItemDef(loot.itemId);
    if (!def) return false;
    if (def.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      addRocketAmmo(bestPlayer, def.id, Math.max(1, def.ammoProfile?.packSize | 0), state?.time?.currentMs || 0);
    } else if (!hasOwnedItem(bestPlayer, def.id)) {
      bestPlayer.equipment.ownedItemIds = sortEquipmentIdsStable([...(bestPlayer.equipment.ownedItemIds ?? []), def.id]);
      bestPlayer.equipment.lastChangedAt = state?.time?.currentMs || 0;
    }
    bestPlayer.uiHint = `${loot.bastionReward ? 'Coffre de bastion' : 'Loot'} : ${def.name}`;
    bestPlayer.uiHintTimer = 3.0;
  } else {
    addResource(bestPlayer.inv, loot.resource, loot.amount);
  }
  queuePlayerSfx(bestPlayer, SFX_EVENT_TYPES.COLLECT, (Math.random() * 6) | 0);
  return true;
}
