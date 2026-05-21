import { ITEM_SUPER_TAG_IDS, ITEM_SUPER_TAG_ORDER } from './ItemSuperTagIds.js';

export const ITEM_SUPER_TAG_DEFS = Object.freeze({
  [ITEM_SUPER_TAG_IDS.OVERDRIVE]: { id: ITEM_SUPER_TAG_IDS.OVERDRIVE, name: 'Overdrive', short: 'OD', colorHex: '#df7aff' },
  [ITEM_SUPER_TAG_IDS.JUGGERNAUT]: { id: ITEM_SUPER_TAG_IDS.JUGGERNAUT, name: 'Juggernaut', short: 'JG', colorHex: '#b78ab5' },
  [ITEM_SUPER_TAG_IDS.GHOSTWIRE]: { id: ITEM_SUPER_TAG_IDS.GHOSTWIRE, name: 'Ghostwire', short: 'GW', colorHex: '#8fcfb8' },
  [ITEM_SUPER_TAG_IDS.NAPALM]: { id: ITEM_SUPER_TAG_IDS.NAPALM, name: 'Napalm', short: 'NP', colorHex: '#ff9867' },
  [ITEM_SUPER_TAG_IDS.BLOODWALL]: { id: ITEM_SUPER_TAG_IDS.BLOODWALL, name: 'Bloodwall', short: 'BW', colorHex: '#67c7dc' }
});

export function getItemSuperTagDef(tagId) {
  return ITEM_SUPER_TAG_DEFS[tagId] ?? null;
}

export function listItemSuperTagDefs() {
  return ITEM_SUPER_TAG_ORDER.map((tagId) => ITEM_SUPER_TAG_DEFS[tagId]).filter(Boolean);
}
