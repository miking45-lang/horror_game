// ============================================================
//  «Рассечение» (ЛКМ по хозяину мира вплотную, владелец в облике существа).
//  У игрока: экран от первого лица заваливается набок и падает к земле;
//  затем вид со стороны — рука существа проходит сквозь игрока, туловище падает набок, ноги остаются стоять.
//  Потом экран смерти.
// ============================================================
Object.assign(Ents, {
  slashS: null, slashL: null,
  forceSlash(from) {
    const p = Player;
    if (this.slashS || this.killS || this.mawS || this.burstS || p.dead || Game.state !== 'play') return false;
    if (this.stopMutantEvents) this.stopMutantEvents();
    if (UI.gui) UI.closeScreen();
    const fx = from && Number.isFinite(from.x) ? from.x : p.x - Math.sin(p.yaw) * 2, fz = from && Number.isFinite(from.z) ? from.z : p.z - Math.cos(p.yaw) * 2;
    this.slashS = { ph: 0, pt: 0, t: 0, from: [fx, fz], hs: (from && from.hs) || 1, side: Math.random() < 0.5 ? 1 : -1, blood: [], cut: false, cam: null, camDir: null, fp: { roll: 0, dy: 0 } };
    this.huntLock = true;
    try { Sfx.hurt(); Sfx.staticBurst(); } catch (e) { }
    Game.flickerPulse = 0.2;
    return true;
  },
  slashEnd(dead) {
    this.slashS = null; this.slashL = null; this.huntLock = false; this.mutantK = 0; this.mutantBurst = 0;
    if (dead && !this.obsTg && !Player.dead) killPlayer();
  },
  updateSlash(dt) {
    const S = this.slashS, p = this.tgt();
    S.t += dt; S.pt += dt; p.vx = 0; p.vz = 0; this.mutantK = 0; this.mutantBurst = 0;
    const ease = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    if (S.ph === 0) {                 // от первого лица: экран заваливается набок и падает
      const u = ease(S.pt / 1.1);
      S.fp.roll = S.side * u * 1.5; S.fp.dy = -1.25 * u * u;
      if (S.pt >= 1.6) { S.ph = 1; S.pt = 0; this.slashStart1(); }
      return;
    }
    // ---- со стороны: взмах руки, туловище падает набок ----
    const L = this.slashL; L.t += dt;
    // замах (0,6 с): корпус разворачивается назад, рука уходит вверх-назад;
    // удар (0,18 с): резкий разворот, предплечье проходит поперёк пояса; затем рука по инерции уходит дальше и опускается
    const TW = 0.6, TS = 0.18, TF = 0.45, tt = S.pt, lerp2 = (a, b, k) => a + (b - a) * k;
    let yw;
    if (tt < TW) {
      const u = ease(tt / TW);
      yw = lerp2(1.1, 1.65, u);
      L.aimK = Math.min(1, tt / 0.3); L.aimA = S.wind[0]; L.aimB = S.wind[1]; L.aimOpen = false;
      L.A = 0.12 * u;                                                // чуть приседает перед ударом
    } else if (tt < TW + TS) {
      const u = (tt - TW) / TS, k = u * u;                           // разгон
      yw = lerp2(1.65, -1.05, k);
      const ka = Math.min(1, u / 0.4);
      L.aimK = 1; L.aimA = lerp2(S.wind[0], S.strike[0], ka); L.aimB = lerp2(S.wind[1], S.strike[1], ka); L.aimOpen = true;
      L.A = 0.12 * (1 - u);
    } else {
      const u = ease((tt - TW - TS) / TF);
      yw = lerp2(-1.05, -1.55, u);
      L.aimA = S.strike[0]; L.aimB = S.strike[1]; L.A = 0;
      L.aimK = 1 - clamp((tt - TW - TS - 0.35) / 0.6, 0, 1) * 1;      // рука опускается
    }
    const prevSide = (L.yaw - S.yawMid) * S.side;
    L.yaw = L.by = S.yawMid + S.side * yw;
    if (!S.cut && tt >= TW && prevSide > 0 && yw <= 0) { S.cut = true; S.cutT = S.pt; if (!this.obsTg) Game.flickerPulse = 0.2; try { if (this.sfxOk()) { Sfx.hurt(); Sfx.staticBurst(); } } catch (e) { } }
    if (S.cut) {
      const u = clamp((S.pt - S.cutT) / 1.0, 0, 1);
      S.fall = ease(u);
      if (S.pt - S.cutT < 2.2) {      // кровь из среза: на ногах и на туловище
        const n = Math.floor(70 * dt + Math.random());
        for (let i = 0; i < n && S.blood.length < 320; i++) {
          const top = Math.random() < 0.55, o = top ? this.slashTorsoCut() : [p.x, p.y + 0.75, p.z];
          S.blood.push({ x: o[0] + (Math.random() - 0.5) * 0.2, y: o[1], z: o[2] + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 1.8, vy: 0.6 + Math.random() * 2, vz: (Math.random() - 0.5) * 1.8, s: 0.02 + Math.random() * 0.03, land: false });
        }
      }
    }
    for (const b of S.blood) {
      if (b.land) continue;
      b.vy -= 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const gy = World.topY(Math.floor(b.x), Math.floor(b.z)) + 1.02; if (b.y <= gy) { b.y = gy; b.land = true; }
    }
    if (S.pt >= 4.0) { this.slashEnd(true); return; }
    // камера сбоку, в профиль к существу и игроку
    const tg = [p.x, p.y + 1.1, p.z], D = 5.5;
    const free = dir => { const n = Math.hypot(dir[0], dir[1], dir[2]); let t = 0.5; for (; t < D; t += 0.1) if (SOLID[World.get(Math.floor(tg[0] + dir[0] / n * t), Math.floor(tg[1] + dir[1] / n * t), Math.floor(tg[2] + dir[2] / n * t))]) break; return Math.min(D, t); };
    if (!S.camDir) {
      const toC = Math.atan2(L.x - p.x, L.z - p.z); let best = null, bt = -1;
      for (const k of [Math.PI / 2, -Math.PI / 2, 1.1, -1.1, 2.0, -2.0, 0.6, -0.6, 2.6, -2.6]) { const a = toC + k, dir = [Math.sin(a), 0.3, Math.cos(a)], t = free(dir); if (t > bt + 0.4) { bt = t; best = dir; } if (t >= D) break; }
      S.camDir = best;
    }
    const dir = S.camDir, dn = Math.hypot(dir[0], dir[1], dir[2]), t = Math.max(1.2, free(dir) - 0.3);
    const c = [tg[0] + dir[0] / dn * t, tg[1] + dir[1] / dn * t, tg[2] + dir[2] / dn * t];
    const lx = tg[0] - c[0], ly = tg[1] + 0.4 - c[1], lz = tg[2] - c[2], ll = Math.hypot(lx, ly, lz);
    S.cam = { x: c[0], y: c[1], z: c[2], yaw: Math.atan2(-lx, -lz), pitch: Math.asin(ly / ll), roll: 0 };
  },
  // существо встаёт рядом (рука, отведённая в сторону и вниз, достаёт до пояса игрока)
  slashStart1() {
    const S = this.slashS, p = this.tgt(), hs = S.hs;
    let dx = S.from[0] - p.x, dz = S.from[1] - p.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); d = 1; }
    const reach = 0.235 * hs + 1.4 * hs;
    const L = Net.newPoseL(0);
    L.x = p.x + dx / d * reach; L.z = p.z + dz / d * reach; L.y = p.y; L.hs = hs; L.walk = 0;
    // рука вытянута вправо и вниз — к поясу игрока
    const drop = Math.max(0.3, 2.82 * hs - 0.9), len = 2.35 * hs;
    // удар: рука вытянута вбок и вниз на уровень пояса игрока; замах: рука вверх и назад
    S.strike = [0, Math.atan2(Math.sqrt(Math.max(0.01, len * len - drop * drop)), drop)];
    S.wind = [0.52, 2.52];
    L.aimK = 0; L.aimA = S.wind[0]; L.aimB = S.wind[1]; L.aimOpen = false;
    // при каком курсе правая рука смотрит на игрока: R = (cos a, −sin a) = направление к игроку
    const tx = p.x - L.x, tz = p.z - L.z;
    S.yawMid = Math.atan2(-tz, tx);
    L.yaw = L.by = S.yawMid + S.side * 1.1;
    this.slashL = L;
    if (!this.obsTg) Net.sceneSend('slash', { fx: +S.from[0].toFixed(2), fz: +S.from[1].toFixed(2), hs: S.hs, side: S.side });   // остальные видят удар со стороны
  },
  // где сейчас срез на туловище (для крови)
  slashTorsoCut() {
    const S = this.slashS, p = this.tgt(), f = S.fall || 0, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const lx = -S.side * 0.35 * f, ly = 0.75 - 0.5 * f * f;
    return [p.x + lx * c, p.y + ly, p.z - lx * s];
  },
  drawSlash(batch, cam) {
    const S = this.slashS; if (!S || S.ph < 1) return;
    const p = this.tgt(), l = World.light(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)), sky = (l >> 4) / 15, blk = (l & 15) / 15;
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), base = (x, y, z) => [p.x + x * c + z * s - cam.x, p.y + y - cam.y, p.z - x * s + z * c - cam.z];
    const S6 = t => [t, t, t, t, t, t], sh = TILE.av_shirt, sk = TILE.av_skin, BL = TILE.blood;
    // ноги — стоят на месте
    avBox(batch, -0.25, 0, -0.125, 0, 0.75, 0.125, S6(TILE.av_pants), base, sky, blk);
    avBox(batch, 0, 0, -0.125, 0.25, 0.75, 0.125, S6(TILE.av_pants), base, sky, blk);
    if (S.cut) avBox(batch, -0.24, 0.72, -0.12, 0.24, 0.76, 0.12, S6(BL), base, sky, blk);
    // верх: поворот вокруг оси «вперёд» в точке пояса, падает набок и вниз
    const f = S.fall || 0, th = S.side * f * Math.PI / 2, ct = Math.cos(th), st = Math.sin(th);
    const up = (x, y, z) => { const yy = y - 0.75, x2 = x * ct - yy * st, y2 = x * st + yy * ct; return base(x2 - S.side * 0.35 * f, 0.75 + y2 - 0.5 * f * f, z); };
    avBox(batch, -0.25, 0.75, -0.125, 0.25, 1.5, 0.125, S6(sh), up, sky, blk);
    avBox(batch, -0.5, 0.75, -0.125, -0.25, 1.5, 0.125, [sh, sh, sh, sk, sh, sh], up, sky, blk);
    avBox(batch, 0.25, 0.75, -0.125, 0.5, 1.5, 0.125, [sh, sh, sh, sk, sh, sh], up, sky, blk);
    avBox(batch, -0.25, 1.5, -0.25, 0.25, 2.0, 0.25, [TILE.av_side, TILE.av_side, TILE.av_hair, sk, TILE.av_hair, TILE.av_face], up, sky, blk);
    if (S.cut) avBox(batch, -0.24, 0.74, -0.12, 0.24, 0.78, 0.12, S6(BL), up, sky, blk);
    for (const b of S.blood) {
      const r = b.land ? 0.06 : b.s, T = (x, y, z) => [b.x + x - cam.x, b.y + y - cam.y, b.z + z - cam.z];
      avBox(batch, -r, b.land ? -0.01 : -r, -r, r, b.land ? 0.005 : r, r, S6(BL), T, sky, blk);
    }
  }
});
