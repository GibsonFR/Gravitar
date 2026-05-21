export function createInputState() {
  return {
    msx: 0,
    msy: 0,
    a: false,
    z: false,
    e: false,
    r: false,
    interactTap: false,
    rocketTap: false,
    rightDown: false,
    holdActive: false,
    downX: 0,
    downY: 0,
    clickQueued: false,
    moveWorldQueued: false,
    moveWorldX: 0,
    moveWorldY: 0,
    cameraLocked: false,
    cameraToggleQueued: false
  };
}
