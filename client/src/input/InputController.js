function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!target.isContentEditable;
}

export class InputController {
  constructor(canvas, input, handlers = {}) {
    this.canvas = canvas;
    this.input = input;

    const queueAction = (action) => {
      if (!Array.isArray(input.actions)) input.actions = [];
      input.actionSeq = (input.actionSeq | 0) + 1;
      input.actions.push({ seq: input.actionSeq, time: performance.now(), ...action });
      if (input.actions.length > 32) input.actions.splice(0, input.actions.length - 32);
    };

    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

    canvas.addEventListener('mousemove', (ev) => {
      const rect = canvas.getBoundingClientRect();
      input.msx = ev.clientX - rect.left;
      input.msy = ev.clientY - rect.top;
      if (input.rightDown && !input.holdActive && !input.suppressRightHoldUntilUp) {
        const dx = input.msx - input.downX;
        const dy = input.msy - input.downY;
        if (dx * dx + dy * dy >= 36) input.holdActive = true;
      }
    });

    canvas.addEventListener('mousedown', (ev) => {
      if (ev.button !== 2) return;
      const rect = canvas.getBoundingClientRect();
      input.msx = ev.clientX - rect.left;
      input.msy = ev.clientY - rect.top;
      input.rightDown = true;
      input.holdActive = false;
      input.suppressRightHoldUntilUp = false;
      input.downX = input.msx;
      input.downY = input.msy;

      const handled = handlers.onPrimaryDown?.(input.msx, input.msy);
      if (handled?.type === 'target') {
        input.clickQueued = false;
        input.moveWorldQueued = false;
        input.targetClickQueued = true;
        input.targetKind = handled.kind || '';
        input.targetId = handled.id || 0;
        input.selectSeq = (input.selectSeq | 0) + 1;
        queueAction({
          type: 'target',
          kind: input.targetKind,
          id: input.targetId,
          selectSeq: input.selectSeq,
          attack: handled.kind !== 'station',
          targetX: handled.x,
          targetY: handled.y,
          targetSx: handled.sx,
          targetSy: handled.sy
        });
        input.suppressRightHoldUntilUp = true;
      } else if (handled?.type === 'move') {
        input.clickQueued = false;
        input.moveWorldQueued = true;
        input.moveWorldX = handled.x;
        input.moveWorldY = handled.y;
        queueAction({ type: 'cancelAttack', clearSelection: true });
        queueAction({ type: 'move', x: handled.x, y: handled.y });
      } else {
        input.clickQueued = true;
      }

      canvas.focus();
      ev.preventDefault();
    });

    window.addEventListener('mouseup', (ev) => {
      if (ev.button === 2) {
        input.rightDown = false;
        input.holdActive = false;
        input.suppressRightHoldUntilUp = false;
      }
    });

    window.addEventListener('keydown', (ev) => {
      if (isEditableTarget(ev.target)) return;
      if (ev.repeat) return;
      const k = ev.key;
      const lower = k.toLowerCase();

      if (ev.ctrlKey && ['a', 'z', 'e', 'r'].includes(lower)) {
        handlers.onAbilityUpgrade?.(lower.toUpperCase());
        ev.preventDefault();
        return;
      }

      if (ev.code === 'Space' || k === ' ') {
        input.cameraLocked = !input.cameraLocked;
        input.cameraToggleQueued = true;
        ev.preventDefault();
        return;
      }

      // Les abilities/roquettes ne sont plus mises en paquet ici.
      // Le prédicteur client décide d'abord si l'action est localement légale
      // (cooldown, énergie, statut bloquant), applique le feedback immédiat,
      // puis ajoute le paquet exact à envoyer au serveur.
      // Ça évite le conflit où le serveur castait une ability que le client
      // avait refusée localement, ou inversement.
      if (lower === 'a') input.a = true;
      if (lower === 'z') input.z = true;
      if (lower === 'e') input.e = true;
      if (lower === 'r') input.r = true;
      if (lower === 'd') { input.interactTap = true; queueAction({ type: 'interact' }); }
      if (lower === 'f') input.rocketTap = true;
      if (lower === 'x') {
        handlers.onRocketSlotSwitch?.(0);
        ev.preventDefault();
        return;
      }
      if (lower === 'c') {
        handlers.onRocketSlotSwitch?.(1);
        ev.preventDefault();
        return;
      }
      if (k === '1') handlers.onFrameSelect?.('vanguard');
      if (k === '2') handlers.onFrameSelect?.('sigil');
      if (k === '3') handlers.onFrameSelect?.('bulwark');
    });

    window.addEventListener('keyup', (ev) => {
      if (isEditableTarget(ev.target)) return;
      const lower = ev.key.toLowerCase();
      if (lower === 'a') input.a = false;
      if (lower === 'z') input.z = false;
      if (lower === 'e') input.e = false;
      if (lower === 'r') input.r = false;
    });
  }
}
