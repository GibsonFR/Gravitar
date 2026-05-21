import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';
import { createFrameRuntime } from './FrameRuntimeFactory.js';
import { createFrameState } from './FrameStateFactory.js';
import { syncPlayerFrameStats } from './FrameStatSync.js';

export function switchPlayerFrame(player, frameId) {
  const def = getShipFrameDef(frameId);
  const runtime = createFrameRuntime(def.id);

  player.frameId = runtime.id;
  player.frameName = runtime.name;
  player.frameRole = runtime.role;
  player.frameDifficulty = runtime.difficulty;
  player.abilityCatalog = { ...runtime.abilityCatalog };
  player.cooldownALeft = 0;
  player.cooldownZLeft = 0;
  player.cooldownELeft = 0;
  player.cooldownRLeft = 0;
  player.frameState = createFrameState(def.id);
  player.frameBonuses = {};

  syncPlayerFrameStats(player, { preserveRatios: true, restoreVitals: false });
  return def;
}
