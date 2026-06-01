import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';
import { getStatusEntry, listVisibleStatuses } from './StatusRack.js';

const SIGIL_RUNE_MARK_KEY = 'sigil_runes';

function buildSigilRuneSnapshot(entity) {
  const entry = getStatusEntry(entity, I.MARK, { markKey: SIGIL_RUNE_MARK_KEY });
  if (!entry || (entry.stacks ?? 0) <= 0 || (entry.durationLeft ?? 0) <= 0) return null;
  return {
    id: entry.id,
    name: 'Runes de contrainte',
    shortName: 'Rune',
    durationLeft: entry.durationLeft,
    baseDuration: entry.baseDuration ?? entry.durationLeft,
    value: entry.value ?? 0,
    stacks: entry.stacks ?? 1,
    maxStacks: entry.maxStacks ?? 5,
    markKey: SIGIL_RUNE_MARK_KEY,
    label: entry.label || 'Rune',
    primaryColor: { r: 201, g: 124, b: 255 },
    secondaryColor: { r: 246, g: 222, b: 255 }
  };
}

export function buildStatusSnapshot(entity, maxCount = 8) {
  const visible = listVisibleStatuses(entity, maxCount).map((entry) => ({
    id: entry.id,
    name: entry.name,
    shortName: entry.shortName,
    durationLeft: entry.durationLeft,
    baseDuration: entry.baseDuration,
    value: entry.value,
    stacks: entry.stacks,
    maxStacks: entry.maxStacks,
    markKey: entry.markKey,
    label: entry.label,
    primaryColor: entry.primaryColor,
    secondaryColor: entry.secondaryColor
  }));

  const sigilRunes = buildSigilRuneSnapshot(entity);
  if (!sigilRunes) return visible;

  const alreadyVisible = visible.some((entry) => entry?.id === I.MARK && entry?.markKey === SIGIL_RUNE_MARK_KEY);
  if (alreadyVisible) return visible;

  return [sigilRunes, ...visible].slice(0, Math.max(1, maxCount));
}
