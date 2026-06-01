import { buildStatBlockSnapshot } from '../../stats/StatBlockSnapshot.js';
import { buildStatusSnapshot } from '../../status/StatusView.js';
import { buildFrameUiState } from '../../frames/FrameGameplayHooks.js';

function getFrameTempShieldAmount(player) {
  if (!Array.isArray(player?.frameTempShields)) return 0;
  return player.frameTempShields.reduce((sum, shield) => sum + Math.max(0, shield.amount || 0), 0);
}

function buildPlayerVitals(player) {
  const vitals = buildStatBlockSnapshot(player.stats);
  const tempShield = getFrameTempShieldAmount(player);
  return tempShield > 0 ? { ...vitals, tempShield } : vitals;
}

export function buildPlayerSnapshots(players, inSector, timeMs) {
  return [...players.values()]
    .filter(inSector)
    .map((player) => ({
      id: player.id,
      pseudo: player.pseudo || `Joueur ${player.id}`,
      frameName: player.frameName || '',
      frameId: player.frameId,
      sx: player.sx | 0,
      sy: player.sy | 0,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      rot: player.rot ?? 0,
      radius: player.radius,
      engine: player.engine,
      vitals: buildPlayerVitals(player),
      autoTargetKind: player.autoTargetKind,
      autoTargetId: player.autoTargetId,
      groundMarkerX: player.groundMarkerX,
      groundMarkerY: player.groundMarkerY,
      groundMarkerTimer: player.groundMarkerTimer,
      rocketCooldownLeft: player.rocketCooldownLeft,
      abilityA: player.abilityA,
      abilityZ: player.abilityZ,
      abilityE: player.abilityE,
      abilityR: player.abilityR,
      dockedStationId: player.dockedStationId,
      dockPhase: player.dockPhase || 'none',
      dockStationId: player.dockStationId || 0,
      dockProg01: player.dockProg01 || 0,
      lastHitAt: player.lastHitAt,
      nextShotAt: player.nextShotAt,
      kills: player.kills,
      deaths: player.deaths,
      level: player.progression?.level ?? 1,
      statuses: buildStatusSnapshot(player),
      frameState: buildFrameUiState(player, timeMs)
    }));
}
