import { getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getPlayerItemDef } from './PlayerEquipmentDefs.js';
import { buildEquippedTagState, buildEquippedSuperTagState, buildEquipmentEffectLines, resolveEquipmentRuntimeBonuses } from './EquipmentEffectResolver.js';
import { buildEquippedCountByCategory } from './EquipmentBonuses.js';
import { getRocketAmmoQuantity } from '../rocket/RocketAmmoRules.js';
import { buildConverterSnapshot } from './EquipmentConverterSnapshot.js';


function serializePassiveEffects(def) {
  const out = [];
  const rawPassives = Array.isArray(def?.passives) ? def.passives : [];
  for (const entry of rawPassives) {
    if (typeof entry === 'string') out.push(entry);
    else if (entry) out.push({ name: entry.name || entry.label || '', text: entry.text || entry.description || entry.name || '' });
  }
  const rawEffects = Array.isArray(def?.passiveEffects) ? def.passiveEffects : [];
  for (const entry of rawEffects) {
    if (typeof entry === 'string') out.push(entry);
    else if (entry) out.push({
      name: entry.name || entry.label || '',
      text: entry.text || entry.description || entry.name || '',
      trigger: entry.trigger || '',
      every: entry.every || 0,
      chance: entry.chance == null ? 1 : Number(entry.chance || 0)
    });
  }
  return out;
}

function buildItemEntry(player, itemId) {
  const runtime = player?.equipment?.converterRuntimeById?.[itemId] ?? null;
  const def = getPlayerItemDef(player, itemId);
  if (!def) return null;
  return {
    itemId: def.id,
    name: def.name,
    shortName: def.shortName || def.name,
    categoryId: def.categoryId,
    categoryName: getItemCategoryName(def.categoryId),
    tier: def.tier || 1,
    priceCredits: def.priceCredits || 0,
    description: def.description || '',
    sellPriceCredits: Math.max(1, Math.round((def.priceCredits || 0) * 0.6)),
    bonuses: { ...(def.bonuses ?? {}) },
    passives: serializePassiveEffects(def),
    tags: (def.tags ?? []).map((tag) => ({ ...tag })),
    weaponProfile: def.weaponProfile ? { ...def.weaponProfile } : null,
    launcherProfile: def.launcherProfile ? { ...def.launcherProfile } : null,
    converterProfile: def.converterProfile ? { ...def.converterProfile } : null,
    converterEnabled: def.converterProfile ? ((player?.equipment?.converterEnabledById?.[def.id]) !== false && (player?.equipment?.equippedItemIds ?? []).includes(def.id)) : false,
    converterRuntime: def.converterProfile ? {
      enabled: (player?.equipment?.converterEnabledById?.[def.id]) !== false && (player?.equipment?.equippedItemIds ?? []).includes(def.id),
      progress: Number(runtime?.progress || 0),
      cycles: runtime?.cycles | 0,
      blockedReason: String(runtime?.blockedReason || ''),
      blockedLabel: String(runtime?.blockedLabel || '')
    } : null,
    ammoProfile: def.ammoProfile ? { ...def.ammoProfile } : null,
    owned: (player?.equipment?.ownedItemIds ?? []).includes(def.id),
    equipped: (player?.equipment?.equippedItemIds ?? []).includes(def.id)
  };
}

function buildRocketAmmoEntry(player, itemId, activeRocketSlot) {
  const def = getPlayerItemDef(player, itemId);
  if (!def?.ammoProfile) return null;
  const slotIds = player?.equipment?.rocketAmmoSlotItemIds || [];
  const assignedSlots = slotIds.map((id, index) => id === itemId ? index : -1).filter((index) => index >= 0);
  return {
    itemId: def.id,
    name: def.name,
    shortName: def.shortName || def.name,
    categoryId: def.categoryId,
    categoryName: getItemCategoryName(def.categoryId),
    tier: def.tier || 1,
    priceCredits: def.priceCredits || 0,
    description: def.description || '',
    sellPriceCredits: Math.max(1, Math.round((def.priceCredits || 0) * 0.6)),
    bonuses: { ...(def.bonuses ?? {}) },
    passives: serializePassiveEffects(def),
    tags: (def.tags ?? []).map((tag) => ({ ...tag })),
    ammoProfile: { ...def.ammoProfile },
    ammoQuantity: getRocketAmmoQuantity(player, itemId),
    assignedRocketSlots: assignedSlots,
    owned: getRocketAmmoQuantity(player, itemId) > 0,
    equipped: assignedSlots.length > 0,
    active: assignedSlots.includes(activeRocketSlot)
  };
}

export function buildEquipmentSnapshot(player) {
  if (!player?.equipment) return null;

  const activeRocketSlot = Math.max(0, Math.min(1, player.equipment.activeRocketSlot | 0));
  const ownedEntries = (player.equipment.ownedItemIds ?? [])
    .map((itemId) => buildItemEntry(player, itemId))
    .filter(Boolean);

  const equippedEntries = (player.equipment.equippedItemIds ?? [])
    .map((itemId) => buildItemEntry(player, itemId))
    .filter(Boolean);

  const assignedAmmoIds = new Set((player.equipment.rocketAmmoSlotItemIds || []).filter(Boolean));
  const ammoInventory = Object.keys(player.equipment.rocketAmmoCountsById ?? {})
    .filter((itemId) => !assignedAmmoIds.has(itemId))
    .map((itemId) => buildRocketAmmoEntry(player, itemId, activeRocketSlot))
    .filter((entry) => entry && entry.ammoQuantity > 0)
    .sort((a, b) => (a.tier | 0) - (b.tier | 0) || String(a.name || '').localeCompare(String(b.name || '')));

  const ammoSlots = [0, 1].map((slot) => {
    const itemId = player.equipment.rocketAmmoSlotItemIds?.[slot] || '';
    const item = itemId ? buildRocketAmmoEntry(player, itemId, activeRocketSlot) : null;
    return {
      slot,
      active: slot === activeRocketSlot,
      item
    };
  });

  const slotCaps = { ...(player.equipment.slotCaps ?? {}) };
  const equippedCounts = buildEquippedCountByCategory(player);
  const runtimeBonuses = resolveEquipmentRuntimeBonuses(player);
  const activeConverters = equippedEntries
    .filter((item) => item.categoryId === 'converter' && item.converterProfile)
    .map((item) => {
      const runtime = player.equipment.converterRuntimeById?.[item.itemId] ?? { progress: 0, cycles: 0, enabled: true };
      const seconds = Math.max(0.1, item.converterProfile.seconds || 1);
      return {
        itemId: item.itemId,
        name: item.shortName || item.name,
        progress01: Math.max(0, Math.min(1, runtime.progress / seconds)),
        cycles: runtime.cycles | 0,
        enabled: runtime.enabled !== false,
        inputKey: item.converterProfile.inputKey,
        outputKey: item.converterProfile.outputKey,
        blockedReason: String(runtime.blockedReason || ''),
        blockedLabel: String(runtime.blockedLabel || '')
      };
    });

  return {
    slotCaps,
    equippedCounts,
    tags: buildEquippedTagState(player),
    superTags: buildEquippedSuperTagState(player),
    activeConverters,
    converters: buildConverterSnapshot(player, ownedEntries, equippedEntries),
    rocketAmmo: {
      inventory: ammoInventory,
      slots: ammoSlots,
      activeSlot: activeRocketSlot,
      activeItem: ammoSlots[activeRocketSlot]?.item ?? null
    },
    summary: {
      effectLines: buildEquipmentEffectLines(player),
      bonuses: runtimeBonuses
    },
    ownedItems: ownedEntries,
    equippedItems: equippedEntries,
    lastCraftedItemId: player.equipment.lastCraftedItemId || '',
    lastCraftedItem: player.equipment.lastCraftedItemId ? buildItemEntry(player, player.equipment.lastCraftedItemId) : null
  };
}
