import { SHIP_FRAME_IDS } from '../../../../shared/content/frames/ShipFrameIds.js';
import { createVanguardFrameState } from './vanguard/VanguardFrameState.js';
import { createSigilFrameState } from './sigil/SigilFrameState.js';
import { createBulwarkFrameState } from './bulwark/BulwarkFrameState.js';

export function createFrameState(frameId) {
  if (frameId === SHIP_FRAME_IDS.VANGUARD) return { vanguard: createVanguardFrameState() };
  if (frameId === SHIP_FRAME_IDS.SIGIL) return { sigil: createSigilFrameState() };
  if (frameId === SHIP_FRAME_IDS.BULWARK) return { bulwark: createBulwarkFrameState() };
  return {};
}
