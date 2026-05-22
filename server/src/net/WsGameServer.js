import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const RECONNECT_GRACE_MS = 45000;

function makeSessionToken() {
  try { return crypto.randomBytes(18).toString('base64url'); }
  catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

function cleanSessionToken(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_\-.]/g, '').slice(0, 96);
}

function resetNetworkSequencers(player) {
  if (!player) return;
  player.net = {
    ...(player.net || {}),
    lastAcceptedInputAt: 0,
    lastAcceptedCommandAt: 0,
    droppedInputCount: 0,
    droppedCommandCount: 0,
    lastInputSeq: 0
  };
  player.lastActionSeq = 0;
  player.lastClientSelectSeq = 0;
  player.lastClientAbilitySeq = 0;
  player.lastClientSectorSeq = 0;
  player.clientAuthoritativeUntil = 0;
  player.clientAppliedAbilityPose = null;
}

export function createWsGameServer(httpServer, game) {
  const wss = new WebSocketServer({ server: httpServer });
  const connections = new Map();
  const sessions = new Map();
  let chatSeq = 1;

  function sanitizeChatText(text) {
    return String(text || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 220);
  }

  function broadcastChat(fromId, text) {
    const clean = sanitizeChatText(text);
    if (!clean) return;
    const p = game.state?.players?.get?.(fromId) || null;
    const payload = JSON.stringify({
      t: 'chat',
      id: `${Date.now()}-${chatSeq++}`,
      fromId,
      name: String(p?.pseudo || `Pilote ${fromId}`).slice(0, 24),
      text: clean,
      time: Date.now()
    });
    for (const ws of connections.values()) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  function getConnectedIds() {
    return [...connections.keys()];
  }

  function sendSnapshot(playerId, snapshot) {
    const ws = connections.get(playerId);
    if (!ws || ws.readyState !== ws.OPEN) return;
    if ((ws.bufferedAmount || 0) > 768 * 1024) return;
    ws.send(JSON.stringify(snapshot));
  }

  function getResumeTokenFromRequest(req) {
    try {
      const url = new URL(req.url || '/', 'ws://local');
      return cleanSessionToken(url.searchParams.get('resume') || '');
    } catch {
      return '';
    }
  }

  function bindSocketToPlayer(ws, playerId, token, resumed) {
    const previous = connections.get(playerId);
    if (previous && previous !== ws) {
      try { previous.close(4000, 'session_replaced'); } catch {}
    }

    connections.set(playerId, ws);
    ws.playerId = playerId;
    ws.sessionToken = token;

    const session = sessions.get(token) || { token, playerId, removeTimer: null };
    session.playerId = playerId;
    if (session.removeTimer) {
      clearTimeout(session.removeTimer);
      session.removeTimer = null;
    }
    sessions.set(token, session);

    const player = game.state?.players?.get?.(playerId);
    resetNetworkSequencers(player);

    ws.send(JSON.stringify({ t: 'hello', id: playerId, sessionToken: token, resumed: !!resumed }));
  }

  function createFreshSocketSession(ws) {
    const id = game.allocatePlayerId();
    const token = makeSessionToken();
    game.addPlayer(id);
    bindSocketToPlayer(ws, id, token, false);
  }

  function scheduleSessionRemoval(playerId, token) {
    const session = sessions.get(token);
    if (!session || (session.playerId | 0) !== (playerId | 0)) return;
    if (session.removeTimer) clearTimeout(session.removeTimer);
    session.removeTimer = setTimeout(() => {
      const current = sessions.get(token);
      if (!current || (current.playerId | 0) !== (playerId | 0)) return;
      if (connections.has(playerId)) return;
      sessions.delete(token);
      game.removePlayer(playerId);
    }, RECONNECT_GRACE_MS);
  }

  wss.on('connection', (ws, req) => {
    const requestedToken = getResumeTokenFromRequest(req);
    const session = requestedToken ? sessions.get(requestedToken) : null;
    const canResume = !!session && game.state?.players?.has?.(session.playerId | 0);

    if (canResume) bindSocketToPlayer(ws, session.playerId | 0, requestedToken, true);
    else createFreshSocketSession(ws);

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      if (!msg) return;
      const id = ws.playerId | 0;
      if (!id || connections.get(id) !== ws) return;

      if (msg.t === 'input') game.handleInput(id, msg);
      if (msg.t === 'cmd') {
        let ok = false;
        let error = '';
        try {
          const result = game.handleCommand(id, msg);
          if (typeof result === 'object' && result) {
            ok = !!result.ok;
            error = String(result.error || '');
          } else {
            ok = !!result;
          }
        } catch (err) {
          ok = false;
          error = 'server_exception';
          console.error('[ws:cmd:error]', msg?.cmd || 'unknown', err?.stack || err);
        }
        if (msg.cmdId && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            t: 'cmd_ack',
            cmdId: String(msg.cmdId).slice(0, 48),
            cmd: String(msg.cmd || '').slice(0, 32),
            ok: !!ok,
            error,
            time: Date.now()
          }));
        }
      }
      if (msg.t === 'chat') broadcastChat(id, msg.text);
    });

    ws.on('close', () => {
      const id = ws.playerId | 0;
      const token = cleanSessionToken(ws.sessionToken || '');
      if (!id) return;
      if (connections.get(id) !== ws) return;
      connections.delete(id);
      if (token) scheduleSessionRemoval(id, token);
      else game.removePlayer(id);
    });
  });

  game.start(getConnectedIds, sendSnapshot);

  return { wss };
}
