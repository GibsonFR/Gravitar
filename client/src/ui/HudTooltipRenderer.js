import { rgba } from '../core/Math.js';
import { fillRoundedRect } from './hud/HudChrome.js';
import { getCombatHudLayout } from './hud/HudLayout.js';
import { buildHudBuffRows } from './StatusHudRenderer.js';
import { hitTestCombatStat, buildCombatStatEntries } from './hud/HudVitalsPanelRenderer.js';
import { getShipFrameDef } from '../../../shared/content/frames/ShipFrameRegistry.js';
import { getEquippedHudHit, getEquippedHudTagHit, buildEquipmentTooltip } from './hud/HudEquipmentPanelRenderer.js';

function inside(r, x, y) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function fmt(v, digits = 1) {
  if (!Number.isFinite(v)) return '0';
  return v >= 10 ? v.toFixed(0) : v.toFixed(digits);
}
function pct(v, digits = 0) { return `${((v ?? 0) * 100).toFixed(digits)}%`; }
function castLine(t) { return (t?.castTime ?? 0) > 0 ? `Temps d’incantation : ${fmt(t.castTime, 2)} s.` : ''; }
function seconds(v) { return `${fmt(v, 2)} s`; }
function rangeLine(label, v) { return Number.isFinite(v) && v > 0 ? `${label} : ${fmt(v, 0)}.` : ''; }
function phaseLine(n, text, activePhase = 0) { return `${activePhase >= n ? '✓' : '○'} Palier ${n} : ${text}`; }
function scalingLine(text) { return `Évolution : ${text}`; }
function passiveHeader(text) { return `Base : ${text}`; }

function buildPassiveTooltip(myState, me) {
  const fs = myState?.frameState ?? {};
  const frameId = me?.frameId || myState?.frameId || 'vanguard';
  if (frameId === 'vanguard') {
    return {
      title: 'Passif — Surchauffe',
      accent: { r: 223, g: 179, b: 94 },
      lines: [
        passiveHeader('chaque attaque automatique ou compétence qui touche donne 1 charge pendant 5 s, jusqu’à 10.'),
        `État actuel : ${fs.passiveStacks ?? 0}/${fs.passiveMaxStacks ?? 10} charge(s).`,
        'Par charge : +4% cadence d’attaque, +1.5% vitesse moteur, +1.5% résistance aux ralentissements.',
        'À partir de 6 charges : +20% ténacité.',
        'À 10 charges : la prochaine activation de Z ou E donne aussi +35% ténacité pendant 0.85 s.',
        'Après 5 s sans toucher : perd 1 charge toutes les 0.20 s.',
        fs.passiveDecaying ? 'Décroissance active.' : `Décroissance dans ${fmt(fs.passiveDecayLeft ?? 0)} s.`
      ]
    };
  }
  if (frameId === 'sigil') {
    return {
      title: 'Passif — Runes de contrainte',
      accent: { r: 198, g: 128, b: 255 },
      lines: [
        passiveHeader('attaques automatiques et compétences donnent 1 Rune pendant 7 s, jusqu’à 5.'),
        'Chaque Rune déjà présente ajoute 2 + 8% des dégâts d’attaque automatique aux autos et compétences.',
        'À 3 Runes : la cible subit Ralentissement 12%.',
        'À 5 Runes : la prochaine compétence détonante consomme les Runes.',
        'Détonation : 18 + 45% des dégâts d’attaque automatique + 6% de l’énergie maximale actuelle.',
        'Une même cible ne peut subir la détonation qu’une fois toutes les 1.2 s.',
        `Délai de détonation actuel : ${fmt(fs.detonationCooldownLeft ?? 0)} s.`
      ]
    };
  }
  return {
    title: 'Passif — Carapace de siège',
    accent: { r: 236, g: 196, b: 96 },
    lines: [
      passiveHeader('subir un contrôle ou un burst de 7% de coque max en 0.75 s donne 1 Plaque.'),
      `Plaques : ${fs.passiveStacks ?? 0}/${fs.passiveMaxStacks ?? 5}. ICD : 0.45 s. Durée : 7 s.`,
      'Par Plaque : +4 armure, +2% réduction de dégâts, +4% ténacité.',
      'Permanent : dégâts bonus d’auto = 18% de l’armure totale ; impact bonus = 8% de l’armure totale.',
      'À 5 Plaques : la prochaine compétence consomme les Plaques et donne un bouclier 4 s.',
      'Bouclier : 10% coque max + 35% armure totale.',
      'Pendant 4 s : conversions renforcées à 24% et 12% de l’armure totale.'
    ]
  };
}

function vanguardAbility(slot, s) {
  const t = s.tuning ?? {};
  const phase = s.phase ?? t.phase ?? 0;
  if (slot === 'A') return [
    'Type : projectile linéaire rapide.',
    castLine(t),
    `Portée ${fmt(t.projectileRange, 0)}, largeur ${fmt(t.projectileWidth, 1)}, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Dégâts : ${fmt(t.damageFlat, 1)} + ${pct(t.damagePct, 1)} des dégâts de l’attaque automatique actuelle.`,
    scalingLine('+2 dégâts de base, +2% coefficient AA, +0.30 largeur tous les 2 niveaux, -0.05 s CD tous les 3 niveaux jusqu’à 3.4 s.'),
    `Auto renforcée : ${fmt(t.empowerFlat, 1)} + ${pct(t.empowerPct, 1)} des dégâts AA. Charges générées : ${t.empowerCharges ?? phase}.`,
    phaseLine(1, 'touche la première cible et charge 1 auto renforcée.', phase),
    phaseLine(2, 'traverse 1 cible supplémentaire.', phase),
    phaseLine(3, 'applique Vulnérabilité aux dégâts 8% pendant 2.0 s.', phase),
    phaseLine(4, 'si la cible est déjà ralentie ou clouée au sol, rend 8 énergie.', phase),
    phaseLine(5, 'si la cible est déjà vulnérable, applique Désarmement 0.55 s.', phase)
  ];
  if (slot === 'Z') return [
    'Type : ruée courte suivie d’une accélération.',
    `Distance ${fmt(t.dashDistance, 0)}, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Effet : +${pct(t.moveBoostPct, 1)} vitesse moteur pendant ${fmt(t.moveBoostDuration, 2)} s.`,
    scalingLine('+0.6% vitesse, +4 distance, +0.03 s durée par niveau ; -0.15 s CD aux niveaux 2/5/8/11/14/17/20/23/26/29.'),
    phaseLine(1, 'ruée simple et accélération.', phase),
    phaseLine(2, 'laisse une traînée 1.2 s qui applique Ralentissement 18% pendant 1.2 s.', phase),
    phaseLine(3, 'le prochain A dans 1.5 s gagne +20% vitesse projectile et +12% dégâts.', phase),
    phaseLine(4, 'purge ralentissements et enracinements à l’activation.', phase),
    phaseLine(5, 'si A touche pendant la fenêtre, réduit le CD restant de Z de 35%.', phase)
  ];
  if (slot === 'E') return [
    'Type : défense active.',
    castLine(t),
    `Durée ${fmt(t.phaseDuration, 2)} s, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Effet : réduit les dégâts subis de ${pct(t.damageReductionPct, 1)} pendant la phase.`,
    scalingLine('+0.02 s durée par niveau jusqu’à 0.85 s au niveau 21 puis +0.01 s ; +0.6% réduction tous les 2 niveaux ; -0.12 s CD tous les 3 niveaux jusqu’à 13.5 s.'),
    phaseLine(1, 'défense active simple.', phase),
    phaseLine(2, 'une fois la phase écoulée, donne Bouclier anti-sort 0.45 s.', phase),
    phaseLine(3, 'une fois la phase écoulée, onde rayon 90 qui applique Cloué au sol 0.8 s.', phase),
    phaseLine(4, 'une fois la phase écoulée, bouclier = 10% du bouclier max +0.4% par niveau après 12.', phase),
    phaseLine(5, 'si lancé sous 10 charges de Surchauffe, rend 1 charge de A.', phase)
  ];
  return [
    'Type : mode offensif.',
    `Durée ${fmt(t.ultDuration, 2)} s, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Effet : +${pct(t.ultAttackSpeedPct, 1)} cadence, +${pct(t.ultMoveSpeedPct, 1)} vitesse, +${pct(t.ultEmpowerPct, 1)} dégâts infligés.`,
    `Éliminations : prolongent de ${fmt(t.extensionDuration, 2)} s, jusqu’à ${fmt(t.extensionMaxBonusDuration, 2)} s gagnées.`,
    scalingLine('+0.8% cadence, +0.5% vitesse, +0.45% dégâts par niveau ; -0.5 s CD tous les 2 niveaux jusqu’à 58 s.'),
    phaseLine(1, 'mode offensif simple.', phase),
    phaseLine(2, 'autos sur cible déjà touchée par A appliquent Brûlure 1.8 s : 10 + 25% dégâts AA.', phase),
    phaseLine(3, 'Z pendant R donne Inarrêtable 0.35 s.', phase),
    phaseLine(4, 'autos sur cible à moins de 160 rendent 3 énergie.', phase),
    phaseLine(5, 'si A touche une cible à moins de 200 pendant R, Étourdissement 0.45 s.', phase)
  ];
}

function sigilAbility(slot, s) {
  const t = s.tuning ?? {};
  const phase = s.phase ?? t.phase ?? 0;
  if (slot === 'A') return [
    'Type : trait linéaire traversant.',
    castLine(t),
    `Portée ${fmt(t.aProjectileRange, 0)}, largeur ${fmt(t.aProjectileWidth, 1)}, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Dégâts : ${fmt(t.aImpactDamageFlat, 1)} + ${pct(t.aImpactDamagePct, 1)} des dégâts de l’attaque automatique actuelle.`,
    scalingLine('+2.4 dégâts, +1.8% coefficient AA, +0.4 largeur tous les 2 niveaux ; -0.07 s CD par niveau jusqu’à 3.7 s.'),
    'Synergie passive : applique 1 Rune, applique le bonus des Runes déjà présentes, puis peut déclencher la détonation à 5 Runes.',
    phaseLine(1, 'applique 1 Rune à chaque cible touchée.', phase),
    phaseLine(2, 'traverse toutes les cibles jusqu’à la portée maximale.', phase),
    phaseLine(3, 'si la cible avait déjà 3 Runes ou plus avant l’impact, Révélation 1.6 s.', phase),
    phaseLine(4, 'la première cible ayant déjà 5 Runes subit Réduction de soins 30% pendant 2.5 s.', phase),
    phaseLine(5, 'la première détonation de 5 Runes applique Stase 0.40 s.', phase)
  ];
  if (slot === 'Z') return [
    'Type : zone posée à distance.',
    `Portée de pose ${fmt(t.zCastRange, 0)}, rayon ${fmt(t.zZoneRadius, 1)}, durée ${fmt(t.zZoneDuration, 2)} s.`,
    `Coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Dégâts/s : ${fmt(t.zZoneDamageFlatPerSecond, 1)} + ${pct(t.zZoneDamageWeaponPctPerSecond, 1)} des dégâts AA par seconde.`,
    scalingLine('+1.4 dégâts/s, +1.6% coefficient AA/s, +2.5 rayon, +0.08 s durée par niveau ; -0.08 s CD jusqu’à 13.6 s.'),
    'Synergie passive : les ticks peuvent appliquer Rune, bonus par Rune déjà présente, et détonation à 5 Runes.',
    phaseLine(1, 'la zone applique Ralentissement 22%.', phase),
    phaseLine(2, 'chaque seconde passée dans la zone donne 1 Rune supplémentaire.', phase),
    phaseLine(3, 'peut être réactivée une fois pour fermer le sceau avant la fin.', phase),
    phaseLine(4, 'à la fermeture, attire les cibles présentes de 120 vers le centre.', phase),
    phaseLine(5, 'à la fermeture, les cibles ayant 3 Runes ou plus subissent Suppression 0.7 s.', phase)
  ];
  if (slot === 'E') return [
    'Type : déplacement bref et défense technique.',
    `Dash ${fmt(t.eDashDistance, 0)}, voile ${fmt(t.eTrailDuration, 2)} s, camouflage ${fmt(t.eCamouflageDuration, 2)} s.`,
    `Coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    scalingLine('+5 distance, +0.03 s camouflage, +0.03 s traînée par niveau ; -0.10 s CD jusqu’à 15.1 s.'),
    'Synergie passive : la traînée touche, applique Rune, applique bonus par Rune déjà présente, et peut détoner à 5 Runes.',
    phaseLine(1, 'déplacement simple et camouflage bref.', phase),
    phaseLine(2, 'la traînée applique Ralentissement 18%.', phase),
    phaseLine(3, 'le premier A lancé pendant le camouflage inflige +14% dégâts.', phase),
    phaseLine(4, 'une fois le voile écoulé, Bouclier anti-sort 0.40 s.', phase),
    phaseLine(5, 'si la traînée touche une cible qui avait déjà 5 Runes, Cloué au sol 0.8 s.', phase)
  ];
  return [
    'Type : mode de domination de zone.',
    `Durée ${fmt(t.ultDuration, 2)} s, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Effet : Runes durent +${pct(t.ultRuneDurationBonusPct, 1)}, CD de A ×${fmt(t.ultACooldownMultiplier, 3)}, vol de sort ${pct(t.ultLifestealPct, 2)}.`,
    scalingLine('+0.9% durée des Runes, -0.008 coefficient CD de A tous les 2 niveaux, +0.55% vol de sort par niveau ; -0.45 s CD jusqu’à 57 s.'),
    phaseLine(1, 'mode de burst de Runes.', phase),
    phaseLine(2, 'toutes les cibles touchées par A sont révélées pendant 2 s.', phase),
    phaseLine(3, 'les cibles à 4 Runes ou plus subissent Réduction de soins 30%.', phase),
    phaseLine(4, 'si Z est lancé pendant R, Sigil gagne Camouflage 0.45 s à la fermeture ou fin de zone.', phase),
    phaseLine(5, 'la première détonation de 5 Runes de chaque activation donne Étourdissement 0.35 s.', phase)
  ];
}

function bulwarkAbility(slot, s) {
  const t = s.tuning ?? {};
  const phase = s.phase ?? t.phase ?? 0;
  if (slot === 'A') return [
    'Type : posture défensive.',
    `Durée ${fmt(t.anchorDuration, 2)} s, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Effet : -${pct(t.anchorSelfSlowPct, 1)} vitesse, +${fmt(t.anchorArmorFlat, 1)} armure, ${pct(t.anchorDamageReductionPct, 1)} réduction de dégâts.`,
    `Réflexion : ${pct(t.anchorReflectPct, 1)} des dégâts reçus après mitigation, min ${fmt(t.anchorReflectMinDamage, 1)}, max ${fmt(t.anchorReflectMaxDamage, 1)}.`,
    scalingLine('+0.50 armure, +0.30% réduction, -0.15% ralentissement, +0.035 s durée par niveau ; -0.14 s CD jusqu’à 11.9 s.'),
    'Pendant A : les coefficients de conversion du passif sont augmentés de 50%.',
    phaseLine(1, 'posture défensive simple.', phase),
    phaseLine(2, 'les dégâts absorbés uniquement par le bouclier déclenchent aussi la réflexion.', phase),
    phaseLine(3, 'à l’activation puis à la fin, onde rayon 150 qui ralentit 25% pendant 1 s.', phase),
    phaseLine(4, 'autos contre cible sous Provocation : 6 + 8% armure totale en dégâts bonus, +0.55 plat/niveau.', phase),
    phaseLine(5, 'pendant la durée, aucun hit unique ne peut retirer plus de 20% de la coque max.', phase)
  ];
  if (slot === 'Z') return [
    'Type : projectile linéaire de Provocation.',
    castLine(t),
    `Portée ${fmt(t.harpoonRange, 0)}, largeur ${fmt(t.harpoonWidth, 0)}, vitesse ${fmt(t.harpoonProjectileSpeed, 0)}.`,
    `Coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Dégâts : ${fmt(t.harpoonDamageFlat, 1)} + ${pct(t.harpoonDamageWeaponPct, 1)} dégâts bonus AA + ${pct(t.harpoonDamageArmorPct, 1)} armure totale.`,
    `Base : Provocation ${fmt(t.harpoonTauntDuration, 2)} s, +${pct(t.harpoonSelfHastePct, 1)} vitesse vers la cible, passage à travers les unités pendant la Provocation.`,
    scalingLine('+4.5 dégâts, +1.2% coefficient AA bonus, +0.70% armure, +2 portée tous les 2 niveaux ; -0.14 s CD jusqu’à 15.9 s.'),
    phaseLine(1, 'projectile simple de Provocation.', phase),
    phaseLine(2, 'Réduction d’armure 12% pendant 4 s, +0.30% par niveau.', phase),
    phaseLine(3, 'Cloué au sol pendant les 1.0 premières secondes de Provocation, +0.015 s/niveau.', phase),
    phaseLine(4, 'si touché à plus de 180, Bulwark rue de 120 vers la cible.', phase),
    phaseLine(5, 'attire la cible de 110 ; si dans R, attraction vers le centre de R et Provocation +0.40 s.', phase),
    'Échec : Brèche de coque 2.25 s, -45% armure totale, -50% ténacité, pas de Plaque pendant 1.25 s.'
  ];
  if (slot === 'E') return [
    'Type : canal défensif.',
    `Durée ${fmt(t.meditationDuration, 2)} s, coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Effet : -${pct(t.meditationSelfSlowPct, 1)} vitesse, ${pct(t.meditationDamageReductionPct, 1)} réduction de dégâts.`,
    `Soin : ${pct(t.meditationHealMissingPctPerSecond, 2)} de la coque manquante par seconde.`,
    `Fin : bouclier ${pct(t.meditationShieldPctMaxHp, 2)} coque max + ${pct(t.meditationShieldArmorPct, 2)} armure totale pendant 4 s.`,
    scalingLine('+0.55% réduction, +0.22% soin/s, +0.02 s durée, -0.08% ralentissement, -0.12 s CD jusqu’à 14.4 s.'),
    'Base : les réductions de soins subies sont réduites de 40%.',
    phaseLine(1, 'canal défensif simple.', phase),
    phaseLine(2, 'Inarrêtable 0.50 s à l’activation.', phase),
    phaseLine(3, 'impulsion toutes les 0.85 s, rayon 170, Ralentissement 20% pendant 1 s.', phase),
    phaseLine(4, 'purge Enracinement, Désarmement et Silence à l’activation.', phase),
    phaseLine(5, 'hit cap 16% coque max ; à la fin, onde rayon 180 Cloué au sol 1.25 s.', phase)
  ];
  return [
    'Type : aura de duel.',
    `Durée ${fmt(t.stormDuration, 2)} s, rayon externe ${fmt(t.stormRadius, 0)}, rayon central ${fmt(t.stormInnerRadius, 0)}.`,
    `Coût ${fmt(s.energyCost ?? t.energyCost, 0)} énergie, recharge ${fmt(s.cooldownMax ?? t.baseCooldown, 2)} s.`,
    `Dégâts/s : ${fmt(t.stormBaseDpsFlat, 1)} + ${pct(t.stormBaseDpsPct, 1)} armure totale par seconde. Ralentissement ${pct(t.stormSlowPct, 1)}.`,
    `Vol d’armure : 2 armure toutes les 0.5 s, cap ${fmt(t.stormStealCap, 0)} par cible ; retour après 2 s hors zone puis restitution sur 2 s.`,
    scalingLine('+1.6 dégâts/s, +0.20% armure/s, rayons +1.4/+0.55 tous les 2 niveaux, +0.04 s durée, -1.25 s CD jusqu’à 72.5 s.'),
    phaseLine(1, 'aura de dégâts, ralentissement et vol d’armure.', phase),
    phaseLine(2, '+15% vitesse vers cibles provoquées dans la zone ; autos contre elles +12% dégâts.', phase),
    phaseLine(3, 'les cibles dans le rayon central sont Clouées au sol.', phase),
    phaseLine(4, 'toutes les 1.2 s, bouclier 3% coque max par cible récente, max 9% par activation.', phase),
    phaseLine(5, '2.60 s d’exposition : Étourdissement 1.0 s ; cibles provoquées attirées de 60 toutes les 0.8 s pendant 1.6 s.', phase)
  ];
}

function buildAbilityTooltip(myState, me, slot) {
  const s = myState?.abilityHud?.[slot];
  if (!s) return null;
  const frameId = me?.frameId || myState?.frameId || s.frameId || 'vanguard';
  const def = getShipFrameDef(frameId);
  const builders = { vanguard: vanguardAbility, sigil: sigilAbility, bulwark: bulwarkAbility };
  const lines = (builders[frameId]?.(slot, s) ?? []).filter(Boolean);
  lines.push(`Niveau ${s.investedLevel ?? 0}/${slot === 'R' ? 5 : 15} — phase ${s.phase ?? 0}.`);
  if (s.energyCost != null) lines.push(`Coût ${fmt(s.energyCost, 0)} énergie — Délai de rechargement ${fmt(s.cooldownMax ?? 0)} s.`);
  if (!s.unlocked) lines.push(s.canUpgrade ? 'Clique ou Ctrl+' + slot + ' pour débloquer.' : `Verrouillé : ${s.upgradeReason || 'point requis'}.`);
  return {
    title: `${slot} — ${def.abilities?.[slot]?.label ?? s.label}`,
    accent: slot === 'A' ? { r: 116, g: 226, b: 255 } : slot === 'Z' ? { r: 118, g: 244, b: 196 } : slot === 'E' ? { r: 124, g: 154, b: 255 } : { r: 243, g: 196, b: 104 },
    lines
  };
}

const STATUS_DESC = {
  root: 'Immobilise le déplacement. Les attaques restent possibles.',
  stun: 'Bloque mouvement, attaques, roquettes et compétences.',
  silence: 'Empêche de lancer les compétences.',
  disarm: 'Empêche les attaques principales.',
  grounded: 'Empêche dash, déplacement forcé et mobilité.',
  suppress: 'Contrôle total : mouvement, attaques et sorts bloqués.',
  sleep: 'Endormi jusqu’à expiration ou dégâts.',
  fear: 'Force à fuir la source et bloque les actions.',
  charm: 'Force à avancer vers la source et bloque les actions.',
  taunt: 'Force l’auto-attaque vers la source.',
  blind: 'Réduit la vision et interdit de viser hors du cône visible.',
  burn: 'Dégâts périodiques.',
  poison: 'Dégâts périodiques directs sur la coque.',
  bleed: 'Saignement et réduction des soins reçus.',
  damage_amp: 'Augmente les dégâts subis.',
  armor_shred: 'Réduit l’armure effective.',
  heal_cut: 'Réduit les soins reçus.',
  anti_shield: 'Réduit ou perturbe les boucliers.',
  spell_shield: 'Bloque le prochain contrôle ou sort hostile.',
  unstoppable: 'Ignore les contrôles de déplacement et d’action.',
  haste: 'Augmente la vitesse.',
  tenacity: 'Réduit la durée des contrôles.',
  slow_resist: 'Réduit l’efficacité des ralentissements.',
  invulnerable: 'Ignore les dégâts.',
  untargetable: 'Ne peut pas être ciblé.',
  camouflage: 'Masque partiellement le vaisseau.',
  true_sight: 'Révèle les cibles furtives.'
};

function colorFromHex(hex, fallback = { r: 220, g: 220, b: 220 }) {
  const raw = String(hex || '').replace('#', '').trim();
  if (raw.length !== 6) return fallback;
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n)) return fallback;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function buildCombatStatTooltip(myState, me, layout, mx, my) {
  const hit = hitTestCombatStat(layout, mx, my);
  if (!hit) return null;
  const entry = buildCombatStatEntries(me, myState).find((s) => s.id === hit.id);
  if (!entry) return null;
  return {
    title: `${entry.label} — ${entry.value}`,
    accent: entry.accent,
    lines: [entry.desc]
  };
}

function buildStatusTooltip(status) {
  if (!status) return null;
  const p = status.primaryColor ?? colorFromHex(status.colorHex);
  const name = status.name || status.label || status.id;
  let lines;
  if (status.kind === 'tagBuff') {
    lines = [`Tag d’équipement actif : ${status.points | 0} points.`, `Palier : ${status.stage | 0}.`, 'Bonus appliqué tant que les objets équipés gardent ce tag.'];
  } else if (status.kind === 'superTagBuff') {
    lines = [`Super-tag actif : rang ${status.rank | 0}.`, status.empowered ? 'Version renforcée active.' : 'Version de base active.', 'Né de la combinaison de deux tags équipés.'];
  } else if (status.permanent) {
    lines = [status.summary || 'Bonus permanent de bastion.', `Source : ${status.sourceLabel || status.name || 'Bastion'}`];
  } else {
    lines = [STATUS_DESC[status.id] || 'Effet actif.', `Durée restante : ${fmt(status.durationLeft ?? 0)} s.`];
  }
  if ((status.stacks ?? 1) > 1) lines.push(`Stacks : ${status.stacks}.`);
  if (status.value) lines.push(`Valeur : ${pct(status.value, 1)}.`);
  return { title: name, accent: p, lines };
}

function wrapTooltipLine(ctx, line, maxWidth) {
  const raw = String(line ?? '').trim();
  if (!raw) return [''];
  if (ctx.measureText(raw).width <= maxWidth) return [raw];
  const prefixMatch = raw.match(/^([✓○•\-–]|Palier\s+[IVX]+\s*:)\s+/u);
  const indent = prefixMatch ? '   ' : raw.startsWith('Évolution') ? '  ' : '';
  const words = raw.split(/\s+/u);
  const out = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !cur) {
      cur = next;
      continue;
    }
    out.push(cur);
    cur = `${indent}${word}`;
  }
  if (cur) out.push(cur);
  return out;
}

function buildWrappedTooltipLines(ctx, lines, maxWidth) {
  const out = [];
  for (const line of lines.filter(Boolean)) {
    out.push(...wrapTooltipLine(ctx, line, maxWidth));
  }
  return out;
}

function drawBox(ctx, view, tip, mx, my) {
  const dpr = view.dpr;
  const pad = 12;
  const lineH = 15.5;
  const titleH = 22;
  const footerH = 0;
  const screenPad = 8;
  ctx.save();
  ctx.font = `12px Segoe UI`;

  const rawLines = tip.lines.filter(Boolean);
  const maxAllowedW = Math.max(320, Math.min(620, view.cssW - screenPad * 2));
  const minW = Math.min(330, maxAllowedW);
  const titleW = ctx.measureText(tip.title).width + pad * 2;
  const desiredTextW = Math.max(...rawLines.map((l) => Math.min(ctx.measureText(l).width, maxAllowedW - pad * 2)), titleW - pad * 2, minW - pad * 2);
  const w = Math.min(maxAllowedW, Math.max(minW, desiredTextW + pad * 2));
  const wrappedLines = buildWrappedTooltipLines(ctx, rawLines, w - pad * 2);
  const maxVisibleLines = Math.max(12, Math.floor((view.cssH - 34 - pad * 2 - titleH) / lineH));
  const clipped = wrappedLines.length > maxVisibleLines;
  const lines = clipped ? wrappedLines.slice(0, Math.max(1, maxVisibleLines - 1)).concat('…') : wrappedLines;
  const h = Math.min(view.cssH - screenPad * 2, pad * 2 + titleH + lines.length * lineH + 6 + footerH);

  let x = mx + 18;
  let y = my - h - 14;
  if (x + w > view.cssW - screenPad) x = view.cssW - w - screenPad;
  if (x < screenPad) x = screenPad;
  if (y < screenPad) y = my + 18;
  if (y + h > view.cssH - screenPad) y = view.cssH - h - screenPad;

  const a = tip.accent ?? { r: 160, g: 210, b: 255 };
  fillRoundedRect(ctx, dpr, x, y, w, h, 10, 'rgba(7,10,16,0.97)', rgba(a.r, a.g, a.b, 0.62), 1.4);
  fillRoundedRect(ctx, dpr, x + 2, y + 2, w - 4, h - 4, 8, 'rgba(13,18,28,0.95)', 'rgba(255,255,255,0.03)');

  ctx.save();
  ctx.beginPath();
  ctx.rect((x + 4) * dpr, (y + 4) * dpr, (w - 8) * dpr, (h - 8) * dpr);
  ctx.clip();
  ctx.fillStyle = rgba(a.r, a.g, a.b, 0.95);
  ctx.font = `800 ${13 * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(tip.title, (x + pad) * dpr, (y + pad + 11) * dpr);
  ctx.fillStyle = 'rgba(224,233,249,0.92)';
  ctx.font = `${11.2 * dpr}px Segoe UI`;
  let yy = y + pad + titleH + 5;
  for (const line of lines) {
    ctx.fillText(line, (x + pad) * dpr, yy * dpr);
    yy += lineH;
  }
  ctx.restore();
  ctx.restore();
}

function hitRow(entries, y, layout, x, yMouse) {
  if (!entries?.length) return null;
  const scale = layout?.abilityScale ?? 1;
  const size = 25 * scale;
  const gap = 5 * scale;
  const centerX = layout?.centerX ?? 0;
  const total = entries.length;
  let xx = centerX - ((size * total + gap * (total - 1)) * 0.5);
  for (const s of entries) {
    if (x >= xx && x <= xx + size && yMouse >= y && yMouse <= y + size) return s;
    xx += size + gap;
  }
  return null;
}

function statusHit(myState, layout, x, y) {
  const rows = buildHudBuffRows(myState?.statuses ?? [], layout, myState?.bastions ?? [], myState?.equipment ?? null);
  for (const row of rows) {
    const hit = hitRow(row.entries, row.y, layout, x, y);
    if (hit) return hit;
  }
  return null;
}

export function drawHudTooltip(ctx, view, me, myState, input, layout = getCombatHudLayout(view)) {
  if (!input) return;
  const mx = input.msx;
  const my = input.msy;
  let tip = null;
  if (inside(layout.passiveRect, mx, my)) tip = buildPassiveTooltip(myState, me);
  for (const slot of ['A', 'Z', 'E', 'R']) {
    if (!tip && inside(layout.abilityRects?.[slot], mx, my)) tip = buildAbilityTooltip(myState, me, slot);
  }
  if (!tip && inside(layout.utilityRects?.D, mx, my)) tip = { title: 'D — Dock', accent: { r: 142, g: 204, b: 255 }, lines: ['S’arrimer à la station proche.', 'Maintenir ou appuyer selon le contexte.'] };
  if (!tip && inside(layout.utilityRects?.F, mx, my)) tip = { title: 'F — Roquette', accent: { r: 255, g: 182, b: 86 }, lines: ['Tire la roquette active.', 'La munition active se règle dans l’onglet Munitions.'] };
  if (!tip) tip = buildEquipmentTooltip(getEquippedHudTagHit(layout, mx, my, myState) || getEquippedHudHit(layout, mx, my, myState));
  if (!tip) tip = buildCombatStatTooltip(myState, me, layout, mx, my);
  if (!tip) tip = buildStatusTooltip(statusHit(myState, layout, mx, my));
  if (tip) drawBox(ctx, view, tip, mx, my);
}
