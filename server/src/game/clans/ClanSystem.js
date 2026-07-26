import { STRUCTURE_TYPES } from '../structures/StructureDefs.js';
import { isStructureAlive } from '../structures/StructureSystem.js';

function accountKey(player) {
  return String(player?.accountKey || '').toLowerCase();
}

function isEndlessAccount(player) {
  return !!accountKey(player) && String(player?.worldId || 'endless') === 'endless' && String(player?.gameMode || 'endless') === 'endless';
}

export function findPlayerClan(state, playerOrKey) {
  const key = typeof playerOrKey === 'string' ? playerOrKey.toLowerCase() : accountKey(playerOrKey);
  if (!key) return null;
  for (const clan of state?.clans?.values?.() || []) if (clan.members.includes(key)) return clan;
  return null;
}

export function areClanMates(state, aKey, bKey) {
  const a = findPlayerClan(state, String(aKey || ''));
  return !!a && a.members.includes(String(bKey || '').toLowerCase());
}

function uniqueClanId(state, tag) {
  const base = String(tag || 'CLAN').toLowerCase();
  let id = base;
  let n = 2;
  while (state.clans.has(id)) id = `${base}-${n++}`;
  return id;
}

export function createClan(state, player, name, tag, timeMs = Date.now()) {
  if (!isEndlessAccount(player)) return { ok: false, error: 'endless_account_required' };
  if (findPlayerClan(state, player)) return { ok: false, error: 'already_in_clan' };
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  const cleanTag = String(tag || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5);
  if (cleanName.length < 3 || cleanTag.length < 2) return { ok: false, error: 'invalid_clan_identity' };
  for (const clan of state.clans.values()) {
    if (clan.name.toLowerCase() === cleanName.toLowerCase() || clan.tag === cleanTag) return { ok: false, error: 'clan_exists' };
  }
  const key = accountKey(player);
  const clan = { id: uniqueClanId(state, cleanTag), name: cleanName, tag: cleanTag, leaderKey: key, members: [key], createdAt: timeMs, raidWins: 0 };
  state.clans.set(clan.id, clan);
  state.clanStore?.saveFromState?.(state);
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function joinClan(state, player, tag) {
  if (!isEndlessAccount(player)) return { ok: false, error: 'endless_account_required' };
  if (findPlayerClan(state, player)) return { ok: false, error: 'already_in_clan' };
  const wanted = String(tag || '').trim().toUpperCase();
  const clan = [...state.clans.values()].find((candidate) => candidate.tag === wanted || candidate.id.toUpperCase() === wanted);
  if (!clan) return { ok: false, error: 'clan_not_found' };
  if (clan.members.length >= 32) return { ok: false, error: 'clan_full' };
  clan.members.push(accountKey(player));
  state.clanStore?.saveFromState?.(state);
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function leaveClan(state, player) {
  if (!isEndlessAccount(player)) return { ok: false, error: 'endless_account_required' };
  const clan = findPlayerClan(state, player);
  if (!clan) return { ok: false, error: 'not_in_clan' };
  const key = accountKey(player);
  clan.members = clan.members.filter((member) => member !== key);
  if (!clan.members.length) {
    state.clans.delete(clan.id);
    for (const structure of state.structures.values()) {
      if (structure.clanId === clan.id) {
        structure.clanId = '';
        structure.clanShared = false;
      }
    }
  } else if (clan.leaderKey === key) {
    clan.leaderKey = clan.members[0];
  }
  state.clanStore?.saveFromState?.(state);
  state.structureStore?.saveFromState?.(state);
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

export function claimCoreForClan(state, player, structureId, shared = true) {
  if (!isEndlessAccount(player)) return { ok: false, error: 'endless_account_required' };
  const clan = findPlayerClan(state, player);
  if (!clan) return { ok: false, error: 'not_in_clan' };
  const core = state.structures?.get?.(structureId | 0);
  if (!core || core.type !== STRUCTURE_TYPES.BASE_CORE || String(core.ownerKey || '').toLowerCase() !== accountKey(player)) return { ok: false, error: 'not_core_owner' };
  core.clanId = shared ? clan.id : '';
  core.clanShared = !!shared;
  core.updatedAt = Date.now();
  const half = Math.max(1, Number(core.claimRadius || 0));
  for (const structure of state.structures.values()) {
    if (String(structure.ownerKey || '').toLowerCase() !== accountKey(player)) continue;
    if (String(structure.worldId || 'endless') !== String(core.worldId || 'endless')) continue;
    if ((structure.sx | 0) !== (core.sx | 0) || (structure.sy | 0) !== (core.sy | 0)) continue;
    if (Math.abs((structure.x || 0) - (core.x || 0)) > half || Math.abs((structure.y || 0) - (core.y || 0)) > half) continue;
    structure.clanId = shared ? clan.id : '';
    structure.clanShared = !!shared;
  }
  state.structureStore?.saveFromState?.(state);
  player.forceFullUiSnapshot = true;
  return { ok: true };
}

function clanTerritories(state, clan) {
  const bySector = new Map();
  for (const structure of state?.structures?.values?.() || []) {
    if (structure.type !== STRUCTURE_TYPES.BASE_CORE || !isStructureAlive(structure) || structure.clanId !== clan.id || !structure.clanShared) continue;
    const key = `${structure.sx | 0},${structure.sy | 0}`;
    if (!bySector.has(key)) bySector.set(key, { sx: structure.sx | 0, sy: structure.sy | 0, coreId: structure.id | 0 });
  }
  return [...bySector.values()];
}

export function buildClanSnapshot(state, player) {
  const clan = findPlayerClan(state, player);
  const rankings = [...(state?.clans?.values?.() || [])].map((candidate) => {
    const territories = clanTerritories(state, candidate);
    const wealth = [...(state?.structures?.values?.() || [])].filter((structure) => structure.clanId === candidate.id).length;
    return { id: candidate.id, name: candidate.name, tag: candidate.tag, members: candidate.members.length, territories: territories.length, wealth, raidWins: candidate.raidWins | 0 || 0 };
  }).sort((a, b) => b.territories - a.territories || b.wealth - a.wealth || a.name.localeCompare(b.name)).slice(0, 20);
  if (!clan) return { joined: false, rankings };
  return {
    joined: true,
    id: clan.id,
    name: clan.name,
    tag: clan.tag,
    leader: clan.leaderKey === accountKey(player),
    members: clan.members.length,
    territories: clanTerritories(state, clan),
    rankings
  };
}

export function buildTerritoryMapSnapshot(state, player) {
  const out = [];
  for (const clan of state?.clans?.values?.() || []) {
    for (const territory of clanTerritories(state, clan)) out.push({ ...territory, clanId: clan.id, clanName: clan.name, clanTag: clan.tag, mine: clan.members.includes(accountKey(player)) });
  }
  return out;
}
