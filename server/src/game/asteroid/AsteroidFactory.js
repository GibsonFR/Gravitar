import { newEntityId } from '../state/GameState.js';
import { randRange } from '../util/Math.js';
import { FACTIONS } from '../constants.js';
import { ASTEROID_DEFS } from './AsteroidDefs.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { DotNetRandom } from '../util/DotNetRandom.js';

export function spawnAsteroid(state, x, y, defKey, secret = false) {
  const def = ASTEROID_DEFS[defKey];
  if (!def) throw new Error(`unknown asteroid def: ${defKey}`);

  const resDef = RESOURCE_DEFS[def.resource] ?? null;

  const id = newEntityId(state);
  const rarity = secret ? 'secret' : def.resource;

  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    faction: FACTIONS.ASTEROID,
    sx: 0,
    sy: 0,
    x,
    y,
    radius: def.radius,
    stats: createStatBlock({ maxHp: def.maxHp }),
    yieldValue: def.yieldValue,
    resource: def.resource,
    resourceName: resDef?.name ?? def.resource,
    resourceColorHex: resDef?.colorHex ?? null,
    color: def.color,
    rot: Math.random() * Math.PI * 2,
    spin: randRange(-0.7, 0.7),
    shapeSeed: Math.floor(Math.random() * 8),
    secret,
    respawnAt: 0,
    rarity,
    diedAt: 0,
    killedById: 0,
    dropsSpawned: false
  });

  return id;
}

export function getAsteroidMaterialMaxHp(radius, resourceKey, yieldValue) {
  const resDef = RESOURCE_DEFS[resourceKey] ?? null;
  const r = Math.max(8, Number(radius) || 24);
  const yieldCount = Math.max(1, yieldValue | 0);
  const rarity = Math.max(1, Number(resDef?.rarity) || 1);
  const hardness = Math.max(0.55, Number(resDef?.hardnessMultiplier) || 1);

  // Le minage doit raconter quelque chose : un petit astéroïde pauvre casse vite,
  // un gisement dense ou un matériau dur/rare résiste beaucoup plus longtemps.
  const sizeHp = 55 + r * 5.4 + r * r * 0.020;
  const yieldMult = 0.72 + Math.pow(yieldCount, 0.78) * 0.18;
  const rarityMult = 0.92 + Math.pow(rarity, 0.82) * 0.10;
  return Math.max(45, Math.round(sizeHp * hardness * yieldMult * rarityMult));
}

export function spawnAsteroidProc(state, sx, sy, opts) {
  const { x, y, radius, resourceKey, yieldValue, seed, sig } = opts;
  const rng = new DotNetRandom(seed | 0);
  const resDef = RESOURCE_DEFS[resourceKey] ?? null;
  const rgb = resDef?.colorHex ? hexToRgb(resDef.colorHex) : { r: 148, g: 160, b: 168 };
  const maxHp = getAsteroidMaterialMaxHp(radius, resourceKey, yieldValue);

  const id = newEntityId(state);
  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    faction: FACTIONS.ASTEROID,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    radius,
    stats: createStatBlock({ maxHp }),
    yieldValue: yieldValue | 0,
    resource: resourceKey,
    resourceName: resDef?.name ?? resourceKey,
    resourceColorHex: resDef?.colorHex ?? null,
    color: rgb,
    rot: rng.nextDouble() * Math.PI * 2,
    spin: (rng.nextDouble() * 1.4 - 0.7),
    shapeSeed: rng.nextMax(8) | 0,
    secret: false,
    respawnAt: 0,
    rarity: resourceKey,
    diedAt: 0,
    killedById: 0,
    dropsSpawned: false,
    sig: sig ?? ''
  });

  return id;
}

function hexToRgb(hex) {
  const s = String(hex).replace('#', '').trim();
  const v = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
