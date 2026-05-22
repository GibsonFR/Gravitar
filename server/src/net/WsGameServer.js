import { WebSocketServer } from 'ws';

const RECONNECT_GRACE_MS = 45000;

function normalizeSessionToken(raw) {
  const token = String(raw || '').trim();
  if (!/^[a-zA-Z0-9_-]{24,96}$/.test(token)) return '';
  return token;
}

function getSessionTokenFromRequest(req) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return normalizeSessionToken(url.searchParams.get('sid') || '');
  } catch {
    return '';
  }
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
    // Do not let websocket backpressure grow the Node heap. If a browser tab or
    // network cannot keep up, skip this snapshot; the next one will replace it.
    if ((ws.bufferedAmount || 0) > 768 * 1024) return;
    ws.send(JSON.stringify(snapshot));
  }

  function removeSessionPlayer(sessionToken, playerId) {
    const current = sessionToken ? sessions.get(sessionToken) : null;
    if (current?.playerId === playerId) sessions.delete(sessionToken);
    connections.delete(playerId);
    game.removePlayer(playerId);
  }

  wss.on('connection', (ws, req) => {
    const sessionToken = getSessionTokenFromRequest(req);
    let id = 0;
    let session = sessionToken ? sessions.get(sessionToken) : null;

    if (session && game.state?.players?.has?.(session.playerId)) {
      id = session.playerId;
      if (session.removeTimer) clearTimeout(session.removeTimer);
      session.removeTimer = null;
      const previousWs = connections.get(id);
      if (previousWs && previousWs !== ws && previousWs.readyState === previousWs.OPEN) {
        try { previousWs.close(4000, 'replaced'); } catch {}
      }
    } else {
      id = game.allocatePlayerId();
      game.addPlayer(id);
      if (sessionToken) {
        session = { playerId: id, removeTimer: null };
        sessions.set(sessionToken, session);
      }
    }

    ws.playerId = id;
    ws.sessionToken = sessionToken;
    connections.set(id, ws);

    ws.send(JSON.stringify({ t: 'hello', id }));

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      if (!msg) return;
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
      if (connections.get(id) !== ws) return;
      connections.delete(id);
      const token = ws.sessionToken || '';
      const entry = token ? sessions.get(token) : null;
      if (entry?.playerId === id) {
        if (entry.removeTimer) clearTimeout(entry.removeTimer);
        entry.removeTimer = setTimeout(() => removeSessionPlayer(token, id), RECONNECT_GRACE_MS);
      } else {
        game.removePlayer(id);
      }
    });
  });

  game.start(getConnectedIds, sendSnapshot);

  return { wss };
}
