export function createPlayerUiState(now) {
  return {
    lastInputAt: now,
    uiHint: '',
    uiHintTimer: 0
  };
}
