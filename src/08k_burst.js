// ============================================================
//  «Разрыв» (колёсико мыши, пока владелец-существо держит игрока телекинезом).
//  У игрока: вид со стороны — тело разлетается на части (ноги, руки, туловище, голова),
//  в центре кровавый взрыв со звуком; части падают и оставляют кровь. Затем экран смерти.
// ============================================================
Object.assign(Ents, {
  burstS: null,
  forceBurst() {
    const p = Player;
    if (this.burstS || this.killS || this.mawS || this.slashS || p.dead || Game.state !== 'play') return false;
    if (this.stopMutantEvents) this.stopMutantEvents();
    if (UI.gui) UI.closeScreen();
    const C = [p.x, p.y + 1.0, p.z], R = () => (Math.random() - 0.5);
    // части тела: размеры (полуоси) и где их центр относительно центра тела
    const defs = [
      { k: 'legL', h: [0.125, 0.375, 0.125], o: [-0.125, -0.625, 0], t: 'pants' },
      { k: 'legR', h: [0.125, 0.375, 0.125], o: [0.125, -0.625, 0], t: 'pants' },
      { k: 'body', h: [0.25, 0.375, 0.125], o: [0, 0.125, 0], t: 'shirt' },
      { k: 'armL', h: [0.125, 0.375, 0.125], o: [-0.375, 0.125, 0], t: 'arm' },
      { k: 'armR', h: [0.125, 0.375, 0.125], o: [0.375, 0.125, 0], t: 'arm' },
      { k: 'head', h: [0.25, 0.25, 0.25], o: [0, 0.75, 0], t: 'head' }
    ];
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const parts = defs.map(d => {
      const ox = d.o[0] * c + d.o[2] * s, oz = -d.o[0] * s + d.o[2] * c, n = Math.hypot(ox, d.o[1], oz) || 1;
      const sp = 7 + Math.random() * 5;
      return { ...d, p: [C[0] + ox, C[1] + d.o[1], C[2] + oz], v: [ox / n * sp + R() * 4, d.o[1] / n * sp * 0.6 + 5 + Math.random() * 4, oz / n * sp + R() * 4],
        a: [0, p.yaw, 0], w: [R() * 14, R() * 14, R() * 14], rest: false, trail: 0 };
    });
    const blood = [];
    for (let i = 0; i < 260; i++) {
      const th = Math.random() * PI2, ph = Math.acos(2 * Math.random() - 1), sp = 3 + Math.random() * 11;
      blood.push({ x: C[0], y: C[1], z: C[2], vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.cos(ph) * sp * 0.8 + 2, vz: Math.sin(ph) * Math.sin(th) * sp, s: 0.03 + Math.random() * 0.06, land: false });
    }
    this.burstS = { t: 0, C, parts, blood, cam: null, camDir: null, flash: 1 };
    this.huntLock = true; this.mutantK = 0; this.mutantBurst = 0;
    try { Sfx.gore(); } catch (e) { }
    Game.flickerPulse = 0.3;
    return true;
  },
  updateBurst(dt) {
    const S = this.burstS, p = Player; S.t += dt; p.vx = p.vz = 0; this.mutantK = 0; this.mutantBurst = 0;
    S.flash = Math.max(0, S.flash - dt * 3);
    const gy = (x, z) => World.topY(Math.floor(x), Math.floor(z)) + 1;
    for (const q of S.parts) {
      if (q.rest) continue;
      q.v[1] -= 22 * dt;
      for (let i = 0; i < 3; i++) { q.p[i] += q.v[i] * dt; q.a[i] += q.w[i] * dt; }
      if (SOLID[World.get(Math.floor(q.p[0]), Math.floor(q.p[1]), Math.floor(q.p[2]))] && q.p[1] > gy(q.p[0], q.p[2]) + 0.2) { q.v[0] *= -0.3; q.v[2] *= -0.3; }   // стена
      const g = gy(q.p[0], q.p[2]) + Math.min(q.h[0], q.h[1], q.h[2]);
      if (q.p[1] <= g) {
        q.p[1] = g;
        if (Math.abs(q.v[1]) > 3) { q.v[1] = -q.v[1] * 0.3; q.v[0] *= 0.6; q.v[2] *= 0.6; q.w = q.w.map(w => w * 0.5); this.burstSplat(q.p); }
        else { q.rest = true; q.v = [0, 0, 0]; q.w = [0, 0, 0]; q.a[0] = Math.round(q.a[0] / (Math.PI / 2)) * Math.PI / 2; q.a[2] = Math.round(q.a[2] / (Math.PI / 2)) * Math.PI / 2; this.burstSplat(q.p); }
      }
      // за летящей частью тянется кровь
      q.trail -= dt;
      if (q.trail <= 0 && S.blood.length < 600) { q.trail = 0.03; S.blood.push({ x: q.p[0], y: q.p[1], z: q.p[2], vx: 0, vy: 0, vz: 0, s: 0.03 + Math.random() * 0.03, land: false }); }
    }
    for (const b of S.blood) {
      if (b.land) continue;
      b.vy -= 16 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const g = gy(b.x, b.z) + 0.02; if (b.y <= g) { b.y = g; b.land = true; b.s = Math.max(b.s, 0.05); }
    }
    if (S.t >= 4.2) { this.burstEnd(true); return; }
    // камера сбоку, медленно облетает место взрыва
    const tg = [S.C[0], S.C[1] - 0.3, S.C[2]], D = 7;
    const free = dir => { const n = Math.hypot(dir[0], dir[1], dir[2]); let t = 0.5; for (; t < D; t += 0.1) if (SOLID[World.get(Math.floor(tg[0] + dir[0] / n * t), Math.floor(tg[1] + dir[1] / n * t), Math.floor(tg[2] + dir[2] / n * t))]) break; return Math.min(D, t); };
    if (!S.camDir) {
      let best = null, bt = -1;
      for (let k = 0; k < 12; k++) { const a = p.yaw + Math.PI / 2 + k * PI2 / 12, dir = [Math.sin(a), 0.45, Math.cos(a)], t = free(dir); if (t > bt + 0.3) { bt = t; best = a; } if (t >= D) break; }
      S.camYaw = best;
      S.camDir = true;
    }
    const a = S.camYaw + S.t * 0.12, dir = [Math.sin(a), 0.45, Math.cos(a)], dn = Math.hypot(dir[0], dir[1], dir[2]), t = Math.max(1.5, free(dir) - 0.3);
    const c = [tg[0] + dir[0] / dn * t, tg[1] + dir[1] / dn * t, tg[2] + dir[2] / dn * t];
    const lx = tg[0] - c[0], ly = tg[1] - c[1], lz = tg[2] - c[2], ll = Math.hypot(lx, ly, lz);
    S.cam = { x: c[0], y: c[1], z: c[2], yaw: Math.atan2(-lx, -lz), pitch: Math.asin(ly / ll), roll: 0 };
  },
  burstSplat(at) {
    const S = this.burstS;
    for (let i = 0; i < 10 && S.blood.length < 600; i++) S.blood.push({ x: at[0], y: at[1], z: at[2], vx: (Math.random() - 0.5) * 3, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 3, s: 0.03 + Math.random() * 0.03, land: false });
  },
  burstEnd(dead) {
    this.burstS = null; this.huntLock = false; this.mutantK = 0;
    if (dead && !Player.dead) killPlayer();
  },
  drawBurst(batch, cam) {
    const S = this.burstS; if (!S) return;
    const l = World.light(Math.floor(S.C[0]), Math.floor(S.C[1]), Math.floor(S.C[2])), sky = (l >> 4) / 15, blk = (l & 15) / 15;
    const S6 = t => [t, t, t, t, t, t], sk = TILE.av_skin, sh = TILE.av_shirt, BL = TILE.blood;
    const tiles = { pants: S6(TILE.av_pants), shirt: S6(sh), arm: [sh, sh, sh, sk, sh, sh], head: [TILE.av_side, TILE.av_side, TILE.av_hair, sk, TILE.av_hair, TILE.av_face] };
    for (const q of S.parts) {
      const [ax, ay, az] = q.a, cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
      const T = (x, y, z) => {
        let y1 = y * cx - z * sx, z1 = y * sx + z * cx;                       // X
        let x2 = x * cz - y1 * sz, y2 = x * sz + y1 * cz;                      // Z
        const x3 = x2 * cy + z1 * sy, z3 = -x2 * sy + z1 * cy;                 // Y
        return [q.p[0] + x3 - cam.x, q.p[1] + y2 - cam.y, q.p[2] + z3 - cam.z];
      };
      const [hx, hy, hz] = q.h;
      avBox(batch, -hx, -hy, -hz, hx, hy, hz, tiles[q.t], T, sky, blk);
      // рваные края в крови
      if (q.k === 'head') avBox(batch, -hx * 0.9, -hy - 0.02, -hz * 0.9, hx * 0.9, -hy + 0.03, hz * 0.9, S6(BL), T, sky, blk);
      else if (q.k === 'body') { avBox(batch, -hx * 0.9, -hy - 0.02, -hz * 0.9, hx * 0.9, -hy + 0.03, hz * 0.9, S6(BL), T, sky, blk); avBox(batch, -hx * 0.9, hy - 0.03, -hz * 0.9, hx * 0.9, hy + 0.02, hz * 0.9, S6(BL), T, sky, blk); }
      else avBox(batch, -hx * 0.9, hy - 0.03, -hz * 0.9, hx * 0.9, hy + 0.02, hz * 0.9, S6(BL), T, sky, blk);
    }
    for (const b of S.blood) {
      const r = b.land ? b.s * 1.3 : b.s, T = (x, y, z) => [b.x + x - cam.x, b.y + y - cam.y, b.z + z - cam.z];
      avBox(batch, -r, b.land ? -0.01 : -r, -r, r, b.land ? 0.005 : r, r, S6(BL), T, sky, blk);
    }
    // вспышка взрыва: кровавое облако в центре
    if (S.flash > 0) {
      const r = 0.4 + (1 - S.flash) * 1.4, T = (x, y, z) => [S.C[0] + x - cam.x, S.C[1] + y - cam.y, S.C[2] + z - cam.z];
      for (let i = 0; i < 6; i++) { const rr = r * (0.5 + 0.5 * Math.sin(i * 1.7 + S.t * 9)); avBox(batch, -rr, -rr * 0.8, -rr, rr, rr * 0.8, rr, S6(BL), (x, y, z) => T(x * Math.cos(i) - z * Math.sin(i), y, x * Math.sin(i) + z * Math.cos(i)), Math.max(0.8, sky), Math.max(blk, 0.6)); }
    }
  }
});
