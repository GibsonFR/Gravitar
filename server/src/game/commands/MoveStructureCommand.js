import { moveStructure } from '../structures/StructureMovement.js';

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function handleMoveStructure(state, player, msg, timeMs) {
  const x = finite(msg.x, player.x + Math.cos(player.rot || 0) * 170);
  const y = finite(msg.y, player.y + Math.sin(player.rot || 0) * 170);
  const result = moveStructure(state, player, msg.structureId, x, y, msg.orientation || null, timeMs);
  player.forceFullUiSnapshot = true;
  player.forceFullUiSnapshotReason = result.ok ? 'move_structure' : result.error;
  if (!result.ok) {
    player.hint = moveErrorHint(result.error);
    if (result.debug) console.warn('[move_structure:refused]', result.error, result.debug);
    else console.warn('[move_structure:refused]', result.error, { structureId: msg.structureId, x, y, orientation: msg.orientation || null });
  } else {
    player.hint = `${result.structure?.name || 'Structure'} déplacée`;
  }
  player._optimisticHintLeft = 1.2;
  return !!result.ok;
}

function moveErrorHint(error) {
  switch (error) {
    case 'not_owner': return 'Cette structure ne t’appartient pas';
    case 'core_move_forbidden': return 'Impossible de déplacer un noyau';
    case 'natural_deposit': return 'Impossible de déplacer un gisement naturel';
    case 'need_nearby_core': return 'Déplacement hors zone de noyau';
    case 'too_far': return 'Déplacement trop loin du vaisseau';
    case 'too_close_to_sector_edge': return 'Trop proche du bord du secteur';
    case 'blocked':
    case 'blocked_by_structure': return 'Nouvel emplacement bloqué';
    case 'too_close_to_station': return 'Trop proche d’une station';
    case 'wrong_world':
    case 'wrong_sector':
    case 'not_found': return 'Structure introuvable';
    default: return 'Déplacement impossible';
  }
}
