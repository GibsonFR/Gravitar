function eventKey(ev) {
  if (!ev) return '';
  const id = ev.id | 0;
  if (id) return String(id);
  return `${ev.type || 'event'}:${ev.serverTime || 0}:${ev.source || ''}:${JSON.stringify(ev.payload || {})}`;
}

export class NetworkEventDeduper {
  constructor(options = {}) {
    this.maxSeen = Math.max(128, options.maxSeen || 2048);
    this.seen = new Set();
    this.order = [];
    this.received = 0;
    this.accepted = 0;
    this.duplicates = 0;
    this.lastAcceptedAt = 0;
    this.byType = new Map();
  }

  accept(ev) {
    const key = eventKey(ev);
    if (!key) return false;
    this.received += 1;
    if (this.seen.has(key)) {
      this.duplicates += 1;
      return false;
    }
    this.seen.add(key);
    this.order.push(key);
    while (this.order.length > this.maxSeen) {
      const old = this.order.shift();
      if (old) this.seen.delete(old);
    }
    this.accepted += 1;
    this.lastAcceptedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const type = String(ev.type || 'event');
    this.byType.set(type, (this.byType.get(type) || 0) + 1);
    return true;
  }

  filter(events = []) {
    if (!Array.isArray(events) || !events.length) return [];
    return events.filter((ev) => this.accept(ev));
  }

  stats() {
    return {
      received: this.received,
      accepted: this.accepted,
      duplicates: this.duplicates,
      seen: this.seen.size,
      byType: Object.fromEntries(this.byType.entries()),
      lastAcceptedAgeMs: this.lastAcceptedAt ? Math.max(0, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.lastAcceptedAt) : 0
    };
  }
}
