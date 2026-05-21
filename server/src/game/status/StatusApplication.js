import { applyStatus } from './StatusRack.js';
import { getSimulationTimeMs } from '../util/Time.js';

function materializeSpec(state, source, target, spec) {
  if (!spec) return null;
  return typeof spec === 'function' ? spec(state, source, target) : spec;
}

export function applyStatusSpec(state, source, target, spec) {
  const resolved = materializeSpec(state, source, target, spec);
  if (!resolved?.effectId || !target) return null;

  const {
    effectId,
    duration = 0,
    sourceId,
    hostile,
    timeMs,
    ...options
  } = resolved;

  return applyStatus(target, effectId, duration, {
    ...options,
    timeMs: getSimulationTimeMs(state, timeMs),
    sourceId: sourceId ?? source?.id ?? 0,
    hostile: hostile ?? (source?.id != null && target?.id != null && source.id !== target.id)
  });
}

export function applyStatusSpecs(state, source, target, specs) {
  if (!specs || !target) return [];
  const list = Array.isArray(specs) ? specs : [specs];
  const out = [];
  for (const spec of list) {
    const result = applyStatusSpec(state, source, target, spec);
    if (result) out.push(result);
  }
  return out;
}

export function applyStatusSpecsToTargets(state, source, targets, specs) {
  if (!targets?.length || !specs) return 0;
  let applied = 0;
  for (const target of targets) applied += applyStatusSpecs(state, source, target, specs).length;
  return applied;
}
