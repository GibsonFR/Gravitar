import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';

function hexToRgb(hex) {
  const s = String(hex || '#d0d7e4').replace('#', '').trim();
  const v = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function buildLootDefForResource(key, def) {
  return {
    resource: key,
    amount: 1,
    radius: 6,
    pickupPadding: 4,
    pickupImmunitySec: 0.45,
    lifetimeSec: 40,
    drag: 0.94,
    color: hexToRgb(def?.colorHex)
  };
}

export const LOOT_DEFS = Object.fromEntries(
  Object.entries(RESOURCE_DEFS).map(([key, def]) => [key, buildLootDefForResource(key, def)])
);
