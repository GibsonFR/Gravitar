import { WebSocketServer } from 'ws';

export function createWsGameServer(httpServer, game) {
  const wss = new WebSocketServer({ server: httpServer });
  const connections = new Map();
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

  wss.on('connection', (ws) => {
    const id = game.allocatePlayerId();
    ws.playerId = id;
    connections.set(id, ws);

    game.addPlayer(id);

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
          ok = game.handleCommand(id, msg);
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
      connections.delete(id);
      game.removePlayer(id);
    });
  });

  game.start(getConnectedIds, sendSnapshot);

  return { wss };
}
