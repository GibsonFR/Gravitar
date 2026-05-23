function worldToScreen(view, x, y, camX, camY) {
  return {
    x: (x - camX + view.cssW * 0.5) * view.dpr,
    y: (y - camY + view.cssH * 0.5) * view.dpr
  };
}

function drawStructureBar(ctx, view, s, sx, sy) {
  const hp = s.vitals?.hp ?? 0;
  const maxHp = Math.max(1, s.vitals?.maxHp ?? 1);
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const w = Math.max(46, Math.min(92, (s.w || s.radius * 2) * 0.55)) * view.dpr;
  const h = 5 * view.dpr;
  const x = sx - w * 0.5;
  const y = sy - ((s.h || s.radius * 2) * 0.5 + 20) * view.dpr;
  ctx.save();
  ctx.fillStyle = 'rgba(5,9,14,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.45 ? 'rgba(114,235,194,0.9)' : pct > 0.18 ? 'rgba(255,204,96,0.92)' : 'rgba(255,104,104,0.95)';
  ctx.fillRect(x, y, w * pct, h);
  ctx.strokeStyle = 'rgba(220,240,255,0.35)';
  ctx.lineWidth = 1 * view.dpr;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function drawStructure(ctx, view, s, camX, camY, t = 0) {
  if (!s) return;
  const p = worldToScreen(view, s.x || 0, s.y || 0, camX, camY);
  const w = (s.w || s.radius * 2 || 80) * view.dpr;
  const h = (s.h || s.radius * 2 || 80) * view.dpr;
  const color = s.color || '#526274';
  const border = s.borderColor || '#9fcfff';
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = border;
  ctx.shadowBlur = s.owned ? 10 * view.dpr : 5 * view.dpr;
  ctx.fillStyle = color;
  ctx.strokeStyle = border;
  ctx.lineWidth = (s.owned ? 2.2 : 1.4) * view.dpr;

  if (s.type === 'base_core') {
    const r = (s.radius || 54) * view.dpr;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(168,231,255,${0.25 + pulse * 0.2})`;
    ctx.setLineDash([8 * view.dpr, 7 * view.dpr]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(6,12,18,0.62)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === 'wall') {
    const rr = Math.min(14 * view.dpr, Math.min(w, h) * 0.28);
    ctx.beginPath();
    ctx.roundRect(-w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([12 * view.dpr, 8 * view.dpr]);
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, -h * 0.18);
    ctx.lineTo(w * 0.42, h * 0.18);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const rr = 16 * view.dpr;
    ctx.beginPath();
    ctx.roundRect(-w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeRect(-w * 0.25, -h * 0.25, w * 0.5, h * 0.5);
  }
  ctx.restore();
  drawStructureBar(ctx, view, s, p.x, p.y);
}
