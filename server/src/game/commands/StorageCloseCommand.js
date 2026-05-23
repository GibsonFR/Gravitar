export function handleStorageClose(_state, player) {
  if (!player) return false;
  player.openStorageId = 0;
  player.forceFullUiSnapshot = true;
  return true;
}
