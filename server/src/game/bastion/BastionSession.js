import { BASTION_TYPE_ORDER, getBastionEffectSummary, getBastionLabel } from './BastionTypes.js';
import { DotNetRandom } from '../util/DotNetRandom.js';
import { hash2D_Mix } from '../util/HashUtil.js';
import { getBastionUnlockBiasMs } from './BastionBuffs.js';

export const BASTION_INTERIOR_BASE_SX = 9000;
export const BASTION_INTERIOR_SY = -9000;
export const BASTION_ACTIVE_RADIUS = 50;
export const SESSION_DURATION_MS = 60 * 60 * 1000;

export function bastionKey(sx, sy) {
  return `${sx | 0},${sy | 0}`;
}

export function bastionRunKey(bastionId, playerId) {
  return `${bastionId | 0}:${playerId | 0}`;
}

export function frontierForSector(sx, sy) {
  return Math.min(BASTION_ACTIVE_RADIUS, Math.max(Math.abs(sx | 0), Math.abs(sy | 0)));
}

export function interiorSxForBastion(bastion) {
  return BASTION_INTERIOR_BASE_SX + (bastion?.id | 0);
}

export function interiorSxForBastionRun(bastion, playerId) {
  return BASTION_INTERIOR_BASE_SX + (bastion?.id | 0) * 1000 + Math.max(1, playerId | 0);
}

export function getBastionRunByInteriorSector(state, sx, sy) {
  if ((sy | 0) !== BASTION_INTERIOR_SY) return null;
  return state.bastionRunsBySector?.get?.(bastionKey(sx, sy)) ?? null;
}

export function getBastionByInteriorSector(state, sx, sy) {
  if ((sy | 0) !== BASTION_INTERIOR_SY) return null;
  const run = getBastionRunByInteriorSector(state, sx, sy);
  if (run) return state.bastionsById?.get?.(run.bastionId | 0) ?? null;
  const id = (sx | 0) - BASTION_INTERIOR_BASE_SX;
  return state.bastionsById?.get?.(id) ?? null;
}

function buildEncounter(tier, sx, sy, seed) {
  const rng = new DotNetRandom(hash2D_Mix(seed | 0, sx | 0, sy | 0));
  const frontier = Math.max(1, frontierForSector(sx, sy));
  const waveCount = tier <= 1 ? 3 : tier === 2 ? 4 : tier === 3 ? 5 : 6;
  const waves = [];
  for (let w = 0; w < waveCount; w += 1) {
    const boss = w === waveCount - 1;
    const spawns = [];
    if (boss) {
      spawns.push({ mobId: 'apex_predator', elite: true, boss: true, level: 14 + tier * 4 + Math.floor(frontier / 6) });
    } else {
      const count = Math.max(3, Math.min(9, 3 + tier + Math.floor(w / 2) + rng.nextRange(0, 2)));
      for (let i = 0; i < count; i += 1) {
        const level = frontier + w * 3 + tier * 2;
        const pool = level < 8 ? ['ferrous_mite', 'scoria_sapper', 'orbital_stinger']
          : level < 16 ? ['ferrous_mite', 'scoria_sapper', 'orbital_stinger', 'prismatic_lancer', 'sentinel_nodule']
          : level < 28 ? ['orbital_stinger', 'prismatic_lancer', 'sentinel_nodule', 'plasma_crusher', 'arc_warden']
          : level < 40 ? ['prismatic_lancer', 'sentinel_nodule', 'plasma_crusher', 'arc_warden', 'vector_specter', 'shrapnel_hydra']
          : ['sentinel_nodule', 'plasma_crusher', 'arc_warden', 'vector_specter', 'shrapnel_hydra', 'apex_predator'];
        spawns.push({
          mobId: pool[rng.nextMax(pool.length)],
          elite: rng.nextDouble() < 0.08 + tier * 0.025 + w * 0.012,
          boss: false,
          level: Math.max(1, level + rng.nextRange(-2, 3))
        });
      }
    }
    waves.push({ index: w, boss, spawns });
  }
  return { waves, rewardItemCount: tier >= 4 ? 2 : 1 };
}

export function initializeSessionBastions(state) {
  state.sessionDurationMs = SESSION_DURATION_MS;
  state.bastions = [];
  state.bastionsBySector = new Map();
  state.bastionsById = new Map();
  state.bastionRuns = new Map();
  state.bastionRunsBySector = new Map();

  const rng = new DotNetRandom((state.seed | 0) ^ 0x51a77b3);
  const used = new Set();
  // One hour run: bastions open progressively. No free instant bastion anymore.
  const plan = [
    [1, 5 * 60 * 1000, 8, 16], [1, 10 * 60 * 1000, 8, 16], [1, 15 * 60 * 1000, 9, 18],
    [2, 20 * 60 * 1000, 16, 26], [2, 25 * 60 * 1000, 18, 28], [2, 30 * 60 * 1000, 20, 30],
    [3, 36 * 60 * 1000, 26, 36], [3, 42 * 60 * 1000, 28, 38],
    [4, 50 * 60 * 1000, 34, 44], [5, 55 * 60 * 1000, 40, 48]
  ];
  const quadrants = [[-1, -1], [1, 1], [-1, 1], [1, -1], [1, -1], [-1, 1], [1, 1], [-1, -1], [-1, 1], [1, -1]];

  for (let i = 0; i < plan.length; i += 1) {
    const [tier, unlockAtMs, minAbs, maxAbs] = plan[i];
    const sign = quadrants[i % quadrants.length];
    let sx = sign[0] * minAbs;
    let sy = sign[1] * minAbs;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      let bx = rng.nextRange(minAbs, maxAbs + 1);
      let by = rng.nextRange(minAbs, maxAbs + 1);
      if (rng.nextDouble() < 0.28) {
        const tweak = rng.nextRange(-4, 5);
        if (rng.nextMax(2) === 0) bx = Math.max(minAbs, Math.min(maxAbs, bx + tweak));
        else by = Math.max(minAbs, Math.min(maxAbs, by + tweak));
      }
      const tx = sign[0] * bx;
      const ty = sign[1] * by;
      const key = bastionKey(tx, ty);
      if (used.has(key)) continue;
      const tooClose = (state.bastions || []).some((b) => Math.abs(b.sx - tx) + Math.abs(b.sy - ty) < 14);
      if (tooClose) continue;
      sx = tx;
      sy = ty;
      used.add(key);
      break;
    }
    const type = BASTION_TYPE_ORDER[rng.nextMax(BASTION_TYPE_ORDER.length)];
    const variantSeed = rng.nextMax(2147483647);
    const bastion = {
      id: i,
      type,
      tier,
      sx,
      sy,
      unlockAtMs,
      variantSeed,
      name: getBastionLabel(type, tier),
      captured: false,
      capturedBy: '',
      capturedById: 0,
      capturedAtMs: 0,
      encounter: buildEncounter(tier, sx, sy, variantSeed)
    };
    state.bastions.push(bastion);
    state.bastionsBySector.set(bastionKey(sx, sy), bastion);
    state.bastionsById.set(bastion.id, bastion);
  }
}

export function getBastionAtSector(state, sx, sy) {
  return state.bastionsBySector?.get?.(bastionKey(sx, sy)) ?? null;
}

export function getSessionElapsedMs(state, timeMs) {
  const start = state?.time?.startedAtMs ?? timeMs;
  return Math.max(0, (timeMs | 0) - (start | 0));
}

export function getSessionRemainingMs(state, timeMs) {
  return Math.max(0, (state?.sessionDurationMs ?? SESSION_DURATION_MS) - getSessionElapsedMs(state, timeMs));
}

export function isBastionUnlockedForPlayer(player, bastion, timeMs, state = null) {
  const elapsed = state ? getSessionElapsedMs(state, timeMs) : (timeMs | 0);
  const bias = getBastionUnlockBiasMs(player);
  return (elapsed + bias) >= (bastion?.unlockAtMs ?? Infinity);
}

export function getBastionUnlockText(player, bastion, timeMs, state = null) {
  if (!bastion) return '';
  if (bastion.captured) return `Capturé${bastion.capturedBy ? ` par ${bastion.capturedBy}` : ''}`;
  if (isBastionUnlockedForPlayer(player, bastion, timeMs, state)) return 'Ouvert';
  const elapsed = state ? getSessionElapsedMs(state, timeMs) : (timeMs | 0);
  const left = Math.max(0, (bastion.unlockAtMs | 0) - elapsed - getBastionUnlockBiasMs(player));
  const sec = Math.ceil(left / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `Ouvre dans ${mm}:${ss}`;
}

export function buildBastionTooltip(bastion) {
  return `${bastion.name}\nEffet: ${getBastionEffectSummary(bastion.type)}\nTier: ${bastion.tier}\nSecteur: [${bastion.sx},${bastion.sy}]`;
}
