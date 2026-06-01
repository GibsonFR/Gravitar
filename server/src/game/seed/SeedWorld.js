import { initializeSessionBastions } from '../bastion/BastionSession.js';

export function seedWorld(state) {
  state.stations.clear();
  state.structures?.clear?.();
  state.asteroids.clear();
  state.portals.clear();
  state.loots.clear();
  state.projectiles.clear();
  state.sectors.clear();
  state.asteroidCooldownUntil.clear();
  state.destroyedAsteroidSigs?.clear?.();
  state.destroyedAsteroidRespawnAt?.clear?.();
  state.destroyedAsteroids?.clear?.();
  initializeSessionBastions(state);
  state.structureStore?.loadIntoState?.(state);
  state.asteroidRespawnStore?.loadIntoState?.(state);
}
