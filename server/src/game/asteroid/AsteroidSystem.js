import { spawnAsteroidDrops } from './AsteroidDrops.js';
import { restoreStatBlockFull } from '../stats/StatBlockRuntime.js';

export function updateAsteroids(state, dt, timeMs) {
  for (const a of state.asteroids.values()) {
    if (a.stats.hp > 0) {
      a.rot += a.spin * dt * 2.2;
    } else if (false && a.respawnAt && timeMs >= a.respawnAt) {
      restoreStatBlockFull(a.stats);
      a.rot = 0;
      a.respawnAt = 0;
      a.diedAt = 0;
      a.killedById = 0;
      a.dropsSpawned = false;

      if (a.sig) state.asteroidCooldownUntil.delete(a.sig);
    } else if (a.stats.hp <= 0 && a.diedAt && !a.dropsSpawned) {
      spawnAsteroidDrops(state, a, timeMs);
      a.dropsSpawned = true;
    }
  }
}
