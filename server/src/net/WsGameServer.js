import { WebSocketServer } from 'ws';

export function createWsGameServer(httpServer, game) {
  const wss = new WebSocketServer({ server: httpServer });
  const connections = new Map();

  function getConnectedIds() {
    return [...connections.keys()];
  }

  function sendSnapshot(playerId, snapshot) {
    const ws = connections.get(playerId);
    if (!ws || ws.readyState !== ws.OPEN) return;
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
      if (msg.t === 'cmd') game.handleCommand(id, msg);
    });

    ws.on('close', () => {
      connections.delete(id);
      game.removePlayer(id);
    });
  });

  game.start(getConnectedIds, sendSnapshot);

  return { wss };
}
