export function handleMachineClose(state, player) {
  player.openMachineId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}
