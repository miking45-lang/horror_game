// ============================================================
//  Сущности: выпавшие предметы, падающие блоки, частицы, Наблюдатель
// ============================================================
const Ents = {
  items: [], falling: [], parts: [],
  fig: { active: false, x: 0, y: 0, z: 0, yaw: 0, seen: 0, life: 0 }, figTimer: 150,
  clear() { if (this.revertGlitch) { this.revertGlitch(); this.glitchS = null; this.glitchK = 0; } this.items = []; this.falling = []; this.parts = []; this.fig.active = false; this.figTimer = 150; if (this.mutant) { this.mutant.active = false; this.mutant.gp = 0; this.mutantK = 0; this.mutantTimer = 40; this.peekS = null; this.dreadS = null; this.huntS = null; this.runS = null; this.hellS = null; this.blackOn = false; if (typeof BlackFx !== 'undefined') BlackFx.set(false); this.nightEnc = false; this.huntK = 0; this.huntLock = false; this.pictureOn = false; if (typeof Portrait !== 'undefined') Portrait.hide(); this.dreadK = 0; this.dreadTarget = 0; this.gazeT = 0; this.encounters = 0; } },
  dropItem(x, y, z, st, scatter = false, thrown = null) {
    const a = Math.random() * PI2, s = scatter ? 3 : 1.2;
    const e = { x, y, z, vx: Math.cos(a) * s * Math.random(), vy: 3 + Math.random() * 2, vz: Math.sin(a) * s * Math.random(), st: { id: st.id, count: st.count, dmg: st.dmg || 0 }, age: 0, delay: 0.5 };
    if (thrown) { e.vx = thrown[0] * 6; e.vy = thrown[1] * 6 + 2; e.vz = thrown[2] * 6; e.delay = 1.6; }
    this.items.push(e);
  },
  startFalling(x, y, z, id) {
    World.set(x, y, z, 0);
    this.falling.push({ x: x + 0.5, y, z: z + 0.5, vy: 0, id });
  },
  breakParticles(x, y, z, id) {
    const d = BLK[id], tile = d.tiles[4];
    for (let i = 0; i < 20; i++) {
      this.parts.push({
        x: x + 0.15 + Math.random() * 0.7, y: y + 0.15 + Math.random() * 0.7, z: z + 0.15 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4 + 1, vz: (Math.random() - 0.5) * 4,
        life: 0.4 + Math.random() * 0.6, tile, u: Math.floor(Math.random() * 12), v: Math.floor(Math.random() * 12), s: 0.07 + Math.random() * 0.06
      });
    }
  },
  digParticle(hit) {
    const tile = BLK[hit.id].tiles[4];
    for (let i = 0; i < 2; i++) this.parts.push({
      x: hit.x + 0.5 + hit.n[0] * 0.55 + (Math.random() - 0.5) * 0.8 * (1 - Math.abs(hit.n[0])),
      y: hit.y + 0.5 + hit.n[1] * 0.55 + (Math.random() - 0.5) * 0.8 * (1 - Math.abs(hit.n[1])),
      z: hit.z + 0.5 + hit.n[2] * 0.55 + (Math.random() - 0.5) * 0.8 * (1 - Math.abs(hit.n[2])),
      vx: hit.n[0] + (Math.random() - 0.5), vy: 1 + Math.random(), vz: hit.n[2] + (Math.random() - 0.5),
      life: 0.3 + Math.random() * 0.3, tile, u: Math.floor(Math.random() * 12), v: Math.floor(Math.random() * 12), s: 0.06
    });
  },
  update(dt) {
    const p = Player;
    // предметы
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += dt; e.delay -= dt;
      const inW = isWater(World.get(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z)));
      e.vy -= (inW ? 3 : 18) * dt; if (inW) e.vy = Math.max(e.vy, -1.5);
      const r = 0.125, mn = [e.x - r, e.y, e.z - r], mx = [e.x + r, e.y + 0.25, e.z + r];
      const dy = e.vy * dt, ay = sweepAxis(mn, mx, 1, dy); e.y += ay;
      if (ay !== dy) { e.vy = 0; e.vx *= 0.5; e.vz *= 0.5; e.ground = true; } else e.ground = false;
      const m2 = [e.x - r, e.y, e.z - r], x2 = [e.x + r, e.y + 0.25, e.z + r];
      const ax = sweepAxis(m2, x2, 0, e.vx * dt); e.x += ax; if (ax !== e.vx * dt) e.vx = 0;
      const m3 = [e.x - r, e.y, e.z - r], x3 = [e.x + r, e.y + 0.25, e.z + r];
      const az = sweepAxis(m3, x3, 2, e.vz * dt); e.z += az; if (az !== e.vz * dt) e.vz = 0;
      const fr = Math.exp(-(e.ground ? 6 : 0.5) * dt); e.vx *= fr; e.vz *= fr;
      if (e.age > 300 || e.y < -20) { this.items.splice(i, 1); continue; }
      if (e.delay <= 0 && !p.dead) {
        const dx = p.x - e.x, dy2 = (p.y + 0.8) - e.y, dz = p.z - e.z, dist = Math.hypot(dx, dy2, dz);
        if (dist < 1.8) {
          if (dist < 0.7) {
            const left = giveItem(e.st.id, e.st.count, e.st.dmg);
            if (left < e.st.count) Sfx.pop();
            if (left <= 0) { this.items.splice(i, 1); continue; } else e.st.count = left;
          } else { e.x += dx / dist * 6 * dt; e.y += dy2 / dist * 6 * dt; e.z += dz / dist * 6 * dt; }
        }
      }
    }
    // падающие блоки
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.vy = Math.max(f.vy - 28 * dt, -40);
      const ny = f.y + f.vy * dt;
      const bx = Math.floor(f.x), bz = Math.floor(f.z), by = Math.floor(ny);
      const below = World.getPhys(bx, by, bz);
      if (SOLID[below] || ny < 0) {
        const ly = by + 1, cur = World.get(bx, ly, bz);
        if (!cur || BLK[cur].replaceable) { World.set(bx, ly, bz, f.id); Sfx.place(BLK[f.id].sound); }
        else if (Game.mode === 'survival') this.dropItem(bx + 0.5, ly + 0.5, bz + 0.5, { id: f.id, count: 1 });
        this.falling.splice(i, 1); continue;
      }
      f.y = ny;
      if (f.y < -10) this.falling.splice(i, 1);
    }
    // частицы
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt; if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.vy -= 14 * dt;
      const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt, nz = q.z + q.vz * dt;
      if (SOLID[World.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { q.vx *= 0.3; q.vz *= 0.3; q.vy = 0; }
      else { q.x = nx; q.y = ny; q.z = nz; }
    }
    // наблюдатель (гость в чужом мире): свои события не запускаются, повторяются события хозяина
    if (typeof Net !== 'undefined' && Net.observer()) { this.fig.active = false; this.ghost.active = false; this.updateDeep(dt); Net.fxStep(dt); return; }
    if (this.killS) { this.updateKill(dt); return; }   // «расправа» (NumPad 0) — всё остальное ждёт
    if (this.scrS) this.updateScreamer(dt);
    this.updateFigure(dt);
    // владелец в облике существа: события существа у хозяина остановлены, помехи — от близости владельца
    const cp = typeof Net !== 'undefined' && Net.role === 'host' ? Net.creaturePeer() : null;
    if (cp && this.morphStep) { this.morphStep(dt, cp); return; }
    if (this.morphOn) this.morphEnd();
    if (this.updateMutant) this.updateMutant(dt);
    if (this.updateGhost) this.updateGhost(dt);
  },
  // ---------------- Наблюдатель ----------------
  lineClear(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz);
    const n = Math.ceil(L * 2);
    for (let i = 1; i < n; i++) {
      const t = i / n, b = World.get(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t), Math.floor(z0 + dz * t));
      if (OPQ[b] || LOSB[b] || isLeafId(b)) return false;
    }
    return true;
  },
  trySpawnFigure() {
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z;
    const L = World.light(Math.floor(ex), Math.floor(ey), Math.floor(ez)) >> 4;
    const underground = L < 7;
    for (let k = 0; k < 40; k++) {
      // появляется вне поля зрения — сбоку или сзади
      const ang = p.yaw + Math.PI + (Math.random() - 0.5) * Math.PI * 1.3;
      let dist;
      if (underground) dist = 12 + Math.random() * 10;
      else if (Game.env.night > 0.5) dist = 18 + Math.random() * 12;
      else dist = clamp(Game.env.fogEnd * (0.62 + Math.random() * 0.12), 22, 70);
      const x = Math.floor(ex - Math.sin(ang) * dist), z = Math.floor(ez - Math.cos(ang) * dist);
      if (!World.loaded(x, z)) continue;
      let y;
      if (underground) {
        y = -1;
        for (let dy = -5; dy <= 5; dy++) {
          const yy = Math.floor(p.y) + dy;
          const bl = World.light(x, yy, z) & 15;
          if (OPQ[World.get(x, yy - 1, z)] && !World.get(x, yy, z) && !World.get(x, yy + 1, z) && bl >= 2 && bl <= 8) { y = yy; break; }
        }
        if (y < 0) continue;
      } else {
        y = World.topY(x, z) + 1;
        const g = World.get(x, y - 1, z);
        if (!OPQ[g] || isWater(World.get(x, y, z)) || World.get(x, y + 1, z)) continue;
        if ((World.light(x, y, z) >> 4) < 10) continue;
      }
      if (!this.lineClear(ex, ey, ez, x + 0.5, y + 1.6, z + 0.5)) continue;
      const f = this.fig;
      if (underground && Math.hypot(x + 0.5 - ex, z + 0.5 - ez) < 12.5) continue;
      Object.assign(f, { active: true, x: x + 0.5, y, z: z + 0.5, seen: 0, life: 0, lookT: 0 });
      return true;
    }
    return false;
  },
  updateFigure(dt) {
    const f = this.fig, p = Player;
    if (!Game.settings.figure || p.dead) { f.active = false; return; }
    if (!f.active) {
      if (this.mutant && this.mutant.active) return;
      this.figTimer -= dt * (this.deepOn ? 2.5 : 1);
      if (this.figTimer <= 0) {
        const night = Game.env.night > 0.5, L = World.light(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z)) >> 4;
        const chance = night || L < 7 ? 0.8 : 0.35;
        if (Math.random() < chance) this.trySpawnFigure();
        this.figTimer = (night || L < 7) ? 70 + Math.random() * 130 : 160 + Math.random() * 260;
      }
      return;
    }
    f.life += dt;
    const ex = p.x, ey = p.y + EYE, ez = p.z;
    const dx = f.x - ex, dy = (f.y + 1.6) - ey, dz = f.z - ez, dist = Math.hypot(dx, dy, dz);
    f.yaw = Math.atan2(-dx, -dz);
    const L = lookDir();
    const cosA = (L[0] * dx + L[1] * dy + L[2] * dz) / dist;
    const inView = cosA > Math.cos(22 * Math.PI / 180);
    if (inView && this.lineClear(ex, ey, ez, f.x, f.y + 1.6, f.z)) { f.seen += dt; if (cosA > Math.cos(9 * Math.PI / 180)) f.seen += dt; }
    if (dist < 12 || f.seen > 1.1) {
      f.active = false;
      if (f.seen > 0.3 || dist < 12) {
        Sfx.vanish();
        if (Math.random() < 0.35) setTimeout(() => Sfx.stepsBehind(), 4000 + Math.random() * 5000);
      }
    } else if (f.life > 50 && f.seen === 0) f.active = false;
  },
  // ---------------- отрисовка ----------------
  build(batch, cam) {
    batch.reset();
    const cx = cam.x, cy = cam.y, cz = cam.z;
    const rightX = Math.cos(cam.yaw), rightZ = -Math.sin(cam.yaw);
    for (const e of this.items) {
      const l = World.light(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z));
      const sky = (l >> 4) / 15, blk = (l & 15) / 15;
      const bob = Math.sin(e.age * 2.5) * 0.06 + 0.12;
      const it = ITEMS[e.st.id];
      const n = e.st.count > 20 ? 3 : e.st.count > 1 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const ox = k * 0.07, oy = k * 0.05, oz = -k * 0.05;
        if (it && it.block && BLK[it.block].render === R_CUBE) {
          const s = 0.25, rot = e.age * 1.2, c = Math.cos(rot), sn = Math.sin(rot);
          batchBlock(batch, it.block, (x, y, z) => {
            const lx = (x - 0.5) * s, lz = (z - 0.5) * s;
            return [e.x + ox + lx * c - lz * sn - cx, e.y + bob + oy + y * s - cy, e.z + oz + lx * sn + lz * c - cz];
          }, sky, blk);
        } else {
          const tile = it && it.sprite !== undefined ? it.sprite : BLK[it.block].tiles[0];
          const s = 0.4, x0 = e.x + ox - rightX * s / 2 - cx, z0 = e.z + oz - rightZ * s / 2 - cz, y0 = e.y + bob + oy - cy;
          const pts = [[x0, y0, z0], [x0 + rightX * s, y0, z0 + rightZ * s], [x0 + rightX * s, y0 + s, z0 + rightZ * s], [x0, y0 + s, z0]];
          batch.quad(pts, tileRect(tile), sky, blk, 1);
        }
      }
    }
    for (const f of this.falling) {
      const l = World.light(Math.floor(f.x), Math.floor(f.y + 0.5), Math.floor(f.z));
      batchBlock(batch, f.id, (x, y, z) => [f.x - 0.5 + x - cx, f.y + y - cy, f.z - 0.5 + z - cz], (l >> 4) / 15, (l & 15) / 15);
    }
    const upx = 0, upy = 1, upz = 0;
    for (const q of this.parts) {
      const l = World.light(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z));
      const s = q.s, x0 = q.x - rightX * s / 2 - cx, z0 = q.z - rightZ * s / 2 - cz, y0 = q.y - cy;
      const pts = [[x0, y0, z0], [x0 + rightX * s, y0, z0 + rightZ * s], [x0 + rightX * s, y0 + s, z0 + rightZ * s], [x0, y0 + s, z0]];
      const tx = (q.tile % ATLAS_COLS) * TS + q.u, ty = Math.floor(q.tile / ATLAS_COLS) * TS + q.v;
      batch.quad(pts, [tx, ty, tx + 3.5, ty + 3.5], (l >> 4) / 15, (l & 15) / 15, 1);
    }
    if (typeof Net !== 'undefined') Net.buildAvatars(batch, cam);
    return batch;
  },
  buildFigure(batch, cam) {
    batch.reset();
    const f = this.fig; if (!f.active) return null;
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    const tf = (x, y, z) => [f.x + x * c + z * s - cam.x, f.y + y - cam.y, f.z - x * s + z * c - cam.z];
    const box = (x0, y0, z0, x1, y1, z1, rotX = 0, py = 0) => {
      const cr = Math.cos(rotX), sr = Math.sin(rotX);
      batchBox(batch, x0, y0, z0, x1, y1, z1, TILE.shadow, (x, y, z) => {
        const yy = y - py, y2 = yy * cr - z * sr + py, z2 = yy * sr + z * cr;
        return tf(x, y2, z2);
      }, 0, 0, 1);
    };
    box(-0.25, 0, -0.11, -0.03, 0.78, 0.11);
    box(0.03, 0, -0.11, 0.25, 0.78, 0.11);
    box(-0.26, 0.78, -0.13, 0.26, 1.5, 0.13);
    box(-0.44, 0.55, -0.1, -0.27, 1.49, 0.1);
    box(0.27, 0.58, -0.1, 0.44, 1.49, 0.1);
    box(-0.21, 1.5, -0.2, 0.21, 1.93, 0.22, 0.22, 1.5);
    return batch;
  }
};
