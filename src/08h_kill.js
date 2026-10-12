// ============================================================
//  «Расправа» (NumPad 0, владелец в облике существа): у хозяина мира существо подбегает к игроку,
//  камера уходит на вид от третьего лица, помехи стихают; существо хватает игрока, плавно поднимает
//  над собой и медленно разрывает пополам, кровь растекается по земле. Затем — экран смерти.
// ============================================================
Object.assign(Ents, {
  killS: null, killL: null,
  forceKill(from) {
    const p = Player;
    if (this.killS || this.mawS || p.dead || Game.state !== 'play') return false;
    if (this.stopMutantEvents) this.stopMutantEvents();
    if (UI.gui) UI.closeScreen();
    // откуда бежит: с места владельца-существа (если недалеко), иначе — из тумана перед игроком
    let sx, sz;
    if (from && Number.isFinite(from.x) && Math.hypot(from.x - p.x, from.z - p.z) < 60 && Math.hypot(from.x - p.x, from.z - p.z) > 3) { sx = from.x; sz = from.z; }
    else { const d = lookDir(), n = Math.hypot(d[0], d[2]) || 1; sx = p.x + d[0] / n * 16; sz = p.z + d[2] / n * 16; }
    const L = Net.newPoseL(0);
    L.x = sx; L.z = sz; L.y = World.topY(Math.floor(sx), Math.floor(sz)) + 1; L.hs = (from && from.hs) || 1;
    L.walk = 1; L.wph = 0; L.armA = 0; L.armSpread = 0; L.hp = 0; L.hy = 0; L.hroll = 0;
    this.killL = L;
    this.killS = { t: 0, ph: 0, pt: 0, lift: 0, sep: 0, blood: [], pool: 0, cam: null, screamed: false };
    this.huntLock = true;
    return true;
  },
  killEnd(dead) {
    this.killS = null; this.killL = null; this.huntLock = false; this.mutantK = 0; this.mutantBurst = 0;
    if (dead && !Player.dead) killPlayer();
  },
  updateKill(dt) {
    const S = this.killS, L = this.killL, p = Player, hs = L.hs || 1;
    S.t += dt; S.pt += dt; L.t += dt;
    p.vx = 0; p.vz = 0;
    const gY = (x, z) => World.topY(Math.floor(x), Math.floor(z)) + 1;
    const toP = Math.atan2(p.x - L.x, p.z - L.z);
    if (S.ph === 0) {
      // ---- бежит к игроку; игрок смотрит на него, помехи нарастают ----
      const dx = p.x - L.x, dz = p.z - L.z, d = Math.hypot(dx, dz);
      const step = Math.min(d - 1.4 * hs, 8.5 * dt);
      if (step > 0) { L.x += dx / d * step; L.z += dz / d * step; }
      L.y += (gY(L.x, L.z) - L.y) * Math.min(1, dt * 10);
      L.yaw = L.by = toP; L.walk = 1; L.wph += dt * 9;
      let dy = Math.atan2(-(L.x - p.x), -(L.z - p.z)) - p.yaw; dy = ((dy + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
      p.yaw += dy * Math.min(1, dt * 4); p.pitch += (0.15 - p.pitch) * Math.min(1, dt * 3);
      this.mutantK = Math.min(0.95, Math.pow(clamp((30 - d) / 27, 0, 1), 1.3));
      if (Math.random() < dt * 6 * this.mutantK) Game.flickerPulse = 0.12;
      if (d <= 1.45 * hs + 0.05 || S.pt > 6) { S.ph = 1; S.pt = 0; this.mutantK = 0; this.mutantBurst = 0; Game.flickerPulse = 0; L.walk = 0; }
      return;
    }
    // дальше — вид со стороны, без помех
    this.mutantK = 0; this.mutantBurst = 0; Game.flickerPulse = 0;
    L.yaw = L.by = toP; L.walk = Math.max(0, L.walk - dt * 4);
    const ease = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    if (S.ph === 1) {            // хватает и плавно поднимает над собой (3 с)
      const u = ease(S.pt / 3);
      L.armA = u * 2.8; L.hp = -0.75 * u; S.lift = u;
      if (S.pt >= 3) { S.ph = 2; S.pt = 0; }
    } else if (S.ph === 2) {     // медленно разрывает (5 с)
      const u = ease(S.pt / 5);
      L.armA = 2.8; L.hp = -0.75; L.armSpread = 0.6 * u; S.sep = u;
      L.hroll = Math.sin(S.t * 23) * 0.04 * (1 - u);
      if (!S.screamed && S.pt > 0.4) { S.screamed = true; try { Sfx.scream(); } catch (e) { } }
      if (S.pt >= 5) { S.ph = 3; S.pt = 0; }
    } else {                     // держит, кровь стекает (2,5 с), затем смерть
      L.armSpread = 0.6; L.hroll = 0;
      if (S.pt >= 2.5) { this.killEnd(true); return; }
    }
    // ---- кровь: брызги из разрыва, капли падают и растекаются лужей ----
    const V = this.victimFrame();
    if (S.ph >= 2 && S.sep > 0.03) {
      const rate = S.ph === 2 ? 70 : 25, n = Math.floor(rate * dt + Math.random());
      for (let i = 0; i < n && S.blood.length < 500; i++) {
        const side = Math.random() < 0.5 ? -1 : 1, o = side > 0 ? V.upEnd : V.lowEnd;
        S.blood.push({ x: o[0] + (Math.random() - 0.5) * 0.2, y: o[1] - 0.1, z: o[2] + (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * 1.6 + V.R[0] * side * 0.8, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.6 + V.R[2] * side * 0.8, s: 0.025 + Math.random() * 0.035, land: false });
      }
    }
    const g0 = gY(L.x, L.z);
    for (const b of S.blood) {
      if (b.land) continue;
      b.vy -= 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const gy = gY(b.x, b.z);
      if (b.y <= gy + 0.02) { b.y = gy + 0.02; b.land = true; S.pool = Math.min(2.0 * hs, S.pool + 0.002); }
    }
    S.blood = S.blood.filter(b => !b.land || Math.random() > dt * 0.5);
    S.pool = Math.min(2.0 * hs, S.pool + (S.ph >= 2 ? dt * 0.22 : 0));   // лужа растекается постепенно
    S.groundY = g0;
    // ---- камера: со стороны и чуть спереди, смотрит на существо с жертвой ----
    const tgt = [L.x, L.y + 3.4 * hs, L.z], D = 6.5 * hs;
    const free = (dir) => {
      const n = Math.hypot(dir[0], dir[1], dir[2]); let t = 0.5;
      for (; t < D; t += 0.1) if (SOLID[World.get(Math.floor(tgt[0] + dir[0] / n * t), Math.floor(tgt[1] + dir[1] / n * t), Math.floor(tgt[2] + dir[2] / n * t))]) break;
      return Math.min(D, t);
    };
    // направление камеры выбираем один раз — то, где обзор свободнее (сбоку-спереди от существа)
    if (!S.camDir) {
      let best = null, bt = -1;
      for (const k of [0.9, -0.9, 1.4, -1.4, 0.5, -0.5, 2.0, -2.0, 0, 2.6, -2.6]) {
        const a = toP + k, dir = [Math.sin(a), 0.22, Math.cos(a)], t = free(dir);
        if (t > bt + 0.5) { bt = t; best = dir; }
        if (t >= D) break;
      }
      S.camDir = best;
    }
    const dir = S.camDir, dn = Math.hypot(dir[0], dir[1], dir[2]), t = Math.max(1.5, free(dir) - 0.3);
    const c = [tgt[0] + dir[0] / dn * t, tgt[1] + dir[1] / dn * t, tgt[2] + dir[2] / dn * t];
    const aim = [L.x, L.y + 3.9 * hs, L.z];
    const lx = aim[0] - c[0], ly = aim[1] - c[1], lz = aim[2] - c[2], ll = Math.hypot(lx, ly, lz);
    S.cam = { x: c[0], y: c[1], z: c[2], yaw: Math.atan2(-lx, -lz), pitch: Math.asin(ly / ll), roll: 0 };
  },
  // где сейчас жертва: центр над головой существа, ось тела — вдоль рук (вправо от существа)
  victimFrame() {
    const S = this.killS, L = this.killL, p = Player, hs = L.hs || 1;
    const a = L.yaw, F = [Math.sin(a), 0, Math.cos(a)], R = [Math.cos(a), 0, -Math.sin(a)];
    const sp = L.armSpread || 0;
    const top = [L.x + F[0] * 0.55 * hs, L.y + (2.75 + 2.25 * Math.cos(sp)) * hs - 0.15, L.z + F[2] * 0.55 * hs];
    const lift = S.lift, C = [p.x + (top[0] - p.x) * lift, (p.y + 1.0) + (top[1] - (p.y + 1.0)) * lift, p.z + (top[2] - p.z) * lift];
    const hoff = Math.max(0, (0.235 + 2.3 * Math.sin(sp)) * hs - 0.55) * S.sep;
    return { C, F, R, U: [0, 1, 0], lift, hoff,
      upEnd: [C[0] + R[0] * (hoff - 0.62), C[1], C[2] + R[2] * (hoff - 0.62)],
      lowEnd: [C[0] - R[0] * (hoff + 0.38), C[1], C[2] - R[2] * (hoff + 0.38)] };
  },
  // жертва (игрок): лежит поперёк рук, верхняя половина (туловище, руки, голова) и ноги расходятся
  drawKill(batch, cam) {
    const S = this.killS; if (!S || S.ph === 0) return;
    const V = this.victimFrame(), { C, F, R, U, lift } = V;
    const l = World.light(Math.floor(C[0]), Math.floor(C[1]), Math.floor(C[2])), sky = (l >> 4) / 15, blk = (l & 15) / 15;
    // пока поднимает — из стоячего положения плавно в лежачее
    const lay = lift, ca = Math.cos(lay * Math.PI / 2), sa = Math.sin(lay * Math.PI / 2);
    const jit = S.ph === 2 ? 0.02 : 0;
    const crossX = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    // стоя: ось тела — вверх (U), лицо — к существу (−F); лёжа: ось тела — вдоль рук (R), лицо — вверх
    const bx = [U[0] * ca + R[0] * sa, U[1] * ca + R[1] * sa, U[2] * ca + R[2] * sa];
    const fz = [-F[0] * ca + U[0] * sa, -F[1] * ca + U[1] * sa, -F[2] * ca + U[2] * sa];
    const sx = crossX(bx, fz);
    const map = (x, y, z, ymid, off) => {
      const yy = y - ymid + off, j = () => (Math.random() - 0.5) * jit;
      return [C[0] + bx[0] * yy + fz[0] * z + sx[0] * x + j() - cam.x,
        C[1] + bx[1] * yy + fz[1] * z + sx[1] * x + j() - cam.y,
        C[2] + bx[2] * yy + fz[2] * z + sx[2] * x + j() - cam.z];
    };
    const S6 = t => [t, t, t, t, t, t], skin = TILE.av_skin, shirt = TILE.av_shirt, pants = TILE.av_pants, BL = TILE.blood;
    const up = (x, y, z) => map(x, y, z, 1.0, V.hoff), lo = (x, y, z) => map(x, y, z, 1.0, -V.hoff);
    // ноги
    avBox(batch, -0.25, 0, -0.125, 0, 0.75, 0.125, S6(pants), lo, sky, blk);
    avBox(batch, 0, 0, -0.125, 0.25, 0.75, 0.125, S6(pants), lo, sky, blk);
    // верх: туловище, руки, голова
    avBox(batch, -0.25, 0.75, -0.125, 0.25, 1.5, 0.125, S6(shirt), up, sky, blk);
    avBox(batch, -0.5, 0.75, -0.125, -0.25, 1.5, 0.125, [shirt, shirt, shirt, skin, shirt, shirt], up, sky, blk);
    avBox(batch, 0.25, 0.75, -0.125, 0.5, 1.5, 0.125, [shirt, shirt, shirt, skin, shirt, shirt], up, sky, blk);
    avBox(batch, -0.25, 1.5, -0.25, 0.25, 2.0, 0.25, [TILE.av_side, TILE.av_side, TILE.av_hair, skin, TILE.av_hair, TILE.av_face], up, sky, blk);
    // рваные края
    if (V.hoff > 0.01) {
      avBox(batch, -0.24, 0.7, -0.12, 0.24, 0.78, 0.12, S6(BL), up, sky, blk);
      avBox(batch, -0.24, 0.72, -0.12, 0.24, 0.8, 0.12, S6(BL), lo, sky, blk);
    }
    // брызги и капли
    for (const b of S.blood) {
      if (b.land) continue;
      const s = b.s, T = (x, y, z) => [b.x + x - cam.x, b.y + y - cam.y, b.z + z - cam.z];
      avBox(batch, -s, -s, -s, s, s, s, S6(BL), T, sky, blk);
    }
    // лужа: клетки 0,25 блока в круге, неровный край
    if (S.pool > 0.05) {
      const L = this.killL, cx = L.x, cz = L.z, r = S.pool, st = 0.25, R2 = r * r, r0 = TILE.blood;
      for (let gx = -r; gx <= r; gx += st) for (let gz = -r; gz <= r; gz += st) {
        const x = cx + gx, z = cz + gz, h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, n = (h - Math.floor(h)) * 0.6;
        if (gx * gx + gz * gz > R2 * (0.7 + n)) continue;
        const gy = World.topY(Math.floor(x), Math.floor(z)) + 1.015;
        if (Math.abs(gy - S.groundY) > 1.2) continue;
        const ll = World.light(Math.floor(x), Math.floor(gy), Math.floor(z));
        batch.quad([[x - cam.x, gy - cam.y, z + st - cam.z], [x + st - cam.x, gy - cam.y, z + st - cam.z], [x + st - cam.x, gy - cam.y, z - cam.z], [x - cam.x, gy - cam.y, z - cam.z]], tileRect(r0), (ll >> 4) / 15, (ll & 15) / 15, 1);
      }
    }
  }
});
