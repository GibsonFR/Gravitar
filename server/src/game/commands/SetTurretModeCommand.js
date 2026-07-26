import { getStructureDef } from '../structures/StructureDefs.js';
import { isStructureOwner, distanceSqToStructureRect } from '../structures/StructureSystem.js';
import { normalizeTurretMode, getTurretModeLabel, isTurretModeEnabled } from '../structures/StructureTurretModes.js';

const TURRET_CONFIG_RANGE = 320;

export function handleSetTurretMode(state, player, msg, timeMs = Date.now()) {
  const id = msg.structureId | 0;
  const st = state?.structures?.get?.(id);
  if (!st || !getStructureDef(st.type)?.turret) return { ok: false, error: 'not_turret' };
  if (!player) return { ok: false, error: 'missing_player' };
  if (String(player.worldId || 'endless') !== String(st.worldId || 'endless')) return { ok: false, error: 'wrong_world' };
  if ((player.sx | 0) !== (st.sx | 0) || (player.sy | 0) !== (st.sy | 0)) return { ok: false, error: 'wrong_sector' };
  if (!isStructureOwner(player, st)) return { ok: false, error: 'not_owner' };
  if (distanceSqToStructureRect(st, player.x || 0, player.y || 0) > TURRET_CONFIG_RANGE * TURRET_CONFIG_RANGE) return { ok: false, error: 'too_far' };

  const mode = normalizeTurretMode(msg.mode);
  st.turretMode = mode;
  st.turretEnabled = isTurretModeEnabled(mode);
  st.turretTargetId = 0;
  st.turretStatus = mode === 'off' ? 'off' : 'idle';
  st.updatedAt = timeMs;
  player.forceFullUiSnapshot = true;
  player.hint = `Tourelle : ${getTurretModeLabel(mode)}`;
  player._optimisticHintLeft = 1.0;
  if (String(st.worldId || 'endless') === 'endless') state.structureStore?.saveFromState?.(state);
  return { ok: true };
}
