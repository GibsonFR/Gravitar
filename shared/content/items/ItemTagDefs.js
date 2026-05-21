import { ITEM_TAG_IDS, ITEM_TAG_ORDER } from './ItemTagIds.js';

export const ITEM_TAG_DEFS = Object.freeze({
  [ITEM_TAG_IDS.REAVER]: { id: ITEM_TAG_IDS.REAVER, name: 'Reaver', short: 'RVR', colorHex: '#ff746d' },
  [ITEM_TAG_IDS.WARDEN]: { id: ITEM_TAG_IDS.WARDEN, name: 'Warden', short: 'WRD', colorHex: '#69b8ff' },
  [ITEM_TAG_IDS.SURGE]: { id: ITEM_TAG_IDS.SURGE, name: 'Surge', short: 'SRG', colorHex: '#c07dff' },
  [ITEM_TAG_IDS.VERGE]: { id: ITEM_TAG_IDS.VERGE, name: 'Verge', short: 'VRG', colorHex: '#7be59d' },
  [ITEM_TAG_IDS.SIEGE]: { id: ITEM_TAG_IDS.SIEGE, name: 'Siege', short: 'SGE', colorHex: '#ffbb69' },
  [ITEM_TAG_IDS.SIPHON]: { id: ITEM_TAG_IDS.SIPHON, name: 'Siphon', short: 'SIP', colorHex: '#65e3db' }
});

export function getItemTagDef(tagId) {
  return ITEM_TAG_DEFS[tagId] ?? null;
}

export function listItemTagDefs() {
  return ITEM_TAG_ORDER.map((tagId) => ITEM_TAG_DEFS[tagId]).filter(Boolean);
}
