import { newEntityId } from '../../state/GameState.js';

export function createAreaEffect(state, owner, spec) {
  const id = newEntityId(state);
  const effect = {
    id,
    kind: 'area_effect',
    ownerId: owner.id,
    frameId: owner.frameId,
    slot: spec.slot,
    sx: owner.sx | 0,
    sy: owner.sy | 0,
    x: spec.x,
    y: spec.y,
    radius: spec.radius,
    durationLeft: spec.duration,
    tickEvery: spec.tickEvery,
    tickLeft: spec.tickEvery,
    damage: spec.damage,
    color: spec.color ?? { r: 88, g: 220, b: 255 },
    onTickStatuses: spec.onTickStatuses ?? null
  };
  state.areaEffects.set(id, effect);
  return effect;
}
