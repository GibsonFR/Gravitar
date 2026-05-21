import { BASTION_TYPES, getBastionEffectSummary, getBastionGlyph, getBastionMagnitude, getBastionTypeName, getBastionColor } from './BastionTypes.js';

function list(player) {
  if (!player.bastionBuffs) player.bastionBuffs = [];
  return player.bastionBuffs;
}

export function hasBastionBuff(player, type) {
  return list(player).some((b) => b.type === type);
}

export function grantBastionBuff(player, bastion, timeMs) {
  if (!player || !bastion || hasBastionBuff(player, bastion.type)) return false;
  const magnitude = getBastionMagnitude(bastion.type);
  list(player).push({
    type: bastion.type,
    tier: bastion.tier | 0,
    magnitude,
    sourceLabel: bastion.name || getBastionTypeName(bastion.type),
    grantedAt: timeMs | 0
  });
  player.uiHint = `${bastion.name} résolu • ${getBastionEffectSummary(bastion.type, magnitude)}`;
  player.uiHintTimer = 4.0;
  return true;
}

export function sumBastionBuff(player, type) {
  return list(player)
    .filter((b) => b.type === type)
    .reduce((acc, b) => acc + Math.max(0, Number(b.magnitude || 0)), 0);
}

export function getBastionBuyDiscountPct(player) { return Math.min(80, sumBastionBuff(player, BASTION_TYPES.BUY)); }
export function getBastionSellBonusPct(player) { return sumBastionBuff(player, BASTION_TYPES.SELL); }
export function getBastionDamageMultiplier(player) { return 1 + sumBastionBuff(player, BASTION_TYPES.DAMAGE) / 100; }
export function getBastionDefenseMultiplier(player) { return Math.max(0.25, 1 - sumBastionBuff(player, BASTION_TYPES.DEFENSE) / 100); }
export function getBastionMoveSpeedMultiplier(player) { return 1 + sumBastionBuff(player, BASTION_TYPES.SPEED) / 100; }
export function getBastionVisionMultiplier(player) { return 1 + sumBastionBuff(player, BASTION_TYPES.VISION) / 100; }
export function getBastionCooldownRecoveryMultiplier(player) { return 1 + sumBastionBuff(player, BASTION_TYPES.COOLDOWN) / 100; }
export function getBastionExperienceMultiplier(player) { return 1 + sumBastionBuff(player, BASTION_TYPES.EXPERIENCE) / 100; }
export function getBastionUnlockBiasMs(player) { return hasBastionBuff(player, BASTION_TYPES.HACKER) ? getBastionMagnitude(BASTION_TYPES.HACKER) * 1000 : 0; }

export function getEffectivePurchasePriceCredits(player, baseCredits) {
  const discount = getBastionBuyDiscountPct(player);
  return Math.max(1, Math.round(Math.max(0, baseCredits | 0) * (1 - discount / 100)));
}

export function getEffectiveSellPriceCredits(player, baseCredits) {
  const bonus = getBastionSellBonusPct(player);
  return Math.max(1, Math.round(Math.max(1, baseCredits | 0) * (1 + bonus / 100)));
}

export function buildBastionBuffSnapshot(player) {
  return list(player).map((b) => {
    const magnitude = Math.max(0, Number(b.magnitude || getBastionMagnitude(b.type)));
    return {
      id: `bastion_${b.type}`,
      type: b.type,
      tier: b.tier | 0,
      name: getBastionTypeName(b.type),
      glyph: getBastionGlyph(b.type),
      summary: getBastionEffectSummary(b.type, magnitude),
      sourceLabel: b.sourceLabel || getBastionTypeName(b.type),
      magnitude,
      primaryColor: getBastionColor(b.type),
      secondaryColor: getBastionColor(b.type),
      permanent: true
    };
  });
}
