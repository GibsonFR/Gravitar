import { canPlayerAccessStorage } from '../structures/StructureStorage.js';
import { queueWorldSfx } from '../audio/WorldSfxState.js';
import { SFX_EVENT_TYPES } from '../audio/SfxEventTypes.js';

export function handleStorageOpen(state, player, msg, _timeMs) {
  const id = msg.structureId | 0;
  const st = state?.structures?.get?.(id);
  if (!canPlayerAccessStorage(state, player, st)) {
    player.hint = 'Coffre inaccessible';
    player._optimisticHintLeft = 1.0;
    player.forceFullUiSnapshot = true;
    return false;
  }
  player.openStorageId = st.id | 0;
  player.selectedKind = 'structure';
  player.selectedId = st.id | 0;
  player.hasMoveTarget = false;
  player.holdMoveAllowed = false;
  player.groundMarkerTimer = 0;
  player.forceFullUiSnapshot = true;
  player.hint = 'Coffre ouvert';
  player._optimisticHintLeft = 1.0;
  queueWorldSfx(state, SFX_EVENT_TYPES.STORAGE, st.sx, st.sy, st.x, st.y, 0);
  return true;
}
