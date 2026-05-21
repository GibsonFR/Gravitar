import { WebSocket } from 'ws';

const URL = process.env.URL || 'ws://localhost:8080';
const COUNT = Number(process.env.COUNT || '120');

function rnd(a, b) { return a + Math.random() * (b - a); }
function distSq(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }

class Bot {
  constructor(index) {
    this.index = index;
    this.ws = new WebSocket(URL);
    this.id = 0;
    this.vw = 1280;
    this.vh = 720;
    this.msx = rnd(0, this.vw);
    this.msy = rnd(0, this.vh);
    this.me = null;
    this.players = [];
    this.asteroids = [];
    this.stations = [];
    this.nextClickAt = Date.now() + rnd(300, 1400);
    this.nextRocketAt = Date.now() + rnd(2200, 5200);
    this.nextDockAt = Date.now() + rnd(9000, 16000);

    this.ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      if (msg.t === 'hello') this.id = msg.id;
      if (msg.t === 'snap') {
        this.me = (msg.players || []).find((p) => p.id === this.id) || null;
        this.players = msg.players || [];
        this.asteroids = msg.asteroids || [];
        this.stations = msg.stations || [];
      }
    });

    this.ws.on('open', () => {
      setInterval(() => this.step(), 50);
    });
  }

  worldToScreen(wx, wy) {
    if (!this.me) return { x: this.vw * 0.5, y: this.vh * 0.5 };
    return {
      x: this.vw * 0.5 + (wx - this.me.x),
      y: this.vh * 0.5 + (wy - this.me.y)
    };
  }

  chooseClickTarget() {
    if (!this.me) return null;

    let bestEnemy = null;
    let bestEnemyD2 = Infinity;
    for (const p of this.players) {
      if (p.id === this.id) continue;
      const d2 = distSq(this.me.x, this.me.y, p.x, p.y);
      if (d2 < bestEnemyD2) { bestEnemyD2 = d2; bestEnemy = p; }
    }
    if (bestEnemy && bestEnemyD2 < 1200 * 1200 && Math.random() < 0.72) return { x: bestEnemy.x, y: bestEnemy.y };

    let bestAst = null;
    let bestAstD2 = Infinity;
    for (const a of this.asteroids) {
      const d2 = distSq(this.me.x, this.me.y, a.x, a.y);
      if (d2 < bestAstD2) { bestAstD2 = d2; bestAst = a; }
    }
    if (bestAst && Math.random() < 0.84) return { x: bestAst.x, y: bestAst.y };

    const angle = Math.random() * Math.PI * 2;
    const radius = rnd(180, 900);
    return { x: this.me.x + Math.cos(angle) * radius, y: this.me.y + Math.sin(angle) * radius };
  }

  step() {
    if (this.ws.readyState !== this.ws.OPEN) return;
    const now = Date.now();

    let primaryClick = false;
    if (now >= this.nextClickAt) {
      const worldTarget = this.chooseClickTarget();
      if (worldTarget) {
        const s = this.worldToScreen(worldTarget.x, worldTarget.y);
        this.msx = s.x;
        this.msy = s.y;
        primaryClick = true;
      }
      this.nextClickAt = now + rnd(280, 950);
    }

    let rocketTap = false;
    if (now >= this.nextRocketAt && this.me) {
      const enemy = this.players.find((p) => p.id !== this.id);
      if (enemy) {
        const s = this.worldToScreen(enemy.x, enemy.y);
        this.msx = s.x;
        this.msy = s.y;
        rocketTap = Math.random() < 0.45;
      }
      this.nextRocketAt = now + rnd(2400, 5200);
    }

    let interactTap = false;
    if (now >= this.nextDockAt && this.me && this.stations.length > 0) {
      let nearest = this.stations[0];
      let bestD2 = distSq(this.me.x, this.me.y, nearest.x, nearest.y);
      for (const s of this.stations) {
        const d2 = distSq(this.me.x, this.me.y, s.x, s.y);
        if (d2 < bestD2) { bestD2 = d2; nearest = s; }
      }
      const sp = this.worldToScreen(nearest.x, nearest.y);
      this.msx = sp.x;
      this.msy = sp.y;
      primaryClick = true;
      if (bestD2 < 95 * 95) interactTap = true;
      this.nextDockAt = now + rnd(9000, 17000);
    }

    this.ws.send(JSON.stringify({
      t: 'input',
      vw: this.vw,
      vh: this.vh,
      msx: this.msx,
      msy: this.msy,
      primaryClick,
      px: this.msx,
      py: this.msy,
      a: false,
      z: false,
      e: false,
      r: false,
      interactTap,
      rocketTap
    }));
  }
}

export function runBots() {
  for (let i = 0; i < COUNT; i++) new Bot(i);
  console.log(`bots: ${COUNT} -> ${URL}`);
}
