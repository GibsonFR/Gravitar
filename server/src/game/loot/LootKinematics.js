import { clamp, norm } from '../util/Math.js';

function getPlayerMagnetRange(player) {
  return Math.max(0, player?.magnetRange ?? 0);
}

export function updateLootMotion(state, loot, dt) {
  if (loot.pickupImmunityLeft > 0) {
    loot.pickupImmunityLeft = Math.max(0, loot.pickupImmunityLeft - dt);
  }

  const magnetPlayer = findBestMagnetPlayer(state, loot);
  if (magnetPlayer) {
    const dx = magnetPlayer.x - loot.x;
    const dy = magnetPlayer.y - loot.y;
    const dist = Math.hypot(dx, dy);
    const magnetRange = getPlayerMagnetRange(magnetPlayer);
    if (dist > 0.1 && magnetRange > 0) {
      const dir = norm(dx, dy);
      const accel = 220 + 320 * (1 - clamp(dist / magnetRange, 0, 1));
      loot.vx += dir.x * accel * dt;
      loot.vy += dir.y * accel * dt;
    }
  }

  const drag = Math.pow(loot.drag ?? 0.94, dt * 60);
  loot.vx *= drag;
  loot.vy *= drag;
  loot.x += loot.vx * dt;
  loot.y += loot.vy * dt;
}

function findBestMagnetPlayer(state, loot) {
  if (loot.pickupImmunityLeft > 0) return null;

  let best = null;
  let bestD2 = Infinity;
  for (const player of state.players.values()) {
    if ((player.sx | 0) !== (loot.sx | 0) || (player.sy | 0) !== (loot.sy | 0)) continue;
    const magnetRange = getPlayerMagnetRange(player);
    if (magnetRange <= 0) continue;
    const dx = player.x - loot.x;
    const dy = player.y - loot.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > magnetRange * magnetRange) continue;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = player;
    }
  }
  return best;
}
