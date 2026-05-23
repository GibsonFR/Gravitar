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

export function drawStructureBuildPreview(ctx, view, preview, camX, camY, t = 0) {
  if (!preview) return;
  const p = worldToScreen(view, preview.x || 0, preview.y || 0, camX, camY);
  const w = (preview.w || preview.radius * 2 || 80) * view.dpr;
  const h = (preview.h || preview.radius * 2 || 80) * view.dpr;
  const ok = !!preview.ok;
  const main = ok ? 'rgba(101, 241, 200, 0.28)' : 'rgba(255, 92, 92, 0.24)';
  const edge = ok ? 'rgba(117, 255, 215, 0.92)' : 'rgba(255, 112, 112, 0.95)';
  const pulse = 0.55 + 0.45 * Math.sin(t * 5.2);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = (8 + pulse * 8) * view.dpr;
  ctx.fillStyle = main;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * view.dpr;
  ctx.setLineDash([10 * view.dpr, 7 * view.dpr]);
  const rr = Math.min(16 * view.dpr, Math.min(w, h) * 0.28);
  ctx.beginPath();
  ctx.roundRect(-w * 0.5, -h * 0.5, w, h, rr);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  if (preview.type === 'base_core' && preview.claimRadius) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ok ? 'rgba(117, 255, 215, 0.22)' : 'rgba(255, 112, 112, 0.16)';
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.setLineDash([16 * view.dpr, 14 * view.dpr]);
    ctx.beginPath();
    ctx.arc(0, 0, (preview.claimRadius || 0) * view.dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (!ok) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 130, 130, 0.95)';
    ctx.lineWidth = 3 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -h * 0.28);
    ctx.lineTo(w * 0.28, h * 0.28);
    ctx.moveTo(w * 0.28, -h * 0.28);
    ctx.lineTo(-w * 0.28, h * 0.28);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.font = `${11 * view.dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const label = preview.ok ? preview.title : (preview.reason || 'Placement impossible');
  const tw = ctx.measureText(label).width;
  const lx = p.x;
  const ly = p.y - h * 0.5 - 12 * view.dpr;
  ctx.fillStyle = 'rgba(4, 8, 13, 0.84)';
  ctx.fillRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.strokeStyle = preview.ok ? 'rgba(117,255,215,.46)' : 'rgba(255,112,112,.5)';
  ctx.strokeRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.fillStyle = preview.ok ? 'rgba(210, 255, 240, 0.94)' : 'rgba(255, 206, 206, 0.94)';
  ctx.fillText(label, lx, ly - 2 * view.dpr);
  ctx.restore();
}
