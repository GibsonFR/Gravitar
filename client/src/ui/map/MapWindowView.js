import { MapPanelView } from './MapPanelView.js';

export class MapWindowView {
  constructor() {
    this.isOpen = false;
    this.hasRenderedOnce = false;
    this.mapSnap = null;
    this.invSnap = null;
    this.seed = 0;
    this.isOpening = false;
    this._openLayoutToken = 0;

    this.el = document.createElement('section');
    this.el.className = 'map-modal';
    this.el.hidden = true;

    this.el.innerHTML = `
      <div class="map-modal__backdrop" data-act="close"></div>
      <div class="map-window ui-panel-shell ui-panel-shell--xl">
        <div class="map-window__header">
          <div>
            <div class="map-window__eyebrow">Navigation</div>
            <div class="map-window__title">Carte</div>
          </div>
          <button class="map-window__close" data-act="close" aria-label="Fermer">✕</button>
        </div>
        <div class="map-window__body" data-role="body"></div>
      </div>
    `;

    this.bodyEl = this.el.querySelector('[data-role="body"]');

    this.panel = new MapPanelView();
    this.bodyEl.appendChild(this.panel.el);

    this.el.addEventListener('click', (ev) => {
      const act = ev.target?.dataset?.act;
      if (act === 'close') this.setOpen(false);
    });
  }

  toggle() {
    this.setOpen(!this.isOpen);
  }

  setOpen(open) {
    const wantOpen = !!open;
    this.isOpen = wantOpen;
    this.isOpening = wantOpen;
    this.el.hidden = !wantOpen;
    this.el.classList.toggle('is-open', wantOpen);

    this._openLayoutToken += 1;
    const token = this._openLayoutToken;

    if (wantOpen) {
      this.el.classList.add('is-preparing');
      this.panel.recenter(false);
      this.panel.update(this.mapSnap, this.invSnap, this.seed, false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!this.isOpen || token !== this._openLayoutToken) return;
          this.panel.relayout();
          this.isOpening = false;
          this.el.classList.remove('is-preparing');
        });
      });
      return;
    }

    this.el.classList.remove('is-preparing');
    this.isOpening = false;
  }

  _stabilizeOpenLayout() {
    const token = ++this._openLayoutToken;
    let prevW = -1;
    let prevH = -1;
    let stableFrames = 0;
    let frames = 0;

    const step = () => {
      if (!this.isOpen || token !== this._openLayoutToken) return;

      this.panel.relayout();

      const rect = this.panel.canvas.getBoundingClientRect();
      const w = Math.round(rect.width || 0);
      const h = Math.round(rect.height || 0);

      if (w > 1 && h > 1 && w === prevW && h === prevH) stableFrames += 1;
      else stableFrames = 0;

      prevW = w;
      prevH = h;
      frames += 1;

      if (stableFrames >= 2 || frames >= 8) {
        this.panel.relayout();
        this.isOpening = false;
        this.el.classList.remove('is-preparing');
        return;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  update(mapSnap, invSnap, seed) {
    this.mapSnap = mapSnap || null;
    this.invSnap = invSnap || null;
    this.seed = seed | 0;
    if (!this.isOpen) return;
    this.panel.update(this.mapSnap, this.invSnap, this.seed, !this.isOpening);
  }
}
