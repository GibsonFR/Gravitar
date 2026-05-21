import { spawnMob } from '../mob/MobFactory.js';
import { newEntityId } from '../state/GameState.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { FACTIONS } from '../constants.js';
import { SECTOR } from '../sector/SectorDefs.js';
import { spawnPortal } from '../portal/PortalFactory.js';
import { grantBastionBuff } from './BastionBuffs.js';
import { bastionKey, bastionRunKey, getBastionRunByInteriorSector, interiorSxForBastionRun, BASTION_INTERIOR_SY } from './BastionSession.js';
import { getBastionColor, getBastionEffectSummary } from './BastionTypes.js';
import { spawnItemLootInSector } from '../loot/LootFactory.js';
import { listItemDefs } from '../../../../shared/content/items/ItemDefs.js';
import { ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';


function spawnBastionBoundaryWall(state, sx, sy, x, y, w, h, color, seed) {
  const id = newEntityId(state);
  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    faction: FACTIONS.ASTEROID,
    sx: sx | 0,
    sy: sy | 0,
    x,
    y,
    radius: Math.max(w, h) * 0.5,
    w,
    h,
    stats: createStatBlock({ maxHp: 99999999 }),
    yieldValue: 0,
    resource: 'bastion_wall',
    resourceName: 'Mur de bastion',
    resourceColorHex: null,
    color,
    borderColor: color,
    rot: 0,
    spin: 0,
    shapeSeed: seed & 7,
    secret: true,
    respawnAt: 0,
    rarity: 'bastion_wall',
    diedAt: 0,
    killedById: 0,
    dropsSpawned: true,
    sig: `bastion_boundary_${sx}_${sy}_${seed}`,
    bastionWall: true,
    solid: true,
    invulnerable: true,
    unselectable: true
  });
}

function spawnBastionInteriorBoundaryWalls(state, sx, sy, color) {
  const limit = SECTOR.half - 130;
  const thick = 260;
  const span = SECTOR.half * 2 + thick * 2;
  spawnBastionBoundaryWall(state, sx, sy, 0, -limit, span, thick, color, 1);
  spawnBastionBoundaryWall(state, sx, sy, 0, limit, span, thick, color, 2);
  spawnBastionBoundaryWall(state, sx, sy, -limit, 0, thick, span, color, 3);
  spawnBastionBoundaryWall(state, sx, sy, limit, 0, thick, span, color, 4);
}


function pickBastionRewardItem(bastion, player) {
  const allowed = new Set([
    ITEM_CATEGORY_IDS.WEAPON,
    ITEM_CATEGORY_IDS.LAUNCHER,
    ITEM_CATEGORY_IDS.DEFENSE,
    ITEM_CATEGORY_IDS.ENGINE,
    ITEM_CATEGORY_IDS.MODULE,
    ITEM_CATEGORY_IDS.CONVERTER
  ]);
  const owned = new Set(player?.equipment?.ownedItemIds ?? []);
  const maxTier = Math.max(1, Math.min(3, (bastion?.tier | 0) + 1));
  let pool = listItemDefs().filter((item) => allowed.has(item.categoryId) && item.shopOffer !== false && (item.tier | 0) <= maxTier && !owned.has(item.id));
  if (!pool.length) pool = listItemDefs().filter((item) => allowed.has(item.categoryId) && item.shopOffer !== false && !owned.has(item.id));
  if (!pool.length) pool = listItemDefs().filter((item) => allowed.has(item.categoryId) && item.shopOffer !== false);
  if (!pool.length) return null;
  const seed = ((bastion?.variantSeed | 0) ^ ((player?.id | 0) * 1103515245) ^ ((bastion?.capturedAtMs | 0) * 31)) >>> 0;
  const weighted = [];
  for (const item of pool) {
    const tier = Math.max(1, item.tier | 0);
    const w = Math.max(1, 5 - Math.abs(maxTier - tier) * 2);
    for (let i = 0; i < w; i += 1) weighted.push(item);
  }
  return weighted[seed % weighted.length];
}

function spawnBastionRewardBox(state, bastion, run, winner, timeMs) {
  if (run.rewardBoxSpawned) return;
  const item = pickBastionRewardItem(bastion, winner);
  if (!item) return;
  run.rewardBoxSpawned = true;
  const a = randUnit((bastion.variantSeed | 0) + winner.id * 41) * Math.PI * 2;
  const d = 120 + randUnit((bastion.variantSeed | 0) + winner.id * 97) * 90;
  spawnItemLootInSector(state, run.sx, run.sy, Math.cos(a) * d, Math.sin(a) * d, item.id, timeMs, {
    bastionReward: true,
    sourceKind: 'bastion',
    sourceId: bastion.id | 0,
    lifetimeSec: 600,
    radius: 18,
    color: getBastionColor(bastion.type)
  });
}

function randUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function ensureRunTables(state) {
  if (!state.bastionRuns) state.bastionRuns = new Map();
  if (!state.bastionRunsBySector) state.bastionRunsBySector = new Map();
}

function makeRun(state, player, bastion, timeMs) {
  ensureRunTables(state);
  const key = bastionRunKey(bastion.id, player.id);
  const sx = interiorSxForBastionRun(bastion, player.id);
  const sy = BASTION_INTERIOR_SY;
  const run = {
    key,
    bastionId: bastion.id | 0,
    playerId: player.id | 0,
    sx,
    sy,
    currentWave: -1,
    nextWaveAtMs: timeMs + 2600,
    rewardGranted: false,
    exitSpawned: false,
    lost: false,
    startedAtMs: timeMs | 0
  };
  state.bastionRuns.set(key, run);
  state.bastionRunsBySector.set(bastionKey(sx, sy), run);
  return run;
}

export function enterBastion(state, player, bastion, timeMs) {
  if (!player || !bastion || bastion.captured) return false;
  const run = makeRun(state, player, bastion, timeMs);
  player.bastionReturn = { sx: player.sx | 0, sy: player.sy | 0, x: player.x, y: player.y };
  player.bastionRunKey = run.key;
  player.sx = run.sx;
  player.sy = run.sy;
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.uiHint = `${bastion.name} • salle séparée • première vague dans 3s`;
  player.uiHintTimer = 3.2;
  return true;
}

export function exitBastion(state, player, timeMs) {
  if (!player?.bastionReturn) return false;
  const ret = player.bastionReturn;
  player.sx = ret.sx | 0;
  player.sy = ret.sy | 0;
  player.x = Number.isFinite(ret.x) ? ret.x : 0;
  player.y = Number.isFinite(ret.y) ? ret.y : 0;
  player.vx = 0;
  player.vy = 0;
  player.hasMoveTarget = false;
  player.autoTargetKind = '';
  player.autoTargetId = 0;
  player.selectedKind = '';
  player.selectedId = 0;
  player.bastionReturn = null;
  player.bastionRunKey = '';
  player.uiHint = 'Retour secteur extérieur';
  player.uiHintTimer = 1.8;
  return true;
}

function countAliveRunMobs(state, run) {
  let count = 0;
  for (const mob of state.mobs.values()) {
    if ((mob.sx | 0) === (run.sx | 0) && (mob.sy | 0) === (run.sy | 0) && mob.bastionRunKey === run.key && (mob.stats?.hp ?? 0) > 0) count += 1;
  }
  return count;
}

function spawnBastionWave(state, bastion, run, timeMs) {
  run.currentWave = (run.currentWave | 0) + 1;
  const wave = bastion.encounter?.waves?.[run.currentWave];
  if (!wave) return false;
  const total = Math.max(1, wave.spawns.length);
  const radius = wave.boss ? 760 : 620 + bastion.tier * 32;
  for (let i = 0; i < wave.spawns.length; i += 1) {
    const spawn = wave.spawns[i];
    const a = (Math.PI * 2 * i / total) + randUnit((bastion.variantSeed | 0) + i * 97 + run.currentWave * 31 + run.playerId * 13) * 0.55;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    const mob = spawnMob(state, run.sx, run.sy, spawn.mobId, x, y, {
      seed: (bastion.variantSeed | 0) ^ (i * 2654435761) ^ (run.currentWave * 8191) ^ (run.playerId * 131),
      mapLevel: spawn.level || 1,
      elite: !!spawn.elite || !!spawn.boss,
      spawnTimeMs: timeMs
    });
    mob.bastionId = bastion.id | 0;
    mob.bastionRunKey = run.key;
    mob.bastionOwnerPlayerId = run.playerId | 0;
    mob.noLoot = true;
    mob.xpReward = 0;
    mob.leashRange = 2200;
    mob.aggroRange = 2600;
    if (spawn.boss) {
      mob.name = `Boss ${bastion.name}`;
      mob.shortName = 'Boss';
      mob.bastionBoss = true;
      mob.radius *= 1.28;
      mob.stats.maxHp = Math.round((mob.stats.maxHp || 100) * (2.25 + bastion.tier * 0.35));
      mob.stats.hp = mob.stats.maxHp;
      mob.attackDamage *= 1.25 + bastion.tier * 0.10;
      mob.threat = (mob.threat || 1) + bastion.tier;
    }
  }
  const p = state.players.get(run.playerId | 0);
  if (p && (p.sx | 0) === (run.sx | 0) && (p.sy | 0) === (run.sy | 0)) {
    p.uiHint = wave.boss ? 'Boss du bastion' : `Vague ${run.currentWave + 1}/${bastion.encounter.waves.length}`;
    p.uiHintTimer = 2.0;
  }
  return true;
}

function playerInsideRun(state, run) {
  const p = state.players.get(run.playerId | 0);
  return !!p && (p.sx | 0) === (run.sx | 0) && (p.sy | 0) === (run.sy | 0);
}

function spawnExitIfNeeded(state, bastion, run, label = 'Sortie bastion') {
  if (run.exitSpawned) return;
  run.exitSpawned = true;
  spawnPortal(state, run.sx, run.sy, 0, 0, bastion.sx, bastion.sy, '↺', {
    label,
    mode: 'bastion_exit',
    radius: 58
  });
}

function despawnBastionRunMobsAndProjectiles(state, bastionId) {
  for (const [id, mob] of state.mobs) {
    if ((mob.bastionId | 0) === (bastionId | 0)) state.mobs.delete(id);
  }
  for (const [id, pr] of state.projectiles) {
    if ((pr.bastionId | 0) === (bastionId | 0)) state.projectiles.delete(id);
  }
}

function markOtherRunsLost(state, bastion, winnerRun, timeMs) {
  for (const run of state.bastionRuns?.values?.() ?? []) {
    if ((run.bastionId | 0) !== (bastion.id | 0) || run.key === winnerRun.key) continue;
    run.lost = true;
    run.nextWaveAtMs = 0;
    spawnExitIfNeeded(state, bastion, run, `${bastion.name} déjà capturé`);
    const p = state.players.get(run.playerId | 0);
    if (p && (p.sx | 0) === (run.sx | 0) && (p.sy | 0) === (run.sy | 0)) {
      p.uiHint = `${bastion.name} remporté par ${bastion.capturedBy}`;
      p.uiHintTimer = 4.0;
    }
  }
}

function despawnRunMobsAndProjectiles(state, run) {
  for (const [id, mob] of state.mobs) if (mob.bastionRunKey === run.key) state.mobs.delete(id);
  for (const [id, pr] of state.projectiles) if (pr.bastionRunKey === run.key) state.projectiles.delete(id);
}

function resolveBastionRun(state, bastion, run, timeMs) {
  if (run.rewardGranted) return;
  const winner = state.players.get(run.playerId | 0);
  if (!winner) return;
  run.rewardGranted = true;

  if (!Array.isArray(winner.completedBastionIds)) winner.completedBastionIds = [];
  if (!winner.completedBastionIds.includes(bastion.id | 0)) winner.completedBastionIds.push(bastion.id | 0);

  grantBastionBuff(winner, bastion, timeMs);
  spawnBastionRewardBox(state, bastion, run, winner, timeMs);
  winner.uiHint = `${bastion.name} réussi • coffre de bastion apparu • ${getBastionEffectSummary(bastion.type)}`;
  winner.uiHintTimer = 5.0;

  if (winner.gameMode === 'endless') {
    despawnRunMobsAndProjectiles(state, run);
    spawnExitIfNeeded(state, bastion, run, 'Sortie victoire');
    return;
  }

  bastion.captured = true;
  bastion.capturedBy = winner.pseudo || `Joueur ${winner.id}`;
  bastion.capturedById = winner.id | 0;
  bastion.capturedAtMs = timeMs | 0;
  despawnBastionRunMobsAndProjectiles(state, bastion.id);
  spawnExitIfNeeded(state, bastion, run, 'Sortie victoire');
  markOtherRunsLost(state, bastion, run, timeMs);
}

export function updateBastions(state, dt, timeMs) {
  if (!state?.bastions?.length || !state?.bastionRuns?.size) return;
  for (const run of state.bastionRuns.values()) {
    const bastion = state.bastionsById?.get?.(run.bastionId | 0);
    if (!bastion || !playerInsideRun(state, run)) continue;
    if (bastion.captured) {
      if (!run.exitSpawned) {
        run.lost = (bastion.capturedById | 0) !== (run.playerId | 0);
        spawnExitIfNeeded(state, bastion, run, run.lost ? `${bastion.name} déjà capturé` : 'Sortie victoire');
      }
      continue;
    }
    if (run.lost) continue;
    if ((run.nextWaveAtMs | 0) > 0 && timeMs >= (run.nextWaveAtMs | 0)) {
      run.nextWaveAtMs = 0;
      spawnBastionWave(state, bastion, run, timeMs);
      continue;
    }
    if ((run.currentWave | 0) >= 0 && countAliveRunMobs(state, run) <= 0) {
      const lastWave = run.currentWave >= (bastion.encounter?.waves?.length ?? 0) - 1;
      if (lastWave) resolveBastionRun(state, bastion, run, timeMs);
      else run.nextWaveAtMs = timeMs + 2750;
    }
  }
}

export function spawnBastionInteriorShell(state, sx, sy, bastion) {
  const color = getBastionColor(bastion.type);
  const base = state.ids.nextEntityId++;
  state.areaEffects.set(base, {
    id: base,
    kind: 'bastion_arena',
    sx, sy,
    x: 0,
    y: 0,
    radius: 1180,
    durationLeft: 999999,
    slot: 'B',
    frameId: 'bastion',
    color,
    label: `${bastion.name} — salle séparée`
  });
  spawnBastionInteriorBoundaryWalls(state, sx, sy, { r: 20, g: 24, b: 34 });
}
