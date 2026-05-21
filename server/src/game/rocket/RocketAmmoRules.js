import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';
import { STATUS_EFFECT_IDS } from '../../../../shared/content/status/StatusEffectIds.js';

function ensureAmmoState(player) {
  if (!player?.equipment) return null;
  if (!player.equipment.rocketAmmoCountsById) player.equipment.rocketAmmoCountsById = {};
  if (!Array.isArray(player.equipment.rocketAmmoSlotItemIds)) player.equipment.rocketAmmoSlotItemIds = ['', ''];
  if (!Number.isFinite(player.equipment.activeRocketSlot)) player.equipment.activeRocketSlot = 0;
  while (player.equipment.rocketAmmoSlotItemIds.length < 2) player.equipment.rocketAmmoSlotItemIds.push('');
  player.equipment.activeRocketSlot = Math.max(0, Math.min(1, player.equipment.activeRocketSlot | 0));
  return player.equipment;
}

export function isRocketAmmoDef(def) {
  return !!def && def.categoryId === ITEM_CATEGORY_IDS.AMMO && !!def.ammoProfile;
}

export function getRocketAmmoQuantity(player, itemId) {
  const equipment = ensureAmmoState(player);
  if (!equipment || !itemId) return 0;
  return Math.max(0, equipment.rocketAmmoCountsById[itemId] | 0);
}

export function addRocketAmmo(player, itemId, amount, timeMs = 0) {
  const equipment = ensureAmmoState(player);
  const def = getItemDef(itemId);
  if (!equipment || !isRocketAmmoDef(def)) return false;
  const qty = Math.max(0, Math.floor(amount || 0));
  if (qty <= 0) return false;
  equipment.rocketAmmoCountsById[itemId] = Math.max(0, (equipment.rocketAmmoCountsById[itemId] | 0) + qty);
  if (!equipment.rocketAmmoSlotItemIds[0]) equipment.rocketAmmoSlotItemIds[0] = itemId;
  else if (!equipment.rocketAmmoSlotItemIds[1] && equipment.rocketAmmoSlotItemIds[0] !== itemId) equipment.rocketAmmoSlotItemIds[1] = itemId;
  if (!getActiveRocketAmmoDef(player)) equipment.activeRocketSlot = equipment.rocketAmmoSlotItemIds[0] === itemId ? 0 : 1;
  equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function assignRocketAmmoToSlot(player, itemId, slot, timeMs = 0) {
  const equipment = ensureAmmoState(player);
  const def = getItemDef(itemId);
  if (!equipment || !isRocketAmmoDef(def)) return false;
  if (getRocketAmmoQuantity(player, itemId) <= 0) return false;
  const slotIndex = Math.max(0, Math.min(1, slot | 0));

  // Une même munition ne peut pas occuper deux emplacements à la fois.
  for (let i = 0; i < equipment.rocketAmmoSlotItemIds.length; i += 1) {
    if (i !== slotIndex && equipment.rocketAmmoSlotItemIds[i] === itemId) equipment.rocketAmmoSlotItemIds[i] = '';
  }

  equipment.rocketAmmoSlotItemIds[slotIndex] = itemId;
  if (!getActiveRocketAmmoDef(player)) equipment.activeRocketSlot = slotIndex;
  equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function unassignRocketAmmoSlot(player, slot, timeMs = 0) {
  const equipment = ensureAmmoState(player);
  if (!equipment) return false;
  const slotIndex = Math.max(0, Math.min(1, slot | 0));
  if (!equipment.rocketAmmoSlotItemIds[slotIndex]) return false;
  equipment.rocketAmmoSlotItemIds[slotIndex] = '';
  if (equipment.activeRocketSlot === slotIndex) {
    const otherSlot = equipment.rocketAmmoSlotItemIds.findIndex((id) => id && getRocketAmmoQuantity(player, id) > 0);
    equipment.activeRocketSlot = otherSlot >= 0 ? otherSlot : 0;
  }
  equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function switchActiveRocketSlot(player, slot, timeMs = 0) {
  const equipment = ensureAmmoState(player);
  if (!equipment) return false;
  const slotIndex = Math.max(0, Math.min(1, slot | 0));
  const itemId = equipment.rocketAmmoSlotItemIds[slotIndex] || '';
  if (!itemId || getRocketAmmoQuantity(player, itemId) <= 0) return false;
  equipment.activeRocketSlot = slotIndex;
  equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function getRocketAmmoDefBySlot(player, slot) {
  const equipment = ensureAmmoState(player);
  if (!equipment) return null;
  const slotIndex = Math.max(0, Math.min(1, slot | 0));
  const itemId = equipment.rocketAmmoSlotItemIds[slotIndex] || '';
  if (!itemId) return null;
  const def = getItemDef(itemId);
  if (!isRocketAmmoDef(def)) return null;
  if (getRocketAmmoQuantity(player, itemId) <= 0) return null;
  return def;
}

export function getActiveRocketAmmoDef(player) {
  const equipment = ensureAmmoState(player);
  if (!equipment) return null;
  return getRocketAmmoDefBySlot(player, equipment.activeRocketSlot | 0);
}

export function consumeRocketAmmo(player, itemId, amount = 1, timeMs = 0) {
  const equipment = ensureAmmoState(player);
  if (!equipment || !itemId) return false;
  const qty = Math.max(1, Math.floor(amount || 1));
  const current = getRocketAmmoQuantity(player, itemId);
  if (current < qty) return false;
  const next = current - qty;
  equipment.rocketAmmoCountsById[itemId] = next;
  if (next <= 0) {
    for (let i = 0; i < equipment.rocketAmmoSlotItemIds.length; i += 1) {
      if (equipment.rocketAmmoSlotItemIds[i] === itemId) equipment.rocketAmmoSlotItemIds[i] = '';
    }
    if (!getActiveRocketAmmoDef(player)) {
      const otherSlot = equipment.rocketAmmoSlotItemIds.findIndex((id) => id && getRocketAmmoQuantity(player, id) > 0);
      equipment.activeRocketSlot = otherSlot >= 0 ? otherSlot : 0;
    }
  }
  equipment.lastChangedAt = timeMs | 0;
  return true;
}

export function buildRocketAmmoStatusSpecs(ammoDef) {
  const profile = ammoDef?.ammoProfile;
  if (!profile) return { onHitStatuses: null, onSplashStatuses: null };
  const duration = Math.max(0, profile.effectDuration ?? 0);
  const magnitude = Math.max(0, profile.effectMagnitude ?? 0);
  switch (profile.effectType) {
    case 'slow':
      return {
        onHitStatuses: null,
        onSplashStatuses: [{ effectId: STATUS_EFFECT_IDS.SLOW, duration, value: magnitude, hostile: true, label: 'Rocket' }]
      };
    case 'burn':
      return {
        onHitStatuses: null,
        onSplashStatuses: [{ effectId: STATUS_EFFECT_IDS.BURN, duration, periodicDamage: magnitude, tickEvery: 1, hostile: true, label: 'Rocket' }]
      };
    case 'poison':
      return {
        onHitStatuses: null,
        onSplashStatuses: [{ effectId: STATUS_EFFECT_IDS.POISON, duration, periodicDamage: magnitude, tickEvery: 1, hostile: true, label: 'Rocket' }]
      };
    case 'stun':
      return {
        onHitStatuses: [{ effectId: STATUS_EFFECT_IDS.STUN, duration, hostile: true, label: 'Rocket' }],
        onSplashStatuses: null
      };
    default:
      return { onHitStatuses: null, onSplashStatuses: null };
  }
}
