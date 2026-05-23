function worldToScreen(view, x, y, camX, camY) {
  return {
    x: (x - camX + view.cssW * 0.5) * view.dpr,
    y: (y - camY + view.cssH * 0.5) * view.dpr
  };
}

function ownerPalette(s) {
  if (s.owned) {
    return {
      fill: 'rgba(64, 174, 219, 0.16)',
      edge: 'rgba(124, 232, 255, 0.82)',
      claimFill: 'rgba(68, 218, 190, 0.045)',
      claimEdge: 'rgba(104, 245, 215, 0.34)',
      grid: 'rgba(130, 255, 226, 0.09)'
    };
  }
  return {
    fill: 'rgba(196, 54, 66, 0.12)',
    edge: 'rgba(255, 96, 106, 0.78)',
    claimFill: 'rgba(255, 66, 82, 0.04)',
    claimEdge: 'rgba(255, 80, 94, 0.34)',
    grid: 'rgba(255, 98, 112, 0.08)'
  };
}

function drawStructureBar(ctx, view, s, sx, sy) {
  const hp = s.vitals?.hp ?? 0;
  const maxHp = Math.max(1, s.vitals?.maxHp ?? 1);
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const w = Math.max(46, Math.min(92, (s.w || s.radius * 2) * 0.5)) * view.dpr;
  const h = 4 * view.dpr;
  const x = sx - w * 0.5;
  const y = sy - ((s.h || s.radius * 2) * 0.5 + 14) * view.dpr;
  ctx.save();
  ctx.fillStyle = 'rgba(5,9,14,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pct > 0.45 ? 'rgba(114,235,194,0.9)' : pct > 0.18 ? 'rgba(255,204,96,0.92)' : 'rgba(255,104,104,0.95)';
  ctx.fillRect(x, y, w * pct, h);
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
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

function drawClaimSquare(ctx, view, s, camX, camY) {
  const half = Number(s.claimRadius) || 0;
  if (!half) return;
  const p = worldToScreen(view, s.x || 0, s.y || 0, camX, camY);
  const size = half * 2 * view.dpr;
  const pal = ownerPalette(s);
  ctx.save();
  ctx.fillStyle = pal.claimFill;
  ctx.strokeStyle = pal.claimEdge;
  ctx.lineWidth = 1.2 * view.dpr;
  ctx.setLineDash([16 * view.dpr, 12 * view.dpr]);
  ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  ctx.strokeRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBuildGrid(ctx, view, camX, camY, gridSize = 64) {
  const g = gridSize * view.dpr;
  const startX = (-((camX % gridSize) + gridSize) % gridSize + view.cssW * 0.5 % gridSize) * view.dpr;
  const startY = (-((camY % gridSize) + gridSize) % gridSize + view.cssH * 0.5 % gridSize) * view.dpr;
  ctx.save();
  ctx.strokeStyle = 'rgba(132, 226, 255, 0.105)';
  ctx.lineWidth = 1 * view.dpr;
  for (let x = startX - g * 2; x < view.w + g * 2; x += g) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, view.h);
    ctx.stroke();
  }
  for (let y = startY - g * 2; y < view.h + g * 2; y += g) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFootprintCells(ctx, view, w, h, tilesX, tilesY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1 * view.dpr;
  for (let i = 1; i < tilesX; i += 1) {
    const x = -w * 0.5 + (w / tilesX) * i;
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.5);
    ctx.lineTo(x, h * 0.5);
    ctx.stroke();
  }
  for (let i = 1; i < tilesY; i += 1) {
    const y = -h * 0.5 + (h / tilesY) * i;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, y);
    ctx.lineTo(w * 0.5, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStructure(ctx, view, s, camX, camY, t = 0) {
  if (!s) return;
  if (s.type === 'base_core') drawClaimSquare(ctx, view, s, camX, camY);
  const p = worldToScreen(view, s.x || 0, s.y || 0, camX, camY);
  const w = (s.w || s.radius * 2 || 80) * view.dpr;
  const h = (s.h || s.radius * 2 || 80) * view.dpr;
  const pal = ownerPalette(s);
  const edge = pal.edge;
  const fill = s.type === 'wall' ? (s.owned ? 'rgba(38, 55, 72, .74)' : 'rgba(72, 34, 40, .70)') : pal.fill;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = s.type === 'wall' ? 5 * view.dpr : 8 * view.dpr;
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = (s.owned ? 1.8 : 1.6) * view.dpr;

  if (s.type === 'base_core') {
    const rr = 18 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 3, 3);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1.4 * view.dpr;
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, 0);
    ctx.lineTo(w * 0.32, 0);
    ctx.moveTo(0, -h * 0.32);
    ctx.lineTo(0, h * 0.32);
    ctx.stroke();
  } else if (s.type === 'wall') {
    const rr = Math.min(9 * view.dpr, Math.min(w, h) * 0.24);
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, (w > h ? 3 : 1), (h > w ? 3 : 1));
  } else {
    const rr = 14 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 2, 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.owned ? 'rgba(145,255,220,.25)' : 'rgba(255,130,130,.25)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.18);
    ctx.lineTo(0, -h * 0.36);
    ctx.lineTo(w * 0.34, -h * 0.18);
    ctx.lineTo(w * 0.34, h * 0.22);
    ctx.lineTo(0, h * 0.40);
    ctx.lineTo(-w * 0.34, h * 0.22);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  drawStructureBar(ctx, view, s, p.x, p.y);
}

export function drawStructureBuildPreview(ctx, view, preview, camX, camY, t = 0) {
  if (!preview) return;
  drawBuildGrid(ctx, view, camX, camY, preview.gridSize || 64);
  const p = worldToScreen(view, preview.x || 0, preview.y || 0, camX, camY);
  const w = (preview.w || preview.radius * 2 || 80) * view.dpr;
  const h = (preview.h || preview.radius * 2 || 80) * view.dpr;
  const ok = !!preview.ok;
  const demolish = preview.mode === 'demolish';
  const main = demolish ? (ok ? 'rgba(255, 120, 120, 0.16)' : 'rgba(255, 92, 92, 0.08)') : (ok ? 'rgba(101, 241, 200, 0.22)' : 'rgba(255, 92, 92, 0.20)');
  const edge = demolish ? 'rgba(255, 124, 124, 0.95)' : (ok ? 'rgba(117, 255, 215, 0.92)' : 'rgba(255, 112, 112, 0.95)');
  const pulse = 0.55 + 0.45 * Math.sin(t * 5.2);

  const claim = preview.type === 'base_core'
    ? { x: preview.x, y: preview.y, half: preview.claimRadius || 0 }
    : preview.ownCore ? { x: preview.ownCore.x, y: preview.ownCore.y, half: preview.ownCore.claimRadius || 0 } : null;
  if (claim?.half) {
    const cp = worldToScreen(view, claim.x, claim.y, camX, camY);
    const size = claim.half * 2 * view.dpr;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(75, 244, 202, 0.045)' : 'rgba(255, 86, 86, 0.035)';
    ctx.strokeStyle = ok ? 'rgba(92, 255, 214, 0.34)' : 'rgba(255, 104, 104, 0.28)';
    ctx.lineWidth = 1.2 * view.dpr;
    ctx.setLineDash([18 * view.dpr, 12 * view.dpr]);
    ctx.fillRect(cp.x - size * 0.5, cp.y - size * 0.5, size, size);
    ctx.strokeRect(cp.x - size * 0.5, cp.y - size * 0.5, size, size);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = (demolish ? 4 : 6 + pulse * 7) * view.dpr;
  ctx.fillStyle = main;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * view.dpr;
  ctx.setLineDash([9 * view.dpr, 6 * view.dpr]);
  const rr = Math.min(14 * view.dpr, Math.min(w, h) * 0.24);
  ctx.beginPath();
  roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  drawFootprintCells(ctx, view, w, h, preview.tilesX || 1, preview.tilesY || 1);

  if (!ok) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 130, 130, 0.95)';
    ctx.lineWidth = 3 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, -h * 0.26);
    ctx.lineTo(w * 0.26, h * 0.26);
    ctx.moveTo(w * 0.26, -h * 0.26);
    ctx.lineTo(-w * 0.26, h * 0.26);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.font = `${11 * view.dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const label = preview.ok ? preview.title : (preview.reason || 'Impossible');
  const tw = ctx.measureText(label).width;
  const lx = p.x;
  const ly = p.y - h * 0.5 - 10 * view.dpr;
  ctx.fillStyle = 'rgba(4, 8, 13, 0.82)';
  ctx.fillRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.strokeStyle = preview.ok ? 'rgba(117,255,215,.42)' : 'rgba(255,112,112,.5)';
  ctx.strokeRect(lx - tw * 0.5 - 8 * view.dpr, ly - 15 * view.dpr, tw + 16 * view.dpr, 17 * view.dpr);
  ctx.fillStyle = preview.ok ? 'rgba(210, 255, 240, 0.94)' : 'rgba(255, 206, 206, 0.94)';
  ctx.fillText(label, lx, ly - 2 * view.dpr);
  ctx.restore();
}
