import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';
import { switchPlayerFrame } from '../frames/FrameSwitchSystem.js';
import { setPlayerHint } from '../player/PlayerUiHints.js';

export function handleSetFrame(state, player, msg) {
  if (!player.sessionSetupPending && !player.dockedStationId) {
    setPlayerHint(player, 'Changer de frame uniquement en station');
    return false;
  }

  const requestedId = String(msg?.frameId || '');
  const def = getShipFrameDef(requestedId);
  if (!def || def.id !== requestedId) return false;
  if (def.id === player.frameId) {
    setPlayerHint(player, `${def.name} déjà actif`, 1.4);
    return false;
  }

  switchPlayerFrame(player, def.id);
  setPlayerHint(player, `Frame: ${def.name}`, 1.8);
  return true;
}
