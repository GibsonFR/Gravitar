import { clearStatusesByPredicate } from './StatusRack.js';
import { getStatusEffectDef } from '../../../../shared/content/status/StatusEffectDefs.js';
import {
  isBuffStatus,
  isCleanseableStatus,
  isDebuffStatus
} from '../../../../shared/content/status/StatusEffectRules.js';
import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';

function isHardLockedStatus(entry) {
  return entry.id === I.KNOCKUP || entry.id === I.SUPPRESS || entry.id === I.STASIS;
}

export function cleanseStandard(entity) {
  return clearStatusesByPredicate(entity, (entry) => {
    const def = getStatusEffectDef(entry.id);
    return isDebuffStatus(def) && isCleanseableStatus(def) && !isHardLockedStatus(entry);
  });
}

export function cleanseControlOnly(entity) {
  return clearStatusesByPredicate(entity, (entry) => {
    if (isHardLockedStatus(entry)) return false;
    return entry.id === I.STUN || entry.id === I.ROOT || entry.id === I.SILENCE || entry.id === I.DISARM || entry.id === I.GROUNDED || entry.id === I.SLEEP || entry.id === I.FEAR || entry.id === I.CHARM || entry.id === I.TAUNT || entry.id === I.SLOW || entry.id === I.BLIND;
  });
}

export function cleanseAllDebuffs(entity) {
  return clearStatusesByPredicate(entity, (entry) => {
    const def = getStatusEffectDef(entry.id);
    return isDebuffStatus(def) && !isHardLockedStatus(entry);
  });
}

export function purgeBuffs(entity) {
  return clearStatusesByPredicate(entity, (entry) => {
    const def = getStatusEffectDef(entry.id);
    return isBuffStatus(def) && entry.id !== I.STASIS;
  });
}
