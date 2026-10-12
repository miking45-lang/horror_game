// ============================================================
//  «Сбой мира»: редко деревья (в пустыне — кактусы) перед игроком надстраиваются друг на друга,
//  небо краснеет, идут слабые помехи и играет трек. Когда он заканчивается — всё возвращается.
//  Блоки временные: в сохранение не попадают.
// ============================================================
World.setTemp = function (x, y, z, id) {
  if (y < 0 || y >= WH) return false;
  const c = this.chunks.get(ckey(x >> 4, z >> 4));
  if (!c || c.state < ST_LIT) return false;
  const lx = x & 15, lz = z & 15, i = lx + (lz << 4) + (y << 8);
  if (c.blocks[i] === id) return false;
  c.blocks[i] = id;
  if (y + 1 > c.maxY) c.maxY = y + 1;
  this.markDirty(c, lx, lz);
  return true;
};

Object.assign(Ents, {
  glitchS: null, glitchK: 0, glitchCool: 240, glitchRoll: 8,
  // найти деревья/кактусы в секторе перед игроком
  scanGlitch() {
    const p = Player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), px = Math.floor(p.x), pz = Math.floor(p.z), R = 44;
    const isLog = isLogId, isLeaf = isLeafId;
    const trees = [], cacti = [];
    for (let x = px - R; x <= px + R; x++) for (let z = pz - R; z <= pz + R; z++) {
      const dx = x + 0.5 - p.x, dz = z + 0.5 - p.z, d = Math.hypot(dx, dz);
      if (d < 5 || d > R || (dx * fx + dz * fz) / d < 0.35 || !World.loaded(x, z)) continue;
      for (let y = SEA - 3; y < 100; y++) {
        const id = World.get(x, y, z);
        if (isLog(id) && !isLog(World.get(x, y - 1, z)) && !isLeaf(World.get(x, y - 1, z))) {
          let th = 0; while (isLog(World.get(x, y + th, z)) && th < 40) th++;
          const cells = [];
          for (let yy = y; yy <= y + th + 1; yy++) for (let ax = -5; ax <= 5; ax++) for (let az = -5; az <= 5; az++) {
            const b = World.get(x + ax, yy, z + az); if (isLog(b) || isLeaf(b)) cells.push([ax, yy - y, az, b]);
          }
          trees.push({ x, y, z, d, S: th + 2, cells }); y += th;
        } else if (id === B.CACTUS && World.get(x, y - 1, z) !== B.CACTUS) {
          let h = 0; while (World.get(x, y + h, z) === B.CACTUS && h < 8) h++;
          cacti.push({ x, y, z, d, h }); y += h;
        }
      }
    }
    return { trees, cacti };
  },
  startGlitch(force) {
    const sc = this.scanGlitch(), kind = sc.trees.length >= 5 ? 'tree' : sc.cacti.length >= 5 ? 'cactus' : '';
    if (!kind && !force) return false;   // по команде владельца — даже без деревьев: красное небо и трек
    const d = Sfx.glitch(); if (!d) return false;
    const sorted = !kind ? [] : (kind === 'tree' ? sc.trees : sc.cacti).sort((a, b) => a.d - b.d), list = []; let budget = 0;
    for (const t of sorted) { budget += kind === 'tree' ? t.cells.length : t.h; if (budget > 30000 || list.length >= 140) break; list.push(t); }
    const ROUNDS = 4, rounds = [];
    for (let r = 1; r <= ROUNDS; r++) {
      const ops = [];
      for (const t of list) {
        if (kind === 'tree') { const oy = r * t.S; for (const [ax, ay, az, b] of t.cells) ops.push([t.x + ax, t.y + ay + oy, t.z + az, b]); }
        else for (let k = 0; k < t.h; k++) ops.push([t.x, t.y + r * t.h + k, t.z, B.CACTUS]);
      }
      rounds.push(ops);
    }
    this.glitchS = { t: 0, dur: d, kind, rounds, next: 0, undo: [] };
    this.glitchK = Math.max(this.glitchK, 0.001);
    this.mutantBurst = 0.4; Sfx.staticBurst(); Game.flickerPulse = 0.6;
    return true;
  },
  revertGlitch() {
    const S = this.glitchS; if (!S) return;
    for (let i = S.undo.length - 1; i >= 0; i--) {
      const [x, y, z, old, id] = S.undo[i];
      if (World.get(x, y, z) === id) World.setTemp(x, y, z, old);   // если игрок успел изменить блок — не трогаем
    }
    S.undo.length = 0;
  },
  // запуск по команде владельца-существа (NumPad 7); завершается сам, когда кончится трек
  forceGlitch() {
    if (this.glitchS) return false;
    if (!Sfx.glitchReady()) { if (Sfx.loadGlitch) Sfx.loadGlitch(); return false; }
    if (!this.startGlitch(true)) return false;
    this.glitchS.forced = true;   // не обрывать, когда владелец-существо подходит к игроку
    return true;
  },
  updateGlitch(dt, allow) {
    const S = this.glitchS;
    if (S) {
      S.t += dt;
      while (S.next < S.rounds.length && S.t >= 1.2 + S.next * 0.8) {   // каждый следующий «этаж» вырастает с задержкой
        for (const [x, y, z, id] of S.rounds[S.next]) { const old = World.get(x, y, z); if (old === 0 || old === B.TALLGRASS || old === id) { if (World.setTemp(x, y, z, id)) S.undo.push([x, y, z, old, id]); } }
        S.next++;
      }
      this.glitchK += ((S.t < S.dur - 1 ? 1 : 0) - this.glitchK) * (1 - Math.exp(-dt * (S.t < S.dur - 1 ? 1.2 : 2.5)));
      if (S.t >= S.dur) {
        this.revertGlitch(); this.glitchS = null; this.glitchK = 0;
        this.mutantBurst = Math.max(this.mutantBurst, 0.5); Sfx.staticBurst(); Game.flickerPulse = 0.5;
        this.glitchCool = (700 + Math.random() * 600) * (this.deepOn ? 0.4 : 1);
      }
      return;
    }
    this.glitchK = Math.max(0, this.glitchK - dt * 2);
    this.glitchCool -= dt;
    if (!allow || this.glitchCool > 0) return;
    this.glitchRoll -= dt; if (this.glitchRoll > 0) return;
    this.glitchRoll = 10;
    if (Math.random() < (this.deepOn ? 0.07 : 0.025) && Sfx.glitchReady()) { if (!this.startGlitch()) this.glitchRoll = 5; }
  }
});
