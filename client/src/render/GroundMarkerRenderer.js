import { clamp, rgba, worldToScreen } from '../core/Math.js';
import { COLORS } from '../core/Colors.js';

export function drawGroundMarker(ctx, view, player, camX, camY, t) {
  if (!player || player.groundMarkerTimer <= 0) return;
  const s = worldToScreen(camX, camY, player.groundMarkerX, player.groundMarkerY, view.cssW, view.cssH);
  const alpha = clamp(player.groundMarkerTimer / 0.85, 0, 1);
  const pulse = 1 + 0.18 * Math.sin(t * 12);
  const r = 10 * pulse;
  ctx.strokeStyle = rgba(COLORS.fx.r, COLORS.fx.g, COLORS.fx.b, 0.75 * alpha);
  ctx.lineWidth = 2 * view.dpr;
  ctx.beginPath();
  ctx.arc(s.x * view.dpr, s.y * view.dpr, r * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((s.x - r - 5) * view.dpr, s.y * view.dpr);
  ctx.lineTo((s.x + r + 5) * view.dpr, s.y * view.dpr);
  ctx.moveTo(s.x * view.dpr, (s.y - r - 5) * view.dpr);
  ctx.lineTo(s.x * view.dpr, (s.y + r + 5) * view.dpr);
  ctx.stroke();
}
