export class StationCommandQueue {
  constructor(sendCmd, minDelayMs = 85) {
    this.sendCmd = typeof sendCmd === 'function' ? sendCmd : null;
    this.minDelayMs = Math.max(0, minDelayMs | 0);
    this.lastSentAt = 0;
    this.timer = 0;
    this.pending = [];
  }

  send(cmd, payload = {}) {
    if (!this.sendCmd || !cmd) return;
    this.pending.push({ cmd, payload });
    this.flush();
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
    this.lastSentAt = performance.now();
    this.sendCmd(next.cmd, next.payload || {});
    if (this.pending.length) this.flush();
  }
}
