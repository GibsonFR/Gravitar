import { spawnAsteroidDrops } from './AsteroidDrops.js';
import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';
import { canRespawnAsteroidAt, clearAsteroidDestroyedRecord, deferAsteroidRespawn } from './AsteroidRespawnState.js';

export function updateAsteroids(state, dt, timeMs) {
  for (const a of state.asteroids.values()) {
    if (a.stats.hp > 0) {
      a.rot += a.spin * dt * 2.2;
    } else if (a.respawnAt && timeMs >= a.respawnAt) {
      if (!canRespawnAsteroidAt(state, a)) {
        a.respawnAt = deferAsteroidRespawn(state, a.sig, timeMs);
        continue;
      }
      restoreStatBlockFull(a.stats);
      a.rot = 0;
      a.respawnAt = 0;
      a.diedAt = 0;
      a.killedById = 0;
      a.dropsSpawned = false;

      if (a.sig) {
        state.asteroidCooldownUntil.delete(a.sig);
        clearAsteroidDestroyedRecord(state, a.sig);
        state.asteroidRespawnStore?.saveFromState?.(state);
      }
    } else if (a.stats.hp <= 0 && a.diedAt && !a.dropsSpawned) {
      spawnAsteroidDrops(state, a, timeMs);
      a.dropsSpawned = true;
    }
  }
}
