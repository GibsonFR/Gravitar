function worldToScreen(view, x, y, camX, camY) {
  return { x: (x - camX + view.cssW * 0.5) * view.dpr, y: (y - camY + view.cssH * 0.5) * view.dpr };
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

function drawLabel(ctx, view, text, x, y) {
  ctx.save();
  ctx.font = `${10 * view.dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12 * view.dpr;
  const h = 17 * view.dpr;
  ctx.fillStyle = 'rgba(4, 8, 14, .82)';
  ctx.strokeStyle = 'rgba(145, 220, 255, .24)';
  ctx.lineWidth = 1 * view.dpr;
  ctx.beginPath();
  roundRect(ctx, x - w * 0.5, y - h * 0.5, w, h, 6 * view.dpr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(230, 246, 255, .94)';
  ctx.fillText(text, x, y + 0.5 * view.dpr);
  ctx.restore();
}

export function drawLogisticDrone(ctx, view, drone, camX, camY, t = 0) {
  if (!drone) return;
  const p = worldToScreen(view, drone.x || 0, drone.y || 0, camX, camY);
  const r = Math.max(9, Number(drone.radius || 16)) * view.dpr;
  const tint = drone.tint || '#9edcff';
  const pulse = 0.5 + 0.5 * Math.sin(t * 8 + (drone.progress || 0) * 9);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = tint;
  ctx.shadowBlur = (7 + pulse * 8) * view.dpr;
  ctx.fillStyle = 'rgba(8, 18, 28, .86)';
  ctx.strokeStyle = tint;
  ctx.lineWidth = 1.6 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.88);
  ctx.lineTo(r * 0.82, -r * 0.18);
  ctx.lineTo(r * 0.48, r * 0.72);
  ctx.lineTo(0, r * 0.42);
  ctx.lineTo(-r * 0.48, r * 0.72);
  ctx.lineTo(-r * 0.82, -r * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(235, 250, 255, .72)';
  ctx.lineWidth = 1.2 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(-r * 0.44, -r * 0.06); ctx.lineTo(r * 0.44, -r * 0.06);
  ctx.moveTo(0, -r * 0.60); ctx.lineTo(0, r * 0.36);
  ctx.stroke();

  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.20 + pulse * 0.18;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  const label = `${drone.amount | 0} ${drone.resourceName || 'ressource'}`;
  drawLabel(ctx, view, label, p.x, p.y - r - 12 * view.dpr);
}
