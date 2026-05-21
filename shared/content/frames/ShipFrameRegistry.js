import { SHIP_FRAME_IDS, SHIP_FRAME_ORDER } from './ShipFrameIds.js';
import { VANGUARD_FRAME_DEF } from './vanguard/VanguardFrameDef.js';
import { SIGIL_FRAME_DEF } from './sigil/SigilFrameDef.js';
import { BULWARK_FRAME_DEF } from './bulwark/BulwarkFrameDef.js';

export const SHIP_FRAME_REGISTRY = Object.freeze({
  [SHIP_FRAME_IDS.VANGUARD]: VANGUARD_FRAME_DEF,
  [SHIP_FRAME_IDS.SIGIL]: SIGIL_FRAME_DEF,
  [SHIP_FRAME_IDS.BULWARK]: BULWARK_FRAME_DEF
});

export function getShipFrameDef(frameId) {
  return SHIP_FRAME_REGISTRY[frameId] ?? VANGUARD_FRAME_DEF;
}

export function getDefaultShipFrameId() {
  return SHIP_FRAME_ORDER[0];
}
