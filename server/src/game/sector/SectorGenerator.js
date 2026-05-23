import { SECTOR } from './SectorDefs.js';
import { sectorFrontierLevel } from './SectorMath.js';
import { hash2D_Mix, hash2D_XorShift } from '../util/HashUtil.js';
import { DotNetRandom } from '../util/DotNetRandom.js';
import { rollResourceKeyForSector } from '../asteroid/AsteroidSpawnDirector.js';
import { getResourceRarityScore } from '../inventory/ResourceDefs.js';
import { spawnAsteroidProc } from '../asteroid/AsteroidFactory.js';
import { spawnStation } from '../station/StationFactory.js';
import { spawnPortal } from '../portal/PortalFactory.js';
import { asteroidKey } from '../asteroid/AsteroidKey.js';
import { spawnSectorMobs } from '../mob/MobSpawnDirector.js';
import { spawnMob } from '../mob/MobFactory.js';
import { newEntityId } from '../state/GameState.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { FACTIONS } from '../constants.js';
import { listMobDefs } from '../../../../shared/content/mobs/MobDefs.js';
import { spawnAllTestEffectZones } from '../status/TestEffectZoneSystem.js';
import { getBastionAtSector, getBastionByInteriorSector, interiorSxForBastion } from '../bastion/BastionSession.js';
import { spawnBastionInteriorShell } from '../bastion/BastionSystem.js';
import { SPECIAL_SECTORS } from './SpecialSectors.js';
import { BATTLE, isBattleArenaSector } from '../modes/GameModes.js';
import { getBastionColor, getBastionEffectSummary } from '../bastion/BastionTypes.js';

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
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52 });
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
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52 });
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
  spawnPortal(state, sx, sy, -1700, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52 });
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
    radius: 56
  });
  spawnPortal(state, sx, sy, 0, -520, SPECIAL_SECTORS.TEST_EFFECTS.sx, SPECIAL_SECTORS.TEST_EFFECTS.sy, '✦', {
    label: 'Test effets / abilities',
    mode: 'test_arena',
    radius: 56
  });
  spawnPortal(state, sx, sy, 760, -520, SPECIAL_SECTORS.TEST_FOUNDATIONS.sx, SPECIAL_SECTORS.TEST_FOUNDATIONS.sy, '▣', {
    label: 'Test fondations',
    mode: 'test_foundations',
    radius: 56
  });
  spawnPortal(state, sx, sy, 1520, -520, SPECIAL_SECTORS.TEST_BIOMES.sx, SPECIAL_SECTORS.TEST_BIOMES.sy, '◆', {
    label: 'Test biomes U2',
    mode: 'test_biomes',
    radius: 56
  });
  spawnPortal(state, sx, sy, -380, 320, SPECIAL_SECTORS.STRESS_ARENA.sx, SPECIAL_SECTORS.STRESS_ARENA.sy, '⚡', {
    label: 'Stress test réseau',
    mode: 'stress_test',
    radius: 50
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

function generateTestEffectsContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1600, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52 });
  spawnStation(state, sx, sy, -1600, 1500, true, h ^ 0xabc123, timeMs);
  spawnAllTestEffectZones(state, sx, sy);
}

function generateTestFoundationsContent(state, sx, sy, timeMs, h) {
  const wallColor = { r: 28, g: 34, b: 46 };
  const borderColor = { r: 118, g: 216, b: 255 };
  spawnPortal(state, sx, sy, -1650, -1650, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 54 });
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

function generateTestBiomesContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1650, -1650, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 54 });
  spawnStation(state, sx, sy, -1500, 1450, true, h ^ 0xb10202, timeMs);

  const rows = [
    { label: 'Métal', keys: ['ironOre', 'copper', 'nickelOre', 'titaniumOre'], y: -820 },
    { label: 'Silicate', keys: ['silicon', 'quartz', 'graphite', 'rareEarthOre'], y: -360 },
    { label: 'Organique', keys: ['biomass', 'chitin', 'enzymes', 'spores'], y: 100 },
    { label: 'Volatile', keys: ['waterIce', 'hydrocarbons', 'methaneIce', 'sulfur'], y: 560 },
    { label: 'Radioactif / ancien', keys: ['uraniumOre', 'thoriumOre', 'unknownTechFragment', 'ancientSuperconductor'], y: 1020 }
  ];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let i = 0; i < row.keys.length; i += 1) {
      const x = -1080 + i * 700;
      const resourceKey = row.keys[i];
      const rarityScore = getResourceRarityScore(resourceKey);
      const radius = 52 + rarityScore * 4;
      const yieldValue = 6 + rarityScore;
      spawnAsteroidProc(state, sx, sy, {
        x,
        y: row.y,
        radius,
        resourceKey,
        yieldValue,
        seed: h ^ (rowIndex * 1009) ^ (i * 9176),
        sig: `test_biome_${sx}_${sy}_${resourceKey}`
      });
    }
  }
}

function generateStressArenaContent(state, sx, sy, timeMs, h) {
  spawnPortal(state, sx, sy, -1600, -1600, SPECIAL_SECTORS.TEST_HUB.sx, SPECIAL_SECTORS.TEST_HUB.sy, '⌂', { label: 'Retour hub test', radius: 52 });
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
  if (frontier < 12) return false;
  const h = hash2D_XorShift((seed | 0) ^ 0x515017e, sx | 0, sy | 0);
  return Math.abs(h % 37) === 0;
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

export function generateSectorContent(state, sx, sy, timeMs) {
  const seed = state.seed | 0;
  const h = hash2D_Mix(seed, sx, sy);
  const rng = new DotNetRandom(h);

  const hub = sx === 0 && sy === 0;
  const testHub = sx === SPECIAL_SECTORS.TEST_HUB.sx && sy === SPECIAL_SECTORS.TEST_HUB.sy;
  const testEffects = sx === SPECIAL_SECTORS.TEST_EFFECTS.sx && sy === SPECIAL_SECTORS.TEST_EFFECTS.sy;
  const testFoundations = sx === SPECIAL_SECTORS.TEST_FOUNDATIONS.sx && sy === SPECIAL_SECTORS.TEST_FOUNDATIONS.sy;
  const testBiomes = sx === SPECIAL_SECTORS.TEST_BIOMES.sx && sy === SPECIAL_SECTORS.TEST_BIOMES.sy;
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
