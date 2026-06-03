function ensure(player) {
  if (!player) return null;
  if (!Array.isArray(player.pendingAbilityProtocolEvents)) player.pendingAbilityProtocolEvents = [];
  return player.pendingAbilityProtocolEvents;
}

export function queueAbilityProtocolEvent(player, type, slot, options = {}) {
  const arr = ensure(player);
  if (!arr) return;
  arr.push({
    type: String(type || ''),
    slot: String(slot || '').toUpperCase(),
    seq: options.seq | 0,
    reason: String(options.reason || '').slice(0, 64),
    accepted: !!options.accepted,
    cooldownLeft: Number.isFinite(Number(options.cooldownLeft)) ? Number(options.cooldownLeft) : 0,
    energyLeft: Number.isFinite(Number(options.energyLeft)) ? Number(options.energyLeft) : undefined,
    clientPoseApplied: !!options.clientPoseApplied,
    localAuthorityMs: Number.isFinite(Number(options.localAuthorityMs)) ? Number(options.localAuthorityMs) : 0,
    aimX: Number.isFinite(Number(options.aimX)) ? Number(options.aimX) : undefined,
    aimY: Number.isFinite(Number(options.aimY)) ? Number(options.aimY) : undefined,
    frameId: String(options.frameId || player.frameId || '')
  });
  if (arr.length > 64) arr.splice(0, arr.length - 64);
}

export function drainAbilityProtocolEvents(player) {
  if (!Array.isArray(player?.pendingAbilityProtocolEvents) || !player.pendingAbilityProtocolEvents.length) return [];
  const out = player.pendingAbilityProtocolEvents;
  player.pendingAbilityProtocolEvents = [];
  return out;
}
