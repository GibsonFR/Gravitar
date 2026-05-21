import { worldToScreen, rgba } from '../core/Math.js';

function portalPalette(p) {
  if (p.mode === 'test_arena') return { a: { r: 255, g: 204, b: 92 }, b: { r: 98, g: 232, b: 255 }, label: 'Simulateur' };
  if (p.mode === 'bastion_entry' || p.mode === 'bastion_exit' || p.mode === 'bastion_locator') {
    const c = p.bastionColor || { r: 250, g: 214, b: 120 };
    return { a: c, b: { r: 255, g: 245, b: 180 }, label: p.label || 'Bastion' };
  }
  return { a: { r: 140, g: 210, b: 255 }, b: { r: 198, g: 128, b: 255 }, label: p.label || `[${p.targetSx},${p.targetSy}]` };
}

export function drawPortals(ctx, view, store, camX, camY) {
  const t = performance.now() / 1000;
  for (const p of store.portals.values()) {
    const s = worldToScreen(camX, camY, p.x, p.y, view.cssW, view.cssH);
    const r = (p.radius ?? 38);
    const pal = portalPalette(p);
    const dpr = view.dpr;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + p.id * 0.11);

    ctx.save();
    ctx.translate(s.x * dpr, s.y * dpr);
    ctx.rotate(t * (p.mode === 'test_arena' ? 0.62 : 0.38));

    ctx.strokeStyle = rgba(pal.b.r, pal.b.g, pal.b.b, 0.14 + 0.12 * pulse);
    ctx.lineWidth = 13 * dpr;
    ctx.beginPath();
    ctx.arc(0, 0, (r + 7) * dpr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([10 * dpr, 8 * dpr]);
    ctx.strokeStyle = rgba(pal.a.r, pal.a.g, pal.a.b, 0.70);
    ctx.lineWidth = 2.4 * dpr;
    ctx.beginPath();
    ctx.arc(0, 0, r * dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(-t * 1.18);
    ctx.strokeStyle = rgba(pal.b.r, pal.b.g, pal.b.b, 0.45 + 0.28 * pulse);
    ctx.lineWidth = 2 * dpr;
    for (let i = 0; i < 4; i += 1) {
      const a = i * Math.PI * 0.5 + t * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, (r - 8) * dpr, a, a + 0.55);
      ctx.stroke();
    }

    ctx.fillStyle = rgba(230,245,255,0.96);
    ctx.font = `${p.mode === 'test_arena' || p.mode === 'bastion_entry' ? 22 * dpr : 18 * dpr}px ui-sans-serif, system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.glyph ?? '?', 0, 1 * dpr);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `${12 * dpr}px ui-sans-serif, system-ui`;
    ctx.fillStyle = rgba(6, 9, 14, 0.72);
    const label = p.label || pal.label;
    const y = (s.y + r + 8) * dpr;
    const w = Math.max(70, ctx.measureText(label).width / dpr + 14) * dpr;
    ctx.fillRect(s.x * dpr - w * 0.5, y - 2 * dpr, w, 20 * dpr);
    ctx.strokeStyle = rgba(pal.a.r, pal.a.g, pal.a.b, 0.42);
    ctx.strokeRect(s.x * dpr - w * 0.5, y - 2 * dpr, w, 20 * dpr);
    ctx.fillStyle = rgba(235, 244, 255, 0.88);
    ctx.fillText(label, s.x * dpr, y + 2 * dpr);
    ctx.restore();

    if (p.mode === 'bastion_entry' && !p.unlocked && p.unlockText) {
      const txt = String(p.unlockText).replace('Ouvre dans ', '');
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = `${13 * dpr}px ui-sans-serif, system-ui`;
      const ty = (s.y - r - 12) * dpr;
      const tw = Math.max(62, ctx.measureText(txt).width / dpr + 18) * dpr;
      ctx.fillStyle = rgba(8, 8, 12, 0.78);
      ctx.fillRect(s.x * dpr - tw * 0.5, ty - 20 * dpr, tw, 20 * dpr);
      ctx.strokeStyle = rgba(pal.a.r, pal.a.g, pal.a.b, 0.55);
      ctx.strokeRect(s.x * dpr - tw * 0.5, ty - 20 * dpr, tw, 20 * dpr);
      ctx.fillStyle = rgba(255, 218, 130, 0.96);
      ctx.fillText(txt, s.x * dpr, ty - 4 * dpr);
      ctx.restore();
    }
  }
}
