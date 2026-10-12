// ============================================================
//  Мутант: чёрное существо вдвое выше игрока, ночью стоит и наблюдает
// ============================================================
function sstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

Object.assign(Ents, {
  mutant: { active: false, x: 0, y: 0, z: 0, yaw: 0, t: 0, life: 0, seen: false, twitchV: 0, twT: 3, losT: 0, los: false },
  encounters: 0, mutantTimer: 40, mutantCool: 0, mutantK: 0, mutantBurst: 0, tvWarn: false, tvRolled: false, omenT: 0, omenSerious: 0, omenKind: '', omenCool: 0, dayProbe: 0, dayLoad: false, dayFog: 0, dayTry: 0,

  // ---- дневной режим: далеко (100+), прячется за деревом/блоками ----
  spawnDayMutant() {
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z;
    const viaWin = this.hasWin;
    for (let k = 0; k < (viaWin ? 200 : 90); k++) {
      let ang = Math.random() * PI2, dist = 100 + Math.random() * 16;
      if (viaWin) { const t = this.throughWindow(100, 116); if (!t) continue; ang = t.ang; dist = t.dist; }
      const x = Math.floor(ex - Math.sin(ang) * dist), z = Math.floor(ez - Math.cos(ang) * dist);
      if (!World.loaded(x, z)) continue;
      const y = World.topY(x, z) + 1;
      if (!OPQ[World.get(x, y - 1, z)] || isLiquid(World.get(x, y - 1, z)) || Math.abs(y - p.y) > 22) continue;
      let free = true;
      for (let h = 0; h < 4; h++) { const b = World.get(x, y + h, z); if (b && (SOLID[b] || isLiquid(b))) { free = false; break; } }
      if (!free) continue;
      const cx = x + 0.5, cz = z + 0.5;
      const dx = cx - ex, dz = cz - ez, dh = Math.hypot(dx, dz), nx = dx / dh, nz = dz / dh, px = -nz, pz = nx;
      // есть укрытие между игроком и существом, но часть тела видна
      let cover = false;
      for (let d = 0.8; d <= 3.2 && !cover; d += 0.6) for (let hh = 0.6; hh <= 2.6; hh += 0.6) {
        const b = World.get(Math.floor(cx - nx * d), Math.floor(y + hh), Math.floor(cz - nz * d));
        if (OPQ[b] || isLeafId(b)) { cover = true; break; }
      }
      if (!cover) continue;
      let vis = 0;
      for (const [o, hh] of [[0, 3.1], [0, 1.9], [0, 0.5], [0.3, 2.4], [-0.3, 2.4], [0.3, 1.0], [-0.3, 1.0]])
        if (this.lineClear(ex, ey, ez, cx + px * o, y + hh, cz + pz * o)) vis++;
      if (vis < 1 || vis > 4) continue;
      const L = this.mutant;
      Object.assign(L, { active: true, day: true, win: false, x: cx, y, z: cz, t: Math.random() * 100, life: 0, seen: false, twitchV: 0, twT: 4 + Math.random() * 4, losT: 0, los: false, scream: -1, back: false, A: 0, S: 0, snapT: 0, phase: 0, ph: 0 });
      L.yaw = Math.atan2(-(L.x - ex), -(L.z - ez));
      this.fig.active = false; this.encounters++;
      return true;
    }
    return false;
  },
  // прицел (центр экрана) наведён на тело существа, и между ними нет преград
  crosshairOnMutant() {
    const L = this.mutant, p = Player, ex = p.x, ey = p.y + EYE, ez = p.z, ld = lookDir();
    for (let h = 0; h <= 3.9; h += 0.15) {
      const ax = L.x - ex, ay = L.y + h - ey, az = L.z - ez;
      const t = ax * ld[0] + ay * ld[1] + az * ld[2];
      if (t < 0.5) continue;
      const rx = ld[0] * t, ry = ld[1] * t, rz = ld[2] * t;
      const w = h > 3.25 ? 0.24 : h > 1.9 ? 0.34 : 0.22;     // голова / торс и руки / ноги
      if (Math.hypot(ax - rx, ay - ry, az - rz) < w && this.lineClear(ex, ey, ez, ex + rx, ey + ry, ez + rz)) return true;
    }
    return false;
  },




  spawnMutant(opts = {}) {
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z;
    const viaWin = !opts.front && this.hasWin;      // игрок в доме: существо стоит вдалеке напротив окна
    for (let k = 0; k < (viaWin ? 150 : 60); k++) {
      let ang = opts.front ? p.yaw + (Math.random() - 0.5) * 0.25 : p.yaw + Math.PI + (Math.random() - 0.5) * Math.PI * 1.4;
      let dist = opts.dist || (22 + Math.random() * 12);
      if (viaWin) { const t = this.throughWindow(22, 34); if (!t) continue; ang = t.ang; dist = t.dist; }
      const x = Math.floor(ex - Math.sin(ang) * dist), z = Math.floor(ez - Math.cos(ang) * dist);
      if (!World.loaded(x, z)) continue;
      const y = World.topY(x, z) + 1;
      if (!OPQ[World.get(x, y - 1, z)] || Math.abs(y - p.y) > 14) continue;
      let free = true;
      for (let h = 0; h < 4; h++) { const b = World.get(x, y + h, z); if (b && (SOLID[b] || isLiquid(b))) { free = false; break; } }
      if (!free) continue;
      if (!opts.front && !this.lineClear(ex, ey, ez, x + 0.5, y + 3.1, z + 0.5) && !(viaWin && (this.lineClear(ex, ey, ez, x + 0.5, y + 1.7, z + 0.5) || this.lineClear(ex, ey, ez, x + 0.5, y + 0.8, z + 0.5)))) continue;
      const L = this.mutant;
      Object.assign(L, { active: true, day: false, win: false, gp: 0, gt: 0, lookT: 0, grinRolled: false, grinForce: false, scream: -1, x: x + 0.5, y, z: z + 0.5, t: Math.random() * 100, life: 0, seen: false, twitchV: 0, twT: 2 + Math.random() * 4, losT: 0, los: false });
      L.yaw = Math.atan2(-(L.x - ex), -(L.z - ez));
      L.A = 0; L.S = 0; L.snapT = 0; L.phase = 0; L.ph = 0;
      L.back = !opts.front && this.encounters >= 1 && Math.random() < 0.4;   // повторное появление: стоит спиной
      if (opts.mode === 'calm') { L.back = false; L.grinRolled = true; }        // под спокойный трек — просто наблюдает
      else if (opts.mode === 'serious') {                                     // под «Dead Hill» — делает что-то страшное
        if (Math.random() < 0.6) L.back = true; else { L.back = false; L.grinForce = true; }
      }
      if (L.back) L.yaw += Math.PI;
      this.encounters++;
      this.fig.active = false;
      return true;
    }
    return false;
  },
  // ---------- в доме: стук в дверь, затем существо стоит снаружи у окна ----------
  indoor: null, inHouse: false, hasWin: false, houseChk: 0, indoorChk: 0, indoorStay: 0, indoorT: 25,
  // игрок под крышей и окружён стенами (стена/дверь/стекло) — «в доме»
  isIndoors() {
    const p = Player, ex = p.x, ez = p.z;
    let roof = false;
    for (let h = 2; h <= 10 && !roof; h++) { const b = World.get(Math.floor(ex), Math.floor(p.y + h), Math.floor(ez)); if (OPQ[b] || LOSB[b]) roof = true; }
    if (!roof) return false;
    let hit = 0;
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * PI2, dx = Math.cos(a), dz = Math.sin(a);
      for (let d = 0.6; d <= 12; d += 0.5) {
        const b = World.get(Math.floor(ex + dx * d), Math.floor(p.y + 1.2), Math.floor(ez + dz * d));
        if (OPQ[b] || LOSB[b] || b === B.GLASS || b === B.PANE) { hit++; break; }
      }
    }
    return hit >= 10;
  },
  // ближайшая закрытая дверь: { kind, x, y, z } — стучать будут в неё
  findDoor() {
    const p = Player, px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 3; dy++) for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) {
      const id = World.get(px + dx, py + dy, pz + dz), di = DOORINFO[id];
      if (!di || di.half || di.open) continue;
      const d = dx * dx + dz * dz + dy * dy; if (d < bd) { bd = d; best = { kind: di.mat, x: px + dx + 0.5, y: py + dy + 1, z: pz + dz + 0.5 }; }
    }
    return best;
  },
  // луч глаз → точка: чист ли он и проходит ли через стекло / панель
  viaGlass(ex, ey, ez, tx, ty, tz) {
    const dx = tx - ex, dy = ty - ey, dz = tz - ez, n = Math.ceil(Math.hypot(dx, dy, dz) * 3);
    let glass = false;
    for (let i = 1; i < n; i++) {
      const t = i / n, b = World.get(Math.floor(ex + dx * t), Math.floor(ey + dy * t), Math.floor(ez + dz * t));
      if (OPQ[b] || LOSB[b] || isLeafId(b)) return 0;
      if (b === B.GLASS || b === B.PANE) glass = true;
    }
    return glass ? 2 : 1;
  },
  // окна рядом с игроком: стекло / панель, у которых с одной стороны комната, с другой — улица
  windows() {
    const p = Player, px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z), out = [];
    for (let dy = -2; dy <= 4; dy++) for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) {
      const wx = px + dx, wy = py + dy, wz = pz + dz, id = World.get(wx, wy, wz);
      if (id !== B.GLASS && id !== B.PANE) continue;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (SOLID[World.get(wx - ox, wy, wz - oz)] || SOLID[World.get(wx + ox, wy, wz + oz)]) continue;
        if ((p.x - (wx + 0.5)) * ox + (p.z - (wz + 0.5)) * oz > -0.2) continue;
        out.push({ wx, wy, wz, ox, oz });
      }
    }
    return out;
  },
  // точка снаружи (угол и расстояние), где взгляд из случайного окна упирается в тело существа
  throughWindow(dmin, dmax) {
    if (!this._wc || Game.time - this._wt > 1) { this._wc = this.windows(); this._wt = Game.time; }
    const W = this._wc; if (!W.length) return null;
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z, w = W[Math.floor(Math.random() * W.length)];
    const dx = w.wx + 0.1 + Math.random() * 0.8 - ex, dy = w.wy + 0.1 + Math.random() * 0.8 - ey, dz = w.wz + 0.1 + Math.random() * 0.8 - ez, hl = Math.hypot(dx, dz);
    if (hl < 0.3) return null;
    const span = Math.floor(dmax - dmin) + 1, off = Math.floor(Math.random() * span);
    for (let i = 0; i < span; i++) {
      const D = dmin + ((i + off) % span), sc = D / hl, px = ex + dx * sc, py = ey + dy * sc, pz = ez + dz * sc;
      if (!World.loaded(Math.floor(px), Math.floor(pz))) continue;
      const g = World.topY(Math.floor(px), Math.floor(pz)) + 1;
      if (py > g + 0.3 && py < g + 3.0) return { ang: Math.atan2(-(px - ex), -(pz - ez)), dist: D };
    }
    return null;
  },
  // направление (угол) из дома наружу сквозь случайное окно
  winAng() {
    if (!this._wc || Game.time - this._wt > 1) { this._wc = this.windows(); this._wt = Game.time; }
    const W = this._wc; if (!W.length) return null;
    const w = W[Math.floor(Math.random() * W.length)];
    return Math.atan2(-(w.wx + 0.5 - Player.x), -(w.wz + 0.5 - Player.z));
  },
  // подходящее место снаружи, видимое из комнаты через окно (стекло или панель)
  findWindowSpot() {
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z, px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z), ld = lookDir();
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = null, bs = -1e9;
    for (let dy = -2; dy <= 4; dy++) for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) {
      const wx = px + dx, wy = py + dy, wz = pz + dz, id = World.get(wx, wy, wz);
      if (id !== B.GLASS && id !== B.PANE) continue;
      for (const [ox, oz] of DIRS) {
        // сторона игрока должна быть внутри (пустая клетка), противоположная — снаружи
        if (SOLID[World.get(wx - ox, wy, wz - oz)] || SOLID[World.get(wx + ox, wy, wz + oz)]) continue;
        if ((ex - (wx + 0.5)) * ox + (ez - (wz + 0.5)) * oz > -0.2) continue;   // игрок должен быть с внутренней стороны окна
        for (let k = 2; k <= 4; k++) {
          const x = wx + ox * k, z = wz + oz * k;
          if (!World.loaded(x, z)) continue;
          const y = World.topY(x, z) + 1;
          if (Math.abs(y - p.y) > 5 || !OPQ[World.get(x, y - 1, z)] || isLiquid(World.get(x, y - 1, z))) continue;
          let free = true;
          for (let h = 0; h < 4; h++) { const b = World.get(x, y + h, z); if (b && (SOLID[b] || isLiquid(b))) { free = false; break; } }
          if (!free) continue;
          const cx = x + 0.5, cz = z + 0.5, dist = Math.hypot(cx - ex, cz - ez);
          if (dist < 3 || dist > 13) continue;
          const v1 = this.viaGlass(ex, ey, ez, cx, y + 3.0, cz), v2 = this.viaGlass(ex, ey, ez, cx, y + 1.7, cz);
          if (!v1 && !v2) continue;
          if (v1 !== 2 && v2 !== 2) continue;            // видно именно сквозь стекло
          const hx = cx - ex, hy = y + 2.2 - ey, hz = cz - ez, hl = Math.hypot(hx, hy, hz);
          const cosA = (ld[0] * hx + ld[1] * hy + ld[2] * hz) / hl;
          if (cosA < 0.1) continue;
          const sc = cosA * 2.2 - dist * 0.06 + (v1 && v2 ? 0.5 : 0) + Math.random() * 0.4;
          if (sc > bs) { bs = sc; best = { x: cx, y, z: cz }; }
        }
      }
    }
    return best;
  },
  spawnAtSpot(sp) {
    const p = Player, L = this.mutant;
    Object.assign(L, { active: true, day: false, win: true, back: false, scream: -1, x: sp.x, y: sp.y, z: sp.z, t: Math.random() * 100, life: 0, seen: false, seenT: 0, twitchV: 0, twT: 2 + Math.random() * 4, losT: 0, los: false, A: 0, S: 0, snapT: 0, phase: 0, ph: 0 });
    L.yaw = Math.atan2(-(L.x - p.x), -(L.z - p.z));
    this.encounters++; this.fig.active = false;
    return true;
  },
  // шаг сценария «в доме»; true — пока идёт стук / ожидание появления
  indoorStep(dt, night) {
    const p = Player, S = this.indoor;
    this.indoorChk -= dt;
    if (this.indoorChk <= 0) { this.indoorChk = 0.7; this.inHouse = this.isIndoors(); }
    if (S) {
      S.t += dt;
      if (!this.inHouse || p.eyeInWater) { this.indoor = null; return false; }
      if (S.t < S.pre) return true;                      // сначала телевизор предупреждает помехами
      if (!S.knocked) {
        S.knocked = true; S.dur = 0; Game.flickerPulse = 0.5;
        if (S.door) {
          const dx = S.door.x - p.x, dz = S.door.z - p.z, dd = Math.hypot(dx, dz);
          const right = Math.cos(p.yaw), rz = -Math.sin(p.yaw);   // вектор «вправо» от взгляда
          S.dur = Sfx.knock(S.door.kind, clamp(1.1 - dd * 0.04, 0.35, 1), clamp((dx * right + dz * rz) / Math.max(dd, 1), -0.9, 0.9));
        }
      }
      if (S.t - S.pre >= S.dur + 1.3 + (S.door ? 0 : 3)) {
        this.indoor = null;
        const sp = this.findWindowSpot();
        if (sp) this.spawnAtSpot(sp); else this.mutantCool = 30;
      }
      return true;
    }
    if (!this.inHouse) { this.indoorStay = 0; return false; }
    this.indoorStay += dt;
    if (this.indoorStay < 12) return false;
    this.indoorT -= dt; if (this.indoorT > 0) return false;
    this.indoorT = night > 0.5 ? 35 + Math.random() * 45 : 60 + Math.random() * 70;
    if (Math.random() > (night > 0.5 ? 0.6 : 0.3)) return false;
    if (!this.findWindowSpot()) return false;
    const music = this.encounters >= 1 && (Sfx.omen3Ready() && Math.random() < 0.6 ? Sfx.omen3() : Sfx.omen2());
    this.indoor = { t: 0, pre: music ? 26 + Math.random() * 8 : 8 + Math.random() * 5, door: this.findDoor(), knocked: false, dur: 0 };
    return true;
  },
  // ---------- лицо в окне: игрок долго смотрит в окно ночью, а существо уже появлялось раньше ----------
  peekS: null, gazeT: 0, gazeWin: null, gazeRolled: false, gazeLost: 0, peekCool: 0, _pw: [], _pwT: -9,
  // окно, на которое смотрит игрок: { wx, wy, wz, ox, oz } или null
  gazedWindow() {
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z, ld = lookDir();
    if (Game.time - this._pwT > 0.5) { this._pw = this.windows(); this._pwT = Game.time; }
    let best = null, bc = 0.955;
    for (const w of this._pw) {
      const dx = w.wx + 0.5 - ex, dy = w.wy + 0.5 - ey, dz = w.wz + 0.5 - ez, d = Math.hypot(dx, dy, dz);
      if (d < 0.8 || d > 11) continue;
      const c = (ld[0] * dx + ld[1] * dy + ld[2] * dz) / d;
      if (c > bc) { bc = c; best = w; }
    }
    return best;
  },
  updateGaze(dt, night) {
    const p = Player;
    this.peekCool -= dt;
    const ok = this.inHouse && night >= 0.6 && this.encounters >= 1 && !p.eyeInWater && !this.indoor && !this.glitchS && !Sfx.eventPlaying() && this.peekCool <= 0 && this.mutantCool <= 0;
    const w = ok ? this.gazedWindow() : null;
    if (!w) { this.gazeLost += dt; if (this.gazeLost > 0.5) { this.gazeT = 0; this.gazeWin = null; this.gazeRolled = false; } return; }
    this.gazeLost = 0;
    // тот же ли это оконный проём (соседние клетки считаются одним окном)
    if (!this.gazeWin || Math.abs(this.gazeWin.wx - w.wx) + Math.abs(this.gazeWin.wy - w.wy) + Math.abs(this.gazeWin.wz - w.wz) > 3) { this.gazeWin = w; this.gazeT = 0; this.gazeRolled = false; }
    else this.gazeWin = w;
    this.gazeT += dt;
    if (this.gazeT > 5 && !this.gazeRolled) {
      this.gazeRolled = true;
      if (Math.random() < 0.5) this.startPeek(w);
    }
  },
  startPeek(w) {
    const p = Player, L = this.mutant;
    // голова — вплотную за стеклом, тело уходит вниз (за подоконник / в землю)
    const x = w.wx + 0.5 + w.ox * 1.25, z = w.wz + 0.5 + w.oz * 1.25, y = w.wy + 0.5 - 3.2;
    Object.assign(L, { active: true, day: false, win: false, back: false, peek: true, scream: -1, x, y, z, t: Math.random() * 100, life: 0, seen: true, seenT: 0, twitchV: 0, twT: 9, losT: 0, los: true, A: 0, S: 0, snapT: 0, phase: 0, ph: 0 });
    L.yaw = Math.atan2(-(x - p.x), -(z - p.z));
    this.fig.active = false; this.encounters++;
    this.peekS = { t: 0, fx: w.wx + 0.5 + w.ox * 0.75, fy: w.wy + 0.5, fz: w.wz + 0.5 + w.oz * 0.75 };
    this.gazeT = 0; this.gazeRolled = true;
    this.mutantBurst = 0.45; Sfx.staticBurst(); Sfx.scream2(); Game.flickerPulse = 1.5;
  },
  updatePeek(dt) {
    const S = this.peekS, L = this.mutant; S.t += dt; L.t += dt; L.life += dt; L.snapT += dt;
    // помехи нарастают очень быстро, к 3-й секунде отпускают разом
    if (S.t < 3) {
      const target = S.t < 0.3 ? 0.5 : S.t < 1.0 ? 0.85 : 1;
      this.mutantK += (target - this.mutantK) * (1 - Math.exp(-dt * 9));
      if (S.t > 2.0 && L.active) L.active = false;          // существо исчезает, пока экран в помехах
    } else {
      this.mutantK = Math.max(0, this.mutantK - dt * 6);   // «отпускает»
      if (S.t > 3.4) { this.mutantK = 0; this.peekS = null; L.peek = false; L.active = false; this.mutantCool = 120 + Math.random() * 120; this.peekCool = 90 + Math.random() * 90; }
    }
  },
  // ---------- «долгая ночь»: после первой встречи в ночном лесу существо внезапно появляется прямо перед игроком ----------
  caveBlip: 0, smexCool: 120, deepOn: false, deepChk: 0, deepK: 0,
  // игрок в еловой чаще: всё, что связано с существом, здесь происходит гораздо чаще
  updateDeep(dt) {
    this.deepChk -= dt;
    if (this.deepChk <= 0) {
      this.deepChk = 0.8;
      const p = Player, x = Math.floor(p.x), z = Math.floor(p.z), h = World.gen.height(x, z);
      this.deepOn = p.y > h - 3 && World.gen.biome(x, z, h) === BIOME.SPRUCE;
    }
    this.deepK += ((this.deepOn ? 1 : 0) - this.deepK) * (1 - Math.exp(-dt * 0.4));
  },
  skyOk(thr) { return this.deepOn || Game.eyeSky > thr; },
  dreadS: null, dreadK: 0, dreadTarget: 0, dreadCool: 120, forestT: 0, forestChk: 0, forest: false, dreadRoll: 0,
  isForest() {
    const p = Player, x = Math.floor(p.x), z = Math.floor(p.z), h = World.gen.height(x, z);
    const bi = World.gen.biome(x, z, h);
    return (bi === BIOME.FOREST || bi === BIOME.SPRUCE) && p.y > h - 3;
  },
  updateDreadTrigger(dt, night) {
    const p = Player, L = this.mutant;
    this.dreadCool -= dt;
    this.forestChk -= dt;
    if (this.forestChk <= 0) { this.forestChk = 1; this.forest = this.encounters >= 1 && night >= 0.8 && this.isForest(); }
    const ok = this.forest && !this.inHouse && this.skyOk(0.5) && !p.eyeInWater && !p.flying && !this.indoor && this.dreadCool <= 0 && !this.glitchS && !this.huntS && this.mutantCool <= 0 && !L.active && !this.peekS && Sfx.dreadReady();
    if (!ok || Math.hypot(p.vx, p.vz) < 1.5) { if (!ok) this.forestT = 0; return; }
    this.forestT += dt;
    if (this.forestT < (this.deepOn ? 9 : 25)) return;
    this.dreadRoll -= dt;
    if (this.dreadRoll > 0) return;
    this.dreadRoll = 6;
    if (Math.random() < (this.deepOn ? 0.16 : 0.08)) this.startDread();
  },
  startDread() {
    const p = Player, L = this.mutant, ex = p.x, ey = p.y + EYE, ez = p.z;
    for (let k = 0; k < 40; k++) {
      const ang = p.yaw + (Math.random() - 0.5) * 0.5, dist = 4 + Math.random() * 2;
      const x = Math.floor(ex - Math.sin(ang) * dist), z = Math.floor(ez - Math.cos(ang) * dist);
      if (!World.loaded(x, z)) continue;
      const y = World.topY(x, z) + 1;
      if (!OPQ[World.get(x, y - 1, z)] || isLiquid(World.get(x, y - 1, z)) || Math.abs(y - p.y) > 2.5) continue;
      let free = true;
      for (let h = 0; h < 4; h++) { const b = World.get(x, y + h, z); if (b && (SOLID[b] || isLiquid(b)) && !isLeafId(b)) { free = false; break; } }
      if (!free || !(this.deepOn || this.lineClear(ex, ey, ez, x + 0.5, y + 3.0, z + 0.5))) continue;
      const d = Sfx.dread(); if (!d) return false;
      Object.assign(L, { active: true, day: false, win: false, back: false, peek: false, gp: 0, scream: -1, x: x + 0.5, y, z: z + 0.5, t: Math.random() * 100, life: 0, seen: true, seenT: 0, twitchV: 0, twT: 9, losT: 0, los: true, A: 0, S: 0, snapT: 0, phase: 0, ph: 0 });
      L.yaw = Math.atan2(-(L.x - ex), -(L.z - ez));
      this.fig.active = false; this.encounters++;
      this.dreadS = { t: 0, dur: d };
      this.mutantK = 1; this.mutantBurst = 0.6; Sfx.staticBurst(); Game.flickerPulse = 1.5;
      this.forestT = 0;
      return true;
    }
    this.forestT = 12;
    return false;
  },
  updateDread(dt) {
    const S = this.dreadS, L = this.mutant, p = Player; S.t += dt;
    if (L.active) {
      L.t += dt; L.life += dt; L.yaw = Math.atan2(-(L.x - p.x), -(L.z - p.z));
      this.mutantK = 1;                                       // максимальные помехи сразу
      if (S.t > 2.8) L.active = false;                        // существо пропадает, пока экран в помехах
    } else this.mutantK = Math.max(0, this.mutantK - dt * 0.4);
    this.dreadTarget = S.t < S.dur - 4 ? 1 : 0;               // ночь остаётся тёмной ровно пока играет звук
    if (S.t >= S.dur) { this.dreadS = null; this.dreadTarget = 0; L.active = false; this.mutantK = 0; this.mutantCool = 150 + Math.random() * 100; this.dreadCool = (500 + Math.random() * 400) * (this.deepOn ? 0.4 : 1); }
  },
  // иногда перед появлением тихо включается музыка, а существо приходит через ~25 секунд
  maybeOmen(kind) {
    if (this.encounters >= 1) {                       // после первой встречи — всегда второй трек (первый больше не звучит)
      if (Sfx.omen2Playing() || Sfx.omen3Playing()) return false;   // музыка уже идёт: существо приходит без дополнительной задержки
      // треки чередуются: «Dead Hill» — существо настроено серьёзно и готово напугать, второй — оно просто наблюдает
      const serious = kind === 'night' && Sfx.omen3Ready() && Math.random() < 0.5;
      if (!(serious ? Sfx.omen3() : Sfx.omen2())) return false;
      this.omenSerious = serious ? 1 : 0;
      this.omenT = 28 + Math.random() * 12; this.omenKind = kind; return true;
    }
    if (kind === 'night') return false;               // самое первое появление ночью — всегда без музыки
    if (this.omenCool > 0 || Math.random() > (this.deepOn ? 0.7 : 0.3) || !Sfx.omen()) return false;
    this.omenT = 24 + Math.random() * 8; this.omenKind = kind; this.omenCool = 600 + Math.random() * 300;
    return true;
  },
  vanishMutant(loud) {
    const wasDay = this.mutant.day;
    this.mutant.active = false; this.mutantK = 0; this.mutant.scream = -1; this.mutant.gp = 0;
    this.mutantCool = (wasDay ? 200 : 120) + Math.random() * 150;
    if (loud) { this.mutantBurst = 0.6; Sfx.staticBurst(); Game.flickerPulse = 0.7; }
  },
  updateMutant(dt) {
    const L = this.mutant, p = Player;
    this.mutantBurst = Math.max(0, this.mutantBurst - dt);
    this.updateDeep(dt);
    if (L.active && !L.day) this.nightEnc = true;     // ночная встреча уже была
    // редкий звук «smex» днём или ночью — только когда ничего другого не происходит
    this.smexCool -= dt;
    if (this.nightEnc && this.smexCool <= 0 && Game.settings.mutant && !p.dead && !L.active && !this.huntS && !this.dreadS && !this.runS && !this.hellS && !this.glitchS && !this.peekS && !this.indoor && Sfx.smexReady()) {
      this.smexCool = 30;
      if (Math.random() < 0.05) { Sfx.smex(); this.smexCool = 240 + Math.random() * 360; }
    }
    if (this.caveBlip > 0) this.caveBlip = Math.max(0, this.caveBlip - dt);
    this.updateGlitch(dt, !!Game.settings.mutant && !p.dead && !this.dreadS && !this.huntS && !this.runS && !this.hellS && !this.peekS && !L.active && !this.indoor && !this.inHouse && this.skyOk(0.5) && !p.eyeInWater && !p.flying);
    if (!Game.settings.mutant || p.dead) { if (this.huntS) this.huntEnd(true); if (this.runS) this.endRun(); if (this.hellS) this.endHell(); L.active = false; this.mutantK = 0; return; }
    const night = Game.env.night;
    this.houseChk -= dt;
    if (this.houseChk <= 0) { this.houseChk = 1.2; this.inHouse = this.isIndoors(); this.hasWin = this.inHouse && this.windows().length > 0; }
    // плавное расширение дальности/тумана для дневного режима
    this.dayFog += (((L.active && L.day) || this.dayProbe > 0 ? 1 : 0) - this.dayFog) * (1 - Math.exp(-dt * 0.6));
    this.dayLoad = this.dayProbe > 0 || (L.active && L.day);
    this.omenCool -= dt;
    this.huntK += ((this.huntS ? 1 : 0) - this.huntK) * (1 - Math.exp(-dt * 0.8));
    if (this.huntS) { this.updateHunt(dt); return; }
    if (this.runS) { this.updateRun(dt); return; }
    if (this.hellS) { this.updateHell(dt); return; }
    if (!this.dreadS) this.dreadTarget = 0;
    this.dreadK += (this.dreadTarget - this.dreadK) * (1 - Math.exp(-dt * 0.9));
    if (this.dreadS) { this.updateDread(dt); return; }
    if (this.peekS) { this.updatePeek(dt); return; }
    if (!L.active) { this.updateGaze(dt, night); this.updateDreadTrigger(dt, night); this.updateHuntTrigger(dt, night); this.updateRunTrigger(dt, night); this.updateHellTrigger(dt, night); }
    if (!L.active) {
      this.mutantK = 0;
      // пока звучит трек события (или идёт «сбой мира»), обычные встречи и их музыка ждут
      if (this.glitchS || Sfx.eventPlaying()) { this.omenT = 0; this.tvWarn = false; this.tvRolled = false; if (this.indoor) this.indoor = null; return; }
      if (this.omenT > 0) {
        this.omenT -= dt;
        if (this.omenT <= 0) {
          if (this.omenKind === 'night' && night >= 0.5 && !p.eyeInWater) this.spawnMutant({ mode: this.omenSerious ? 'serious' : 'calm' });
          else if (this.omenKind === 'day' && night < 0.2 && !p.eyeInWater) { this.dayProbe = 30; this.dayTry = 0; }
        }
        return;
      }
      if (this.dayProbe > 0) {
        this.dayProbe -= dt; this.dayTry -= dt;
        if (night > 0.2 || p.eyeInWater) this.dayProbe = 0;
        else if (this.dayTry <= 0) { this.dayTry = 0.6; if (this.spawnDayMutant()) this.dayProbe = 0; }
        return;
      }
      if (this.mutantCool > 0) { this.mutantCool -= dt * (this.deepOn ? 2.2 : 1); return; }
      if (this.indoorStep(dt, night)) return;
      if (night >= 0.7) {
        this.mutantTimer -= dt * (this.deepOn ? 2.4 : 1);
        if (this.mutantTimer <= 12 && !this.tvRolled) {           // решение принимается заранее — телевизор «чувствует» его
          this.tvRolled = true;
          const eyeSky = World.light(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z)) >> 4;
          this.tvWarn = (eyeSky >= 8 || this.hasWin || this.deepOn) && !p.eyeInWater && !this.fig.active && Math.random() < (this.deepOn ? 0.55 : 0.22);
        }
        if (this.mutantTimer > 0) return;
        this.mutantTimer = 30 + Math.random() * 35; this.tvRolled = false;
        if (this.tvWarn) { this.tvWarn = false; if (!this.maybeOmen('night')) this.spawnMutant(); }
      } else if (night < 0.1) {
        this.mutantTimer -= dt;
        if (this.mutantTimer <= 12 && !this.tvRolled) {
          this.tvRolled = true;
          const eyeSky = World.light(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z)) >> 4;
          this.tvWarn = (eyeSky >= 10 || this.hasWin) && !p.eyeInWater && !this.fig.active && Math.random() < 0.25;
        }
        if (this.mutantTimer > 0) return;
        this.mutantTimer = 35 + Math.random() * 40; this.tvRolled = false;
        if (this.tvWarn) { this.tvWarn = false; if (!this.maybeOmen('day')) { this.dayProbe = 30; this.dayTry = 4; } }
      } else this.tvWarn = false;
      return;
    }
    L.t += dt; L.life += dt;
    const ex = p.x, ey = p.y + EYE, ez = p.z;
    const dx = L.x - ex, dz = L.z - ez, dh = Math.hypot(dx, dz);
    const hy = L.y + 3.1 - ey, d = Math.hypot(dx, hy, dz);
    // подошёл вплотную — исчезает с помехами
    if (L.back) { this.updateBack(dt, dh, night); return; }
    if (L.gp) { this.updateGrin(dt, dx, dz); return; }
    if (dh <= (L.day ? 1.2 : 3)) { this.vanishMutant(!L.day); return; }
    if (L.day) {
      // крик играет один раз; когда закончился — существо пропадает
      if (L.scream >= 0) { L.scream -= dt; if (L.scream <= 0) this.vanishMutant(false); return this.mutantK = 0; }
      if (night > 0.5 || L.life > 240 || dh > 150) { this.vanishMutant(false); return; }
      L.t += 0; this.mutantK = 0;
      L.losT -= dt; if (L.losT <= 0) { L.losT = 0.2; L.los = true; }
      if (this.crosshairOnMutant()) { L.scream = Sfx.scream() + 0.05; Game.flickerPulse = 0; }
      return;
    }
    if (L.win) {   // у окна: пропадает, если игрок вышел из дома, долго смотрит на него или просто время вышло
      this.indoorChk -= dt; if (this.indoorChk <= 0) { this.indoorChk = 0.7; this.inHouse = this.isIndoors(); }
      if (L.seen && L.los) L.seenT += dt;
      if (!this.inHouse || L.life > 45 || L.seenT > 7) { this.vanishMutant(L.seenT > 7); return; }
    } else if (night < 0.25 || L.life > 300 || dh > 96) { this.vanishMutant(false); return; }
    L.losT -= dt;
    if (L.losT <= 0) { L.losT = 0.2; L.los = this.lineClear(ex, ey, ez, L.x, L.y + 3.0, L.z) || this.lineClear(ex, ey, ez, L.x, L.y + 1.4, L.z); }
    const ld = lookDir();
    const cosA = (ld[0] * dx + ld[1] * hy + ld[2] * dz) / d;
    const lookF = L.los ? sstep(0.84, 0.995, cosA) : 0;
    // медленно поворачивается следом; когда на него не смотрят — уже смотрит на игрока
    const target = Math.atan2(-dx, -dz);
    let da = target - L.yaw; da = ((da + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
    if (cosA < 0.3) L.yaw = target; else L.yaw += clamp(da, -0.45 * dt, 0.45 * dt);
    L.twT -= dt;
    if (L.twT <= 0) { L.twT = 1.5 + Math.random() * 6; L.twitchV = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.35); }
    L.twitchV *= Math.exp(-dt * 4);
    if (!L.seen && lookF > 0.5 && d < 64) { L.seen = true; Sfx.sting(); }
    // помехи растут по мере приближения: слабые с ~40 блоков, максимум у самого существа
    const prox = clamp((40 - dh) / (40 - 3), 0, 1);
    const kT = Math.min(1, Math.pow(prox, 1.35) * (0.88 + 0.12 * lookF)) * (L.win ? 0.45 : 1);
    this.mutantK += (kT - this.mutantK) * (1 - Math.exp(-dt * 5));
    // редкий шанс: пока игрок смотрит на существо сквозь помехи, у него загораются глаза и рот
    if (!L.win && !L.grinRolled) {
      L.lookT = (L.lookT || 0) + (lookF > 0.6 && this.mutantK > 0.2 ? dt : 0);
      if (L.lookT > 1.5) { L.grinRolled = true; if (L.grinForce || Math.random() < (this.deepOn ? 0.35 : 0.15)) { L.gp = 1; L.gt = 0; } }
    }
  },
  // редкое событие: глаза и рот загораются, затем — улыбка со звуком; после звука помехи усиливаются и существо исчезает
  updateGrin(dt, dx, dz) {
    const L = this.mutant; L.gt += dt;
    L.yaw = Math.atan2(-dx, -dz);
    if (L.gp === 1) {
      this.mutantK += (Math.max(0.45, this.mutantK) - this.mutantK) * (1 - Math.exp(-dt * 4));
      if (L.gt >= 1.3) { L.gp = 2; L.gt = 0; L.gdur = Math.max(1.5, Sfx.smile()); Game.flickerPulse = 0.12; this.mutantBurst = 0.12; }
    } else if (L.gp === 2) {
      this.mutantK += (0.35 - this.mutantK) * (1 - Math.exp(-dt * 5));
      if (L.gt >= L.gdur) { L.gp = 3; L.gt = 0; }
    } else {
      this.mutantK += (1 - this.mutantK) * (1 - Math.exp(-dt * 7));
      if (L.gt > 0.7 && L.gt < 1.6) { /* существо ещё стоит, но экран почти целиком в помехах */ }
      if (L.gt >= 1.7) { L.gp = 0; this.vanishMutant(true); }
    }
  },
  // «стоит спиной»: без помех, пока игрок не подойдёт на 5 блоков — тогда мостик, четыре конечности, поворот головы, крик, 5 с помех
  updateBack(dt, dh, night) {
    const L = this.mutant;
    if (L.phase === 0) {
      this.mutantK = 0; L.A = 0; L.S = 0;
      if (night < 0.25 || L.life > 300 || dh > 96) { this.vanishMutant(false); return; }
      if (dh <= 5) { L.phase = 1; L.ph = 0; }
      return;
    }
    L.ph += dt;
    if (L.phase === 1) {                          // выгибается на мостик
      const u = clamp(L.ph / 1.7, 0, 1); L.A = u * u * (3 - 2 * u);
      if (L.ph >= 1.7) { L.phase = 2; L.ph = 0; L.A = 1; }
    } else if (L.phase === 2) {                   // замер на четырёх конечностях
      if (L.ph >= 0.55) { L.phase = 3; L.ph = 0; L.S = 1; L.snapT = 0; L.dur = Sfx.scream2() + 0.05; Game.flickerPulse = 0; }
    } else if (L.phase === 3) {                   // резкий поворот головы + звук
      L.snapT += dt;
      if (L.ph >= L.dur) { L.phase = 4; L.ph = 0; }
    } else {                                      // весь экран в помехах 5 секунд, затем резко всё обрывается
      L.snapT += dt;
      this.mutantK += (1 - this.mutantK) * (1 - Math.exp(-dt * 14));
      if (L.ph >= 5) this.vanishMutant(false);
    }
  },
  // ---------- «отражение»: существо видно только в воде рядом с игроком ----------
  ghost: { active: false, x: 0, y: 0, z: 0, yaw: 0, t: 0, A: 0, S: 0, snapT: 0, twitchV: 0, life: 0 },
  ghostLook: 0, ghostRolled: false, ghostCool: 40,
  // игрок смотрит вниз на воду так, что в ней видно отражение; возвращает точку на воде или null
  waterLook() {
    const p = Player, wy = SEA + 0.875, ey = p.y + EYE, ld = lookDir();
    if (!Game.settings.refl || p.eyeInWater || ey < wy + 0.4 || ld[1] > -0.4) return null;
    const t = (ey - wy) / -ld[1], hx = p.x + ld[0] * t, hz = p.z + ld[2] * t;
    if (Math.hypot(hx - p.x, hz - p.z) > 9) return null;
    if (!isLiquid(World.get(Math.floor(hx), Math.floor(wy - 0.2), Math.floor(hz)))) return null;
    return [hx, wy, hz];
  },
  // видна ли точка (x,y,z) в отражении: отражённая точка попадает в кадр, а луч пересекает воду
  inMirror(x, y, z, margin = 0.9) {
    const p = Player, wy = SEA + 0.875, ey = p.y + EYE;
    const my = 2 * wy - y, c = m4xv(Rend.VP, x - p.x, my - ey, z - p.z, 1);
    if (c[3] <= 0.05 || Math.abs(c[0] / c[3]) > margin || Math.abs(c[1] / c[3]) > margin) return false;
    const t = (ey - wy) / (ey - my), wx = p.x + (x - p.x) * t, wz = p.z + (z - p.z) * t;
    return isLiquid(World.get(Math.floor(wx), Math.floor(wy - 0.2), Math.floor(wz)));
  },
  spawnGhost() {
    const p = Player, G = this.ghost, yaw = p.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    for (let k = 0; k < 140; k++) {
      const side = Math.random() < 0.5 ? -1 : 1, sd = 1.2 + Math.random() * 1.8, fw = -0.5 + Math.random() * Math.random() * 9.5;
      const x = Math.floor(p.x + rx * side * sd + fx * fw), z = Math.floor(p.z + rz * side * sd + fz * fw);
      if (!World.loaded(x, z)) continue;
      const y = World.topY(x, z) + 1;
      if (Math.abs(y - p.y) > 1.6 || !OPQ[World.get(x, y - 1, z)] || isLiquid(World.get(x, y - 1, z))) continue;
      let free = true;
      for (let h = 0; h < 4; h++) { const b = World.get(x, y + h, z); if (b && (SOLID[b] || isLiquid(b))) { free = false; break; } }
      if (!free) continue;
      if (!this.inMirror(x + 0.5, y + 1.9, z + 0.5, 0.8)) continue;
      Object.assign(G, { active: true, x: x + 0.5, y, z: z + 0.5, t: Math.random() * 100, A: 0, S: 0, snapT: 0, twitchV: 0, life: 0 });
      G.yaw = Math.atan2(-(G.x - p.x), -(G.z - p.z));
      return true;
    }
    return false;
  },
  updateGhost(dt) {
    const G = this.ghost, p = Player;
    if (!Game.settings.mutant || p.dead) { G.active = false; return; }
    const look = this.waterLook();
    if (G.active) {
      G.t += dt; G.life += dt;
      // стоит на месте, едва заметно поворачивая голову к игроку
      const want = Math.atan2(-(G.x - p.x), -(G.z - p.z)); let da = want - G.yaw; da = ((da + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
      G.yaw += clamp(da, -0.5 * dt, 0.5 * dt);
      // оторвал взгляд от отражения — существо пропало
      if (!look || G.life > 40 || !this.inMirror(G.x, G.y + 1.9, G.z, 1.15) || p.eyeInWater) {
        G.active = false; this.ghostCool = 45 + Math.random() * 60; this.ghostLook = 0; this.ghostRolled = true;
      }
      return;
    }
    if (!look) { this.ghostLook = 0; this.ghostRolled = false; return; }
    this.ghostCool -= dt;
    this.ghostLook += dt;
    if (this.ghostLook > 1.4 && !this.ghostRolled && this.ghostCool <= 0) {
      this.ghostRolled = true;
      if (Math.random() < 0.18) this.spawnGhost();
    }
  },
  // ---------- владелец играет за существо ----------
  morphOn: false, morphNear: false,
  // всё, что связано с появлением существа, прекращается сразу
  stopMutantEvents() {
    if (this.huntS) { Sfx.huntStop(0.5); this.huntEnd(true); }
    if (this.runS) this.endRun();
    if (this.hellS) this.endHell();
    if (this.glitchS && !this.glitchS.forced) { this.revertGlitch(); this.glitchS = null; }
    this.dreadS = null; this.dreadTarget = 0; this.peekS = null;
    const L = this.mutant; L.active = false; L.gp = 0; L.peek = false; L.hunt = false;
    this.ghost.active = false;
    this.omenT = 0; this.dayProbe = 0; this.tvWarn = false; this.tvRolled = false; this.indoor = null;
    this.mutantBurst = 0; this.huntLock = false;
    if (this.pictureOn && !this.scrS) { this.pictureOn = false; Portrait.hide(); }
    if (this.blackOn) { this.blackOn = false; BlackFx.set(false); }
  },
  // помехи растут по мере приближения владельца-существа — так же, как при обычной встрече
  morphStep(dt, q) {
    if (!this.morphOn) { this.morphOn = true; this.stopMutantEvents(); }
    this.updateDeep(dt);
    const p = Player, ex = p.x, ey = p.y + EYE, ez = p.z;
    const dx = q.cx - ex, dz = q.cz - ez, dh = Math.hypot(dx, dz), hy = q.cy + 3.1 - ey, d = Math.hypot(dx, hy, dz) || 1;
    const ld = lookDir(), cosA = (ld[0] * dx + ld[1] * hy + ld[2] * dz) / d, lookF = sstep(0.84, 0.995, cosA);
    const prox = clamp((40 - dh) / (40 - 3), 0, 1);
    const st = q.st !== 0;   // владелец-существо может выключить свои помехи (NumPad 6)
    const kT = st && Game.settings.mutant && !p.dead ? Math.min(1, Math.pow(prox, 1.35) * (0.88 + 0.12 * lookF)) : 0;
    this.mutantK += (kT - this.mutantK) * (1 - Math.exp(-dt * 5));
    this.mutantBurst = Math.max(0, this.mutantBurst - dt);
    const f = 1 - Math.exp(-dt * 0.9);
    this.dreadK -= this.dreadK * f; this.huntK -= this.huntK * f; this.dayFog -= this.dayFog * f;
    if (this.glitchS) this.updateGlitch(dt, false); else this.glitchK = Math.max(0, this.glitchK - dt * 2);   // «сбой мира», запущенный владельцем, идёт до конца
    this.dayLoad = false;
    this.morphNear = st && dh < 40;
  },
  // владелец вернулся в игрока или чёрный скин — события снова идут как обычно
  morphEnd() { this.morphOn = false; this.morphNear = false; this.mutantK = 0; },
  // что показывает телевизор: мультик / помехи (существо скоро появится) / лицо (оно уже здесь)
  tvMode() {
    if (typeof Net !== 'undefined' && Net.observer()) return Net.fxOn ? Net.fxTv : 'anim';
    if (this.morphOn) return this.morphNear ? 'face' : 'anim';
    if (this.dreadS || this.huntS) return this.mutant.active ? 'face' : 'static';
    if (this.peekS && this.mutant.active) return 'face';
    if ((this.mutant.active && !this.mutant.back) || this.ghost.active || (this.mutant.active && this.mutant.phase > 0)) return 'face';
    if (this.omenT > 0 || this.dayProbe > 0 || this.tvWarn || this.indoor || this.peekS) return 'static';
    return 'anim';
  },
  staticLevel() {
    if (this.blackOn) return 0;
    return Math.max(this.mutantK, this.caveBlip > 0 ? 0.17 * Math.min(1, this.caveBlip / 0.6) : 0, this.glitchK * 0.14, this.pictureOn ? 1 : 0, this.mutantBurst > 0 ? Math.min(1, this.mutantBurst / 0.35) : 0);
  },
  // ---------- модель: гладкие формы вместо кубов ----------
  buildMutant(body, eyes, cam, LL) {
    body.reset(); eyes.reset();
    const L = LL || this.mutant; if (!L.active) return null;
    const l = World.light(Math.floor(L.x), Math.floor(L.y + 1), Math.floor(L.z));
    const sky = (l >> 4) / 15, blk = (l & 15) / 15, paleBlk = Math.max(blk, 0.55);
    const t = L.t;
    const mul = (a, b) => m4mul(m4(), a, b);
    const T = (x, y, z) => m4translate(m4(), x, y, z);
    const RX = a => m4rotX(m4(), a), RY = a => m4rotY(m4(), a), RZ = a => m4rotZ(m4(), a);
    const P = (M, x, y, z) => { const v = m4xv(M, x, y, z, 1); return [v[0], v[1], v[2]]; };
    const D = (M, x, y, z) => { const v = m4xv(M, x, y, z, 0); return v3n([v[0], v[1], v[2]]); };
    const bd = TILE.mut_body, claw = TILE.claw;
    const A = L.A || 0, S = L.S || 0, hipY = lerp(1.9, 1.1, A), mix = (a, b) => a + (b - a) * A;
    const sway = Math.sin(t * 0.45) * 0.018 * (1 - A);
    const hs = L.hs || 1, SC = m4scale(m4(), hs, hs, hs);
    const M0 = mul(mul(mul(T(L.x - cam.x, L.y - cam.y, L.z - cam.z), RY(L.yaw)), RZ(sway)), SC);
    const right = D(M0, 1, 0, 0), fwd = D(M0, 0, 0, 1), up = D(M0, 0, 1, 0);
    const tube = (pts, rad, o = {}) => tubeMesh(body, pts, rad, Object.assign({ seg: 8, tile: bd, ref: right, ref2: fwd, sky, blk }, o));
    const blob = (M, c, r, o = {}) => blobMesh(o.target || body, M, c, r, Object.assign({ tile: bd, sky, blk }, o));
    // ---- ноги: длинные, колени-шишки, ступни с когтями ----
    for (const s of [-1, 1]) {
      const wk = (L.walk || 0) * (1 - A), sw = Math.sin((L.wph || 0) + (s > 0 ? 0 : Math.PI));
      const thigh = mul(mul(M0, T(s * 0.12, hipY, 0)), RX(mix(-0.14, -1.35) + wk * sw * 0.5));
      const shin = mul(mul(thigh, T(0, -0.95, 0)), RX(mix(0.26, 1.81) + wk * (Math.max(0, -sw) * 0.7 + 0.1)));
      const foot = mul(mul(shin, T(0, -0.95, 0)), RX(mix(-0.12, -0.46)));
      tube([P(thigh, 0, 0.06, 0), P(thigh, 0, -0.4, 0), P(thigh, 0, -0.95, 0), P(shin, 0, -0.45, 0), P(shin, 0, -0.93, 0)],
        [0.085, 0.068, 0.056, 0.044, 0.03], { sub: 4 });
      blob(thigh, [0, -0.95, 0.012], [0.052, 0.06, 0.05]);
      tube([P(foot, 0, 0.02, -0.02), P(foot, 0, -0.01, 0.1), P(foot, 0, -0.025, 0.19)], [0.034, 0.036, 0.022], { ref: right, ref2: up, sub: 3 });
      for (const f of [-1, 0, 1]) tube([P(foot, f * 0.018, -0.025, 0.18), P(foot, f * 0.024, -0.035, 0.235), P(foot, f * 0.026, -0.05, 0.27)], [0.011, 0.007, 0.001], { tile: claw, seg: 6, sub: 2, ref: right, ref2: up, blk: paleBlk });
    }
    blob(M0, [0, hipY, 0], [0.16, 0.11, 0.1]);
    // ---- туловище: осиная талия, рёбра и позвоночник рельефом ----
    const breath = Math.sin(t * 1.1) * 0.015;
    const tor = mul(mul(M0, T(0, hipY + 0.02, 0)), RX(mix(0.22, -1.45) + breath));
    tube([P(tor, 0, -0.1, 0), P(tor, 0, 0.18, 0.01), P(tor, 0, 0.44, 0.02), P(tor, 0, 0.68, 0.01), P(tor, 0, 0.88, -0.01), P(tor, 0, 1.0, 0)],
      [0.14, 0.085, 0.14, 0.18, 0.2, 0.09], {
        seg: 14, sub: 4, ez: 0.6,
        mod: (u, ca, sa) => {
          let m = 1, sm = 1;
          if (u > 0.38 && u < 0.8 && sa < -0.15) { const r = Math.max(0, Math.sin(u * Math.PI * 22)); m += 0.08 * r * -sa; sm = 0.72 + 0.35 * r; }
          if (sa > 0.8) { const r = Math.max(0, Math.sin(u * Math.PI * 16)); m += 0.07 * r; sm *= 0.85 + 0.2 * r; }
          return [m, sm];
        }
      });
    // ключицы и плечи
    for (const s of [-1, 1]) tube([P(tor, 0, 0.94, 0.03), P(tor, s * 0.13, 0.95, 0.02), P(tor, s * 0.235, 0.9, -0.01)], [0.045, 0.04, 0.058], { ref: fwd, ref2: up, sub: 3 });
    // ---- руки ниже колен, длинные пальцы с когтями ----
    const flex = (Math.sin(t * 0.9) + 1) * 0.08;
    for (const s of [-1, 1]) {
      // правая рука может тянуться к цели (телекинез): L.aimK — насколько, L.aimA/aimB — углы, L.aimOpen — ладонь раскрыта
      const ak = s === 1 ? (L.aimK || 0) : 0;
      let rz = s * (0.07 + Math.sin(t * 0.7 + s) * 0.02 + A * 0.35 - (L.armSpread || 0)), rx = mix(-0.3, 2.65) - (L.armA || 0);
      if (ak) { rz += ((L.aimB || 0) - rz) * ak; rx += ((L.aimA || 0) - rx) * ak; }
      const fl = ak ? flex + ((L.aimOpen ? -0.2 : 0.9) - flex) * ak : flex;
      const upA = mul(mul(tor, T(s * 0.235, 0.9, -0.01)), mul(RZ(rz), RX(rx)));
      const fo = mul(mul(upA, T(0, -1.05, 0)), RX(mix(-0.22 - fl * 0.5, -0.8) * (1 - ak * 0.9)));
      const wr = mul(mul(fo, T(0, -1.0, 0)), RX(A * 1.0));
      tube([P(upA, 0, 0.03, 0), P(upA, 0, -0.5, 0), P(upA, 0, -1.05, 0), P(fo, 0, -0.5, 0), P(fo, 0, -0.97, 0)],
        [0.06, 0.044, 0.04, 0.034, 0.025], { sub: 4 });
      blob(upA, [0, -1.05, -0.01], [0.042, 0.05, 0.045]);
      blob(wr, [0, -0.06, 0], [0.045, 0.075, 0.02]);
      for (const f of [-1.5, -0.5, 0.5, 1.5]) {
        const f1 = mul(mul(wr, T(f * 0.022, -0.12, 0)), mul(RZ(f * 0.07), RX(-0.2 - fl)));
        const f2 = mul(mul(f1, T(0, -0.22, 0)), RX(-0.35 - fl));
        const f3 = mul(mul(f2, T(0, -0.19, 0)), RX(-0.3));
        tube([P(f1, 0, 0.01, 0), P(f1, 0, -0.22, 0), P(f2, 0, -0.19, 0)], [0.013, 0.011, 0.009], { seg: 6, sub: 3 });
        tube([P(f2, 0, -0.18, 0), P(f3, 0, -0.05, 0), P(f3, 0, -0.1, 0)], [0.009, 0.006, 0.0005], { seg: 6, sub: 2, tile: claw, blk: paleBlk });
      }
    }
    // ---- шея ----
    const nk = mul(mul(tor, T(0, 1.0, 0.02)), RX(mix(0.35, -0.3)));
    tube([P(tor, 0, 0.92, 0), P(nk, 0, 0.12, 0), P(nk, 0, 0.3, 0)], [0.07, 0.042, 0.05], { sub: 3 });
    // ---- голова: череп, обтянутый кожей ----
    const tilt = Math.sin(t * 0.4) * 0.16 + L.twitchV * (1 - (L.A || 0)), nod = Math.sin(t * 0.23) * 0.05;
    // L.hy / L.hp / L.hroll — поворот головы отдельно от корпуса (владелец в облике существа)
    const hr = mul(mul(mul(nk, T(0, 0.26, 0)), RY(L.hy || 0)), mul(RZ(tilt * (1 - A) + (L.hroll || 0) + (S > 0 && L.snapT < 0.6 ? Math.sin(t * 60) * 0.05 : 0)), RX(-0.12 + nod * (1 - A) - 1.28 * S + (L.hp || 0) * 0.9)));
    const jaw = 0.006 + (Math.sin(t * 0.55) + 1) * 0.014;
    { const hc = P(hr, 0, HEAD.cy, 0); L._head = [hc[0] + cam.x, hc[1] + cam.y, hc[2] + cam.z]; }   // где голова (для сцен)
    headMesh(body, eyes, hr, sky, paleBlk, L.jawOpen !== undefined ? L.jawOpen : jaw);
    if (L.gp) grinMesh(eyes, hr, L);
    return body;
  }
});

// ============================================================
//  Гладкие меши: трубки по сплайну, эллипсоиды, голова
// ============================================================
function v3n(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function v3cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
// мягкий свет + контурная подсветка краёв (силуэт читается в темноте)
function meshShade(pos, nor, sm) {
  const vl = Math.hypot(pos[0], pos[1], pos[2]) || 1;
  const nv = -(nor[0] * pos[0] + nor[1] * pos[1] + nor[2] * pos[2]) / vl;
  const rim = Math.pow(1 - Math.min(1, Math.abs(nv)), 3);
  return (0.55 + 0.35 * (nor[1] * 0.5 + 0.5) + 0.06 * nor[0]) * sm + rim * 0.85 * Math.min(1, sm * 1.1);
}
function catmull(pts, rad, sub) {
  const P = [], R = [], n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      P.push([0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      R.push(rad[i] + (rad[i + 1] - rad[i]) * t);
    }
  }
  P.push(pts[n - 1]); R.push(rad[n - 1]);
  return [P, R];
}
function emitGrid(b, grid, tile, sky, blk, uRep = 1, vRep = 1) {
  const tx = (tile % ATLAS_COLS) * TS, ty = Math.floor(tile / ATLAS_COLS) * TS;
  const rows = grid.length, cols = grid[0].length;
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const q = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]];
    const u0 = tx + ((j * uRep) % (cols - 1)) / (cols - 1) * 15.5, u1 = u0 + 15.5 * uRep / (cols - 1);
    const v0 = ty + ((i * vRep) % 16), v1 = Math.min(ty + 16, v0 + vRep);
    b.quadV(q.map(g => g.p), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], sky, blk, q.map(g => g.s));
  }
}
function tubeMesh(b, pts, rad, o) {
  const [P, R] = catmull(pts, rad, o.sub || 3);
  const seg = o.seg || 8, n = P.length, ez = o.ez || 1;
  const grid = [];
  for (let i = 0; i < n; i++) {
    const tg = v3n([P[Math.min(n - 1, i + 1)][0] - P[Math.max(0, i - 1)][0], P[Math.min(n - 1, i + 1)][1] - P[Math.max(0, i - 1)][1], P[Math.min(n - 1, i + 1)][2] - P[Math.max(0, i - 1)][2]]);
    let ref = o.ref; if (Math.abs(v3dot(ref, tg)) > 0.9) ref = o.ref2;
    const d = v3dot(ref, tg), nn = v3n([ref[0] - tg[0] * d, ref[1] - tg[1] * d, ref[2] - tg[2] * d]);
    const bb = v3cross(tg, nn);
    const row = [];
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * PI2, ca = Math.cos(a), sa = Math.sin(a);
      let m = 1, sm = 1;
      if (o.mod) [m, sm] = o.mod(i / (n - 1), ca, sa);
      const r = R[i] * m;
      const p = [P[i][0] + (nn[0] * ca + bb[0] * sa * ez) * r, P[i][1] + (nn[1] * ca + bb[1] * sa * ez) * r, P[i][2] + (nn[2] * ca + bb[2] * sa * ez) * r];
      const nr = v3n([nn[0] * ca * ez + bb[0] * sa, nn[1] * ca * ez + bb[1] * sa, nn[2] * ca * ez + bb[2] * sa]);
      row.push({ p, s: meshShade(p, nr, sm) });
    }
    grid.push(row);
  }
  emitGrid(b, grid, o.tile, o.sky, o.blk, 1, 3);
}
function blobMesh(b, M, c, r, o) {
  const NL = 7, NN = 10, grid = [];
  for (let i = 0; i <= NL; i++) {
    const th = i / NL * Math.PI, row = [];
    for (let j = 0; j <= NN; j++) {
      const ph = j / NN * PI2;
      const lx = Math.sin(th) * Math.sin(ph), ly = Math.cos(th), lz = Math.sin(th) * Math.cos(ph);
      const pv = m4xv(M, c[0] + lx * r[0], c[1] + ly * r[1], c[2] + lz * r[2], 1);
      const nv = m4xv(M, lx / r[0], ly / r[1], lz / r[2], 0);
      const p = [pv[0], pv[1], pv[2]];
      row.push({ p, s: meshShade(p, v3n([nv[0], nv[1], nv[2]]), 1) });
    }
    grid.push(row);
  }
  emitGrid(b, grid, o.tile, o.sky, o.blk, 1, 2);
}
// череп: вытянутый затылок, узкая челюсть, впадины глаз, скулы, нос, оскал
const HEAD = { rx: 0.122, ry: 0.225, rz: 0.15, cy: 0.21 };
function headShape(x0, y0, z0, jaw) {
  const { rx, ry, rz } = HEAD;
  let x = x0 * rx, y = y0 * ry, z = z0 * rz, s = 1;
  const yn = y0;
  if (z < 0) z *= 1 + 0.28 * Math.max(0, yn);
  if (yn < 0) { x *= 0.7 + 0.3 * (1 + yn); z *= z > 0 ? 0.9 + 0.1 * (1 + yn) : 0.78 + 0.22 * (1 + yn); }
  x *= 1 - 0.07 * Math.max(0, yn);
  if (z > 0.02) {
    for (const ex of [-0.05, 0.05]) {
      const d = Math.hypot(x - ex, (y - 0.055) * 1.2);
      if (d < 0.052) { const k = 1 - d / 0.052; z -= 0.05 * Math.sqrt(k); s *= 1 - 0.95 * Math.min(1, k * 1.6); }
    }
    if (y > 0.093 && y < 0.132 && Math.abs(x) < 0.1) { z += 0.011; s *= 1.12; }
    if (Math.abs(x) < 0.02 && y < 0.035 && y > -0.045) { z += 0.015 * (1 - Math.abs(x) / 0.02); s *= 1.08; }
    for (const nx of [-0.011, 0.011]) { const d = Math.hypot(x - nx, y + 0.047); if (d < 0.013) s *= 0.25 + 0.75 * d / 0.013; }
    for (const cx of [-0.076, 0.076]) {
      const d = Math.hypot(x - cx, y + 0.004); if (d < 0.034) { z += 0.012 * (1 - d / 0.034); s *= 1.1; }
      const d2 = Math.hypot(x - cx * 0.95, y + 0.07); if (d2 < 0.045) { z -= 0.015 * (1 - d2 / 0.045); s *= 0.76; }
    }
    const mTop = -0.07, mBot = -0.112 - jaw;
    if (Math.abs(x) < 0.08 && y < mTop + 0.004 && y > mBot - 0.004) { const k = 1 - (x / 0.08) ** 2; z -= 0.024 * k; s *= 0.06 + 0.35 * (1 - k); }
    else if (Math.abs(x) < 0.085 && y < mTop + 0.008 && y > mBot - 0.008) s *= 0.7;
  }
  return [x, y + HEAD.cy, z, s];
}

// светящиеся глаза и рот, затем жуткая улыбка от уха до уха (рисуется в «светящемся» пакете)
function headSurfZ(x, y) {
  const yn = y / HEAD.ry, xs = yn < 0 ? 0.7 + 0.3 * (1 + yn) : 1, zs = yn < 0 ? 0.9 + 0.1 * (1 + yn) : 1;
  return HEAD.rz * zs * Math.sqrt(Math.max(0, 1 - (x / (HEAD.rx * xs)) ** 2 - yn * yn));
}
function grinMesh(eyes, M, L) {
  const P = (x, y, z) => { const v = m4xv(M, x, y + HEAD.cy, z, 1); return [v[0], v[1], v[2]]; };
  const quad = (pts, tile, u0, v0, u1, v1) => {
    const tx = (tile % ATLAS_COLS) * TS, ty = Math.floor(tile / ATLAS_COLS) * TS;
    eyes.quadV(pts, [[tx + u0, ty + v1], [tx + u1, ty + v1], [tx + u1, ty + v0], [tx + u0, ty + v0]], 1, 1, [1, 1, 1, 1]);
  };
  const G = TILE.glow_red, fl = 0.8 + 0.2 * Math.sin(L.t * 37) * Math.sin(L.t * 11);
  // глаза горят
  for (const ex of [-0.05, 0.05]) {
    const r = (L.gp === 1 ? 0.024 : 0.03) * fl, z = headSurfZ(ex, 0.055) - 0.034, y = 0.055;
    quad([P(ex - r, y - r * 1.2, z), P(ex + r, y - r * 1.2, z), P(ex + r, y + r * 1.2, z), P(ex - r, y + r * 1.2, z)], G, 2, 2, 14, 14);
  }
  if (L.gp === 1) {   // рот светится тонкой щелью
    const prog = Math.min(1, L.gt / 1.0);
    for (let k = 0; k < 12; k++) {
      const u = (k / 11) * 2 - 1, x = u * 0.066 * prog, y = -0.091, z = headSurfZ(x, y) - 0.012, r = 0.0065;
      quad([P(x - r, y - r, z), P(x + r, y - r, z), P(x + r, y + r, z), P(x - r, y + r, z)], G, 3, 3, 13, 13);
    }
    return;
  }
  // улыбка: чёрная пасть по дуге и два ряда острых зубов
  const N = 18, dark = TILE.socket, T = TILE.teeth, grow = Math.min(1, L.gt / 0.12);
  const arc = u => ({ x: u * 0.094 * (0.55 + 0.45 * grow), y: -0.1 + 0.07 * u * u * grow - 0.012 * (1 - grow) });
  for (let k = 0; k < N; k++) {
    const a = arc(k / N * 2 - 1), b = arc((k + 1) / N * 2 - 1);
    const th = u => 0.007 + 0.017 * (1 - u * u * 0.45);
    const ta = th(k / N * 2 - 1), tb = th((k + 1) / N * 2 - 1), xm = (a.x + b.x) / 2, ym = (a.y + b.y) / 2, z = headSurfZ(xm, ym) + 0.007;
    quad([P(a.x, a.y - ta, z), P(b.x, b.y - tb, z), P(b.x, b.y + tb, z), P(a.x, a.y + ta, z)], dark, 4, 4, 12, 12);
    const zt = z + 0.002, tl = 0.016 + 0.006 * Math.sin(k * 2.3);
    quad([P(a.x, a.y + ta - tl, zt), P(b.x, b.y + tb - tl, zt), P(b.x, b.y + tb, zt), P(a.x, a.y + ta, zt)], T, 1, 2, 3, 12);
    quad([P(a.x, a.y - ta, zt), P(b.x, b.y - tb, zt), P(b.x, b.y - tb + tl, zt), P(a.x, a.y - ta + tl, zt)], T, 1, 2, 3, 12);
  }
}
function headMesh(b, eyes, M, sky, blk, jaw) {
  const NL = 26, NN = 32, pts = [];
  for (let i = 0; i <= NL; i++) {
    const th = i / NL * Math.PI, row = [];
    for (let j = 0; j <= NN; j++) {
      const ph = j / NN * PI2;
      row.push(headShape(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph), jaw));
    }
    pts.push(row);
  }
  const grid = [];
  for (let i = 0; i <= NL; i++) {
    const row = [];
    for (let j = 0; j <= NN; j++) {
      const a = pts[Math.min(NL, i + 1)][j], c = pts[Math.max(0, i - 1)][j];
      const e = pts[i][(j + 1) % NN], w = pts[i][(j - 1 + NN) % NN];
      let nl = v3n(v3cross([a[0] - c[0], a[1] - c[1], a[2] - c[2]], [e[0] - w[0], e[1] - w[1], e[2] - w[2]]));
      const q = pts[i][j];
      const out = [q[0], q[1] - HEAD.cy, q[2]];
      if (v3dot(nl, out) < 0) nl = [-nl[0], -nl[1], -nl[2]];
      if (i === 0 || i === NL) nl = v3n(out);
      const pv = m4xv(M, q[0], q[1], q[2], 1), nv = m4xv(M, nl[0], nl[1], nl[2], 0);
      const p = [pv[0], pv[1], pv[2]];
      row.push({ p, s: meshShade(p, v3n([nv[0], nv[1], nv[2]]), q[3]) });
    }
    grid.push(row);
  }
  emitGrid(b, grid, TILE.mut_skin, sky, blk, 3, 2);
  // зубы в оскале
  const P = (x, y, z) => { const v = m4xv(M, x, y, z, 1); return [v[0], v[1], v[2]]; };
  const surf = (x, y) => {
    const yn = y / HEAD.ry, xs = yn < 0 ? 0.7 + 0.3 * (1 + yn) : 1, zs = yn < 0 ? 0.9 + 0.1 * (1 + yn) : 1;
    return HEAD.rz * zs * Math.sqrt(Math.max(0, 1 - (x / (HEAD.rx * xs)) ** 2 - yn * yn));
  };
  const tt = TILE.teeth, tx = (tt % ATLAS_COLS) * TS, ty = Math.floor(tt / ATLAS_COLS) * TS;
  const mTop = -0.07, mBot = -0.112 - jaw;
  for (let k = 0; k < 9; k++) {
    const x0 = -0.066 + k * 0.0147, x1 = x0 + 0.0125, xm = (x0 + x1) / 2;
    const zr = surf(xm, (mTop + mBot) / 2) - 0.024 * (1 - (xm / 0.08) ** 2) * 0.6 + 0.003;
    for (const [ya, yb] of [[mTop - 0.001, mTop - 0.019], [mBot + 0.017, mBot + 0.001]]) {
      const pts4 = [P(x0, yb, zr), P(x1, yb, zr), P(x1, ya, zr), P(x0, ya, zr)].map(p => [p[0], p[1] + HEAD.cy * 0, p[2]]);
      const pp = [P(x0, yb + HEAD.cy, zr), P(x1, yb + HEAD.cy, zr), P(x1, ya + HEAD.cy, zr), P(x0, ya + HEAD.cy, zr)];
      b.quadV(pp, [[tx + 1, ty + 12], [tx + 3, ty + 12], [tx + 3, ty + 2], [tx + 1, ty + 2]], sky, blk, [0.85, 0.85, 1, 1]);
    }
  }
  // бледные точки зрачков в глубине глазниц
  const gt = TILE.glint, gx = (gt % ATLAS_COLS) * TS + 4, gy = Math.floor(gt / ATLAS_COLS) * TS + 4;
  for (const ex of [-0.05, 0.05]) {
    const z = surf(ex, 0.055) - 0.043, y = 0.055 + HEAD.cy, r = 0.011;
    eyes.quadV([P(ex - r, y - r, z), P(ex + r, y - r, z), P(ex + r, y + r, z), P(ex - r, y + r, z)], [[gx, gy + 8], [gx + 8, gy + 8], [gx + 8, gy], [gx, gy]], 1, 1, [1, 1, 1, 1]);
  }
}
