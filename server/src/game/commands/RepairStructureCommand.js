import { repairStructure } from '../structures/StructureRepair.js';

export function handleRepairStructure(state, player, msg, timeMs) {
  const result = repairStructure(state, player, msg.structureId, timeMs);
  player.forceFullUiSnapshot = true;
  player.forceFullUiSnapshotReason = result.ok ? 'repair_structure' : result.error;
  if (!result.ok) player.hint = repairErrorHint(result.error);
  else player.hint = 'Structure réparée';
  player._optimisticHintLeft = 1.2;
  return !!result.ok;
}

function repairErrorHint(error) {
  switch (error) {
    case 'core_cannot_repair': return 'Le noyau se régénère seul';
    case 'not_owner': return 'Cette structure ne t’appartient pas';
    case 'not_damaged': return 'Structure déjà intacte';
    case 'too_far': return 'Structure trop loin';
    case 'missing_resources': return 'Ressources insuffisantes';
    case 'wrong_world':
    case 'wrong_sector':
    case 'not_found': return 'Structure introuvable';
    default: return 'Réparation impossible';
  }
}
