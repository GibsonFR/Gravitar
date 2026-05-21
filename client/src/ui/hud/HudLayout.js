import { clamp } from '../../core/Math.js';

export function getCombatHudLayout(view) {
  const scale = clamp(Math.min(view.cssW / 1500, view.cssH / 900), 0.96, 1.14);
  const safeBottom = view.cssH - 18 * scale;
  const leftX = 18 * scale;

  const leftW = 468 * scale;
  const gapY = 8 * scale;
  const combatStatsH = 112 * scale;
  const lowerH = 64 * scale;
  const vitalsW = 254 * scale;
  const playerStatsW = leftW - vitalsW - 10 * scale;

  const lowerY = safeBottom - lowerH;
  const combatStatsY = lowerY - gapY - combatStatsH;

  const combatStatsRect = { x: leftX, y: combatStatsY, w: leftW, h: combatStatsH };
  const vitalsRect = { x: leftX, y: lowerY, w: vitalsW, h: lowerH };
  const playerStatsRect = { x: leftX + vitalsW + 10 * scale, y: lowerY, w: playerStatsW, h: lowerH };

  const cardW = 80 * scale;
  const cardH = 64 * scale;
  const gap = 10 * scale;
  const passiveW = 64 * scale;
  const utilityW = 56 * scale;

  // A/Z/E/R must stay visually centered. The equipped-stuff panel is anchored
  // after the combat strip and never participates in the centering calculation.
  const combatStripW = passiveW + 12 * scale + 4 * cardW + 3 * gap + 12 * scale + 2 * utilityW + 8 * scale;
  const minAbilityX = leftX + leftW + 38 * scale;
  const centeredAbilityX = view.cssW * 0.5 - combatStripW * 0.5;
  let abilityX = Math.max(minAbilityX, centeredAbilityX);
  const maxCombatX = view.cssW - combatStripW - 340 * scale;
  if (abilityX > maxCombatX) abilityX = Math.max(minAbilityX, maxCombatX);
  const hudY = safeBottom - cardH;

  const equipmentGap = 22 * scale;
  const equipmentSlotSize = 46 * scale;
  const equipmentSlotGap = 8 * scale;
  const equipmentCols = 4;
  const equipmentRows = 3;
  const equipmentPad = 10 * scale;
  const equipmentTitleH = 52 * scale;
  const equipmentW = equipmentPad * 2 + equipmentCols * equipmentSlotSize + (equipmentCols - 1) * equipmentSlotGap;
  const equipmentH = equipmentPad * 2 + equipmentTitleH + equipmentRows * equipmentSlotSize + (equipmentRows - 1) * equipmentSlotGap;

  const passiveRect = { x: abilityX, y: hudY, w: passiveW, h: cardH };
  const firstAbilityX = abilityX + passiveW + 12 * scale;

  const abilityRects = {
    A: { x: firstAbilityX + 0 * (cardW + gap), y: hudY, w: cardW, h: cardH },
    Z: { x: firstAbilityX + 1 * (cardW + gap), y: hudY, w: cardW, h: cardH },
    E: { x: firstAbilityX + 2 * (cardW + gap), y: hudY, w: cardW, h: cardH },
    R: { x: firstAbilityX + 3 * (cardW + gap), y: hudY, w: cardW, h: cardH }
  };

  const utilityX = firstAbilityX + 4 * (cardW + gap) + 3 * scale;
  const utilityRects = {
    D: { x: utilityX, y: hudY, w: utilityW, h: cardH },
    F: { x: utilityX + utilityW + 8 * scale, y: hudY, w: utilityW, h: cardH }
  };

  const desiredEquipmentX = utilityX + 2 * utilityW + 8 * scale + equipmentGap;
  const equipmentX = Math.min(desiredEquipmentX, view.cssW - equipmentW - 16 * scale);
  const equipmentY = safeBottom - equipmentH;
  const equipmentRect = { x: equipmentX, y: equipmentY, w: equipmentW, h: equipmentH };
  const equipmentSlotRects = [];
  const slotStartX = equipmentX + equipmentPad;
  const slotStartY = equipmentY + equipmentPad + equipmentTitleH;
  for (let i = 0; i < equipmentCols * equipmentRows; i += 1) {
    const col = i % equipmentCols;
    const row = Math.floor(i / equipmentCols);
    equipmentSlotRects.push({
      x: slotStartX + col * (equipmentSlotSize + equipmentSlotGap),
      y: slotStartY + row * (equipmentSlotSize + equipmentSlotGap),
      w: equipmentSlotSize,
      h: equipmentSlotSize
    });
  }

  return {
    scale,
    hudX: abilityX,
    hudY,
    centerX: firstAbilityX + 2 * (cardW + gap),
    y: combatStatsY,
    statusY: Math.max(8, hudY - 34 * scale),
    hintY: hudY - 28 * scale,
    abilityY: hudY,
    abilityScale: scale,
    abilityRects,
    passiveRect,
    utilityRects,
    equipmentRect,
    equipmentSlotRects,
    vitalsRect,
    playerStatsRect,
    combatStatsRect
  };
}

export function hitTestHudAbility(view, px, py) {
  const layout = getCombatHudLayout(view);
  for (const slot of ['A', 'Z', 'E', 'R']) {
    const r = layout.abilityRects[slot];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return slot;
  }
  return null;
}
