import { SHIP_FRAME_ORDER } from '../../../../shared/content/frames/ShipFrameIds.js';
import { getShipFrameDef } from '../../../../shared/content/frames/ShipFrameRegistry.js';
import { getVanguardAbilityTuning } from '../../../../shared/content/frames/vanguard/VanguardFrameSpec.js';
import { getSigilAbilityTuning } from '../../../../shared/content/frames/sigil/SigilFrameSpec.js';
import { getBulwarkAbilityTuning } from '../../../../shared/content/frames/bulwark/BulwarkFrameSpec.js';

const FRAME_META = Object.freeze({
  vanguard: { accent: '#7de9ff' },
  sigil: { accent: '#a977ff' },
  bulwark: { accent: '#ffc866' }
});

const STAT_LABELS = Object.freeze([
  ['maxHp', 'Coque'],
  ['maxShield', 'Bouclier'],
  ['maxEnergy', 'Énergie'],
  ['engine', 'Vitesse'],
  ['baseArmor', 'Armure']
]);

const PHASE_TO_LEVEL = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 });

function fmt(v, digits = 1) {
  if (!Number.isFinite(v)) return '0';
  return v >= 10 ? v.toFixed(0) : v.toFixed(digits);
}

function pct(v, digits = 0) {
  return `${((v ?? 0) * 100).toFixed(digits)}%`;
}

function levelFor(slot, phase) {
  if (slot === 'R') return Math.max(1, Math.min(5, phase | 0));
  return PHASE_TO_LEVEL[Math.max(1, Math.min(5, phase | 0))] || 1;
}

function getTuning(frameId, slot, phase) {
  const level = levelFor(slot, phase);
  if (frameId === 'sigil') return getSigilAbilityTuning(slot, level);
  if (frameId === 'bulwark') return getBulwarkAbilityTuning(slot, level, 0);
  return getVanguardAbilityTuning(slot, level, 0);
}

function vanguardLines(slot, phase) {
  const t = getTuning('vanguard', slot, phase);
  if (slot === 'A') return [
    `Tir linéaire : ${fmt(t.damageFlat)} + ${pct(t.damagePct, 0)} des dégâts d’arme.`,
    `Portée ${fmt(t.projectileRange, 0)}, largeur ${fmt(t.projectileWidth, 0)}.`,
    `Charge ${t.empowerCharges ?? 0} auto renforcée(s), cap selon phase.`,
    t.pierceCount > 0 ? 'Traverse une cible supplémentaire.' : '',
    t.damageAmpPct > 0 ? `Applique Vulnérabilité ${pct(t.damageAmpPct)} pendant ${fmt(t.damageAmpDuration)} s.` : '',
    t.disarmDuration > 0 ? `Sur cible déjà vulnérable : Désarmement ${fmt(t.disarmDuration)} s.` : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === 'Z') return [
    `Ruée de ${fmt(t.dashDistance, 0)} puis +${pct(t.moveBoostPct)} vitesse pendant ${fmt(t.moveBoostDuration)} s.`,
    t.trailSlowPct > 0 ? `Traînée : Ralentissement ${pct(t.trailSlowPct)} pendant ${fmt(t.trailSlowDuration)} s.` : '',
    t.comboWindowDuration > 0 ? `Fenêtre combo : prochain A +${pct(t.comboProjectileSpeedPct)} vitesse projectile et +${pct(t.comboDamagePct)} dégâts.` : '',
    t.cleanseSlowAndRoot ? 'Purge ralentissement et root à l’activation.' : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === 'E') return [
    `Phase : ${pct(t.damageReductionPct)} réduction de dégâts pendant ${fmt(t.phaseDuration)} s.`,
    t.spellShieldDuration > 0 ? `À la sortie : bouclier anti-sort ${fmt(t.spellShieldDuration)} s.` : '',
    t.exitRadius > 0 ? `Onde de sortie : Grounded ${fmt(t.groundedDuration)} s dans ${fmt(t.exitRadius, 0)}.` : '',
    t.exitShieldPctMaxShield > 0 ? `Rend ${pct(t.exitShieldPctMaxShield)} du bouclier max.` : '',
    t.restoreAChargeOnMaxHeat ? 'Si lancé à 10 Surchauffe : rend 1 charge de A à la fin.' : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  return [
    `Frénésie ${fmt(t.ultDuration)} s : +${pct(t.ultAttackSpeedPct)} cadence, +${pct(t.ultMoveSpeedPct)} vitesse.`,
    `Autos : +${pct(t.ultEmpowerPct)} dégâts pendant R.`,
    t.ultBurnDuration > 0 ? `Auto sur cible marquée par A : Brûlure ${fmt(t.ultBurnDuration)} s.` : '',
    t.unstoppableDuration > 0 ? `Z pendant R : Inarrêtable ${fmt(t.unstoppableDuration)} s.` : '',
    t.ultCloseAStunDuration > 0 ? `A proche pendant R : Étourdissement ${fmt(t.ultCloseAStunDuration)} s.` : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
}

function sigilLines(slot, phase) {
  const t = getTuning('sigil', slot, phase);
  if (slot === 'A') return [
    `Projectile runique : ${fmt(t.aImpactDamageFlat)} + ${pct(t.aImpactDamagePct)} dégâts d’arme.`,
    'Pose 1 rune. Les runes amplifient les prochaines touches.',
    t.aPierceCount > 0 ? 'Phase 2 : traverse largement les cibles.' : '',
    t.aRevealThreshold > 0 ? `À ${t.aRevealThreshold} runes : révèle la cible.` : '',
    t.aHealCutThreshold > 0 ? `À ${t.aHealCutThreshold} runes : anti-soin ${pct(t.aHealCutPct)}.` : '',
    t.aDetonationStasisDuration > 0 ? 'Détonation maximale : stase courte.' : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === 'Z') return [
    `Zone ${fmt(t.zZoneRadius, 0)} pendant ${fmt(t.zZoneDuration)} s.`,
    `Dégâts/s : ${fmt(t.zZoneDamageFlatPerSecond)} + ${pct(t.zZoneDamageWeaponPctPerSecond)} arme.`,
    `Ralentit de ${pct(t.zZoneSlowPct)}.`,
    t.zRunePulseStacks > 0 ? 'Pulse : ajoute des runes aux ennemis dans la zone.' : '',
    t.zCanRecastClose ? 'Réactivation : ferme la zone et contrôle les cibles runées.' : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === 'E') return [
    `Dash de ${fmt(t.eDashDistance, 0)} et camouflage ${fmt(t.eCamouflageDuration)} s.`,
    t.eTrailSlowPct > 0 ? `Traînée : slow ${pct(t.eTrailSlowPct)} pendant ${fmt(t.eTrailSlowDuration)} s.` : '',
    t.aEmpowerFromVeilDamagePct > 0 ? `A lancé depuis le voile : +${pct(t.aEmpowerFromVeilDamagePct)} dégâts.` : '',
    t.eSpellShieldOnEndDuration > 0 ? `Fin du voile : bouclier anti-sort ${fmt(t.eSpellShieldOnEndDuration)} s.` : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  return [
    `Convergence ${fmt(t.ultDuration)} s.`,
    `Runes durent +${pct(t.ultRuneDurationBonusPct)}.`,
    `Cooldown de A multiplié par x${fmt(t.ultACooldownMultiplier, 2)}.`,
    `Vol de vie : ${pct(t.ultLifestealPct, 1)}.`,
    t.ultDetonationStunDuration > 0 ? `Détonation max : stun ${fmt(t.ultDetonationStunDuration)} s.` : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
}

function bulwarkLines(slot, phase) {
  const t = getTuning('bulwark', slot, phase);
  if (slot === 'A') return [
    `Ancrage ${fmt(t.anchorDuration)} s : armure +${fmt(t.anchorArmorFlat)}.`,
    `Réduction ${pct(t.anchorDamageReductionPct)} et reflet ${pct(t.anchorReflectPct)}.`,
    t.anchorPulseRadius > 0 ? `Pulse slow ${pct(t.anchorPulseSlowPct)} dans ${fmt(t.anchorPulseRadius, 0)}.` : '',
    t.anchorTauntedBonusFlat > 0 ? 'Bonus de dégâts contre les cibles provoquées.' : '',
    t.anchorSingleHitCapPctMaxHp > 0 ? `Cap de gros hit : ${pct(t.anchorSingleHitCapPctMaxHp)} PV max.` : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === 'Z') return [
    `Harpon ${fmt(t.harpoonRange, 0)} : ${fmt(t.harpoonDamageFlat)} + ${pct(t.harpoonDamageWeaponPct)} arme + armure.`,
    `Provoque ${fmt(t.harpoonTauntDuration)} s.`,
    t.harpoonArmorShredPct > 0 ? `Shred armure ${pct(t.harpoonArmorShredPct)} pendant ${fmt(t.harpoonArmorShredDuration)} s.` : '',
    t.harpoonGroundedDuration > 0 ? `Grounded ${fmt(t.harpoonGroundedDuration)} s.` : '',
    t.harpoonDashDistance > 0 ? 'Dash vers la cible touchée.' : '',
    t.harpoonPullStrength > 0 ? 'Tire la cible vers toi.' : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  if (slot === 'E') return [
    `Méditation ${fmt(t.meditationDuration)} s : réduction ${pct(t.meditationDamageReductionPct)}.`,
    'Soigne les PV manquants et donne un bouclier à la fin.',
    t.meditationCastUnstoppableDuration > 0 ? `Début : Inarrêtable ${fmt(t.meditationCastUnstoppableDuration)} s.` : '',
    t.meditationPulseRadius > 0 ? `Fin : slow dans ${fmt(t.meditationPulseRadius, 0)}.` : '',
    t.meditationCleanseSilenceDisarmRoot ? 'Purge silence, désarmement et root.' : '',
    t.meditationFinalGroundedDuration > 0 ? `Fin : Grounded ${fmt(t.meditationFinalGroundedDuration)} s.` : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
  return [
    `Tempête ${fmt(t.stormDuration)} s, rayon ${fmt(t.stormRadius, 0)}.`,
    `Dégâts/s : ${fmt(t.stormBaseDpsFlat)} + ${pct(t.stormBaseDpsPct)} arme.`,
    `Ralentit de ${pct(t.stormSlowPct)}.`,
    t.stormTauntedDamageAmpPct > 0 ? `Cibles provoquées : +${pct(t.stormTauntedDamageAmpPct)} dégâts subis.` : '',
    t.stormExposureStunThreshold > 0 ? `Exposition prolongée : stun ${fmt(t.stormExposureStunDuration)} s.` : '',
    t.stormPullStrength > 0 ? 'La tempête attire périodiquement les ennemis.' : '',
    `Coût ${fmt(t.energyCost, 0)} énergie — Recast ${fmt(t.baseCooldown ?? 0)} s.`
  ];
}

function passiveEntry(frameId) {
  if (frameId === 'sigil') return {
    key: 'P', label: 'Runes', name: 'Passif — Runes', lines: [
      'Les tirs et sorts posent des runes sur les cibles.',
      '3 runes : ralentissement. 5 runes : détonation automatique.'
    ]
  };
  if (frameId === 'bulwark') return {
    key: 'P', label: 'Plaques réactives', name: 'Passif — Plaques réactives', lines: [
      'Les gros dégâts reçus génèrent des plaques temporaires.',
      'Chaque plaque donne armure, réduction de dégâts et ténacité.',
      'À pleine charge : bouclier et attaques renforcées par l’armure.'
    ]
  };
  return {
    key: 'P', label: 'Surchauffe', name: 'Passif — Surchauffe', lines: [
      'Les attaques et compétences qui touchent donnent 1 charge pendant 5 s.',
      'Par charge : cadence, vitesse moteur et résistance aux ralentissements.',
      'À 6 charges : ténacité. À 10 charges : Z/E déclenche la ténacité de surchauffe.'
    ]
  };
}

function abilityLines(frameId, slot, phase) {
  if (slot === 'P') return passiveEntry(frameId).lines;
  if (frameId === 'sigil') return sigilLines(slot, phase).filter(Boolean);
  if (frameId === 'bulwark') return bulwarkLines(slot, phase).filter(Boolean);
  return vanguardLines(slot, phase).filter(Boolean);
}

const GUIDE = Object.freeze({
  vanguard: [
    'À retenir : Surchauffe monte quand les attaques et compétences touchent. Les charges durent 5 s.',
    'Combo simple : Z puis A pendant la fenêtre combo. Phase 3 de Z ajoute vitesse projectile et dégâts au prochain A.',
    'À 10 Surchauffe, Z/E déclenche la ténacité de surchauffe. E peut aussi rendre une charge de A en phase 5.',
    'Stuff recherché : cadence, dégâts d’arme, mobilité, énergie/recast si tu veux enchaîner Z + A plus souvent.'
  ],
  sigil: [
    'À retenir : les tirs et sorts posent des runes. 3 runes ralentissent, 5 runes déclenchent une détonation.',
    'Combo simple : Z pour forcer la zone, A pour ajouter les runes, puis R pour prolonger les runes et réduire le cycle de A.',
    'E sert au repositionnement : dash + camouflage, puis A depuis le voile gagne des dégâts à partir de la phase 3.',
    'Stuff recherché : énergie, recast, dégâts d’arme, effets qui aident à maintenir les cibles dans les zones.'
  ],
  bulwark: [
    'À retenir : les gros dégâts reçus donnent des plaques. Chaque plaque donne armure, réduction de dégâts et ténacité.',
    'Combo simple : Z pour provoquer, A pour ancrer et réduire les dégâts, R quand la cible reste au contact.',
    'E est défensif : réduction pendant la canalisation, soin des PV manquants et bouclier à la fin.',
    'Stuff recherché : armure, PV, bouclier, réduction de dégâts, puis dégâts d’arme si tu veux convertir l’armure en menace.'
  ]
});

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

function buildAbilityList(def) {
  const entries = Object.values(def.abilities || {}).map((entry) => ({
    key: entry.key,
    label: entry.label,
    name: entry.label,
    getLines: (phase) => abilityLines(def.id, entry.key, phase)
  }));
  const passive = passiveEntry(def.id);
  entries.push({ ...passive, getLines: () => passive.lines });
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
      role: def.role,
      difficulty: def.difficulty,
      accent: meta.accent || '#7de9ff',
      tagline: '',
      summary: '',
      guide: GUIDE[def.id] || [],
      abilities: buildAbilityList(def),
      stats: STAT_LABELS.map(([key, label]) => ({
        key,
        label,
        value: Number(def?.stats?.[key] ?? 0),
        fill01: normalizeStat(key, Number(def?.stats?.[key] ?? 0))
      }))
    };
  });
}
