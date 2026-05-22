export class StationCommandQueue {
  constructor(sendCmd, minDelayMs = 0) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.minDelayMs = Math.max(0, minDelayMs | 0);
    this.lastSentAt = 0;
    this.timer = 0;
    this.pending = [];
  }

  send(cmd, payload = {}, meta = {}) {
    if (!this.sendCmd || !cmd) return '';
    const entry = { cmd, payload, meta };
    if (this.minDelayMs <= 0) return this.dispatch(entry);
    this.pending.push(entry);
    this.flush();
    return '';
  }

  dispatch(entry) {
    this.lastSentAt = performance.now();
    return this.sendCmd(entry.cmd, entry.payload || {}, entry.meta || {}) || '';
  }

  flush() {
    if (this.timer || !this.pending.length || !this.sendCmd) return;
    const now = performance.now();
    const wait = Math.max(0, this.minDelayMs - (now - this.lastSentAt));
    if (wait > 0) {
      this.timer = window.setTimeout(() => {
        this.timer = 0;
        this.flush();
      }, wait);
      return;
    }
    const next = this.pending.shift();
    this.dispatch(next);
    if (this.pending.length) this.flush();
  }
}
