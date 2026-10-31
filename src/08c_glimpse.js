// ============================================================
//  Размытые чёрные силуэты: мелькают на краю зрения при резком повороте камеры
// ============================================================
const Glimpse = {
  list: [], cool: 5, turnAcc: 0, lastYaw: null, sprites: null, _drawn: false,
  reset() { this.list = []; this.cool = 5; this.turnAcc = 0; this.lastYaw = null; },
  makeSprites() {
    const variants = [
      { tilt: 0, armL: 0, armR: 0, hunch: 0, tall: 1 },
      { tilt: 0.35, armL: -0.15, armR: 0.1, hunch: 6, tall: 1.05 },
      { tilt: -0.2, armL: 0.25, armR: -0.05, hunch: 12, tall: 1.12 }
    ];
    this.sprites = variants.map(v => {
      const W = 96, H = 256;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineCap = 'round'; x.lineJoin = 'round';
      const top = 250 - 240 * v.tall + 10;
      const sy = (y) => 250 - (250 - y) * v.tall;           // растянуть по высоте
      // голова
      x.save(); x.translate(48 + v.hunch * 0.6, sy(28)); x.rotate(v.tilt);
      x.beginPath(); x.ellipse(0, 0, 12, 17, 0, 0, PI2); x.fill(); x.restore();
      // шея и туловище
      x.lineWidth = 8; x.beginPath(); x.moveTo(48 + v.hunch * 0.5, sy(40)); x.lineTo(48 + v.hunch * 0.3, sy(54)); x.stroke();
      x.beginPath();
      x.moveTo(29 + v.hunch * 0.3, sy(54)); x.lineTo(67 + v.hunch * 0.3, sy(54));
      x.lineTo(59, sy(100)); x.lineTo(55, sy(132)); x.lineTo(58, sy(146));
      x.lineTo(38, sy(146)); x.lineTo(41, sy(132)); x.lineTo(37, sy(100)); x.closePath(); x.fill();
      // руки — длинные, тонкие
      const arm = (sx, dir, swing) => {
        x.lineWidth = 6; x.beginPath(); x.moveTo(sx, sy(58));
        const ex = sx + dir * (6 + swing * 30), ey = sy(118), hx = sx + dir * (4 + swing * 55), hy = sy(178);
        x.quadraticCurveTo(ex, ey, hx, hy); x.stroke();
        x.lineWidth = 2.5; for (let f = -1; f <= 1; f++) { x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + f * 3 + dir * 2, hy + 22); x.stroke(); }
      };
      arm(31 + v.hunch * 0.3, -1, v.armL); arm(65 + v.hunch * 0.3, 1, v.armR);
      // ноги
      x.lineWidth = 8;
      x.beginPath(); x.moveTo(42, sy(144)); x.quadraticCurveTo(40, sy(198), 39, sy(248)); x.stroke();
      x.beginPath(); x.moveTo(54, sy(144)); x.quadraticCurveTo(57, sy(198), 58, sy(248)); x.stroke();
      // размытие: много полупрозрачных копий со сдвигом
      const P = 24, b = document.createElement('canvas'); b.width = W + P * 2; b.height = H + P * 2;
      const bx = b.getContext('2d');
      for (let i = 0; i < 36; i++) {
        const a = Math.random() * PI2, r = Math.sqrt(Math.random()) * 10;
        bx.globalAlpha = 0.06; bx.drawImage(c, P + Math.cos(a) * r, P + Math.sin(a) * r * 1.4);
      }
      b.feet = H - 6 + P; b.hpx = 240 * v.tall + 6; b.cx = b.width / 2;
      void top;
      return b;
    });
  },
  // лицо существа в окне: бледный череп с чёрными глазницами (рисуется поверх кадра в точке окна)
  makeFace() {
    const W = 160, H = 210, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // череп
    const g = x.createRadialGradient(80, 92, 8, 80, 100, 98); g.addColorStop(0, '#dcd7c4'); g.addColorStop(0.55, '#a9a493'); g.addColorStop(1, '#4e4a40');
    x.fillStyle = g; x.beginPath();
    x.moveTo(80, 6); x.bezierCurveTo(128, 6, 140, 52, 134, 92); x.bezierCurveTo(130, 128, 112, 150, 104, 188);
    x.bezierCurveTo(96, 208, 64, 208, 56, 188); x.bezierCurveTo(48, 150, 30, 128, 26, 92); x.bezierCurveTo(20, 52, 32, 6, 80, 6); x.fill();
    // впалые щёки
    x.fillStyle = 'rgba(30,26,22,0.35)';
    for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(80 + sx * 44, 128, 10, 24, sx * 0.25, 0, PI2); x.fill(); }
    // глазницы
    for (const sx of [-1, 1]) {
      x.save(); x.translate(80 + sx * 26, 84); x.rotate(sx * 0.28);
      const eg = x.createRadialGradient(0, 0, 2, 0, 0, 24); eg.addColorStop(0, '#000'); eg.addColorStop(1, '#0a0707');
      x.fillStyle = eg; x.beginPath(); x.ellipse(0, 0, 17, 26, 0, 0, PI2); x.fill();
      x.fillStyle = '#f4f4ff'; x.beginPath(); x.ellipse(0, 4, 2.6, 3.6, 0, 0, PI2); x.fill();
      x.restore();
    }
    // нос
    x.fillStyle = '#120c0c'; x.beginPath(); x.ellipse(72, 124, 2.4, 7, 0.2, 0, PI2); x.fill(); x.beginPath(); x.ellipse(88, 124, 2.4, 7, -0.2, 0, PI2); x.fill();
    // рот с зубами
    x.fillStyle = '#080404'; x.beginPath(); x.ellipse(80, 164, 30, 18, 0, 0, PI2); x.fill();
    x.fillStyle = '#e8e2cc';
    for (let i = 0; i < 9; i++) {
      const tx = 54 + i * 6.5;
      x.beginPath(); x.moveTo(tx, 150 + Math.abs(i - 4) * 0.6); x.lineTo(tx + 5, 150 + Math.abs(i - 4) * 0.6); x.lineTo(tx + 2.5, 163 + rnd() * 5); x.fill();
      x.beginPath(); x.moveTo(tx, 179 - Math.abs(i - 4) * 0.6); x.lineTo(tx + 5, 179 - Math.abs(i - 4) * 0.6); x.lineTo(tx + 2.5, 168 - rnd() * 4); x.fill();
    }
    // трещины и прожилки
    x.strokeStyle = 'rgba(20,16,14,0.55)'; x.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { let px = 30 + rnd() * 100, py = 14 + rnd() * 120; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (rnd() - 0.5) * 16; py += 4 + rnd() * 10; x.lineTo(px, py); } x.stroke(); }
    // зерно
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + (rnd() * 0.25).toFixed(2) + ')' : 'rgba(255,255,240,' + (rnd() * 0.15).toFixed(2) + ')'; x.fillRect(rnd() * W, rnd() * H, 2, 2); }
    // обрезать до формы
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000';
    x.beginPath(); x.moveTo(80, 6); x.bezierCurveTo(128, 6, 140, 52, 134, 92); x.bezierCurveTo(130, 128, 112, 150, 104, 188);
    x.bezierCurveTo(96, 208, 64, 208, 56, 188); x.bezierCurveTo(48, 150, 30, 128, 26, 92); x.bezierCurveTo(20, 52, 32, 6, 80, 6); x.fill();
    return c;
  },
  update(dt) {
    const p = Player;
    if (this.lastYaw === null) this.lastYaw = p.yaw;
    let d = p.yaw - this.lastYaw; d = ((d + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
    this.lastYaw = p.yaw;
    this.turnAcc = this.turnAcc * Math.exp(-dt * 3.5) + Math.abs(d);
    this.cool -= dt;
    for (const g of this.list) { g.life -= dt; g.x += g.vx * dt; g.z += g.vz * dt; }
    this.list = this.list.filter(g => g.life > 0);
    if (!Game.settings.shadows || p.dead) { this.list = []; return; }
    if (this.turnAcc > 0.95 && this.cool <= 0) {
      // один резкий поворот — один бросок: шанс 5%
      this.cool = 1.2;
      if (Math.random() < (Ents.deepOn ? 0.05 : 0.015) && this.spawn()) { this.cool = (60 + Math.random() * 90) * (Ents.deepOn ? 0.6 : 1); Game.flickerPulse = 0.2; }
    }
    // если посмотреть прямо на силуэт — он тут же исчезает
    const L = lookDir();
    for (const g of this.list) {
      const dx = g.x - p.x, dy = g.y + g.h * 0.6 - (p.y + EYE), dz = g.z - p.z, dd = Math.hypot(dx, dy, dz);
      if ((L[0] * dx + L[1] * dy + L[2] * dz) / dd > Math.cos(6 * Math.PI / 180) && g.life > 0.06) g.life = 0.06;
    }
  },
  spawn() {
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z;
    const under = Game.eyeSky < 0.45;
    const n = 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0);
    let made = 0;
    for (let k = 0; k < 50 && made < n; k++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const ang = p.yaw + side * (0.25 + Math.random() * 0.38);   // край поля зрения
      const dist = under ? 6 + Math.random() * 10 : 9 + Math.random() * 16;
      const x = ex - Math.sin(ang) * dist, z = ez - Math.cos(ang) * dist;
      const bx = Math.floor(x), bz = Math.floor(z);
      if (!World.loaded(bx, bz)) continue;
      let y = -1;
      if (under) {
        for (let dy = -4; dy <= 4; dy++) {
          const yy = Math.floor(p.y) + dy;
          if (OPQ[World.get(bx, yy - 1, bz)] && !SOLID[World.get(bx, yy, bz)] && !SOLID[World.get(bx, yy + 1, bz)]) { y = yy; break; }
        }
      } else {
        y = World.topY(bx, bz) + 1;
        if (Math.abs(y - p.y) > 10 || isLiquid(World.get(bx, y, bz))) y = -1;
      }
      if (y < 0 || !Ents.lineClear(ex, ey, ez, x, y + 1.3, z)) continue;
      const life = 0.28 + Math.random() * 0.35, sp = 1 + Math.random() * 3;
      this.list.push({
        x, y, z, h: 1.9 + Math.random() * 0.6, life, max: life, spr: Math.floor(Math.random() * 3),
        vx: -Math.cos(ang) * side * sp, vz: Math.sin(ang) * side * sp, a: 0.75 + Math.random() * 0.2, flip: Math.random() < 0.5
      });
      made++;
    }
    if (made) Sfx.glimpse();
    return made > 0;
  },
  draw(cam) {
    const cv = $('glimpseFx');
    const S = Ents.peekS, peekOn = !!(S && Ents.mutant.active && S.fx !== undefined);
    if (!this.list.length && !peekOn) { if (this._drawn) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); this._drawn = false; } return; }
    if (!this.sprites) this.makeSprites();
    const W = innerWidth, H = innerHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
    const VP = Rend.VP, env = Game.env;
    const proj = (wx, wy, wz) => {
      const c = m4xv(VP, wx - cam.x, wy - cam.y, wz - cam.z, 1);
      if (c[3] <= 0.05) return null;
      return [(c[0] / c[3] * 0.5 + 0.5) * W, (1 - (c[1] / c[3] * 0.5 + 0.5)) * H];
    };
    for (const g of this.list) {
      const f = proj(g.x, g.y, g.z), h = proj(g.x, g.y + g.h, g.z);
      if (!f || !h) continue;
      const ph = f[1] - h[1]; if (ph < 4) continue;
      const spr = this.sprites[g.spr], s = ph / spr.hpx;
      const dist = Math.hypot(g.x - cam.x, g.z - cam.z);
      const fog = clamp((dist - env.fogStart) / Math.max(1, env.fogEnd - env.fogStart), 0, 1);
      const fade = Math.min(1, g.life / 0.12) * Math.min(1, (g.max - g.life) / 0.05 + 0.35);
      x.globalAlpha = g.a * fade * (1 - fog * 0.5);
      x.save();
      x.translate(f[0], f[1] - spr.feet * s);
      if (g.flip) x.scale(-1, 1);
      x.drawImage(spr, -spr.cx * s, 0, spr.width * s, spr.height * s);
      x.restore();
    }
    if (peekOn) {
      if (!this.face) this.face = this.makeFace();
      const p = Player;
      if (Ents.lineClear(p.x, p.y + EYE, p.z, S.fx, S.fy, S.fz)) {
        const t = proj(S.fx, S.fy - 0.95, S.fz), u = proj(S.fx, S.fy + 0.95, S.fz), k = Ents.mutantK;
        if (t && u && t[1] - u[1] > 6) {
          const h = t[1] - u[1], w = h * this.face.width / this.face.height, jx = (Math.random() - 0.5) * 6 * k, jy = (Math.random() - 0.5) * 4 * k;
          x.globalAlpha = (S.t < 0.08 ? 0.6 : 1) * (Ents.mutantBurst > 0 ? 1 : 0.92 + Math.random() * 0.08);
          x.drawImage(this.face, t[0] - w / 2 + jx, u[1] + jy, w, h);
        }
      }
    }
    x.globalAlpha = 1;
    this._drawn = true;
  }
};
