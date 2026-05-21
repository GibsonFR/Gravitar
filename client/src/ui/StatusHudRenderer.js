import { fillRoundedRect } from './hud/HudChrome.js';
import { drawStatusGlyph } from './status/StatusGlyphRenderer.js';

function hexToRgb(hex, fallback = { r: 220, g: 220, b: 220 }) {
  const s = String(hex || '').replace('#', '').trim();
  if (s.length !== 6) return fallback;
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n)) return fallback;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function drawTagIcon(ctx, dpr, entry, x, y, size, rowKind) {
  const p = entry.primaryColor ?? hexToRgb(entry.colorHex);
  ctx.save();
  ctx.translate((x + size * 0.5) * dpr, (y + size * 0.5) * dpr);
  ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},0.92)`;
  ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.18)`;
  ctx.lineWidth = Math.max(1.2, 1.8 * dpr);
  if (rowKind === 'superTag') {
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeRect(-size * 0.25 * dpr, -size * 0.25 * dpr, size * 0.50 * dpr, size * 0.50 * dpr);
    ctx.rotate(-Math.PI * 0.25);
  } else if (rowKind === 'tag') {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const px = Math.cos(a) * size * 0.31 * dpr;
      const py = Math.sin(a) * size * 0.31 * dpr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(246,250,255,0.98)`;
  ctx.font = `${Math.max(6.2, size * 0.25) * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(entry.short || entry.glyph || '?', 0, 0);
  ctx.restore();
}

function normalizeTagEntries(equipment) {
  const tags = (equipment?.tags || [])
    .filter((t) => t?.active)
    .map((t) => ({ ...t, id: `tag_${t.tagId}`, primaryColor: hexToRgb(t.colorHex), kind: 'tagBuff' }));
  const superTags = (equipment?.superTags || [])
    .filter((t) => t?.active)
    .map((t) => ({ ...t, id: `super_${t.superTagId}`, primaryColor: hexToRgb(t.colorHex), kind: 'superTagBuff' }));
  return { tags, superTags };
}

export function buildHudBuffRows(statuses, layout, bastions = [], equipment = null) {
  const scale = layout?.abilityScale ?? 1;
  const baseY = layout?.statusY ?? 0;
  const { tags, superTags } = normalizeTagEntries(equipment);
  const rows = [];
  let y = baseY;
  if (statuses?.length) { rows.push({ entries: statuses.slice(0, 10), y, kind: 'status' }); y -= 30 * scale; }
  if (bastions?.length) { rows.push({ entries: bastions.slice(0, 10), y, kind: 'bastion' }); }
  // Les tags d'équipement sont rendus directement dans le panneau Équipement HUD.
  return rows;
}

export function drawStatusHud(ctx, view, statuses, layout, bastions = [], equipment = null) {
  const rows = buildHudBuffRows(statuses, layout, bastions, equipment);
  if (!rows.length) return;

  const scale = layout?.abilityScale ?? 1;
  const size = 25 * scale;
  const gap = 5 * scale;
  const centerX = layout?.centerX ?? view.cssW * 0.5;

  for (const row of rows) {
    const total = row.entries.length;
    const y = row.y;
    let x = centerX - ((size * total + gap * (total - 1)) * 0.5);

    for (const entry of row.entries) {
      const p = entry.primaryColor ?? { r: 220, g: 220, b: 220 };
      const s = entry.secondaryColor ?? p;
      fillRoundedRect(ctx, view.dpr, x, y, size, size, 5, 'rgba(6,9,14,0.94)', `rgba(${p.r},${p.g},${p.b},0.74)`);
      fillRoundedRect(ctx, view.dpr, x + 2, y + 2, size - 4, size - 4, 3.5, 'rgba(13,18,27,0.78)', `rgba(${s.r},${s.g},${s.b},0.22)`);
      if (row.kind === 'bastion') {
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.96)`;
        ctx.font = `${8.2 * view.dpr}px Segoe UI`;
        ctx.textAlign = 'center';
        ctx.fillText(entry.glyph || 'BST', (x + size * 0.5) * view.dpr, (y + size * 0.58) * view.dpr);
      } else if (row.kind === 'tag' || row.kind === 'superTag') {
        drawTagIcon(ctx, view.dpr, entry, x, y, size, row.kind);
      } else {
        drawStatusGlyph(ctx, view.dpr, entry, x + 3.5, y + 3.2, size - 7, 0.98);
      }

      const duration = Number(entry.durationLeft ?? 0);
      if (duration > 0) {
        const shown = duration >= 9.95 ? `${Math.ceil(duration)}` : duration.toFixed(1);
        ctx.fillStyle = 'rgba(242,246,255,0.96)';
        ctx.font = `${7.2 * view.dpr}px Segoe UI`;
        ctx.textAlign = 'center';
        ctx.fillText(shown, (x + size * 0.5) * view.dpr, (y + size - 2.5) * view.dpr);
      }

      const count = row.kind === 'tag' ? (entry.points | 0) : row.kind === 'superTag' ? (entry.rank | 0) : (entry.stacks ?? 1);
      if (count > 1) {
        ctx.fillStyle = 'rgba(8,10,14,0.92)';
        ctx.beginPath();
        ctx.arc((x + size - 5) * view.dpr, (y + 5) * view.dpr, 5 * view.dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,248,210,0.98)';
        ctx.font = `${7 * view.dpr}px Segoe UI`;
        ctx.textAlign = 'center';
        ctx.fillText(`${count}`, (x + size - 5) * view.dpr, (y + 7.6) * view.dpr);
      }
      x += size + gap;
    }
  }
}
