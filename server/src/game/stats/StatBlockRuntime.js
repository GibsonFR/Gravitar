import { clamp } from '../util/Math.js';

export function consumeEnergy(stats, amount) {
  if (!stats || amount <= 0) return false;
  if (stats.energy < amount) return false;
  stats.energy -= amount;
  return true;
}

export function tickStatBlock(stats, dt) {
  if (!stats) return;

  if (stats.shieldRegenDelayLeft > 0) {
    stats.shieldRegenDelayLeft = Math.max(0, stats.shieldRegenDelayLeft - dt);
  }

  if (stats.energyRegen > 0 && stats.maxEnergy > 0) {
    stats.energy = clamp(stats.energy + stats.energyRegen * dt, 0, stats.maxEnergy);
  }

  if (stats.hullRegen > 0 && stats.maxHp > 0 && stats.hp > 0) {
    stats.hp = clamp(stats.hp + stats.hullRegen * dt, 0, stats.maxHp);
  }

  if (stats.shieldRegenPerSec > 0 && stats.maxShield > 0 && stats.shieldRegenDelayLeft <= 0) {
    stats.shield = clamp(stats.shield + stats.shieldRegenPerSec * dt, 0, stats.maxShield);
  }
}

export function restoreStatBlockFull(stats) {
  if (!stats) return;
  stats.hp = stats.maxHp;
  stats.shield = stats.maxShield;
  stats.energy = stats.maxEnergy;
  stats.shieldRegenDelayLeft = 0;
}

export function applyStatBlockDamage(stats, amount) {
  if (!stats || amount <= 0 || stats.hp <= 0) return false;

  stats.shieldRegenDelayLeft = Math.max(stats.shieldRegenDelayLeft, stats.shieldRegenDelayOnHit ?? 0);

  const onShield = Math.min(stats.shield, amount);
  stats.shield -= onShield;
  stats.hp -= (amount - onShield);

  if (stats.hp <= 0) {
    stats.hp = 0;
    return true;
  }

  return false;
}

export function applyHullDamage(stats, amount) {
  if (!stats || amount <= 0 || stats.hp <= 0) return false;
  stats.hp -= amount;
  if (stats.hp <= 0) {
    stats.hp = 0;
    return true;
  }
  return false;
}

export function healStatBlock(stats, amount) {
  if (!stats || amount <= 0 || stats.hp <= 0) return 0;
  const before = stats.hp;
  stats.hp = clamp(stats.hp + amount, 0, stats.maxHp);
  return stats.hp - before;
}
