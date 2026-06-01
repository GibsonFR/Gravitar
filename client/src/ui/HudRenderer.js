import { COLORS } from '../core/Colors.js';
import { getShipFrameDef } from '../../../shared/content/frames/ShipFrameRegistry.js';
import { drawStatusHud } from './StatusHudRenderer.js';
import { drawVitalsPanel } from './hud/HudVitalsPanelRenderer.js';
import { drawAbilityStrip } from './hud/HudAbilityStripRenderer.js';
import { drawHudEquipmentPanel } from './hud/HudEquipmentPanelRenderer.js';
import { drawHudTooltip } from './HudTooltipRenderer.js';
import { fillRoundedRect } from './hud/HudChrome.js';


function drawBaseIntrusionBadge(ctx, view, myState, layout) {
  const intrusion = myState?.baseIntrusion;
  if (!intrusion?.active) return;
  const dpr = view.dpr;
  const scale = layout?.scale ?? 1;
  const label = `${intrusion.baseType || 'Base'} ennemie : ${intrusion.ownerName || 'Pilote inconnu'}`;
  ctx.font = `800 ${10.5 * scale * dpr}px Segoe UI`;
  const w = Math.min(view.cssW - 32 * scale, Math.max(190 * scale, ctx.measureText(label).width / dpr + 34 * scale));
  const h = 26 * scale;
  const x = Math.max(16 * scale, view.cssW * 0.5 - w * 0.5);
  const y = Math.max(16 * scale, (layout?.y ?? 112) - 42 * scale);
  fillRoundedRect(ctx, dpr, x, y, w, h, 9, 'rgba(38, 11, 16, 0.88)', 'rgba(255, 85, 98, 0.56)', 1.3);
  ctx.fillStyle = 'rgba(255, 108, 118, 0.96)';
  ctx.textAlign = 'left';
  ctx.fillText('!', (x + 10 * scale) * dpr, (y + 17.4 * scale) * dpr);
  ctx.fillStyle = 'rgba(255, 232, 235, 0.96)';
  ctx.fillText(label, (x + 30 * scale) * dpr, (y + 17.4 * scale) * dpr);
}

function getFrameDef(frameId) {
  return getShipFrameDef(frameId || 'vanguard');
}

export function drawHud(ctx, view, me, myState, input) {
  if (!me?.vitals) return;
  const frameDef = getFrameDef(me.frameId || myState?.frameId);
  const layout = drawVitalsPanel(ctx, view, me, myState, frameDef);
  drawAbilityStrip(ctx, view, me, myState, input, layout);
  drawHudEquipmentPanel(ctx, view, myState, input, layout, me);
  drawStatusHud(ctx, view, myState?.statuses ?? [], layout, myState?.bastions ?? [], myState?.equipment ?? null);
  drawBaseIntrusionBadge(ctx, view, myState, layout);

  if (myState?.hint) {
    ctx.fillStyle = `rgba(${COLORS.warning.r}, ${COLORS.warning.g}, ${COLORS.warning.b}, 0.88)`;
    ctx.font = `${9 * view.dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.fillText(myState.hint, layout.centerX * view.dpr, (layout.y - 6) * view.dpr);
  }

  drawHudTooltip(ctx, view, me, myState, input, layout);
}
