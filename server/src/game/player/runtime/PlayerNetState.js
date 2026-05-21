export function createPlayerNetState() {
  return {
    lastAcceptedInputAt: 0,
    lastAcceptedCommandAt: 0,
    droppedInputCount: 0,
    droppedCommandCount: 0
  };
}
