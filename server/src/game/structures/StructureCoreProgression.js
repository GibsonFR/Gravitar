import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { removeResource } from '../inventory/InventorySystem.js';
import { STRUCTURE_TYPES } from './StructureDefs.js';

export const CORE_TIERS = Object.freeze([
  null,
  { tier: 1, name: 'Noyau T1', maxHp: 1200, claimRadius: 512, regen: 8, energy: 0, structureLimit: 80, cost: {}, researchId: '' },
  { tier: 2, name: 'Noyau T2', maxHp: 1900, claimRadius: 640, regen: 12, energy: 8, structureLimit: 130, cost: { steelPlate: 18, controlCircuit: 4, copperWire: 20 }, researchId: 'construction_foundations' },
  { tier: 3, name: 'Noyau T3', maxHp: 3000, claimRadius: 768, regen: 18, energy: 18, structureLimit: 210, cost: { steelPlate: 36, compositeArmor: 6, microprocessor: 4, energySciencePack: 4 }, researchId: 'advanced_research' },
  { tier: 4, name: 'Noyau T4', maxHp: 4600, claimRadius: 896, regen: 26, energy: 34, structureLimit: 320, cost: { steelPlate: 64, compositeArmor: 14, microprocessor: 10, advancedSciencePack: 6 }, researchId: 'logistics_advanced' }
]);

export function getCoreTierDef(tier) {
  return CORE_TIERS[Math.max(1, Math.min(4, tier | 0 || 1))] || CORE_TIERS[1];
}

function ownerKey(player) {
  return String(player?.accountKey || player?.accountName || player?.pseudo || `guest-${player?.id | 0}`).toLowerCase();
}

function isCoreOwner(player, core) {
  if (String(core?.worldId || 'endless') !== 'endless') return (core?.ownerId | 0) === (player?.id | 0);
  return ownerKey(player) === String(core?.ownerKey || '').toLowerCase();
}

function distanceSqToRect(structure, x, y) {
  const halfW = (Number(structure?.w) || Number(structure?.radius || 0) * 2) * 0.5;
  const halfH = (Number(structure?.h) || Number(structure?.radius || 0) * 2) * 0.5;
  const px = Math.max((structure.x || 0) - halfW, Math.min(Number(x) || 0, (structure.x || 0) + halfW));
  const py = Math.max((structure.y || 0) - halfH, Math.min(Number(y) || 0, (structure.y || 0) + halfH));
  return (x - px) ** 2 + (y - py) ** 2;
}

export function applyCoreTier(structure, preserveHpRatio = true) {
  if (!structure || structure.type !== STRUCTURE_TYPES.BASE_CORE) return structure;
  const tier = getCoreTierDef(structure.coreTier);
  const oldMax = Math.max(1, Number(structure.stats?.maxHp || tier.maxHp) || tier.maxHp);
  const ratio = preserveHpRatio ? Math.max(0, Math.min(1, Number(structure.stats?.hp || oldMax) / oldMax)) : 1;
  structure.coreTier = tier.tier;
  structure.claimRadius = tier.claimRadius;
  structure.energyOutput = tier.energy;
  structure.structureLimit = tier.structureLimit;
  if (structure.stats) {
    structure.stats.maxHp = tier.maxHp;
    structure.stats.hp = Math.max(1, Math.min(tier.maxHp, tier.maxHp * ratio));
  }
  return structure;
}

function completedResearch(player) {
  return new Set(Array.isArray(player?.research?.completed) ? player.research.completed : []);
}

function missingCost(player, cost) {
  for (const [key, amount] of Object.entries(cost || {})) {
    if (!RESOURCE_DEFS[key] || (player?.inv?.resources?.[key] | 0) < (amount | 0)) return key;
  }
  return '';
}

export function canManageCore(player, core) {
  if (!player || core?.type !== STRUCTURE_TYPES.BASE_CORE || !isCoreOwner(player, core)) return false;
  if (String(player.worldId || 'endless') !== String(core.worldId || 'endless')) return false;
  if ((player.sx | 0) !== (core.sx | 0) || (player.sy | 0) !== (core.sy | 0)) return false;
  return distanceSqToRect(core, player.x || 0, player.y || 0) <= 360 * 360;
}

export function openCoreManagement(state, player, structureId) {
  const core = state?.structures?.get?.(structureId | 0);
  if (!canManageCore(player, core)) return { ok: false, error: 'core_locked' };
  player.openCoreId = core.id | 0;
  player.openAutomationId = 0;
  player.openStorageId = 0;
  player.openMachineId = 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function closeCoreManagement(player) {
  if (!player) return { ok: false, error: 'missing_player' };
  player.openCoreId = 0;
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function upgradeCore(state, player, structureId, timeMs = Date.now()) {
  const core = state?.structures?.get?.(structureId | 0);
  if (!canManageCore(player, core)) return { ok: false, error: 'core_locked' };
  const current = getCoreTierDef(core.coreTier);
  if (current.tier >= 4) return { ok: false, error: 'core_max_tier' };
  const next = getCoreTierDef(current.tier + 1);
  if (next.researchId && !completedResearch(player).has(next.researchId)) return { ok: false, error: 'research_required' };
  if (missingCost(player, next.cost)) return { ok: false, error: 'missing_resources' };
  for (const [key, amount] of Object.entries(next.cost)) removeResource(player.inv, key, amount | 0);
  core.coreTier = next.tier;
  applyCoreTier(core, true);
  core.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  if (String(core.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}

export function buildCoreManagementSnapshot(state, player) {
  const core = state?.structures?.get?.(player?.openCoreId | 0);
  if (!canManageCore(player, core)) {
    if (player) player.openCoreId = 0;
    return null;
  }
  const tier = getCoreTierDef(core.coreTier);
  const next = tier.tier < 4 ? getCoreTierDef(tier.tier + 1) : null;
  const sharedClanId = core.clanShared ? String(core.clanId || '') : '';
  const ownedStructures = [...(state?.structures?.values?.() || [])].filter((structure) =>
    (
      String(structure.ownerKey || '').toLowerCase() === String(core.ownerKey || '').toLowerCase()
      || (!!sharedClanId && structure.clanShared && String(structure.clanId || '') === sharedClanId)
    )
      && String(structure.worldId || 'endless') === String(core.worldId || 'endless')
      && (structure.sx | 0) === (core.sx | 0)
      && (structure.sy | 0) === (core.sy | 0)
  ).length;
  return {
    id: core.id | 0,
    tier: tier.tier,
    name: tier.name,
    hp: Math.round(core.stats?.hp || 0),
    maxHp: tier.maxHp,
    claimRadius: tier.claimRadius,
    regen: tier.regen,
    energy: tier.energy,
    structureLimit: tier.structureLimit,
    structureCount: ownedStructures,
    clanId: core.clanId || '',
    clanShared: !!core.clanShared,
    next: next ? {
      tier: next.tier,
      name: next.name,
      maxHp: next.maxHp,
      claimRadius: next.claimRadius,
      regen: next.regen,
      energy: next.energy,
      structureLimit: next.structureLimit,
      cost: Object.entries(next.cost).map(([key, amount]) => ({ key, name: RESOURCE_DEFS[key]?.name || key, amount })),
      researchId: next.researchId,
      researchReady: !next.researchId || completedResearch(player).has(next.researchId),
      affordable: !missingCost(player, next.cost)
    } : null
  };
}
