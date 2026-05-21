const TRACKS = [
  {
    id: 'drift',
    tempo: 66,
    root: 146.83,
    scale: [0, 2, 3, 7, 9, 10],
    progression: [[0, 3, 7], [-2, 2, 7], [-5, 0, 5], [-7, -3, 2]],
    lead: [7, 9, 10, 14, 12, 10, 9, 7, 5, 7],
    bars: 14
  },
  {
    id: 'orbit',
    tempo: 58,
    root: 174.61,
    scale: [0, 2, 5, 7, 9],
    progression: [[0, 5, 9], [-3, 2, 7], [-5, 0, 5], [-8, -3, 2]],
    lead: [9, 7, 5, 2, 0, 2, 5, 7, 12, 9],
    bars: 16
  },
  {
    id: 'frontier',
    tempo: 72,
    root: 130.81,
    scale: [0, 2, 4, 7, 11],
    progression: [[0, 4, 7, 11], [-5, 0, 4, 7], [-8, -1, 4, 7], [-3, 2, 7, 11]],
    lead: [11, 14, 12, 9, 7, 4, 7, 9, 11, 16],
    bars: 12
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
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(amp, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.05, duration + release));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + duration + release + 0.08);
}

function scheduleChord(ctx, dest, root, chord, start, beat, velocity = 1) {
  for (const semi of chord) {
    const f = note(root, semi, 0);
    scheduleTone(ctx, dest, f, start, beat * 3.6, { type: 'sine', amp: 0.010 * velocity, attack: 1.1, release: 2.8 });
    scheduleTone(ctx, dest, f * 2, start + 0.04, beat * 2.8, { type: 'triangle', amp: 0.0045 * velocity, attack: 1.3, release: 2.1, detune: -3 });
  }
  scheduleTone(ctx, dest, note(root, chord[0], -1), start, beat * 4.0, { type: 'sine', amp: 0.009 * velocity, attack: 1.5, release: 3.5 });
}

function scheduleTrack(ctx, destination, track, start) {
  const master = makeGain(ctx, destination, 0.0001);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1850, start);
  filter.Q.setValueAtTime(0.42, start);
  master.disconnect();
  master.connect(filter);
  filter.connect(destination);

  master.gain.setValueAtTime(0.0001, start);
  master.gain.linearRampToValueAtTime(0.38, start + 4.5);

  const beat = 60 / track.tempo;
  const bar = beat * 4;
  const total = track.bars * bar;
  for (let i = 0; i < track.bars; i += 1) {
    const chord = track.progression[i % track.progression.length];
    scheduleChord(ctx, master, track.root, chord, start + i * bar, beat, 0.9 + (i % 4 === 0 ? 0.15 : 0));
  }

  for (let i = 0; i < track.lead.length; i += 1) {
    const gap = (i % 3 === 0 ? 1.5 : 1) * beat;
    const t = start + bar * 1.5 + i * gap * 1.8;
    if (t > start + total - 3) break;
    scheduleTone(ctx, master, note(track.root, track.lead[i], 1), t, beat * (1.2 + (i % 2) * 0.8), {
      type: 'triangle', amp: 0.010, attack: 0.08, release: 1.6, detune: i % 2 ? 4 : -4
    });
  }

  for (let i = 0; i < Math.floor(track.bars / 2); i += 1) {
    const semi = track.scale[(i * 2 + track.id.length) % track.scale.length];
    scheduleTone(ctx, master, note(track.root, semi, 2), start + (i * 2 + 1) * bar + beat * 0.5, beat * 1.7, {
      type: 'sine', amp: 0.0055, attack: 0.12, release: 1.8
    });
  }

  master.gain.setValueAtTime(0.38, start + Math.max(5, total - 5));
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
          if (typeof entry === 'string') {
            return { src: `/client/assets/music/${encodeURIComponent(entry)}`, id: entry };
          }
          if (entry?.src) {
            const src = String(entry.src);
            return {
              src: src.startsWith('/') || src.startsWith('http') ? src : `/client/assets/music/${encodeURIComponent(src)}`,
              id: entry.id || entry.title || src
            };
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
        this.nextStartAt = ctx.currentTime + 18 + Math.random() * 45;
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
    if (!this.nextStartAt) this.nextStartAt = now + 2 + Math.random() * 8;
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
    const duration = scheduleTrack(ctx, this.master, track, start);
    this.lastTrack = track.id;
    this.activeUntil = start + duration;
    this.nextStartAt = this.activeUntil + 18 + Math.random() * 45;
  }
}
