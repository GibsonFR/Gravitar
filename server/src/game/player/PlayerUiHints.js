export function setPlayerHint(player, text, duration = 2.2) {
  player.uiHint = text;
  player.uiHintTimer = duration;
}
