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
import { ConvertersPanelView } from './ui/converters/ConvertersPanelView.js';
import { getConverterIconSvg } from './ui/converters/ConverterIconSvg.js';
import { SessionSetupOverlay } from './ui/session/SessionSetupOverlay.js';
import { getCombatHudLayout, hitTestHudAbility } from './ui/hud/HudLayout.js';
import { getEquippedHudHit } from './ui/hud/HudEquipmentPanelRenderer.js';
import { VisualFxStore } from './fx/VisualFxStore.js';
import { drawWorldStatuses } from './ui/status/WorldStatusRenderer.js';
import { PlayersPanelView } from './ui/players/PlayersPanelView.js';
import { OptionsPanelView } from './ui/options/OptionsPanelView.js';
import { getOptionsIconSvg } from './ui/options/OptionsIconSvg.js';
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
  const audio = new AudioSystem();
  let graphicsOptions = { starDensity: 1, showGrid: true, showFx: true, renderScale: 1 };
  const fxStore = new VisualFxStore();
  const uiRoot = document.getElementById('ui-root');
  const dock = new TopRightDock(uiRoot);
  const playersPanel = new PlayersPanelView();
  uiRoot.appendChild(playersPanel.el);

  const net = new NetClient(store, (txt) => { statusEl.textContent = txt; });
  net.connect();

  const sendCmd = (cmd, payload) => net.send({ t: 'cmd', cmd, ...(payload || {}) });
  const chatUi = createChatUi(uiRoot, store, (text) => net.send({ t: 'chat', text }));

  const cargoPanel = new CargoPanelView(sendCmd);
  dock.registerPanel({ id: 'cargo', title: 'Cargo', iconMarkup: getCargoIconSvg(), panelEl: cargoPanel.el });

  const convertersPanel = new ConvertersPanelView(sendCmd);
  dock.registerPanel({ id: 'converters', title: 'Convert.', iconMarkup: getConverterIconSvg(), panelEl: convertersPanel.el, shellClass: 'ui-panel-shell--converters' });

  const optionsPanel = new OptionsPanelView((settings) => {
    audio.applySettings(settings);
    graphicsOptions = { ...graphicsOptions, ...settings };
    view.setRenderScale(settings.renderScale);
  });
  graphicsOptions = { ...graphicsOptions, ...optionsPanel.getSettings() };
  audio.applySettings(optionsPanel.getSettings());
  view.setRenderScale(optionsPanel.getSettings().renderScale);
  dock.registerPanel({ id: 'options', title: 'Options', iconMarkup: getOptionsIconSvg(), panelEl: optionsPanel.el });


  dock.registerToggle({
    id: 'quit-session',
    title: 'Quitter',
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
    iconMarkup: getMapIconSvg(),
    onToggle: () => mapWindow.toggle(),
    isActive: () => mapWindow.isOpen
  });

  const stationWindow = new StationWindowView(sendCmd);
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
    onAbilityUpgrade: (slot) => sendCmd('upgrade_ability', { slot }),
    onRocketSlotSwitch: (slot) => sendCmd('switch_rocket_slot', { slot })
  });
  audio.installUnlock(canvas);

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 2) return;
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const rect = canvas.getBoundingClientRect();
    applyOptimisticPrimaryClick(ev.clientX - rect.left, ev.clientY - rect.top);
  });

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    if (store.myState?.sessionSetup?.pending ?? true) return;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
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
    if (!camera.initialized || sectorChanged) {
      hardCenterCameraOnPlayer(me);
      return;
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
        best = { kind, id: e.id || 0, x: e.x || 0, y: e.y || 0 };
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
    if (best) return best;
    for (const station of store.stations.values()) tryPick('station', station, 48);
    return best;
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
      return;
    }
    store.setOptimisticSelection('', 0);
    store.setOptimisticMoveTarget(mouseWorld.x, mouseWorld.y);
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
  }

  function sendInput(primaryHold) {
    const me = store.getMe();
    const mouseForServer = toPlayerRelativeScreen(me, input.msx, input.msy);
    net.send({
      t: 'input',
      vw: view.cssW,
      vh: view.cssH,
      msx: mouseForServer.x,
      msy: mouseForServer.y,
      a: input.a,
      z: input.z,
      e: input.e,
      r: input.r,
      interactTap: input.interactTap,
      rocketTap: input.rocketTap,
      primaryClick: input.clickQueued,
      primaryHold,
      px: mouseForServer.x,
      py: mouseForServer.y,
      moveWorld: input.moveWorldQueued,
      moveWorldX: input.moveWorldX,
      moveWorldY: input.moveWorldY,
      selectedKind: store.myState?.selectedKind || store.localPrediction?.selectedKind || '',
      selectedId: store.myState?.selectedId || store.localPrediction?.selectedId || 0,
      aimWorldX: camera.x + (input.msx - view.cssW * 0.5),
      aimWorldY: camera.y + (input.msy - view.cssH * 0.5),
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
      clientTime: performance.now()
    });

    input.moveWorldQueued = false;
    input.clickQueued = false;
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
    const camX = camera.x;
    const camY = camera.y;
    const mouseWorld = { x: camX + (input.msx - view.cssW * 0.5), y: camY + (input.msy - view.cssH * 0.5) };

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, view.w, view.h);

    drawStars(ctx, view, camX, camY, graphicsOptions.starDensity);
    if (graphicsOptions.showGrid) drawGrid(ctx, view, camX, camY, store.world);

    if (me) drawGroundMarker(ctx, view, me, camX, camY, t);

    for (const s of store.stations.values()) drawStation(ctx, view, s, camX, camY, t);
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

    if (store.myState?.selectedKind && store.myState?.selectedId) {
      let target = null;
      if (store.myState.selectedKind === 'player') target = store.players.get(store.myState.selectedId);
      if (store.myState.selectedKind === 'mob') target = store.mobs.get(store.myState.selectedId);
      if (store.myState.selectedKind === 'asteroid') target = store.asteroids.get(store.myState.selectedId);
      if (store.myState.selectedKind === 'station') target = store.stations.get(store.myState.selectedId);
      if (target) drawSelectionRing(ctx, view, target.x, target.y, target.radius, rgba(255, 230, 140, 0.95), camX, camY);
    }

    for (const p of store.players.values()) drawShip(ctx, view, p, camX, camY, t, mouseWorld, store.players, store.asteroids);

    if (me) drawBlindViewportMask(ctx, view, me, t);

    const isDocked = !!store.myState?.dockedStationId;
    cargoPanel.update(store.myState?.inv, { isDocked });
    dock.setBadge('cargo', store.myState?.inv ? `${store.myState.inv.cargoUsed | 0}` : '');
    dock.setEnabled('cargo', !isDocked);

    convertersPanel.update(store.myState?.equipment);
    const activeConverterCount = Math.max(0, store.myState?.equipment?.converters?.summary?.enabledCount | 0);
    dock.setBadge('converters', activeConverterCount > 0 ? `${activeConverterCount}` : '');
    dock.setEnabled('converters', !!store.myState?.equipment?.converters);

    playersPanel.update(store.playerDirectory, store.session, store.myId, store.modes);
    mapWindow.update(store.myState?.map, store.myState?.inv, store.seed);
    stationWindow.update(store.myState, store.stations);
    sessionSetup.sync(store.myState, !!store.myId, store.modes);
    chatUi.refresh();

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
      else sendInput(input.rightDown && input.holdActive);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
