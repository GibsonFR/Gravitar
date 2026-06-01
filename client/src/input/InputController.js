import { isControlMatch } from './KeyBindings.js';

function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!target.isContentEditable;
}

export class InputController {
  constructor(canvas, input, handlers = {}) {
    this.canvas = canvas;
    this.input = input;
    this.getKeyBindings = typeof handlers.getKeyBindings === 'function' ? handlers.getKeyBindings : (() => ({}));

    const queueAction = (action) => {
      if (!Array.isArray(input.actions)) input.actions = [];
      input.actionSeq = (input.actionSeq | 0) + 1;
      input.actions.push({ seq: input.actionSeq, time: performance.now(), ...action });
      if (input.actions.length > 32) input.actions.splice(0, input.actions.length - 32);
      input.forceSend = true;
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
      const bindings = this.getKeyBindings();

      if (ev.ctrlKey) {
        if (isControlMatch(bindings, 'abilityA', ev)) { handlers.onAbilityUpgrade?.('A'); ev.preventDefault(); return; }
        if (isControlMatch(bindings, 'abilityZ', ev)) { handlers.onAbilityUpgrade?.('Z'); ev.preventDefault(); return; }
        if (isControlMatch(bindings, 'abilityE', ev)) { handlers.onAbilityUpgrade?.('E'); ev.preventDefault(); return; }
        if (isControlMatch(bindings, 'abilityR', ev)) { handlers.onAbilityUpgrade?.('R'); ev.preventDefault(); return; }
      }

      if (isControlMatch(bindings, 'cameraLock', ev)) {
        input.cameraLocked = !input.cameraLocked;
        input.cameraToggleQueued = true;
        ev.preventDefault();
        return;
      }

      if (isControlMatch(bindings, 'abilityA', ev)) input.a = true;
      if (isControlMatch(bindings, 'abilityZ', ev)) input.z = true;
      if (isControlMatch(bindings, 'abilityE', ev)) input.e = true;
      if (isControlMatch(bindings, 'abilityR', ev)) input.r = true;
      if (isControlMatch(bindings, 'interact', ev)) { input.interactTap = true; queueAction({ type: 'interact' }); }
      if (isControlMatch(bindings, 'rocket', ev)) input.rocketTap = true;
      if (isControlMatch(bindings, 'rocketSlot0', ev)) {
        handlers.onRocketSlotSwitch?.(0);
        ev.preventDefault();
        return;
      }
      if (isControlMatch(bindings, 'rocketSlot1', ev)) {
        handlers.onRocketSlotSwitch?.(1);
        ev.preventDefault();
        return;
      }
      if (isControlMatch(bindings, 'frameVanguard', ev)) handlers.onFrameSelect?.('vanguard');
      if (isControlMatch(bindings, 'frameSigil', ev)) handlers.onFrameSelect?.('sigil');
      if (isControlMatch(bindings, 'frameBulwark', ev)) handlers.onFrameSelect?.('bulwark');
    });

    window.addEventListener('keyup', (ev) => {
      if (isEditableTarget(ev.target)) return;
      const bindings = this.getKeyBindings();
      if (isControlMatch(bindings, 'abilityA', ev)) input.a = false;
      if (isControlMatch(bindings, 'abilityZ', ev)) input.z = false;
      if (isControlMatch(bindings, 'abilityE', ev)) input.e = false;
      if (isControlMatch(bindings, 'abilityR', ev)) input.r = false;
    });
  }
}
