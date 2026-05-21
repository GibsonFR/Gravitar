import { clamp, rgba } from '../../core/Math.js';
import { COLORS } from '../../core/Colors.js';
import { getShipFramePalette } from '../../entities/ship/ShipFramePalette.js';
import { fillRoundedRect, drawMeterRow } from './HudChrome.js';
import { drawFrameGlyph, drawStatGlyph } from './HudIcons.js';
import { getCombatHudLayout } from './HudLayout.js';

function formatOne(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 10 ? 0 : 1) : '0';
}

function formatPercent(value, digits = 0) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

function drawPanel(ctx, dpr, r, title, accent, alpha = 0.20) {
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 8, rgba(6, 8, 13, 0.88), rgba(accent.r, accent.g, accent.b, alpha), 1.1);
  fillRoundedRect(ctx, dpr, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 6, rgba(11, 14, 22, 0.90), 'rgba(255,255,255,0.028)');
  if (!title) return;
  ctx.fillStyle = rgba(168, 188, 218, 0.66);
  ctx.font = `700 ${8.5 * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(title, (r.x + 8) * dpr, (r.y + 11) * dpr);
}

export function getCombatStatRects(layout) {
  const scale = layout?.scale ?? 1;
  const r = layout?.combatStatsRect;
  if (!r) return [];
  const x0 = r.x + 12 * scale;
  const y0 = r.y + 27 * scale;
  const col = 88 * scale;
  const row = 25 * scale;
  return buildCombatStatEntries(null, null).map((entry, i) => ({ ...entry, x: x0 + col * (i % 5), y: y0 + row * Math.floor(i / 5), w: 82 * scale, h: 21 * scale }));
}

export function hitTestCombatStat(layout, x, y) {
  for (const r of getCombatStatRects(layout)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y - 9 * (layout?.scale ?? 1) && y <= r.y + r.h) return r;
  }
  return null;
}

function drawSmallStat(ctx, dpr, x, y, label, value, glyph, accent, scale) {
  drawStatGlyph(ctx, dpr, glyph, x, y + 1 * scale, accent);
  ctx.fillStyle = rgba(132, 154, 186, 0.78);
  ctx.font = `700 ${8.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(label, (x + 14 * scale) * dpr, y * dpr);
  ctx.fillStyle = rgba(236, 244, 255, 0.96);
  ctx.font = `800 ${10.8 * scale * dpr}px Segoe UI`;
  ctx.fillText(value, (x + 14 * scale) * dpr, (y + 12 * scale) * dpr);
}

function drawProgressionPanel(ctx, dpr, r, me, myState, palette, scale) {
  const prog = { ...(myState?.progression ?? {}), frameId: me.frameId || myState?.frameId || 'vanguard' };
  const xp01 = clamp((prog.xp ?? 0) / Math.max(1, prog.nextXp ?? 1), 0, 1);
  const sp = prog.skillPoints ?? 0;

  drawPanel(ctx, dpr, r, 'PROGRESSION', palette.outline, 0.18);

  const cx = r.x + 23 * scale;
  const cy = r.y + 36 * scale;
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, 19 * scale * dpr, -Math.PI * 0.5, Math.PI * 1.5);
  ctx.strokeStyle = rgba(57, 69, 91, 0.82);
  ctx.lineWidth = 4 * scale * dpr;
  ctx.stroke();
  if (xp01 > 0.001) {
    ctx.beginPath();
    ctx.arc(cx * dpr, cy * dpr, 19 * scale * dpr, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * xp01);
    ctx.strokeStyle = rgba(235, 193, 79, 0.98);
    ctx.lineWidth = 4 * scale * dpr;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.beginPath();
  ctx.arc(cx * dpr, cy * dpr, 14.5 * scale * dpr, 0, Math.PI * 2);
  ctx.fillStyle = rgba(5, 8, 13, 0.98);
  ctx.fill();
  drawFrameGlyph(ctx, dpr, prog.frameId, cx, cy - 1 * scale, 13 * scale, palette);

  const tx = r.x + 46 * scale;
  ctx.fillStyle = rgba(240, 246, 255, 0.95);
  ctx.font = `${11 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(`Niv. ${prog.level ?? 1}`, tx * dpr, (r.y + 31 * scale) * dpr);
  ctx.fillStyle = rgba(171, 190, 218, 0.82);
  ctx.font = `${8.5 * scale * dpr}px Segoe UI`;
  ctx.fillText(`${Math.floor(prog.xp ?? 0)} / ${Math.floor(prog.nextXp ?? 1)} XP`, tx * dpr, (r.y + 45 * scale) * dpr);
  drawMeterRow(ctx, dpr, tx, r.y + 51 * scale, Math.max(44 * scale, r.w - 56 * scale), 5 * scale, xp01, { r: 230, g: 188, b: 70 }, '');

  const pillW = 48 * scale;
  const pillX = r.x + r.w - pillW - 7 * scale;
  fillRoundedRect(ctx, dpr, pillX, r.y + 8 * scale, pillW, 18 * scale, 6, sp > 0 ? rgba(13, 34, 22, 0.95) : rgba(18, 22, 30, 0.84), sp > 0 ? rgba(111, 250, 159, 0.58) : rgba(105, 116, 138, 0.20));
  ctx.fillStyle = sp > 0 ? rgba(139, 252, 176, 0.98) : rgba(164, 176, 198, 0.72);
  ctx.font = `${8.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(`${sp} pt`, (pillX + pillW * 0.5) * dpr, (r.y + 20.5 * scale) * dpr);
}

export function buildCombatStatEntries(me, myState) {
  const derived = myState?.derived ?? {};
  return [
    { id: 'damage', label: 'Dégâts', value: formatOne(derived.autoAttackDamage ?? 0), glyph: 'damage', accent: { r: 255, g: 180, b: 110 }, desc: 'Dégâts estimés de l’attaque principale avant mitigation de la cible.' },
    { id: 'speed', label: 'Vitesse', value: formatOne(derived.moveSpeed ?? me?.engine ?? 0), glyph: 'speed', accent: { r: 116, g: 226, b: 255 }, desc: 'Vitesse de déplacement actuelle après moteur, effets et bonus de bastion.' },
    { id: 'rate', label: 'Cadence', value: `${formatOne(derived.autoAttackRate ?? 0)}/s`, glyph: 'rate', accent: { r: 90, g: 255, b: 195 }, desc: 'Nombre d’attaques principales par seconde.' },
    { id: 'crit', label: 'Critique', value: formatPercent(derived.critChance ?? 0), glyph: 'crit', accent: { r: 248, g: 206, b: 104 }, desc: 'Chance que l’attaque principale inflige un critique.' },
    { id: 'armor', label: 'Armure', value: formatOne(derived.armor ?? 0), glyph: 'shield', accent: { r: 155, g: 190, b: 230 }, desc: 'Réduit les dégâts directs sur la coque. La pénétration ennemie l’ignore partiellement.' },
    { id: 'hregen', label: 'Coque/s', value: formatOne(derived.hullRegen ?? 0), glyph: 'regen', accent: { r: 255, g: 103, b: 112 }, desc: 'Régénération de coque par seconde.' },
    { id: 'sregen', label: 'Bouclier/s', value: formatOne(derived.shieldRegen ?? 0), glyph: 'shield', accent: { r: 117, g: 181, b: 255 }, desc: 'Régénération du bouclier après le délai sans dégâts.' },
    { id: 'eregen', label: 'Énergie/s', value: formatOne(derived.energyRegen ?? 0), glyph: 'regen', accent: { r: 183, g: 122, b: 255 }, desc: 'Régénération d’énergie par seconde.' },
    { id: 'dmgmult', label: 'Multi. dmg', value: `x${formatOne(derived.damageMult ?? 1)}`, glyph: 'damage', accent: { r: 255, g: 180, b: 110 }, desc: 'Multiplicateur général des dégâts du build.' },
    { id: 'shieldpen', label: 'Pen. bouclier', value: formatPercent(derived.shieldPenPct ?? 0), glyph: 'mult', accent: { r: 112, g: 220, b: 255 }, desc: 'Part des dégâts qui traverse directement le bouclier pour toucher la coque.' },
    { id: 'cdr', label: 'Récup. CD', value: `x${formatOne(derived.cooldownRecoveryMult ?? 1)}`, glyph: 'rate', accent: { r: 90, g: 255, b: 195 }, desc: 'Vitesse de récupération des cooldowns de compétences.' },
    { id: 'critdmg', label: 'Crit x', value: `x${formatOne(derived.critDamageMult ?? 1.5)}`, glyph: 'crit', accent: { r: 248, g: 206, b: 104 }, desc: 'Multiplicateur appliqué aux critiques.' },
    { id: 'lifesteal', label: 'Vol de vie', value: formatPercent(derived.lifestealRatio ?? 0), glyph: 'regen', accent: { r: 255, g: 103, b: 112 }, desc: 'Part des dégâts rendue en coque.' },
    { id: 'armorpen', label: 'Pen. armure', value: formatOne(derived.armorPenFlat ?? 0), glyph: 'damage', accent: { r: 255, g: 150, b: 100 }, desc: 'Armure ignorée quand tu infliges des dégâts à la coque.' },
    { id: 'rockets', label: 'Roquettes', value: String(derived.rocketAmmoQuantity ?? 0), glyph: 'mult', accent: { r: 255, g: 182, b: 86 }, desc: 'Munitions du type de roquette actuellement actif.' }
  ];
}

function drawCombatStatsPanel(ctx, dpr, r, me, myState, palette, scale) {
  drawPanel(ctx, dpr, r, 'STATISTIQUES', palette.outline, 0.16);
  const rects = getCombatStatRects({ combatStatsRect: r, scale });
  const stats = buildCombatStatEntries(me, myState);
  for (let i = 0; i < stats.length; i += 1) {
    const entry = stats[i];
    const pos = rects[i];
    drawSmallStat(ctx, dpr, pos.x, pos.y, entry.label, entry.value, entry.glyph, entry.accent, scale);
  }
}

function drawVitalsBars(ctx, dpr, r, me, palette, scale) {
  const vitals = me.vitals;
  const hp01 = clamp(vitals.hp / Math.max(1, vitals.maxHp), 0, 1);
  const sh01 = clamp(vitals.shield / Math.max(1, vitals.maxShield), 0, 1);
  const en01 = clamp(vitals.energy / Math.max(1, vitals.maxEnergy), 0, 1);

  drawPanel(ctx, dpr, r, '', palette.outline, 0.20);
  const x = r.x + 10 * scale;
  const valueW = 62 * scale;
  const w = r.w - 22 * scale - valueW;
  drawMeterRow(ctx, dpr, x, r.y + 12 * scale, w, 10 * scale, hp01, COLORS.hp, '');
  drawMeterRow(ctx, dpr, x, r.y + 32 * scale, w, 9 * scale, sh01, COLORS.shield, '');
  drawMeterRow(ctx, dpr, x, r.y + 50 * scale, w, 9 * scale, en01, COLORS.energy, '');
  ctx.textAlign = 'right';
  ctx.font = `800 ${10.2 * scale * dpr}px Segoe UI`;
  ctx.fillStyle = 'rgba(240,246,255,0.94)';
  ctx.fillText(`${Math.ceil(vitals.hp)} / ${Math.ceil(vitals.maxHp)}`, (r.x + r.w - 10 * scale) * dpr, (r.y + 20.5 * scale) * dpr);
  ctx.fillText(`${Math.ceil(vitals.shield)} / ${Math.ceil(vitals.maxShield)}`, (r.x + r.w - 10 * scale) * dpr, (r.y + 39.5 * scale) * dpr);
  ctx.fillText(`${Math.ceil(vitals.energy)} / ${Math.ceil(vitals.maxEnergy)}`, (r.x + r.w - 10 * scale) * dpr, (r.y + 57.5 * scale) * dpr);
}

export function drawVitalsPanel(ctx, view, me, myState, frameDef) {
  const layout = getCombatHudLayout(view);
  if (!me?.vitals) return layout;

  const dpr = view.dpr;
  const scale = layout.scale;
  const palette = getShipFramePalette(me.frameId || myState?.frameId || 'vanguard');

  drawVitalsBars(ctx, dpr, layout.vitalsRect, me, palette, scale);
  drawProgressionPanel(ctx, dpr, layout.playerStatsRect, me, myState, palette, scale);
  drawCombatStatsPanel(ctx, dpr, layout.combatStatsRect, me, myState, palette, scale);

  return layout;
}
