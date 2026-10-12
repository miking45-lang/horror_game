// ============================================================
//  «Охота»: ночью (после первой встречи) существо медленно идёт за игроком, пока играет трек.
//  Оторвался — на конец трека всё исчезает; догнало — шум, затем на 5 секунд полноэкранный 3D-портрет.
// ============================================================
// ---- 3D-портрет (трассировка лучей по формам, низкое разрешение, как всё в игре — крупными пикселями) ----
const Portrait = {
  cv: null, ctx: null, img: null, W: 176, H: 99, on: false, t: 0, acc: 0,
  init() {
    if (this.cv) return;
    const cv = document.createElement('canvas'); cv.id = 'huntPic'; cv.width = this.W; cv.height = this.H;
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:6;image-rendering:pixelated;display:none;background:#000;pointer-events:none';
    document.body.appendChild(cv); this.cv = cv; this.ctx = cv.getContext('2d'); this.img = this.ctx.createImageData(this.W, this.H);
  },
  mode: 'hunt',
  P: { rise: 0, jaw: 0, push: 0, swallow: 0 },   // режим 'maw' (NumPad 3): параметры задаёт сцена, фон прозрачный
  show(mode) { this.init(); this.mode = mode || 'hunt'; this.on = true; this.t = 0; this.acc = 1; this.cv.style.display = 'block'; this.cv.style.background = this.mode === 'maw' ? 'transparent' : '#000'; this.draw(); },
  hide() { this.on = false; if (this.cv) this.cv.style.display = 'none'; },
  update(dt) {
    if (!this.on) return;
    this.t += dt; this.acc += dt;
    if (this.acc >= 1 / 11) { this.acc = 0; this.draw(); }
  },
  // пасть сомкнулась над головой: верхние 40% экрана — нёбо и ряд зубов, ниже — мир
  drawSwallow() {
    const W = this.W, H = this.H, d = this.img.data, t = this.t, edge = H * 0.4, TP = W / 9;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const o4 = (j * W + i) * 4, e = edge + Math.sin(i * 0.21 + t * 3) * 1.2 + Math.sin(i * 0.07) * 2;
      const q = ((i + TP * 0.5) % TP) / TP - 0.5, toothLen = 7 + 4 * Math.abs(Math.sin(Math.floor((i + TP * 0.5) / TP) * 2.3));
      const toothY = e + toothLen * (1 - Math.abs(q) * 2.2);
      let r, g, b;
      if (j < e - 3) {               // нёбо: тёмно-красное, влажное, с рёбрами
        const k = j / e, rib = 0.75 + 0.25 * Math.sin(j * 0.9 + Math.sin(i * 0.15) * 2), wet = Math.max(0, Math.sin(i * 0.3 + j * 0.5 + t * 2)) ** 12 * 60;
        r = (25 + 85 * k) * rib + wet; g = (2 + 8 * k) * rib + wet * 0.5; b = (3 + 10 * k) * rib + wet * 0.5;
      } else if (j < e) { r = 90; g = 12; b = 14; }                     // дёсны
      else if (j < toothY && Math.abs(q) < 0.45) {                     // зубы
        const sh = 0.65 + 0.35 * (1 - Math.abs(q) * 2); r = 225 * sh; g = 214 * sh; b = 180 * sh;
      } else { d[o4 + 3] = 0; continue; }
      const gr = (Math.random() - 0.5) * 26, sc = (j & 1) ? 0.88 : 1;
      d[o4] = Math.max(0, Math.min(255, r * sc + gr)); d[o4 + 1] = Math.max(0, Math.min(255, g * sc + gr)); d[o4 + 2] = Math.max(0, Math.min(255, b * sc + gr)); d[o4 + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
  },
  // сцена: череп с провалами глаз, длинная челюсть с зубами, чёрная шея и плечи
  draw() {
    if (this.mode === 'maw' && this.P.swallow) { this.drawSwallow(); return; }
    const W = this.W, H = this.H, d = this.img.data, t = this.t, maw = this.mode === 'maw', MP = this.P;
    const grin = this.mode === 'grin', push = Math.min(1, t / (grin ? 2.4 : 4.2)), ease = push * push * (3 - 2 * push);
    const camZ = maw ? -1.05 + 0.6 * MP.push : -3.6 + 1.9 * ease, shake = maw ? (0.006 + 0.02 * MP.jaw) * (Math.random() - 0.5) : (0.004 + 0.01 * (1 - ease)) * (Math.random() - 0.5);
    const rise = maw ? (1 - MP.rise) * 2.6 : 0;   // существо поднимается из-под низа экрана
    const yaw = maw ? (Math.random() < 0.08 ? (Math.random() - 0.5) * 0.12 : 0) : Math.sin(t * 1.3) * 0.12 + (Math.random() < 0.06 ? (Math.random() - 0.5) * 0.25 : 0), cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const jaw = maw ? 0.04 + 0.5 * MP.jaw + Math.sin(t * 40) * 0.01 * MP.jaw : grin ? 0.03 + 0.07 * Math.min(1, t / 0.4) + Math.sin(t * 22) * 0.006 : 0.05 + 0.22 * Math.min(1, Math.max(0, (t - 0.5) / 1.2)) + Math.sin(t * 18) * 0.012 * (t > 1.7 ? 1 : 0);
    const eyeG = 0.6 + 0.4 * Math.sin(t * 9 + Math.sin(t * 3));
    let mat = 0;
    const sph = (x, y, z, rx, ry, rz) => { const a = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz)); return (a - 1) * Math.min(rx, ry, rz); };
    const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
    const sdf = (px, py, pz) => {
      // поворот головы вокруг Y
      const x = px * cyw - pz * syw, z = px * syw + pz * cyw, y = py + rise, ax = Math.abs(x);
      // вытянутый череп + сужающаяся челюсть
      let h = sph(x, y - 0.25, z, 0.43, 0.72, 0.46);
      h = smin(h, sph(x, y + 0.5 + jaw * 0.55, z, 0.26, 0.3, 0.29), 0.18);
      // глазницы (глубокие), ноздри
      h = Math.max(h, -sph(ax - 0.19, y - 0.32, z + 0.4, 0.15, 0.2, 0.22));
      h = Math.max(h, -sph(ax - 0.04, y - 0.04, z + 0.45, 0.028, 0.07, 0.07));
      // пасть: полость, раскрывающаяся вниз
      let best;
      if (grin) {
        // ужасающая улыбка: широкий изогнутый до самых скул разрез, полный мелких зубов
        const yy = y + 0.2 - 2.2 * x * x;
        h = Math.max(h, -sph(x, yy, z + 0.3, 0.40, 0.07 + jaw * 0.9, 0.24));
        best = h; mat = 1;
        if (ax < 0.36) {
          const q = x - 0.062 * Math.round(x / 0.062), dz = Math.abs(z + 0.36) - 0.03;
          const up = Math.max(Math.abs(q) - Math.max(0.003, 0.016 + yy * 0.2), dz, Math.abs(yy - 0.05 - jaw * 0.8) - 0.05);
          const lo = Math.max(Math.abs(q) - Math.max(0.003, 0.016 - yy * 0.2), dz, Math.abs(yy + 0.05 + jaw * 0.8) - 0.05);
          const td = Math.min(up, lo); if (td < best) { best = td; mat = 2; }
        }
      } else {
      h = Math.max(h, -sph(x, y + 0.25 + jaw * 0.55, z + 0.3, 0.235, 0.05 + jaw * 0.6, 0.22));
      best = h; mat = 1;
      // зубы: два ряда игольчатых клыков (повтор по X)
      if (ax < 0.22) {
        const q = x - 0.046 * Math.max(-5, Math.min(5, Math.round(x / 0.046)));
        const dz = Math.abs(z + 0.33) - 0.03;
        const up = Math.max(Math.abs(q) - Math.max(0.003, 0.02 + (y + 0.2) * 0.16), dz, Math.abs(y + 0.255) - 0.06);
        const yl = -0.31 - jaw * 1.1;
        const lo = Math.max(Math.abs(q) - Math.max(0.003, 0.02 - (y - yl) * 0.16), dz, Math.abs(y - yl - 0.05) - 0.06);
        const td = Math.min(up, lo);
        if (td < best) { best = td; mat = 2; }
      }
      }
      // светящиеся глаза в глубине глазниц
      const e = Math.sqrt((ax - 0.19) * (ax - 0.19) + (y - 0.3) * (y - 0.3) + (z + 0.27) * (z + 0.27)) - 0.034;
      if (e < best) { best = e; mat = 3; }
      // шея и плечи — чёрные
      const neck = Math.max(Math.sqrt(x * x + z * z) - 0.17, Math.abs(y + 1.4) - 0.75);
      const sh = sph(px, py + rise + 2.1, pz + 0.05, 1.55, 0.36, 0.55);
      const body = smin(neck, sh, 0.35);
      if (body < best) { best = body; mat = 4; }
      return best;
    };
    const fov = 0.62, asp = W / H;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = ((i + 0.5) / W * 2 - 1) * asp * fov, v = (1 - (j + 0.5) / H * 2) * fov;
      let dx = u, dy = v - 0.04, dz = 1; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      let ox = shake, oy = maw ? 0.12 - 0.55 * MP.push : 0.18, oz = camZ, tt = 0, hit = false, steps = 0;
      // луч сначала должен попасть в ограничивающий объём (быстро отбрасываем пустые пиксели)
      for (; steps < 46; steps++) {
        const s = sdf(ox + dx * tt, oy + dy * tt, oz + dz * tt);
        if (s < 0.004) { hit = true; break; }
        tt += s * 0.9; if (tt > 9) break;
      }
      let r = 0, g = 0, b = 0;
      const o4 = (j * W + i) * 4;
      if (hit) {
        const hx = ox + dx * tt, hy = oy + dy * tt, hz = oz + dz * tt, m = mat;
        const e = 0.012;
        const nx = sdf(hx + e, hy, hz) - sdf(hx - e, hy, hz), ny = sdf(hx, hy + e, hz) - sdf(hx, hy - e, hz), nz = sdf(hx, hy, hz + e) - sdf(hx, hy, hz - e);
        const nl = Math.hypot(nx, ny, nz) || 1, Nx = nx / nl, Ny = ny / nl, Nz = nz / nl;
        mat = m;
        // освещение: холодный свет сверху-слева и красный отсвет снизу
        const l1 = Math.max(0, Nx * -0.45 + Ny * 0.6 + Nz * -0.66), l2 = Math.max(0, Ny * -0.5 + Nz * -0.5);
        // дешёвая окклюзия: сколько света «глотает» близкая геометрия
        const ao = 0.35 + 0.65 * Math.min(1, Math.max(0, sdf(hx + Nx * 0.12, hy + Ny * 0.12, hz + Nz * 0.12) / 0.12));
        const rim = Math.pow(1 - Math.max(0, -(Nx * dx + Ny * dy + Nz * dz)), 3);
        if (m === 3) { r = 255 * eyeG; g = 250 * eyeG; b = 255 * eyeG; }
        else if (m === 4) { const k = (0.015 + 0.06 * l1 + 0.12 * rim) * ao; r = 255 * k; g = 255 * k * 0.95; b = 255 * k * 1.1; }
        else {
          const k = (0.1 + 0.9 * l1) * ao + 0.1 * rim, kr = l2 * 0.25 * ao;
          if (m === 2) { r = 238 * k + 60 * kr; g = 230 * k + 10 * kr; b = 196 * k; }
          else {
            // кожа черепа: бледная, с тёмными прожилками от шума
            const n = Math.sin(hx * 41 + Math.sin(hy * 37)) * Math.sin(hy * 29 + hz * 17) * 0.5 + 0.5;
            const tone = 0.78 - 0.28 * n * n;
            r = (214 * k + 70 * kr) * tone; g = (205 * k + 12 * kr) * tone; b = (178 * k) * tone;
          }
        }
        const fog = Math.min(1, Math.max(0, (tt - (camZ + 2.2)) / 3.0)) * 0.0;
        r *= 1 - fog; g *= 1 - fog; b *= 1 - fog;
      } else if (maw) { d[o4 + 3] = 0; continue; }   // вне существа — прозрачно, виден мир
      else { const vg = 6 + 10 * Math.max(0, 1 - Math.hypot(u, v) * 1.4); r = vg * 1.4; g = vg * 0.3; b = vg * 0.3; }
      // зерно и сканлайны
      const gr = (Math.random() - 0.5) * 34, sc = (j & 1) ? 0.86 : 1;
      d[o4] = Math.max(0, Math.min(255, r * sc + gr)); d[o4 + 1] = Math.max(0, Math.min(255, g * sc + gr)); d[o4 + 2] = Math.max(0, Math.min(255, b * sc + gr)); d[o4 + 3] = 255;
    }
    // редкие горизонтальные срывы картинки
    if (!maw && Math.random() < 0.3) {
      const y0 = Math.floor(Math.random() * H), hh = 1 + Math.floor(Math.random() * 4), sh = Math.floor((Math.random() - 0.5) * 24);
      for (let y = y0; y < Math.min(H, y0 + hh); y++) {
        const row = new Uint8ClampedArray(d.buffer.slice(y * W * 4, (y + 1) * W * 4));
        for (let x = 0; x < W; x++) { const sx = ((x + sh) % W + W) % W; for (let c = 0; c < 4; c++) d[(y * W + x) * 4 + c] = row[sx * 4 + c]; }
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
};

// ---- логика охоты ----
Object.assign(Ents, {
  huntS: null, huntK: 0, huntCool: 200, huntRoll: 10, huntT: 0, huntLock: false,
  // верхняя опора под ногами существа в колонке (листва проходима)
  huntGround(x, z, y0) {
    const ix = Math.floor(x), iz = Math.floor(z);
    if (!World.loaded(ix, iz)) return null;
    const top = Math.floor(y0) + 3, bot = Math.floor(y0) - 4;
    for (let y = top; y >= bot; y--) {
      const b = World.get(ix, y, iz);
      if (b && SOLID[b] && !isLiquid(b) && !isLeafId(b) && b !== B.CACTUS) {
        const a1 = World.get(ix, y + 1, iz), a2 = World.get(ix, y + 2, iz);
        const free = c => !c || !SOLID[c] || isLeafId(c);
        return free(a1) && free(a2) ? y + 1 : null;
      }
      if (b && isLiquid(b)) return null;
    }
    return null;
  },
  // ставит существо в точке на расстоянии dist от игрока (направление angle, мировой угол вокруг игрока)
  huntPlace(angle, dist) {
    const p = Player, L = this.mutant;
    for (let k = 0; k < 14; k++) {
      const a = angle + (k === 0 ? 0 : (Math.random() - 0.5) * 1.6), r = dist + (k === 0 ? 0 : (Math.random() - 0.5) * 4);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const gy = this.huntGround(x, z, p.y);
      if (gy === null || Math.abs(gy - p.y) > 6) continue;
      L.x = x; L.z = z; L.y = gy; return true;
    }
    return false;
  },
  startHunt() {
    const p = Player, L = this.mutant;
    const d = Sfx.hunt(); if (!d) return false;
    const behind = Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw));        // угол направления «позади» (x=cos a, z=sin a)
    Object.assign(L, { active: true, day: false, win: false, back: false, peek: false, gp: 0, scream: -1, hunt: true, t: Math.random() * 100, life: 0, seen: true, seenT: 0, twitchV: 0, twT: 9, losT: 0, los: true, A: 0, S: 0, snapT: 0, phase: 0, ph: 0, walk: 0, wph: 0 });
    if (!this.huntPlace(behind + (Math.random() - 0.5) * 2.2, 24)) { L.active = false; L.hunt = false; Sfx.huntStop(0.1); return false; }
    this.fig.active = false; this.encounters++;
    this.huntS = { t: 0, dur: d, phase: 0, ct: 0, tp: 6, stuck: 0, lx: L.x, lz: L.z, sk: 0 };
    this.mutantBurst = 0.35; Sfx.staticBurst(); Game.flickerPulse = 0.5;
    return true;
  },
  huntEnd(caught) {
    const L = this.mutant;
    this.huntS = null; L.active = false; L.hunt = false; L.walk = 0; this.mutantK = 0; this.huntLock = false; Portrait.hide(); this.pictureOn = false;
    this.mutantCool = 150 + Math.random() * 100; this.huntCool = (800 + Math.random() * 600) * (this.deepOn ? 0.35 : 1);
    if (!caught) { this.mutantBurst = 0.5; Sfx.staticBurst(); Game.flickerPulse = 0.6; }
  },
  updateHuntTrigger(dt, night) {
    const p = Player, L = this.mutant;
    this.huntCool -= dt;
    const ok = this.encounters >= 1 && night >= 0.8 && !this.inHouse && !this.indoor && this.skyOk(0.35) && !p.eyeInWater && !p.flying && this.huntCool <= 0 && this.mutantCool <= 0 && !this.glitchS && !this.dreadS && !this.peekS && !L.active && Sfx.huntReady();
    if (!ok) { this.huntT = 0; return; }
    this.huntT += dt; if (this.huntT < (this.deepOn ? 7 : 20)) return;
    this.huntRoll -= dt; if (this.huntRoll > 0) return;
    this.huntRoll = this.deepOn ? 6 : 10;
    if (Math.random() < (this.deepOn ? 0.13 : 0.015)) { if (!this.startHunt()) this.huntRoll = 4; }
  },
  updateHunt(dt) {
    const S = this.huntS, L = this.mutant, p = Player; S.t += dt;
    Portrait.update(dt);
    if (S.phase === 1) {                      // поймал
      S.ct += dt; this.huntLock = true; p.vx = 0; p.vz = 0;
      if (S.ct < 0.9) {                       // удар: максимум помех и шума, существо вплотную
        this.mutantK = 1; this.mutantBurst = 0.2; L.t += dt;
        L.yaw = Math.atan2(-(L.x - p.x), -(L.z - p.z));
      } else {
        if (!this.pictureOn) { this.pictureOn = true; L.active = false; this.mutantK = 0; Portrait.show(); Game.flickerPulse = 0; }
        if (S.ct >= 0.9 + 5) this.huntEnd(true);
      }
      return;
    }
    // ---- погоня ----
    L.t += dt; L.life += dt;
    const ex = p.x, ez = p.z, dx = ex - L.x, dz = ez - L.z, dh = Math.hypot(dx, dz);
    L.yaw = Math.atan2(-(L.x - ex), -(L.z - ez));
    S.tp -= dt;
    // движение: медленно, огибая препятствия
    const spd = 2.5 + (dh < 9 ? 0.4 : 0), base = Math.atan2(dz, dx), L0 = { x: L.x, z: L.z };
    let moved = false;
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
      const nx = L.x + Math.cos(base + off) * spd * dt, nz = L.z + Math.sin(base + off) * spd * dt;
      const gy = this.huntGround(nx, nz, L.y);
      if (gy === null || gy - L.y > 1.01 || L.y - gy > 3) continue;
      L.x = nx; L.z = nz; L.y += (gy - L.y) * Math.min(1, dt * 9); moved = true; break;
    }
    L.walk += ((moved ? 1 : 0) - L.walk) * Math.min(1, dt * 4); L.wph += dt * spd * 1.9 * (moved ? 1 : 0);
    S.stuck = Math.hypot(L.x - S.lx, L.z - S.lz) > 0.6 ? 0 : S.stuck + dt;
    if (S.stuck === 0) { S.lx = L.x; S.lz = L.z; }
    // игрок ушёл далеко (или существо застряло) — оно оказывается в 15 блоках позади него
    if (S.tp <= 0 && (dh > 38 || (S.stuck > 4 && dh > 8))) {
      const sp = Math.hypot(p.vx, p.vz);
      const back = sp > 1 ? Math.atan2(-p.vz, -p.vx) : Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw));
      if (this.huntPlace(back, 15)) { S.tp = 5; S.stuck = 0; S.lx = L.x; S.lz = L.z; this.mutantBurst = 0.3; Sfx.staticBurst(); Game.flickerPulse = 0.4; }
    }
    // помехи растут по мере приближения
    const kT = 0.1 + 0.9 * Math.pow(clamp((40 - dh) / 38, 0, 1), 1.3);
    this.mutantK += (kT - this.mutantK) * (1 - Math.exp(-dt * 4));
    // догнало
    if (dh < 1.9 && Math.abs(L.y - p.y) < 3) {
      S.phase = 1; S.ct = 0; this.mutantK = 1; this.mutantBurst = 0.9; Sfx.staticBurst(); Sfx.huntStop(0.35); Game.flickerPulse = 1.2;
      return;
    }
    if (S.t >= S.dur) this.huntEnd(false);
  }
});
