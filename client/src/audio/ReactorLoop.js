function makeNoiseBuffer(ctx) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * 1.2));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class ReactorLoop {
  constructor() {
    this.ready = false;
    this.master = null;
    this.osc = null;
    this.noise = null;
    this.filter = null;
    this.lastIntensity = 0;
    this.volume = 1;
  }

  ensure(ctx) {
    if (this.ready || !ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 240;
    this.filter.Q.value = 0.8;

    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 54;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.42;
    this.osc.connect(oscGain);
    oscGain.connect(this.filter);

    this.noise = ctx.createBufferSource();
    this.noise.buffer = makeNoiseBuffer(ctx);
    this.noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.22;
    this.noise.connect(noiseGain);
    noiseGain.connect(this.filter);

    this.filter.connect(this.master);
    this.master.connect(ctx.destination);
    this.osc.start();
    this.noise.start();
    this.ready = true;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
  }

  update(ctx, me, input) {
    if (!ctx || ctx.state !== 'running') return;
    this.ensure(ctx);
    const speed = Math.hypot(me?.vx || 0, me?.vy || 0);
    const inputMoving = !!(input?.rightDown || input?.moveWorldQueued || speed > 8);
    const target = inputMoving ? Math.min(1, Math.max(speed / 420, 0.18)) : 0;
    this.lastIntensity += (target - this.lastIntensity) * 0.06;
    const now = ctx.currentTime;
    const amp = 0.0001 + this.lastIntensity * 0.046 * this.volume;
    this.master.gain.setTargetAtTime(amp, now, 0.08);
    this.osc.frequency.setTargetAtTime(48 + this.lastIntensity * 58, now, 0.12);
    this.filter.frequency.setTargetAtTime(180 + this.lastIntensity * 620, now, 0.14);
  }
}
