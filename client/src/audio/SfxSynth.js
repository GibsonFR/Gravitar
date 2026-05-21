import { SFX_TYPES } from './SfxTypes.js';

function applyEnvelope(gain, now, attack, release, amp) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(amp, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
}

function createTone(ctx, type, freq, start, duration, amp, destination = ctx.destination) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, start, 0.004, Math.max(0.03, duration - 0.004), amp);
  osc.start(start);
  osc.stop(start + duration + 0.02);
  return { osc, gain };
}

function playAutoAttack(ctx, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const base = 1220 - (variant % 3) * 55;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(base * 1.18, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.74, now + 0.055);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, now, 0.003, 0.06, 0.034);
  osc.start(now);
  osc.stop(now + 0.085);

  createTone(ctx, 'triangle', base * 1.95, now, 0.055, 0.012, destination);
}


function playRocket(ctx, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(58, now + 0.16);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, now, 0.004, 0.19, 0.05);
  osc.start(now);
  osc.stop(now + 0.22);
  createTone(ctx, 'triangle', 720 + (variant % 3) * 70, now + 0.012, 0.045, 0.018, destination);
}

function playAbility(ctx, slot, destination = ctx.destination) {
  const now = ctx.currentTime;
  const table = { A: 760, Z: 440, E: 980, R: 260 };
  const base = table[slot] || 640;
  createTone(ctx, slot === 'R' ? 'sawtooth' : 'triangle', base, now, slot === 'R' ? 0.24 : 0.12, slot === 'R' ? 0.045 : 0.032, destination);
  createTone(ctx, 'sine', base * 1.5, now + 0.035, 0.10, 0.018, destination);
  if (slot === 'R') createTone(ctx, 'sawtooth', base * 0.5, now + 0.02, 0.28, 0.026, destination);
}

function playDamage(ctx, shielded, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const base = shielded ? 520 : 155;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = shielded ? 'triangle' : 'square';
  osc.frequency.setValueAtTime(base * (variant ? 1.35 : 1), now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.045);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, now, 0.002, 0.055, shielded ? 0.016 : 0.020);
  osc.start(now);
  osc.stop(now + 0.08);
}

function playCollect(ctx, variant, destination = ctx.destination) {
  const now = ctx.currentTime;
  const root = 520 + (variant % 6) * 38;
  createTone(ctx, 'triangle', root, now, 0.07, 0.03, destination);
  createTone(ctx, 'triangle', root * 1.25, now + 0.028, 0.08, 0.022, destination);
  createTone(ctx, 'sine', root * 1.5, now + 0.056, 0.095, 0.016, destination);
}

export function playSfxEvent(ctx, ev, destination = ctx.destination) {
  if (!ctx || !ev?.type) return;
  if (ev.type === SFX_TYPES.AUTO_ATTACK) return playAutoAttack(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.COLLECT) return playCollect(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.ROCKET) return playRocket(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.ABILITY_A) return playAbility(ctx, 'A', destination);
  if (ev.type === SFX_TYPES.ABILITY_Z) return playAbility(ctx, 'Z', destination);
  if (ev.type === SFX_TYPES.ABILITY_E) return playAbility(ctx, 'E', destination);
  if (ev.type === SFX_TYPES.ABILITY_R) return playAbility(ctx, 'R', destination);
  if (ev.type === SFX_TYPES.DAMAGE_SHIELD) return playDamage(ctx, true, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.DAMAGE_HULL) return playDamage(ctx, false, ev.variant | 0, destination);
}
