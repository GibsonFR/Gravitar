import { distSq } from '../util/Math.js';
import { addResource, canAddResource } from '../inventory/InventorySystem.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { addRocketAmmo } from '../rocket/RocketAmmoRules.js';
import { hasOwnedItem, sortEquipmentIdsStable } from '../equipment/EquipmentRules.js';
import { queuePlayerSfx } from '../audio/PlayerSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

function getPickupPose(player, timeMs) {
  const pose = { x: Number(player.x || 0), y: Number(player.y || 0), sx: player.sx | 0, sy: player.sy | 0, source: 'server' };
  const hx = Number(player.lastClientHintX);
  const hy = Number(player.lastClientHintY);
  const hsx = player.lastClientHintSx | 0;
  const hsy = player.lastClientHintSy | 0;
  const hintAt = Number(player.lastClientHintAt || 0);
  if (!Number.isFinite(hx) || !Number.isFinite(hy) || !hintAt) return pose;
  if ((timeMs || 0) - hintAt > 260) return pose;
  if (hsx !== (player.sx | 0) || hsy !== (player.sy | 0)) return pose;
  const d = Math.hypot(hx - pose.x, hy - pose.y);
  if (d > 560) return pose;
  return { x: hx, y: hy, sx: hsx, sy: hsy, source: 'client_hint' };
}

export function tryResolveLootPickup(state, loot) {
  if (loot.pickupImmunityLeft > 0) return false;

  let bestPlayer = null;
  let bestD2 = Infinity;
  const extra = loot.pickupPadding ?? 4;

  const timeMs = state?.time?.currentMs || Date.now();

  for (const p of state.players.values()) {
    const pickupPose = getPickupPose(p, timeMs);
    if ((pickupPose.sx | 0) !== (loot.sx | 0) || (pickupPose.sy | 0) !== (loot.sy | 0)) continue;
    if (!p.inv) continue;
    let pickedResourceKey = '';
  let pickedItemId = '';

  if (loot.itemId) {
      const def = getItemDef(loot.itemId);
      if (!def) continue;
      if (def.categoryId !== ITEM_CATEGORY_IDS.AMMO && hasOwnedItem(p, def.id)) continue;
    } else if (!canAddResource(p.inv, loot.resource, loot.amount)) continue;

    // Net V2 pickup policy: once a loot is in the same sector and the player has
    // capacity, the server may validate it. The client can render magnet/orb
    // movement freely, but cargo is confirmed by this authoritative same-sector
    // pickup. This removes the mismatch where the orb follows visually but the
    // server still thinks it is at its original drop position.
    const d2 = distSq(pickupPose.x, pickupPose.y, loot.x, loot.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestPlayer = p;
    }
  }

  if (!bestPlayer) return false;

  let pickedResourceKey = '';
  let pickedItemId = '';

  if (loot.itemId) {
    const def = getItemDef(loot.itemId);
    if (!def) return false;
    pickedItemId = def.id;
    if (def.categoryId === ITEM_CATEGORY_IDS.AMMO) {
      addRocketAmmo(bestPlayer, def.id, Math.max(1, def.ammoProfile?.packSize | 0), state?.time?.currentMs || 0);
    } else if (!hasOwnedItem(bestPlayer, def.id)) {
      bestPlayer.equipment.ownedItemIds = sortEquipmentIdsStable([...(bestPlayer.equipment.ownedItemIds ?? []), def.id]);
      bestPlayer.equipment.lastChangedAt = state?.time?.currentMs || 0;
    }
    bestPlayer.uiHint = `${loot.bastionReward ? 'Coffre de bastion' : 'Loot'} : ${def.name}`;
    bestPlayer.uiHintTimer = 3.0;
  } else {
    pickedResourceKey = String(loot.resource || '');
    addResource(bestPlayer.inv, loot.resource, loot.amount);
  }
  queuePlayerSfx(bestPlayer, SFX_EVENT_TYPES.COLLECT, (Math.random() * 6) | 0, { resourceKey: pickedResourceKey, itemId: pickedItemId });
  return { playerId: bestPlayer.id | 0, resourceKey: pickedResourceKey, itemId: pickedItemId, amount: loot.amount || 0 };
}
