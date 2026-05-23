import { removeStructure } from '../structures/StructureRemoval.js';

export function handleRemoveStructure(state, player, msg, timeMs) {
  const result = removeStructure(state, player, msg.structureId, timeMs);
  player.forceFullUiSnapshot = true;
  player.forceFullUiSnapshotReason = result.ok ? 'remove_structure' : result.error;
  if (!result.ok) player.hint = removeErrorHint(result.error);
  else player.hint = 'Structure déconstruite';
  player._optimisticHintLeft = 1.2;
  return !!result.ok;
}

function removeErrorHint(error) {
  switch (error) {
    case 'not_owner': return 'Cette structure ne t’appartient pas';
    case 'too_far': return 'Structure trop loin';
    case 'wrong_world':
    case 'wrong_sector':
    case 'not_found': return 'Structure introuvable';
    default: return 'Démolition impossible';
  }
}
