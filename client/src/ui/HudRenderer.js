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


function drawPinnedQuestBadge(ctx, view, myState, layout) {
  const quests = Array.isArray(myState?.activeQuests?.active) ? myState.activeQuests.active : [];
  if (!quests.length) return;
  let pinnedId = '';
  try { pinnedId = String(window.__gravitarPinnedQuestId || localStorage.getItem('gravitar.activeQuestPinnedId') || '').toLowerCase(); }
  catch { pinnedId = String(window.__gravitarPinnedQuestId || '').toLowerCase(); }
  const quest = quests.find((q) => String(q.questId || '').toLowerCase() === pinnedId) || null;
  if (!quest) return;
  const dpr = view.dpr;
  const scale = layout?.scale ?? 1;
  const current = Math.max(0, quest.current | 0);
  const required = Math.max(1, quest.required | 0 || 1);
  const label = quest.name || 'Quête pirate';
  const objective = quest.type === 'kill_mob' ? (quest.targetName || quest.targetMobId || 'Cible') : (quest.resourceName || quest.resourceKey || 'Ressource');
  const pct = Math.max(0, Math.min(1, current / required));
  const w = Math.min(view.cssW - 32 * scale, Math.max(250 * scale, 292 * scale));
  const h = 47 * scale;
  const x = Math.max(16 * scale, view.cssW - w - 16 * scale);
  const y = Math.max(86 * scale, (layout?.y ?? 112) - 94 * scale);
  fillRoundedRect(ctx, dpr, x, y, w, h, 11, 'rgba(7, 12, 20, 0.88)', 'rgba(125, 233, 255, 0.26)', 1.1);
  ctx.textAlign = 'left';
  ctx.font = `800 ${9.2 * scale * dpr}px Segoe UI`;
  ctx.fillStyle = quest.ready ? 'rgba(125, 233, 255, .96)' : 'rgba(255, 216, 150, .92)';
  ctx.fillText(quest.ready ? 'QUÊTE PRÊTE' : 'QUÊTE ÉPINGLÉE', (x + 12 * scale) * dpr, (y + 14 * scale) * dpr);
  ctx.font = `800 ${11 * scale * dpr}px Segoe UI`;
  ctx.fillStyle = 'rgba(241, 246, 255, .95)';
  ctx.fillText(label, (x + 12 * scale) * dpr, (y + 29 * scale) * dpr);
  ctx.font = `700 ${10 * scale * dpr}px Segoe UI`;
  ctx.fillStyle = 'rgba(185, 201, 224, .86)';
  ctx.fillText(`${objective} ${current}/${required}`, (x + 12 * scale) * dpr, (y + 42 * scale) * dpr);
  const bx = x + 135 * scale;
  const by = y + 36 * scale;
  const bw = w - 148 * scale;
  const bh = 5 * scale;
  fillRoundedRect(ctx, dpr, bx, by, bw, bh, 999, 'rgba(255,255,255,.07)', 'rgba(255,255,255,.05)', 0.8);
  fillRoundedRect(ctx, dpr, bx, by, bw * pct, bh, 999, 'rgba(125, 233, 255, .78)', 'rgba(125, 233, 255, .18)', 0.2);
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
  drawPinnedQuestBadge(ctx, view, myState, layout);

  if (myState?.hint) {
    ctx.fillStyle = `rgba(${COLORS.warning.r}, ${COLORS.warning.g}, ${COLORS.warning.b}, 0.88)`;
    ctx.font = `${9 * view.dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.fillText(myState.hint, layout.centerX * view.dpr, (layout.y - 6) * view.dpr);
  }

  drawHudTooltip(ctx, view, me, myState, input, layout);
}
