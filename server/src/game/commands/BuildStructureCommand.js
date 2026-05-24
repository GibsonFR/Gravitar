import { placeStructure } from '../structures/StructurePlacement.js';

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function handleBuildStructure(state, player, msg, timeMs) {
  const type = String(msg.structureType || msg.type || '').toLowerCase();
  const rawOrientation = String(msg.orientation || 'h').toLowerCase();
  const orientation = ['h', 'v', 'r', 'd', 'l', 'u'].includes(rawOrientation) ? rawOrientation : 'h';
  const x = finite(msg.x, player.x + Math.cos(player.rot || 0) * 170);
  const y = finite(msg.y, player.y + Math.sin(player.rot || 0) * 170);
  const result = placeStructure(state, player, type, x, y, orientation, timeMs);
  player.forceFullUiSnapshot = true;
  player.forceFullUiSnapshotReason = result.ok ? 'build_structure' : result.error;
  if (!result.ok) player.hint = buildErrorHint(result.error);
  else player.hint = `${result.structure?.name || 'Structure'} posée`;
  player._optimisticHintLeft = 1.2;
  return !!result.ok;
}

function buildErrorHint(error) {
  switch (error) {
    case 'core_exists': return 'Un noyau de base existe déjà';
    case 'need_nearby_core': return 'Il faut poser près de ton noyau';
    case 'too_far': return 'Placement trop loin du vaisseau';
    case 'blocked':
    case 'blocked_by_structure': return 'Placement bloqué';
    case 'missing_resources': return 'Ressources insuffisantes';
    case 'too_close_to_base': return 'Trop proche d’une autre base';
    case 'too_close_to_sector_edge': return 'Trop proche du bord du secteur';
    case 'too_close_to_station': return 'Trop proche d’une station';
    default: return 'Placement impossible';
  }
}
