import { newEntityId } from '../state/GameState.js';
import { FACTIONS } from '../constants.js';
import { createStatBlock } from '../stats/StatBlockFactory.js';
import { applyStatus } from './StatusRack.js';
import { STATUS_EFFECT_IDS as I } from '../../../../shared/content/status/StatusEffectIds.js';

const ZONE_ACTIVE_SECONDS = 5;
const ZONE_DORMANT_SECONDS = 10;
const ZONE_RADIUS = 122;

export const TEST_EFFECT_ZONE_DEFS = Object.freeze([
  { id: I.ROOT, label: 'Root', x: -1280, y: -980, r: ZONE_RADIUS, color: { r: 108, g: 232, b: 172 }, value: 0 },
  { id: I.STUN, label: 'Stun', x: -640, y: -980, r: ZONE_RADIUS, color: { r: 255, g: 222, b: 98 }, value: 0 },
  { id: I.SILENCE, label: 'Silence', x: 0, y: -980, r: ZONE_RADIUS, color: { r: 184, g: 144, b: 255 }, value: 0 },
  { id: I.DISARM, label: 'Disarm', x: 640, y: -980, r: ZONE_RADIUS, color: { r: 120, g: 182, b: 255 }, value: 0 },
  { id: I.BLIND, label: 'Blind', x: 1280, y: -980, r: ZONE_RADIUS, color: { r: 214, g: 198, b: 126 }, value: 0 },

  { id: I.SLOW, label: 'Slow', x: -1280, y: -420, r: ZONE_RADIUS, color: { r: 116, g: 181, b: 255 }, value: 0.55 },
  { id: I.GROUNDED, label: 'Grounded', x: -640, y: -420, r: ZONE_RADIUS, color: { r: 214, g: 164, b: 95 }, value: 0 },
  { id: I.SUPPRESS, label: 'Suppress', x: 0, y: -420, r: ZONE_RADIUS, color: { r: 154, g: 84, b: 255 }, value: 0 },
  { id: I.SLEEP, label: 'Sleep', x: 640, y: -420, r: ZONE_RADIUS, color: { r: 132, g: 164, b: 255 }, value: 0 },
  { id: I.FEAR, label: 'Fear', x: 1280, y: -420, r: ZONE_RADIUS, color: { r: 222, g: 89, b: 170 }, value: 0 },

  { id: I.CHARM, label: 'Charm', x: -1280, y: 140, r: ZONE_RADIUS, color: { r: 255, g: 110, b: 188 }, value: 0 },
  { id: I.TAUNT, label: 'Taunt', x: -640, y: 140, r: ZONE_RADIUS, color: { r: 255, g: 110, b: 110 }, value: 0 },
  { id: I.BURN, label: 'Burn', x: 0, y: 140, r: ZONE_RADIUS, color: { r: 255, g: 142, b: 72 }, value: 5, periodicDamage: 5, tickEvery: 1 },
  { id: I.POISON, label: 'Poison', x: 640, y: 140, r: ZONE_RADIUS, color: { r: 102, g: 225, b: 120 }, value: 4, periodicDamage: 4, tickEvery: 1 },
  { id: I.BLEED, label: 'Bleed', x: 1280, y: 140, r: ZONE_RADIUS, color: { r: 220, g: 72, b: 84 }, value: 4, periodicDamage: 4, tickEvery: 1 },

  { id: I.ARMOR_SHRED, label: 'Shred', x: -1280, y: 700, r: ZONE_RADIUS, color: { r: 198, g: 118, b: 88 }, value: 0.35 },
  { id: I.DAMAGE_AMP, label: 'Amp', x: -640, y: 700, r: ZONE_RADIUS, color: { r: 255, g: 94, b: 94 }, value: 0.35 },
  { id: I.HEAL_CUT, label: 'Heal Cut', x: 0, y: 700, r: ZONE_RADIUS, color: { r: 255, g: 96, b: 96 }, value: 0.5 },
  { id: I.ANTI_SHIELD, label: 'Anti-Shield', x: 640, y: 700, r: ZONE_RADIUS, color: { r: 255, g: 140, b: 76 }, value: 0.75 },
  { id: I.ARMOR_UP, label: 'Armor Up', x: 1280, y: 700, r: ZONE_RADIUS, color: { r: 120, g: 160, b: 225 }, value: 0.35, hostile: false },

  { id: I.SPELL_SHIELD, label: 'Spell Shield', x: -1280, y: 1260, r: ZONE_RADIUS, color: { r: 124, g: 96, b: 255 }, value: 0, hostile: false },
  { id: I.UNSTOPPABLE, label: 'Unstoppable', x: -640, y: 1260, r: ZONE_RADIUS, color: { r: 255, g: 182, b: 96 }, value: 0, hostile: false },
  { id: I.HASTE, label: 'Haste', x: 0, y: 1260, r: ZONE_RADIUS, color: { r: 96, g: 235, b: 255 }, value: 0.55, hostile: false },
  { id: I.TENACITY, label: 'Tenacity', x: 640, y: 1260, r: ZONE_RADIUS, color: { r: 182, g: 116, b: 255 }, value: 0.45, hostile: false },
  { id: I.SLOW_RESIST, label: 'Slow Resist', x: 1280, y: 1260, r: ZONE_RADIUS, color: { r: 170, g: 112, b: 255 }, value: 0.55, hostile: false },

  { id: I.CAMOUFLAGE, label: 'Camouflage', x: -640, y: 1820, r: ZONE_RADIUS, color: { r: 109, g: 79, b: 255 }, value: 0, hostile: false },
  { id: I.TRUE_SIGHT, label: 'True Sight', x: 0, y: 1820, r: ZONE_RADIUS, color: { r: 120, g: 250, b: 255 }, value: 0, hostile: false },
  { id: I.UNTARGETABLE, label: 'Untargetable', x: 640, y: 1820, r: ZONE_RADIUS, color: { r: 236, g: 236, b: 255 }, value: 0, hostile: false },
  { id: I.INVULNERABLE, label: 'Invulnerable', x: 1280, y: 1820, r: ZONE_RADIUS, color: { r: 255, g: 246, b: 196 }, value: 0, hostile: false }
]);

export function spawnTestEffectZone(state, sx, sy, spec) {
  const id = newEntityId(state);
  const zone = {
    id,
    kind: 'test_effect_zone',
    sx: sx | 0,
    sy: sy | 0,
    x: spec.x,
    y: spec.y,
    radius: spec.r,
    statusId: spec.id,
    label: spec.label,
    color: spec.color,
    value: spec.value ?? 0,
    duration: spec.duration ?? ZONE_ACTIVE_SECONDS,
    hostile: spec.hostile ?? true,
    periodicDamage: spec.periodicDamage ?? 0,
    tickEvery: spec.tickEvery ?? 0,
    durationLeft: ZONE_ACTIVE_SECONDS,
    activeSeconds: ZONE_ACTIVE_SECONDS,
    dormantSeconds: ZONE_DORMANT_SECONDS,
    cooldownLeft: 0,
    phase: 'ready',
    tickEveryVisual: 0,
    slot: 'ZONE',
    frameId: 'test'
  };
  state.testEffectZones.set(id, zone);
  return zone;
}

function spawnTestEffectCore(state, sx, sy, spec) {
  const id = newEntityId(state);
  const color = spec.color ?? { r: 180, g: 200, b: 255 };
  state.asteroids.set(id, {
    kind: 'asteroid',
    id,
    faction: FACTIONS.ASTEROID,
    sx: sx | 0,
    sy: sy | 0,
    x: spec.x,
    y: spec.y,
    radius: 17,
    stats: createStatBlock({ maxHp: 600 }),
    yieldValue: 0,
    resource: 'test_core',
    resourceName: `${spec.label} core`,
    resourceColorHex: null,
    color,
    rot: 0,
    spin: 0.24,
    shapeSeed: 0,
    secret: true,
    respawnAt: 0,
    rarity: 'test_core',
    diedAt: 0,
    killedById: 0,
    dropsSpawned: false,
    testCore: true,
    testStatusId: spec.id
  });
  return id;
}

export function spawnAllTestEffectZones(state, sx, sy) {
  for (const spec of TEST_EFFECT_ZONE_DEFS) {
    const zone = spawnTestEffectZone(state, sx, sy, spec);
    const coreId = spawnTestEffectCore(state, sx, sy, spec);
    zone.coreId = coreId;
  }
}

export function updateTestEffectZones(state, dt, timeMs) {
  if (!state.testEffectZones?.size) return;

  for (const zone of state.testEffectZones.values()) {
    if (zone.cooldownLeft > 0) {
      zone.cooldownLeft = Math.max(0, zone.cooldownLeft - dt);
      zone.phase = 'dormant';
      zone.durationLeft = zone.cooldownLeft;
    } else {
      zone.cooldownLeft = 0;
      zone.phase = 'ready';
      zone.durationLeft = zone.activeSeconds ?? ZONE_ACTIVE_SECONDS;
    }
  }

  for (const player of state.players.values()) {
    if (player.sessionSetupPending || player.dockedStationId) continue;
    for (const zone of state.testEffectZones.values()) {
      if (zone.cooldownLeft > 0) continue;
      if ((player.sx | 0) !== (zone.sx | 0) || (player.sy | 0) !== (zone.sy | 0)) continue;
      const dx = player.x - zone.x;
      const dy = player.y - zone.y;
      if ((dx * dx + dy * dy) > zone.radius * zone.radius) continue;
      applyStatus(player, zone.statusId, zone.duration, {
        value: zone.value,
        hostile: zone.hostile,
        periodicDamage: zone.periodicDamage,
        tickEvery: zone.tickEvery,
        label: '',
        sourceId: 0,
        meta: { sourceX: zone.x, sourceY: zone.y, sourceKind: 'asteroid', sourceTargetId: zone.coreId || 0 },
        timeMs
      });
      zone.cooldownLeft = zone.dormantSeconds ?? ZONE_DORMANT_SECONDS;
      zone.phase = 'dormant';
      zone.durationLeft = zone.cooldownLeft;
      break;
    }
  }
}
