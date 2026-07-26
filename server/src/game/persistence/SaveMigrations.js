import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { getItemDef } from '../../../../shared/content/items/ItemDefs.js';

export const CURRENT_SAVE_SCHEMA_VERSION = 2;

export const RESOURCE_ID_ALIASES = Object.freeze({
  iron: 'ironOre',
  ironore: 'ironOre',
  copperore: 'copper',
  aluminumore: 'aluminiumOre',
  aluminumingot: 'aluminiumIngot',
  lithium: 'lithiumOre',
  titanium: 'titaniumOre',
  cobalt: 'cobaltOre',
  uranium: 'uraniumOre',
  thorium: 'thoriumOre',
  water: 'waterIce',
  hydrogen: 'hydrogenIce',
  methane: 'methaneIce',
  ammonia: 'ammoniaIce'
});

export const STRUCTURE_TYPE_ALIASES = Object.freeze({
  core: 'base_core',
  basecore: 'base_core',
  outpostcore: 'outpost_core',
  chest: 'storage',
  resource_storage: 'storage',
  extractor: 'mining_extractor',
  miner: 'mining_extractor',
  turret: 'defense_turret',
  rocket_turret: 'defense_turret'
});

const RESOURCE_KEYS_BY_LOWER = new Map(Object.keys(RESOURCE_DEFS).map((key) => [key.toLowerCase(), key]));

export function canonicalResourceKey(rawKey) {
  const raw = String(rawKey || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  return RESOURCE_ID_ALIASES[lower] || RESOURCE_KEYS_BY_LOWER.get(lower) || raw;
}

export function canonicalStructureType(rawType) {
  const raw = String(rawType || '').trim().toLowerCase();
  return STRUCTURE_TYPE_ALIASES[raw] || raw;
}

export function normalizeResourceMap(resources) {
  const out = {};
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) return out;
  for (const [rawKey, rawAmount] of Object.entries(resources)) {
    const key = canonicalResourceKey(rawKey);
    const amount = Math.max(0, Math.floor(Number(rawAmount) || 0));
    if (!key || amount <= 0) continue;
    out[key] = (out[key] | 0) + amount;
  }
  return out;
}

function cleanIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
}

function obsoleteItemDef(itemId) {
  return {
    id: itemId,
    name: `Objet obsolète (${itemId})`,
    shortName: 'Objet obsolète',
    categoryId: 'module',
    tier: 1,
    priceCredits: 0,
    tags: [],
    bonuses: {},
    neutralBase: true,
    obsolete: true,
    description: 'Objet conservé par la migration de sauvegarde. Aucun effet actif.'
  };
}

export function migrateEquipmentSave(equipment) {
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) return equipment;
  equipment.ownedItemIds = cleanIdList(equipment.ownedItemIds);
  equipment.equippedItemIds = cleanIdList(equipment.equippedItemIds)
    .filter((id) => equipment.ownedItemIds.includes(id));
  if (!equipment.customItemDefs || typeof equipment.customItemDefs !== 'object' || Array.isArray(equipment.customItemDefs)) {
    equipment.customItemDefs = {};
  }
  for (const itemId of equipment.ownedItemIds) {
    if (getItemDef(itemId) || equipment.customItemDefs[itemId]) continue;
    equipment.customItemDefs[itemId] = obsoleteItemDef(itemId);
  }
  if (equipment.rocketAmmoCountsById && typeof equipment.rocketAmmoCountsById === 'object') {
    equipment.rocketAmmoCountsById = Object.fromEntries(
      Object.entries(equipment.rocketAmmoCountsById)
        .map(([id, amount]) => [String(id || ''), Math.max(0, Math.floor(Number(amount) || 0))])
        .filter(([id, amount]) => id && amount > 0)
    );
  }
  return equipment;
}

export function migrateInventorySave(inventory) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) return inventory;
  inventory.resources = normalizeResourceMap(inventory.resources);
  inventory.credits = Math.max(0, Math.floor(Number(inventory.credits) || 0));
  inventory.cargoMax = Math.max(0, Number(inventory.cargoMax) || 0);
  inventory.cargoUsed = Math.max(0, Number(inventory.cargoUsed) || 0);
  return inventory;
}

export function migrateSaveProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
  if (profile.inv) migrateInventorySave(profile.inv);
  if (profile.equipment) migrateEquipmentSave(profile.equipment);
  profile.schemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  return profile;
}
