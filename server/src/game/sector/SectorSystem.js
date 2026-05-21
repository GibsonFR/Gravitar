import { SECTOR } from './SectorDefs.js';
import { sectorKey } from './SectorKey.js';
import { wrapIntoSector } from './SectorMath.js';
import { ensureSectorLoaded } from './SectorEnsure.js';
import { visitSectorOnPlayer } from '../map/PlayerMapState.js';
import { isSpecialDetachedSector } from './SpecialSectors.js';
import { BATTLE, isBattleArenaSector } from '../modes/GameModes.js';


function clampDetachedPlayer(p) {
  const pad = Math.max(18, p.radius ?? 18) + 24;
  const half = isBattleArenaSector(p.sx | 0, p.sy | 0) ? BATTLE.arenaHalf : SECTOR.half;
  const min = -half + pad;
  const max = half - pad;
  const cx = Math.max(min, Math.min(max, p.x));
  const cy = Math.max(min, Math.min(max, p.y));
  if (cx !== p.x) { p.x = cx; p.vx = 0; p.hasMoveTarget = false; }
  if (cy !== p.y) { p.y = cy; p.vy = 0; p.hasMoveTarget = false; }
}

function unloadSector(state, sx, sy) {
  const key = sectorKey(sx, sy);

  for (const [id, a] of state.asteroids) {
    if ((a.sx | 0) === sx && (a.sy | 0) === sy) state.asteroids.delete(id);
  }
  for (const [id, m] of state.mobs) {
    if ((m.sx | 0) === sx && (m.sy | 0) === sy) state.mobs.delete(id);
  }
  for (const [id, s] of state.stations) {
    if ((s.sx | 0) === sx && (s.sy | 0) === sy) state.stations.delete(id);
  }
  for (const [id, p] of state.portals) {
    if ((p.sx | 0) === sx && (p.sy | 0) === sy) state.portals.delete(id);
  }
  for (const [id, l] of state.loots) {
    if ((l.sx | 0) === sx && (l.sy | 0) === sy) state.loots.delete(id);
  }
  for (const [id, pr] of state.projectiles) {
    if ((pr.sx | 0) === sx && (pr.sy | 0) === sy) state.projectiles.delete(id);
  }

  state.sectors.delete(key);
}


function beginSectorTransition(player, sx, sy, timeMs) {
  const id = ((player.sectorTransitionId | 0) + 1) | 0;
  player.sectorTransitionId = id;
  player.portalTransition = {
    id,
    type: 'sector',
    label: `Secteur [${sx | 0},${sy | 0}]`,
    targetSx: sx | 0,
    targetSy: sy | 0,
    startedAt: timeMs,
    until: timeMs + 260,
    forceServerPose: true
  };
  // Pendant un passage de frontière, les derniers inputs client de l'ancien secteur
  // ne doivent pas pouvoir remettre le joueur de l'autre côté. On garde un gel très
  // court, masqué par l'écran de transition, puis on rend la main au client.
  player.ignoreClientPoseUntil = Math.max(player.ignoreClientPoseUntil ?? 0, timeMs + 320);
  player.clientAuthoritativeUntil = 0;
}

function applyWrapToPlayer(state, p, timeMs) {
  const beforeSx = p.sx | 0;
  const beforeSy = p.sy | 0;
  if (isSpecialDetachedSector(beforeSx, beforeSy)) {
    clampDetachedPlayer(p);
    return;
  }

  // Anti ping-pong de frontière : après un changement de secteur, on empêche
  // pendant quelques frames un retour immédiat dans le secteur précédent causé
  // par une pose client/snapshot légèrement en retard. Sans ça, les coins de
  // secteurs peuvent déclencher des allers-retours violents.
  const lockUntil = Number.isFinite(p.sectorLockUntil) ? p.sectorLockUntil : 0;
  if (timeMs < lockUntil) {
    const pad = Math.max(28, (p.radius ?? 18) + 12);
    if ((p.sectorLockDirX | 0) > 0 && p.x < -SECTOR.half) p.x = -SECTOR.half + pad;
    if ((p.sectorLockDirX | 0) < 0 && p.x > SECTOR.half) p.x = SECTOR.half - pad;
    if ((p.sectorLockDirY | 0) > 0 && p.y < -SECTOR.half) p.y = -SECTOR.half + pad;
    if ((p.sectorLockDirY | 0) < 0 && p.y > SECTOR.half) p.y = SECTOR.half - pad;
  }

  const beforeX = p.x;
  const beforeY = p.y;

  const w = wrapIntoSector({ x: p.x, y: p.y }, beforeSx, beforeSy);
  const changed = (beforeSx !== w.sx) || (beforeSy !== w.sy);
  p.x = w.x;
  p.y = w.y;
  p.sx = w.sx;
  p.sy = w.sy;

  if (changed) {
    const dirX = (w.sx | 0) - beforeSx;
    const dirY = (w.sy | 0) - beforeSy;
    // Le wrap garde exactement l'overshoot : traverser la ligne x=2000 place le
    // joueur à x=-2000+overshoot dans le secteur suivant, et inversement. Aucun
    // recentrage, aucun preload voisin. On masque juste le chargement de contenu.
    p.sectorLockUntil = timeMs + 220;
    p.sectorLockDirX = dirX;
    p.sectorLockDirY = dirY;
    beginSectorTransition(p, w.sx | 0, w.sy | 0, timeMs);
  }
  if (!changed) return;

  const dx = p.x - beforeX;
  const dy = p.y - beforeY;

  // Keep movement targets continuous across sector boundaries.
  if (p.hasMoveTarget) {
    p.moveTx += dx;
    p.moveTy += dy;
  }
  if (p.groundMarkerTimer > 0) {
    p.groundMarkerX += dx;
    p.groundMarkerY += dy;
  }

  // Drop stale combat references only. Movement is deliberately preserved so a border
  // crossing does not feel like a teleport/stop/rollback.
  p.selectedKind = '';
  p.selectedId = 0;
  p.autoTargetKind = '';
  p.autoTargetId = 0;

  // Cancel docking state across sectors.
  p.dockPhase = 'none';
  p.dockStationId = 0;
  p.dockProg01 = 0;
  p.dockTimer = 0;
  p.dockedStationId = 0;

  visitSectorOnPlayer(state, p, p.sx | 0, p.sy | 0, timeMs);
}

function applyWrapToMob(mob) {
  if (isSpecialDetachedSector(mob.sx | 0, mob.sy | 0)) return;
  const w = wrapIntoSector({ x: mob.x, y: mob.y }, mob.sx | 0, mob.sy | 0);
  mob.x = w.x;
  mob.y = w.y;
  mob.sx = w.sx;
  mob.sy = w.sy;
  mob.homeX = Math.max(-SECTOR.half, Math.min(SECTOR.half, mob.homeX));
  mob.homeY = Math.max(-SECTOR.half, Math.min(SECTOR.half, mob.homeY));
}

function applyWrapToProjectile(pr) {
  if (isSpecialDetachedSector(pr.sx | 0, pr.sy | 0)) return;
  const w = wrapIntoSector({ x: pr.x, y: pr.y }, pr.sx | 0, pr.sy | 0);
  pr.x = w.x;
  pr.y = w.y;
  pr.sx = w.sx;
  pr.sy = w.sy;
}

function applyWrapToLoot(l) {
  if (isSpecialDetachedSector(l.sx | 0, l.sy | 0)) return;
  const w = wrapIntoSector({ x: l.x, y: l.y }, l.sx | 0, l.sy | 0);
  l.x = w.x;
  l.y = w.y;
  l.sx = w.sx;
  l.sy = w.sy;
}

export function updateSectors(state, dt, timeMs) {
  // 1) Wrap dynamic entities into sectors.
  for (const p of state.players.values()) applyWrapToPlayer(state, p, timeMs);
  for (const mob of state.mobs.values()) applyWrapToMob(mob);
  for (const pr of state.projectiles.values()) applyWrapToProjectile(pr);
  for (const l of state.loots.values()) applyWrapToLoot(l);

  // 2) Ensure content exists for all currently occupied sectors.
  const active = new Set();
  for (const p of state.players.values()) {
    const sx = p.sx | 0;
    const sy = p.sy | 0;
    active.add(sectorKey(sx, sy));
    ensureSectorLoaded(state, sx, sy, timeMs);

    // Pas de préchargement des voisins ici : les passages de secteur utilisent le
    // même modèle que les portails, avec une courte transition. Cela évite les
    // coins qui chargent trop de secteurs et les états hybrides old/new sector.
  }

  // 3) Unload sectors with no players after a grace period.
  for (const s of [...state.sectors.values()]) {
    const key = sectorKey(s.sx, s.sy);
    if (active.has(key)) continue;
    if ((timeMs - (s.lastActiveAt | 0)) > SECTOR.unloadAfterMs) {
      unloadSector(state, s.sx, s.sy);
    }
  }
}
