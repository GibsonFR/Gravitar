import { dist } from '../util/Math.js';
import { DOCKING } from './DockingDefs.js';
import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';

function easeOutCubic(t) {
  const a = 1 - Math.max(0, Math.min(1, t));
  return 1 - a * a * a;
}

export function isDockLocked(player) {
  return player?.dockPhase === 'docking' || player?.dockPhase === 'docked';
}

export function forceUndock(player) {
  if (!player) return;
  player.dockPhase = 'none';
  player.dockStationId = 0;
  player.dockProg01 = 0;
  player.dockTimer = 0;
  player.dockedStationId = 0;
}

export function requestDockAtNearestStation(state, player) {
  if (!state || !player) return false;
  if (player.dockPhase && player.dockPhase !== 'none') return false;

  let best = null;
  let bestD = Infinity;
  for (const s of state.stations.values()) {
    if ((s.sx | 0) !== (player.sx | 0) || (s.sy | 0) !== (player.sy | 0)) continue;
    const d = dist(player.x, player.y, s.x, s.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  if (!best || bestD > DOCKING.interactRange) return false;

  player.dockPhase = 'docking';
  player.dockStationId = best.id;
  player.dockTimer = 0;
  player.dockProg01 = 0;
  player.dockStartX = player.x;
  player.dockStartY = player.y;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.vx = 0;
  player.vy = 0;
  return true;
}

export function tickDocking(state, player, dt) {
  if (!state || !player) return false;

  const phase = player.dockPhase || 'none';
  if (phase === 'none') return false;

  const station = state.stations.get(player.dockStationId || player.dockedStationId);
  if (!station || (station.sx | 0) !== (player.sx | 0) || (station.sy | 0) !== (player.sy | 0)) {
    forceUndock(player);
    return false;
  }

  if (phase === 'docking') {
    const dur = player.dockDuration || DOCKING.dockDuration;
    player.dockTimer = (player.dockTimer || 0) + dt;
    const t01 = Math.max(0, Math.min(1, player.dockTimer / Math.max(0.001, dur)));
    player.dockProg01 = t01;

    const k = easeOutCubic(t01);
    const tx = station.x + DOCKING.dockOffsetX;
    const ty = station.y + DOCKING.dockOffsetY;
    player.x = player.dockStartX + (tx - player.dockStartX) * k;
    player.y = player.dockStartY + (ty - player.dockStartY) * k;
    player.vx = 0;
    player.vy = 0;

    if (t01 >= 1) {
      player.dockPhase = 'docked';
      player.dockedStationId = station.id;
      restoreStatBlockFull(player.stats);
    }
    return true;
  }

  if (phase === 'docked') {
    player.dockProg01 = 1;
    player.dockedStationId = station.id;
    const tx = station.x + DOCKING.dockOffsetX;
    const ty = station.y + DOCKING.dockOffsetY;
    player.x = tx;
    player.y = ty;
    player.vx = 0;
    player.vy = 0;

    const far = dist(player.x, player.y, station.x, station.y) > DOCKING.interactRange + 140;
    if (far) forceUndock(player);
    return true;
  }

  return false;
}
