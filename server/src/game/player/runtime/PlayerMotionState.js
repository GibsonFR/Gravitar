export function createPlayerMotionState() {
  return {
    hasMoveTarget: false,
    moveTx: 0,
    moveTy: 0,
    holdMoveAllowed: false,
    groundMarkerX: 0,
    groundMarkerY: 0,
    groundMarkerTimer: 0
  };
}
