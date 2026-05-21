import { clamp, rgba } from '../core/Math.js';
import { fillRoundedRect } from './hud/HudChrome.js';
import { drawAbilityGlyph } from './hud/HudIcons.js';

function drawCooldownOverlay(ctx, dpr, x, y, w, h, cooldownRatio) {
  if (cooldownRatio <= 0.001) return;
  ctx.save();
  fillRoundedRect(ctx, dpr, x, y, w, h * cooldownRatio, 7, rgba(0, 0, 0, 0.58));
  ctx.restore();
}

function drawUpgradeTriangle(ctx, dpr, x, y, w, accent) {
  ctx.beginPath();
  ctx.moveTo((x + w * 0.5) * dpr, (y - 8) * dpr);
  ctx.lineTo((x + w * 0.5 - 7) * dpr, (y - 1) * dpr);
  ctx.lineTo((x + w * 0.5 + 7) * dpr, (y - 1) * dpr);
  ctx.closePath();
  ctx.fillStyle = rgba(98, 255, 142, 0.95);
  ctx.fill();
  ctx.strokeStyle = rgba(220, 255, 228, 0.9);
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  ctx.fillStyle = rgba(7, 18, 11, 0.96);
  ctx.textAlign = 'center';
  ctx.font = `${8 * dpr}px Segoe UI`;
  ctx.fillText('+', (x + w * 0.5) * dpr, (y - 2.8) * dpr);
}

function drawPips(ctx, dpr, x, y, w, level, max, accent) {
  const shown = Math.min(max, 15);
  const gap = 2;
  const pipW = Math.max(2.2, (w - gap * (shown - 1)) / shown);
  for (let i = 0; i < shown; i += 1) {
    fillRoundedRect(
      ctx,
      dpr,
      x + i * (pipW + gap),
      y,
      pipW,
      3,
      1.2,
      i < level ? rgba(accent.r, accent.g, accent.b, 0.95) : rgba(63, 69, 86, 0.82)
    );
  }
}

export function drawAbilityCard(ctx, dpr, x, y, w, h, slot, active, accent, frameId) {
  const level = Math.max(0, slot?.investedLevel ?? 0);
  const unlocked = !!slot?.forceUnlocked || (level > 0 && slot?.unlocked !== false);
  const maxLevel = slot?.slot === 'R' ? 5 : 15;
  const cooldownMax = Math.max(slot?.cooldownMax ?? 0, slot?.cooldownLeft ?? 0, 0.001);
  const cooldownRatio = unlocked ? clamp((slot?.cooldownLeft ?? 0) / cooldownMax, 0, 1) : 0;
  const ready = unlocked && (slot?.cooldownLeft ?? 0) <= 0.001;
  const canCast = ready && slot?.hasEnergy !== false;
  const canUpgrade = !!slot?.canUpgrade;
  const key = String(slot?.key ?? '?');
  const isUtility = key === 'D' || key === 'F';

  const bgAlpha = unlocked ? 0.95 : 0.72;
  const innerAlpha = unlocked ? 0.86 : 0.42;
  const border = unlocked
    ? (ready ? rgba(accent.r, accent.g, accent.b, 0.78) : rgba(128, 143, 176, 0.34))
    : (canUpgrade ? rgba(103, 246, 152, 0.62) : rgba(93, 103, 125, 0.24));

  fillRoundedRect(ctx, dpr, x, y, w, h, 10, rgba(7, 10, 16, bgAlpha), border, canUpgrade ? 1.8 : 1.1);
  fillRoundedRect(ctx, dpr, x + 3, y + 3, w - 6, h - 6, 8, active ? rgba(accent.r, accent.g, accent.b, 0.18) : rgba(16, 20, 31, innerAlpha), 'rgba(255,255,255,0.025)');

  if (canUpgrade) {
    ctx.fillStyle = rgba(72, 255, 139, 0.92);
    ctx.beginPath();
    ctx.moveTo((x + w - 16) * dpr, (y + 6) * dpr);
    ctx.lineTo((x + w - 7) * dpr, (y + 15) * dpr);
    ctx.lineTo((x + w - 25) * dpr, (y + 15) * dpr);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = rgba(239, 246, 255, unlocked ? 0.96 : 0.62);
  ctx.font = `700 ${12 * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(key, (x + 8) * dpr, (y + 16) * dpr);

  if (!isUtility) {
    ctx.textAlign = 'right';
    ctx.font = `700 ${10 * dpr}px Segoe UI`;
    ctx.fillStyle = unlocked ? rgba(255, 215, 105, 0.95) : rgba(154, 163, 184, 0.66);
    ctx.fillText(`${level}/${maxLevel}`, (x + w - 8) * dpr, (y + 16) * dpr);
  }

  const glyphAlpha = unlocked ? 0.96 : 0.20;
  ctx.save();
  ctx.globalAlpha = glyphAlpha;
  drawAbilityGlyph(ctx, dpr, frameId, slot?.slot ?? key, x + w * 0.5 - 14, y + 20, 28, 24, accent);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (isUtility) {
    ctx.fillStyle = rgba(207, 219, 238, 0.72);
    ctx.font = `${9 * dpr}px Segoe UI`;
    ctx.fillText(key === 'D' ? 'dock' : 'rocket', (x + w * 0.5) * dpr, (y + h - 9) * dpr);
  } else if (!unlocked) {
    ctx.fillStyle = canUpgrade ? rgba(164, 255, 194, 0.95) : rgba(145, 154, 174, 0.66);
    ctx.font = `700 ${9.2 * dpr}px Segoe UI`;
    ctx.fillText(canUpgrade ? 'À DÉBLOQUER' : 'VERROUILLÉ', (x + w * 0.5) * dpr, (y + h - 14) * dpr);
  } else {
    if (slot?.energyCost != null) {
      ctx.fillStyle = canCast ? rgba(183, 139, 255, 0.92) : rgba(238, 104, 108, 0.84);
      ctx.font = `${8.4 * dpr}px Segoe UI`;
      ctx.fillText(`${Math.round(slot.energyCost)}`, (x + w * 0.5) * dpr, (y + h - 11) * dpr);
    }
  }

  if (!isUtility) {
    const maxPips = Math.min(maxLevel, 5);
    const filledPips = Math.min(maxPips, Math.ceil((level / maxLevel) * maxPips));
    drawPips(ctx, dpr, x + 9, y + h - 4, w - 18, filledPips, maxPips, unlocked ? accent : { r: 92, g: 98, b: 116 });
  }

  drawCooldownOverlay(ctx, dpr, x, y, w, h, cooldownRatio);

  if (cooldownRatio > 0.001) {
    ctx.fillStyle = rgba(255, 238, 205, 0.96);
    ctx.textAlign = 'center';
    ctx.font = `700 ${16 * dpr}px Segoe UI`;
    ctx.fillText((slot.cooldownLeft ?? 0).toFixed((slot.cooldownLeft ?? 0) >= 10 ? 0 : 1), (x + w * 0.5) * dpr, (y + h * 0.56) * dpr);
  }
}
