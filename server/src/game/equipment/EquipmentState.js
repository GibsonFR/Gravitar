import { PLAYER_EQUIPMENT_RULES, STARTER_AMMO_LOADOUT } from '../../../../shared/content/items/ItemDefs.js';

export function createEquipmentState() {
  return {
    ownedItemIds: [],
    equippedItemIds: [],
    slotCaps: { ...PLAYER_EQUIPMENT_RULES.slotCaps },
    converterRuntimeById: {},
    converterEnabledById: {},
    rocketAmmoCountsById: { ...(STARTER_AMMO_LOADOUT.inventory ?? {}) },
    rocketAmmoSlotItemIds: [...(STARTER_AMMO_LOADOUT.slots ?? ['', ''])],
    activeRocketSlot: Math.max(0, Math.min(1, STARTER_AMMO_LOADOUT.activeSlot ?? 0)),
    lastChangedAt: 0
  };
}
