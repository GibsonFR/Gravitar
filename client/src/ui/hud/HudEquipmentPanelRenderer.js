import { fillRoundedRect } from './HudChrome.js';
import { getItemAccentColor, getItemGlyph, getItemShortTag, getItemStatLines, getItemTagText, getItemPassiveLines, getItemActiveLines } from '../station/StationItemVisuals.js';
import { ITEM_CATEGORY_IDS, getItemCategoryName } from '../../../../shared/content/items/ItemCategoryIds.js';

function hexToRgb(hex, fallback = { r: 130, g: 210, b: 255 }) {
  const raw = String(hex || '').replace('#', '').trim();
  if (raw.length !== 6) return fallback;
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n)) return fallback;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function firstByCategory(byCategory, categoryId) {
  return (byCategory.get(categoryId) || [])[0] || null;
}

function equippedByCategory(equipment) {
  const byCategory = new Map();
  for (const item of equipment?.equippedItems || []) {
    const list = byCategory.get(item.categoryId) || [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }
  return byCategory;
}

function withCooldown(slot, left = 0, max = 0) {
  const cooldownLeft = Number(left || 0);
  const cooldownMax = Number(max || 0);
  if (cooldownLeft <= 0.001) return slot;
  return { ...slot, cooldownLeft, cooldownMax: Math.max(cooldownMax, cooldownLeft, 0.001) };
}


function activeEquipmentTags(equipment) {
  const tags = (equipment?.tags || [])
    .filter((t) => t?.active)
    .map((t) => ({ ...t, kind: 'tag', id: `tag_${t.tagId}` }));
  const superTags = (equipment?.superTags || [])
    .filter((t) => t?.active)
    .map((t) => ({ ...t, kind: 'superTag', id: `super_${t.superTagId}` }));
  return [...tags, ...superTags].slice(0, 8);
}

function tagEffectLines(entry) {
  if (!entry) return [];
  const stage = Math.max(0, entry.stage | 0);
  const rank = Math.max(0, entry.rank | 0);
  if (entry.kind === 'superTag') {
    switch (entry.superTagId) {
      case 'overdrive': return [`Rang ${rank}`, rank >= 2 ? '+8% critique' : '+5% critique'];
      case 'juggernaut': return [`Rang ${rank}`, rank >= 2 ? '+12% coque, +8% dégâts' : '+8% coque, +5% dégâts'];
      case 'ghostwire': return [`Rang ${rank}`, rank >= 2 ? 'Sous 35% coque : +18% vitesse, -8% cooldown, +16% régén. énergie' : 'Sous 35% coque : +10% vitesse, -5% cooldown, +10% régén. énergie'];
      case 'napalm': return [`Rang ${rank}`, rank >= 2 ? 'Brûlure auto : 4s, 9 DPS' : 'Brûlure auto : 3s, 6 DPS'];
      case 'bloodwall': return [`Rang ${rank}`, rank >= 2 ? 'Soin excédentaire → bouclier à 100%' : 'Soin excédentaire → bouclier à 70%'];
      default: return [`Rang ${rank}`];
    }
  }
  switch (entry.tagId) {
    case 'reaver':
      return [
        `Palier ${stage} — ${entry.points | 0} pts`,
        stage >= 2 ? '+16% dégâts, +10% cadence' : '+8% dégâts',
        ...(stage >= 3 ? ['Brûlure auto : 3s, 6 DPS'] : [])
      ];
    case 'warden':
      return [`Palier ${stage} — ${entry.points | 0} pts`, stage >= 2 ? '+20% coque max' : '+10% coque max'];
    case 'surge':
      return [`Palier ${stage} — ${entry.points | 0} pts`, stage >= 2 ? '+20% régén. énergie, -10% cooldown' : '+20% régén. énergie'];
    case 'verge':
      return [
        `Palier ${stage} — ${entry.points | 0} pts`,
        stage >= 2 ? '+20% vitesse, +12% portée auto' : '+10% vitesse',
        ...(stage >= 3 ? ['Sous 35% coque : +18% vitesse'] : [])
      ];
    case 'siege':
      return [`Palier ${stage} — ${entry.points | 0} pts`, stage >= 2 ? '+20% dégâts roquette, +12% portée auto' : '+20% dégâts roquette'];
    case 'siphon':
      return [
        `Palier ${stage} — ${entry.points | 0} pts`,
        stage >= 2 ? '+12% vol de vie, +15% puissance soin' : '+6% vol de vie',
        ...(stage >= 3 ? ['Sous 35% coque : +8% dégâts, +10% puissance soin'] : [])
      ];
    default:
      return [`Palier ${stage} — ${entry.points | 0} pts`];
  }
}

function drawEquipmentTagGlyph(ctx, dpr, entry, x, y, size, scale) {
  const p = hexToRgb(entry.colorHex, { r: 160, g: 210, b: 255 });
  const border = `rgba(${p.r},${p.g},${p.b},0.78)`;
  const bg = `rgba(${p.r},${p.g},${p.b},0.15)`;
  fillRoundedRect(ctx, dpr, x, y, size, size, 6, 'rgba(6,9,14,0.94)', border, 1.0);
  fillRoundedRect(ctx, dpr, x + 2 * scale, y + 2 * scale, size - 4 * scale, size - 4 * scale, 4, bg, 'rgba(255,255,255,0.03)');
  ctx.save();
  ctx.translate((x + size * 0.5) * dpr, (y + size * 0.5) * dpr);
  ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},0.88)`;
  ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},0.16)`;
  ctx.lineWidth = Math.max(1.1, 1.45 * dpr);
  if (entry.kind === 'superTag') {
    ctx.rotate(Math.PI * 0.25);
    ctx.strokeRect(-size * 0.25 * dpr, -size * 0.25 * dpr, size * 0.50 * dpr, size * 0.50 * dpr);
    ctx.rotate(-Math.PI * 0.25);
  } else {
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
  ctx.fillStyle = 'rgba(246,250,255,0.98)';
  ctx.font = `900 ${7.0 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(entry.short || '?', 0, 0);
  ctx.restore();
  const count = entry.kind === 'superTag' ? (entry.rank | 0) : (entry.points | 0);
  if (count > 0) {
    ctx.fillStyle = 'rgba(8,10,14,0.94)';
    ctx.beginPath();
    ctx.arc((x + size - 5 * scale) * dpr, (y + 5 * scale) * dpr, 5 * scale * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,210,0.98)';
    ctx.font = `900 ${7 * scale * dpr}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${count}`, (x + size - 5 * scale) * dpr, (y + 7.7 * scale) * dpr);
  }
}

export function getEquippedHudTagHit(layout, mx, my, myState) {
  const r = layout?.equipmentRect;
  if (!r) return null;
  const scale = layout.scale ?? 1;
  const entries = activeEquipmentTags(myState?.equipment);
  if (!entries.length) return null;
  const size = 24 * scale;
  const gap = 5 * scale;
  const startX = r.x + 10 * scale;
  const y = r.y + 25 * scale;
  for (let i = 0; i < entries.length; i += 1) {
    const x = startX + i * (size + gap);
    if (mx >= x && mx <= x + size && my >= y && my <= y + size) return { entry: entries[i], rect: { x, y, w: size, h: size } };
  }
  return null;
}

function buildEquipmentTagTooltip(hit) {
  const entry = hit?.entry;
  if (!entry) return null;
  const a = hexToRgb(entry.colorHex, { r: 160, g: 210, b: 255 });
  const title = entry.kind === 'superTag'
    ? `${entry.name || 'Super-tag'} — super-tag`
    : `${entry.name || 'Tag'} — tag d’équipement`;
  const lines = tagEffectLines(entry);
  if (entry.kind === 'superTag') {
    lines.push('Actif quand deux familles de tags sont assez présentes.');
  } else {
    lines.push('Actif à partir de 2 points équipés.');
  }
  return { title, accent: a, lines };
}

export function buildEquippedHudSlots(myState, me = null) {
  const equipment = myState?.equipment;
  if (!equipment) return [];
  const byCategory = equippedByCategory(equipment);
  const modules = byCategory.get(ITEM_CATEGORY_IDS.MODULE) || [];
  const converters = byCategory.get(ITEM_CATEGORY_IDS.CONVERTER) || [];
  const rocketSlots = equipment.rocketAmmo?.slots || [];

  const slots = [
    { key: 'defense', role: 'Bouclier', topKey: '', item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.DEFENSE), emptyGlyph: '⛨' },
    { key: 'engine', role: 'Propulseur', topKey: '', item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.ENGINE), emptyGlyph: '➤' },
    { key: 'weapon', role: 'Arme', topKey: '', item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.WEAPON), emptyGlyph: '✶' },
    withCooldown({ key: 'launcher', role: 'Lance-roquettes', topKey: '', item: firstByCategory(byCategory, ITEM_CATEGORY_IDS.LAUNCHER), emptyGlyph: '☄' }, me?.rocketCooldownLeft ?? 0, me?.rocketCooldownMax ?? 8)
  ];

  const moduleCap = Math.max(3, Math.min(6, equipment.slotCaps?.[ITEM_CATEGORY_IDS.MODULE] || Math.max(3, modules.length || 3)));
  for (let i = 0; i < Math.min(3, moduleCap); i += 1) {
    const item = modules[i] || null;
    slots.push(withCooldown({
      key: `module_${i}`,
      role: `Module ${i + 1}`,
      topKey: String(i + 1),
      item,
      emptyGlyph: '◆',
      moduleIndex: i + 1
    }, item?.cooldownLeft ?? item?.activeCooldownLeft ?? 0, item?.cooldownMax ?? item?.activeCooldownMax ?? 0));
  }

  const converterCap = Math.max(1, Math.min(2, equipment.slotCaps?.[ITEM_CATEGORY_IDS.CONVERTER] || Math.max(1, converters.length || 1)));
  for (let i = 0; i < converterCap; i += 1) {
    slots.push(withCooldown({
      key: `converter_${i}`,
      role: `Convertisseur ${i + 1}`,
      topKey: '',
      item: converters[i] || null,
      emptyGlyph: '↻'
    }, converters[i]?.cooldownLeft ?? 0, converters[i]?.cooldownMax ?? 0));
  }

  for (const slot of rocketSlots.slice(0, 2)) {
    const baseItem = slot.item ? { ...slot.item, categoryId: ITEM_CATEGORY_IDS.AMMO, active: slot.active } : null;
    let ammoQuantity = Math.max(0, baseItem?.ammoQuantity | 0);
    if (slot.active && Number.isFinite(myState?.derived?.rocketAmmoQuantity)) ammoQuantity = Math.max(0, myState.derived.rocketAmmoQuantity | 0);
    const item = baseItem ? { ...baseItem, ammoQuantity } : null;
    slots.push({
      key: `ammo_${slot.slot}`,
      role: `Roquette ${((slot.slot | 0) + 1)}`,
      topKey: (slot.slot | 0) === 0 ? 'X' : 'C',
      item,
      emptyGlyph: '◉',
      ammo: true,
      ammoSlotIndex: slot.slot | 0,
      ammoQuantity,
      active: !!slot.active
    });
  }

  while (slots.length < 12) slots.push({ key: `reserved_${slots.length}`, role: 'Slot', topKey: '', item: null, emptyGlyph: '·', reserved: true });
  return slots.slice(0, 12);
}

function drawTopBadge(ctx, dpr, r, text, border, scale, tone = 'rgba(242,247,255,0.94)') {
  if (!text) return;
  const w = Math.max(17 * scale, String(text).length * 8.5 * scale);
  fillRoundedRect(ctx, dpr, r.x + 4 * scale, r.y + 4 * scale, w, 15 * scale, 4, 'rgba(16,20,31,0.94)', border, 1.0);
  ctx.fillStyle = tone;
  ctx.font = `900 ${9 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(text, (r.x + 4 * scale + w * 0.5) * dpr, (r.y + 15 * scale) * dpr);
}

function drawTierBadge(ctx, dpr, r, item, a, scale) {
  if (!item) return;
  const text = `T${Math.max(1, item.tier | 0)}`;
  const w = Math.max(20 * scale, text.length * 7.8 * scale);
  fillRoundedRect(ctx, dpr, r.x + r.w - w - 4 * scale, r.y + r.h - 18 * scale, w, 14 * scale, 4, 'rgba(10,13,20,0.90)', `rgba(${a.r},${a.g},${a.b},0.46)`, 0.9);
  ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},0.94)`;
  ctx.font = `900 ${8.0 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(text, (r.x + r.w - w * 0.5 - 4 * scale) * dpr, (r.y + r.h - 7.4 * scale) * dpr);
}

function drawAmmoQuantity(ctx, dpr, r, slot, a, scale) {
  if (!slot.ammo || !slot.item) return;
  const qty = Math.max(0, slot.ammoQuantity | 0);
  const text = String(qty);
  const w = Math.max(23 * scale, text.length * 8.8 * scale + 10 * scale);
  const h = 16 * scale;
  const x = r.x + r.w - w - 4 * scale;
  const y = r.y + 4 * scale;
  fillRoundedRect(ctx, dpr, x, y, w, h, 5, 'rgba(5,8,14,0.97)', `rgba(${a.r},${a.g},${a.b},0.72)`, 1.15);
  ctx.fillStyle = qty > 0 ? 'rgba(244,248,255,0.99)' : 'rgba(255,120,120,0.96)';
  ctx.font = `900 ${10.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(text, (x + w * 0.5) * dpr, (y + 11.6 * scale) * dpr);
}

function drawCooldown(ctx, dpr, r, left, max, scale) {
  const cooldownLeft = Number(left || 0);
  if (cooldownLeft <= 0.001) return;
  const ratio = Math.min(1, Math.max(0, cooldownLeft / Math.max(max || 0, cooldownLeft, 0.001)));
  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h * ratio, 9, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = 'rgba(255,238,205,0.98)';
  ctx.font = `900 ${13 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'center';
  ctx.fillText(cooldownLeft.toFixed(cooldownLeft >= 10 ? 0 : 1), (r.x + r.w * 0.5) * dpr, (r.y + r.h * 0.56) * dpr);
}

function drawReadyDot(ctx, dpr, r, item, scale) {
  if (!item) return;
  fillRoundedRect(ctx, dpr, r.x + r.w - 10 * scale, r.y + r.h - 10 * scale, 6 * scale, 6 * scale, 3, 'rgba(103,244,176,0.92)');
}

function drawItemSlot(ctx, dpr, r, slot, scale, hovered = false) {
  if (!r) return;
  const item = slot.item;
  const accentHex = item ? getItemAccentColor(item) : '#526176';
  const a = hexToRgb(accentHex);
  const empty = !item;
  const border = empty ? 'rgba(90,116,150,0.38)' : `rgba(${a.r},${a.g},${a.b},${hovered ? 0.95 : 0.58})`;
  const bg = empty ? 'rgba(8,11,18,0.88)' : `rgba(${a.r},${a.g},${a.b},0.13)`;

  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 9, 'rgba(6,8,13,0.94)', border, hovered ? 1.9 : 1.15);
  fillRoundedRect(ctx, dpr, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 7, bg, 'rgba(255,255,255,0.025)');

  const glyph = item ? getItemGlyph(item) : slot.emptyGlyph;
  ctx.textAlign = 'center';
  ctx.fillStyle = item ? `rgba(${a.r},${a.g},${a.b},0.96)` : 'rgba(112,128,152,0.64)';
  ctx.font = `900 ${22 * scale * dpr}px Segoe UI Symbol, Segoe UI`;
  ctx.fillText(glyph, (r.x + r.w * 0.5) * dpr, (r.y + r.h * 0.61) * dpr);

  const topText = slot.moduleIndex ? String(slot.moduleIndex) : slot.topKey;
  drawTopBadge(ctx, dpr, r, topText, `rgba(${a.r},${a.g},${a.b},0.58)`, scale, slot.ammo ? 'rgba(255,224,128,0.96)' : 'rgba(242,247,255,0.94)');
  if (item && !slot.moduleIndex && !slot.ammo) drawTierBadge(ctx, dpr, r, item, a, scale);

  if (item) {
    if (!slot.ammo) {
      const tag = getItemShortTag(item);
      if (tag) {
        const badgeW = Math.max(18 * scale, Math.min(r.w - 8 * scale, (tag.length * 6 + 10) * scale));
        fillRoundedRect(ctx, dpr, r.x + r.w - badgeW - 4 * scale, r.y + r.h - 17 * scale, badgeW, 13 * scale, 4, 'rgba(10,13,20,0.92)', `rgba(${a.r},${a.g},${a.b},0.58)`, 1.0);
        ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},0.96)`;
        ctx.font = `900 ${7.5 * scale * dpr}px Segoe UI`;
        ctx.textAlign = 'center';
        ctx.fillText(tag, (r.x + r.w - badgeW * 0.5 - 4 * scale) * dpr, (r.y + r.h - 7.5 * scale) * dpr);
      }
    }
    drawAmmoQuantity(ctx, dpr, r, slot, a, scale);
    if (!slot.ammo) drawReadyDot(ctx, dpr, r, item, scale);
  }

  if (slot.active) {
    fillRoundedRect(ctx, dpr, r.x + 4 * scale, r.y + r.h - 6 * scale, r.w - 8 * scale, 3 * scale, 2, 'rgba(255,212,94,0.95)');
    fillRoundedRect(ctx, dpr, r.x + 2 * scale, r.y + 2 * scale, r.w - 4 * scale, 3 * scale, 2, 'rgba(255,212,94,0.65)');
  }

  drawCooldown(ctx, dpr, r, slot.cooldownLeft, slot.cooldownMax, scale);
}

export function getEquippedHudHit(layout, mx, my, myState) {
  const slots = buildEquippedHudSlots(myState);
  const rects = layout?.equipmentSlotRects || [];
  for (let i = 0; i < slots.length; i += 1) {
    const r = rects[i];
    if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return { slot: slots[i], rect: r };
  }
  return null;
}

export function buildEquipmentTooltip(hit) {
  if (hit?.entry) return buildEquipmentTagTooltip(hit);
  const slot = hit?.slot;
  if (!slot) return null;
  const item = slot.item;
  if (!item) {
    return {
      title: `${slot.role || 'Slot'} — vide`,
      accent: { r: 128, g: 150, b: 180 },
      lines: ['Aucun item équipé.']
    };
  }
  const a = hexToRgb(getItemAccentColor(item));
  const lines = [
    `${getItemCategoryName(item.categoryId)} — T${Math.max(1, item.tier | 0)}`,
    getItemTagText(item) ? `Tags : ${getItemTagText(item)}` : 'Tags : aucun'
  ];
  const stats = getItemStatLines(item);
  if (stats.length) lines.push(`Stats : ${stats.join(' • ')}`);
  const passive = getItemPassiveLines(item);
  lines.push(`Passif : ${passive.length ? passive.join(' • ') : 'aucun'}`);
  const active = getItemActiveLines(item);
  lines.push(`Actif : ${active.length ? active.join(' • ') : 'aucun'}`);
  if (slot.ammo) {
    lines.push(`Restantes : ${Math.max(0, slot.ammoQuantity | 0)}`);
    lines.push(`Type ${((slot.ammoSlotIndex | 0) + 1)} : touche ${slot.topKey || '?'} ou clic sur le slot`);
  }
  if (slot.cooldownLeft > 0.001) lines.push(`Recharge : ${slot.cooldownLeft.toFixed(1)}s`);
  return { title: item.name || slot.role || 'Item équipé', accent: a, lines };
}

export function drawHudEquipmentPanel(ctx, view, myState, input, layout, me = null) {
  const r = layout?.equipmentRect;
  if (!r) return;
  const dpr = view.dpr;
  const scale = layout.scale ?? 1;
  const slots = buildEquippedHudSlots(myState, me);
  if (!slots.length) return;

  fillRoundedRect(ctx, dpr, r.x, r.y, r.w, r.h, 12, 'rgba(7,10,16,0.88)', 'rgba(90,116,150,0.36)', 1.0);
  fillRoundedRect(ctx, dpr, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10, 'rgba(12,16,26,0.76)', 'rgba(255,255,255,0.025)');

  ctx.fillStyle = 'rgba(151,226,255,0.90)';
  ctx.font = `900 ${9.2 * scale * dpr}px Segoe UI`;
  ctx.textAlign = 'left';
  ctx.fillText('ÉQUIPEMENT', (r.x + 10 * scale) * dpr, (r.y + 15 * scale) * dpr);

  const tagEntries = activeEquipmentTags(myState?.equipment);
  const tagSize = 24 * scale;
  const tagGap = 5 * scale;
  const tagY = r.y + 25 * scale;
  if (tagEntries.length) {
    for (let i = 0; i < tagEntries.length; i += 1) {
      drawEquipmentTagGlyph(ctx, dpr, tagEntries[i], r.x + 10 * scale + i * (tagSize + tagGap), tagY, tagSize, scale);
    }
  } else {
    ctx.fillStyle = 'rgba(135,151,176,0.72)';
    ctx.font = `800 ${8.5 * scale * dpr}px Segoe UI`;
    ctx.textAlign = 'left';
    ctx.fillText('Aucun tag actif', (r.x + 10 * scale) * dpr, (r.y + 40 * scale) * dpr);
  }

  const hit = getEquippedHudHit(layout, input?.msx ?? -1, input?.msy ?? -1, myState);
  for (let i = 0; i < slots.length; i += 1) {
    const rect = layout.equipmentSlotRects[i];
    const hovered = hit?.slot?.key === slots[i].key;
    drawItemSlot(ctx, dpr, rect, slots[i], scale, hovered);
  }
}
