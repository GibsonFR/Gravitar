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


function dirOf(s) {
  const o = String(s?.orientation || 'h').toLowerCase();
  if (o === 'v' || o === 'd') return { x: 0, y: 1, label: 'bas' };
  if (o === 'u') return { x: 0, y: -1, label: 'haut' };
  if (o === 'l') return { x: -1, y: 0, label: 'gauche' };
  return { x: 1, y: 0, label: 'droite' };
}

function rotateToDir(ctx, s) {
  const d = dirOf(s);
  const angle = d.x > 0 ? 0 : d.y > 0 ? Math.PI / 2 : d.x < 0 ? Math.PI : -Math.PI / 2;
  ctx.rotate(angle);
}

function smoothstep01(v) {
  const x = Math.max(0, Math.min(1, Number(v) || 0));
  return x * x * (3 - 2 * x);
}

function localAutomationProgress(preview) {
  if (!preview || typeof preview !== 'object') return null;
  const totalMs = Math.max(1, Number(preview.totalMs) || 0);
  const localStartedAt = Number(preview._localStartedAt);
  if (Number.isFinite(localStartedAt) && totalMs > 0) {
    return Math.max(0, Math.min(1, (performance.now() - localStartedAt) / totalMs));
  }
  const startedAt = Number(preview.startedAt);
  if (Number.isFinite(startedAt) && totalMs > 0) {
    return Math.max(0, Math.min(1, (Date.now() - startedAt) / totalMs));
  }
  if (Number.isFinite(Number(preview.progress))) return Math.max(0, Math.min(1, Number(preview.progress)));
  return null;
}

function drawResourceChip(ctx, view, color, x, y, radius, dir, amount = 1) {
  const angle = dir.x > 0 ? 0 : dir.y > 0 ? Math.PI / 2 : dir.x < 0 ? Math.PI : -Math.PI / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 * view.dpr;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,.78)';
  ctx.lineWidth = 1 * view.dpr;
  ctx.beginPath();
  ctx.moveTo(radius * 1.35, 0);
  ctx.lineTo(radius * 0.22, radius * 0.95);
  ctx.lineTo(-radius * 1.05, radius * 0.62);
  ctx.lineTo(-radius * 1.05, -radius * 0.62);
  ctx.lineTo(radius * 0.22, -radius * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(15,25,35,.38)';
  ctx.beginPath();
  ctx.moveTo(-radius * 0.58, 0);
  ctx.lineTo(radius * 0.55, 0);
  ctx.stroke();
  ctx.restore();

  if (amount > 1) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = `${8 * view.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.fillText(String(amount), x, y - radius * 1.65);
    ctx.restore();
  }
}

function drawAutomationItem(ctx, view, s, w, h, t) {
  const preview = s.automationItem || s.storagePreview || null;
  const used = Number(s.storageUsed || 0);
  if (!preview && used <= 0) return;
  const color = preview?.colorHex || 'rgba(230,245,255,.95)';
  const dir = dirOf(s);
  const rawProgress = localAutomationProgress(preview);
  const progress = rawProgress == null
    ? (s.automationItem ? Math.max(0, Math.min(1, (performance.now() - Number(s.automationPulse || 0)) / 700)) : (0.5 + 0.35 * Math.sin(t * 3.0)))
    : rawProgress;
  const blocked = preview?.phase === 'blocked' || preview?.phase === 'arm_blocked';
  let phase = blocked ? 1 : progress;
  if (preview?.phase === 'arm') phase = smoothstep01(progress);
  const travel = preview?.phase === 'arm' || preview?.phase === 'arm_blocked' ? 0.88 : 0.74;
  const px = dir.x * (phase - 0.5) * w * travel;
  const py = dir.y * (phase - 0.5) * h * travel;
  drawResourceChip(ctx, view, color, px, py, Math.max(4, Math.min(w, h) * 0.10), dir, preview?.amount | 0 || 1);
  if (blocked) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,120,120,.95)';
    ctx.lineWidth = 2 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(px - 6 * view.dpr, py - 6 * view.dpr);
    ctx.lineTo(px + 6 * view.dpr, py + 6 * view.dpr);
    ctx.moveTo(px + 6 * view.dpr, py - 6 * view.dpr);
    ctx.lineTo(px - 6 * view.dpr, py + 6 * view.dpr);
    ctx.stroke();
    ctx.restore();
  }
}

function drawConveyorMotion(ctx, view, s, w, h, t) {
  ctx.save();
  rotateToDir(ctx, s);
  ctx.strokeStyle = 'rgba(145,230,255,.42)';
  ctx.lineWidth = 2 * view.dpr;
  ctx.lineCap = 'round';
  const span = w * 0.22;
  const offset = ((t * 70 * view.dpr) % span) - span;
  for (let x = -w * 0.42 + offset; x < w * 0.48; x += span) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.035, -h * 0.11);
    ctx.lineTo(x + w * 0.045, 0);
    ctx.lineTo(x - w * 0.035, h * 0.11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRobotArmMotion(ctx, view, s, w, h) {
  const preview = s.automationItem || null;
  const p = preview ? localAutomationProgress(preview) : null;
  const phase = preview?.phase === 'arm' ? smoothstep01(p ?? 0) : (preview?.phase === 'arm_blocked' ? 1 : 0.5);
  ctx.save();
  rotateToDir(ctx, s);
  ctx.strokeStyle = 'rgba(255,220,145,.54)';
  ctx.fillStyle = 'rgba(255,220,145,.20)';
  ctx.lineWidth = 3 * view.dpr;
  ctx.lineCap = 'round';
  const clawX = (phase - 0.5) * w * 0.78;
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, h) * 0.11, 0, Math.PI * 2);
  ctx.moveTo(0, 0);
  ctx.lineTo(clawX, 0);
  ctx.moveTo(clawX, 0);
  ctx.lineTo(clawX - w * 0.055, -h * 0.075);
  ctx.moveTo(clawX, 0);
  ctx.lineTo(clawX - w * 0.055, h * 0.075);
  ctx.stroke();
  ctx.restore();
}

function drawDirectionArrow(ctx, view, s, w, h, label = false) {
  const d = dirOf(s);
  const len = Math.min(w, h) * 0.34;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,245,170,.95)';
  ctx.fillStyle = 'rgba(255,245,170,.95)';
  ctx.lineWidth = 2.4 * view.dpr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-d.x * len * 0.45, -d.y * len * 0.45);
  ctx.lineTo(d.x * len * 0.55, d.y * len * 0.55);
  ctx.stroke();
  ctx.beginPath();
  const hx = d.x * len * 0.60;
  const hy = d.y * len * 0.60;
  const px = -d.y;
  const py = d.x;
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - d.x * 10 * view.dpr + px * 6 * view.dpr, hy - d.y * 10 * view.dpr + py * 6 * view.dpr);
  ctx.lineTo(hx - d.x * 10 * view.dpr - px * 6 * view.dpr, hy - d.y * 10 * view.dpr - py * 6 * view.dpr);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = `${9 * view.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.label, 0, Math.min(w, h) * 0.36);
  }
  ctx.restore();
}

function drawStructureBar(ctx, view, s, sx, sy) {
  if (!s?.damageable || !s.vitals) return;
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
  const machineTypes = new Set(['furnace', 'high_temp_furnace', 'chemical_refinery', 'electrolyzer', 'electronics_bench', 'industrial_press']);
  const fill = (s.type === 'wall' || s.type === 'door')
    ? (s.owned ? 'rgba(38, 55, 72, .74)' : 'rgba(72, 34, 40, .70)')
    : machineTypes.has(s.type)
      ? (s.owned ? 'rgba(42, 54, 64, .34)' : 'rgba(74, 36, 44, .30)')
      : pal.fill;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = edge;
  ctx.shadowBlur = (s.type === 'wall' || s.type === 'door') ? 5 * view.dpr : 8 * view.dpr;
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = (s.owned ? 1.8 : 1.6) * view.dpr;

  if (s.type === 'base_core') {
    const rr = 18 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 2, 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.owned ? 'rgba(176,246,255,.34)' : 'rgba(255,150,150,.32)';
    ctx.lineWidth = 1.6 * view.dpr;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.36);
    ctx.lineTo(w * 0.32, -h * 0.16);
    ctx.lineTo(w * 0.32, h * 0.18);
    ctx.lineTo(0, h * 0.38);
    ctx.lineTo(-w * 0.32, h * 0.18);
    ctx.lineTo(-w * 0.32, -h * 0.16);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = s.owned ? 'rgba(126,232,255,.18)' : 'rgba(255,120,130,.15)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === 'wall' || s.type === 'door') {
    const rr = Math.min(9 * view.dpr, Math.min(w, h) * 0.24);
    ctx.globalAlpha = s.type === 'door' && s.open ? 0.46 : 1;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, (w > h ? 3 : 1), (h > w ? 3 : 1));
    if (s.type === 'door') {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = s.open ? 'rgba(120,255,210,.75)' : 'rgba(160,220,255,.56)';
      ctx.lineWidth = 2 * view.dpr;
      ctx.beginPath();
      if (w >= h) {
        ctx.moveTo(-w * 0.34, 0); ctx.lineTo(w * 0.34, 0);
        ctx.moveTo(w * 0.18, -h * 0.18); ctx.lineTo(w * 0.34, 0); ctx.lineTo(w * 0.18, h * 0.18);
      } else {
        ctx.moveTo(0, -h * 0.34); ctx.lineTo(0, h * 0.34);
        ctx.moveTo(-w * 0.18, h * 0.18); ctx.lineTo(0, h * 0.34); ctx.lineTo(w * 0.18, h * 0.18);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    const rr = 14 * view.dpr;
    ctx.beginPath();
    roundedRect(ctx, -w * 0.5, -h * 0.5, w, h, rr);
    ctx.fill();
    ctx.stroke();
    drawFootprintCells(ctx, view, w, h, 2, 2);
    ctx.shadowBlur = 0;
    const isEquip = s.type === 'equipment_storage';
    const isAmmo = s.type === 'ammo_storage';
    const isSolar = s.type === 'solar_panel';
    const isGenerator = s.type === 'fuel_generator';
    const isFuelTank = s.type === 'fuel_tank';
    const isFurnace = s.type === 'furnace';
    const isHighFurnace = s.type === 'high_temp_furnace';
    const isChem = s.type === 'chemical_refinery';
    const isElectro = s.type === 'electrolyzer';
    const isElectronics = s.type === 'electronics_bench';
    const isPress = s.type === 'industrial_press';
    const isConveyor = s.type === 'conveyor';
    const isRobotArm = s.type === 'robot_arm';
    ctx.strokeStyle = isHighFurnace ? 'rgba(255,118,92,.74)'
      : isFurnace ? 'rgba(255,178,94,.72)'
      : isChem ? 'rgba(150,235,130,.68)'
      : isElectro ? 'rgba(120,220,255,.72)'
      : isElectronics ? 'rgba(145,176,255,.72)'
      : isPress ? 'rgba(220,232,242,.70)'
      : isConveyor ? 'rgba(110,215,255,.72)'
      : isRobotArm ? 'rgba(255,210,123,.72)'
      : isSolar ? 'rgba(210,255,150,.62)'
      : isGenerator ? 'rgba(255,185,96,.64)'
      : isFuelTank ? 'rgba(255,200,118,.56)'
      : isAmmo ? 'rgba(255,197,112,.58)'
      : isEquip ? 'rgba(150,185,255,.58)'
      : (s.owned ? 'rgba(145,255,220,.32)' : 'rgba(255,130,130,.30)');
    ctx.lineWidth = 1.5 * view.dpr;
    ctx.beginPath();
    if (isConveyor) {
      ctx.save();
      rotateToDir(ctx, s);
      ctx.rect(-w * 0.38, -h * 0.22, w * 0.76, h * 0.44);
      ctx.moveTo(-w * 0.26, 0); ctx.lineTo(w * 0.24, 0);
      ctx.moveTo(w * 0.24, 0); ctx.lineTo(w * 0.08, -h * 0.13);
      ctx.moveTo(w * 0.24, 0); ctx.lineTo(w * 0.08, h * 0.13);
      ctx.moveTo(-w * 0.30, h * 0.30); ctx.arc(-w * 0.30, h * 0.30, w * 0.035, 0, Math.PI * 2);
      ctx.moveTo(0, h * 0.30); ctx.arc(0, h * 0.30, w * 0.035, 0, Math.PI * 2);
      ctx.moveTo(w * 0.30, h * 0.30); ctx.arc(w * 0.30, h * 0.30, w * 0.035, 0, Math.PI * 2);
      ctx.restore();
    } else if (isRobotArm) {
      ctx.save();
      rotateToDir(ctx, s);
      ctx.arc(0, 0, Math.min(w, h) * 0.16, 0, Math.PI * 2);
      ctx.moveTo(-w * 0.34, 0); ctx.lineTo(w * 0.28, 0);
      ctx.moveTo(w * 0.28, 0); ctx.lineTo(w * 0.14, -h * 0.11);
      ctx.moveTo(w * 0.28, 0); ctx.lineTo(w * 0.14, h * 0.11);
      ctx.moveTo(-w * 0.30, -h * 0.30); ctx.lineTo(-w * 0.16, -h * 0.16);
      ctx.moveTo(w * 0.30, h * 0.30); ctx.lineTo(w * 0.16, h * 0.16);
      ctx.restore();
    } else if (isSolar) {
      for (let i = -1; i <= 1; i += 1) {
        const x = i * w * 0.18;
        ctx.moveTo(x, -h * 0.32); ctx.lineTo(x, h * 0.32);
      }
      ctx.moveTo(-w * 0.33, 0); ctx.lineTo(w * 0.33, 0);
      ctx.moveTo(-w * 0.22, -h * 0.42); ctx.lineTo(-w * 0.30, -h * 0.52);
      ctx.moveTo(0, -h * 0.45); ctx.lineTo(0, -h * 0.56);
      ctx.moveTo(w * 0.22, -h * 0.42); ctx.lineTo(w * 0.30, -h * 0.52);
    } else if (isGenerator) {
      ctx.arc(0, 0, Math.min(w, h) * 0.24, 0, Math.PI * 2);
      ctx.moveTo(-w * 0.22, h * 0.30); ctx.lineTo(w * 0.22, h * 0.30);
      ctx.moveTo(-w * 0.18, -h * 0.12); ctx.quadraticCurveTo(0, -h * 0.34, w * 0.18, -h * 0.12);
      ctx.moveTo(-w * 0.14, h * 0.10); ctx.quadraticCurveTo(0, -h * 0.02, w * 0.14, h * 0.10);
    } else if (isFuelTank) {
      ctx.rect(-w * 0.28, -h * 0.30, w * 0.56, h * 0.60);
      ctx.moveTo(-w * 0.20, -h * 0.06); ctx.lineTo(w * 0.20, -h * 0.06);
      ctx.moveTo(-w * 0.20, h * 0.10); ctx.lineTo(w * 0.20, h * 0.10);
    } else if (isEquip) {
      ctx.rect(-w * 0.28, -h * 0.28, w * 0.56, h * 0.56);
      ctx.moveTo(-w * 0.18, -h * 0.10); ctx.lineTo(w * 0.18, -h * 0.10);
      ctx.moveTo(-w * 0.18, h * 0.04); ctx.lineTo(w * 0.18, h * 0.04);
      ctx.moveTo(-w * 0.18, h * 0.18); ctx.lineTo(w * 0.04, h * 0.18);
    } else if (isAmmo) {
      ctx.moveTo(-w * 0.24, h * 0.24);
      ctx.lineTo(0, -h * 0.30);
      ctx.lineTo(w * 0.24, h * 0.24);
      ctx.moveTo(-w * 0.12, 0);
      ctx.lineTo(w * 0.12, 0);
      ctx.moveTo(-w * 0.30, h * 0.34);
      ctx.lineTo(w * 0.30, h * 0.34);
    } else if (isFurnace || isHighFurnace) {
      ctx.rect(-w * 0.32, -h * 0.22, w * 0.64, h * 0.46);
      ctx.moveTo(-w * 0.26, h * 0.24); ctx.lineTo(w * 0.26, h * 0.24);
      ctx.moveTo(-w * 0.16, -h * 0.02);
      ctx.quadraticCurveTo(0, -h * (isHighFurnace ? 0.34 : 0.25), w * 0.16, -h * 0.02);
      ctx.quadraticCurveTo(w * 0.05, h * 0.18, -w * 0.16, -h * 0.02);
      if (isHighFurnace) {
        ctx.moveTo(-w * 0.30, -h * 0.34); ctx.lineTo(w * 0.30, -h * 0.34);
        ctx.moveTo(-w * 0.24, -h * 0.42); ctx.lineTo(w * 0.24, -h * 0.42);
      }
    } else if (isChem) {
      ctx.moveTo(-w * 0.24, h * 0.28); ctx.lineTo(-w * 0.08, -h * 0.30);
      ctx.lineTo(w * 0.08, -h * 0.30); ctx.lineTo(w * 0.24, h * 0.28); ctx.closePath();
      ctx.moveTo(-w * 0.18, h * 0.05); ctx.lineTo(w * 0.18, h * 0.05);
      ctx.moveTo(w * 0.30, -h * 0.20); ctx.arc(w * 0.30, -h * 0.20, w * 0.035, 0, Math.PI * 2);
      ctx.moveTo(w * 0.24, -h * 0.34); ctx.arc(w * 0.24, -h * 0.34, w * 0.026, 0, Math.PI * 2);
    } else if (isElectro) {
      ctx.moveTo(-w * 0.28, -h * 0.22); ctx.lineTo(w * 0.28, -h * 0.22);
      ctx.moveTo(-w * 0.28, h * 0.22); ctx.lineTo(w * 0.28, h * 0.22);
      ctx.moveTo(-w * 0.10, -h * 0.34); ctx.lineTo(-w * 0.02, -h * 0.02); ctx.lineTo(-w * 0.14, -h * 0.02); ctx.lineTo(w * 0.08, h * 0.34);
      ctx.moveTo(w * 0.18, -h * 0.10); ctx.arc(w * 0.18, -h * 0.10, w * 0.05, 0, Math.PI * 2);
      ctx.moveTo(w * 0.28, h * 0.08); ctx.arc(w * 0.28, h * 0.08, w * 0.035, 0, Math.PI * 2);
    } else if (isElectronics) {
      ctx.rect(-w * 0.30, -h * 0.26, w * 0.60, h * 0.52);
      for (let i = -1; i <= 1; i += 1) {
        const x = i * w * 0.13;
        ctx.moveTo(x, -h * 0.26); ctx.lineTo(x, h * 0.26);
        ctx.moveTo(-w * 0.30, x * 0.65); ctx.lineTo(w * 0.30, x * 0.65);
      }
      ctx.moveTo(0, 0); ctx.arc(0, 0, w * 0.07, 0, Math.PI * 2);
    } else if (isPress) {
      ctx.rect(-w * 0.30, -h * 0.34, w * 0.60, h * 0.18);
      ctx.rect(-w * 0.24, h * 0.16, w * 0.48, h * 0.16);
      ctx.moveTo(0, -h * 0.16); ctx.lineTo(0, h * 0.16);
      ctx.moveTo(-w * 0.18, -h * 0.02); ctx.lineTo(w * 0.18, -h * 0.02);
    } else {
      ctx.moveTo(-w * 0.34, -h * 0.22);
      ctx.lineTo(0, -h * 0.40);
      ctx.lineTo(w * 0.34, -h * 0.22);
      ctx.lineTo(w * 0.34, h * 0.24);
      ctx.lineTo(0, h * 0.42);
      ctx.lineTo(-w * 0.34, h * 0.24);
      ctx.closePath();
      ctx.moveTo(-w * 0.34, -h * 0.22);
      ctx.lineTo(0, 0);
      ctx.lineTo(w * 0.34, -h * 0.22);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, h * 0.42);
    }
    ctx.stroke();
    if (isConveyor) drawConveyorMotion(ctx, view, s, w, h, t);
    if (isRobotArm) drawRobotArmMotion(ctx, view, s, w, h);
    if (isConveyor || isRobotArm) {
      drawAutomationItem(ctx, view, s, w, h, t);
      drawDirectionArrow(ctx, view, s, w, h, false);
    }
  }
  ctx.restore();
  drawStructureBar(ctx, view, s, p.x, p.y);
  if (s.energy && (s.type === 'base_core' || s.type === 'solar_panel' || s.type === 'fuel_generator')) {
    const label = s.type === 'base_core'
      ? `${Math.round(Number(s.energy.production) || 0)} / ${Math.round(Number(s.energy.consumption) || 0)} ⚡`
      : `${Math.round(Number(s.energy.output) || 0)} ⚡`;
    ctx.save();
    ctx.font = `${10 * view.dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(225,245,255,.82)';
    ctx.fillText(label, p.x, p.y + ((s.h || s.radius * 2 || 80) * 0.5 + 18) * view.dpr);
    ctx.restore();
  }
}

export function drawStructureBuildPreview(ctx, view, preview, camX, camY, t = 0) {
  if (!preview) return;
  drawBuildGrid(ctx, view, camX, camY, preview.gridSize || 64);
  const p = worldToScreen(view, preview.x || 0, preview.y || 0, camX, camY);
  const w = (preview.w || preview.radius * 2 || 80) * view.dpr;
  const h = (preview.h || preview.radius * 2 || 80) * view.dpr;
  const ok = !!preview.ok;
  const demolish = preview.mode === 'demolish';
  const repair = preview.mode === 'repair';
  const main = demolish
    ? (ok ? 'rgba(255, 120, 120, 0.16)' : 'rgba(255, 92, 92, 0.08)')
    : repair
      ? (ok ? 'rgba(255, 210, 94, 0.18)' : 'rgba(255, 92, 92, 0.08)')
      : (ok ? 'rgba(101, 241, 200, 0.22)' : 'rgba(255, 92, 92, 0.20)');
  const edge = demolish
    ? 'rgba(255, 124, 124, 0.95)'
    : repair
      ? (ok ? 'rgba(255, 218, 112, 0.95)' : 'rgba(255, 112, 112, 0.95)')
      : (ok ? 'rgba(117, 255, 215, 0.92)' : 'rgba(255, 112, 112, 0.95)');
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
  ctx.shadowBlur = (demolish || repair ? 4 : 6 + pulse * 7) * view.dpr;
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
  if (preview.type === 'conveyor' || preview.type === 'robot_arm') {
    drawDirectionArrow(ctx, view, preview, w, h, true);
  }

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
