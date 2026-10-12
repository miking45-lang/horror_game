// ============================================================
//  «Из экрана» (NumPad 3, владелец в облике существа): у хозяина мира лицо существа поднимается
//  из-под нижнего края экрана вплотную к камере, рычит (звук владельца), раскрывает пасть шире
//  и наполовину заглатывает голову игрока — верхние 40% экрана занимают нёбо и зубы.
//  Затем вид от третьего лица: существо смыкает челюсти, откусывает голову, игрок умирает.
// ============================================================
Object.assign(Ents, {
  mawS: null, mawL: null,
  forceMaw() {
    const p = Player;
    if (this.mawS || this.killS || this.slashS || this.burstS || p.dead || Game.state !== 'play') return false;
    if (this.stopMutantEvents) this.stopMutantEvents();
    if (UI.gui) UI.closeScreen();
    if (Sfx.ctx && !Sfx.cryBufs[2]) Sfx.loadCry();
    this.mawS = { ph: 0, pt: 0, t: 0, roarDur: 3, blood: [], bitten: false, cam: null, camDir: null };
    this.huntLock = true;
    Portrait.P = { rise: 0, jaw: 0, push: 0, swallow: 0 };
    Portrait.show('maw');
    return true;
  },
  mawEnd(dead) {
    this.mawS = null; this.mawL = null; this.huntLock = false; this.mutantK = 0; this.mutantBurst = 0;
    Portrait.P = { rise: 0, jaw: 0, push: 0, swallow: 0 }; Portrait.hide();
    if (dead && !Player.dead) killPlayer();
  },
  updateMaw(dt) {
    const S = this.mawS, p = Player, P = Portrait.P;
    S.t += dt; S.pt += dt; p.vx = 0; p.vz = 0;
    const ease = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    this.mutantK = 0; this.mutantBurst = 0;
    if (S.ph < 3) Portrait.update(dt);
    if (S.ph === 0) {                    // поднимается из-под экрана (1,8 с)
      P.rise = ease(S.pt / 1.8); P.jaw = 0;
      if (Math.random() < dt * 4) Game.flickerPulse = 0.1;
      if (S.pt >= 1.8) { S.ph = 1; S.pt = 0; const d = Sfx.cry(2, 1, 0); S.roarDur = d > 0 ? d : 3; }
    } else if (S.ph === 1) {             // рычит, раскрывая пасть, пока играет звук
      P.rise = 1; P.jaw = 0.45 * ease(S.pt / 0.6) + Math.sin(S.t * 35) * 0.03;
      if (S.pt >= S.roarDur) { S.ph = 2; S.pt = 0; }
    } else if (S.ph === 2) {             // раскрывает ещё шире и наползает на голову (1,4 с), затем пасть сверху (0,9 с)
      if (S.pt < 1.4) { const u = ease(S.pt / 1.4); P.jaw = 0.45 + 0.3 * u; P.push = 0.55 * u; P.swallow = 0; }
      else P.swallow = 1;
      if (S.pt >= 2.3) { S.ph = 3; S.pt = 0; Portrait.hide(); this.mawStart3(); }
    } else if (S.ph === 3) {             // со стороны: челюсти смыкаются, голова откушена
      this.mawStep3(dt);
      if (S.pt >= 3.2) { this.mawEnd(true); return; }
    }
  },
  // сцена от третьего лица: существо склонилось над игроком, голова игрока у него во рту
  mawStart3() {
    const p = Player, a = p.yaw;   // существо стоит перед игроком, лицом к нему
    const F = [-Math.sin(a), -Math.cos(a)];
    const L = Net.newPoseL(a);
    L.x = p.x + F[0] * 0.9; L.z = p.z + F[1] * 0.9; L.y = p.y;
    L.yaw = L.by = Math.atan2(p.x - L.x, p.z - L.z);
    L.A = 1; L.hp = -1.9; L.walk = 0;   // в наклоне лицо смотрит вперёд-вниз, на голову игрока (не в небо)
    L.jawOpen = 0.09; L.hs = 1.4;   // склонилось: голова как раз на уровне головы игрока
    this.mawL = L;
  },
  mawStep3(dt) {
    const S = this.mawS, L = this.mawL, p = Player;
    L.t += dt;
    // один раз ставим существо так, чтобы его голова оказалась на голове игрока (поза и разворот дальше не меняются)
    const tgt = [p.x, p.y + 1.75, p.z];
    if (!S.aligned && L._head) {
      const h = [L._head[0] - L.x, L._head[1] - L.y, L._head[2] - L.z];
      L.x = tgt[0] - h[0]; L.y = tgt[1] - h[1]; L.z = tgt[2] - h[2]; S.aligned = true;
    }
    // челюсти смыкаются на 0,8 с — голова откушена
    L.jawOpen = S.pt < 0.8 ? 0.09 * (1 - S.pt / 0.8) : 0.004;
    if (!S.bitten && S.pt >= 0.8) {
      S.bitten = true; Game.flickerPulse = 0.25;
      try { Sfx.hurt(); Sfx.staticBurst(); } catch (e) { }
    }
    // кровь из шеи
    if (S.bitten && S.pt < 2.6) {
      const n = Math.floor(60 * dt + Math.random());
      for (let i = 0; i < n && S.blood.length < 300; i++)
        S.blood.push({ x: p.x + (Math.random() - 0.5) * 0.2, y: p.y + 1.5, z: p.z + (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 2, s: 0.02 + Math.random() * 0.03, land: false });
    }
    for (const b of S.blood) {
      if (b.land) continue;
      b.vy -= 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const gy = World.topY(Math.floor(b.x), Math.floor(b.z)) + 1.02;
      if (b.y <= gy) { b.y = gy; b.land = true; }
    }
    // камера сбоку (в профиль к существу и игроку), смотрит на голову игрока
    const tg = [p.x, p.y + 1.9, p.z], D = 4.3;
    const free = dir => { const n = Math.hypot(dir[0], dir[1], dir[2]); let t = 0.5; for (; t < D; t += 0.1) if (SOLID[World.get(Math.floor(tg[0] + dir[0] / n * t), Math.floor(tg[1] + dir[1] / n * t), Math.floor(tg[2] + dir[2] / n * t))]) break; return Math.min(D, t); };
    if (!S.camDir) {
      if (!S.aligned) return;   // сначала существо встаёт на место
      let best = null, bt = -1;
      for (const k of [Math.PI / 2, -Math.PI / 2, 1.2, -1.2, 1.9, -1.9, 0.8, -0.8, 2.4, -2.4]) { const a = L.yaw + k, dir = [Math.sin(a), 0.2, Math.cos(a)], t = free(dir); if (t > bt + 0.4) { bt = t; best = dir; } if (t >= D) break; }
      S.camDir = best;
    }
    const dir = S.camDir, dn = Math.hypot(dir[0], dir[1], dir[2]), t = Math.max(1.2, free(dir) - 0.3);
    const c = [tg[0] + dir[0] / dn * t, tg[1] + dir[1] / dn * t, tg[2] + dir[2] / dn * t];
    const lx = tg[0] - c[0], ly = tg[1] + 0.2 - c[1], lz = tg[2] - c[2], ll = Math.hypot(lx, ly, lz);
    S.cam = { x: c[0], y: c[1], z: c[2], yaw: Math.atan2(-lx, -lz), pitch: Math.asin(ly / ll), roll: 0 };
  },
  // игрок от третьего лица: после укуса — без головы, кровь
  drawMaw(batch, cam) {
    const S = this.mawS; if (!S || S.ph < 3) return;
    const p = Player, q = { cx: p.x, cy: p.y, cz: p.z, cya: p.yaw, pi: 0, s: 0, walk: 0, wph: 0, m: '', o: 0 };
    if (!S.bitten) Net.drawAv(batch, cam, q);
    else {
      const l = World.light(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)), sky = (l >> 4) / 15, blk = (l & 15) / 15;
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), tf = (x, y, z) => [p.x + x * c + z * s - cam.x, p.y + y - cam.y, p.z - x * s + z * c - cam.z];
      const S6 = t => [t, t, t, t, t, t], sh = TILE.av_shirt, sk = TILE.av_skin;
      avBox(batch, -0.25, 0, -0.125, 0, 0.75, 0.125, S6(TILE.av_pants), tf, sky, blk);
      avBox(batch, 0, 0, -0.125, 0.25, 0.75, 0.125, S6(TILE.av_pants), tf, sky, blk);
      avBox(batch, -0.25, 0.75, -0.125, 0.25, 1.5, 0.125, S6(sh), tf, sky, blk);
      avBox(batch, -0.5, 0.75, -0.125, -0.25, 1.5, 0.125, [sh, sh, sh, sk, sh, sh], tf, sky, blk);
      avBox(batch, 0.25, 0.75, -0.125, 0.5, 1.5, 0.125, [sh, sh, sh, sk, sh, sh], tf, sky, blk);
      avBox(batch, -0.2, 1.5, -0.1, 0.2, 1.56, 0.1, S6(TILE.blood), tf, sky, blk);   // шея
    }
    const l = World.light(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)), sky = (l >> 4) / 15, blk = (l & 15) / 15;
    for (const b of S.blood) {
      const s = b.land ? 0.06 : b.s, T = (x, y, z) => [b.x + x - cam.x, b.y + y - cam.y, b.z + z - cam.z];
      avBox(batch, -s, b.land ? -0.01 : -s, -s, s, b.land ? 0.005 : s, s, [TILE.blood, TILE.blood, TILE.blood, TILE.blood, TILE.blood, TILE.blood], T, sky, blk);
    }
  }
});
