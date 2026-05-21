export class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.renderScale = 1;
    this.w = 0;
    this.h = 0;
    this.cssW = 0;
    this.cssH = 0;

    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(canvas);
    this._resize();
  }

  setRenderScale(value) {
    this.renderScale = Math.max(0.6, Math.min(1, Number(value) || 1));
    this._resize();
  }

  _resize() {
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)) * this.renderScale;
    this.cssW = Math.floor(this.canvas.clientWidth);
    this.cssH = Math.floor(this.canvas.clientHeight);
    this.w = Math.floor(this.cssW * this.dpr);
    this.h = Math.floor(this.cssH * this.dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  }
}
