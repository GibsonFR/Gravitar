import { SHIP_FRAME_ORDER } from '../../../../shared/content/frames/ShipFrameIds.js';
import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';

const FRAME_META = Object.freeze({
  vanguard: {
    accent: '#d7b46c',
    roleLabel: 'Polyvalent',
    difficultyLabel: 'Intermédiaire',
    tagline: 'Cadence, mobilité et pression continue.',
    summary: 'Frame offensif polyvalent, centré sur la montée en régime et le maintien du tempo.'
  },
  sigil: {
    accent: '#7dcbff',
    roleLabel: 'Contrôle',
    difficultyLabel: 'Élevée',
    tagline: 'Runes, fermeture d’espace et angles de punition.',
    summary: 'Frame de contrôle qui verrouille les déplacements, accumule des runes puis punit sur la fermeture.'
  },
  bulwark: {
    accent: '#87d49a',
    roleLabel: 'Frontline',
    difficultyLabel: 'Faible',
    tagline: 'Ancrage, plaques et présence de première ligne.',
    summary: 'Frame défensif lourd, taillé pour encaisser, ralentir l’engagement adverse et tenir la zone.'
  }
});

const STAT_LABELS = Object.freeze([
  ['maxHp', 'Coque'],
  ['maxShield', 'Bouclier'],
  ['maxEnergy', 'Énergie'],
  ['engine', 'Moteur'],
  ['baseArmor', 'Armure']
]);

function buildStatScale() {
  const defs = SHIP_FRAME_ORDER.map((id) => getShipFrameDef(id));
  const scale = new Map();
  for (const [key] of STAT_LABELS) {
    const values = defs.map((def) => Number(def?.stats?.[key] ?? 0));
    scale.set(key, {
      min: Math.min(...values),
      max: Math.max(...values)
    });
  }
  return scale;
}

const STAT_SCALE = buildStatScale();

function normalizeStat(key, value) {
  const scale = STAT_SCALE.get(key);
  if (!scale || scale.max <= scale.min) return 0.5;
  return (value - scale.min) / (scale.max - scale.min);
}

export function getSessionFrameCards() {
  return SHIP_FRAME_ORDER.map((frameId) => {
    const def = getShipFrameDef(frameId);
    const meta = FRAME_META[frameId] || {};
    return {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      role: meta.roleLabel || def.role,
      difficulty: meta.difficultyLabel || def.difficulty,
      accent: meta.accent || '#7de9ff',
      tagline: meta.tagline || '',
      summary: meta.summary || '',
      abilities: Object.values(def.abilities || {}).map((entry) => ({
        key: entry.key,
        label: entry.label
      })),
      stats: STAT_LABELS.map(([key, label]) => ({
        key,
        label,
        value: Number(def?.stats?.[key] ?? 0),
        fill01: normalizeStat(key, Number(def?.stats?.[key] ?? 0))
      }))
    };
  });
}
