import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';

function sortByTierAndName(items) {
  return [...(items || [])].sort((a, b) => {
    const at = a?.tier | 0;
    const bt = b?.tier | 0;
    if (at !== bt) return at - bt;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

export function buildConverterSnapshot(player, ownedEntries, equippedEntries) {
  const inventory = sortByTierAndName((ownedEntries || []).filter((item) => item?.categoryId === ITEM_CATEGORY_IDS.CONVERTER));
  const equipped = sortByTierAndName((equippedEntries || []).filter((item) => item?.categoryId === ITEM_CATEGORY_IDS.CONVERTER));
  const active = equipped
    .filter((item) => item?.converterProfile)
    .map((item) => {
      const runtime = item.converterRuntime || { enabled: false, progress: 0, cycles: 0, blockedReason: 'disabled', blockedLabel: 'coupé' };
      const seconds = Math.max(0.1, item.converterProfile?.seconds || 1);
      return {
        itemId: item.itemId,
        name: item.shortName || item.name,
        enabled: runtime.enabled !== false,
        cycles: runtime.cycles | 0,
        progress01: Math.max(0, Math.min(1, Number(runtime.progress || 0) / seconds)),
        inputKey: item.converterProfile?.inputKey || '',
        inputAmount: Math.max(0, item.converterProfile?.inputAmount | 0),
        outputKey: item.converterProfile?.outputKey || '',
        outputAmount: Math.max(0, item.converterProfile?.outputAmount | 0),
        blockedReason: runtime.blockedReason || '',
        blockedLabel: runtime.blockedLabel || '',
        seconds
      };
    });

  return {
    slotCap: Math.max(0, player?.equipment?.slotCaps?.[ITEM_CATEGORY_IDS.CONVERTER] | 0),
    equipped,
    inventory,
    active,
    summary: {
      equippedCount: equipped.length,
      enabledCount: active.filter((entry) => entry.enabled).length,
      totalCycles: active.reduce((sum, entry) => sum + Math.max(0, entry.cycles | 0), 0)
    }
  };
}
