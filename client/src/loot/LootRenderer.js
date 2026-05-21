import { rgba, worldToScreen } from '../core/Math.js';

export function drawLoot(ctx, view, loot, camX, camY) {
  const s = worldToScreen(camX, camY, loot.x, loot.y, view.cssW, view.cssH);
  const r = loot.radius || 6;

  ctx.save();
  if (loot.itemId || loot.bastionReward) {
    ctx.shadowColor = rgba(loot.color?.r ?? 255, loot.color?.g ?? 205, loot.color?.b ?? 98, 0.55);
    ctx.shadowBlur = 16 * view.dpr;
  }
  ctx.fillStyle = rgba(loot.color?.r ?? 169, loot.color?.g ?? 169, loot.color?.b ?? 169, 0.96);
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, r * view.dpr, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgba(255, 255, 255, 0.22);
  ctx.beginPath();
  ctx.arc((s.x - r * 0.28) * view.dpr, (s.y - r * 0.28) * view.dpr, (r * 0.34) * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  if (loot.itemId || loot.bastionReward) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(255, 245, 180, 0.9);
    ctx.lineWidth = 2 * view.dpr;
    ctx.strokeRect((s.x - r * 0.8) * view.dpr, (s.y - r * 0.55) * view.dpr, r * 1.6 * view.dpr, r * 1.1 * view.dpr);
    ctx.fillStyle = rgba(5, 8, 13, 0.72);
    ctx.fillRect((s.x - 48) * view.dpr, (s.y - r - 28) * view.dpr, 96 * view.dpr, 18 * view.dpr);
    ctx.strokeStyle = rgba(255, 220, 120, 0.35);
    ctx.strokeRect((s.x - 48) * view.dpr, (s.y - r - 28) * view.dpr, 96 * view.dpr, 18 * view.dpr);
    ctx.fillStyle = rgba(255, 235, 165, 0.96);
    ctx.font = `${10 * view.dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(loot.itemName || 'Coffre bastion', s.x * view.dpr, (s.y - r - 19) * view.dpr);
  }
  ctx.restore();
}

