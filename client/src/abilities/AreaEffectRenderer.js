import { rgba } from '../core/Math.js';
import { drawStatusGlyph } from '../ui/status/StatusGlyphRenderer.js';

function fakeStatusEntry(effect) {
  return {
    id: effect.statusId || effect.label || 'zone',
    primaryColor: effect.color ?? { r: 90, g: 220, b: 255 },
    secondaryColor: effect.color ?? { r: 90, g: 220, b: 255 }
  };
}

export function drawAreaEffect(ctx, view, effect, camX, camY, t) {
  const sx = (effect.x - camX) + view.cssW * 0.5;
  const sy = (effect.y - camY) + view.cssH * 0.5;
  const isTestZone = effect.kind === 'test_effect_zone';
  const dormant = isTestZone && effect.phase === 'dormant';
  const pulse = isTestZone
    ? (dormant ? 0.55 + 0.05 * Math.sin(t * 1.7 + effect.id * 0.02) : 0.82 + 0.18 * Math.sin(t * 3.2 + effect.id * 0.02))
    : 0.78 + 0.22 * Math.sin(t * 5.6 + effect.id * 0.02);
  const alpha = isTestZone
    ? (dormant ? 0.030 : 0.115)
    : Math.max(0.10, Math.min(0.34, (effect.durationLeft / 4) * 0.32 + 0.09));
  const baseColor = effect.color ?? { r: 90, g: 220, b: 255 };
  const color = dormant
    ? { r: Math.round(baseColor.r * 0.32 + 52), g: Math.round(baseColor.g * 0.32 + 52), b: Math.round(baseColor.b * 0.32 + 58) }
    : baseColor;
  const dpr = view.dpr;
  const x = sx * dpr;
  const y = sy * dpr;
  const r = effect.radius * dpr;

  const grad = ctx.createRadialGradient(x, y, Math.max(1, r * 0.10), x, y, Math.max(1, r));
  grad.addColorStop(0, rgba(color.r, color.g, color.b, alpha * 0.72 * pulse));
  grad.addColorStop(0.58, rgba(color.r, color.g, color.b, alpha * 0.28));
  grad.addColorStop(1, rgba(color.r, color.g, color.b, 0.01));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(color.r, color.g, color.b, isTestZone ? (dormant ? 0.16 : 0.42) : 0.72);
  ctx.lineWidth = (isTestZone ? (dormant ? 1.0 : 1.55) : 2) * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rgba(color.r, color.g, color.b, isTestZone ? (dormant ? 0.10 : 0.28) : 0.26);
  ctx.lineWidth = 1 * dpr;
  ctx.setLineDash([8 * dpr, 10 * dpr]);
  ctx.lineDashOffset = -t * (isTestZone ? 10 : 18) * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (isTestZone) {
    const iconSize = 31;
    const iconX = sx - iconSize * 0.5;
    const iconY = sy - iconSize * 0.5;
    ctx.fillStyle = 'rgba(6,9,14,0.76)';
    ctx.strokeStyle = rgba(color.r, color.g, color.b, 0.78);
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.arc(sx * dpr, sy * dpr, (iconSize * 0.62) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawStatusGlyph(ctx, dpr, fakeStatusEntry(effect), iconX, iconY, iconSize, dormant ? 0.42 : 0.98);

    if (dormant) {
      const total = Math.max(0.01, effect.dormantSeconds || 10);
      const left = Math.max(0, effect.cooldownLeft || 0);
      const ratio = Math.max(0, Math.min(1, 1 - left / total));
      ctx.strokeStyle = rgba(baseColor.r, baseColor.g, baseColor.b, 0.72);
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.arc(sx * dpr, sy * dpr, (iconSize * 0.78) * dpr, -Math.PI * 0.5, -Math.PI * 0.5 + ratio * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = rgba(190, 205, 225, 0.82);
      ctx.font = `${9.5 * dpr}px Segoe UI`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(left)}`, sx * dpr, sy * dpr);
    }

    const label = effect.label || effect.statusId || '';
    if (label) {
      ctx.font = `${10.5 * dpr}px Segoe UI`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = Math.max(46, ctx.measureText(label).width / dpr + 16);
      const bx = sx - w * 0.5;
      const by = sy - effect.radius - 20;
      ctx.fillStyle = 'rgba(5,8,13,0.88)';
      ctx.strokeStyle = rgba(color.r, color.g, color.b, 0.50);
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.roundRect(bx * dpr, by * dpr, w * dpr, 20 * dpr, 4 * dpr);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dormant ? rgba(150, 160, 176, 0.76) : rgba(232, 242, 255, 0.94);
      ctx.fillText(label, sx * dpr, (by + 10) * dpr);
    }
  }
}
