import { rgba, worldToScreen } from '../core/Math.js';
import { drawWorldHealthBars } from '../ui/worldbars/WorldHealthBarRenderer.js';
import { MOB_WORLD_BAR_STYLE } from './MobWorldBarStyle.js';

const MOB_VISUALS = {
  1: { glyph: '⚙', shape: 'mite', ring: 'dash' },
  2: { glyph: '✹', shape: 'sapper', ring: 'mine' },
  3: { glyph: '◈', shape: 'stinger', ring: 'cloak' },
  4: { glyph: '◇', shape: 'lancer', ring: 'beam' },
  5: { glyph: '▣', shape: 'nodule', ring: 'shield' },
  6: { glyph: '◆', shape: 'crusher', ring: 'heavy' },
  7: { glyph: 'ϟ', shape: 'warden', ring: 'arc' },
  8: { glyph: '☽', shape: 'specter', ring: 'veil' },
  9: { glyph: '☣', shape: 'hydra', ring: 'toxic' },
  10: { glyph: '◢', shape: 'apex', ring: 'hunt' }
};

function lighten(c, add = 32) {
  return { r: Math.min(255, (c?.r ?? 200) + add), g: Math.min(255, (c?.g ?? 200) + add), b: Math.min(255, (c?.b ?? 200) + add) };
}

function drawPolygon(ctx, cx, cy, r, sides, rot, dpr) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i * Math.PI * 2 / sides;
    const x = cx + Math.cos(a) * r * dpr;
    const y = cy + Math.sin(a) * r * dpr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawMobBody(ctx, screen, view, mob, t, visual) {
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const hi = lighten(c, mob.elite ? 70 : 35);
  const isSummon = (mob.summonGeneration || 0) > 0;
  const pulse = (isSummon ? 0.86 : 0.94) + Math.sin(t * 5 + (mob.id % 13)) * 0.045;
  const bodyR = mob.radius * pulse * (isSummon ? 0.86 : 1);
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const rot = (mob.rot || 0) + t * (visual.shape === 'specter' ? 0.8 : 0.18);

  ctx.save();
  ctx.shadowBlur = (isSummon ? 10 : (mob.elite ? 22 : 13)) * dpr;
  ctx.shadowColor = rgba(c.r, c.g, c.b, mob.elite ? 0.85 : 0.55);
  ctx.fillStyle = rgba(c.r, c.g, c.b, isSummon ? 0.58 : (mob.elite ? 0.94 : 0.88));
  ctx.strokeStyle = rgba(hi.r, hi.g, hi.b, isSummon ? 0.66 : 0.96);
  ctx.lineWidth = (mob.elite ? 2.5 : 1.8) * dpr;

  switch (visual.shape) {
    case 'mite':
      drawPolygon(ctx, cx, cy, bodyR, 6, rot, dpr);
      ctx.fill(); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = rot + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * bodyR * 0.55 * dpr, cy + Math.sin(a) * bodyR * 0.55 * dpr);
        ctx.lineTo(cx + Math.cos(a) * (bodyR + 8) * dpr, cy + Math.sin(a) * (bodyR + 8) * dpr);
        ctx.stroke();
      }
      break;
    case 'sapper':
      drawPolygon(ctx, cx, cy, bodyR, 8, rot, dpr);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.arc(cx, cy, bodyR * 1.35 * dpr, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'stinger':
      drawPolygon(ctx, cx, cy, bodyR, 3, rot - Math.PI / 2, dpr);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rot) * bodyR * 1.55 * dpr, cy + Math.sin(rot) * bodyR * 1.55 * dpr); ctx.stroke();
      break;
    case 'lancer':
      ctx.beginPath(); ctx.ellipse(cx, cy, bodyR * 0.75 * dpr, bodyR * 1.55 * dpr, rot, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(rot) * bodyR * 1.8 * dpr, cy - Math.sin(rot) * bodyR * 1.8 * dpr); ctx.lineTo(cx + Math.cos(rot) * bodyR * 1.8 * dpr, cy + Math.sin(rot) * bodyR * 1.8 * dpr); ctx.stroke();
      break;
    case 'nodule':
      drawPolygon(ctx, cx, cy, bodyR, 4, rot + Math.PI / 4, dpr); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, bodyR * 1.45 * dpr, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'crusher':
      drawPolygon(ctx, cx, cy, bodyR * 1.08, 5, rot, dpr); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(cx, cy, bodyR * 1.32 * dpr, Math.PI * 0.15, Math.PI * 1.25); ctx.stroke();
      break;
    case 'warden':
      drawPolygon(ctx, cx, cy, bodyR, 6, rot, dpr); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * bodyR * 1.2 * dpr, cy + Math.sin(a) * bodyR * 1.2 * dpr, 2.5 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'specter':
      ctx.globalAlpha = 0.78 + Math.sin(t * 8) * 0.12;
      drawPolygon(ctx, cx, cy, bodyR, 5, rot, dpr); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([7 * dpr, 6 * dpr]); ctx.beginPath(); ctx.arc(cx, cy, bodyR * 1.65 * dpr, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'hydra':
      for (let i = 0; i < 3; i++) {
        const a = rot + i * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * bodyR * 0.52 * dpr, cy + Math.sin(a) * bodyR * 0.52 * dpr, bodyR * 0.68 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      break;
    case 'apex':
      drawPolygon(ctx, cx, cy, bodyR * 1.12, 3, rot - Math.PI / 2, dpr); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(cx, cy, bodyR * 1.72 * dpr, t * 2, t * 2 + Math.PI * 1.35); ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(cx, cy, bodyR * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawMobRings(ctx, screen, view, mob, t, visual) {
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const cx = screen.x * dpr;
  const cy = screen.y * dpr;
  const r = (mob.radius + 11 + Math.sin(t * 3.2) * 2) * dpr;
  ctx.save();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, mob.elite ? 0.9 : 0.55);
  ctx.lineWidth = (mob.elite ? 2.2 : 1.2) * dpr;
  if (['veil', 'mine', 'toxic'].includes(visual.ring)) ctx.setLineDash([8 * dpr, 7 * dpr]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  if ((mob.summonGeneration || 0) > 0) {
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.34);
    ctx.setLineDash([3 * dpr, 7 * dpr]);
    ctx.beginPath(); ctx.arc(cx, cy, (mob.radius + 18) * dpr, t * 1.4, t * 1.4 + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (mob.specialCueLeft > 0) {
    const k = Math.max(0, Math.min(1, mob.specialCueLeft));
    ctx.strokeStyle = rgba(255, 230, 150, 0.85 * k);
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, (mob.radius + 26 + (1 - k) * 32) * dpr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = rgba(255, 230, 150, 0.95 * k);
    ctx.font = `${10 * dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.fillText(mob.specialCue || 'CAST', cx, cy - (mob.radius + 34) * dpr);
  }
  ctx.restore();
}


function drawDemoCage(ctx, view, mob, camX, camY, t) {
  if (!mob.demoMob || !mob.demoCageRadius) return;
  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const center = worldToScreen(camX, camY, mob.demoCageX ?? mob.x, mob.demoCageY ?? mob.y, view.cssW, view.cssH);
  const cx = center.x * dpr;
  const cy = center.y * dpr;
  const r = mob.demoCageRadius * dpr;
  ctx.save();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, mob.elite ? 0.62 : 0.46);
  ctx.fillStyle = rgba(c.r, c.g, c.b, mob.elite ? 0.035 : 0.025);
  ctx.lineWidth = (mob.elite ? 2 : 1.3) * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([10 * dpr, 9 * dpr]);
  ctx.strokeStyle = rgba(255, 255, 255, 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, (mob.demoCageRadius - 22) * dpr, t * 0.25, t * 0.25 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(120, 235, 255, 0.28);
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.fillStyle = rgba(220, 240, 255, 0.78);
  ctx.font = `${9 * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText('CAGE DE DÉMO — attaques redirigées vers le dummy', cx, cy + r + 14 * dpr);
  ctx.restore();
}

function drawDemoInfo(ctx, screen, view, mob) {
  if (!mob.demoMob) return;
  const dpr = view.dpr;
  const x = screen.x * dpr;
  const y = (screen.y + mob.radius + 22) * dpr;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `${9 * dpr}px Segoe UI`;
  ctx.fillStyle = 'rgba(191,205,226,0.82)';
  ctx.fillText(mob.role || '', x, y);
  if (mob.demoVariantLabel) {
    ctx.fillStyle = mob.demoVariantLabel === 'Standard' ? 'rgba(191,205,226,0.82)' : 'rgba(255,220,130,0.92)';
    ctx.fillText(mob.demoVariantLabel.toUpperCase(), x, y + 11 * dpr);
  } else if (mob.elite) {
    ctx.fillStyle = 'rgba(255,220,130,0.92)';
    ctx.fillText('VARIANTE ÉLITE', x, y + 11 * dpr);
  }
  ctx.restore();
}

export function drawMob(ctx, view, mob, camX, camY, t) {
  const screen = worldToScreen(camX, camY, mob.x, mob.y, view.cssW, view.cssH);
  const visual = MOB_VISUALS[mob.typeId] || MOB_VISUALS[1];

  drawDemoCage(ctx, view, mob, camX, camY, t);
  drawMobRings(ctx, screen, view, mob, t, visual);
  drawMobBody(ctx, screen, view, mob, t, visual);
  drawWorldHealthBars(ctx, view, mob, camX, camY, MOB_WORLD_BAR_STYLE);

  const dpr = view.dpr;
  const c = mob.color || { r: 200, g: 200, b: 220 };
  const cx = screen.x * dpr;
  const topY = (screen.y - mob.radius - 16) * dpr;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `${11 * dpr}px Segoe UI`;
  ctx.fillStyle = rgba(236, 242, 250, 0.94);
  ctx.fillText(mob.name, cx, topY);
  ctx.font = `${13 * dpr}px Segoe UI Symbol`;
  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.95);
  ctx.fillText(visual.glyph, cx, topY - 14 * dpr);

  if ((mob.summonGeneration || 0) > 0) {
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.82);
    ctx.font = `${9 * dpr}px Segoe UI`;
    ctx.fillText(mob.summonKind === 'shadow' ? 'OMBRE' : mob.summonKind === 'mirror' ? 'MIROIR' : 'PROGÉNITURE', cx, topY + 11 * dpr);
  }
  if ((mob.threat ?? 1) > 1 && !(mob.summonGeneration || 0)) {
    ctx.fillStyle = rgba(255, 228, 156, 0.86);
    ctx.font = `${10 * dpr}px Segoe UI`;
    ctx.fillText(`T${mob.threat}`, cx + (mob.radius + 18) * dpr, topY - 2 * dpr);
  }
  drawDemoInfo(ctx, screen, view, mob);
  ctx.restore();
}
