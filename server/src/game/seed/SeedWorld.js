import { initializeSessionBastions } from '../bastion/BastionSession.js';

export function seedWorld(state) {
  state.stations.clear();
  state.asteroids.clear();
  state.portals.clear();
  state.loots.clear();
  state.projectiles.clear();
  state.sectors.clear();
  state.asteroidCooldownUntil.clear();
  initializeSessionBastions(state);
}
