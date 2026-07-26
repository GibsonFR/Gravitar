import { STRUCTURE_TYPES, getStructureDef } from '../structures/StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect } from '../structures/StructureSystem.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

const TOGGLE_RANGE = 280;

export function handleToggleStructure(state, player, msg, timeMs) {
  const id = msg.structureId | 0;
  const st = state?.structures?.get?.(id);
  if (!st) return false;
  if (st.type !== STRUCTURE_TYPES.DOOR) return false;
  if ((st.sx | 0) !== (player.sx | 0) || (st.sy | 0) !== (player.sy | 0)) return false;
  if (String(st.worldId || 'endless') !== String(player.worldId || 'endless')) return false;
  if (!isStructureOwner(player, st)) return false;
  if (distanceSqToStructureRect(st, player.x || 0, player.y || 0) > TOGGLE_RANGE * TOGGLE_RANGE) return false;
  const def = getStructureDef(st.type);
  st.open = !st.open;
  st.solid = !!def?.solid && !st.open;
  st.updatedAt = timeMs || Date.now();
  player.forceFullUiSnapshot = true;
  player.hint = st.open ? 'Porte ouverte' : 'Porte fermée';
  player._optimisticHintLeft = 1.0;
  queueWorldSfx(state, SFX_EVENT_TYPES.DOOR, st.sx, st.sy, st.x, st.y, st.open ? 1 : 0);
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return true;
}
