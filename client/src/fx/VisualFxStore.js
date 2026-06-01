import { rgba } from '../core/Math.js';

function colorForProjectile(p) {
  const frame = p.sourceFrameId || '';
  const slot = p.visualSlot || p.sourceAbilitySlot || '';
  if (frame === 'vanguard' && slot === 'A') return { r: 108, g: 232, b: 255 };
  if (frame === 'sigil' && slot === 'A') return { r: 202, g: 126, b: 255 };
  if (frame === 'bulwark' && slot === 'Z') return { r: 238, g: 190, b: 112 };
  if (p.visualKind === 'rocket') {
    if (p.visualAmmoEffect === 'slow') return { r: 112, g: 190, b: 255 };
    if (p.visualAmmoEffect === 'burn') return { r: 255, g: 142, b: 72 };
    if (p.visualAmmoEffect === 'poison') return { r: 102, g: 225, b: 120 };
    if (p.visualAmmoEffect === 'stun') return { r: 255, g: 224, b: 122 };
    return { r: 255, g: 176, b: 72 };
  }
  if (p.sourceAbilitySlot === 'A') return { r: 98, g: 232, b: 255 };
  if (p.sourceAbilitySlot === 'Z') return { r: 190, g: 150, b: 255 };
  if (p.sourceAbilitySlot === 'E') return { r: 92, g: 255, b: 190 };
  if (p.sourceAbilitySlot === 'R') return { r: 255, g: 205, b: 96 };
  return p.tint ?? { r: 130, g: 225, b: 255 };
}


function impactKindForProjectile(p) {
  const frame = p.sourceFrameId || '';
  const slot = p.visualSlot || p.sourceAbilitySlot || '';
  if (frame === 'vanguard' && slot === 'A') return 'vanguard-pierce';
  if (frame === 'sigil' && slot === 'A') return 'sigil-rune';
  if (frame === 'bulwark' && slot === 'Z') return 'bulwark-harpoon';
  return p.visualKind === 'rocket' ? 'rocket' : 'hit';
}

function isNearSector(item, me) {
  if (!me) return true;
  return (item.sx == null || (item.sx | 0) === (me.sx | 0)) && (item.sy == null || (item.sy | 0) === (me.sy | 0));
}

export class VisualFxStore {
  constructor() {
    this.trails = new Map();
    this.impacts = [];
    this.rings = [];
    this.damageNumbers = [];
    this.castBursts = [];
    this.lastProjectiles = new Map();
    this.lastAreas = new Map();
    this.lastStatuses = new Map();
  }

  sync(store, t) {
    const now = Number.isFinite(t) ? t : performance.now() / 1000;
    const combatFx = store.consumePendingCombatFx?.() ?? [];
    for (const ev of combatFx) {
      if (ev?.type !== 'damage') continue;
      const amount = Math.max(0, Number(ev.amount) || 0);
      if (amount <= 0) continue;
      const c = ev.crit
        ? { r: 255, g: 220, b: 92 }
        : ev.shielded
          ? { r: 90, g: 190, b: 255 }
          : ev.periodic
            ? { r: 125, g: 235, b: 118 }
            : { r: 255, g: 108, b: 92 };
      this.damageNumbers.push({
        x: ev.x + ((ev.targetId || 0) % 7 - 3) * 2.8,
        y: ev.y - 8 - ((ev.targetId || 0) % 5) * 2.0,
        t: now,
        life: ev.crit ? 0.92 : 0.72,
        amount,
        crit: !!ev.crit,
        shielded: !!ev.shielded,
        periodic: !!ev.periodic,
        tag: ev.crit ? 'CRIT' : ev.shielded ? 'SHIELD' : ev.periodic ? 'DOT' : 'HULL',
        color: c
      });
    }
    const nextProjectiles = new Map();

    for (const p of store.projectiles.values()) {
      nextProjectiles.set(p.id, { ...p });
      if (!this.lastProjectiles.has(p.id)) {
        const c = colorForProjectile(p);
        this.castBursts.push({
          x: p.x,
          y: p.y,
          t: now,
          life: p.visualKind === 'rocket' ? 0.36 : 0.26,
          color: c,
          kind: p.visualKind === 'rocket' ? 'rocket-cast' : (p.sourceAbilitySlot ? `ability-${p.sourceAbilitySlot}` : 'shot-cast'),
          radius: p.visualKind === 'rocket' ? 24 : (p.sourceAbilitySlot ? 19 : 12),
          rays: p.visualKind === 'rocket' ? 12 : (p.sourceAbilitySlot ? 8 : 5)
        });
      }
      const trail = this.trails.get(p.id) ?? { points: [], kind: p.visualKind || 'auto', color: colorForProjectile(p), born: now };
      trail.kind = p.visualKind || trail.kind;
      trail.color = colorForProjectile(p);
      trail.points.push({ x: p.x, y: p.y, t: now, r: p.radius || 3 });
      const mobShot = p.sourceKind === 'mob' || String(p.visualKind || '').startsWith('mob_');
      const maxAge = mobShot ? 0.11 : (trail.kind === 'rocket' ? 0.42 : 0.22);
      const maxPoints = mobShot ? 5 : 16;
      trail.points = trail.points.filter((pt) => now - pt.t <= maxAge).slice(-maxPoints);
      this.trails.set(p.id, trail);
    }

    for (const [id, old] of this.lastProjectiles.entries()) {
      if (nextProjectiles.has(id)) continue;
      const color = colorForProjectile(old);
      const isRocket = old.visualKind === 'rocket';
      this.impacts.push({
        x: old.x,
        y: old.y,
        t: now,
        life: isRocket ? 0.48 : 0.22,
        start: isRocket ? Math.max(8, old.radius || 6) : Math.max(3, old.radius || 3),
        end: isRocket ? Math.max(30, old.splashRadius || 34) : Math.max(13, (old.radius || 3) + 10),
        color,
        rays: isRocket ? 12 : (old.crit ? 10 : 6),
        kind: impactKindForProjectile(old),
        frameId: old.sourceFrameId || '',
        slot: old.visualSlot || old.sourceAbilitySlot || ''
      });
      this.trails.delete(id);
    }

    for (const [id, trail] of [...this.trails.entries()]) {
      trail.points = trail.points.filter((pt) => now - pt.t <= 0.55);
      if (!trail.points.length) this.trails.delete(id);
    }

    const nextAreas = new Map();
    for (const a of store.areaEffects.values()) {
      nextAreas.set(a.id, a.durationLeft ?? 0);
      if (!this.lastAreas.has(a.id)) {
        this.rings.push({
          x: a.x,
          y: a.y,
          t: now,
          life: 0.45,
          start: Math.max(8, (a.radius || 20) * 0.18),
          end: a.radius || 40,
          color: a.color ?? { r: 90, g: 220, b: 255 },
          kind: 'area-open'
        });
      }
    }
    this.lastAreas = nextAreas;

    this.syncStatusPops(store.players, 'p', now, store.getMe?.());
    this.syncStatusPops(store.mobs, 'm', now, store.getMe?.());
    this.syncStatusPops(store.asteroids, 'a', now, store.getMe?.());

    this.impacts = this.impacts.filter((fx) => now - fx.t <= fx.life);
    this.rings = this.rings.filter((fx) => now - fx.t <= fx.life);
    this.damageNumbers = this.damageNumbers.filter((fx) => now - fx.t <= fx.life);
    this.castBursts = this.castBursts.filter((fx) => now - fx.t <= fx.life);
    this.lastProjectiles = nextProjectiles;
  }

  syncStatusPops(map, prefix, now, me) {
    for (const ent of map.values()) {
      if (!isNearSector(ent, me)) continue;
      const statuses = ent.statuses ?? [];
      const keyBase = `${prefix}:${ent.id}`;
      const old = this.lastStatuses.get(keyBase) ?? new Set();
      const next = new Set(statuses.map((s) => s.id));
      for (const s of statuses) {
        if (old.has(s.id)) continue;
        this.rings.push({
          x: ent.x,
          y: ent.y,
          t: now,
          life: 0.42,
          start: Math.max(8, ent.radius || 14),
          end: Math.max(22, (ent.radius || 14) + 18),
          color: s.primaryColor ?? { r: 220, g: 220, b: 220 },
          kind: 'status'
        });
      }
      this.lastStatuses.set(keyBase, next);
    }
  }

  drawTrails(ctx, view, camX, camY, t) {
    const dpr = view.dpr;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const trail of this.trails.values()) {
      const pts = trail.points;
      if (pts.length < 2) continue;
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        const age = Math.max(0, t - b.t);
        const alpha = Math.max(0, 1 - age / (trail.kind === 'rocket' ? 0.45 : 0.24)) * (i / pts.length);
        const mobTrail = String(trail.kind || '').startsWith('mob_');
        const width = (mobTrail ? 1.25 : (trail.kind === 'rocket' ? 6.2 : 3.2)) * alpha + 0.45;
        const x0 = (a.x - camX + view.cssW * 0.5) * dpr;
        const y0 = (a.y - camY + view.cssH * 0.5) * dpr;
        const x1 = (b.x - camX + view.cssW * 0.5) * dpr;
        const y1 = (b.y - camY + view.cssH * 0.5) * dpr;
        const c = trail.color;
        ctx.strokeStyle = rgba(c.r, c.g, c.b, mobTrail ? (0.05 + alpha * 0.16) : (0.08 + alpha * 0.28));
        ctx.lineWidth = width * (mobTrail ? 1.75 : 2.8) * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = rgba(255, 245, 210, mobTrail ? (0.04 + alpha * 0.15) : (0.10 + alpha * 0.34));
        ctx.lineWidth = Math.max(0.8, width * 0.52) * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawImpacts(ctx, view, camX, camY, t) {
    const dpr = view.dpr;
    ctx.save();
    ctx.lineCap = 'round';
    for (const fx of this.castBursts) this.drawCastBurst(ctx, view, camX, camY, t, fx);
    for (const fx of this.rings) this.drawRing(ctx, view, camX, camY, t, fx);
    for (const fx of this.impacts) {
      this.drawRing(ctx, view, camX, camY, t, fx);
      const age = Math.max(0, t - fx.t);
      const k = Math.min(1, age / fx.life);
      const fade = Math.max(0, 1 - k);
      const c = fx.color;
      const sx = (fx.x - camX + view.cssW * 0.5) * dpr;
      const sy = (fx.y - camY + view.cssH * 0.5) * dpr;
      if (fx.kind === 'sigil-rune') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 4.2 + fx.x * 0.01);
        ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.64);
        ctx.lineWidth = Math.max(1, 1.6 * fade) * dpr;
        ctx.beginPath();
        const hexR = Math.max(4, fx.end * (0.35 + 0.35 * k)) * dpr;
        for (let j = 0; j < 6; j += 1) {
          const aa = -Math.PI / 2 + j * Math.PI / 3;
          const px = Math.cos(aa) * hexR;
          const py = Math.sin(aa) * hexR;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      if (fx.kind === 'bulwark-harpoon') {
        ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.58);
        ctx.lineWidth = Math.max(1, 2.4 * fade) * dpr;
        ctx.beginPath();
        ctx.moveTo(sx - fx.end * 0.45 * dpr, sy);
        ctx.lineTo(sx + fx.end * 0.45 * dpr, sy);
        ctx.moveTo(sx, sy - fx.end * 0.45 * dpr);
        ctx.lineTo(sx, sy + fx.end * 0.45 * dpr);
        ctx.stroke();
      }
      const rays = fx.kind === 'vanguard-pierce' ? 4 : (fx.rays || 6);
      const base = fx.end * (0.35 + 0.55 * k);
      for (let i = 0; i < rays; i += 1) {
        const a = (Math.PI * 2 * i) / rays + (fx.x * 0.017 + fx.y * 0.011);
        const r0 = (fx.start + base * 0.18) * dpr;
        const r1 = (fx.start + base) * dpr;
        ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.42);
        ctx.lineWidth = (fx.kind === 'rocket' ? 2.2 : 1.4) * fade * dpr;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
        ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }



  drawCastBurst(ctx, view, camX, camY, t, fx) {
    const dpr = view.dpr;
    const age = Math.max(0, t - fx.t);
    const k = Math.min(1, age / fx.life);
    const fade = Math.max(0, 1 - k);
    const c = fx.color;
    const sx = (fx.x - camX + view.cssW * 0.5) * dpr;
    const sy = (fx.y - camY + view.cssH * 0.5) * dpr;
    const r = (fx.radius * (0.25 + k * 0.95)) * dpr;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.55);
    ctx.lineWidth = Math.max(1, 2.2 * fade) * dpr;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    const rays = fx.rays || 6;
    for (let i = 0; i < rays; i += 1) {
      const a = (Math.PI * 2 * i) / rays + t * 1.8;
      const r0 = r * 0.35;
      const r1 = r * (1.15 + 0.35 * k);
      ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.38);
      ctx.lineWidth = Math.max(0.8, 1.5 * fade) * dpr;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
      ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDamageNumbers(ctx, view, camX, camY, t) {
    const dpr = view.dpr;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const fx of this.damageNumbers) {
      const age = Math.max(0, t - fx.t);
      const k = Math.min(1, age / fx.life);
      const fade = Math.max(0, 1 - k);
      const rise = (fx.crit ? 34 : 25) * (1 - Math.pow(1 - k, 1.8));
      const wobble = Math.sin((fx.t * 31.7 + age * 10.5)) * 4 * (1 - k);
      const sx = (fx.x - camX + view.cssW * 0.5 + wobble) * dpr;
      const sy = (fx.y - camY + view.cssH * 0.5 - rise) * dpr;
      const c = fx.color;
      const txt = fx.amount >= 10 ? `${Math.round(fx.amount)}` : fx.amount.toFixed(1);
      const fontSize = (fx.crit ? 15 : 12.5) * (1 + 0.18 * (1 - k)) * dpr;
      ctx.font = `${fx.crit ? '800' : '700'} ${fontSize}px Segoe UI`;
      ctx.lineWidth = Math.max(2.4, 3.4 * dpr);
      ctx.strokeStyle = rgba(3, 5, 9, fade * 0.92);
      ctx.strokeText(txt, sx, sy);
      ctx.fillStyle = rgba(c.r, c.g, c.b, fade * 0.96);
      ctx.fillText(txt, sx, sy);
      if (fx.tag) {
        ctx.font = `${(fx.crit ? 8.8 : 7.2) * dpr}px Segoe UI`;
        ctx.fillStyle = rgba(c.r, c.g, c.b, fade * 0.72);
        ctx.fillText(fx.tag, sx, sy + (fx.crit ? 13 : 11) * dpr);
      }
    }
    ctx.restore();
  }

  drawRing(ctx, view, camX, camY, t, fx) {
    const dpr = view.dpr;
    const age = Math.max(0, t - fx.t);
    const k = Math.min(1, age / fx.life);
    const eased = 1 - Math.pow(1 - k, 2.4);
    const fade = Math.max(0, 1 - k);
    const r = fx.start + (fx.end - fx.start) * eased;
    const c = fx.color;
    const sx = (fx.x - camX + view.cssW * 0.5) * dpr;
    const sy = (fx.y - camY + view.cssH * 0.5) * dpr;
    ctx.strokeStyle = rgba(c.r, c.g, c.b, fade * 0.58);
    ctx.lineWidth = Math.max(1, (fx.kind === 'rocket' ? 2.8 : 1.8) * fade) * dpr;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1, r * dpr), 0, Math.PI * 2);
    ctx.stroke();
    if (fx.kind === 'rocket' || fx.kind === 'area-open' || fx.kind === 'sigil-rune' || fx.kind === 'bulwark-harpoon') {
      ctx.fillStyle = rgba(c.r, c.g, c.b, fade * 0.08);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, r * dpr), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
