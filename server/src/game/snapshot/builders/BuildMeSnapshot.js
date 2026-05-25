import { drainPlayerSfx } from '../../audio/PlayerSfxState.js';
import { buildInventorySnapshot } from '../../inventory/InventorySnapshot.js';
import { buildEquipmentSnapshot } from '../../equipment/EquipmentSnapshot.js';
import { buildStationShopSnapshot } from '../../station/shop/StationShopSnapshot.js';
import { buildPlayerMapSnapshot } from '../../map/PlayerMapState.js';
import { buildStatusSnapshot } from '../../status/StatusView.js';
import { buildFrameUiState, getFrameAutoAttackProfile, getFrameMoveMultiplier } from '../../frames/FrameGameplayHooks.js';
import { buildAbilityHudState, buildProgressionSnapshot } from '../../progression/ProgressionHudState.js';
import { getMoveSpeedMultiplier } from '../../status/StatusMotion.js';
import { getEquippedEquipmentDefs } from '../../equipment/EquipmentBonuses.js';
import { ITEM_CATEGORY_IDS } from '../../../../../shared/content/items/ItemCategoryIds.js';
import { getActiveRocketAmmoDef } from '../../rocket/RocketAmmoRules.js';
import { buildBastionBuffSnapshot, getBastionCooldownRecoveryMultiplier, getBastionDamageMultiplier, getBastionMoveSpeedMultiplier } from '../../bastion/BastionBuffs.js';
import { getSectorSummary } from '../../../../../shared/proc/SectorSummary.js';
import { SECTOR_BIOMES } from '../../../../../shared/proc/SectorBiomes.js';
import { getTestBiomeSector } from '../../sector/SpecialSectors.js';
import { buildStorageSnapshot } from '../../structures/StructureStorage.js';
import { buildMachineSnapshot } from '../../structures/StructureMachines.js';
import { buildResearchStationSnapshot, buildResearchOverviewSnapshot } from '../../structures/StructureResearchStation.js';
import { buildEquipmentFabricatorSnapshot } from '../../structures/StructureEquipmentFabricator.js';
import { buildEquipmentRDStationSnapshot } from '../../structures/StructureEquipmentRDStation.js';


function buildCurrentSectorBiomeSnapshot(player, state = null) {
  const sx = player?.sx | 0;
  const sy = player?.sy | 0;
  const testBiome = getTestBiomeSector(sx, sy);
  const biome = testBiome ? (SECTOR_BIOMES[testBiome.biomeId] || null) : null;
  const summary = biome ? null : getSectorSummary(state?.seed ?? 1337, sx, sy);
  const source = biome ? {
    biomeId: biome.id,
    biomeName: biome.name,
    biomeShortName: biome.shortName,
    biomeDescription: biome.description,
    biomeColorHex: biome.colorHex
  } : summary;
  return {
    id: source?.biomeId || 'metallic',
    name: source?.biomeName || 'Ceinture métallique',
    shortName: source?.biomeShortName || 'Métal',
    description: source?.biomeDescription || '',
    colorHex: source?.biomeColorHex || '#a8b2bd'
  };
}

function buildTransitionSnapshot(player, timeMs) {
  const t = player?.portalTransition || null;
  if (!t || !Number.isFinite(t.until) || timeMs > t.until) return null;
  return {
    id: t.id | 0,
    type: t.type || 'portal',
    label: t.label || 'Chargement du secteur…',
    targetSx: t.targetSx | 0,
    targetSy: t.targetSy | 0,
    startedAt: t.startedAt || timeMs,
    until: t.until,
    forceServerPose: !!t.forceServerPose
  };
}

function buildDerivedSnapshot(player) {
  const auto = getFrameAutoAttackProfile(player, { peekOnly: true });
  const equippedWeapon = getEquippedEquipmentDefs(player).find((def) => def?.categoryId === ITEM_CATEGORY_IDS.WEAPON) || null;
  const weaponProfile = equippedWeapon?.weaponProfile || null;
  const baseCooldown = weaponProfile ? (weaponProfile.cooldown ?? player.progressionBonuses?.autoAttackBaseCooldown ?? 0.70) : 0;
  const fireRateMult = player.progressionBonuses?.fireRateMult ?? 1;
  const attackSpeedBonus = 1 + (player.frameBonuses?.attackSpeed ?? 0);
  const activeRocketAmmo = getActiveRocketAmmoDef(player);
  return {
    moveSpeed: (player.engine ?? 0) * getMoveSpeedMultiplier(player) * getFrameMoveMultiplier(player) * getBastionMoveSpeedMultiplier(player),
    autoAttackDamage: weaponProfile ? ((weaponProfile.damage ?? auto.damage ?? 0) * (player.progressionBonuses?.damageMult ?? 1) * getBastionDamageMultiplier(player)) : 0,
    autoAttackRate: weaponProfile && baseCooldown > 0.001 ? 1 / Math.max(0.05, (auto.cooldownMult ?? 1) * baseCooldown) : 0,
    autoAttackRange: weaponProfile ? ((weaponProfile.range ?? 620) * Math.max(0.5, player.progressionBonuses?.autoRangeMult ?? 1)) : 0,
    energyRegen: player.stats?.energyRegen ?? 0,
    hullRegen: player.stats?.hullRegen ?? 0,
    shieldRegen: player.stats?.shieldRegenPerSec ?? 0,
    damageMult: player.progressionBonuses?.damageMult ?? 1,
    fireRateMult,
    attackSpeedBonus,
    cooldownRecoveryMult: (player.progressionBonuses?.cooldownRecoveryMult ?? 1) * getBastionCooldownRecoveryMultiplier(player),
    critChance: player.progressionBonuses?.critChance ?? 0,
    critDamageMult: player.progressionBonuses?.critDamageMult ?? 1.5,
    lifestealRatio: player.progressionBonuses?.lifestealRatio ?? 0,
    healMult: player.progressionBonuses?.healMult ?? 1,
    autoBurnDuration: player.progressionBonuses?.autoBurnDuration ?? 0,
    autoBurnDps: player.progressionBonuses?.autoBurnDps ?? 0,
    armor: Math.max(0, (player.baseArmor ?? 0) + (player.frameBonuses?.armorFlat ?? 0)),
    shieldPenPct: player.progressionBonuses?.shieldPenPct ?? 0,
    armorPenFlat: player.progressionBonuses?.armorPenFlat ?? 0,
    rocketAmmoName: activeRocketAmmo?.shortName || activeRocketAmmo?.name || '',
    rocketAmmoQuantity: activeRocketAmmo ? Math.max(0, player?.equipment?.rocketAmmoCountsById?.[activeRocketAmmo.id] | 0) : 0
  };
}

export function buildMeSnapshot(player, timeMs, state = null) {
  if (!player) return null;
  const dockedStation = state?.stations?.get?.(player.dockedStationId || 0) ?? null;
  return {
    id: player.id,
    pseudo: player.pseudo || '',
    sessionSetup: {
      pending: !!player.sessionSetupPending,
      authStatus: player.authStatus || null,
      step: player.sessionSetupStep || ''
    },
    frameId: player.frameId,
    frameName: player.frameName,
    sx: player.sx | 0,
    sy: player.sy | 0,
    sectorBiome: buildCurrentSectorBiomeSnapshot(player, state),
    selectedKind: player.selectedKind,
    selectedId: player.selectedId,
    dockedStationId: player.dockedStationId,
    dockPhase: player.dockPhase || 'none',
    dockStationId: player.dockStationId || 0,
    dockProg01: player.dockProg01 || 0,
    hint: player.uiHintTimer > 0 ? player.uiHint : '',
    kills: player.kills,
    deaths: player.deaths,
    inv: buildInventorySnapshot(player.inv, dockedStation),
    equipment: buildEquipmentSnapshot(player),
    stationShop: buildStationShopSnapshot(dockedStation, player, timeMs),
    storage: buildStorageSnapshot(state, player),
    machine: buildMachineSnapshot(state, player),
    researchStation: buildResearchStationSnapshot(state, player),
    equipmentFabricator: buildEquipmentFabricatorSnapshot(state, player),
    equipmentRDStation: buildEquipmentRDStationSnapshot(state, player),
    researchOverview: buildResearchOverviewSnapshot(state, player),
    map: buildPlayerMapSnapshot(player, state, timeMs),
    cooldowns: {
      A: player.cooldownALeft,
      Z: player.cooldownZLeft,
      E: player.cooldownELeft,
      R: player.cooldownRLeft
    },
    progression: buildProgressionSnapshot(player),
    abilityHud: buildAbilityHudState(player),
    statuses: buildStatusSnapshot(player),
    frameState: buildFrameUiState(player, timeMs),
    derived: buildDerivedSnapshot(player),
    bastions: buildBastionBuffSnapshot(player),
    sfx: drainPlayerSfx(player),
    transition: buildTransitionSnapshot(player, timeMs)
  };
}


export function buildMeLiteSnapshot(player, timeMs, state = null) {
  if (!player) return null;
  return {
    id: player.id,
    pseudo: player.pseudo || '',
    lite: true,
    sessionSetup: {
      pending: !!player.sessionSetupPending,
      authStatus: player.authStatus || null,
      step: player.sessionSetupStep || ''
    },
    frameId: player.frameId,
    frameName: player.frameName,
    sx: player.sx | 0,
    sy: player.sy | 0,
    sectorBiome: buildCurrentSectorBiomeSnapshot(player, state),
    selectedKind: player.selectedKind,
    selectedId: player.selectedId,
    dockedStationId: player.dockedStationId,
    dockPhase: player.dockPhase || 'none',
    dockStationId: player.dockStationId || 0,
    dockProg01: player.dockProg01 || 0,
    hint: player.uiHintTimer > 0 ? player.uiHint : '',
    kills: player.kills,
    deaths: player.deaths,
    inv: buildInventorySnapshot(player.inv, state?.stations?.get?.(player.dockedStationId || 0) ?? null),
    storage: buildStorageSnapshot(state, player),
    machine: buildMachineSnapshot(state, player),
    researchStation: buildResearchStationSnapshot(state, player),
    equipmentFabricator: buildEquipmentFabricatorSnapshot(state, player),
    equipmentRDStation: buildEquipmentRDStationSnapshot(state, player),
    researchOverview: buildResearchOverviewSnapshot(state, player),
    cooldowns: {
      A: player.cooldownALeft,
      Z: player.cooldownZLeft,
      E: player.cooldownELeft,
      R: player.cooldownRLeft
    },
    statuses: buildStatusSnapshot(player, 4),
    sfx: drainPlayerSfx(player),
    transition: buildTransitionSnapshot(player, timeMs)
  };
}
