import { CanvasView } from './core/CanvasView.js';
import { WorldStore } from './state/WorldStore.js';
import { NetClient } from './net/NetClient.js';
import { createInputState } from './input/InputState.js';
import { InputController } from './input/InputController.js';
import { AudioSystem } from './audio/AudioSystem.js';

import { drawStars, drawGrid } from './render/BackgroundRenderer.js';
import { drawGroundMarker } from './render/GroundMarkerRenderer.js';
import { drawSelectionRing } from './render/SelectionRenderer.js';

import { drawStation } from './station/StationRenderer.js';
import { drawStructure, drawStructureBuildPreview } from './structures/StructureRenderer.js';
import { drawPortals } from './portal/PortalRenderer.js';
import { drawAsteroid } from './asteroid/AsteroidRenderer.js';
import { drawProjectile } from './projectile/ProjectileRenderer.js';
import { drawLoot } from './loot/LootRenderer.js';
import { drawShip } from './entities/ship/ShipRenderer.js';
import { drawAreaEffect } from './abilities/AreaEffectRenderer.js';
import { drawMob } from './mob/MobRenderer.js';

import { drawHud } from './ui/HudRenderer.js';
import { drawRadar, hitTestRadarMove } from './ui/RadarRenderer.js';
import { drawContextHint } from './ui/ContextHintRenderer.js';
import { TopRightDock } from './ui/chrome/TopRightDock.js';
import { CargoPanelView } from './ui/cargo/CargoPanelView.js';
import { getCargoIconSvg } from './ui/cargo/CargoIconSvg.js';
import { getMapIconSvg } from './ui/map/MapIconSvg.js';
import { MapWindowView } from './ui/map/MapWindowView.js';
import { StationWindowView } from './ui/station/StationWindowView.js';
import { ShipPanelView } from './ui/ship/ShipPanelView.js';
import { getShipIconSvg } from './ui/ship/ShipIconSvg.js';
import { SessionSetupOverlay } from './ui/session/SessionSetupOverlay.js';
import { getCombatHudLayout, hitTestHudAbility } from './ui/hud/HudLayout.js';
import { getEquippedHudHit } from './ui/hud/HudEquipmentPanelRenderer.js';
import { VisualFxStore } from './fx/VisualFxStore.js';
import { drawWorldStatuses } from './ui/status/WorldStatusRenderer.js';
import { PlayersPanelView } from './ui/players/PlayersPanelView.js';
import { OptionsPanelView } from './ui/options/OptionsPanelView.js';
import { getOptionsIconSvg } from './ui/options/OptionsIconSvg.js';
import { BasePanelView } from './ui/base/BasePanelView.js';
import { StoragePanelView } from './ui/storage/StoragePanelView.js';
import { MachinePanelView } from './ui/machine/MachinePanelView.js';
import { RocketWorkshopPanelView } from './ui/rocket/RocketWorkshopPanelView.js';
import { ResearchStationPanelView } from './ui/research/ResearchStationPanelView.js';
import { EquipmentFabricatorPanelView } from './ui/equipment/EquipmentFabricatorPanelView.js';
import { EquipmentRDStationPanelView } from './ui/equipment/EquipmentRDStationPanelView.js';
import { ResearchTreePanelView } from './ui/research/ResearchTreePanelView.js';
import { getBaseIconSvg } from './ui/base/BaseIconSvg.js';
import { ClientPrediction } from './prediction/ClientPrediction.js';

import { clamp, rgba } from './core/Math.js';
import { SECTOR } from '../../shared/world/SectorDefs.js';

function hasLocalStatus(me, id) {
  return (me?.statuses ?? []).some((s) => s.id === id);
}

function drawBlindViewportMask(ctx, view, me, t) {
  if (!hasLocalStatus(me, 'blind')) return;
  const cx = view.cssW * 0.5;
  const cy = view.cssH * 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
  const clearR = 126 + pulse * 8;
  const fadeR = 220 + pulse * 14;
  const g = ctx.createRadialGradient(cx * view.dpr, cy * view.dpr, clearR * view.dpr, cx * view.dpr, cy * view.dpr, fadeR * view.dpr);
  g.addColorStop(0, 'rgba(0,0,0,0.00)');
  g.addColorStop(0.34, 'rgba(0,0,0,0.38)');
  g.addColorStop(0.66, 'rgba(0,0,0,0.86)');
  g.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.strokeStyle = 'rgba(214,198,126,0.50)';
  ctx.lineWidth = 1.6 * view.dpr;
  ctx.setLineDash([8 * view.dpr, 7 * view.dpr]);
  ctx.beginPath();
  ctx.arc(cx * view.dpr, cy * view.dpr, clearR * view.dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}


function createChatUi(root, store, sendChat) {
  const wrap = document.createElement('div');
  wrap.className = 'game-chat';
  wrap.innerHTML = `
    <div class="game-chat__log"></div>
    <form class="game-chat__form" autocomplete="off">
      <input class="game-chat__input" maxlength="220" placeholder="Entrée pour discuter…" />
    </form>
  `;
  root.appendChild(wrap);
  const log = wrap.querySelector('.game-chat__log');
  const form = wrap.querySelector('.game-chat__form');
  const input = wrap.querySelector('.game-chat__input');
  let lastCount = -1;
  let visibleUntil = 0;

  function escapeHtml(txt) {
    return String(txt || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function open() {
    wrap.classList.add('is-open');
    visibleUntil = performance.now() + 8500;
    store.clearChatUnread?.();
    input.focus();
  }

  function close() {
    input.blur();
    if (performance.now() > visibleUntil) wrap.classList.remove('is-open');
  }

  function refresh(force = false) {
    const messages = store.chatMessages || [];
    if (!force && messages.length === lastCount) {
      if (document.activeElement !== input && performance.now() > visibleUntil) wrap.classList.remove('is-open');
      return;
    }
    lastCount = messages.length;
    log.innerHTML = messages.slice(-9).map((m) => `
      <div class="game-chat__msg">
        <span class="game-chat__name">${escapeHtml(m.name)}</span>
        <span class="game-chat__text">${escapeHtml(m.text)}</span>
      </div>
    `).join('');
    log.scrollTop = log.scrollHeight;
    if (messages.length) {
      visibleUntil = performance.now() + 6500;
      wrap.classList.add('is-open');
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) { close(); return; }
    sendChat(text);
    input.value = '';
    visibleUntil = performance.now() + 6500;
  });

  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Escape') {
      input.value = '';
      close();
      ev.preventDefault();
    }
  });

  window.addEventListener('keydown', (ev) => {
    const tag = String(ev.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || ev.target?.isContentEditable) return;
    if (ev.key === 'Enter') {
      open();
      ev.preventDefault();
    }
  });

  return { refresh, open, close, el: wrap };
}


export function startApp() {
  const canvas = document.getElementById('c');
  const statusEl = document.getElementById('status');

  const view = new CanvasView(canvas);
  const store = new WorldStore();
  const predictor = new ClientPrediction(store);
  const input = createInputState();
  store.inputRef = input;
  const audio = new AudioSystem();
  let graphicsOptions = { starDensity: 1, showGrid: true, showFx: true, renderScale: 1 };
  const fxStore = new VisualFxStore();
  const uiRoot = document.getElementById('ui-root');
  const dock = new TopRightDock(uiRoot);
  const playersPanel = new PlayersPanelView();
  uiRoot.appendChild(playersPanel.el);
  const travelOverlay = document.createElement('div');
  travelOverlay.className = 'travel-loading';
  travelOverlay.innerHTML = '<div class="travel-loading__box"><div class="travel-loading__title">Chargement</div><div class="travel-loading__label">Saut de secteur…</div><div class="travel-loading__bar"><span></span></div></div>';
  uiRoot.appendChild(travelOverlay);

  const net = new NetClient(store, (txt) => { statusEl.textContent = txt; });
  net.connect();

  const sendCmd = (cmd, payload = {}, meta = {}) => {
    if (cmd === 'toggle_converter' && payload?.itemId && (payload.enabled === true || payload.enabled === false)) {
      store.setConverterOptimistic?.(payload.itemId, payload.enabled);
    }
    const cmdId = store.noteCommandPending?.(cmd, payload, meta) || '';
    net.send({ t: 'cmd', cmd, cmdId, ...(payload || {}) });
    return cmdId;
  };
  playersPanel.bindChat((text) => net.send({ t: 'chat', text }));

  const cargoPanel = new CargoPanelView(sendCmd);
  dock.registerPanel({ id: 'cargo', title: 'Cargo', iconMarkup: getCargoIconSvg(), panelEl: cargoPanel.el, group: 'game' });

  const shipPanel = new ShipPanelView(sendCmd);
  dock.registerPanel({ id: 'ship', title: 'Vaisseau', iconMarkup: getShipIconSvg(), panelEl: shipPanel.el, shellClass: 'ui-panel-shell--ship', group: 'game' });

  const optionsPanel = new OptionsPanelView((settings) => {
    audio.applySettings(settings);
    graphicsOptions = { ...graphicsOptions, ...settings };
    view.setRenderScale(settings.renderScale);
  });
  graphicsOptions = { ...graphicsOptions, ...optionsPanel.getSettings() };
  audio.applySettings(optionsPanel.getSettings());
  view.setRenderScale(optionsPanel.getSettings().renderScale);
  dock.registerPanel({ id: 'options', title: 'Options', iconMarkup: getOptionsIconSvg(), panelEl: optionsPanel.el, group: 'utility' });

  const basePanel = new BasePanelView(sendCmd, () => { if (dock.activeId === 'base') dock.toggle('base'); });
  dock.registerPanel({ id: 'base', title: 'Build', iconMarkup: getBaseIconSvg(), panelEl: basePanel.el, group: 'game' });
  const storagePanel = new StoragePanelView(sendCmd);
  uiRoot.appendChild(storagePanel.el);
  const machinePanel = new MachinePanelView(sendCmd);
  uiRoot.appendChild(machinePanel.el);
  const rocketWorkshopPanel = new RocketWorkshopPanelView(sendCmd);
  uiRoot.appendChild(rocketWorkshopPanel.el);
  const researchStationPanel = new ResearchStationPanelView(sendCmd);
  uiRoot.appendChild(researchStationPanel.el);
  const equipmentFabricatorPanel = new EquipmentFabricatorPanelView(sendCmd);
  uiRoot.appendChild(equipmentFabricatorPanel.el);
  const equipmentRDStationPanel = new EquipmentRDStationPanelView(sendCmd);
  uiRoot.appendChild(equipmentRDStationPanel.el);
  const researchTreePanel = new ResearchTreePanelView(sendCmd);
  dock.registerPanel({ id: 'research-tree', title: 'Recherche', iconMarkup: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M11 3v6l-5 8a3 3 0 0 0 2.6 4.5h6.8A3 3 0 0 0 18 17l-5-8V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 16h8M10 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>', panelEl: researchTreePanel.el, shellClass: 'ui-panel-shell--research-tree', group: 'game' });

  window.addEventListener('keydown', (ev) => {
    const tag = String(ev.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || ev.target?.isContentEditable) return;
    if (!basePanel.hasActivePlacement?.()) return;
    if (ev.key === 'Escape') {
      basePanel.cancel();
      ev.preventDefault();
    } else if (String(ev.key || '').toLowerCase() === 'o') {
      if (basePanel.rotate()) ev.preventDefault();
    }
  });

  dock.registerToggle({
    id: 'quit-session',
    title: 'Quitter',
    group: 'utility',
    iconMarkup: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 8l4 4-4 4M17 12H4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    onToggle: () => {
      if (store.myState?.sessionSetup?.pending ?? true) return;
      const br = store.modes?.currentMode === 'battle' || !!store.modes?.battleSessionId || !!store.modes?.battleQueuedNext;
      const text = br
        ? 'Quitter la session Battle Royale ? Tu perdras ton avancement dans cette Battle.'
        : 'Quitter la session Endless ? Ton vaisseau sera protégé et tu reviendras à la sélection.';
      if (window.confirm(text)) sendCmd('quit_session', {});
    },
    isActive: () => false
  });

  const mapWindow = new MapWindowView();
  uiRoot.appendChild(mapWindow.el);
  dock.registerToggle({
    id: 'map',
    title: 'Carte',
    group: 'game',
    iconMarkup: getMapIconSvg(),
    onToggle: () => mapWindow.toggle(),
    isActive: () => mapWindow.isOpen
  });

  const stationWindow = new StationWindowView(sendCmd, store);
  uiRoot.appendChild(stationWindow.el);

  const sessionSetup = new SessionSetupOverlay((payload) => {
    sendCmd('commit_session_setup', payload);
  }, () => {
    sendCmd('cancel_battle_queue', {});
  }, (payload) => {
    sendCmd('auth_session_account', payload);
  });
  uiRoot.appendChild(sessionSetup.el);

  new InputController(canvas, input, {
    onFrameSelect: (frameId) => {
      if (store.myState?.sessionSetup?.pending ?? true) {
        sessionSetup.selectFrame(frameId);
        return;
      }
      sendCmd('set_frame', { frameId });
    },
    onAbilityUpgrade: (slot) => { store.upgradeAbilityLocal?.(slot); sendCmd('upgrade_ability', { slot }); },
    onRocketSlotSwitch: (slot) => sendCmd('switch_rocket_slot', { slot }),
    onPrimaryDown: handlePrimaryDown
  });
  audio.installUnlock(canvas);

  // Le clic droit est traité directement dans InputController.onPrimaryDown.
  // L'ancien handler frame-delayed créait des désaccords entre le clic local, la caméra
  // et le paquet serveur quand le joueur était déjà en mouvement.


  function screenPointToWorld(px, py) {
    return {
      x: camera.x + (px - view.cssW * 0.5),
      y: camera.y + (py - view.cssH * 0.5)
    };
  }

  function findStructureAtScreen(screenX, screenY, predicate = null) {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    for (const st of store.structures?.values?.() || []) {
      if ((st.sx | 0) !== (me.sx | 0) || (st.sy | 0) !== (me.sy | 0)) continue;
      if (predicate && !predicate(st)) continue;
      const w = Number(st.w) || (Number(st.radius) || 0) * 2;
      const h = Number(st.h) || (Number(st.radius) || 0) * 2;
      const cx = (st.x || 0) - camera.x + view.cssW * 0.5;
      const cy = (st.y || 0) - camera.y + view.cssH * 0.5;
      const left = cx - w * 0.5;
      const right = cx + w * 0.5;
      const top = cy - h * 0.5;
      const bottom = cy + h * 0.5;
      const pad = 12;
      if (screenX < left - pad || screenX > right + pad || screenY < top - pad || screenY > bottom + pad) continue;
      const px = Math.max(left, Math.min(screenX, right));
      const py = Math.max(top, Math.min(screenY, bottom));
      const dx = screenX - px;
      const dy = screenY - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { best = st; bestD2 = d2; }
    }
    return best;
  }

  function tryInteractStructureAt(px, py) {
    const st = findStructureAtScreen(px, py, (s) => s.type === 'storage' || s.type === 'equipment_storage' || s.type === 'ammo_storage' || s.type === 'logistic_drone_station' || s.type === 'fuel_tank' || s.type === 'fuel_generator' || s.type === 'door' || s.type === 'furnace' || s.type === 'high_temp_furnace' || s.type === 'chemical_refinery' || s.type === 'electrolyzer' || s.type === 'electronics_bench' || s.type === 'industrial_press' || s.type === 'logistic_drone_workshop' || s.type === 'industrial_converter' || s.type === 'rocket_workshop' || s.type === 'science_lab' || s.type === 'mining_extractor' || s.type === 'research_station' || s.type === 'equipment_fabricator' || s.type === 'equipment_rd_station');
    if (!st) return false;
    if (st.type === 'storage' || st.type === 'equipment_storage' || st.type === 'ammo_storage' || st.type === 'logistic_drone_station' || st.type === 'fuel_tank' || st.type === 'fuel_generator') sendCmd('storage_open', { structureId: st.id | 0 });
    else if (st.type === 'door') sendCmd('toggle_structure', { structureId: st.id | 0 });
    else if (st.type === 'research_station') sendCmd('research_station_open', { structureId: st.id | 0 });
    else if (st.type === 'equipment_fabricator') sendCmd('equipment_fabricator_open', { structureId: st.id | 0 });
    else if (st.type === 'equipment_rd_station') sendCmd('equipment_rd_open', { structureId: st.id | 0 });
    else if (st.type === 'rocket_workshop') sendCmd('rocket_workshop_open', { structureId: st.id | 0 });
    else sendCmd('machine_open', { structureId: st.id | 0 });
    return true;
  }

  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  // Capture avant le contrôleur de déplacement : un clic gauche/droit sur une structure
  // interactive doit ouvrir/toggle la structure, pas devenir un ordre de déplacement.
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 && ev.button !== 2) return;
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;

    if (ev.button === 0 && basePanel.hasActivePlacement?.()) {
      const mouseWorld = screenPointToWorld(px, py);
      basePanel.placeCurrent(store, mouseWorld);
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }

    if (tryInteractStructureAt(px, py)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }, true);

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 && ev.button !== 2) return;
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    if (ev.button === 2) return;
    if (basePanel.hasActivePlacement?.()) {
      ev.preventDefault();
      return;
    }
    if (tryInteractStructureAt(px, py)) {
      ev.preventDefault();
      return;
    }
    const radarMove = hitTestRadarMove(view, store.getMe(), px, py);
    if (radarMove) {
      input.moveWorldQueued = true;
      input.moveWorldX = radarMove.x;
      input.moveWorldY = radarMove.y;
      ev.preventDefault();
      return;
    }
    const layout = getCombatHudLayout(view);
    const equipmentHit = getEquippedHudHit(layout, px, py, store.myState);
    if (equipmentHit?.slot?.ammo) {
      sendCmd('switch_rocket_slot', { slot: equipmentHit.slot.ammoSlotIndex | 0 });
      ev.preventDefault();
      return;
    }
    const slot = hitTestHudAbility(view, px, py);
    if (!slot) return;
    const hudSlot = store.myState?.abilityHud?.[slot];
    if (hudSlot?.canUpgrade) {
      store.upgradeAbilityLocal?.(slot);
      sendCmd('upgrade_ability', { slot });
      ev.preventDefault();
    }
  });

  let lastSend = 0;
  let lastFrameTime = performance.now() / 1000;
  const camera = { x: 0, y: 0, initialized: false, sx: null, sy: null, forceCenterFrames: 0 };

  function clampCameraToSector(me) {
    // La caméra libre peut dépasser légèrement les limites du secteur pour que le bord
    // ne soit pas collé au centre de l’écran, mais elle ne peut plus scroller à l’infini.
    const overX = Math.min(SECTOR.half * 0.62, Math.max(420, view.cssW * 0.42));
    const overY = Math.min(SECTOR.half * 0.62, Math.max(300, view.cssH * 0.42));
    const minX = -SECTOR.half - overX;
    const maxX = SECTOR.half + overX;
    const minY = -SECTOR.half - overY;
    const maxY = SECTOR.half + overY;
    camera.x = clamp(camera.x, minX, maxX);
    camera.y = clamp(camera.y, minY, maxY);
  }

  function hardCenterCameraOnPlayer(me) {
    if (!me) return;
    camera.x = me.x;
    camera.y = me.y;
    camera.sx = me.sx | 0;
    camera.sy = me.sy | 0;
    camera.initialized = true;
    camera.forceCenterFrames = 2;
  }

  function updateCamera(me, dt) {
    if (!me) {
      camera.x = 0;
      camera.y = 0;
      camera.sx = null;
      camera.sy = null;
      camera.initialized = true;
      return;
    }

    const sx = me.sx | 0;
    const sy = me.sy | 0;
    const sectorChanged = camera.sx !== sx || camera.sy !== sy;
    if (!camera.initialized) {
      hardCenterCameraOnPlayer(me);
      return;
    }
    if (sectorChanged) {
      // Continuité visuelle au passage de secteur : le joueur garde sa position écran
      // au lieu d'être recadré brutalement comme s'il apparaissait au centre.
      const oldSx = Number.isFinite(camera.sx) ? camera.sx : sx;
      const oldSy = Number.isFinite(camera.sy) ? camera.sy : sy;
      camera.x += (oldSx - sx) * SECTOR.size;
      camera.y += (oldSy - sy) * SECTOR.size;
      camera.sx = sx;
      camera.sy = sy;
      camera.forceCenterFrames = 0;
      clampCameraToSector(me);
    }

    if (input.cameraLocked || (store.myState?.sessionSetup?.pending ?? true) || camera.forceCenterFrames > 0) {
      camera.x = me.x;
      camera.y = me.y;
      camera.sx = sx;
      camera.sy = sy;
      camera.initialized = true;
      if (camera.forceCenterFrames > 0) camera.forceCenterFrames -= 1;
      return;
    }

    const edge = 42;
    const maxSpeed = 1320;
    let vx = 0;
    let vy = 0;
    if (input.msx <= edge) vx -= 1 - input.msx / edge;
    if (input.msx >= view.cssW - edge) vx += 1 - (view.cssW - input.msx) / edge;
    if (input.msy <= edge) vy -= 1 - input.msy / edge;
    if (input.msy >= view.cssH - edge) vy += 1 - (view.cssH - input.msy) / edge;

    const l = Math.hypot(vx, vy);
    if (l > 1) {
      vx /= l;
      vy /= l;
    }
    camera.x += vx * maxSpeed * dt;
    camera.y += vy * maxSpeed * dt;
    clampCameraToSector(me);
  }

  function toPlayerRelativeScreen(me, screenX, screenY) {
    if (!me) return { x: screenX, y: screenY };
    return {
      x: screenX + (camera.x - me.x),
      y: screenY + (camera.y - me.y)
    };
  }



  function pickLocalPrimaryTarget(worldX, worldY) {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    const sameSector = (e) => (e?.sx | 0) === (me.sx | 0) && (e?.sy | 0) === (me.sy | 0);
    const tryPick = (kind, e, baseR) => {
      if (!e || !sameSector(e)) return;
      const r = Math.max(baseR, (e.radius || 0) + baseR - 12);
      const dx = (e.x || 0) - worldX;
      const dy = (e.y || 0) - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        best = { kind, id: e.id || 0, x: e.x || 0, y: e.y || 0, sx: e.sx | 0, sy: e.sy | 0 };
      }
    };

    for (const p of store.players.values()) {
      if (p.id === me.id) continue;
      tryPick('player', p, 42);
    }
    for (const mob of store.mobs.values()) tryPick('mob', mob, 46);
    for (const a of store.asteroids.values()) {
      if (a.bastionWall || a.unselectable) continue;
      tryPick('asteroid', a, 52);
    }
    for (const st of store.structures?.values?.() || []) {
      if (!st.attackable || !sameSector(st)) continue;
      const w = Number(st.w) || (Number(st.radius) || 0) * 2;
      const h = Number(st.h) || (Number(st.radius) || 0) * 2;
      const px = Math.max((st.x || 0) - w * 0.5, Math.min(worldX, (st.x || 0) + w * 0.5));
      const py = Math.max((st.y || 0) - h * 0.5, Math.min(worldY, (st.y || 0) + h * 0.5));
      const d2 = (worldX - px) * (worldX - px) + (worldY - py) * (worldY - py);
      if (d2 <= 38 * 38 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: 'structure', id: st.id || 0, x: st.x || 0, y: st.y || 0, sx: st.sx | 0, sy: st.sy | 0 };
      }
    }
    if (best) return best;
    for (const station of store.stations.values()) tryPick('station', station, 48);
    return best;
  }

  function pickLocalPrimaryTargetScreen(screenX, screenY) {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    const sameSector = (e) => (e?.sx | 0) === (me.sx | 0) && (e?.sy | 0) === (me.sy | 0);
    const tryPick = (kind, e, baseR) => {
      if (!e || !sameSector(e)) return;
      if (kind === 'player' && e.id === me.id) return;
      if (e.bastionWall || e.unselectable) return;
      const sx = (e.x || 0) - camera.x + view.cssW * 0.5;
      const sy = (e.y || 0) - camera.y + view.cssH * 0.5;
      const r = Math.max(baseR, (e.radius || 0) + baseR - 10);
      const dx = sx - screenX;
      const dy = sy - screenY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        best = { kind, id: e.id || 0, x: e.x || 0, y: e.y || 0, sx: e.sx | 0, sy: e.sy | 0 };
      }
    };
    for (const p of store.players.values()) tryPick('player', p, 46);
    for (const mob of store.mobs.values()) tryPick('mob', mob, 52);
    for (const a of store.asteroids.values()) tryPick('asteroid', a, 58);
    for (const st of store.structures?.values?.() || []) {
      if (!st.attackable || !sameSector(st)) continue;
      const w = Number(st.w) || (Number(st.radius) || 0) * 2;
      const h = Number(st.h) || (Number(st.radius) || 0) * 2;
      const cx = (st.x || 0) - camera.x + view.cssW * 0.5;
      const cy = (st.y || 0) - camera.y + view.cssH * 0.5;
      const left = cx - w * 0.5;
      const right = cx + w * 0.5;
      const top = cy - h * 0.5;
      const bottom = cy + h * 0.5;
      const px = Math.max(left, Math.min(screenX, right));
      const py = Math.max(top, Math.min(screenY, bottom));
      const dx = screenX - px;
      const dy = screenY - py;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 42 * 42 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: 'structure', id: st.id || 0, x: st.x || 0, y: st.y || 0, sx: st.sx | 0, sy: st.sy | 0 };
      }
    }
    if (best) return best;
    for (const station of store.stations.values()) tryPick('station', station, 52);
    return best;
  }

  function handlePrimaryDown(screenX, screenY) {
    if (store.myState?.sessionSetup?.pending ?? true) return null;
    const mouseWorld = {
      x: camera.x + (screenX - view.cssW * 0.5),
      y: camera.y + (screenY - view.cssH * 0.5)
    };
    const target = pickLocalPrimaryTargetScreen(screenX, screenY) || pickLocalPrimaryTarget(mouseWorld.x, mouseWorld.y);
    if (target) {
      store.setOptimisticSelection(target.kind, target.id, { lockMs: 30000 });
      if (target.kind === 'station') store.cancelLocalAttack?.();
      else store.setLocalAttackTarget?.(target.kind, target.id, { lockMs: 30000 });
      return { type: 'target', kind: target.kind, id: target.id, x: target.x, y: target.y, sx: target.sx, sy: target.sy };
    }
    store.setOptimisticMoveTarget(mouseWorld.x, mouseWorld.y, { preserveSelection: false, keepAttack: false });
    return { type: 'move', x: mouseWorld.x, y: mouseWorld.y };
  }

  function applyOptimisticPrimaryClick(screenX, screenY) {
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const mouseWorld = {
      x: camera.x + (screenX - view.cssW * 0.5),
      y: camera.y + (screenY - view.cssH * 0.5)
    };
    const target = pickLocalPrimaryTarget(mouseWorld.x, mouseWorld.y);
    if (target) {
      store.setOptimisticSelection(target.kind, target.id);
      if (target.kind === 'station') store.cancelLocalAttack?.();
      else store.setLocalAttackTarget?.(target.kind, target.id);
      // Sélection = action combat locale, pas ordre de déplacement.
      // Sans ce verrou, un léger mouvement de souris après clic droit transformait
      // la sélection en hold-move et le vaisseau partait vers le point cliqué.
      input.holdActive = false;
      input.suppressRightHoldUntilUp = true;
      input.moveWorldQueued = false;
      return;
    }
    store.setOptimisticMoveTarget(mouseWorld.x, mouseWorld.y, { preserveSelection: false, keepAttack: false });
  }


  function findNearbyPortalForLocalPlayer() {
    const me = store.getMe();
    if (!me) return null;
    let best = null;
    let bestD2 = Infinity;
    for (const portal of store.portals.values()) {
      if ((portal.sx | 0) !== (me.sx | 0) || (portal.sy | 0) !== (me.sy | 0)) continue;
      const dx = (portal.x || 0) - me.x;
      const dy = (portal.y || 0) - me.y;
      const d2 = dx * dx + dy * dy;
      const r = (me.radius || 18) + (portal.radius || 38) + 28;
      if (d2 <= r * r && d2 < bestD2) { best = portal; bestD2 = d2; }
    }
    return best;
  }

  function updateTravelOverlay() {
    const loading = store.getLoadingState();
    travelOverlay.classList.toggle('is-active', !!loading.active);
    if (!loading.active) return;
    const label = travelOverlay.querySelector('.travel-loading__label');
    if (label) label.textContent = loading.label || 'Saut de secteur…';
  }

  function clearQueuedInput() {
    input.clickQueued = false;
    input.interactTap = false;
    input.rocketTap = false;
    input.a = false;
    input.z = false;
    input.e = false;
    input.r = false;
    input.rightDown = false;
    input.holdActive = false;
    input.suppressRightHoldUntilUp = false;
  }

  function sendInput(primaryHold) {
    const me = store.getMe();
    if (input.interactTap) {
      const portal = findNearbyPortalForLocalPlayer();
      if (portal) {
        const far = Math.max(Math.abs((portal.targetSx | 0) - (portal.sx | 0)), Math.abs((portal.targetSy | 0) - (portal.sy | 0))) > 1;
        if (far || portal.mode === 'test_arena' || portal.mode === 'mob_bestiary') {
          store.beginPortalLoading(portal.label || `Saut → [${portal.targetSx | 0},${portal.targetSy | 0}]`, far ? 900 : 520);
        }
      }
    }
    const mouseForServer = toPlayerRelativeScreen(me, input.msx, input.msy);
    const actionBatch = Array.isArray(input.actions) && input.actions.length ? input.actions.splice(0, input.actions.length) : [];
    const aimWorldX = camera.x + (input.msx - view.cssW * 0.5);
    const aimWorldY = camera.y + (input.msy - view.cssH * 0.5);
    const clientPose = {
      cx: me?.x,
      cy: me?.y,
      csx: me?.sx,
      csy: me?.sy,
      cvx: me?.vx,
      cvy: me?.vy,
      crot: me?.rot,
      cthrust: me?._localThrust ?? 0
    };
    for (const action of actionBatch) {
      Object.assign(action, clientPose);
      if ((action.type === 'cast' || action.type === 'rocket') && !Number.isFinite(action.aimX)) {
        action.aimX = aimWorldX;
        action.aimY = aimWorldY;
      }
      if (action.type === 'target') {
        let target = null;
        if (action.kind === 'player') target = store.players.get(action.id);
        if (action.kind === 'mob') target = store.mobs.get(action.id);
        if (action.kind === 'asteroid') target = store.asteroids.get(action.id);
        if (action.kind === 'station') target = store.stations.get(action.id);
        if (target) {
          action.targetX = target.x;
          action.targetY = target.y;
          action.targetSx = target.sx | 0;
          action.targetSy = target.sy | 0;
        }
      }
    }
    net.send({
      t: 'input',
      inputSeq: (input.inputSeq = (input.inputSeq | 0) + 1),
      vw: view.cssW,
      vh: view.cssH,
      msx: mouseForServer.x,
      msy: mouseForServer.y,
      // V82: les abilities/rocket/interact passent par actions[].
      // On n'envoie plus les anciens booléens maintenus sur plusieurs frames,
      // sinon le serveur peut rejouer une action après le paquet événementiel.
      a: false,
      z: false,
      e: false,
      r: false,
      interactTap: false,
      rocketTap: false,
      primaryClick: input.clickQueued,
      primaryHold,
      px: mouseForServer.x,
      py: mouseForServer.y,
      moveWorld: input.moveWorldQueued,
      moveWorldX: input.moveWorldX,
      moveWorldY: input.moveWorldY,
      targetClick: !!input.targetClickQueued,
      targetClickKind: input.targetKind || '',
      targetClickId: input.targetId || 0,
      selectSeq: input.selectSeq | 0,
      selectedKind: store.localPrediction?.selectedKind || store.myState?.selectedKind || '',
      selectedId: store.localPrediction?.selectedId || store.myState?.selectedId || 0,
      attackKind: store.localPrediction?.attackKind || '',
      attackId: store.localPrediction?.attackId || 0,
      attackSeq: store.localPrediction?.attackSeq | 0,
      actions: actionBatch,
      aimWorldX,
      aimWorldY,
      localMoveX: store.localPrediction?.moveX ?? 0,
      localMoveY: store.localPrediction?.moveY ?? 0,
      // Mode .io réactif : on laisse temporairement le client piloter sa pose.
      // Le serveur la reprend comme vérité pour éviter les rollbacks perceptibles.
      cx: me?.x,
      cy: me?.y,
      csx: me?.sx,
      csy: me?.sy,
      cvx: me?.vx,
      cvy: me?.vy,
      crot: me?.rot,
      cthrust: me?._localThrust ?? 0,
      clientTime: performance.now(),
      sectorSeq: store.localPrediction?.sectorSeq | 0,
      abilitySeq: store.localPrediction?.abilitySeq | 0
    });

    input.moveWorldQueued = false;
    input.clickQueued = false;
    input.targetClickQueued = false;
    input.interactTap = false;
    input.rocketTap = false;
  }

  function frame() {
    const t = performance.now() / 1000;
    const ctx = view.ctx;
    audio.playPending(store.consumePendingSfx());

    const me = store.getMe();
    audio.update(me, input);
    const dt = Math.min(0.05, Math.max(0, t - lastFrameTime));
    lastFrameTime = t;
    store.interpolate(dt);
    predictor.update(dt, input, view, camera);
    updateCamera(store.getMe(), dt);
    updateTravelOverlay();
    const camX = camera.x;
    const camY = camera.y;
    const mouseWorld = { x: camX + (input.msx - view.cssW * 0.5), y: camY + (input.msy - view.cssH * 0.5) };

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, view.w, view.h);

    drawStars(ctx, view, camX, camY, graphicsOptions.starDensity, store.myState?.sectorBiome || null);
    if (graphicsOptions.showGrid) drawGrid(ctx, view, camX, camY, store.world);

    if (me) drawGroundMarker(ctx, view, me, camX, camY, t);

    for (const s of store.stations.values()) drawStation(ctx, view, s, camX, camY, t);
    for (const st of store.structures.values()) drawStructure(ctx, view, st, camX, camY, t, store.structures);
    drawStructureBuildPreview(ctx, view, basePanel.getPreview(store, mouseWorld), camX, camY, t);
    drawPortals(ctx, view, store, camX, camY);
    for (const a of store.asteroids.values()) drawAsteroid(ctx, view, a, camX, camY);
    for (const mob of store.mobs.values()) drawMob(ctx, view, mob, camX, camY, t);
    if (graphicsOptions.showFx) fxStore.sync(store, t);
    for (const l of store.loots.values()) drawLoot(ctx, view, l, camX, camY);
    if (graphicsOptions.showFx) fxStore.drawTrails(ctx, view, camX, camY, t);
    for (const p of store.projectiles.values()) drawProjectile(ctx, view, p, camX, camY);
    for (const effect of store.areaEffects.values()) drawAreaEffect(ctx, view, effect, camX, camY, t);
    if (graphicsOptions.showFx) {
      fxStore.drawImpacts(ctx, view, camX, camY, t);
      fxStore.drawDamageNumbers(ctx, view, camX, camY, t);
    }
    for (const mob of store.mobs.values()) drawWorldStatuses(ctx, view, mob, camX, camY, t);
    for (const a of store.asteroids.values()) drawWorldStatuses(ctx, view, a, camX, camY, t);

    {
      const selectedKind = store.localPrediction?.selectedKind || store.myState?.selectedKind || '';
      const selectedId = store.localPrediction?.selectedId || store.myState?.selectedId || 0;
      if (selectedKind && selectedId) {
        let target = null;
        if (selectedKind === 'player') target = store.players.get(selectedId);
        if (selectedKind === 'mob') target = store.mobs.get(selectedId);
        if (selectedKind === 'asteroid') target = store.asteroids.get(selectedId);
        if (selectedKind === 'station') target = store.stations.get(selectedId);
        if (selectedKind === 'structure') target = store.structures.get(selectedId);
        if (target) {
          const age = Math.max(0, Math.min(1, (performance.now() - (store.localPrediction?.selectedAt || 0)) / 260));
          const pulse = 1 + (1 - age) * 0.28;
          drawSelectionRing(ctx, view, target.x, target.y, (target.radius || 18) * pulse, rgba(255, 230, 140, 0.98), camX, camY);
        }
      }
    }

    for (const p of store.players.values()) drawShip(ctx, view, p, camX, camY, t, mouseWorld, store.players, store.asteroids);

    if (me) drawBlindViewportMask(ctx, view, me, t);

    const isDocked = !!store.myState?.dockedStationId;
    cargoPanel.update(store.myState?.inv, { isDocked });
    dock.setBadge('cargo', store.myState?.inv ? `${store.myState.inv.cargoUsed | 0}` : '');
    dock.setEnabled('cargo', !isDocked);

    shipPanel.update(store.myState);
    const activeConverterCount = Math.max(0, store.myState?.equipment?.converters?.summary?.enabledCount | 0);
    dock.setBadge('ship', activeConverterCount > 0 ? `${activeConverterCount}` : '');
    dock.setEnabled('ship', !!store.myState?.equipment);

    basePanel.update(store);
    storagePanel.update(store);
    machinePanel.update(store);
    rocketWorkshopPanel.update(store);
    researchStationPanel.update(store);
    equipmentFabricatorPanel.update(store);
    equipmentRDStationPanel.update(store);
    researchTreePanel.update(store);
    playersPanel.update(store.playerDirectory, store.session, store.myId, store.modes, store);
    mapWindow.update(store.myState?.map, store.myState?.inv, store.seed);
    stationWindow.update(store.myState, store.stations);
    sessionSetup.sync(store.myState, !!store.myId, store.modes);

    if (me && !(store.myState?.sessionSetup?.pending ?? true)) {
      drawHud(ctx, view, me, store.myState, input);
      drawRadar(ctx, view, me, store.players, store.mobs, store.asteroids, store.stations, store.myState);
      drawContextHint(ctx, view, me, store.stations);
    }

    statusEl.textContent = store.myId ? '' : 'Connexion…';

    const now = performance.now();
    if (now - lastSend >= 4) {
      lastSend = now;
      if (store.myState?.sessionSetup?.pending ?? true) clearQueuedInput();
      else sendInput(input.rightDown && input.holdActive && !input.suppressRightHoldUntilUp && !store.getLoadingState?.().active);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
