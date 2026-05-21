import { COLORS } from '../core/Colors.js';
import { getShipFrameDef } from '../../../shared/content/frames/ShipFrameRegistry.js';
import { drawStatusHud } from './StatusHudRenderer.js';
import { drawVitalsPanel } from './hud/HudVitalsPanelRenderer.js';
import { drawAbilityStrip } from './hud/HudAbilityStripRenderer.js';
import { drawHudEquipmentPanel } from './hud/HudEquipmentPanelRenderer.js';
import { drawHudTooltip } from './HudTooltipRenderer.js';

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

  if (myState?.hint) {
    ctx.fillStyle = `rgba(${COLORS.warning.r}, ${COLORS.warning.g}, ${COLORS.warning.b}, 0.88)`;
    ctx.font = `${9 * view.dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.fillText(myState.hint, layout.centerX * view.dpr, (layout.y - 6) * view.dpr);
  }

  drawHudTooltip(ctx, view, me, myState, input, layout);
}
