import { rgba, worldToScreen } from '../core/Math.js';

function ammoColor(p) {
  if (p.visualAmmoEffect === 'slow') return { r: 112, g: 190, b: 255 };
  if (p.visualAmmoEffect === 'burn') return { r: 255, g: 142, b: 72 };
  if (p.visualAmmoEffect === 'poison') return { r: 102, g: 225, b: 120 };
  if (p.visualAmmoEffect === 'stun') return { r: 255, g: 224, b: 122 };
  return p.tint ?? { r: 255, g: 176, b: 72 };
}

function drawRocket(ctx, view, p, s) {
  const dpr = view.dpr;
  const vlen = Math.hypot(p.vx || 0, p.vy || 0);
  const a = vlen > 0.01 ? Math.atan2(p.vy, p.vx) : 0;
  const c = ammoColor(p);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const body = Math.max(12, (p.radius || 6) * 2.25);
  const w = Math.max(5, (p.radius || 6) * 0.92);
  const x = s.x * dpr;
  const y = s.y * dpr;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);

  const pulse = 0.68 + 0.32 * Math.sin(performance.now() * 0.024 + p.id * 0.4);
  ctx.fillStyle = rgba(255, 190, 80, 0.22 * pulse);
  ctx.beginPath();
  ctx.ellipse(-body * 0.92 * dpr, 0, body * 0.72 * dpr, w * 0.86 * dpr, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgba(255, 122, 44, 0.58 * pulse);
  ctx.beginPath();
  ctx.moveTo(-body * 0.48 * dpr, 0);
  ctx.lineTo(-body * 1.28 * dpr, -w * 0.52 * dpr);
  ctx.lineTo(-body * 1.06 * dpr, 0);
  ctx.lineTo(-body * 1.28 * dpr, w * 0.52 * dpr);
  ctx.closePath();
  ctx.fill();

  const grad = ctx.createLinearGradient(-body * 0.55 * dpr, 0, body * 0.58 * dpr, 0);
  grad.addColorStop(0, rgba(c.r, c.g, c.b, 0.82));
  grad.addColorStop(0.45, rgba(235, 240, 244, 0.97));
  grad.addColorStop(1, rgba(255, 255, 255, 0.98));
  ctx.fillStyle = grad;
  ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.85);
  ctx.lineWidth = 1.4 * dpr;
  ctx.beginPath();
  ctx.moveTo(body * 0.62 * dpr, 0);
  ctx.lineTo(body * 0.28 * dpr, -w * 0.56 * dpr);
  ctx.lineTo(-body * 0.50 * dpr, -w * 0.50 * dpr);
  ctx.lineTo(-body * 0.66 * dpr, 0);
  ctx.lineTo(-body * 0.50 * dpr, w * 0.50 * dpr);
  ctx.lineTo(body * 0.28 * dpr, w * 0.56 * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.90);
  ctx.beginPath();
  ctx.arc(body * 0.20 * dpr, 0, Math.max(1.8, w * 0.28) * dpr, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (p.splashRadius > 0) {
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.12);
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, p.splashRadius * 0.18 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function abilityProjectileStyle(p) {
  const frame = p.sourceFrameId || '';
  const slot = p.visualSlot || p.sourceAbilitySlot || '';
  if (frame === 'vanguard' && slot === 'A') return { kind: 'needle', color: { r: 130, g: 225, b: 255 }, core: { r: 245, g: 255, b: 255 } };
  if (frame === 'sigil' && slot === 'A') return { kind: 'rune', color: { r: 197, g: 120, b: 255 }, core: { r: 248, g: 232, b: 255 } };
  if (frame === 'bulwark' && slot === 'Z') return { kind: 'harpoon', color: { r: 234, g: 190, b: 112 }, core: { r: 255, g: 240, b: 200 } };
  return { kind: 'orb', color: p.tint ?? { r: 130, g: 225, b: 255 }, core: { r: 245, g: 255, b: 255 } };
}

function drawAbilityProjectile(ctx, view, p, s) {
  const dpr = view.dpr;
  const style = abilityProjectileStyle(p);
  const c = style.color;
  const core = style.core;
  const r = Math.max(3.5, p.radius || 3.5);
  const x = s.x * dpr;
  const y = s.y * dpr;
  const vlen = Math.hypot(p.vx || 0, p.vy || 0);
  const a = vlen > 0.01 ? Math.atan2(p.vy, p.vx) : 0;
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.018 + p.id);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);

  if (style.kind === 'needle') {
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.13 * pulse);
    ctx.beginPath();
    ctx.ellipse(-r * 2.2 * dpr, 0, r * 5.6 * dpr, r * 1.55 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(-r * 2.6 * dpr, 0, r * 3.2 * dpr, 0);
    grad.addColorStop(0, rgba(c.r, c.g, c.b, 0.12));
    grad.addColorStop(0.45, rgba(c.r, c.g, c.b, 0.88));
    grad.addColorStop(1, rgba(core.r, core.g, core.b, 0.98));
    ctx.fillStyle = grad;
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.86);
    ctx.lineWidth = 1.45 * dpr;
    ctx.beginPath();
    ctx.moveTo(r * 3.8 * dpr, 0);
    ctx.lineTo(-r * 2.2 * dpr, -r * 0.72 * dpr);
    ctx.lineTo(-r * 3.4 * dpr, 0);
    ctx.lineTo(-r * 2.2 * dpr, r * 0.72 * dpr);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }

  if (style.kind === 'rune') {
    ctx.rotate(performance.now() * 0.004 + p.id * 0.02);
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.13 * pulse);
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.90);
    ctx.lineWidth = 1.7 * dpr;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const aa = -Math.PI / 2 + i * Math.PI / 3;
      const px = Math.cos(aa) * r * 1.75 * dpr;
      const py = Math.sin(aa) * r * 1.75 * dpr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = rgba(core.r, core.g, core.b, 0.96);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (style.kind === 'harpoon') {
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.12 * pulse);
    ctx.beginPath();
    ctx.ellipse(-r * 2.4 * dpr, 0, r * 5.8 * dpr, r * 1.7 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.84);
    ctx.fillStyle = rgba(core.r, core.g, core.b, 0.95);
    ctx.lineWidth = 1.6 * dpr;
    ctx.beginPath();
    ctx.moveTo(r * 3.2 * dpr, 0);
    ctx.lineTo(r * 0.8 * dpr, -r * 1.0 * dpr);
    ctx.lineTo(r * 1.25 * dpr, -r * 0.25 * dpr);
    ctx.lineTo(-r * 3.4 * dpr, -r * 0.25 * dpr);
    ctx.lineTo(-r * 3.4 * dpr, r * 0.25 * dpr);
    ctx.lineTo(r * 1.25 * dpr, r * 0.25 * dpr);
    ctx.lineTo(r * 0.8 * dpr, r * 1.0 * dpr);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.restore();
  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.16 * pulse);
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.88);
  ctx.lineWidth = 1.8 * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.55 * dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(core.r, core.g, core.b, 0.96);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82 * dpr, 0, Math.PI * 2);
  ctx.fill();
}

export function drawProjectile(ctx, view, p, camX, camY) {
  const s = worldToScreen(camX, camY, p.x, p.y, view.cssW, view.cssH);
  if (p.visualKind === 'rocket') {
    drawRocket(ctx, view, p, s);
    return;
  }
  if (p.visualKind === 'ability' || p.sourceAbilitySlot) {
    drawAbilityProjectile(ctx, view, p, s);
    return;
  }
  const mobShot = p.sourceKind === 'mob' || String(p.visualKind || '').startsWith('mob_');
  const c = p.empoweredAutoUsed ? { r: 255, g: 210, b: 92 } : (p.ultAutoUsed ? { r: 255, g: 116, b: 238 } : (p.tint ?? { r: 130, g: 225, b: 255 }));
  if (p.empoweredAutoUsed || p.ultAutoUsed) {
    ctx.fillStyle = rgba(c.r, c.g, c.b, 0.16);
    ctx.beginPath();
    ctx.arc(s.x * view.dpr, s.y * view.dpr, (p.radius + 11) * view.dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = rgba(c.r, c.g, c.b, p.crit ? 1 : 0.95);
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, (p.radius * (mobShot ? 0.82 : 1) * (p.crit ? 1.35 : 1)) * view.dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, mobShot ? 0.18 : ((p.crit || p.empoweredAutoUsed || p.ultAutoUsed) ? 0.72 : 0.26));
  ctx.lineWidth = ((p.crit || p.empoweredAutoUsed || p.ultAutoUsed) ? 2 : 1) * view.dpr;
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, (p.radius + (mobShot ? 2.5 : (p.crit ? 8 : 5))) * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
}
