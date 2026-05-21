import { getItemCategoryName, ITEM_CATEGORY_IDS } from '../../../../shared/content/items/ItemCategoryIds.js';
import { getItemTagDef } from '../../../../shared/content/items/ItemTagDefs.js';

const TIER_COLORS = Object.freeze({
  1: '#6f89a8',
  2: '#82b56e',
  3: '#c2a15b',
  4: '#b27ac8'
});

export function getItemAccentColor(item) {
  const firstTag = item?.tags?.[0]?.tagId ? getItemTagDef(item.tags[0].tagId) : null;
  if (firstTag?.colorHex) return firstTag.colorHex;
  return TIER_COLORS[item?.tier | 0] || '#7dd6ff';
}

export function getItemGlyph(item) {
  switch (item?.categoryId) {
    case ITEM_CATEGORY_IDS.WEAPON: return '✶';
    case ITEM_CATEGORY_IDS.LAUNCHER: return '☄';
    case ITEM_CATEGORY_IDS.AMMO: return '◉';
    case ITEM_CATEGORY_IDS.DEFENSE: return '⛨';
    case ITEM_CATEGORY_IDS.ENGINE: return '➤';
    case ITEM_CATEGORY_IDS.MODULE: return '◆';
    case ITEM_CATEGORY_IDS.CONVERTER: return '↻';
    default: return '•';
  }
}


export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatBonusLabel(key, value) {
  const amount = Number.isFinite(value) ? value : 0;
  if (!amount) return '';
  switch (key) {
    case 'hpFlat': return `+${Math.round(amount)} coque`;
    case 'shieldFlat': return `+${Math.round(amount)} bouclier`;
    case 'energyFlat': return `+${Math.round(amount)} énergie`;
    case 'energyRegenFlat': return `+${amount.toFixed(2)} énergie/s`;
    case 'energyRegenPct': return `+${Math.round(amount * 100)}% régén. énergie`;
    case 'hullRegenFlat': return `+${amount.toFixed(2)} coque/s`;
    case 'enginePct': return `+${Math.round(amount * 100)}% moteur`;
    case 'damageMultPct': return `+${Math.round(amount * 100)}% dégâts`;
    case 'fireRatePct': return `+${Math.round(amount * 100)}% cadence auto`;
    case 'cooldownReductionPct': return `+${Math.round(amount * 100)}% CDR`;
    case 'critChancePct': return `+${Math.round(amount * 100)}% critique auto`;
    case 'critDamagePct': return `+${Math.round(amount * 100)}% dégâts critiques`;
    case 'lifestealPct': return `+${Math.round(amount * 100)}% vol de vie`;
    case 'healPowerPct': return `+${Math.round(amount * 100)}% soins`;
    case 'cargoFlat': return `+${Math.round(amount)} soute`;
    case 'rocketDamagePct': return `+${Math.round(amount * 100)}% dégâts roquettes`;
    case 'autoRangePct': return `+${Math.round(amount * 100)}% portée auto`;
    case 'armorFlat': return `+${Math.round(amount)} armure`;
    case 'shieldPenPct': return `+${Math.round(amount * 100)}% pénétration bouclier`;
    case 'armorPenFlat': return `+${Math.round(amount)} pénétration armure`;
    default: return '';
  }
}

export function getItemShortTag(item) {
  const firstTag = item?.tags?.[0]?.tagId ? getItemTagDef(item.tags[0].tagId) : null;
  return firstTag?.short || '';
}

export function getItemTagText(item) {
  return (item?.tags || []).map((entry) => {
    const def = getItemTagDef(entry.tagId);
    if (!def) return null;
    const pts = Math.max(1, entry.points | 0);
    return `${def.name} ${'●'.repeat(pts)}`;
  }).filter(Boolean).join(' • ');
}

function getProfileText(item) {
  const parts = [];
  const weapon = item?.weaponProfile;
  if (weapon) parts.push(`${Math.round(weapon.damage || 0)} dégâts • ${Number(weapon.cooldown || 0).toFixed(2)}s • ${Math.round(weapon.range || 0)} portée`);
  const launcher = item?.launcherProfile;
  if (launcher) parts.push(`Salve ${Math.max(1, launcher.volley | 0)} • ${Number(launcher.cooldown || 0).toFixed(1)}s • ${Math.round(launcher.range || 0)} portée`);
  const converter = item?.converterProfile;
  if (converter) parts.push(`${converter.inputAmount || 0} ${converter.inputKey} → ${converter.outputAmount || 0} ${converter.outputKey} • ${Number(converter.seconds || 0).toFixed(1)}s`);
  const ammo = item?.ammoProfile;
  if (ammo) parts.push(`${Math.round(ammo.damage || 0)} dégâts roquette`);
  return parts.join(' • ');
}

export function getItemBonusText(item) {
  const bonusText = Object.entries(item?.bonuses || {})
    .map(([key, value]) => formatBonusLabel(key, value))
    .filter(Boolean)
    .join(' • ');
  const profileText = getProfileText(item);
  return [bonusText, profileText].filter(Boolean).join(' • ');
}


export function getItemMetaText(item) {
  const category = getItemCategoryName(item?.categoryId);
  const tier = `T${Math.max(1, item?.tier | 0)}`;
  const state = item?.equipped ? 'équipé' : item?.owned ? 'possédé' : '';
  return [category, tier, state].filter(Boolean).join(' • ');
}

export function getItemStatLines(item) {
  const lines = [];
  const bonuses = Object.entries(item?.bonuses || {})
    .map(([key, value]) => formatBonusLabel(key, value))
    .filter(Boolean);
  lines.push(...bonuses);

  const weapon = item?.weaponProfile;
  if (weapon) {
    lines.push(`${Math.round(weapon.damage || 0)} dégâts auto`);
    lines.push(`${Number(weapon.cooldown || 0).toFixed(2)}s cadence`);
    lines.push(`${Math.round(weapon.range || 0)} portée`);
  }

  const launcher = item?.launcherProfile;
  if (launcher) {
    lines.push(`${Math.max(1, launcher.volley | 0)} roquettes / salve`);
    lines.push(`${Number(launcher.cooldown || 0).toFixed(1)}s recharge`);
    lines.push(`${Math.round(launcher.range || 0)} portée`);
  }

  const ammo = item?.ammoProfile;
  if (ammo) {
    lines.push(`${Math.round(ammo.damage || 0)} dégâts roquette`);
  }

  const converter = item?.converterProfile;
  if (converter) {
    lines.push(`${Math.max(1, converter.inputAmount | 0)} ${converter.inputKey || '?'} → ${Math.max(1, converter.outputAmount | 0)} ${converter.outputKey || '?'}`);
    lines.push(`${Number(converter.seconds || 0).toFixed(1)}s / cycle`);
    if (Number.isFinite(converter.energyPerSecond)) lines.push(`${Number(converter.energyPerSecond || 0).toFixed(2)} énergie/s`);
  }

  return lines.filter(Boolean);
}

function getAmmoPassiveLines(item) {
  const ammo = item?.ammoProfile;
  if (!ammo?.effectType) return [];
  const duration = Number(ammo.effectDuration || 0);
  const magnitude = Number(ammo.effectMagnitude || 0);
  if (ammo.effectType === 'slow') return [`Ralentit les cibles touchées de ${Math.round(magnitude * 100)}% pendant ${duration.toFixed(1)}s`];
  if (ammo.effectType === 'burn') return [`Brûle les cibles touchées : ${magnitude.toFixed(1)} dégâts/s pendant ${duration.toFixed(1)}s`];
  if (ammo.effectType === 'stun') return [`Étourdit les cibles touchées pendant ${duration.toFixed(1)}s`];
  return [ammo.summary || ammo.effectType].filter(Boolean);
}

export function getItemPassiveLines(item) {
  const raw = item?.passives || item?.passiveEffects || item?.passive || null;
  const lines = [];
  if (Array.isArray(raw)) lines.push(...raw.map((entry) => typeof entry === 'string' ? entry : (entry?.name || entry?.text || entry?.description || '')).filter(Boolean));
  else if (typeof raw === 'string') lines.push(raw);
  else if (raw) lines.push(raw.name || raw.text || raw.description || 'Passif');
  lines.push(...getAmmoPassiveLines(item));
  return lines.filter(Boolean);
}

export function getItemActiveLines(item) {
  const raw = item?.actives || item?.activeEffects || item?.active || null;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((entry) => typeof entry === 'string' ? entry : (entry?.name || entry?.text || entry?.description || '')).filter(Boolean);
  if (typeof raw === 'string') return [raw];
  return [raw.name || raw.text || raw.description || 'Actif'].filter(Boolean);
}

export function renderStationInfoSection(title, body, opts = {}) {
  const content = Array.isArray(body)
    ? body.filter(Boolean).map((line) => `<div class="station-info-row">${escapeHtml(line)}</div>`).join('')
    : String(body || '');
  const empty = opts.emptyText ? `<div class="station-info-muted">${escapeHtml(opts.emptyText)}</div>` : '';
  return `
    <section class="station-info-section">
      <div class="station-info-section__title">${escapeHtml(title)}</div>
      <div class="station-info-section__body">${content || empty}</div>
    </section>
  `;
}

export function renderStationChips(lines, emptyText = 'Aucun') {
  const safe = (lines || []).filter(Boolean);
  if (!safe.length) return `<span class="station-info-muted">${escapeHtml(emptyText)}</span>`;
  return safe.map((line) => `<span class="station-info-chip">${escapeHtml(line)}</span>`).join('');
}

export function renderItemSections(item, opts = {}) {
  const tags = getItemTagText(item);
  const stats = getItemStatLines(item);
  const passive = getItemPassiveLines(item);
  const active = getItemActiveLines(item);
  const identity = [];
  if (opts.status) identity.push(opts.status);
  if (opts.source) identity.push(opts.source);
  return [
    renderStationInfoSection('Type', identity),
    renderStationInfoSection('Tags', renderStationChips(tags ? tags.split(' • ') : [], 'Aucun tag')),
    renderStationInfoSection('Stats', renderStationChips(stats, 'Aucune stat brute')),
    renderStationInfoSection('Passif', renderStationChips(passive, 'Aucun passif')),
    renderStationInfoSection('Actif', renderStationChips(active, 'Aucun actif'))
  ].join('');
}

export function getItemTooltipText(item) {
  if (!item) return 'Item';
  const lines = [];
  lines.push(`${item.name || 'Item'} [T${Math.max(1, item?.tier | 0)}]`);
  lines.push(getItemCategoryName(item?.categoryId));
  const tagText = getItemTagText(item);
  if (tagText) lines.push(tagText);
  lines.push(...getItemStatLines(item));
  const passive = getItemPassiveLines(item);
  if (passive.length) lines.push(`Passif : ${passive.join(' • ')}`);
  const active = getItemActiveLines(item);
  if (active.length) lines.push(`Actif : ${active.join(' • ')}`);
  return lines.filter(Boolean).join('\n');
}

export function buildItemIconMarkup(item, opts = {}, tagName = 'button') {
  const accent = getItemAccentColor(item);
  const glyph = getItemGlyph(item);
  const shortTag = getItemShortTag(item);
  const classes = [
    'station-item-icon',
    opts.selected ? 'is-selected' : '',
    item?.owned ? 'is-owned' : '',
    item?.equipped ? 'is-equipped' : '',
    opts.compact ? 'is-compact' : ''
  ].filter(Boolean).join(' ');
  const tier = Math.max(1, item?.tier | 0);
  const badge = shortTag ? `<span class="station-item-icon__tag">${shortTag}</span>` : '';
  const equipped = item?.equipped ? '<span class="station-item-icon__equip">E</span>' : '';
  const label = opts.showName ? `<span class="station-item-icon__label">${item?.shortName || item?.name || getItemCategoryName(item?.categoryId)}</span>` : '';
  const attrs = [];
  const tooltip = getItemTooltipText(item).replace(/"/g, '&quot;');
  if (tagName === 'button') {
    attrs.push('type="button"');
    attrs.push(`data-item-id="${item?.itemId || ''}"`);
    attrs.push(`aria-label="${item?.name || 'Item'}"`);
    attrs.push(`title="${tooltip}"`);
  }
  return `
    <${tagName}
      class="${classes}"
      ${attrs.join(' ')}
      style="--item-accent:${accent}"
    >
      <span class="station-item-icon__tier">${tier}</span>
      ${badge}
      ${equipped}
      <span class="station-item-icon__glyph">${glyph}</span>
      ${label}
    </${tagName}>
  `;
}

export function buildItemIconButton(item, opts = {}) {
  return buildItemIconMarkup(item, opts, 'button');
}
