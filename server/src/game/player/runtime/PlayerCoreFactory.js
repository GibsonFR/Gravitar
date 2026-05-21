import { DEFAULT_PLAYER_PSEUDO } from '../PlayerSessionSetup.js';

export function createPlayerCoreState(id, spawn, frameRuntime, frameStats) {
  return {
    kind: 'player',
    id,
    pseudo: DEFAULT_PLAYER_PSEUDO,
    sessionSetupPending: true,
    frameId: frameRuntime.id,
    frameName: frameRuntime.name,
    frameRole: frameRuntime.role,
    sx: 0,
    sy: 0,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    rot: 0,
    radius: frameStats.radius ?? 18,
    engine: frameStats.engine ?? 250,
    magnetRange: frameStats.magnetRange ?? 150
  };
}
