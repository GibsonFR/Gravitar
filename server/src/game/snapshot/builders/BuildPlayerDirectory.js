import { buildBastionBuffSnapshot } from '../../bastion/BastionBuffs.js';

export function buildPlayerDirectorySnapshot(state, viewer = null) {
  const worldId = viewer?.worldId || 'endless';
  return [...(state?.players?.values?.() ?? [])]
    .filter((p) => p && !p.sessionSetupPending && String(p.worldId || 'endless') === String(worldId))
    .map((p) => ({
      id: p.id | 0,
      pseudo: p.pseudo || `Joueur ${p.id}`,
      frameId: p.frameId || '',
      frameName: p.frameName || '',
      level: p.progression?.level ?? 1,
      sx: p.sx | 0,
      sy: p.sy | 0,
      inBastion: !!p.bastionReturn,
      bastions: buildBastionBuffSnapshot(p).slice(0, 12)
    }));
}
