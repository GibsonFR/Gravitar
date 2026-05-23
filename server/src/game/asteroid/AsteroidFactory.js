import { newEntityId } from '../state/GameState.js';
import { randRange } from '../util/Math.js';
import { FACTIONS } from '../constants.js';
import { ASTEROID_DEFS } from './AsteroidDefs.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { RESOURCE_DEFS } from '../inventory/ResourceDefs.js';
import { DotNetRandom } from '../util/DotNetRandom.js';

const MATERIAL_HARDNESS_OVERRIDES = Object.freeze({
  scrap: 0.45,
  waterIce: 0.10, hydrogenIce: 0.08, methaneIce: 0.12, ammoniaIce: 0.14, hydrocarbons: 0.18,
  biomass: 0.18, organicLipids: 0.14, spores: 0.16, proteinFibers: 0.32, enzymes: 0.24, chitin: 0.75,
  sulfur: 0.28, graphite: 0.48, lithiumOre: 0.54, leadOre: 0.60, aluminiumOre: 0.70,
  copper: 0.82, silicon: 0.94, ironOre: 1.00, nickelOre: 1.34, cobaltOre: 1.48,
  quartz: 1.58, boronOre: 1.76, titaniumOre: 2.35, berylliumOre: 2.55, rareEarthOre: 2.75,
  uraniumOre: 4.20, thoriumOre: 4.75, unstableIsotopes: 5.60,
  unknownTechFragment: 4.80, ancientSuperconductor: 5.70, precursorNanomaterial: 7.25,
  containedAntimatter: 8.40, strangeMatter: 9.50
});

function materialHardness(resourceKey, resDef) {
  const override = MATERIAL_HARDNESS_OVERRIDES[resourceKey];
  if (Number.isFinite(override)) return Math.max(0.16, override);
  return Math.max(0.35, Number(resDef?.hardnessMultiplier) || 1);
}

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
  const hardness = materialHardness(resourceKey, resDef);

  // Le minage doit raconter le matériau : la glace et les organiques cassent vite,
  // les métaux durs résistent, et les ressources technologiques/actinides rares
  // deviennent de vrais objectifs de minage. Le rendement augmente aussi les PV :
  // un gros gisement riche doit prendre nettement plus longtemps qu'un petit caillou.
  const sizeHp = 42 + r * 4.8 + r * r * 0.018;
  const yieldMult = 0.50 + Math.pow(yieldCount, 0.94) * 0.255;
  const rarityMult = 0.70 + Math.pow(rarity, 1.22) * 0.235;
  const hardnessMult = Math.pow(hardness, 1.48);
  return Math.max(18, Math.round(sizeHp * hardnessMult * yieldMult * rarityMult));
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
