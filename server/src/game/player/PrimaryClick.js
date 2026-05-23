import { distSq, screenToWorld } from '../util/Math.js';
import { getTargetForPlayer, isPlayerAttackable } from '../targeting/Targeting.js';
import { isPlayerSessionPending } from './PlayerSessionSetup.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { sameWorld } from '../modes/GameModes.js';
import { canPlayerDamageStructure, distanceSqToStructureRect } from '../structures/StructureSystem.js';
import { isStorageStructure, canPlayerAccessStorage } from '../structures/StructureStorage.js';

function pickPrimaryTarget(state, player, worldX, worldY) {
  let bestAttack = null;
  let bestAttackD2 = Infinity;
  let bestInteract = null;
  let bestInteractD2 = Infinity;

  if (!isSafeNoPvpSector(player.sx | 0, player.sy | 0)) for (const other of state.players.values()) {
    if (other.id === player.id) continue;
    if (!sameWorld(player, other)) continue;
    if (isPlayerSessionPending(other)) continue;
    if ((other.sx | 0) !== (player.sx | 0) || (other.sy | 0) !== (player.sy | 0)) continue;
    const pickR = Math.max(42, other.radius + 30);
    const d2 = distSq(other.x, other.y, worldX, worldY);
    if (d2 > pickR * pickR) continue;
    if (d2 < bestAttackD2) { bestAttackD2 = d2; bestAttack = { kind: 'player', id: other.id }; }
  }

  for (const mob of state.mobs.values()) {
    if (mob.stats.hp <= 0) continue;
    if ((mob.sx | 0) !== (player.sx | 0) || (mob.sy | 0) !== (player.sy | 0)) continue;
    const pickR = Math.max(46, mob.radius + 34);
    const d2 = distSq(mob.x, mob.y, worldX, worldY);
    if (d2 > pickR * pickR) continue;
    if (d2 < bestAttackD2) { bestAttackD2 = d2; bestAttack = { kind: 'mob', id: mob.id }; }
  }

  for (const a of state.asteroids.values()) {
    if (a.bastionWall || a.unselectable) continue;
    if (a.stats.hp <= 0) continue;
    if ((a.sx | 0) !== (player.sx | 0) || (a.sy | 0) !== (player.sy | 0)) continue;
    const pickR = Math.max(52, a.radius + 36);
    const d2 = distSq(a.x, a.y, worldX, worldY);
    if (d2 > pickR * pickR) continue;
    if (d2 < bestAttackD2) { bestAttackD2 = d2; bestAttack = { kind: 'asteroid', id: a.id }; }
  }

  for (const st of state.structures?.values?.() || []) {
    if (!canPlayerDamageStructure(state, player, st)) continue;
    if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) continue;
    const pickR = 34;
    const d2 = distanceSqToStructureRect(st, worldX, worldY);
    if (d2 > pickR * pickR) continue;
    if (d2 < bestAttackD2) { bestAttackD2 = d2; bestAttack = { kind: 'structure', id: st.id }; }
  }

  for (const st of state.structures?.values?.() || []) {
    if (!isStorageStructure(st)) continue;
    if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) continue;
    const pickR = 28;
    const d2 = distanceSqToStructureRect(st, worldX, worldY);
    if (d2 > pickR * pickR) continue;
    if (!canPlayerAccessStorage(state, player, st)) continue;
    if (d2 < bestInteractD2) { bestInteractD2 = d2; bestInteract = { kind: 'storage', id: st.id }; }
  }

  for (const s of state.stations.values()) {
    if ((s.sx | 0) !== (player.sx | 0) || (s.sy | 0) !== (player.sy | 0)) continue;
    const pickR = Math.max(48, s.radius + 34);
    const d2 = distSq(s.x, s.y, worldX, worldY);
    if (d2 > pickR * pickR) continue;
    if (d2 < bestInteractD2) { bestInteractD2 = d2; bestInteract = { kind: 'station', id: s.id }; }
  }

  return { attack: bestAttack, interact: bestInteract };
}

export function applyPrimaryClick(state, player, screenX, screenY) {
  const world = screenToWorld(player, screenX, screenY);
  const { attack, interact } = pickPrimaryTarget(state, player, world.x, world.y);

  if (attack) {
    const target = getTargetForPlayer(state, player, attack.kind, attack.id);
    if (isPlayerAttackable(state, player, target)) {
      player.selectedKind = attack.kind;
      player.selectedId = attack.id;
      player.autoTargetKind = attack.kind;
      player.autoTargetId = attack.id;
      player.hasMoveTarget = false;
      player.holdMoveAllowed = false;
      player.groundMarkerTimer = 0;
      return 'attack';
    }
  }

  if (interact) {
    if (interact.kind === 'storage') {
      const storage = state.structures?.get?.(interact.id | 0);
      if (storage && canPlayerAccessStorage(state, player, storage)) {
        player.openStorageId = storage.id | 0;
        player.forceFullUiSnapshot = true;
        player.selectedKind = 'structure';
        player.selectedId = storage.id | 0;
        player.hasMoveTarget = false;
        player.holdMoveAllowed = false;
        player.groundMarkerTimer = 0;
        return 'storage';
      }
    }
    const target = getTargetForPlayer(state, player, interact.kind, interact.id);
    player.selectedKind = interact.kind;
    player.selectedId = interact.id;
    if (target) {
      player.moveTx = target.x;
      player.moveTy = target.y;
      player.hasMoveTarget = true;
      player.holdMoveAllowed = false;
      player.groundMarkerTimer = 0;
      return 'interact';
    }
  }

  player.moveTx = world.x;
  player.moveTy = world.y;
  player.hasMoveTarget = true;
  player.holdMoveAllowed = true;
  player.groundMarkerX = world.x;
  player.groundMarkerY = world.y;
  player.groundMarkerTimer = 0.85;
  return 'move';
}
