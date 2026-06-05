import { WebSocketServer } from 'ws';

export function createWsGameServer(httpServer, game) {
  const wss = new WebSocketServer({ server: httpServer });
  const connections = new Map();
  let chatSeq = 1;
  let netStatsAt = Date.now();
  let netBytesOut = 0;
  let netSnapsOut = 0;
  let netSnapshotsDroppedBackpressure = 0;

  function accountOut(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return;
    netBytesOut += bytes;
    const now = Date.now();
    if (process.env.NET_DEBUG === '1' && now - netStatsAt >= 10000) {
      const sec = Math.max(1, (now - netStatsAt) / 1000);
      console.log(`[net] out=${Math.round(netBytesOut / sec)}B/s snaps=${Math.round(netSnapsOut / sec)}/s clients=${connections.size}`);
      netStatsAt = now;
      netBytesOut = 0;
      netSnapsOut = 0;
    }
  }

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
      if (ws.readyState === ws.OPEN) { ws.send(payload); accountOut(Buffer.byteLength(payload)); }
    }
  }

  function getConnectedIds() {
    return [...connections.keys()];
  }

  function sendSnapshot(playerId, snapshot) {
    const ws = connections.get(playerId);
    if (!ws || ws.readyState !== ws.OPEN) return false;
    // Do not let websocket backpressure grow the Node heap. If a browser tab or
    // network cannot keep up, skip this snapshot; the next one will replace it.
    // 256 KB is enough for a few frames at 15 Hz; beyond that, sending more only
    // creates a delayed burst and visible lag spikes.
    if ((ws.bufferedAmount || 0) > 256 * 1024) {
      netSnapshotsDroppedBackpressure += 1;
      return false;
    }
    snapshot.net = {
      ...(snapshot.net || {}),
      serverSentAt: Date.now(),
      wsBufferedAmount: ws.bufferedAmount || 0,
      droppedBackpressureTotal: netSnapshotsDroppedBackpressure
    };
    const payload = JSON.stringify(snapshot);
    ws.send(payload);
    netSnapsOut += 1;
    accountOut(Buffer.byteLength(payload));
    return true;
  }

  wss.on('connection', (ws) => {
    const id = game.allocatePlayerId();
    ws.playerId = id;
    connections.set(id, ws);

    game.addPlayer(id);

    ws.send(JSON.stringify({ t: 'hello', id, protocol: game.isNetV2ResetEnabled?.() ? 'net_v2_reset' : 'legacy' }));

    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      if (!msg) return;
      if (msg.t === 'ping') {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            t: 'pong',
            seq: msg.seq | 0,
            clientSentAt: Number(msg.clientSentAt) || 0,
            clientDate: Number(msg.clientDate) || 0,
            serverTime: Date.now()
          }));
        }
        return;
      }
      if (msg.t === 'input') game.handleInput(id, msg);
      if (msg.t === 'deploy_v2') {
        let ok = false;
        let error = '';
        try {
          const result = game.handleCommand(id, { ...msg, t: 'cmd', cmd: 'commit_session_setup' });
          if (typeof result === 'object' && result) {
            ok = !!result.ok;
            error = String(result.error || '');
          } else {
            ok = !!result;
          }
        } catch (err) {
          ok = false;
          error = 'server_exception';
          console.error('[ws:deploy_v2:error]', err?.stack || err);
        }
        if (ws.readyState === ws.OPEN) {
          const ack = JSON.stringify({
            t: 'cmd_ack',
            protocol: game.isNetV2ResetEnabled?.() ? 'net_v2_reset' : 'legacy',
            cmdId: String(msg.cmdId || '').slice(0, 48),
            cmd: 'commit_session_setup',
            ok: !!ok,
            error,
            time: Date.now()
          });
          ws.send(ack);
          accountOut(Buffer.byteLength(ack));
          const statePacket = game.buildBootstrapV2?.(id, Date.now(), { reason: 'deploy_v2' }) || game.buildStateV2?.(id, Date.now());
          if (statePacket) {
            const payload = JSON.stringify(statePacket);
            ws.send(payload);
            accountOut(Buffer.byteLength(payload));
          }
          const sessionPacket = game.buildSessionV2?.(id, Date.now());
          if (sessionPacket) {
            const payload = JSON.stringify(sessionPacket);
            ws.send(payload);
            accountOut(Buffer.byteLength(payload));
          }
        }
        return;
      }
      if (msg.t === 'loot_pickup_v2') {
        const result = game.handleLootPickup?.(id, msg) || { ok: false, error: 'unsupported' };
        if (msg.seq && ws.readyState === ws.OPEN) {
          const payload = JSON.stringify({
            t: 'loot_pickup_ack_v2',
            seq: msg.seq | 0,
            lootId: msg.lootId | 0,
            ok: !!result.ok,
            error: result.error || '',
            time: Date.now()
          });
          ws.send(payload);
          accountOut(Buffer.byteLength(payload));
        }
        return;
      }
      if (msg.t === 'state_req_v2') {
        const packet = game.buildStateV2?.(id, Date.now());
        if (packet && ws.readyState === ws.OPEN) {
          const payload = JSON.stringify(packet);
          ws.send(payload);
          accountOut(Buffer.byteLength(payload));
        }
      }
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
          const payload = JSON.stringify({
            t: 'cmd_ack',
            cmdId: String(msg.cmdId).slice(0, 48),
            cmd: String(msg.cmd || '').slice(0, 32),
            ok: !!ok,
            error,
            time: Date.now()
          });
          ws.send(payload);
          accountOut(Buffer.byteLength(payload));
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
