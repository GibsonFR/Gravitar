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

function drawAbilityProjectile(ctx, view, p, s) {
  const dpr = view.dpr;
  const c = p.tint ?? { r: 130, g: 225, b: 255 };
  const r = Math.max(3.5, p.radius || 3.5);
  const x = s.x * dpr;
  const y = s.y * dpr;
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.018 + p.id);
  ctx.fillStyle = rgba(c.r, c.g, c.b, 0.16 * pulse);
  ctx.beginPath();
  ctx.arc(x, y, r * 3.2 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.r, c.g, c.b, 0.88);
  ctx.lineWidth = 1.8 * dpr;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.55 * dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(245, 255, 255, 0.96);
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
