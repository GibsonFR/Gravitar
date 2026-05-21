import { listVisibleStatuses } from './StatusRack.js';

export function buildStatusSnapshot(entity, maxCount = 8) {
  return listVisibleStatuses(entity, maxCount).map((entry) => ({
    id: entry.id,
    name: entry.name,
    shortName: entry.shortName,
    durationLeft: entry.durationLeft,
    baseDuration: entry.baseDuration,
    value: entry.value,
    stacks: entry.stacks,
    label: entry.label,
    primaryColor: entry.primaryColor,
    secondaryColor: entry.secondaryColor
  }));
}
