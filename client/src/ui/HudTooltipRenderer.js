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

function buildPassiveTooltip(myState, me) {
  const fs = myState?.frameState ?? {};
  const frameId = me?.frameId || myState?.frameId || 'vanguard';
  if (frameId === 'vanguard') {
    return {
      title: 'Passif — Surchauffe',
      accent: { r: 223, g: 179, b: 94 },
      lines: [
        'Les attaques et compétences qui touchent donnent 1 charge pendant 5 s.',
        `Charges : ${fs.passiveStacks ?? 0}/${fs.passiveMaxStacks ?? 10}.`,
        'Par charge : cadence, vitesse moteur et résistance aux ralentissements.',
        'À 6 charges : ténacité. À 10 charges : Z/E déclenche la ténacité de surchauffe.',
        fs.passiveDecaying ? 'Décroissance active : perte rapide de charges.' : `Décroissance dans ${fmt(fs.passiveDecayLeft ?? 0)} s.`
      ]
    };
  }
  if (frameId === 'sigil') {
    return {
      title: 'Passif — Runes',
      accent: { r: 198, g: 128, b: 255 },
      lines: [
        'Les tirs et sorts posent des runes sur les cibles.',
        '3 runes : ralentissement. 5 runes : détonation automatique.',
        `Délai de détonation : ${fmt(fs.detonationCooldownLeft ?? 0)} s.`
      ]
    };
  }
  return {
    title: 'Passif — Plaques réactives',
    accent: { r: 236, g: 196, b: 96 },
    lines: [
      'Les gros dégâts reçus génèrent des plaques temporaires.',
      `Plaques : ${fs.passiveStacks ?? 0}/${fs.passiveMaxStacks ?? 5}.`,
      'Chaque plaque donne armure, réduction de dégâts et ténacité.',
      'À pleine charge : bouclier et attaques renforcées par l’armure.'
    ]
  };
}

function vanguardAbility(slot, s) {
  const t = s.tuning ?? {};
  if (slot === 'A') return [
    castLine(t),
    `Projectile linéaire rapide : ${fmt(t.damageFlat)} + ${pct(t.damagePct, 0)} des dégâts d’attaque automatique.`,
    `Portée ${fmt(t.projectileRange, 0)}, largeur ${fmt(t.projectileWidth, 0)}.`,
    `Charge ${t.empowerCharges ?? 0} auto renforcée(s), cap selon phase.`,
    t.pierceCount > 0 ? 'Traverse une cible supplémentaire.' : '',
    t.damageAmpPct > 0 ? `Applique Vulnérabilité ${pct(t.damageAmpPct)} pendant ${fmt(t.damageAmpDuration)} s.` : '',
    t.disarmDuration > 0 ? `Sur cible déjà vulnérable : Désarmement ${fmt(t.disarmDuration)} s.` : ''
  ];
  if (slot === 'Z') return [
    `Ruée de ${fmt(t.dashDistance, 0)} puis +${pct(t.moveBoostPct)} vitesse pendant ${fmt(t.moveBoostDuration)} s.`,
    t.trailSlowPct > 0 ? `Traînée : Ralentissement ${pct(t.trailSlowPct)} pendant ${fmt(t.trailSlowDuration)} s.` : '',
    t.comboWindowDuration > 0 ? `Fenêtre combo : prochain A +${pct(t.comboProjectileSpeedPct)} vitesse projectile et +${pct(t.comboDamagePct)} dégâts.` : '',
    t.cleanseSlowAndRoot ? 'Purge ralentissement et root à l’activation.' : ''
  ];
  if (slot === 'E') return [
    castLine(t),
    `Phase inertielle : ${pct(t.damageReductionPct)} réduction de dégâts pendant ${fmt(t.phaseDuration)} s.`,
    t.spellShieldDuration > 0 ? `À la sortie : bouclier anti-sort ${fmt(t.spellShieldDuration)} s.` : '',
    t.exitRadius > 0 ? `Onde de sortie : Grounded ${fmt(t.groundedDuration)} s dans ${fmt(t.exitRadius, 0)}.` : '',
    t.exitShieldPctMaxShield > 0 ? `Une fois la phase écoulée : bouclier temporaire égal à ${pct(t.exitShieldPctMaxShield)} du bouclier max.` : '',
    t.restoreAChargeOnMaxHeat ? 'Si lancé à 10 Surchauffe : rend 1 charge de A à la fin.' : ''
  ];
  return [
    `Frénésie ${fmt(t.ultDuration)} s : +${pct(t.ultAttackSpeedPct)} cadence, +${pct(t.ultMoveSpeedPct)} vitesse.`,
    `+${pct(t.ultEmpowerPct)} dégâts infligés pendant R.`,
    t.ultBurnDuration > 0 ? `Auto sur cible marquée par A : Brûlure ${fmt(t.ultBurnDuration)} s.` : '',
    t.unstoppableDuration > 0 ? `Z pendant R : Inarrêtable ${fmt(t.unstoppableDuration)} s.` : '',
    t.ultCloseAStunDuration > 0 ? `A proche pendant R : Étourdissement ${fmt(t.ultCloseAStunDuration)} s.` : ''
  ];
}

function sigilAbility(slot, s) {
  const t = s.tuning ?? {};
  if (slot === 'A') return [
    castLine(t),
    `Trait runique traversant : ${fmt(t.aImpactDamageFlat)} + ${pct(t.aImpactDamagePct)} dégâts d’attaque automatique.`,
    'Pose 1 rune. Les runes amplifient les prochaines touches.',
    t.aPierceCount > 0 ? 'Phase 2 : traverse largement les cibles.' : '',
    t.aRevealThreshold > 0 ? `Si la cible avait déjà ${t.aRevealThreshold} runes : Révélation.` : '',
    t.aHealCutThreshold > 0 ? `Si la cible avait déjà ${t.aHealCutThreshold} runes : réduction de soins ${pct(t.aHealCutPct)}.` : '',
    t.aDetonationStasisDuration > 0 ? 'Première détonation à 5 runes : Stase courte.' : ''
  ];
  if (slot === 'Z') return [
    `Zone ${fmt(t.zZoneRadius, 0)} pendant ${fmt(t.zZoneDuration)} s.`,
    `Dégâts/s : ${fmt(t.zZoneDamageFlatPerSecond)} + ${pct(t.zZoneDamageWeaponPctPerSecond)} arme.`,
    `Ralentit de ${pct(t.zZoneSlowPct)}.`,
    t.zRunePulseStacks > 0 ? 'Chaque pulse ajoute des runes et peut déclencher une détonation à 5 runes.' : '',
    t.zCanRecastClose ? 'Réactivation : ferme la zone et contrôle les cibles runées.' : ''
  ];
  if (slot === 'E') return [
    `Dash de ${fmt(t.eDashDistance, 0)} et camouflage ${fmt(t.eCamouflageDuration)} s.`,
    t.eTrailSlowPct > 0 ? `Traînée : ralentissement ${pct(t.eTrailSlowPct)} pendant ${fmt(t.eTrailSlowDuration)} s, pose des runes et peut détoner.` : '',
    t.aEmpowerFromVeilDamagePct > 0 ? `A lancé depuis le voile : +${pct(t.aEmpowerFromVeilDamagePct)} dégâts.` : '',
    t.eSpellShieldOnEndDuration > 0 ? `Fin du voile : bouclier anti-sort ${fmt(t.eSpellShieldOnEndDuration)} s.` : ''
  ];
  return [
    `Convergence ${fmt(t.ultDuration)} s.`,
    `Runes durent +${pct(t.ultRuneDurationBonusPct)}.`,
    `Cooldown de A multiplié par x${fmt(t.ultACooldownMultiplier, 2)}.`,
    `Vol de vie : ${pct(t.ultLifestealPct, 1)}.`,
    t.ultDetonationStunDuration > 0 ? `Première détonation à 5 runes pendant R : étourdissement ${fmt(t.ultDetonationStunDuration)} s.` : ''
  ];
}

function bulwarkAbility(slot, s) {
  const t = s.tuning ?? {};
  if (slot === 'A') return [
    `Ancrage ${fmt(t.anchorDuration)} s : armure +${fmt(t.anchorArmorFlat)}.`,
    `Réduction ${pct(t.anchorDamageReductionPct)} et reflet ${pct(t.anchorReflectPct)}.`,
    t.anchorPulseRadius > 0 ? `Pulse slow ${pct(t.anchorPulseSlowPct)} dans ${fmt(t.anchorPulseRadius, 0)}.` : '',
    t.anchorTauntedBonusFlat > 0 ? 'Bonus de dégâts contre les cibles provoquées.' : '',
    t.anchorSingleHitCapPctMaxHp > 0 ? `Cap de gros hit : ${pct(t.anchorSingleHitCapPctMaxHp)} PV max.` : ''
  ];
  if (slot === 'Z') return [
    castLine(t),
    `Harpon ${fmt(t.harpoonRange, 0)} : ${fmt(t.harpoonDamageFlat)} + ${pct(t.harpoonDamageWeaponPct)} attaque automatique + armure.`,
    `Provoque ${fmt(t.harpoonTauntDuration)} s.`,
    t.harpoonArmorShredPct > 0 ? `Shred armure ${pct(t.harpoonArmorShredPct)} pendant ${fmt(t.harpoonArmorShredDuration)} s.` : '',
    t.harpoonGroundedDuration > 0 ? `Grounded ${fmt(t.harpoonGroundedDuration)} s.` : '',
    t.harpoonDashDistance > 0 ? 'Dash vers la cible touchée.' : '',
    t.harpoonPullStrength > 0 ? 'Tire la cible vers toi.' : '',
    'Échec : Brèche de coque, perte d’armure et de ténacité.'
  ];
  if (slot === 'E') return [
    `Méditation ${fmt(t.meditationDuration)} s : réduction ${pct(t.meditationDamageReductionPct)}.`,
    `Soigne les PV manquants et donne un bouclier à la fin.`,
    t.meditationCastUnstoppableDuration > 0 ? `Début : Inarrêtable ${fmt(t.meditationCastUnstoppableDuration)} s.` : '',
    t.meditationPulseRadius > 0 ? `Fin : slow dans ${fmt(t.meditationPulseRadius, 0)}.` : '',
    t.meditationCleanseSilenceDisarmRoot ? 'Purge silence, désarmement et root.' : '',
    t.meditationFinalGroundedDuration > 0 ? `Fin : Grounded ${fmt(t.meditationFinalGroundedDuration)} s.` : ''
  ];
  return [
    `Tempête ${fmt(t.stormDuration)} s, rayon externe ${fmt(t.stormRadius, 0)} et centre ${fmt(t.stormInnerRadius, 0)}.`,
    `Dégâts/s : ${fmt(t.stormBaseDpsFlat)} + ${pct(t.stormBaseDpsPct)} attaque automatique.`,
    `Ralentit de ${pct(t.stormSlowPct)} et vole de l’armure par cible.`,
    t.stormCentralGroundedDuration > 0 ? 'Le rayon central cloue les cibles au sol.' : '',
    t.stormTauntedDamageAmpPct > 0 ? `Cibles provoquées : +${pct(t.stormTauntedDamageAmpPct)} dégâts subis.` : '',
    t.stormExposureStunThreshold > 0 ? `Exposition prolongée : stun ${fmt(t.stormExposureStunDuration)} s.` : '',
    t.stormPullStrength > 0 ? 'La tempête attire périodiquement les ennemis.' : ''
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

function drawBox(ctx, view, tip, mx, my) {
  const dpr = view.dpr;
  const pad = 11;
  const lineH = 15;
  const titleH = 20;
  ctx.save();
  ctx.font = `12px Segoe UI`;
  const lines = tip.lines.filter(Boolean).slice(0, 8);
  const textW = Math.max(ctx.measureText(tip.title).width, ...lines.map(l => ctx.measureText(l).width));
  const w = Math.min(430, Math.max(250, textW + pad * 2));
  const h = pad * 2 + titleH + lines.length * lineH + 4;
  let x = mx + 18;
  let y = my - h - 14;
  if (x + w > view.cssW - 8) x = view.cssW - w - 8;
  if (y < 8) y = my + 18;
  const a = tip.accent ?? { r: 160, g: 210, b: 255 };
  fillRoundedRect(ctx, dpr, x, y, w, h, 10, 'rgba(7,10,16,0.96)', rgba(a.r, a.g, a.b, 0.60), 1.4);
  fillRoundedRect(ctx, dpr, x + 2, y + 2, w - 4, h - 4, 8, 'rgba(13,18,28,0.94)', 'rgba(255,255,255,0.03)');
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
