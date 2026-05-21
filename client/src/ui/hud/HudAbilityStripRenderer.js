import { COLORS } from '../../core/Colors.js';
import { fillRoundedRect } from './HudChrome.js';
import { drawAbilityCard } from '../AbilityBarRenderer.js';
import { drawAbilityGlyph } from './HudIcons.js';

const SLOT_ACCENTS = {
  A: { r: 116, g: 226, b: 255 },
  Z: { r: 118, g: 244, b: 196 },
  E: { r: 124, g: 154, b: 255 },
  R: { r: 243, g: 196, b: 104 },
  D: COLORS.dock,
  F: COLORS.warning,
  P: { r: 223, g: 179, b: 94 }
};

function drawHint(ctx, dpr, x, y, text, accent, scale) {
  ctx.font = `${9 * scale * dpr}px Segoe UI`;
  const w = ctx.measureText(text).width / dpr + 16 * scale;
  fillRoundedRect(ctx, dpr, x, y, w, 20 * scale, 7, 'rgba(7,10,16,0.90)', `rgba(${accent.r},${accent.g},${accent.b},0.25)`);
  ctx.fillStyle = 'rgba(232,239,252,0.90)';
  ctx.textAlign = 'center';
  ctx.fillText(text, (x + w * 0.5) * dpr, (y + 13.5 * scale) * dpr);
}

function drawPassiveCard(ctx, dpr, r, me, myState, scale) {
  const accent = SLOT_ACCENTS.P;
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 7, 'rgba(8,11,18,0.92)', `rgba(${accent.r},${accent.g},${accent.b},0.36)`);
  fillRoundedRect(ctx, dpr, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 5, 'rgba(12,16,26,0.93)', 'rgba(255,255,255,0.03)');
  drawAbilityGlyph(ctx, dpr, me?.frameId || myState?.frameId || 'vanguard', 'P', r.x + 12 * scale, r.y + 9 * scale, r.w - 24 * scale, r.h - 19 * scale, accent);

  ctx.fillStyle = 'rgba(244,247,255,0.92)';
  ctx.font = `${10 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText('P', (r.x + 5 * scale) * dpr, (r.y + 14 * scale) * dpr);

  if (myState?.frameState?.passiveMaxStacks > 0) {
    const fs = myState.frameState;
    const maxStacks = Math.min(fs.passiveMaxStacks ?? 10, 10);
    const active = Math.min(fs.passiveStacks ?? 0, maxStacks);
    const pipW = (r.w - 10 * scale - (maxStacks - 1) * 2 * scale) / maxStacks;
    for (let i = 0; i < maxStacks; i += 1) {
      fillRoundedRect(ctx, dpr, r.x + 5 * scale + i * (pipW + 2 * scale), r.y + r.h - 5 * scale, pipW, 2.4 * scale, 1.1, i < active ? 'rgba(223,179,94,0.94)' : 'rgba(74,78,92,0.78)');
    }
  }
}


function drawUtilityCard(ctx, dpr, r, key, label, active, accent, cooldownLeft = 0, cooldownMax = 1, scale = 1) {
  const cooling = Math.max(0, cooldownLeft) > 0.001;
  const ratio = cooling ? Math.min(1, Math.max(0, cooldownLeft / Math.max(cooldownMax, cooldownLeft, 0.001))) : 0;
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 10, 'rgba(7,10,16,0.93)', `rgba(${accent.r},${accent.g},${accent.b},0.50)`, active ? 1.8 : 1.1);
  fillRoundedRect(ctx, dpr, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 8, active ? `rgba(${accent.r},${accent.g},${accent.b},0.16)` : 'rgba(16,20,31,0.88)', 'rgba(255,255,255,0.025)');

  ctx.fillStyle = 'rgba(242,247,255,0.96)';
  ctx.font = `800 ${15 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText(key, (r.x + 8 * scale) * dpr, (r.y + 18 * scale) * dpr);

  drawAbilityGlyph(ctx, dpr, 'vanguard', key, r.x + r.w * 0.5 - 16 * scale, r.y + 23 * scale, 32 * scale, 24 * scale, accent);

  ctx.fillStyle = 'rgba(210,222,242,0.82)';
  ctx.font = `700 ${9.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(label, (r.x + r.w * 0.5) * dpr, (r.y + r.h - 10 * scale) * dpr);

  if (cooling) {
    fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h * ratio, 10, 'rgba(0,0,0,0.58)');
    ctx.fillStyle = 'rgba(255,238,205,0.96)';
    ctx.font = `800 ${15 * scale * dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.fillText(cooldownLeft.toFixed(cooldownLeft >= 10 ? 0 : 1), (r.x + r.w * 0.5) * dpr, (r.y + r.h * 0.55) * dpr);
  }
}

function slotWithEnergy(slot, me) {
  if (!slot) return slot;
  if (slot.energyCost == null) return slot;
  return { ...slot, hasEnergy: (me?.vitals?.energy ?? 0) >= slot.energyCost };
}

export function drawAbilityStrip(ctx, view, me, myState, input, layout) {
  const dpr = view.dpr;
  const scale = layout?.scale ?? 1;
  const rects = layout?.abilityRects;
  if (!rects) return;

  const cards = {
    A: { ...slotWithEnergy(myState?.abilityHud?.A, me), keyHeld: input.a },
    Z: { ...slotWithEnergy(myState?.abilityHud?.Z, me), keyHeld: input.z },
    E: { ...slotWithEnergy(myState?.abilityHud?.E, me), keyHeld: input.e },
    R: { ...slotWithEnergy(myState?.abilityHud?.R, me), keyHeld: input.r }
  };

  drawPassiveCard(ctx, dpr, layout.passiveRect, me, myState, scale);

  for (const slot of ['A', 'Z', 'E', 'R']) {
    const r = rects[slot];
    drawAbilityCard(ctx, dpr, r.x, r.y, r.w, r.h, cards[slot], cards[slot].keyHeld, SLOT_ACCENTS[slot] ?? COLORS.fx, me?.frameId || myState?.frameId || 'vanguard');
  }

  if (layout.utilityRects?.D) {
    drawUtilityCard(ctx, dpr, layout.utilityRects.D, 'D', 'Dock', input.interactTap, SLOT_ACCENTS.D, 0, 1, scale);
  }
  if (layout.utilityRects?.F) {
    drawUtilityCard(ctx, dpr, layout.utilityRects.F, 'F', 'Rocket', input.rocketTap, SLOT_ACCENTS.F, me?.rocketCooldownLeft ?? 0, 8, scale);
  }

  if (myState?.dockedStationId) drawHint(ctx, dpr, layout.hudX, layout.hintY, 'Station proche : D', COLORS.fx, scale);
}
