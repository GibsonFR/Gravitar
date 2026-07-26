import { removeStructure } from '../structures/StructureRemoval.js';

export function handleRemoveStructure(state, player, msg, timeMs) {
  const result = removeStructure(state, player, msg.structureId, timeMs);
  player.forceFullUiSnapshot = true;
  player.forceFullUiSnapshotReason = result.ok ? 'remove_structure' : result.error;
  if (!result.ok) player.hint = removeErrorHint(result.error);
  else player.hint = refundHint(result.refund);
  player._optimisticHintLeft = 1.2;
  return !!result.ok;
}

function refundHint(refund) {
  const parts = Object.entries(refund || {})
    .filter(([, amount]) => (amount | 0) > 0)
    .map(([key, amount]) => `${amount | 0} ${key}`);
  return parts.length ? `Structure déconstruite — matériaux rendus : ${parts.join(', ')}` : 'Structure déconstruite';
}

function removeErrorHint(error) {
  switch (error) {
    case 'not_owner': return 'Cette structure ne t’appartient pas';
    case 'natural_deposit': return 'Impossible de démolir un gisement naturel';
    case 'too_far': return 'Structure trop loin';
    case 'storage_not_empty': return 'Vide le coffre avant de le démonter';
    case 'core_not_empty':
    case 'core_has_structures': return 'Démonte les structures protégées avant le noyau';
    case 'foundation_in_use': return 'Une structure est posée sur cette fondation';
    case 'cargo_full_for_refund': return 'Soute pleine : libère de la place pour récupérer les matériaux';
    case 'wrong_world':
    case 'wrong_sector':
    case 'not_found': return 'Structure introuvable';
    default: return 'Démolition impossible';
  }
}
