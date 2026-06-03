const TRACKS = [
  {
    id: 'drift',
    tempo: 66,
    root: 146.83,
    scale: [0, 2, 3, 7, 9, 10],
    progression: [[0, 3, 7], [-2, 2, 7], [-5, 0, 5], [-7, -3, 2]],
    lead: [7, 9, 10, 14, 12, 10, 9, 7, 5, 7],
    bars: 14,
    color: 'warm',
    density: 0.48,
    pulseEvery: 4
  },
  {
    id: 'orbit',
    tempo: 58,
    root: 174.61,
    scale: [0, 2, 5, 7, 9],
    progression: [[0, 5, 9], [-3, 2, 7], [-5, 0, 5], [-8, -3, 2]],
    lead: [9, 7, 5, 2, 0, 2, 5, 7, 12, 9],
    bars: 16,
    color: 'clear',
    density: 0.38,
    pulseEvery: 5
  },
  {
    id: 'frontier',
    tempo: 72,
    root: 130.81,
    scale: [0, 2, 4, 7, 11],
    progression: [[0, 4, 7, 11], [-5, 0, 4, 7], [-8, -1, 4, 7], [-3, 2, 7, 11]],
    lead: [11, 14, 12, 9, 7, 4, 7, 9, 11, 16],
    bars: 12,
    color: 'wide',
    density: 0.56,
    pulseEvery: 3
  },
  {
    id: 'umbra',
    tempo: 52,
    root: 110.00,
    scale: [0, 1, 5, 7, 8, 10],
    progression: [[0, 5, 10], [-4, 1, 7], [-7, 0, 5], [-2, 3, 8]],
    lead: [10, 8, 7, 5, 1, 0, 5, 7, 8],
    bars: 18,
    color: 'dark',
    density: 0.32,
    pulseEvery: 6
  },
  {
    id: 'anomaly',
    tempo: 63,
    root: 196.00,
    scale: [0, 3, 4, 6, 9, 11],
    progression: [[0, 4, 11], [-1, 3, 9], [-6, 0, 6], [-4, 3, 11]],
    lead: [11, 9, 6, 4, 3, 0, 3, 6, 13, 11],
    bars: 15,
    color: 'glass',
    density: 0.44,
    pulseEvery: 4
  },
  {
    id: 'deepfield',
    tempo: 48,
    root: 98.00,
    scale: [0, 2, 3, 5, 7, 10],
    progression: [[0, 3, 10], [-5, 0, 7], [-8, -3, 5], [-10, -5, 2]],
    lead: [7, 10, 12, 10, 7, 5, 3, 2, 0],
    bars: 20,
    color: 'soft',
    density: 0.26,
    pulseEvery: 7
  }
];

function midiRatio(semi) { return Math.pow(2, semi / 12); }
function note(root, semi, octave = 0) { return root * midiRatio(semi + octave * 12); }

function makeGain(ctx, destination, value = 0) {
  const gain = ctx.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}

function createNoiseBuffer(ctx, seconds = 1.8) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let low = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    low = low * 0.92 + white * 0.08;
    data[i] = low * 0.7 + white * 0.06;
  }
  return buffer;
}

function scheduleTone(ctx, dest, freq, start, duration, opts = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const type = opts.type || 'sine';
  const amp = Math.max(0.0001, opts.amp ?? 0.02);
  const attack = Math.max(0.01, opts.attack ?? 0.5);
  const release = Math.max(0.05, opts.release ?? 1.2);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, start);
  if (opts.drift) {
    osc.frequency.linearRampToValueAtTime(freq * (1 + opts.drift), start + duration * 0.72);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(amp, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.05, duration + release));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + duration + release + 0.08);
}

function scheduleNoiseWash(ctx, dest, start, duration, color = 'soft', amp = 0.006) {
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = createNoiseBuffer(ctx, Math.min(3.0, Math.max(1.0, duration)));
  src.loop = true;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(color === 'dark' ? 210 : color === 'glass' ? 1250 : 520, start);
  filter.Q.setValueAtTime(color === 'glass' ? 1.8 : 0.55, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(amp, start + 2.0);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(start);
  src.stop(start + duration + 0.1);
}

function scheduleChord(ctx, dest, root, chord, start, beat, velocity = 1, color = 'soft') {
  const chordAmp = color === 'dark' ? 0.008 : color === 'glass' ? 0.007 : 0.010;
  for (const semi of chord) {
    const f = note(root, semi, 0);
    scheduleTone(ctx, dest, f, start, beat * 3.8, { type: 'sine', amp: chordAmp * velocity, attack: 1.2, release: 3.1, drift: color === 'glass' ? 0.002 : 0 });
    scheduleTone(ctx, dest, f * 2, start + 0.06, beat * 2.7, { type: color === 'glass' ? 'sine' : 'triangle', amp: 0.0045 * velocity, attack: 1.4, release: 2.3, detune: -3 });
  }
  scheduleTone(ctx, dest, note(root, chord[0], -1), start, beat * 4.1, { type: 'sine', amp: 0.0095 * velocity, attack: 1.6, release: 3.7 });
}

function scheduleArp(ctx, dest, track, start, beat, bar, total, variant) {
  const every = Math.max(2, track.pulseEvery || 4);
  const steps = Math.floor(total / (beat * 0.5));
  for (let i = 0; i < steps; i += every) {
    const t = start + bar * 2 + i * beat * 0.5;
    if (t > start + total - 4) break;
    const semi = track.scale[(i + variant + track.id.length) % track.scale.length] + (i % 4 === 0 ? 12 : 0);
    scheduleTone(ctx, dest, note(track.root, semi, 1), t, beat * 0.55, {
      type: track.color === 'glass' ? 'sine' : 'triangle',
      amp: 0.0035 + track.density * 0.004,
      attack: 0.05,
      release: 0.8,
      detune: (i % 2 ? 3 : -3)
    });
  }
}

function scheduleLead(ctx, dest, track, start, beat, bar, total, variant) {
  const offset = variant % track.lead.length;
  for (let i = 0; i < track.lead.length + 4; i += 1) {
    const gap = (i % 3 === 0 ? 1.5 : 1) * beat;
    const t = start + bar * (1.2 + (variant % 3) * 0.45) + i * gap * (1.55 + (variant % 2) * 0.20);
    if (t > start + total - 3) break;
    const semi = track.lead[(i + offset) % track.lead.length];
    scheduleTone(ctx, dest, note(track.root, semi, 1), t, beat * (1.0 + (i % 2) * 0.7), {
      type: track.color === 'dark' ? 'sine' : 'triangle',
      amp: 0.006 + track.density * 0.008,
      attack: 0.08,
      release: 1.5,
      detune: i % 2 ? 4 : -4,
      drift: track.color === 'anomaly' ? 0.003 : 0
    });
  }
}

function scheduleTrack(ctx, destination, track, start, variant = 0) {
  const master = makeGain(ctx, destination, 0.0001);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(track.color === 'dark' ? 1150 : 1850 + track.density * 900, start);
  filter.frequency.linearRampToValueAtTime(track.color === 'glass' ? 2600 : 2100 + track.density * 950, start + 10);
  filter.Q.setValueAtTime(track.color === 'glass' ? 0.85 : 0.42, start);
  master.disconnect();
  master.connect(filter);
  filter.connect(destination);

  master.gain.setValueAtTime(0.0001, start);
  master.gain.linearRampToValueAtTime(0.34 + track.density * 0.10, start + 4.5);

  const beat = 60 / track.tempo;
  const bar = beat * 4;
  const total = track.bars * bar;

  scheduleNoiseWash(ctx, master, start + beat * 2, total - beat * 4, track.color, 0.0025 + track.density * 0.006);

  for (let i = 0; i < track.bars; i += 1) {
    const chord = track.progression[(i + variant) % track.progression.length];
    const vel = 0.82 + (i % 4 === 0 ? 0.18 : 0) + ((variant + i) % 7 === 0 ? 0.10 : 0);
    scheduleChord(ctx, master, track.root, chord, start + i * bar, beat, vel, track.color);
  }

  scheduleLead(ctx, master, track, start, beat, bar, total, variant);
  scheduleArp(ctx, master, track, start, beat, bar, total, variant);

  for (let i = 0; i < Math.floor(track.bars / 2); i += 1) {
    const semi = track.scale[(i * 2 + track.id.length + variant) % track.scale.length];
    scheduleTone(ctx, master, note(track.root, semi, 2), start + (i * 2 + 1) * bar + beat * 0.5, beat * (1.5 + track.density), {
      type: 'sine', amp: 0.004 + track.density * 0.004, attack: 0.12, release: 1.9
    });
  }

  if (track.density > 0.42) {
    for (let i = 0; i < track.bars; i += 4) {
      scheduleTone(ctx, master, note(track.root, track.scale[(i + variant) % track.scale.length], -1), start + i * bar + beat * 2.0, beat * 1.8, {
        type: 'sine', amp: 0.006, attack: 0.4, release: 1.4
      });
    }
  }

  master.gain.setValueAtTime(0.34 + track.density * 0.10, start + Math.max(5, total - 6));
  master.gain.exponentialRampToValueAtTime(0.0001, start + total);
  return total;
}

export class MusicPlaylist {
  constructor() {
    this.enabled = true;
    this.nextStartAt = 0;
    this.activeUntil = 0;
    this.lastTrack = '';
    this.master = null;
    this.volume = 0.42;
    this.manifestLoaded = false;
    this.manifestLoading = false;
    this.fileTracks = [];
    this.audioEl = null;
    this.audioTrack = '';
    this.variant = 0;
  }

  ensure(ctx) {
    if (this.master || !ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.master.context.currentTime, 0.08);
    if (this.audioEl) this.audioEl.volume = this.volume;
  }

  async loadManifest() {
    if (this.manifestLoaded || this.manifestLoading) return;
    this.manifestLoading = true;
    try {
      const res = await fetch('/client/assets/music/index.json', { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.tracks) ? raw.tracks : []);
        this.fileTracks = arr.map((entry) => {
          if (typeof entry === 'string') return { src: `/client/assets/music/${encodeURIComponent(entry)}`, id: entry };
          if (entry?.src) {
            const src = String(entry.src);
            return { src: src.startsWith('/') || src.startsWith('http') ? src : `/client/assets/music/${encodeURIComponent(src)}`, id: entry.id || entry.title || src };
          }
          return null;
        }).filter(Boolean);
      }
    } catch {}
    this.manifestLoaded = true;
    this.manifestLoading = false;
  }

  isFileAudioBusy(ctx) {
    if (!this.audioEl || this.audioEl.paused || this.audioEl.ended) return false;
    this.activeUntil = Math.max(this.activeUntil, ctx.currentTime + 2);
    return true;
  }

  playFileTrack(ctx, track) {
    if (!track?.src) return false;
    try {
      if (!this.audioEl) {
        this.audioEl = new Audio();
        this.audioEl.preload = 'auto';
      }
      this.audioEl.pause();
      this.audioEl.src = track.src;
      this.audioEl.volume = this.volume;
      this.audioEl.loop = false;
      this.audioTrack = track.id || track.src;
      this.audioEl.onended = () => {
        this.activeUntil = ctx.currentTime;
        this.nextStartAt = ctx.currentTime + 14 + Math.random() * 30;
      };
      this.audioEl.play().catch(() => {});
      this.lastTrack = this.audioTrack;
      this.activeUntil = ctx.currentTime + 999999;
      return true;
    } catch {
      return false;
    }
  }

  update(ctx) {
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    this.ensure(ctx);
    if (!this.manifestLoaded) this.loadManifest();
    const now = ctx.currentTime;
    if (!this.nextStartAt) this.nextStartAt = now + 2 + Math.random() * 6;
    if (this.isFileAudioBusy(ctx)) return;
    if (now < this.nextStartAt || now < this.activeUntil) return;

    if (this.fileTracks.length) {
      const choices = this.fileTracks.filter((t) => t.id !== this.lastTrack);
      const track = choices[Math.floor(Math.random() * choices.length)] || this.fileTracks[0];
      if (this.playFileTrack(ctx, track)) return;
    }

    const choices = TRACKS.filter((t) => t.id !== this.lastTrack);
    const track = choices[Math.floor(Math.random() * choices.length)] || TRACKS[0];
    const start = now + 0.12;
    this.variant = (this.variant + 1 + Math.floor(Math.random() * 4)) | 0;
    const duration = scheduleTrack(ctx, this.master, track, start, this.variant);
    this.lastTrack = track.id;
    this.activeUntil = start + duration;
    this.nextStartAt = this.activeUntil + 12 + Math.random() * 28;
  }
}
