import { tryCastFrameAbility } from '../frames/FrameGameplayHooks.js';

export function tryCastAbility(state, player, slot, timeMs) {
  return tryCastFrameAbility(state, player, slot, timeMs);
}
