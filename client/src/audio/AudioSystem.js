import { playSfxEvent } from './SfxSynth.js';
import { MusicPlaylist } from './MusicPlaylist.js';
import { ReactorLoop } from './ReactorLoop.js';

function clampDb(value, fallback = 0) {
  const n = Number(value);
  return Math.max(-60, Math.min(0, Number.isFinite(n) ? n : fallback));
}

function dbToGain(db) {
  const n = clampDb(db, -60);
  if (n <= -60) return 0;
  return Math.pow(10, n / 20);
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.music = new MusicPlaylist();
    this.reactor = new ReactorLoop();
    this.masterVolume = 0;
    this.sfxVolume = -12;
    this.sfxBus = null;
  }

  installUnlock(target = window) {
    const unlock = async () => {
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          this.ctx = new Ctx();
          this.ensureBuses();
        }
        if (this.ctx.state !== 'running') await this.ctx.resume();
        this.unlocked = this.ctx.state === 'running';
      } catch {}
    };

    target.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  ensureBuses() {
    if (!this.ctx || this.sfxBus) return;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = dbToGain(this.masterVolume + this.sfxVolume);
    this.sfxBus.connect(this.ctx.destination);
  }

  applySettings(settings = {}) {
    this.masterVolume = clampDb(settings.masterVolume, this.masterVolume);
    this.sfxVolume = clampDb(settings.sfxVolume, this.sfxVolume);
    const musicDb = clampDb(settings.musicVolume, -18);
    const reactorDb = clampDb(settings.reactorVolume, -24);
    const sfxGain = dbToGain(this.masterVolume + this.sfxVolume);
    this.music.setVolume(dbToGain(this.masterVolume + musicDb));
    this.reactor.setVolume(dbToGain(this.masterVolume + reactorDb));
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(sfxGain, this.ctx.currentTime, 0.06);
  }

  playPending(events) {
    if (!events?.length) return;
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.ensureBuses();
    for (const ev of events) playSfxEvent(this.ctx, ev, this.sfxBus || this.ctx.destination);
  }

  update(me, input) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.ensureBuses();
    this.music.update(this.ctx);
    this.reactor.update(this.ctx, me, input);
  }
}
