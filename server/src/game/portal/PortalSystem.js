import { visitSectorOnPlayer } from '../map/PlayerMapState.js';
import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { syncPlayerFrameStats } from '../frames/FrameStatSync.js';
import { distSq } from '../util/Math.js';
import { enterBastion, exitBastion } from '../bastion/BastionSystem.js';
import { getBastionAtSector, isBastionUnlockedForPlayer } from '../bastion/BastionSession.js';


function prepareTestArenaPlayer(player) {
  if (!player?.progression) return;
  player.progression.level = Math.max(player.progression.level ?? 1, 18);
  player.progression.skillPoints = Math.max(player.progression.skillPoints ?? 0, 20);
  player.progression.abilityLevels = {
    A: Math.max(player.progression.abilityLevels?.A ?? 0, 10),
    Z: Math.max(player.progression.abilityLevels?.Z ?? 0, 10),
    E: Math.max(player.progression.abilityLevels?.E ?? 0, 10),
    R: Math.max(player.progression.abilityLevels?.R ?? 0, 3)
  };
  player.progression.recentXpGain = 0;
  player.progression.recentXpReason = 'arène de test';
  player.progression.levelUpFlashLeft = Math.max(player.progression.levelUpFlashLeft ?? 0, 1.6);
  player.cooldownALeft = 0;
  player.cooldownZLeft = 0;
  player.cooldownELeft = 0;
  player.cooldownRLeft = 0;
  player.rocketCooldownLeft = 0;
  syncPlayerFrameStats(player, { restoreVitals: true, preserveRatios: false });
  restoreStatBlockFull(player.stats);
}

export function tryUsePortal(state, player, timeMs) {
  if (!player.interactTap) return false;
  if (player.dockPhase !== 'none' || (player.dockedStationId | 0) !== 0) return false;

  let best = null;
  let bestD2 = Infinity;
  for (const portal of state.portals.values()) {
    if ((portal.sx | 0) !== (player.sx | 0) || (portal.sy | 0) !== (player.sy | 0)) continue;
    const d2 = distSq(player.x, player.y, portal.x, portal.y);
    const r = (player.radius + portal.radius + 16);
    if (d2 > r * r) continue;
    if (d2 < bestD2) { bestD2 = d2; best = portal; }
  }

  if (!best) return false;

  const nextOk = player.nextPortalAt ?? 0;
  if (timeMs < nextOk) return true;
  player.nextPortalAt = timeMs + (best.cooldownMs ?? 800);

  if (best.mode === 'bastion_entry') {
    const bastion = getBastionAtSector(state, player.sx | 0, player.sy | 0);
    if (!bastion) return true;
    if ((player.completedBastionIds || []).includes(bastion.id | 0)) { player.uiHint = 'Bastion déjà réussi avec ce pilote'; player.uiHintTimer = 1.8; return true; }
    // Endless: les bastions sont ouverts directement. Les anciens timers restent seulement utiles pour d'autres modes spéciaux.
    if (player.gameMode !== 'endless' && !isBastionUnlockedForPlayer(player, bastion, timeMs, state)) { player.uiHint = 'Bastion encore verrouillé'; player.uiHintTimer = 1.8; return true; }
    enterBastion(state, player, bastion, timeMs);
    visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
    return true;
  }

  if (best.mode === 'bastion_exit') {
    exitBastion(state, player, timeMs);
    visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
    return true;
  }

  // Teleport: keep local coordinates in the target sector.
  player.sx = best.targetSx | 0;
  player.sy = best.targetSy | 0;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  if (best.mode === 'test_arena' || best.mode === 'mob_bestiary') prepareTestArenaPlayer(player);
  player.uiHint = best.mode === 'test_arena' ? 'Simulateur activé' : (best.mode === 'mob_bestiary' ? 'Bestiaire activé' : `Saut → [${player.sx},${player.sy}]`);
  player.uiHintTimer = (best.mode === 'test_arena' || best.mode === 'mob_bestiary') ? 2.8 : 1.2;
  visitSectorOnPlayer(state, player, player.sx | 0, player.sy | 0, timeMs);
  return true;
}
