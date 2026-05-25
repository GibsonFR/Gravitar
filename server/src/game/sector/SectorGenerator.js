import { SECTOR } from './SectorDefs.js';
import { sectorFrontierLevel } from './SectorMath.js';
import { hash2D_Mix, hash2D_XorShift } from '../util/HashUtil.js';
import { DotNetRandom } from '../util/DotNetRandom.js';
import { rollResourceKeyForSector, getSectorResourcePool } from '../asteroid/AsteroidSpawnDirector.js';
import { RESOURCE_DEFS, getResourceRarityScore } from '../inventory/ResourceDefs.js';
import { spawnAsteroidProc } from '../asteroid/AsteroidFactory.js';
import { spawnStation } from '../station/StationFactory.js';
import { spawnPortal } from '../portal/PortalFactory.js';
import { asteroidKey } from '../asteroid/AsteroidKey.js';
import { spawnSectorMobs } from '../mob/MobSpawnDirector.js';
import { spawnMob } from '../mob/MobFactory.js';
import { createStructure } from '../structures/StructureFactory.js';
import { newEntityId } from '../state/GameState.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { FACTIONS } from '../constants.js';
import { listMobDefs } from '../../../../shared/content/mobs/MobDefs.js';
import { spawnAllTestEffectZones } from '../status/TestEffectZoneSystem.js';
import { getBastionAtSector, getBastionByInteriorSector, interiorSxForBastion } from '../bastion/BastionSession.js';
import { spawnBastionInteriorShell } from '../bastion/BastionSystem.js';
import { SPECIAL_SECTORS, TEST_BIOME_SECTORS, getTestBiomeSector } from './SpecialSectors.js';
import { BATTLE, isBattleArenaSector, ensureTestEquipmentBench } from '../modes/GameModes.js';
import { getBastionColor, getBastionEffectSummary } from '../bastion/BastionTypes.js';
import { SECTOR_BIOMES } from '../../../../shared/proc/SectorBiomes.js';

const BASTION_EXTERIOR_GRID_W = 15;
const BASTION_EXTERIOR_GRID_H = 15;

function fourDirs() {
  return [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
}

function countMazeExits(open, x, y) {
  let exits = 0;
  for (const dir of fourDirs()) {
    const wallX = x + dir.x;
    const wallY = y + dir.y;
    const nx = x + dir.x * 2;
    const ny = y + dir.y * 2;
    if (nx < 0 || ny < 0 || nx >= open.length || ny >= open[0].length) continue;
    if (open[wallX]?.[wallY] && open[nx]?.[ny]) exits += 1;
  }
  return exits;
}

function createSideEntrance(open, gridW, gridH, x, edgeY, towardCenter) {
  let gx = Math.max(1, Math.min(gridW - 2, x | 0));
  if ((gx & 1) === 0) gx -= 1;
  const innerY = edgeY + towardCenter;
  const nextY = edgeY + towardCenter * 2;
  open[gx][edgeY] = true;
  if (innerY >= 0 && innerY < gridH) open[gx][innerY] = true;
  if (nextY >= 0 && nextY < gridH) open[gx][nextY] = true;
}

function createSideEntranceVertical(open, gridW, gridH, edgeX, y, towardCenter) {
  let gy = Math.max(1, Math.min(gridH - 2, y | 0));
  if ((gy & 1) === 0) gy -= 1;
  const innerX = edgeX + towardCenter;
  const nextX = edgeX + towardCenter * 2;
  open[edgeX][gy] = true;
  if (innerX >= 0 && innerX < gridW) open[innerX][gy] = true;
  if (nextX >= 0 && nextX < gridW) open[nextX][gy] = true;
}

function buildBastionExteriorMaze(seed) {
  const gridW = BASTION_EXTERIOR_GRID_W;
  const gridH = BASTION_EXTERIOR_GRID_H;
  const rng = new DotNetRandom(seed | 0);
  const open = Array.from({ length: gridW }, () => Array.from({ length: gridH }, () => false));
  const visited = Array.from({ length: gridW }, () => Array.from({ length: gridH }, () => false));

  let centerX = Math.floor(gridW / 2);
  let centerY = Math.floor(gridH / 2);
  if ((centerX & 1) === 0) centerX -= 1;
  if ((centerY & 1) === 0) centerY -= 1;

  const stack = [{ x: centerX, y: centerY }];
  visited[centerX][centerY] = true;
  open[centerX][centerY] = true;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const dirs = [];
    for (const dir of fourDirs()) {
      const nx = cur.x + dir.x * 2;
      const ny = cur.y + dir.y * 2;
      if (nx <= 0 || ny <= 0 || nx >= gridW - 1 || ny >= gridH - 1) continue;
      if (visited[nx][ny]) continue;
      dirs.push(dir);
    }
    if (!dirs.length) { stack.pop(); continue; }
    const chosen = dirs[rng.nextMax(dirs.length)];
    const wx = cur.x + chosen.x;
    const wy = cur.y + chosen.y;
    const nx2 = cur.x + chosen.x * 2;
    const ny2 = cur.y + chosen.y * 2;
    open[wx][wy] = true;
    open[nx2][ny2] = true;
    visited[nx2][ny2] = true;
    stack.push({ x: nx2, y: ny2 });
  }

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const gx = centerX + dx;
      const gy = centerY + dy;
      if (gx < 1 || gy < 1 || gx >= gridW - 1 || gy >= gridH - 1) continue;
      open[gx][gy] = true;
    }
  }
  open[centerX][centerY - 2] = true;
  open[centerX][centerY + 2] = true;
  open[centerX - 2][centerY] = true;
  open[centerX + 2][centerY] = true;
  open[centerX][centerY - 1] = true;
  open[centerX][centerY + 1] = true;
  open[centerX - 1][centerY] = true;
  open[centerX + 1][centerY] = true;

  createSideEntrance(open, gridW, gridH, centerX, 0, 1);
  createSideEntrance(open, gridW, gridH, centerX, gridH - 1, -1);
  createSideEntranceVertical(open, gridW, gridH, 0, centerY, 1);
  createSideEntranceVertical(open, gridW, gridH, gridW - 1, centerY, -1);

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (let y = 1; y < gridH - 1; y += 2) {
      for (let x = 1; x < gridW - 1; x += 2) {
        if (!open[x][y]) continue;
        if (countMazeExits(open, x, y) > 1) continue;
        const candidates = [];
        for (const dir of fourDirs()) {
          const wallX = x + dir.x;
          const wallY = y + dir.y;
          const nx = x + dir.x * 2;
          const ny = y + dir.y * 2;
          if (nx <= 0 || ny <= 0 || nx >= gridW - 1 || ny >= gridH - 1) continue;
          if (!open[nx][ny] || open[wallX][wallY]) continue;
          candidates.push({ x: wallX, y: wallY });
        }
        if (!candidates.length) continue;
        const wall = candidates[rng.nextMax(candidates.length)];
        open[wall.x][wall.y] = true;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return open;
}

function hex2(n) {
  return Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
}

function rgbToHex(c) {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
}

function spawnBastionWall(state, sx, sy, rect, color, borderColor, seed, sig) {
  const id = newEntityId(state);
  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    faction: FACTIONS.ASTEROID,
    sx: sx | 0,
    sy: sy | 0,
    x: rect.x + rect.w * 0.5,
    y: rect.y + rect.h * 0.5,
    radius: Math.max(rect.w, rect.h) * 0.5,
    w: rect.w,
    h: rect.h,
    stats: createStatBlock({ maxHp: 99999999 }),
    yieldValue: 0,
    resource: 'bastion_wall',
    resourceName: 'Mur de bastion',
    resourceColorHex: rgbToHex(borderColor),
    color,
    borderColor,
    rot: 0,
    spin: 0,
    shapeSeed: seed & 7,
    secret: true,
    respawnAt: 0,
    rarity: 'bastion_wall',
    diedAt: 0,
    killedById: 0,
    dropsSpawned: true,
    sig,
    bastionWall: true,
    solid: true,
    invulnerable: true,
    unselectable: true
  });
  return id;
}

const MOB_SHOWCASE_BASE_X = SPECIAL_SECTORS.MOB_FAMILY_BASE.sx;
const MOB_SHOWCASE_BASE_Y = SPECIAL_SECTORS.MOB_FAMILY_BASE.sy;
const MOB_SHOWCASE_FAMILY_COUNT = 10;
const HYPER_LATE_SHOWCASE_X = SPECIAL_SECTORS.MOB_HYPER_LATE.sx;
const HYPER_LATE_SHOWCASE_Y = SPECIAL_SECTORS.MOB_HYPER_LATE.sy;

function getMobShowcaseFamilyIndex(sx, sy) {
  if ((sy | 0) !== MOB_SHOWCASE_BASE_Y) return -1;
  const idx = (sx | 0) - MOB_SHOWCASE_BASE_X;
  return idx >= 0 && idx < MOB_SHOWCASE_FAMILY_COUNT ? idx : -1;
}

function isHyperLateShowcaseSector(sx, sy) {
  return (sx | 0) === HYPER_LATE_SHOWCASE_X && (sy | 0) === HYPER_LATE_SHOWCASE_Y;
}

function configureDemoMob(mob, x, y, targetId, tier, timeMs) {
  mob.homeX = x - 145;
  mob.homeY = y;
  mob.demoTargetKind = 'asteroid';
  mob.demoTargetId = targetId;
  mob.demoCageRadius = tier >= 3 ? 340 : 290;
  mob.demoCageX = x;
  mob.demoCageY = y;
  mob.aggroRange = 0;
  mob.leashRange = tier >= 3 ? 560 : 470;
  mob.demoTier = tier;
  mob.nextAttackAt = Math.max(timeMs, mob.nextAttackAt || 0) + 1200 + tier * 500;
  mob.nextSpecialAt = Math.max(timeMs, mob.nextSpecialAt || 0) + 1800 + tier * 700;
}

function generateMobFamilyShowcaseContent(state, sx, sy, timeMs, h, familyIndex) {
  const defs = listMobDefs();
  const def = defs[familyIndex] ?? defs[0];
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52, autoTrigger: true });
  spawnPortal(state, sx, sy, -1500, -1600, SPECIAL_SECTORS.MOB_BESTIARY.sx, SPECIAL_SECTORS.MOB_BESTIARY.sy, '☠', { label: 'Bestiaire global', mode: 'mob_bestiary', radius: 48 });
  spawnStation(state, sx, sy, 1700, 1500, true, h ^ (0x330000 + familyIndex), timeMs);

  const tiers = [
    { label: '', prefix: '', elite: false, levelBoost: 0 },
    { label: 'Muté', prefix: 'Muté ', elite: true, levelBoost: 5 },
    { label: 'Archétype', prefix: 'Archétype ', elite: true, levelBoost: 10 },
    { label: 'Boss', prefix: 'Boss ', elite: true, levelBoost: 16 }
  ];
  const positions = [
    [-650, -520], [650, -520], [-650, 540], [650, 540]
  ];

  tiers.forEach((tier, i) => {
    const [x, y] = positions[i];
    const targetId = spawnDemoDummy(state, sx, sy, x + 220, y, def, tier.elite, h ^ (familyIndex * 101 + i * 17));
    const mob = spawnMob(state, sx, sy, def.id, x - 150, y, {
      seed: h ^ (familyIndex * 4099) ^ (i * 2654435761),
      mapLevel: Math.max(def.sectorMinLevel ?? 1, 8 + familyIndex + tier.levelBoost),
      elite: tier.elite,
      demoMob: true,
      spawnTimeMs: timeMs
    });
    mob.name = `${tier.prefix}${def.name}`;
    mob.demoVariantLabel = tier.label || 'Standard';
    configureDemoMob(mob, x, y, targetId, i, timeMs);
  });
}

function generateHyperLateShowcaseContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52, autoTrigger: true });
  spawnPortal(state, sx, sy, -1500, -1600, SPECIAL_SECTORS.MOB_BESTIARY.sx, SPECIAL_SECTORS.MOB_BESTIARY.sy, '☠', { label: 'Bestiaire global', mode: 'mob_bestiary', radius: 48 });
  spawnStation(state, sx, sy, 1700, 1500, true, h ^ 0x51badc0d, timeMs);
  const defs = listMobDefs();
  const picks = [9, 7, 8, 3].map((i) => defs[i] ?? defs[0]);
  const positions = [[-720, -520], [720, -520], [-720, 560], [720, 560]];
  picks.forEach((def, i) => {
    const [x, y] = positions[i];
    const targetId = spawnDemoDummy(state, sx, sy, x + 250, y, def, true, h ^ (i * 911));
    const mob = spawnMob(state, sx, sy, def.id, x - 170, y, {
      seed: h ^ 0x51badc0d ^ (i * 2654435761),
      mapLevel: 35 + i * 4,
      elite: true,
      demoMob: true,
      spawnTimeMs: timeMs
    });
    mob.name = `Aberration ${def.shortName ?? def.name}`;
    mob.demoVariantLabel = 'Hyperlate';
    configureDemoMob(mob, x, y, targetId, 3, timeMs);
  });
}

function spawnDemoDummy(state, sx, sy, x, y, def, elite, seed) {
  const id = newEntityId(state);
  const color = elite ? { r: 255, g: 216, b: 126 } : { r: 150, g: 224, b: 255 };
  const hp = elite ? 999999 : 777777;
  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    faction: FACTIONS.ASTEROID,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    radius: elite ? 23 : 20,
    stats: createStatBlock({ maxHp: hp }),
    yieldValue: 0,
    resource: 'demo_dummy',
    resourceName: elite ? 'Dummy élite immortel' : 'Dummy immortel',
    resourceColorHex: null,
    color,
    rot: 0,
    spin: 0.35,
    shapeSeed: seed & 7,
    secret: true,
    respawnAt: 0,
    rarity: 'demo_dummy',
    diedAt: 0,
    killedById: 0,
    dropsSpawned: false,
    testCore: true,
    demoDummy: true,
    demoLabel: elite ? `Cible élite ${def.shortName ?? def.name}` : `Cible ${def.shortName ?? def.name}`,
    testStatusId: 'demo_dummy'
  });
  return id;
}

function generateMobBestiaryContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52, autoTrigger: true });
  spawnStation(state, sx, sy, 1700, 1500, true, h ^ 0x55aa66, timeMs);

  const defs = listMobDefs();
  const cols = 4;
  const gapX = 940;
  const gapY = 760;
  const startX = -gapX * 1.5;
  const startY = -760;

  defs.forEach((def, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * gapX;
    const y = startY + row * gapY;
    const normalTargetId = spawnDemoDummy(state, sx, sy, x + 195, y, def, false, h ^ (i * 17));
    const normal = spawnMob(state, sx, sy, def.id, x - 135, y, {
      seed: h ^ (i * 1103515245),
      mapLevel: Math.max(def.sectorMinLevel ?? 1, 8 + i),
      elite: false,
      demoMob: true,
      spawnTimeMs: timeMs
    });
    normal.homeX = x - 135;
    normal.homeY = y;
    normal.demoTargetKind = 'asteroid';
    normal.demoTargetId = normalTargetId;
    normal.demoCageRadius = 255;
    normal.demoCageX = x;
    normal.demoCageY = y;
    normal.aggroRange = 0;
    normal.leashRange = 430;

    const eliteTargetId = spawnDemoDummy(state, sx, sy, x + 195, y + 360, def, true, h ^ (i * 37));
    const elite = spawnMob(state, sx, sy, def.id, x - 135, y + 360, {
      seed: h ^ (i * 2654435761),
      mapLevel: Math.max(def.sectorMinLevel ?? 1, 12 + i),
      elite: true,
      demoMob: true,
      spawnTimeMs: timeMs
    });
    elite.homeX = x - 135;
    elite.homeY = y + 360;
    elite.demoTargetKind = 'asteroid';
    elite.demoTargetId = eliteTargetId;
    elite.demoCageRadius = 255;
    elite.demoCageX = x;
    elite.demoCageY = y + 360;
    elite.aggroRange = 0;
    elite.leashRange = 430;
  });
}

function generateTestHubContent(state, sx, sy, timeMs, h) {
  spawnStation(state, sx, sy, -1650, 1450, true, h ^ 0xabc123, timeMs);
  spawnPortal(state, sx, sy, -760, -520, SPECIAL_SECTORS.MOB_BESTIARY.sx, SPECIAL_SECTORS.MOB_BESTIARY.sy, '☠', {
    label: 'Test mobs / bestiaire',
    mode: 'mob_bestiary',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 0, -520, SPECIAL_SECTORS.TEST_EFFECTS.sx, SPECIAL_SECTORS.TEST_EFFECTS.sy, '✦', {
    label: 'Test effets / abilities',
    mode: 'test_arena',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 760, -520, SPECIAL_SECTORS.TEST_FOUNDATIONS.sx, SPECIAL_SECTORS.TEST_FOUNDATIONS.sy, '▣', {
    label: 'Test fondations',
    mode: 'test_foundations',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 1520, -520, SPECIAL_SECTORS.TEST_BIOMES.sx, SPECIAL_SECTORS.TEST_BIOMES.sy, '◆', {
    label: 'Test biomes U2',
    mode: 'test_biomes',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 1140, 320, SPECIAL_SECTORS.TEST_BASES.sx, SPECIAL_SECTORS.TEST_BASES.sy, '⌂', {
    label: 'Test bases U4',
    mode: 'test_bases',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 1520, 320, SPECIAL_SECTORS.TEST_MINING.sx, SPECIAL_SECTORS.TEST_MINING.sy, '⛏', {
    label: 'Test minage / gisements',
    mode: 'test_mining',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 760, 1040, SPECIAL_SECTORS.TEST_EQUIPMENT.sx, SPECIAL_SECTORS.TEST_EQUIPMENT.sy, '⚙', {
    label: 'Test équipement',
    mode: 'test_equipment',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, -760, 1040, SPECIAL_SECTORS.TEST_INDUSTRIAL_CONVERTER.sx, SPECIAL_SECTORS.TEST_INDUSTRIAL_CONVERTER.sy, '⬡', {
    label: 'Test convertisseur industriel',
    mode: 'test_industrial_converter',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, 1520, 1040, SPECIAL_SECTORS.TEST_PIRATE_MARKET.sx, SPECIAL_SECTORS.TEST_PIRATE_MARKET.sy, '☠', {
    label: 'Test station pirate / commerce ciblé',
    mode: 'test_pirate_market',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, -1520, 1040, SPECIAL_SECTORS.TEST_PIRATE_QUESTS.sx, SPECIAL_SECTORS.TEST_PIRATE_QUESTS.sy, '⚑', {
    label: 'Test quêtes pirates',
    mode: 'test_pirate_quests',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, -1520, 1320, SPECIAL_SECTORS.TEST_PIRATE_REPUTATION.sx, SPECIAL_SECTORS.TEST_PIRATE_REPUTATION.sy, '★', {
    label: 'Test réputation pirate / offres verrouillées',
    mode: 'test_pirate_reputation',
    radius: 56,
    autoTrigger: true
  });
  spawnPortal(state, sx, sy, -380, 320, SPECIAL_SECTORS.STRESS_ARENA.sx, SPECIAL_SECTORS.STRESS_ARENA.sy, '⚡', {
    label: 'Stress test réseau',
    mode: 'stress_test',
    radius: 50,
    autoTrigger: true
  });
  const firstBastion = state.bastions?.[0];
  if (firstBastion) {
    spawnPortal(state, sx, sy, 380, 320, firstBastion.sx, firstBastion.sy, '◈', {
      label: 'Bastion réel proche',
      mode: 'bastion_locator',
      radius: 50
    });
  }
}

function generateTestMiningContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', {
    label: 'Retour hub test',
    radius: 52,
    autoTrigger: true
  });
  spawnStation(state, sx, sy, 1650, 1500, true, h ^ 0x4d1e9a, timeMs);
}



function generateTestEquipmentContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', {
    label: 'Retour hub test',
    radius: 52,
    autoTrigger: true
  });
  spawnStation(state, sx, sy, 1650, 1500, true, h ^ 0xe9019a, timeMs);

  const fakePlayer = {
    id: 0,
    pseudo: 'Test',
    accountKey: 'test-equipment',
    worldId: 'test:test-hub',
    sx,
    sy,
    x: 0,
    y: 0,
    research: {
      completed: [
        'construction_foundations',
        'industry_smelting_control',
        'automation_routing',
        'energy_distribution',
        'advanced_industry',
        'electronics_processing',
        'resource_scanning',
        'bio_processing',
        'defense_turrets',
        'advanced_research',
        'alien_anomaly_analysis'
      ]
    },
    inv: null
  };
  ensureTestEquipmentBench(state, fakePlayer, timeMs);
}


function generateTestPirateMarketContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', {
    label: 'Retour hub test',
    radius: 52,
    autoTrigger: true
  });
  const stationId = spawnStation(state, sx, sy, 0, 0, true, h ^ 0x715a7e, timeMs, { specialtyId: 'pirate' });
  const station = state.stations.get(stationId);
  if (station?.stock) {
    station.stock.pirateTier = 2;
    station.pirateTier = 2;
    station.stock.demand = [
      { resourceKey: 'ironOre', priceCredits: 7, maxAmount: 200, reputationXpPerUnit: 0.02 },
      { resourceKey: 'copper', priceCredits: 7, maxAmount: 200, reputationXpPerUnit: 0.02 },
      { resourceKey: 'graphite', priceCredits: 9, maxAmount: 160, reputationXpPerUnit: 0.025 },
      { resourceKey: 'propellant', priceCredits: 18, maxAmount: 80, reputationXpPerUnit: 0.04 }
    ];
    station.stock.resourceDemand = station.stock.demand;
    station.stock.resourceSupply = [
      { resourceKey: 'titaniumOre', priceCredits: 95, amount: 12, stock: 60 },
      { resourceKey: 'controlCircuit', priceCredits: 160, amount: 4, stock: 24 },
      { resourceKey: 'unknownTechFragment', priceCredits: 260, amount: 2, stock: 12 }
    ];
  }

  const testAsteroids = [
    ['ironOre', -780, -220], ['copper', -520, -520], ['graphite', -260, -260], ['propellant', 520, -520],
    ['quartz', 780, -220], ['titaniumOre', 900, 260]
  ];
  testAsteroids.forEach(([resourceKey, x, y], i) => {
    spawnAsteroidProc(state, sx, sy, {
      x, y, radius: 42 + (i % 3) * 8, resourceKey, yieldValue: 16, seed: h ^ (0x9000 + i), sig: `test_pirate_market_${resourceKey}_${i}`
    });
  });
}


function generateTestPirateQuestsContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', {
    label: 'Retour hub test',
    radius: 52,
    autoTrigger: true
  });
  const stationId = spawnStation(state, sx, sy, 0, 0, true, h ^ 0x71e57, timeMs, { specialtyId: 'pirate' });
  const station = state.stations.get(stationId);
  if (station?.stock) {
    station.stock.pirateTier = 2;
    station.pirateTier = 2;
    station.stock.questOffers = [
      { questId: 'pq_test_deliver_iron', templateId: 'deliver_iron_ore_t1', type: 'deliver_resource', name: 'Livraison test : fer', description: 'Livrer 40 minerais de fer à cette station pirate.', resourceKey: 'ironOre', required: 40, rewardCredits: 180, rewardReputationXp: 30, stationTierMin: 1, pirateTier: 2 },
      { questId: 'pq_test_deliver_graphite', templateId: 'deliver_graphite_t1', type: 'deliver_resource', name: 'Livraison test : graphite', description: 'Livrer 30 graphites à cette station pirate.', resourceKey: 'graphite', required: 30, rewardCredits: 240, rewardReputationXp: 38, stationTierMin: 1, pirateTier: 2 },
      { questId: 'pq_test_deliver_propellant', templateId: 'deliver_propellant_t2', type: 'deliver_resource', name: 'Livraison test : propergol', description: 'Livrer 18 propergols à cette station pirate.', resourceKey: 'propellant', required: 18, rewardCredits: 360, rewardReputationXp: 52, stationTierMin: 2, pirateTier: 2 },
      { questId: 'pq_test_kill_mites', templateId: 'kill_ferrous_mites_t1', type: 'kill_mob', name: 'Contrat test : mites ferreuses', description: 'Éliminer 3 mites ferreuses autour de la station.', targetMobId: 'ferrous_mite', targetName: 'Mite ferreuse', required: 3, rewardCredits: 260, rewardReputationXp: 42, stationTierMin: 1, pirateTier: 2 },
      { questId: 'pq_test_kill_sappers', templateId: 'kill_scoria_sappers_t2', type: 'kill_mob', name: 'Contrat test : sapeurs', description: 'Éliminer 2 sapeurs de scories autour de la station.', targetMobId: 'scoria_sapper', targetName: 'Sapeur de scories', required: 2, rewardCredits: 360, rewardReputationXp: 56, stationTierMin: 2, pirateTier: 2 }
    ];
    station.stock.demand = [
      { resourceKey: 'ironOre', priceCredits: 7, maxAmount: 200, reputationXpPerUnit: 0.02 },
      { resourceKey: 'graphite', priceCredits: 9, maxAmount: 160, reputationXpPerUnit: 0.025 },
      { resourceKey: 'propellant', priceCredits: 18, maxAmount: 80, reputationXpPerUnit: 0.04 }
    ];
    station.stock.resourceDemand = station.stock.demand;
  }

  const resources = [
    ['ironOre', -760, -280], ['graphite', -420, -520], ['propellant', 520, -520], ['copper', 820, -260],
    ['quartz', 780, 260], ['titaniumOre', -760, 280]
  ];
  resources.forEach(([resourceKey, x, y], i) => {
    spawnAsteroidProc(state, sx, sy, {
      x, y, radius: 42 + (i % 3) * 8, resourceKey, yieldValue: 18, seed: h ^ (0xa700 + i), sig: `test_pirate_quests_${resourceKey}_${i}`
    });
  });

  const testMobs = [
    ['ferrous_mite', -620, 520], ['ferrous_mite', -420, 740], ['ferrous_mite', -220, 560], ['ferrous_mite', -80, 780],
    ['scoria_sapper', 420, 560], ['scoria_sapper', 660, 760], ['orbital_stinger', 860, 520]
  ];
  testMobs.forEach(([mobId, x, y], i) => {
    const mob = spawnMob(state, sx, sy, mobId, x, y, { seed: h ^ (0xb700 + i), mapLevel: 4, spawnTimeMs: timeMs, noLoot: true });
    mob.aggroRange = 900;
    mob.leashRange = 1300;
  });
}



function generateTestPirateReputationContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', {
    label: 'Retour hub test',
    radius: 52,
    autoTrigger: true
  });
  const stationId = spawnStation(state, sx, sy, 0, 0, true, h ^ 0x173cafe, timeMs, { specialtyId: 'pirate' });
  const station = state.stations.get(stationId);
  if (station?.stock) {
    station.stock.pirateTier = 5;
    station.pirateTier = 5;
    station.stock.specialtyName = 'Marché réputation pirate';
    station.stock.demand = [
      { resourceKey: 'ironOre', priceCredits: 7, maxAmount: 200, reputationXpPerUnit: 0.02 },
      { resourceKey: 'graphite', priceCredits: 10, maxAmount: 160, reputationXpPerUnit: 0.025 },
      { resourceKey: 'titaniumOre', priceCredits: 18, maxAmount: 120, reputationXpPerUnit: 0.04 },
      { resourceKey: 'unknownTechFragment', priceCredits: 120, maxAmount: 30, reputationXpPerUnit: 0.12 }
    ];
    station.stock.resourceDemand = station.stock.demand;
    station.stock.resourceSupply = [
      { resourceKey: 'controlCircuit', priceCredits: 140, amount: 4, stock: 40 },
      { resourceKey: 'unknownTechFragment', priceCredits: 260, amount: 2, stock: 20 },
      { resourceKey: 'titaniumPlate', priceCredits: 180, amount: 4, stock: 24 }
    ];
    station.stock.questOffers = [
      { questId: 'pq_rep_test_iron', templateId: 'deliver_iron_ore_t1', type: 'deliver_resource', name: 'Réputation test : fer', description: 'Livrer 40 minerais de fer pour vérifier la montée de réputation.', resourceKey: 'ironOre', required: 40, rewardCredits: 180, rewardReputationXp: 120, stationTierMin: 1, pirateTier: 5 },
      { questId: 'pq_rep_test_graphite', templateId: 'deliver_graphite_t1', type: 'deliver_resource', name: 'Réputation test : graphite', description: 'Livrer 30 graphites pour débloquer les offres de rang 1.', resourceKey: 'graphite', required: 30, rewardCredits: 240, rewardReputationXp: 180, stationTierMin: 1, pirateTier: 5 },
      { questId: 'pq_rep_test_fragments', templateId: 'deliver_unknown_fragment_t3', type: 'deliver_resource', name: 'Réputation test : fragments', description: 'Livrer 3 fragments interdits pour atteindre rapidement un palier.', resourceKey: 'unknownTechFragment', required: 3, rewardCredits: 920, rewardReputationXp: 420, stationTierMin: 3, pirateTier: 5 }
    ];

    // Recettes forcées pour le portail de test réputation : l'objectif est de voir
    // immédiatement des cartes achetables ET des cartes verrouillées, même avec un
    // joueur fraîchement arrivé à réputation 0.
    station.stock.conversionRecipeOffers = [
      { recipeId: 'conv_iron_to_copper_basic', priceCredits: 120, tier: 1, reputationRequired: 0, stationTierMin: 1 },
      { recipeId: 'conv_scrap_to_iron_basic', priceCredits: 120, tier: 1, reputationRequired: 0, stationTierMin: 1 },
      { recipeId: 'conv_iron_carbon_to_steel', priceCredits: 260, tier: 2, reputationRequired: 1, stationTierMin: 2 },
      { recipeId: 'conv_copper_to_conductors', priceCredits: 240, tier: 2, reputationRequired: 1, stationTierMin: 2 },
      { recipeId: 'conv_ion_crystal_conductor', priceCredits: 720, tier: 3, reputationRequired: 3, stationTierMin: 3 },
      { recipeId: 'conv_titanium_thermal_armor', priceCredits: 860, tier: 3, reputationRequired: 4, stationTierMin: 3 }
    ];

    const forcedOffers = [
      { itemId: 'proc-weapon-venin-6', priceCredits: 360, tier: 1, categoryId: 'weapon', reputationRequired: 0 },
      { itemId: 'proc-weapon-aegis-11', priceCredits: 520, tier: 2, categoryId: 'weapon', reputationRequired: 1 },
      { itemId: 'proc-launcher-aegis-35', priceCredits: 930, tier: 3, categoryId: 'launcher', reputationRequired: 3 },
      { itemId: 'proc-module-aegis-239', priceCredits: 680, tier: 3, categoryId: 'module', reputationRequired: 4 },
      { itemId: 'proc-engine-vampire-171', priceCredits: 780, tier: 3, categoryId: 'engine', reputationRequired: 3 },
      { itemId: 'proc-ammo-surchauffe-120', priceCredits: 360, tier: 3, categoryId: 'ammo', reputationRequired: 4 },
      { itemId: 'proc-ammo-frappe-103', priceCredits: 380, tier: 3, categoryId: 'ammo', reputationRequired: 5 }
    ];
    const seenOffers = new Set();
    station.stock.offers = [...forcedOffers, ...(station.stock.offers || [])]
      .filter((offer) => {
        const id = String(offer?.itemId || '');
        if (!id || seenOffers.has(id)) return false;
        seenOffers.add(id);
        return true;
      })
      .map((offer) => {
        const tier = Math.max(1, offer.tier | 0 || 1);
        return {
          ...offer,
          reputationRequired: Math.max(0, offer.reputationRequired | 0 || (tier >= 3 ? 3 : tier >= 2 ? 1 : 0)),
          pirateOnly: true
        };
      });
  }

  const resources = [
    ['ironOre', -760, -280], ['graphite', -420, -520], ['titaniumOre', 520, -520], ['unknownTechFragment', 820, -260],
    ['quartz', 780, 260], ['copper', -760, 280]
  ];
  resources.forEach(([resourceKey, x, y], i) => {
    spawnAsteroidProc(state, sx, sy, {
      x, y, radius: 42 + (i % 3) * 8, resourceKey, yieldValue: 20, seed: h ^ (0xb800 + i), sig: `test_pirate_reputation_${resourceKey}_${i}`
    });
  });
}

function generateTestIndustrialConverterContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', {
    label: 'Retour hub test',
    radius: 52,
    autoTrigger: true
  });
  const stationId = spawnStation(state, sx, sy, -950, 980, true, h ^ 0x167c0de, timeMs, { specialtyId: 'pirate' });
  const station = state.stations.get(stationId);
  if (station?.stock) {
    station.stock.pirateTier = 3;
    station.pirateTier = 3;
    station.stock.conversionRecipeOffers = [
      { recipeId: 'conv_iron_to_copper_basic', priceCredits: 120, tier: 1, reputationRequired: 0, stationTierMin: 1 },
      { recipeId: 'conv_scrap_to_iron_basic', priceCredits: 120, tier: 1, reputationRequired: 0, stationTierMin: 1 },
      { recipeId: 'conv_graphite_to_carbon_basic', priceCredits: 160, tier: 1, reputationRequired: 0, stationTierMin: 1 },
      { recipeId: 'conv_iron_carbon_to_steel', priceCredits: 260, tier: 2, reputationRequired: 0, stationTierMin: 2 },
      { recipeId: 'conv_copper_to_conductors', priceCredits: 240, tier: 2, reputationRequired: 0, stationTierMin: 2 },
      { recipeId: 'conv_bauxite_to_aluminium', priceCredits: 260, tier: 2, reputationRequired: 0, stationTierMin: 2 }
    ];
  }

  const resources = [
    ['ironOre', -760, -320], ['scrap', -520, -560], ['graphite', -260, -360],
    ['aluminiumOre', 520, -540], ['quartz', 760, -280], ['titaniumOre', 920, 180]
  ];
  resources.forEach(([resourceKey, x, y], i) => {
    spawnAsteroidProc(state, sx, sy, {
      x, y, radius: 44 + (i % 3) * 8, resourceKey, yieldValue: 24, seed: h ^ (0xc000 + i), sig: `test_industrial_converter_${resourceKey}_${i}`
    });
  });
}

function generateTestEffectsContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1600, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52, autoTrigger: true });
  spawnStation(state, sx, sy, -1600, 1500, true, h ^ 0xabc123, timeMs);
  spawnAllTestEffectZones(state, sx, sy);
}

function generateTestFoundationsContent(state, sx, sy, timeMs, h) {
  const wallColor = { r: 28, g: 34, b: 46 };
  const borderColor = { r: 118, g: 216, b: 255 };
  spawnPortal(state, sx, sy, -1650, -1650, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 54, autoTrigger: true });
  spawnStation(state, sx, sy, -1500, 1450, true, h ^ 0xf00101, timeMs);

  // Enclos de collision avec une vraie sortie à droite : ce secteur sert à tester
  // les futurs murs de base, pas à bloquer le joueur dans une boîte fermée.
  spawnBastionWall(state, sx, sy, { x: -900, y: -360, w: 110, h: 820 }, wallColor, borderColor, h ^ 0x11, `foundation_wall_${sx}_${sy}_l`);
  spawnBastionWall(state, sx, sy, { x: -110, y: -820, w: 1690, h: 110 }, wallColor, borderColor, h ^ 0x13, `foundation_wall_${sx}_${sy}_t`);
  spawnBastionWall(state, sx, sy, { x: -110, y: 100, w: 1690, h: 110 }, wallColor, borderColor, h ^ 0x14, `foundation_wall_${sx}_${sy}_b`);
  spawnBastionWall(state, sx, sy, { x: -180, y: -360, w: 110, h: 520 }, wallColor, borderColor, h ^ 0x15, `foundation_wall_${sx}_${sy}_mid`);
  spawnBastionWall(state, sx, sy, { x: 790, y: -650, w: 110, h: 340 }, wallColor, borderColor, h ^ 0x12, `foundation_wall_${sx}_${sy}_r_top`);
  spawnBastionWall(state, sx, sy, { x: 790, y: -70, w: 110, h: 340 }, wallColor, borderColor, h ^ 0x16, `foundation_wall_${sx}_${sy}_r_bottom`);
}


function generateTestBasesContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1650, -1650, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 54, autoTrigger: true });
  spawnStation(state, sx, sy, -1500, 1450, true, h ^ 0xb45101, timeMs);

  const wallColor = { r: 34, g: 50, b: 66 };
  const borderColor = { r: 96, g: 220, b: 255 };
  spawnBastionWall(state, sx, sy, { x: -760, y: -360, w: 420, h: 70 }, wallColor, borderColor, h ^ 0x910601, `test_base_static_wall_a_${sx}_${sy}`);
  spawnBastionWall(state, sx, sy, { x: -760, y: -120, w: 70, h: 420 }, wallColor, borderColor, h ^ 0x910602, `test_base_static_wall_b_${sx}_${sy}`);

  // Le reste du secteur est vide volontairement : ouvrir le panneau Base et poser
  // noyau, murs et coffre pour tester placement, collision et sauvegarde sandbox.
}

function generateTestBiomesContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1650, -1650, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 54, autoTrigger: true });
  spawnStation(state, sx, sy, -1500, 1450, true, h ^ 0xb10202, timeMs);

  // Ce secteur est un sas : il ne mélange plus toutes les ressources.
  // Chaque portail mène vers un vrai secteur de test dédié à un biome précis.
  const positions = [
    [-900, -520], [0, -520], [900, -520],
    [-900, 260], [0, 260], [900, 260]
  ];
  TEST_BIOME_SECTORS.forEach((target, i) => {
    const biome = SECTOR_BIOMES[target.biomeId] || SECTOR_BIOMES.metallic;
    const [x, y] = positions[i] || [0, 0];
    spawnPortal(state, sx, sy, x, y, 'sx' in target ? target.sx : SPECIAL_SECTORS.TEST_HUB.sx, target.sy, '◆', {
      label: `${target.label || biome.name}`,
      mode: `test_biome_${biome.id}`,
      radius: 68,
      autoTrigger: true
    });
  });
}

function generateBiomeShowcaseContent(state, sx, sy, timeMs, h, testBiome) {
  const biome = SECTOR_BIOMES[testBiome?.biomeId] || SECTOR_BIOMES.metallic;
  spawnPortal(state, sx, sy, -1650, -1650, SPECIAL_SECTORS.TEST_BIOMES.sx, SPECIAL_SECTORS.TEST_BIOMES.sy, '⌂', { label: 'Retour choix biomes', radius: 54, autoTrigger: true });
  spawnStation(state, sx, sy, -1500, 1450, true, h ^ 0xb10303, timeMs);

  const keys = (biome.resources || []).filter((key) => RESOURCE_DEFS[key]);
  const ringCount = Math.max(12, Math.min(24, keys.length * 4));
  for (let i = 0; i < ringCount; i += 1) {
    const resourceKey = keys[i % keys.length] || 'scrap';
    const rarityScore = getResourceRarityScore(resourceKey);
    const angle = (Math.PI * 2 * i / ringCount) + ((i % keys.length) * 0.17);
    const ring = 520 + (i % 3) * 330 + rarityScore * 24;
    const x = Math.cos(angle) * ring;
    const y = Math.sin(angle) * ring;
    const radius = 30 + Math.min(34, rarityScore * 4.5) + ((i * 13) % 18);
    const yieldValue = 2 + Math.floor(radius / 18) + Math.max(0, rarityScore - 1);
    spawnAsteroidProc(state, sx, sy, {
      x,
      y,
      radius,
      resourceKey,
      yieldValue,
      seed: h ^ (i * 9176) ^ (rarityScore * 101),
      sig: `test_biome_showcase_${sx}_${sy}_${i}_${resourceKey}`
    });
  }

  // Trois gisements plus gros pour vérifier rapidement que HP = quantité + dureté.
  keys.slice(-3).forEach((resourceKey, i) => {
    const rarityScore = getResourceRarityScore(resourceKey);
    spawnAsteroidProc(state, sx, sy, {
      x: -760 + i * 760,
      y: 1180,
      radius: 68 + rarityScore * 5,
      resourceKey,
      yieldValue: 10 + rarityScore * 2,
      seed: h ^ 0x550000 ^ (i * 1337),
      sig: `test_biome_heavy_${sx}_${sy}_${resourceKey}`
    });
  });
}

function generateStressArenaContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1600, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52, autoTrigger: true });
  spawnStation(state, sx, sy, -1450, 1450, true, h ^ 0x57e55, timeMs, { specialtyId: 'military' });

  const defs = listMobDefs().slice().sort((a, b) => (a.typeId ?? 0) - (b.typeId ?? 0));
  const mobIds = defs.map((d) => d.id).filter(Boolean);
  if (!mobIds.length) return;

  // Arène volontairement dense : elle sert à reproduire les pics réseau/CPU avec
  // beaucoup de mobs, projectiles et statuts autour d'un joueur haut niveau.
  const rings = [520, 760, 1040, 1320];
  let index = 0;
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const radius = rings[ringIndex];
    const count = 6 + ringIndex * 3;
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i / count) + ringIndex * 0.29;
      const mobId = mobIds[(index + ringIndex) % mobIds.length];
      const elite = ringIndex >= 2 && (i % 3 === 0);
      const mutated = !elite && ringIndex >= 1 && (i % 2 === 0);
      const mob = spawnMob(state, sx, sy, mobId, Math.cos(a) * radius, Math.sin(a) * radius, {
        seed: h ^ ((index + 1) * 2654435761),
        mapLevel: 42 + ringIndex * 3,
        elite,
        mutated,
        noLoot: true,
        spawnTimeMs: timeMs
      });
      mob.aggroRange = 2600;
      mob.leashRange = 3600;
      mob.homeX = 0;
      mob.homeY = 0;
      index += 1;
    }
  }

  for (let i = 0; i < 18; i += 1) {
    const a = Math.PI * 2 * i / 18;
    spawnAsteroidProc(state, sx, sy, {
      x: Math.cos(a) * 1680,
      y: Math.sin(a) * 1680,
      radius: 24 + (i % 5) * 7,
      resourceKey: i % 2 ? 'scrap' : 'ice',
      yieldValue: 1,
      seed: h ^ (i * 19937),
      sig: `stress_${sx}_${sy}_${i}`
    });
  }
}

function generateBastionExteriorContent(state, sx, sy, timeMs, h, bastion) {
  const c = getBastionColor(bastion.type);
  const wallColor = { r: 34, g: 38, b: 50 };
  const borderColor = { r: Math.min(255, (c.r | 0) + 8), g: Math.min(255, (c.g | 0) + 8), b: Math.min(255, (c.b | 0) + 8) };

  // Version web alignée sur le principe Windows Form : le portail de bastion est au centre
  // d'un labyrinthe extérieur avec murs infranchissables.
  const border = SECTOR.half * 0.20;
  const left = -SECTOR.half + border;
  const top = -SECTOR.half + border;
  const width = (SECTOR.half * 2) - border * 2;
  const height = (SECTOR.half * 2) - border * 2;
  const gridW = BASTION_EXTERIOR_GRID_W;
  const gridH = BASTION_EXTERIOR_GRID_H;
  const cellW = width / gridW;
  const cellH = height / gridH;
  const open = buildBastionExteriorMaze((bastion.variantSeed | 0) ^ h ^ 0xb45710);

  for (let y = 0; y < gridH; y += 1) {
    for (let x = 0; x < gridW; x += 1) {
      if (open[x][y]) continue;
      spawnBastionWall(state, sx, sy, {
        x: left + x * cellW - 1,
        y: top + y * cellH - 1,
        w: cellW + 2,
        h: cellH + 2
      }, wallColor, borderColor, h ^ (x * 911 + y * 3571), `bastion_wall_${bastion.id}_${x}_${y}`);
    }
  }

  // Une station de secours reste hors du bloc central pour ne pas obstruer le portail.
  spawnStation(state, sx, sy, -1450, 1450, true, h ^ 0xb45710, timeMs);

  spawnPortal(state, sx, sy, 0, 0, interiorSxForBastion(bastion), -9000, '◈', {
    label: `${bastion.name} • ${getBastionEffectSummary(bastion.type)}`,
    mode: 'bastion_entry',
    radius: 72,
    bastionId: bastion.id,
    bastionType: bastion.type,
    bastionTier: bastion.tier,
    bastionColor: c,
    cooldownMs: 1200
  });
}

function generateBastionInteriorContent(state, sx, sy, timeMs, h, bastion) {
  spawnBastionInteriorShell(state, sx, sy, bastion);
  spawnStation(state, sx, sy, -1380, 1380, true, h ^ 0x1b45710, timeMs);
}



function generateBattleArenaContent(state, sx, sy, timeMs, h) {
  const wallColor = { r: 24, g: 30, b: 44 };
  const borderColor = { r: 108, g: 201, b: 255 };
  const half = BATTLE.arenaHalf;
  const thick = 260;
  const span = half * 2 + thick * 2;
  spawnBastionWall(state, sx, sy, { x: -half - thick * 0.5, y: -half, w: thick, h: span }, wallColor, borderColor, h ^ 1, `br_wall_${sx}_${sy}_l`);
  spawnBastionWall(state, sx, sy, { x: half - thick * 0.5, y: -half, w: thick, h: span }, wallColor, borderColor, h ^ 2, `br_wall_${sx}_${sy}_r`);
  spawnBastionWall(state, sx, sy, { x: -half, y: -half - thick * 0.5, w: span, h: thick }, wallColor, borderColor, h ^ 3, `br_wall_${sx}_${sy}_t`);
  spawnBastionWall(state, sx, sy, { x: -half, y: half - thick * 0.5, w: span, h: thick }, wallColor, borderColor, h ^ 4, `br_wall_${sx}_${sy}_b`);

  const rng = new DotNetRandom(h ^ 0xbad601);
  const lanes = [-2400, -1200, 0, 1200, 2400];
  let n = 0;
  for (const x of lanes) {
    const gapY = -2200 + rng.nextDouble() * 4400;
    spawnBastionWall(state, sx, sy, { x: x - 42, y: -half + 700, w: 84, h: Math.max(400, gapY + half - 1100) }, wallColor, borderColor, h ^ (100 + n++), `br_wall_${sx}_${sy}_v_${n}_a`);
    spawnBastionWall(state, sx, sy, { x: x - 42, y: gapY + 700, w: 84, h: Math.max(400, half - gapY - 1100) }, wallColor, borderColor, h ^ (200 + n++), `br_wall_${sx}_${sy}_v_${n}_b`);
  }
  for (const y of lanes) {
    const gapX = -2200 + rng.nextDouble() * 4400;
    spawnBastionWall(state, sx, sy, { x: -half + 700, y: y - 42, w: Math.max(400, gapX + half - 1100), h: 84 }, wallColor, borderColor, h ^ (300 + n++), `br_wall_${sx}_${sy}_h_${n}_a`);
    spawnBastionWall(state, sx, sy, { x: gapX + 700, y: y - 42, w: Math.max(400, half - gapX - 1100), h: 84 }, wallColor, borderColor, h ^ (400 + n++), `br_wall_${sx}_${sy}_h_${n}_b`);
  }

  const zones = [
    { x: 0, y: 0, label: 'Centre' },
    { x: -2100, y: -2100, label: 'Nord-ouest' },
    { x: 2100, y: -2100, label: 'Nord-est' },
    { x: -2100, y: 2100, label: 'Sud-ouest' },
    { x: 2100, y: 2100, label: 'Sud-est' }
  ];
  for (const z of zones) {
    const id = newEntityId(state);
    state.areaEffects.set(id, { id, kind: 'battle_zone', sx, sy, x: z.x, y: z.y, radius: 260, durationLeft: 999999, slot: 'BR', frameId: 'battle', color: { r: 108, g: 201, b: 255 }, label: z.label });
  }
}

function randomTeleportTarget(seed, sx, sy) {
  const frontier = Math.min(50, Math.max(6, Math.max(Math.abs(sx | 0), Math.abs(sy | 0)) + 4));
  const rng = new DotNetRandom(hash2D_Mix((seed | 0) ^ 0x71a4d7, sx | 0, sy | 0));
  let tx = sx | 0;
  let ty = sy | 0;
  for (let i = 0; i < 80; i += 1) {
    const ang = rng.nextDouble() * Math.PI * 2;
    const r = Math.max(4, Math.round(frontier * (0.35 + rng.nextDouble() * 0.95)));
    tx = Math.round(Math.cos(ang) * r);
    ty = Math.round(Math.sin(ang) * r);
    if ((tx !== (sx | 0) || ty !== (sy | 0)) && Math.max(Math.abs(tx), Math.abs(ty)) <= 50) break;
  }
  return { sx: tx, sy: ty };
}

function shouldSpawnPirateShop(seed, sx, sy, frontier) {
  if (frontier < 4) return false;
  const h = hash2D_XorShift((seed | 0) ^ 0x515017e, sx | 0, sy | 0);
  return Math.abs(h % 20) === 0;
}

function shouldSpawnRandomTeleport(seed, sx, sy, frontier) {
  if (frontier < 6) return false;
  const h = hash2D_XorShift((seed | 0) ^ 0x7e1e907, sx | 0, sy | 0);
  return Math.abs(h % 29) === 0;
}

function rollPos(rng) {
  const min = -SECTOR.half + SECTOR.spawnMargin;
  const max = SECTOR.half - SECTOR.spawnMargin;
  return min + rng.nextDouble() * (max - min);
}

export 

function depositDisplayName(resourceKey) {
  return ({
    scrap: 'Débris métalliques',
    ironOre: 'Gisement de minerai de fer',
    copper: 'Veine de cuivre',
    nickelOre: 'Gisement de minerai de nickel',
    titaniumOre: 'Gisement de minerai de titane',
    aluminiumOre: 'Gisement de bauxite',
    cobaltOre: 'Gisement de minerai de cobalt',
    silicon: 'Gisement de silicium',
    quartz: 'Filon de quartz',
    graphite: 'Veine de graphite',
    lithiumOre: 'Gisement de minerai de lithium',
    boronOre: 'Gisement de minerai de bore',
    berylliumOre: 'Gisement de minerai de béryllium',
    rareEarthOre: 'Gisement de terres rares',
    waterIce: 'Gisement de glace d’eau',
    hydrogenIce: 'Gisement d’hydrogène solide',
    methaneIce: 'Gisement de méthane solide',
    ammoniaIce: 'Gisement d’ammoniac gelé',
    hydrocarbons: 'Poche d’hydrocarbures',
    sulfur: 'Gisement de soufre',
    uraniumOre: 'Gisement de minerai d’uranium',
    thoriumOre: 'Gisement de minerai de thorium',
    unstableIsotopes: 'Gisement d’isotopes instables',
    leadOre: 'Gisement de minerai de plomb',
    biomass: 'Nappe de biomasse',
    chitin: 'Dépôt de chitine',
    organicLipids: 'Poche de lipides organiques',
    enzymes: 'Nappe enzymatique',
    proteinFibers: 'Dépôt de fibres protéiques',
    spores: 'Nappe de spores',
    containedAntimatter: 'Anomalie d’antimatière confinée',
    strangeMatter: 'Anomalie de matière étrange',
    unknownTechFragment: 'Débris de technologie inconnue',
    ancientSuperconductor: 'Gisement de supraconducteur ancien',
    precursorNanomaterial: 'Nappe de nanomatériau précurseur'
  })[resourceKey] || (RESOURCE_DEFS[resourceKey]?.name ? `Gisement de ${RESOURCE_DEFS[resourceKey].name}` : `Gisement ${resourceKey}`);
}

function isDepositResourceKey(resourceKey) {
  const def = RESOURCE_DEFS[resourceKey];
  if (!def) return false;
  if (!def.spawnTier || def.spawnTier <= 0) return false;
  if (!def.shapeClass) return false;
  const blocked = [
    'Ingot', 'Plate', 'Wire', 'Circuit', 'processor', 'Battery', 'Cell', 'Fuel',
    'propellant', 'turbine', 'Pump', 'Motor', 'motor', 'Injector', 'Rod',
    'Ceramic', 'Fiber', 'Armor'
  ];
  return !blocked.some((part) => String(resourceKey).includes(part));
}

function depositCountForSector(mapLevel, rng) {
  const level = Math.max(0, mapLevel | 0);
  if (level <= 2) return rng.nextDouble() < 0.28 ? 1 : 0;
  if (level <= 6) return 1 + (rng.nextDouble() < 0.35 ? 1 : 0);
  if (level <= 12) return 2 + (rng.nextDouble() < 0.45 ? 1 : 0);
  if (level <= 24) return 3 + (rng.nextDouble() < 0.55 ? 1 : 0);
  if (level <= 42) return 4 + (rng.nextDouble() < 0.65 ? 1 : 0);
  return 5 + Math.min(3, Math.floor((level - 42) / 18)) + (rng.nextDouble() < 0.70 ? 1 : 0);
}

function weightedDepositKey(rng, specs, mapLevel) {
  const filtered = (specs || []).filter((s) => isDepositResourceKey(s.key));
  const pool = filtered.length ? filtered : Object.entries(RESOURCE_DEFS)
    .filter(([key]) => isDepositResourceKey(key))
    .map(([key, def]) => ({ key, weight: Math.max(0.05, def.baseWeight || 1) / Math.max(1, def.rarity || 1) }));
  const total = pool.reduce((acc, s) => acc + Math.max(0.0001, s.weight || 0), 0);
  let pick = rng.nextDouble() * total;
  for (const spec of pool) {
    pick -= Math.max(0.0001, spec.weight || 0);
    if (pick <= 0) return spec.key;
  }
  return pool[pool.length - 1]?.key || 'ironOre';
}

function hasStructureNear(state, sx, sy, type, x, y, radius = 96, worldId = 'endless') {
  const r2 = radius * radius;
  for (const st of state?.structures?.values?.() || []) {
    if (!st || st.type !== type) continue;
    if ((st.sx | 0) !== (sx | 0) || (st.sy | 0) !== (sy | 0)) continue;
    if (String(st.worldId || 'endless') !== String(worldId || 'endless')) continue;
    const dx = (Number(st.x) || 0) - x;
    const dy = (Number(st.y) || 0) - y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

function spawnResourceDeposit(state, sx, sy, x, y, resourceKey, amount, seed, worldId = 'endless', ownerId = 0) {
  const gx = Math.round(Number(x || 0) / 64) * 64;
  const gy = Math.round(Number(y || 0) / 64) * 64;
  if (hasStructureNear(state, sx, sy, 'resource_deposit', gx, gy, 128, worldId)) return null;
  const st = createStructure(state, 'resource_deposit', sx, sy, gx, gy, {
    ownerId,
    ownerKey: 'world',
    ownerName: 'Gisement',
    worldId,
    depositResourceKey: resourceKey,
    depositRemaining: -1,
    depositMax: -1,
    depositLabel: depositDisplayName(resourceKey),
    depositColorHex: RESOURCE_DEFS[resourceKey]?.colorHex || '#9ef0c7',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  if (!st) return null;
  st.name = depositDisplayName(resourceKey);
  st.depositSeed = seed | 0;
  st.color = RESOURCE_DEFS[resourceKey]?.colorHex || st.color;
  st.borderColor = RESOURCE_DEFS[resourceKey]?.colorHex || st.borderColor;
  state.structures.set(st.id, st);
  return st;
}

function spawnSectorResourceDeposits(state, sx, sy, rng, h, mapLevel, worldId = 'endless', ownerId = 0) {
  const count = depositCountForSector(mapLevel, rng);
  if (count <= 0) return;
  const pool = getSectorResourcePool(state.seed | 0, sx | 0, sy | 0, mapLevel | 0);
  const used = new Set();
  const biomeResources = (pool?.biome?.resources || []).filter(isDepositResourceKey);
  for (let i = 0; i < count; i += 1) {
    const angle = rng.nextDouble() * Math.PI * 2;
    const distance = 520 + rng.nextDouble() * 1050;
    const jitterX = (rng.nextDouble() - 0.5) * 220;
    const jitterY = (rng.nextDouble() - 0.5) * 220;
    const x = Math.max(-1536, Math.min(1536, Math.cos(angle) * distance + jitterX));
    const y = Math.max(-1536, Math.min(1536, Math.sin(angle) * distance + jitterY));

    let key = i < biomeResources.length && rng.nextDouble() < 0.65
      ? biomeResources[(Math.abs((h >> (i % 13)) + i * 7) % biomeResources.length)]
      : weightedDepositKey(rng, pool?.specs || [], mapLevel);

    if (used.has(key)) {
      for (let tries = 0; tries < 6 && used.has(key); tries += 1) key = weightedDepositKey(rng, pool?.specs || [], mapLevel);
    }
    used.add(key);

    const rarity = getResourceRarityScore(key);
    const amount = 160 + Math.floor(rng.nextDouble() * 140) + Math.max(0, rarity | 0) * 20;
    spawnResourceDeposit(state, sx, sy, x, y, key, amount, h ^ (i * 2654435761), worldId, ownerId);
  }
}


export function generateSectorContent(state, sx, sy, timeMs) {
  const seed = state.seed | 0;
  const h = hash2D_Mix(seed, sx, sy);
  const rng = new DotNetRandom(h);

  const hub = sx === 0 && sy === 0;
  const testHub = sx === SPECIAL_SECTORS.TEST_HUB.sx && sy === SPECIAL_SECTORS.TEST_HUB.sy;
  const testEffects = sx === SPECIAL_SECTORS.TEST_EFFECTS.sx && sy === SPECIAL_SECTORS.TEST_EFFECTS.sy;
  const testFoundations = sx === SPECIAL_SECTORS.TEST_FOUNDATIONS.sx && sy === SPECIAL_SECTORS.TEST_FOUNDATIONS.sy;
  const testBiomes = sx === SPECIAL_SECTORS.TEST_BIOMES.sx && sy === SPECIAL_SECTORS.TEST_BIOMES.sy;
  const testBases = sx === SPECIAL_SECTORS.TEST_BASES.sx && sy === SPECIAL_SECTORS.TEST_BASES.sy;
  const testMining = sx === SPECIAL_SECTORS.TEST_MINING.sx && sy === SPECIAL_SECTORS.TEST_MINING.sy;
  const testEquipment = sx === SPECIAL_SECTORS.TEST_EQUIPMENT.sx && sy === SPECIAL_SECTORS.TEST_EQUIPMENT.sy;
  const testPirateMarket = sx === SPECIAL_SECTORS.TEST_PIRATE_MARKET.sx && sy === SPECIAL_SECTORS.TEST_PIRATE_MARKET.sy;
  const testIndustrialConverter = sx === SPECIAL_SECTORS.TEST_INDUSTRIAL_CONVERTER.sx && sy === SPECIAL_SECTORS.TEST_INDUSTRIAL_CONVERTER.sy;
  const testPirateQuests = sx === SPECIAL_SECTORS.TEST_PIRATE_QUESTS.sx && sy === SPECIAL_SECTORS.TEST_PIRATE_QUESTS.sy;
  const testPirateReputation = sx === SPECIAL_SECTORS.TEST_PIRATE_REPUTATION.sx && sy === SPECIAL_SECTORS.TEST_PIRATE_REPUTATION.sy;
  const testBiomeSector = getTestBiomeSector(sx, sy);
  const mobBestiary = sx === SPECIAL_SECTORS.MOB_BESTIARY.sx && sy === SPECIAL_SECTORS.MOB_BESTIARY.sy;
  const stressArena = sx === SPECIAL_SECTORS.STRESS_ARENA.sx && sy === SPECIAL_SECTORS.STRESS_ARENA.sy;
  const mobFamilyIndex = getMobShowcaseFamilyIndex(sx, sy);
  const hyperLateShowcase = isHyperLateShowcaseSector(sx, sy);
  const battleArena = isBattleArenaSector(sx, sy);
  const mapLevel = sectorFrontierLevel(sx, sy);
  const bastion = getBastionAtSector(state, sx, sy);
  const interiorBastion = getBastionByInteriorSector(state, sx, sy);

  if (battleArena) {
    generateBattleArenaContent(state, sx, sy, timeMs, h);
    return;
  }

  if (interiorBastion) {
    generateBastionInteriorContent(state, sx, sy, timeMs, h, interiorBastion);
    return;
  }

  if (testHub) {
    generateTestHubContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testEffects) {
    generateTestEffectsContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testFoundations) {
    generateTestFoundationsContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testBiomes) {
    generateTestBiomesContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testBases) {
    generateTestBasesContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testMining) {
    generateTestMiningContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testEquipment) {
    generateTestEquipmentContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testPirateMarket) {
    generateTestPirateMarketContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testIndustrialConverter) {
    generateTestIndustrialConverterContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testPirateQuests) {
    generateTestPirateQuestsContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testPirateReputation) {
    generateTestPirateReputationContent(state, sx, sy, timeMs, h);
    return;
  }
  if (testBiomeSector) {
    generateBiomeShowcaseContent(state, sx, sy, timeMs, h, testBiomeSector);
    return;
  }
  if (mobBestiary) {
    generateMobBestiaryContent(state, sx, sy, timeMs, h);
    return;
  }
  if (stressArena) {
    generateStressArenaContent(state, sx, sy, timeMs, h);
    return;
  }
  if (mobFamilyIndex >= 0) {
    generateMobFamilyShowcaseContent(state, sx, sy, timeMs, h, mobFamilyIndex);
    return;
  }
  if (hyperLateShowcase) {
    generateHyperLateShowcaseContent(state, sx, sy, timeMs, h);
    return;
  }
  if (bastion) {
    generateBastionExteriorContent(state, sx, sy, timeMs, h, bastion);
    return;
  }

  spawnSectorResourceDeposits(state, sx, sy, rng, h, mapLevel, 'endless', 0);

  // --- Asteroids ---
  const asteroidCount = 16 + rng.nextMax(12) + Math.min(15, Math.floor(mapLevel / 3));
  for (let i = 0; i < asteroidCount; i++) {
    const x = rollPos(rng);
    const y = rollPos(rng);
    let radius = 14 + rng.nextDouble() * 28;
    const resourceKey = rollResourceKeyForSector(rng, mapLevel, sx, sy, state.seed | 0);
    const rarityScore = getResourceRarityScore(resourceKey);
    radius += Math.min(16, rarityScore * 1.35 + rng.nextDouble() * rarityScore);
    const yieldValue = 1 + rng.nextRange(1, 4) + Math.floor(radius / 18) + Math.floor(Math.max(0, rarityScore - 2) / 2);

    const sig = asteroidKey(sx, sy, x, y, resourceKey, yieldValue, false);
    if (state.destroyedAsteroidSigs?.has?.(sig)) continue;
    const until = state.asteroidCooldownUntil.get(sig) ?? 0;
    if (until > timeMs) continue;

    spawnAsteroidProc(state, sx, sy, {
      x,
      y,
      radius,
      resourceKey,
      yieldValue,
      seed: h ^ (i * 73856093),
      sig
    });
  }

  // --- Stations ---
  if (hub) {
    spawnStation(state, sx, sy, 0, 0, true, h, timeMs);
  } else {
    const frontier = Math.max(Math.abs(sx | 0), Math.abs(sy | 0));
    const hasNormalStation = (h & 7) === 0;
    const hasPirateShop = shouldSpawnPirateShop(seed, sx, sy, frontier);
    if (hasNormalStation || hasPirateShop) {
      const min = -SECTOR.half + 400;
      const max = SECTOR.half - 400;
      const x = min + rng.nextDouble() * (max - min);
      const y = min + rng.nextDouble() * (max - min);
      const tech = (h & 31) === 0;
      if (hasPirateShop) {
        spawnStation(state, sx, sy, x, y, true, h ^ 0x51eaf00d, timeMs, { specialtyId: 'pirate' });
      } else {
        spawnStation(state, sx, sy, x, y, tech, h, timeMs);
      }
    }
  }

  // --- Mobs ---
  if (!hub) spawnSectorMobs(state, sx, sy, rng, h, timeMs);

  // --- Special portals ---
  if (!hub) {
    const frontier = Math.max(Math.abs(sx | 0), Math.abs(sy | 0));
    const min = -SECTOR.half + 320;
    const max = SECTOR.half - 320;
    const ph = hash2D_XorShift(seed ^ 0x2f6e2b1, sx, sy);
    if (Math.abs(ph % 20) === 0) {
      const x = min + rng.nextDouble() * (max - min);
      const y = min + rng.nextDouble() * (max - min);
      spawnPortal(state, sx, sy, x, y, 0, 0, '⌂', { label: 'Retour hub', mode: 'return_hub', radius: 42 });
    }
    if (shouldSpawnRandomTeleport(seed, sx, sy, frontier)) {
      const t = randomTeleportTarget(seed, sx, sy);
      const x = min + rng.nextDouble() * (max - min);
      const y = min + rng.nextDouble() * (max - min);
      spawnPortal(state, sx, sy, x, y, t.sx, t.sy, '◇', { label: `Téléporteur instable → [${t.sx},${t.sy}]`, mode: 'random_tp', radius: 44, cooldownMs: 1600 });
    }
  }
}
