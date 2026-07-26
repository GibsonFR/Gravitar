import { computeMapLayout, drawSectorMap } from './MapCanvasRenderer.js';

const DEFAULT_ZOOM = 0.32;
const MIN_ZOOM = 0.22;
const MAX_ZOOM = 2.3;
const ZOOM_IN_FACTOR = 1.12;
const ZOOM_OUT_FACTOR = 0.89;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class MapPanelView {
  constructor() {
    this.el = document.createElement('section');
    this.el.className = 'map-panel';

    this.seed = 0;
    this.curSx = 0;
    this.curSy = 0;
    this.rawCurSx = 0;
    this.rawCurSy = 0;
    this.activeRadius = 50;

    this.zoom = DEFAULT_ZOOM;
    this.hasUserZoom = false;
    this.panX = 0;
    this.panY = 0;

    this.hover = null;
    this.drag = null;

    this.lastLayout = null;

    this.visitedInfo = new Map();
    this.visitedList = [];
    this.bastionInfo = new Map();
    this.bastionList = [];
    this.playerList = [];
    this.homeBase = null;
    this.depositList = [];
    this.territoryList = [];

    this.el.innerHTML = `
      <div class="map-panel__header">
        <div class="map-panel__header-main">
          <div class="map-panel__sub map-panel__sub--top" data-role="sub">—</div>
        </div>
        <div class="map-panel__tools">
          <div class="map-panel__zoom">
            <button class="ui-btn ui-btn--ghost ui-btn--sm" data-act="zoomOut">−</button>
            <div class="map-panel__zoomlabel" data-role="zoomLabel">—</div>
            <button class="ui-btn ui-btn--ghost ui-btn--sm" data-act="zoomIn">+</button>
          </div>
          <div class="map-panel__legend">
            <div class="map-panel__legend-row"><span class="map-panel__glyph">S</span><span>Station</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph">P</span><span>Portail retour</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph map-panel__glyph--base">B</span><span>Base principale</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph map-panel__glyph--hub">H</span><span>Hub [0,0] protégé, sans station</span></div>
            <div class="map-panel__legend-row"><span class="map-panel__glyph">◈</span><span>Bastion</span></div>
          </div>
        </div>
      </div>

      <div class="map-panel__body">
        <canvas class="map-panel__canvas" data-role="canvas"></canvas>
        <div class="map-panel__info" data-role="info">
          <div class="map-panel__info-head">
            <div>
              <div class="map-panel__info-title">Secteur</div>
              <div class="map-panel__info-main" data-role="infoMain">—</div>
            </div>
            <div class="map-panel__info-badge" data-role="infoBadge">—</div>
          </div>
          <div class="map-panel__info-sections" data-role="infoSections"></div>
        </div>
      </div>
    `;

    this.canvas = this.el.querySelector('[data-role="canvas"]');
    this.subEl = this.el.querySelector('[data-role="sub"]');
    this.infoMainEl = this.el.querySelector('[data-role="infoMain"]');
    this.infoBadgeEl = this.el.querySelector('[data-role="infoBadge"]');
    this.infoSectionsEl = this.el.querySelector('[data-role="infoSections"]');
    this.zoomLabelEl = this.el.querySelector('[data-role="zoomLabel"]');

    this.el.addEventListener('click', (ev) => {
      const act = ev.target?.dataset?.act;
      if (!act) return;
      if (act === 'zoomIn') this._applyZoomAtCanvasPoint(this.zoom * ZOOM_IN_FACTOR);
      if (act === 'zoomOut') this._applyZoomAtCanvasPoint(this.zoom * ZOOM_OUT_FACTOR);
    });

    this._bind();
    this._refreshLabels();
  }

  resetView(render = true) {
    this.hasUserZoom = false;
    this.panX = 0;
    this.panY = 0;
    this.hover = null;
    this.drag = null;
    this.lastLayout = null;
    this.zoom = DEFAULT_ZOOM;

    this._refreshLabels();
    if (render) this._render();
  }


  recenter(render = true) {
    this.hasUserZoom = false;
    this.panX = 0;
    this.panY = 0;
    this.hover = null;
    this.drag = null;
    this.lastLayout = null;
    this.zoom = DEFAULT_ZOOM;
    this._refreshLabels();
    if (render) this._render();
  }

  _refreshLabels() {
    this.subEl.textContent = `Secteur actuel [${this.curSx},${this.curSy}]`;
    this.zoomLabelEl.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  _toDisplaySy(rawSy) {
    // La convention serveur est désormais la convention affichée :
    // monter dans le monde augmente sy, descendre diminue sy.
    // On ne retourne donc plus le signe pour la carte.
    return rawSy | 0;
  }

  _bind() {
    const onMove = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      if (this.drag) {
        this.panX = this.drag.startPanX + (x - this.drag.startX);
        this.panY = this.drag.startPanY + (y - this.drag.startY);
        this.hover = null;
        this._render();
        return;
      }

      const hover = this._pickSector(x, y);
      const changed = (!this.hover && hover) || (this.hover && !hover) || (this.hover && hover && (this.hover.sx !== hover.sx || this.hover.sy !== hover.sy));
      this.hover = hover;
      if (changed) this._render();
    };

    this.canvas.addEventListener('mousemove', onMove);
    this.canvas.addEventListener('mouseleave', () => {
      this.hover = null;
      this.drag = null;
      this._render();
    });

    this.canvas.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      this.drag = {
        startX: ev.clientX - rect.left,
        startY: ev.clientY - rect.top,
        startPanX: this.panX,
        startPanY: this.panY
      };
    });

    window.addEventListener('mouseup', () => {
      this.drag = null;
    });

    this.canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const factor = (ev.deltaY || 0) < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this._applyZoomAtCanvasPoint(this.zoom * factor, x, y);
    }, { passive: false });
  }

  _applyZoomAtCanvasPoint(targetZoom, px = null, py = null) {
    const nextZoom = clamp(targetZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextZoom - this.zoom) < 0.0001) return;

    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || 0));
    const h = Math.max(1, Math.round(rect.height || 0));
    const pointX = px ?? (w * 0.5);
    const pointY = py ?? (h * 0.5);

    const before = this.lastLayout || this._computeLayout(w, h);
    const hoverSectorX = (pointX - before.currentCellX) / before.cell;
    const hoverSectorY = (pointY - before.currentCellY) / before.cell;

    const oldZoom = this.zoom;
    this.zoom = nextZoom;
    const after = this._computeLayout(w, h);

    this.panX += (before.currentCellX + hoverSectorX * before.cell) - (after.currentCellX + hoverSectorX * after.cell);
    this.panY += (before.currentCellY + hoverSectorY * before.cell) - (after.currentCellY + hoverSectorY * after.cell);

    if (Math.abs(oldZoom - this.zoom) > 0.0001) {
      this.hasUserZoom = true;
      this._refreshLabels();
      this._render();
    }
  }

  _pickSector(px, py) {
    if (!this.lastLayout) return null;

    const dx = Math.floor((px - this.lastLayout.currentCellX) / this.lastLayout.cell);
    const dy = Math.floor((py - this.lastLayout.currentCellY) / this.lastLayout.cell);
    const sx = this.lastLayout.currentSx + dx;
    const sy = this.lastLayout.currentSy - dy;

    if (sx === this.curSx && sy === this.curSy) return { sx, sy };
    if (!this.visitedInfo.has(`${sx},${sy}`) && !this.bastionInfo.has(`${sx},${sy}`)) return null;
    return { sx, sy };
  }

  update(mapSnap, invSnap, seed, render = true) {
    this.seed = seed | 0;

    this.rawCurSx = (mapSnap?.sx ?? 0) | 0;
    this.rawCurSy = (mapSnap?.sy ?? 0) | 0;
    this.curSx = this.rawCurSx;
    this.curSy = this._toDisplaySy(this.rawCurSy);
    this.activeRadius = Math.max(0, mapSnap?.activeRadius ?? 50) | 0;

    this.visitedInfo.clear();
    this.visitedList = [];
    this.bastionInfo = new Map();
    this.bastionList = [];
    this.playerList = [];
    this.homeBase = null;
    this.depositList = (mapSnap?.deposits || []).map((deposit) => ({
      ...deposit,
      sx: deposit.sx | 0,
      rawSy: deposit.sy | 0,
      sy: this._toDisplaySy(deposit.sy | 0)
    }));
    this.territoryList = (mapSnap?.territories || []).map((territory) => ({
      ...territory,
      sx: territory.sx | 0,
      rawSy: territory.sy | 0,
      sy: this._toDisplaySy(territory.sy | 0)
    }));
    const sectors = mapSnap?.sectors ?? [];
    for (const s of sectors) {
      const sx = (s.sx ?? 0) | 0;
      const rawSy = (s.sy ?? 0) | 0;
      const sy = this._toDisplaySy(rawSy);
      const item = {
        sx,
        sy,
        rawSy,
        level: (s.level ?? 0) | 0,
        stationCount: (s.stationCount ?? 0) | 0,
        pirateStationCount: (s.pirateStationCount ?? 0) | 0,
        hasReturnPortal: !!s.hasReturnPortal,
        primaryResource: s.primaryResource || 'scrap',
        resourceKeys: (s.resourceKeys || [s.primaryResource || 'scrap']).slice(0, 6),
        resourceNames: (s.resourceNames || []).slice(0, 6),
        biomeId: s.biomeId || 'unknown',
        biomeName: s.biomeName || '',
        biomeShortName: s.biomeShortName || '',
        biomeDescription: s.biomeDescription || '',
        biomeColorHex: s.biomeColorHex || '',
        bastion: s.bastion || null,
      };
      this.visitedInfo.set(`${sx},${sy}`, item);
      this.visitedList.push(item);
    }

    for (const b of (mapSnap?.bastions ?? [])) {
      const sx = (b.sx ?? 0) | 0;
      const rawSy = (b.sy ?? 0) | 0;
      const sy = this._toDisplaySy(rawSy);
      const item = { ...b, sx, sy, rawSy, bastion: b };
      this.bastionInfo.set(`${sx},${sy}`, item);
      this.bastionList.push(item);
      const existing = this.visitedInfo.get(`${sx},${sy}`);
      if (existing) existing.bastion = b;
    }

    for (const p of (mapSnap?.players ?? [])) {
      const sx = (p.sx ?? 0) | 0;
      const rawSy = (p.sy ?? 0) | 0;
      this.playerList.push({ ...p, sx, rawSy, sy: this._toDisplaySy(rawSy), isMe: (p.id | 0) === (mapSnap?.meId | 0) });
    }

    if (mapSnap?.homeBase) {
      const sx = (mapSnap.homeBase.sx ?? 0) | 0;
      const rawSy = (mapSnap.homeBase.sy ?? 0) | 0;
      this.homeBase = {
        ...mapSnap.homeBase,
        sx,
        rawSy,
        sy: this._toDisplaySy(rawSy),
      };
    }

    this._refreshLabels();
    if (render) this._render();
  }

  relayout() {
    this._render();
  }

  _computeLayout(w, h) {
    return computeMapLayout(w, h, {
      currentSx: this.curSx,
      currentSy: this.curSy,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      activeRadius: this.activeRadius
    });
  }

  _render() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.lastLayout = this._computeLayout(w, h);
    drawSectorMap(ctx, w, h, {
      layout: this.lastLayout,
      hover: this.hover,
      visitedList: this.visitedList,
      bastionList: this.bastionList,
      playerList: this.playerList,
      homeBase: this.homeBase,
      getVisited: (sx, sy) => this.visitedInfo.get(`${sx | 0},${sy | 0}`) || null,
      getBastion: (sx, sy) => this.bastionInfo.get(`${sx | 0},${sy | 0}`) || null
    });

    const info = this._getInfo();
    this.infoMainEl.textContent = info.main;
    this.infoBadgeEl.textContent = info.badge || 'Normal';
    this.infoBadgeEl.className = `map-panel__info-badge ${info.badgeClass || ''}`.trim();
    this.infoSectionsEl.innerHTML = info.html;
  }

  _esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  _renderInfoSection(title, rows, emptyText = '—') {
    const cleanRows = (rows || []).filter(Boolean);
    const body = cleanRows.length
      ? cleanRows.map((row) => `<div class="map-panel__info-row">${row}</div>`).join('')
      : `<div class="map-panel__info-empty">${this._esc(emptyText)}</div>`;
    return `<div class="map-panel__info-card"><div class="map-panel__info-card-title">${this._esc(title)}</div>${body}</div>`;
  }

  _chip(text, cls = '') {
    return `<span class="map-panel__chip ${cls}">${this._esc(text)}</span>`;
  }

  _getInfo() {
    const sx = this.hover?.sx ?? (this.curSx | 0);
    const sy = this.hover?.sy ?? (this.curSy | 0);
    const visited = this.visitedInfo.get(`${sx},${sy}`) || null;
    const bastion = visited?.bastion || this.bastionInfo.get(`${sx},${sy}`) || null;
    const herePlayers = this.playerList.filter((p) => (p.sx | 0) === (sx | 0) && (p.sy | 0) === (sy | 0));
    const isHomeBaseSector = !!this.homeBase && (this.homeBase.sx | 0) === (sx | 0) && (this.homeBase.sy | 0) === (sy | 0);
    const territory = this.territoryList.find((entry) => (entry.sx | 0) === (sx | 0) && (entry.sy | 0) === (sy | 0)) || null;

    if (!visited && !bastion && !(sx === this.curSx && sy === this.curSy)) {
      return {
        main: `[${sx},${sy}]`,
        badge: 'Inconnu',
        badgeClass: 'is-unknown',
        html: this._renderInfoSection('Exploration', ['<span class="map-panel__muted">Secteur non découvert.</span>'])
      };
    }

    const typeRows = [];
    if (sx === 0 && sy === 0) typeRows.push(`${this._chip('Hub', 'is-hub')} <span>zone protégée, construction interdite</span>`);
    if (isHomeBaseSector) typeRows.push(`${this._chip('Base', 'is-base')} <span>base principale locale</span>`);
    if (territory) typeRows.push(`${this._chip(territory.mine ? 'Territoire allié' : 'Territoire')} <span>[${this._esc(territory.clanTag)}] ${this._esc(territory.clanName)}</span>`);
    if ((visited?.stationCount | 0) > 0) typeRows.push(`${this._chip('Station')} <span>${visited.stationCount | 0} station${(visited.stationCount | 0) > 1 ? 's' : ''}</span>`);
    if (visited?.hasReturnPortal) typeRows.push(`${this._chip('Retour')} <span>portail vers le hub</span>`);
    if (bastion) {
      const status = bastion.captured ? 'capturé' : (bastion.unlocked ? 'ouvert' : 'verrouillé');
      typeRows.push(`${this._chip('Bastion', 'is-bastion')} <span>${this._esc(bastion.name || 'Bastion')} — ${this._esc(status)}</span>`);
      if (!bastion.captured && bastion.unlockText) typeRows.push(`<span class="map-panel__muted">${this._esc(bastion.unlockText)}</span>`);
      if (bastion.summary) typeRows.push(`<span class="map-panel__muted">${this._esc(bastion.summary)}</span>`);
    }
    if (visited?.biomeName) {
      typeRows.push(`${this._chip(visited.biomeShortName || 'Biome')} <span>${this._esc(visited.biomeName)}</span>`);
      if (visited.biomeDescription) typeRows.push(`<span class="map-panel__muted">${this._esc(visited.biomeDescription)}</span>`);
    }
    if (!typeRows.length) typeRows.push(`${this._chip('Secteur')} <span>zone standard</span>`);

    const playerRows = herePlayers.map((p) => {
      const name = p.pseudo || `P${p.id}`;
      const lvl = p.level ? `Lv ${p.level}` : '';
      return `<div class="map-panel__player-row"><span class="map-panel__player-dot ${p.isMe ? 'is-me' : ''}"></span><span>${this._esc(name)}</span><span class="map-panel__muted">${this._esc(lvl)}</span></div>`;
    });

    const resourceRows = (visited?.resourceKeys || []).slice(0, 6).map((key, i) => {
      const label = visited?.resourceNames?.[i] || key;
      return `<span class="map-panel__resource-pill" title="${this._esc(key)}">${this._esc(label)}</span>`;
    });
    const deposits = this.depositList
      .filter((deposit) => (deposit.sx | 0) === (sx | 0) && (deposit.sy | 0) === (sy | 0))
      .map((deposit) => `<span class="map-panel__resource-pill" style="border-color:${this._esc(deposit.colorHex || '#9ef0c7')}">${this._esc(deposit.name)} · ${Math.round((deposit.quality || 1) * 100)}%</span>`);

    const badge = isHomeBaseSector ? 'Base' : sx === 0 && sy === 0 ? 'Hub' : bastion ? (bastion.captured ? 'Capturé' : (bastion.unlocked ? 'Ouvert' : 'Bastion')) : ((visited?.stationCount | 0) > 0 ? 'Station' : 'Normal');
    const badgeClass = isHomeBaseSector ? 'is-base' : sx === 0 && sy === 0 ? 'is-hub' : bastion ? 'is-bastion' : '';
    const html = [
      this._renderInfoSection('Activité', playerRows, 'Aucun joueur dans ce secteur.'),
      this._renderInfoSection('Points utiles', typeRows),
      this._renderInfoSection('Ressources probables', resourceRows, 'Ressources inconnues.')
      ,
      this._renderInfoSection('Gisements détectés', deposits, 'Aucun gisement détecté.')
    ].join('');

    return { main: `[${sx},${sy}]`, badge, badgeClass, html };
  }

}
