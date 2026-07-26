export function isTestRuntimePlayer(player) {
  return player?.gameMode === 'test'
    || player?.gameMode === 'stress'
    || String(player?.worldId || '').startsWith('test');
}
