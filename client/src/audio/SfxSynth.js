import { SFX_TYPES } from './SfxTypes.js';
import { getFrameAbilitySfx, getFrameSfxProfile } from './FrameSfxProfiles.js';

function applyEnvelope(gain, now, attack, release, amp) {
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(amp, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
}

function createTone(ctx, type, freq, start, duration, amp, destination = ctx.destination, opts = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (opts.endFreq && opts.endFreq > 0) {
    osc.frequency.exponentialRampToValueAtTime(opts.endFreq, start + Math.max(0.012, duration * 0.72));
  }
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, start);
  osc.connect(gain);
  gain.connect(destination);
  applyEnvelope(gain, start, opts.attack ?? 0.004, Math.max(0.03, opts.release ?? (duration - 0.004)), amp);
  osc.start(start);
  osc.stop(start + duration + 0.04);
  return { osc, gain };
}

function createNoiseHit(ctx, start, duration, amp, destination, color = 'soft') {
  const length = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.03, duration)));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let low = 0;
  for (let i = 0; i < length; i += 1) {
    const w = Math.random() * 2 - 1;
    low = low * 0.78 + w * 0.22;
    data[i] = color === 'heavy' ? low : (low * 0.45 + w * 0.18);
  }
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buffer;
  filter.type = color === 'glass' ? 'highpass' : 'bandpass';
  filter.frequency.value = color === 'heavy' ? 190 : color === 'glass' ? 1480 : 620;
  filter.Q.value = color === 'heavy' ? 0.55 : 1.1;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(amp, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start(start);
  src.stop(start + duration + 0.02);
}

function playAutoAttack(ctx, ev, destination = ctx.destination) {
  const now = ctx.currentTime;
  const profile = getFrameSfxProfile(ev.frameId);
  const auto = profile.auto;
  const variant = ev.variant | 0;
  const wobble = 1 + ((variant % 5) - 2) * 0.012;

  createTone(ctx, auto.type || 'triangle', auto.base * wobble, now, 0.070, auto.amp, destination, {
    endFreq: (auto.end || auto.base * 0.75) * wobble,
    attack: profile.id === 'sigil' ? 0.006 : 0.003,
    release: profile.id === 'bulwark' ? 0.090 : 0.060
  });

  if (profile.id === 'sigil') {
    createTone(ctx, 'sine', auto.base * 1.72 * wobble, now + 0.018, 0.100, 0.011, destination, { endFreq: auto.base * 2.05 * wobble, attack: 0.012, release: 0.12 });
  } else if (profile.id === 'bulwark') {
    createTone(ctx, 'sine', auto.base * 0.48 * wobble, now, 0.115, 0.018, destination, { endFreq: auto.base * 0.38 * wobble, attack: 0.003, release: 0.13 });
    createNoiseHit(ctx, now + 0.006, 0.075, auto.click || 0.012, destination, 'heavy');
  } else {
    createTone(ctx, 'sine', auto.base * 1.38 * wobble, now + 0.014, 0.070, 0.010, destination, { attack: 0.004, release: 0.09 });
    createNoiseHit(ctx, now + 0.004, 0.040, auto.click || 0.009, destination, auto.color || 'soft');
  }
}

function playRocket(ctx, ev, destination = ctx.destination) {
  const now = ctx.currentTime;
  const frame = getFrameSfxProfile(ev.frameId);
  const heavy = frame.id === 'bulwark';
  createTone(ctx, heavy ? 'triangle' : 'sawtooth', heavy ? 140 : 180, now, 0.20, heavy ? 0.060 : 0.050, destination, { endFreq: heavy ? 42 : 58, attack: 0.004, release: 0.21 });
  createTone(ctx, 'triangle', (heavy ? 520 : 720) + (ev.variant % 3) * 70, now + 0.012, 0.055, heavy ? 0.020 : 0.018, destination, { attack: 0.004, release: 0.07 });
  createNoiseHit(ctx, now, 0.18, heavy ? 0.030 : 0.018, destination, heavy ? 'heavy' : 'soft');
}

function playAbility(ctx, ev, slot, destination = ctx.destination) {
  const now = ctx.currentTime;
  const spec = getFrameAbilitySfx(ev.frameId, slot);
  const frame = getFrameSfxProfile(ev.frameId);
  const base = spec.base || 640;
  const amp = spec.amp || 0.032;

  if (frame.id === 'vanguard') {
    createTone(ctx, spec.type || 'triangle', base, now, slot === 'R' ? 0.26 : 0.13, amp, destination, { endFreq: slot === 'Z' ? base * 0.58 : base * 0.78, attack: 0.004, release: slot === 'R' ? 0.30 : 0.15 });
    createTone(ctx, 'sine', spec.second || base * 1.5, now + 0.030, 0.12, amp * 0.52, destination, { attack: 0.010, release: 0.17 });
    if (spec.low) createTone(ctx, 'sine', spec.low, now, slot === 'R' ? 0.34 : 0.16, amp * 0.55, destination, { endFreq: spec.low * 0.72, attack: 0.006, release: 0.22 });
    createNoiseHit(ctx, now + 0.006, slot === 'R' ? 0.22 : 0.08, amp * 0.42, destination, 'warm');
    return;
  }

  if (frame.id === 'sigil') {
    createTone(ctx, 'sine', base, now, slot === 'R' ? 0.30 : 0.16, amp, destination, { endFreq: (spec.second || base * 1.35), attack: 0.018, release: slot === 'R' ? 0.38 : 0.22 });
    createTone(ctx, 'sine', (spec.second || base * 1.5) * 1.01, now + 0.045, 0.18, amp * 0.48, destination, { detune: 7, attack: 0.020, release: 0.30 });
    if (spec.low) createTone(ctx, 'triangle', spec.low, now + 0.018, 0.20, amp * 0.30, destination, { attack: 0.018, release: 0.28 });
    createNoiseHit(ctx, now + 0.018, slot === 'R' ? 0.20 : 0.10, amp * 0.18, destination, 'glass');
    return;
  }

  if (frame.id === 'bulwark') {
    createTone(ctx, 'triangle', base, now, slot === 'R' ? 0.34 : 0.18, amp, destination, { endFreq: base * 0.55, attack: 0.004, release: slot === 'R' ? 0.36 : 0.20 });
    if (spec.low) createTone(ctx, 'sine', spec.low, now, slot === 'R' ? 0.42 : 0.22, amp * 0.70, destination, { endFreq: spec.low * 0.62, attack: 0.006, release: 0.30 });
    createNoiseHit(ctx, now + 0.004, slot === 'R' ? 0.26 : 0.13, amp * 0.58, destination, 'heavy');
    createTone(ctx, 'sine', spec.second || base * 1.5, now + 0.055, 0.12, amp * 0.24, destination, { attack: 0.012, release: 0.18 });
    return;
  }

  createTone(ctx, spec.type || 'triangle', base, now, slot === 'R' ? 0.24 : 0.12, amp, destination, { endFreq: base * 0.75, attack: 0.006, release: slot === 'R' ? 0.28 : 0.15 });
  createTone(ctx, 'sine', spec.second || base * 1.5, now + 0.035, 0.10, amp * 0.52, destination);
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
  if (ev.type === SFX_TYPES.AUTO_ATTACK) return playAutoAttack(ctx, ev, destination);
  if (ev.type === SFX_TYPES.COLLECT) return playCollect(ctx, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.ROCKET) return playRocket(ctx, ev, destination);
  if (ev.type === SFX_TYPES.ABILITY_A) return playAbility(ctx, ev, 'A', destination);
  if (ev.type === SFX_TYPES.ABILITY_Z) return playAbility(ctx, ev, 'Z', destination);
  if (ev.type === SFX_TYPES.ABILITY_E) return playAbility(ctx, ev, 'E', destination);
  if (ev.type === SFX_TYPES.ABILITY_R) return playAbility(ctx, ev, 'R', destination);
  if (ev.type === SFX_TYPES.DAMAGE_SHIELD) return playDamage(ctx, true, ev.variant | 0, destination);
  if (ev.type === SFX_TYPES.DAMAGE_HULL) return playDamage(ctx, false, ev.variant | 0, destination);
}
