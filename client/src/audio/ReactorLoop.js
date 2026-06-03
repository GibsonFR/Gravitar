import { getEngineToneProfile } from './EngineToneProfiles.js';

function makeNoiseBuffer(ctx) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * 1.2));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = last * 0.82 + white * 0.18;
    data[i] = last * 0.65 + white * 0.12;
  }
  return buffer;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export class ReactorLoop {
  constructor() {
    this.ready = false;
    this.master = null;
    this.osc = null;
    this.subOsc = null;
    this.noise = null;
    this.filter = null;
    this.noiseFilter = null;
    this.oscGain = null;
    this.subGain = null;
    this.noiseGain = null;
    this.lfo = null;
    this.lfoGain = null;
    this.lastIntensity = 0;
    this.lastFrameId = '';
    this.volume = 1;
  }

  ensure(ctx) {
    if (this.ready || !ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 180;
    this.filter.Q.value = 0.55;

    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.value = 240;
    this.noiseFilter.Q.value = 0.45;

    this.osc = ctx.createOscillator();
    this.osc.type = 'triangle';
    this.osc.frequency.value = 44;
    this.oscGain = ctx.createGain();
    this.oscGain.gain.value = 0.24;

    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subOsc.frequency.value = 22;
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.15;

    this.noise = ctx.createBufferSource();
    this.noise.buffer = makeNoiseBuffer(ctx);
    this.noise.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.040;

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.45;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 1.2;

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.osc.frequency);

    this.osc.connect(this.oscGain);
    this.subOsc.connect(this.subGain);
    this.noise.connect(this.noiseGain);

    this.oscGain.connect(this.filter);
    this.subGain.connect(this.filter);
    this.noiseGain.connect(this.noiseFilter);
    this.noiseFilter.connect(this.filter);
    this.filter.connect(this.master);
    this.master.connect(ctx.destination);

    this.osc.start();
    this.subOsc.start();
    this.noise.start();
    this.lfo.start();
    this.ready = true;
  }

  setVolume(value) {
    this.volume = clamp01(value);
  }

  applyProfile(ctx, profile, now) {
    if (!profile || profile.id === this.lastFrameId) return;
    this.lastFrameId = profile.id;

    this.osc.type = profile.oscType || 'triangle';
    this.subOsc.type = profile.subType || 'sine';

    this.oscGain.gain.setTargetAtTime(profile.oscGain ?? 0.24, now, 0.18);
    this.subGain.gain.setTargetAtTime(profile.subGain ?? 0.14, now, 0.22);
    this.noiseGain.gain.setTargetAtTime(profile.noiseGain ?? 0.04, now, 0.25);
    this.filter.Q.setTargetAtTime(profile.q ?? 0.55, now, 0.25);
    this.lfo.frequency.setTargetAtTime(profile.vibratoRate ?? 0.45, now, 0.35);
    this.lfoGain.gain.setTargetAtTime(profile.vibratoDepth ?? 1.2, now, 0.35);

    const noiseColor = profile.noiseColor || 'soft';
    const noiseFreq = noiseColor === 'heavy' ? 155 : noiseColor === 'warm' ? 210 : 285;
    this.noiseFilter.frequency.setTargetAtTime(noiseFreq, now, 0.30);
  }

  update(ctx, me, input) {
    if (!ctx || ctx.state !== 'running') return;
    this.ensure(ctx);

    const profile = getEngineToneProfile(me?.frameId);
    const now = ctx.currentTime;
    this.applyProfile(ctx, profile, now);

    const speed = Math.hypot(me?.vx || 0, me?.vy || 0);
    const thrust = clamp01(me?._localThrust);
    const speedIntensity = speed > 10 ? Math.min(1, speed / 520) : 0;
    const target = Math.max(speedIntensity, thrust * 0.50);
    const smoothing = target > this.lastIntensity ? Math.max(0.035, profile.attack ?? 0.20) : Math.max(0.055, profile.release ?? 0.42);
    this.lastIntensity += (target - this.lastIntensity) * Math.min(1, smoothing);
    if (this.lastIntensity < 0.008 && target <= 0) this.lastIntensity = 0;

    const intensity = this.lastIntensity;
    const idleGain = profile.idleGain ?? 0.0024;
    const movementGain = profile.movementGain ?? 0.022;
    const amp = (idleGain + Math.pow(intensity, 1.25) * movementGain) * this.volume;

    this.master.gain.setTargetAtTime(Math.max(0.0001, amp), now, 0.12);

    const baseFreq = profile.baseFreq ?? 44;
    const thrustFreq = profile.thrustFreq ?? 32;
    const pitch = baseFreq + Math.pow(intensity, 0.75) * thrustFreq;
    this.osc.frequency.setTargetAtTime(pitch, now, 0.16);
    this.subOsc.frequency.setTargetAtTime(pitch * (profile.subFreq ?? 0.5), now, 0.18);

    const filterFreq = (profile.filterBase ?? 150) + Math.pow(intensity, 0.85) * (profile.filterThrust ?? 340);
    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.18);

    const noiseOpen = (profile.noiseColor === 'heavy' ? 160 : 230) + intensity * (profile.noiseColor === 'soft' ? 420 : 260);
    this.noiseFilter.frequency.setTargetAtTime(noiseOpen, now, 0.20);
  }
}
