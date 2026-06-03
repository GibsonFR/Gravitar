function finite(v, fallback = 0) {
  return Number.isFinite(Number(v)) ? Number(v) : fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function pointerXY(ev) {
  if (ev?.touches?.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  if (ev?.changedTouches?.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
  return { x: finite(ev?.clientX, 0), y: finite(ev?.clientY, 0) };
}

function defaultClamp(pos, el, margin = 8) {
  const width = Math.max(1, el?.offsetWidth || 1);
  const height = Math.max(1, el?.offsetHeight || 1);
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: clamp(finite(pos?.x, margin), margin, maxX),
    y: clamp(finite(pos?.y, margin), margin, maxY)
  };
}

export class LocalDragSurface {
  constructor(el, options = {}) {
    this.el = el;
    this.handleSelector = options.handleSelector || '';
    this.ignoreSelector = options.ignoreSelector || 'button,input,textarea,select,a,[data-no-drag]';
    this.onCommit = typeof options.onCommit === 'function' ? options.onCommit : null;
    this.onStart = typeof options.onStart === 'function' ? options.onStart : null;
    this.onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;
    this.clamp = typeof options.clamp === 'function' ? options.clamp : defaultClamp;
    this.margin = Number.isFinite(Number(options.margin)) ? Number(options.margin) : 8;
    this.drag = null;
    this.raf = 0;
    this.pending = null;

    this._down = (ev) => this.pointerDown(ev);
    this._move = (ev) => this.pointerMove(ev);
    this._up = (ev) => this.pointerUp(ev);

    el?.addEventListener?.('pointerdown', this._down, { capture: true });
    el?.addEventListener?.('mousedown', this._down, { capture: true });
    el?.addEventListener?.('touchstart', this._down, { capture: true, passive: false });
  }

  destroy() {
    this.el?.removeEventListener?.('pointerdown', this._down, { capture: true });
    this.el?.removeEventListener?.('mousedown', this._down, { capture: true });
    this.el?.removeEventListener?.('touchstart', this._down, { capture: true });
    this.detachGlobal();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.drag = null;
    this.pending = null;
  }

  attachGlobal() {
    window.addEventListener('pointermove', this._move, { capture: true });
    window.addEventListener('mousemove', this._move, { capture: true });
    window.addEventListener('touchmove', this._move, { capture: true, passive: false });
    window.addEventListener('pointerup', this._up, { capture: true });
    window.addEventListener('mouseup', this._up, { capture: true });
    window.addEventListener('touchend', this._up, { capture: true });
    window.addEventListener('touchcancel', this._up, { capture: true });
    document.addEventListener('pointermove', this._move, { capture: true });
    document.addEventListener('mousemove', this._move, { capture: true });
    document.addEventListener('touchmove', this._move, { capture: true, passive: false });
    document.addEventListener('pointerup', this._up, { capture: true });
    document.addEventListener('mouseup', this._up, { capture: true });
    document.addEventListener('touchend', this._up, { capture: true });
    document.addEventListener('touchcancel', this._up, { capture: true });
  }

  detachGlobal() {
    window.removeEventListener('pointermove', this._move, { capture: true });
    window.removeEventListener('mousemove', this._move, { capture: true });
    window.removeEventListener('touchmove', this._move, { capture: true });
    window.removeEventListener('pointerup', this._up, { capture: true });
    window.removeEventListener('mouseup', this._up, { capture: true });
    window.removeEventListener('touchend', this._up, { capture: true });
    window.removeEventListener('touchcancel', this._up, { capture: true });
    document.removeEventListener('pointermove', this._move, { capture: true });
    document.removeEventListener('mousemove', this._move, { capture: true });
    document.removeEventListener('touchmove', this._move, { capture: true });
    document.removeEventListener('pointerup', this._up, { capture: true });
    document.removeEventListener('mouseup', this._up, { capture: true });
    document.removeEventListener('touchend', this._up, { capture: true });
    document.removeEventListener('touchcancel', this._up, { capture: true });
  }

  canStart(ev) {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !this.el?.contains?.(target)) return false;
    if (this.ignoreSelector && target.closest(this.ignoreSelector)) return false;
    if (this.handleSelector && !target.closest(this.handleSelector)) return false;
    return true;
  }

  pointerDown(ev) {
    if (!this.canStart(ev)) return;
    const p = pointerXY(ev);
    const rect = this.el.getBoundingClientRect();
    this.drag = {
      pointerId: ev.pointerId ?? null,
      startX: p.x,
      startY: p.y,
      originX: rect.left,
      originY: rect.top,
      x: rect.left,
      y: rect.top,
      moved: false
    };
    this.pending = { x: rect.left, y: rect.top };
    this.el.classList.add('is-dragging');
    this.el.style.right = 'auto';
    this.el.style.bottom = 'auto';
    this.attachGlobal();
    this.onStart?.(this.pending);
    ev.preventDefault?.();
    ev.stopPropagation?.();
  }

  pointerMove(ev) {
    if (!this.drag) return;
    if (this.drag.pointerId != null && ev.pointerId != null && ev.pointerId !== this.drag.pointerId) return;
    const p = pointerXY(ev);
    const dx = p.x - this.drag.startX;
    const dy = p.y - this.drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 1) this.drag.moved = true;
    this.pending = this.clamp({ x: this.drag.originX + dx, y: this.drag.originY + dy }, this.el, this.margin);
    if (!this.raf) this.raf = requestAnimationFrame(() => this.flush());
    ev.preventDefault?.();
    ev.stopPropagation?.();
  }

  flush() {
    this.raf = 0;
    if (!this.pending || !this.el) return;
    this.el.style.transform = 'none';
    this.el.style.left = `${Math.round(this.pending.x)}px`;
    this.el.style.top = `${Math.round(this.pending.y)}px`;
    this.el.style.right = 'auto';
    this.el.style.bottom = 'auto';
  }

  pointerUp(ev) {
    if (!this.drag) return;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.flush();
    }
    const finalPos = this.pending ? { ...this.pending } : null;
    this.drag = null;
    this.pending = null;
    this.detachGlobal();
    this.el?.classList.remove('is-dragging');
    if (finalPos) this.onCommit?.(finalPos);
    this.onEnd?.(finalPos);
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
  }
}

export function clampDragToViewport(pos, el, margin = 8) {
  return defaultClamp(pos, el, margin);
}
