import { SHIP_FRAME_ORDER } from '../../../../shared/content/frames/ShipFrameIds.js';
import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';

const FRAME_META = Object.freeze({
  vanguard: {
    accent: '#d7b46c',
    roleLabel: 'Dueliste mobile',
    difficultyLabel: 'Intermédiaire',
    tagline: 'Mobilité, pression continue, tirs renforcés.',
    summary: 'Un vaisseau nerveux qui garde le tempo : poke en ligne, dash court, invulnérabilité brève et ultimate de duel.',
    passive: { key: 'P', label: 'Réacteur de combat', name: 'Réacteur de combat', text: 'Les attaques et compétences entretiennent des charges de cadence. Plus tu restes actif, plus le vaisseau accélère.' },
    abilityText: {
      A: 'Tir linéaire rapide. Les phases ajoutent de la perforation et des bonus contre les cibles contrôlées.',
      Z: 'Dash vers l’avant qui n’annule pas le déplacement. Laisse une fenêtre de combo et peut nettoyer les ralentissements.',
      E: 'Phase courte : réduction de dégâts, esquive technique et sortie qui punit les ennemis proches.',
      R: 'Mode frénésie : vitesse, cadence et tirs renforcés pendant quelques secondes.'
    }
  },
  sigil: {
    accent: '#a977ff',
    roleLabel: 'Battlemage de contrôle',
    difficultyLabel: 'Élevée',
    tagline: 'Runes, zones, entrave et exécution graduelle.',
    summary: 'Un vaisseau de contrôle : il trace des zones, force les trajectoires, accumule des runes et transforme l’espace en piège.',
    passive: { key: 'P', label: 'Runes instables', name: 'Runes instables', text: 'Les sorts posent des runes. À haut niveau, elles amplifient les dégâts et déclenchent des effets de contrôle.' },
    abilityText: {
      A: 'Trait traversant longue portée. Excellent pour punir une ligne de fuite ou déclencher les runes.',
      Z: 'Zone de contrôle : dégâts périodiques et ralentissement dans une zone persistante.',
      E: 'Repositionnement furtif court, utile pour casser l’angle et laisser une traînée de contrôle.',
      R: 'Rituel temporaire qui prolonge les runes et accélère le cycle offensif.'
    }
  },
  bulwark: {
    accent: '#ffc866',
    roleLabel: 'Anti-burst de duel',
    difficultyLabel: 'Faible',
    tagline: 'Armure, harpon, ancrage et siphon défensif.',
    summary: 'Un vaisseau lourd : il prend l’espace lentement, encaisse les bursts, force l’ennemi à rester proche et gagne les duels longs.',
    passive: { key: 'P', label: 'Plaques de blindage', name: 'Plaques de blindage', text: 'Encaisser ou rester au contact génère des plaques. Elles renforcent l’armure et transforment la défense en pression.' },
    abilityText: {
      A: 'Posture blindée : réduction de dégâts, armure et retour de dégâts autour du vaisseau.',
      Z: 'Harpon linéaire qui force le duel et applique des contrôles selon la phase.',
      E: 'Canalisation défensive : soin, bouclier et résistance pendant une fenêtre vulnérable mais rentable.',
      R: 'Tempête de siphon : grande zone qui ralentit, attire et convertit la survie en avantage.'
    }
  }
});

const STAT_LABELS = Object.freeze([
  ['maxHp', 'Coque'],
  ['maxShield', 'Bouclier'],
  ['maxEnergy', 'Énergie'],
  ['engine', 'Vitesse'],
  ['baseArmor', 'Armure']
]);

function buildStatScale() {
  const defs = SHIP_FRAME_ORDER.map((id) => getShipFrameDef(id));
  const scale = new Map();
  for (const [key] of STAT_LABELS) {
    const values = defs.map((def) => Number(def?.stats?.[key] ?? 0));
    scale.set(key, { min: Math.min(...values), max: Math.max(...values) });
  }
  return scale;
}

const STAT_SCALE = buildStatScale();

function normalizeStat(key, value) {
  const scale = STAT_SCALE.get(key);
  if (!scale || scale.max <= scale.min) return 0.5;
  return (value - scale.min) / (scale.max - scale.min);
}

function buildAbilityList(def, meta) {
  const entries = Object.values(def.abilities || {}).map((entry) => ({
    key: entry.key,
    label: entry.label,
    name: entry.label,
    text: meta.abilityText?.[entry.key] || entry.label
  }));
  if (meta.passive) entries.push(meta.passive);
  return entries;
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
      abilities: buildAbilityList(def, meta),
      stats: STAT_LABELS.map(([key, label]) => ({
        key,
        label,
        value: Number(def?.stats?.[key] ?? 0),
        fill01: normalizeStat(key, Number(def?.stats?.[key] ?? 0))
      }))
    };
  });
}
