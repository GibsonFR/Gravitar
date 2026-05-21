import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PORT, MIME } from './config/ServerConfig.js';
import { createStaticServer } from './http/StaticServer.js';
import { createWsGameServer } from './net/WsGameServer.js';
import { createGameServer } from './game/GameServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveStaticRoot() {
  const candidates = [
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..'),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    process.cwd()
  ];

  for (const candidate of candidates) {
    const clientIndex = path.join(candidate, 'client', 'index.html');
    if (fs.existsSync(clientIndex)) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '../..');
}

const STATIC_ROOT = resolveStaticRoot();

const httpServer = createStaticServer(STATIC_ROOT, MIME);
const game = createGameServer();
createWsGameServer(httpServer, game);

httpServer.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use.`);
    console.error(`Try another port, for example: set PORT=8090 && npm start`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`server listening on port ${PORT}`);
  console.log(`local url: http://localhost:${PORT}/client/index.html`);
  console.log(`static root: ${STATIC_ROOT}`);
});
