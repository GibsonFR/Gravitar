import { STRUCTURE_TYPES } from './StructureDefs.js';
import { getPlayerOwnerKey, getStructureClaimRect, isStructureAlive, isStructureOwner } from './StructureSystem.js';
import { setPlayerHint } from '../player/PlayerUiHints.js';

const INTRUSION_HINT_COOLDOWN_MS = 12000;

function isCoreType(type) {
  const t = String(type || '').toLowerCase();
  return t === STRUCTURE_TYPES.BASE_CORE || t === STRUCTURE_TYPES.OUTPOST_CORE;
}

function sameWorld(player, structure) {
  return String(player?.worldId || 'endless') === String(structure?.worldId || 'endless');
}

function pointInsideRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function baseTypeLabel(core) {
  return String(core?.type || '').toLowerCase() === STRUCTURE_TYPES.OUTPOST_CORE ? 'Avant-poste' : 'Base';
}

function corePriority(core) {
  return String(core?.type || '').toLowerCase() === STRUCTURE_TYPES.BASE_CORE ? 0 : 1;
}

export function findHostileBaseCoreAtPlayer(state, player) {
  if (!state?.structures || !player) return null;
  const playerOwner = getPlayerOwnerKey(player);
  let best = null;
  let bestPriority = Infinity;
  let bestArea = Infinity;

  for (const core of state.structures.values()) {
    if (!isCoreType(core?.type)) continue;
    if (!isStructureAlive(core)) continue;
    if (!sameWorld(player, core)) continue;
    if ((core.sx | 0) !== (player.sx | 0) || (core.sy | 0) !== (player.sy | 0)) continue;
    if (isStructureOwner(player, core)) continue;
    const owner = String(core.ownerKey || '').toLowerCase();
    if (owner && owner === playerOwner) continue;

    const claim = getStructureClaimRect(core);
    if (!pointInsideRect(player.x, player.y, claim)) continue;

    const priority = corePriority(core);
    const area = Math.max(0, claim.right - claim.left) * Math.max(0, claim.bottom - claim.top);
    if (priority < bestPriority || (priority === bestPriority && area < bestArea)) {
      best = core;
      bestPriority = priority;
      bestArea = area;
    }
  }

  return best;
}

export function buildHostileBaseIntrusionSnapshot(player) {
  const intrusion = player?.hostileBaseIntrusion || null;
  if (!intrusion?.active) return null;
  return {
    active: true,
    coreId: intrusion.coreId | 0,
    ownerName: intrusion.ownerName || 'Pilote inconnu',
    baseType: intrusion.baseType || 'Base',
    sx: intrusion.sx | 0,
    sy: intrusion.sy | 0,
    enteredAt: intrusion.enteredAt || 0
  };
}

export function updatePlayerBaseIntrusion(state, player, timeMs = Date.now()) {
  if (!player) return null;
  const core = findHostileBaseCoreAtPlayer(state, player);
  const previous = player.hostileBaseIntrusion || null;

  if (!core) {
    if (previous?.active) {
      player.hostileBaseIntrusion = {
        active: false,
        coreId: 0,
        ownerName: '',
        baseType: '',
        sx: player.sx | 0,
        sy: player.sy | 0,
        enteredAt: 0,
        lastHintAt: previous.lastHintAt || 0
      };
      player.forceFullUiSnapshot = true;
      player.forceFullUiSnapshotReason = 'hostile_base_exit';
    }
    return null;
  }

  const coreId = core.id | 0;
  const sameCore = previous?.active && (previous.coreId | 0) === coreId;
  const ownerName = core.ownerName || 'Pilote inconnu';
  const baseType = baseTypeLabel(core);
  const enteredAt = sameCore ? (previous.enteredAt || timeMs) : timeMs;
  const lastHintAt = previous?.lastHintAt || 0;
  const shouldHint = !sameCore || timeMs - lastHintAt >= INTRUSION_HINT_COOLDOWN_MS;

  player.hostileBaseIntrusion = {
    active: true,
    coreId,
    ownerName,
    baseType,
    sx: core.sx | 0,
    sy: core.sy | 0,
    enteredAt,
    lastHintAt: shouldHint ? timeMs : lastHintAt
  };

  if (!sameCore) {
    player.forceFullUiSnapshot = true;
    player.forceFullUiSnapshotReason = 'hostile_base_enter';
  }

  if (shouldHint) setPlayerHint(player, `${baseType} ennemie : ${ownerName}`, 2.8);
  return player.hostileBaseIntrusion;
}
