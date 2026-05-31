import { getSimulationTimeMs } from '../util/Time.js';
import { rollSpawnAround } from '../util/Math.js';
import { applyHullDamage, applyStatBlockDamage, healStatBlock, restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { dropPlayerCargo } from '../player/PlayerDrops.js';
import { createInventoryState } from '../inventory/InventoryState.js';
import { createEquipmentState } from '../equipment/EquipmentState.js';
import { STARTER_ITEM_IDS, STARTER_AMMO_LOADOUT } from '../../../../shared/content/items/ItemDefs.js';
import { createPlayerProgressionState } from '../player/runtime/PlayerProgressionState.js';
import {
  breakStatusesOnExternalHit,
  getIncomingHealMultiplier,
  getIncomingHullDamageMultiplier,
  getIncomingShieldDamageMultiplier,
  getOutgoingLifestealRatio
} from '../status/StatusRack.js';
import { isInvulnerable } from '../status/StatusMotion.js';
import { adjustIncomingDamageByFrame, onDamageTakenByFrame, onEntityKilledByFrame } from '../frames/FrameGameplayHooks.js';
import { gainPlayerXp } from '../progression/ProgressionSystem.js';
import { queueDamageNumber, queueStructureState } from './CombatFxState.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';
import { getAsteroidXpReward, getMobXpReward, getPlayerKillXpReward } from '../progression/ProgressionRewards.js';
import { dropMobLoot } from '../mob/MobDrops.js';
import { registerPirateQuestKill } from '../player/runtime/PlayerPirateState.js';
import { isPlayerSessionPending } from '../player/PlayerSessionSetup.js';
import { getBastionDefenseMultiplier } from '../bastion/BastionBuffs.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { GAME_MODES, WORLD_IDS, clearPlayerBattleResidue, leaveBattleSession, recordBattleDeath, recordBattleKill, setPlayerTestWorld, setPlayerStressServer } from '../modes/GameModes.js';
import { triggerEquipmentHitProcs, triggerEquipmentTakeHitProcs } from '../equipment/EquipmentProcSystem.js';
import { canPlayerDamageStructure, destroyStructure, isStructureProtectedByCore } from '../structures/StructureSystem.js';


function triggerItemProcsAfterDamage(state, target, sourcePlayer, finalAmount, shielded, options, timeMs) {
  if (options.isPeriodic || options.ignoreItemProcs) return;
  const ctx = {
    timeMs,
    damage: finalAmount,
    crit: !!options.crit,
    shielded,
    sourceSlot: options.sourceSlot || '',
    visualKind: options.visualKind || ''
  };
  if (sourcePlayer?.kind === 'player') triggerEquipmentHitProcs(state, sourcePlayer, target, ctx);
  if (target?.kind === 'player') triggerEquipmentTakeHitProcs(state, target, sourcePlayer, ctx);
}

function setHint(player, text, duration = 2.2) {
  player.uiHint = text;
  player.uiHintTimer = duration;
}

function forceClientPoseTransition(player, label, timeMs, durationMs = 520) {
  const id = ((player.portalTransitionId | 0) + 1) | 0;
  player.portalTransitionId = id;
  player.portalTransition = {
    id,
    type: 'respawn',
    label: label || 'Retour hub…',
    targetSx: player.sx | 0,
    targetSy: player.sy | 0,
    startedAt: timeMs,
    until: timeMs + durationMs,
    forceServerPose: true
  };
  player.ignoreClientPoseUntil = Math.max(player.ignoreClientPoseUntil ?? 0, timeMs + durationMs + 260);
  player.clientAuthoritativeUntil = 0;
  player.lastClientSectorSeq = 0;
}

function getEffectiveArmor(target, sourcePlayer) {
  if (target?.kind !== 'player') return 0;
  const rawArmor = Math.max(0, (target.baseArmor ?? 0) + (target.frameBonuses?.armorFlat ?? 0));
  const pen = Math.max(0, sourcePlayer?.progressionBonuses?.armorPenFlat ?? 0);
  return Math.max(0, rawArmor - pen);
}

function applyArmorReduction(amount, armor) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(armor) || armor <= 0) return amount;
  return amount * (100 / (100 + armor));
}

function applyDamageWithShieldPen(target, finalAmount, sourcePlayer, bypassShield) {
  if (bypassShield) return applyHullDamage(target.stats, applyArmorReduction(finalAmount, getEffectiveArmor(target, sourcePlayer)));
  const shield = Math.max(0, target?.stats?.shield ?? 0);
  if (shield <= 0) return applyHullDamage(target.stats, applyArmorReduction(finalAmount, getEffectiveArmor(target, sourcePlayer)));
  const shieldPen = Math.max(0, Math.min(0.80, sourcePlayer?.progressionBonuses?.shieldPenPct ?? 0));
  if (shieldPen <= 0) return applyStatBlockDamage(target.stats, finalAmount);

  target.stats.shieldRegenDelayLeft = Math.max(target.stats.shieldRegenDelayLeft, target.stats.shieldRegenDelayOnHit ?? 0);
  const shieldDamage = finalAmount * (1 - shieldPen);
  const hullDamage = applyArmorReduction(finalAmount * shieldPen, getEffectiveArmor(target, sourcePlayer));
  const absorbed = Math.min(target.stats.shield, shieldDamage);
  target.stats.shield -= absorbed;
  const overflow = Math.max(0, shieldDamage - absorbed);
  target.stats.hp -= applyArmorReduction(overflow, getEffectiveArmor(target, sourcePlayer)) + hullDamage;
  if (target.stats.hp <= 0) {
    target.stats.hp = 0;
    return true;
  }
  return false;
}



function clearBastionRunOnDeath(state, player) {
  const deadRunKey = player?.bastionRunKey || '';
  if (!deadRunKey) return;
  const run = state.bastionRuns?.get?.(deadRunKey);
  if (run) {
    run.lost = true;
    run.nextWaveAtMs = 0;
  }
  for (const [id, mob] of state.mobs) if (mob.bastionRunKey === deadRunKey) state.mobs.delete(id);
  for (const [id, pr] of state.projectiles) if (pr.bastionRunKey === deadRunKey) state.projectiles.delete(id);
}

function clearCargoOnly(player) {
  if (!player?.inv) return;
  player.inv.resources = {};
  player.inv.cargoUsed = 0;
}

function removeHalfRunEquipment(player) {
  const eq = player?.equipment;
  if (!eq) return;
  const starter = new Set([STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher]);
  const removable = [...new Set(eq.ownedItemIds || [])].filter((id) => id && !starter.has(id));
  const removeCount = Math.ceil(removable.length * 0.5);
  const removed = new Set();
  for (let i = 0; i < removeCount && removable.length; i += 1) {
    const idx = Math.floor(Math.random() * removable.length);
    const [id] = removable.splice(idx, 1);
    removed.add(id);
  }
  if (!removed.size) return;
  eq.ownedItemIds = (eq.ownedItemIds || []).filter((id) => !removed.has(id));
  eq.equippedItemIds = (eq.equippedItemIds || []).filter((id) => !removed.has(id));
  for (const id of removed) {
    delete eq.converterRuntimeById?.[id];
    delete eq.converterEnabledById?.[id];
  }
  for (let i = 0; i < (eq.rocketAmmoSlotItemIds?.length || 0); i += 1) {
    if (removed.has(eq.rocketAmmoSlotItemIds[i])) eq.rocketAmmoSlotItemIds[i] = '';
  }
}

function respawnPlayerAtHubKeepProgress(state, player, timeMs, hint) {
  const pseudo = player.pseudo || 'Pilote';
  player.sessionSetupPending = false;
  player.pseudo = pseudo;
  player.sx = 0;
  player.sy = 0;
  const pos = rollSpawnAround(80, 220);
  player.x = pos.x;
  player.y = pos.y;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.dockedStationId = 0;
  player.dockPhase = 'none';
  player.dockStationId = 0;
  player.dockProg01 = 0;
  player.dockTimer = 0;
  player.bastionReturn = null;
  player.bastionRunKey = '';
  player.bastionBuffs = [];
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
  forceClientPoseTransition(player, 'Retour hub [0,0]…', timeMs, 620);
  setHint(player, hint || 'Vaisseau détruit — retour hub', 3.5);
}

function resetEndlessAfterDeath(state, player, timeMs) {
  clearBastionRunOnDeath(state, player);
  dropPlayerCargo(state, player, timeMs);
  clearCargoOnly(player);
  removeHalfRunEquipment(player);
  respawnPlayerAtHubKeepProgress(state, player, timeMs, 'Destruction — cargo largué, 50% équipement perdu');
}


function resetTestAfterDeath(state, player, timeMs) {
  clearBastionRunOnDeath(state, player);
  const mode = player.gameMode;
  const testWorldId = player.testWorldId || 'test-hub';
  if (mode === GAME_MODES.STRESS) setPlayerStressServer(state, player, timeMs);
  else setPlayerTestWorld(state, player, timeMs, testWorldId);
  forceClientPoseTransition(player, 'Respawn serveur de test…', timeMs, 620);
  setHint(player, 'Test : vaisseau réinitialisé, aucune sauvegarde modifiée', 3.5);
}

function resetBattleAfterDeath(state, player, timeMs) {
  clearBastionRunOnDeath(state, player);
  dropPlayerCargo(state, player, timeMs);
  recordBattleDeath(state, player);
  leaveBattleSession(state, player, timeMs, true);
  clearPlayerBattleResidue(state, player, timeMs, { checkWinner: false });
  clearCargoOnly(player);
  player.gameMode = GAME_MODES.ENDLESS;
  player.battleSessionId = '';
  player.battleQueuedForSeq = 0;
  player.battleEliminated = false;
  player.worldId = WORLD_IDS.SETUP;
  player.sessionSetupPending = true;
  player.sessionSetupStep = 'mode';
  player.sx = 0;
  player.sy = 0;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.dockedStationId = 0;
  player.dockPhase = 'none';
  player.dockStationId = 0;
  player.dockProg01 = 0;
  player.dockTimer = 0;
  player.bastionReturn = null;
  player.bastionRunKey = '';
  player.bastionBuffs = [];
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
  forceClientPoseTransition(player, 'Éliminé — retour sélection…', timeMs, 620);
  setHint(player, 'Éliminé du Battle Royale — choisis un serveur', 3.5);
}

function resetPlayerRunAfterDeath(state, player, timeMs) {
  const pseudo = player.pseudo || 'Pilote';
  const deadRunKey = player.bastionRunKey || '';
  if (deadRunKey) {
    const run = state.bastionRuns?.get?.(deadRunKey);
    if (run) {
      run.lost = true;
      run.nextWaveAtMs = 0;
    }
    for (const [id, mob] of state.mobs) {
      if (mob.bastionRunKey === deadRunKey) state.mobs.delete(id);
    }
    for (const [id, pr] of state.projectiles) {
      if (pr.bastionRunKey === deadRunKey || ((pr.sx | 0) === (player.sx | 0) && (pr.sy | 0) === (player.sy | 0))) state.projectiles.delete(id);
    }
  }
  dropPlayerCargo(state, player, timeMs);
  player.sessionSetupPending = true;
  player.pseudo = pseudo;
  player.sx = 0;
  player.sy = 0;
  const pos = rollSpawnAround(80, 220);
  player.x = pos.x;
  player.y = pos.y;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.dockedStationId = 0;
  player.dockPhase = 'none';
  player.dockStationId = 0;
  player.dockProg01 = 0;
  player.dockTimer = 0;
  player.bastionReturn = null;
  player.bastionRunKey = '';
  player.bastionBuffs = [];
  player.progression = createPlayerProgressionState();
  player.inv = createInventoryState();
  player.equipment = createEquipmentState();
  player.equipment.ownedItemIds = [STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher];
  player.equipment.equippedItemIds = [STARTER_ITEM_IDS.weapon, STARTER_ITEM_IDS.launcher];
  player.equipment.rocketAmmoCountsById = { ...(STARTER_AMMO_LOADOUT.inventory ?? {}) };
  player.equipment.rocketAmmoSlotItemIds = [...(STARTER_AMMO_LOADOUT.slots ?? ['', ''])];
  player.equipment.activeRocketSlot = Math.max(0, Math.min(1, STARTER_AMMO_LOADOUT.activeSlot ?? 0));
  player.frameBonuses = {};
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
  setHint(player, 'Vaisseau détruit — choisis un nouveau départ', 3.5);
}

function grantLifesteal(sourcePlayer, dealtAmount) {
  if (!sourcePlayer?.stats || dealtAmount <= 0) return;
  const ratio = Math.max(
    getOutgoingLifestealRatio(sourcePlayer),
    Math.max(0, sourcePlayer?.progressionBonuses?.lifestealRatio ?? 0)
  );
  if (ratio <= 0) return;
  const healMult = getIncomingHealMultiplier(sourcePlayer) * Math.max(0, sourcePlayer?.progressionBonuses?.healMult ?? 1);
  const requestedHeal = dealtAmount * ratio * healMult;
  if (requestedHeal <= 0) return;
  const applied = healStatBlock(sourcePlayer.stats, requestedHeal);
  const overflow = Math.max(0, requestedHeal - applied);
  const shieldRatio = Math.max(0, Math.min(1, sourcePlayer?.progressionBonuses?.overhealShieldRatio ?? 0));
  if (overflow > 0 && shieldRatio > 0 && sourcePlayer.stats.maxShield > 0) {
    sourcePlayer.stats.shield = Math.min(sourcePlayer.stats.maxShield, sourcePlayer.stats.shield + overflow * shieldRatio);
  }
}

export function applyDamage(state, target, amount, sourcePlayer, options = {}) {
  if (!target || amount <= 0) return;
  const timeMs = getSimulationTimeMs(state, options.timeMs);
  if (target.kind === 'station') return;
  if (target.kind === 'player' && sourcePlayer?.kind === 'player' && sourcePlayer.id !== target.id && isSafeNoPvpSector(target.sx | 0, target.sy | 0) && isSafeNoPvpSector(sourcePlayer.sx | 0, sourcePlayer.sy | 0)) return;
  if (target.invulnerable || target.bastionWall) return;
  if (target.kind === 'player' && isInvulnerable(target)) return;
  if (target.kind === 'player' && isPlayerSessionPending(target)) return;

  const bypassShield = !!options.bypassShield;
  const outgoingFrameDamageMult = sourcePlayer?.frameBonuses?.outgoingDamageMult ?? 1;
  const sourceAdjustedAmount = amount * Math.max(0, outgoingFrameDamageMult);
  const shielded = !!target.stats && (target.stats.shield ?? 0) > 0 && !bypassShield;
  const bastionAdjustedAmount = target.kind === 'player' ? sourceAdjustedAmount * getBastionDefenseMultiplier(target) : sourceAdjustedAmount;
  const frameAdjusted = adjustIncomingDamageByFrame(target, bastionAdjustedAmount);
  const finalAmount = shielded
    ? frameAdjusted * getIncomingShieldDamageMultiplier(target)
    : frameAdjusted * getIncomingHullDamageMultiplier(target);

  if (target.kind !== 'structure') {
    queueDamageNumber(state, target, finalAmount, {
      shielded,
      crit: !!options.crit,
      periodic: !!options.isPeriodic,
      sourceSlot: options.sourceSlot || '',
      visualKind: options.visualKind || ''
    });
    if (!options.isPeriodic) {
      queueWorldSfx(state, shielded ? SFX_EVENT_TYPES.DAMAGE_SHIELD : SFX_EVENT_TYPES.DAMAGE_HULL, target.sx, target.sy, target.x, target.y, options.crit ? 1 : 0);
    }
  }

  if (target.kind === 'player') {
    target.dockedStationId = 0;
    target.dockedTimer = 0;
    target.lastHitAt = timeMs;

    if (!options.ignoreBreakOnHit) breakStatusesOnExternalHit(target, timeMs);
    const died = applyDamageWithShieldPen(target, finalAmount, sourcePlayer, bypassShield);
    onDamageTakenByFrame(state, target, finalAmount, sourcePlayer, timeMs, options);
    grantLifesteal(sourcePlayer, finalAmount);
    if (!died) {
      triggerItemProcsAfterDamage(state, target, sourcePlayer, finalAmount, shielded, options, timeMs);
      return;
    }

    target.deaths += 1;
    if (sourcePlayer && sourcePlayer.kind === 'player' && sourcePlayer.id !== target.id) {
      sourcePlayer.kills += 1;
      gainPlayerXp(sourcePlayer, getPlayerKillXpReward(target), 'destruction hostile');
      onEntityKilledByFrame(state, sourcePlayer, target);
    }

    if (sourcePlayer && sourcePlayer.kind === 'player' && sourcePlayer.id !== target.id && sourcePlayer.gameMode === GAME_MODES.BATTLE) recordBattleKill(state, sourcePlayer);
    if (target.gameMode === GAME_MODES.BATTLE) resetBattleAfterDeath(state, target, timeMs);
    else if (target.gameMode === GAME_MODES.TEST || target.gameMode === GAME_MODES.STRESS) resetTestAfterDeath(state, target, timeMs);
    else resetEndlessAfterDeath(state, target, timeMs);
    return;
  }


  if (target.kind === 'structure') {
    if (options.visualKind === 'auto') return;
    if (target.damageable === false || (target.stats?.maxHp ?? 0) <= 0) return;
    if ((target.stats?.hp ?? 0) <= 0) return;
    if (sourcePlayer?.kind !== 'player' || !canPlayerDamageStructure(state, sourcePlayer, target)) {
      if (sourcePlayer?.kind === 'player' && isStructureProtectedByCore(state, target)) setHint(sourcePlayer, 'Détruis le noyau de base avant de piller cette structure', 1.8);
      return;
    }
    const structureDamage = finalAmount * Math.max(0.15, options.structureDamageMult ?? 0.55);
    queueDamageNumber(state, target, structureDamage, {
      shielded: false,
      crit: !!options.crit,
      periodic: !!options.isPeriodic,
      sourceSlot: options.sourceSlot || '',
      visualKind: options.visualKind || ''
    });
    if (!options.isPeriodic) queueWorldSfx(state, SFX_EVENT_TYPES.DAMAGE_HULL, target.sx, target.sy, target.x, target.y, options.crit ? 1 : 0);
    const died = applyHullDamage(target.stats, structureDamage);
    target.updatedAt = timeMs;
    target.lastDamagedAt = timeMs;
    queueStructureState(state, target, 'damage');
    if (String(target.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
    if (!died) return;
    const wasCore = target.type === 'base_core';
    queueStructureState(state, target, 'destroyed');
    destroyStructure(state, target, timeMs);
    if (sourcePlayer?.kind === 'player') setHint(sourcePlayer, wasCore ? 'Noyau détruit — zone déclaim' : 'Structure détruite', 2.3);
    return;
  }

  if (target.kind === 'mob') {
    if (target.stats.hp <= 0) return;
    const died = applyHullDamage(target.stats, finalAmount);
    grantLifesteal(sourcePlayer, finalAmount);
    if (!died) {
      triggerItemProcsAfterDamage(state, target, sourcePlayer, finalAmount, shielded, options, timeMs);
      return;
    }

    target.diedAt = timeMs;
    target.killedById = sourcePlayer?.id ?? 0;
    dropMobLoot(state, target, timeMs);
    state.mobs.delete(target.id);

    if (sourcePlayer && sourcePlayer.kind === 'player') {
      gainPlayerXp(sourcePlayer, getMobXpReward(target), `${target.name} éliminé`);
      const questUpdates = registerPirateQuestKill(sourcePlayer, target.mobId);
      if (questUpdates.length) {
        const last = questUpdates[questUpdates.length - 1];
        sourcePlayer.uiHint = `${last.name} : ${last.current}/${last.required}`;
        sourcePlayer.uiHintTimer = 1.9;
      }
      onEntityKilledByFrame(state, sourcePlayer, target);
    }
    return;
  }

  if (target.kind === 'asteroid') {
    if (target.stats.hp <= 0) return;
    const died = applyHullDamage(target.stats, finalAmount);
    grantLifesteal(sourcePlayer, finalAmount);
    if (!died) triggerItemProcsAfterDamage(state, target, sourcePlayer, finalAmount, shielded, options, timeMs);
    if (target.demoDummy) {
      target.stats.hp = target.stats.maxHp;
      target.stats.shield = target.stats.maxShield ?? 0;
      return;
    }
    if (died) {
      const t = timeMs;
      target.respawnAt = 0;
      target.diedAt = t;
      target.killedById = sourcePlayer?.id ?? 0;
      if (sourcePlayer && sourcePlayer.kind === 'player') {
        gainPlayerXp(sourcePlayer, getAsteroidXpReward(target), target.secret ? 'anomalie minée' : 'astéroïde détruit');
        onEntityKilledByFrame(state, sourcePlayer, target);
      }
      target.dropsSpawned = false;

      if (target.sig) {
        state.destroyedAsteroidSigs?.add?.(target.sig);
        state.asteroidCooldownUntil.delete(target.sig);
      }
    }
  }
}
