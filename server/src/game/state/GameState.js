import { createWorldSfxState } from '../audio/WorldSfxState.js';
import { createCombatFxState } from '../combat/CombatFxState.js';
import { WORLD_SEED } from '../../config/ServerConfig.js';
import { createSimulationClock } from '../util/Time.js';
import { createModeState } from '../modes/GameModes.js';
import { createAccountStore } from '../accounts/AccountStore.js';
import { createStructureStore } from '../structures/StructureStore.js';
import { createAsteroidRespawnStore } from '../asteroid/AsteroidRespawnStore.js';
import { createClanStore } from '../clans/ClanStore.js';

export function createGameState() {
  return {
    ids: {
      nextPlayerId: 1,
      nextEntityId: 10000
    },
    seed: WORLD_SEED,
    time: createSimulationClock(),
    audio: createWorldSfxState(),
    combatFx: createCombatFxState(),
    players: new Map(),
    mobs: new Map(),
    asteroids: new Map(),
    portals: new Map(),
    loots: new Map(),
    stations: new Map(),
    structures: new Map(),
    baseThreats: new Map(),
    clans: new Map(),
    projectiles: new Map(),
    areaEffects: new Map(),
    testEffectZones: new Map(),
    sessionDurationMs: 60 * 60 * 1000,
    bastions: [],
    bastionsBySector: new Map(),
    bastionsById: new Map(),
    bastionRuns: new Map(),
    bastionRunsBySector: new Map(),
    sectors: new Map(),
    asteroidCooldownUntil: new Map(),
    destroyedAsteroidSigs: new Set(),
    destroyedAsteroidRespawnAt: new Map(),
    destroyedAsteroids: new Map(),
    modes: createModeState(),
    accounts: createAccountStore(),
    structureStore: createStructureStore(),
    asteroidRespawnStore: createAsteroidRespawnStore(),
    clanStore: createClanStore()
  };
}

export function newPlayerId(state) {
  const id = state.ids.nextPlayerId;
  state.ids.nextPlayerId += 1;
  return id;
}

export function newEntityId(state) {
  const id = state.ids.nextEntityId;
  state.ids.nextEntityId += 1;
  return id;
}
