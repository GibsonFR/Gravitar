import { distSq } from '../util/Math.js';
import { applyDamage } from '../combat/DamageSystem.js';
import { isPlayerSessionPending } from '../player/PlayerSessionSetup.js';
import { isSafeNoPvpSector } from '../sector/SpecialSectors.js';
import { sameWorld } from '../modes/GameModes.js';

function pushIfInside(list, owner, entity, x, y, radiusSq) {
  if (!entity) return;
  if ((entity.sx | 0) !== (owner.sx | 0) || (entity.sy | 0) !== (owner.sy | 0)) return;
  if (entity.kind === 'player' && entity.id === owner.id) return;
  if (entity.kind === 'player' && !sameWorld(owner, entity)) return;
  if (entity.kind === 'player' && isSafeNoPvpSector(owner.sx | 0, owner.sy | 0) && isSafeNoPvpSector(entity.sx | 0, entity.sy | 0)) return;
  if (entity.kind === 'player' && isPlayerSessionPending(entity)) return;
  if (entity.kind === 'asteroid' && entity.stats?.hp <= 0) return;
  const r = (entity.radius ?? 0);
  if (distSq(x, y, entity.x, entity.y) <= (Math.sqrt(radiusSq) + r) * (Math.sqrt(radiusSq) + r)) list.push(entity);
}

export function collectAttackablesInRadius(state, owner, x, y, radius) {
  const out = [];
  const radiusSq = radius * radius;
  for (const p of state.players.values()) pushIfInside(out, owner, p, x, y, radiusSq);
  for (const m of state.mobs.values()) if ((m.stats?.hp ?? 0) > 0) pushIfInside(out, owner, m, x, y, radiusSq);
  for (const a of state.asteroids.values()) pushIfInside(out, owner, a, x, y, radiusSq);
  return out;
}

export function dealAreaDamage(state, owner, x, y, radius, damage, options = null) {
  const hits = collectAttackablesInRadius(state, owner, x, y, radius);
  for (const entity of hits) applyDamage(state, entity, damage, owner, {
    timeMs: options?.timeMs,
    sourceSlot: options?.sourceSlot || '',
    visualKind: options?.visualKind || 'ability_area'
  });
  return hits.length;
}
