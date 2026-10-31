// ============================================================
//  Физика жидкостей: вода и лава растекаются по уровням, падают вниз,
//  вода + лава => обсидиан / булыжник
// ============================================================
const Fluid = {
  qW: new Map(), qL: new Map(), tW: 0, tL: 0, budget: 260,
  // пометить клетку и соседей: их нужно пересчитать
  touch(x, y, z) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const X = x + dx, Y = y + dy, Z = z + dz; if (Y < 1 || Y >= WH) continue;
      const fk = FKIND[World.get(X, Y, Z)];
      if (!fk) continue;
      const k = pkey(X, Y, Z), q = fk === 1 ? this.qW : this.qL;
      if (!q.has(k)) q.set(k, [X, Y, Z]);
    }
  },
  flowable(id) {
    if (id === 0) return true;
    const d = BLK[id];
    return !!(d && (d.replaceable || (!d.solid && (d.render === R_CROSS || d.render === R_TORCH)) || FKIND[id] > 0));
  },
  // контакт воды с лавой: источник лавы -> обсидиан, течение лавы -> булыжник
  contact(x, y, z) {
    const id = World.get(x, y, z);
    if (FKIND[id] !== 2) return false;
    for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
      if (FKIND[World.get(x + dx, y + dy, z + dz)] === 1) {
        World.set(x, y, z, id === B.LAVA ? B.OBSIDIAN : B.COBBLE);
        Sfx.fizz && Sfx.fizz();
        return true;
      }
    }
    return false;
  },
  update(dt) {
    this.tW += dt; this.tL += dt;
    if (this.tW >= 0.22) { this.tW = 0; this.step(1); }
    if (this.tL >= 1.0) { this.tL = 0; this.step(2); }
  },
  step(kind) {
    const q = kind === 1 ? this.qW : this.qL;
    if (!q.size) return;
    const items = []; let n = 0;
    for (const [k, v] of q) { items.push(v); q.delete(k); if (++n >= this.budget) break; }
    const SRC = kind === 1 ? 8 : 4, FULL = kind === 1 ? 7 : 3;
    const mk = kind === 1 ? waterId : lavaId;
    const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [x, y, z] of items) {
      if (!World.loaded(x, z)) continue;
      const id = World.get(x, y, z);
      if (FKIND[id] !== kind) continue;
      if (this.contact(x, y, z)) { this.touch(x, y, z); continue; }
      let L = FLEVEL[id];
      // --- поддержка течения: откуда оно питается ---
      if (L < SRC) {
        const up = World.get(x, y + 1, z);
        let sup = FKIND[up] === kind ? FULL : 0, srcN = 0;
        for (const [dx, dz] of H4) {
          const nid = World.get(x + dx, y, z + dz);
          if (FKIND[nid] === kind) { sup = Math.max(sup, FLEVEL[nid] - 1); if (FLEVEL[nid] >= SRC) srcN++; }
        }
        const below = World.get(x, y - 1, z);
        if (kind === 1 && srcN >= 2 && (SOLID[below] || FLEVEL[below] >= SRC && FKIND[below] === 1)) { World.set(x, y, z, B.WATER); this.touch(x, y, z); continue; }  // бесконечная вода
        if (sup <= 0) { World.set(x, y, z, 0); this.touch(x, y, z); continue; }
        if (sup !== L) { L = Math.min(sup, FULL); World.set(x, y, z, mk(L)); this.touch(x, y, z); continue; }
      }
      // --- растекание ---
      const below = World.get(x, y - 1, z);
      if (this.flowable(below) && !(FKIND[below] === kind && FLEVEL[below] >= FULL)) {
        if (FKIND[below] === 0 || FKIND[below] === kind) {
          if (FKIND[below] !== 0 && FLEVEL[below] >= FULL) { /* уже полно */ }
          else { World.set(x, y - 1, z, mk(FULL)); this.touch(x, y - 1, z); }
        } else {   // вода <-> лава: вниз встречаются — твердеют
          World.set(x, y - 1, z, kind === 1 ? (FLEVEL[below] >= 4 ? B.OBSIDIAN : B.COBBLE) : B.STONE); Sfx.fizz && Sfx.fizz();
        }
        continue;
      }
      if (L <= 1) continue;
      for (const [dx, dz] of H4) {
        const nx = x + dx, nz = z + dz, nid = World.get(nx, y, nz);
        if (!this.flowable(nid)) continue;
        if (FKIND[nid] === kind) { if (FLEVEL[nid] < L - 1) { World.set(nx, y, nz, mk(L - 1)); this.touch(nx, y, nz); } }
        else if (FKIND[nid] !== 0) {   // вода встретила лаву сбоку
          World.set(nx, y, nz, kind === 1 ? (FLEVEL[nid] >= 4 ? B.OBSIDIAN : B.COBBLE) : B.COBBLE); Sfx.fizz && Sfx.fizz();
        } else { World.set(nx, y, nz, mk(L - 1)); this.touch(nx, y, nz); }
      }
    }
  },
  // направление течения воды в клетке (для толчка игрока и предметов)
  flowDir(x, y, z) {
    const id = World.get(x, y, z); if (FKIND[id] !== 1) return [0, 0];
    const L = FLEVEL[id]; let fx = 0, fz = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nid = World.get(x + dx, y, z + dz);
      const nl = FKIND[nid] === 1 ? FLEVEL[nid] : (nid === 0 || (BLK[nid] && !BLK[nid].solid) ? 0 : L);
      if (nl < L) { fx += dx * (L - nl); fz += dz * (L - nl); }
    }
    const l = Math.hypot(fx, fz); return l ? [fx / l, fz / l] : [0, 0];
  }
};
World.onSet = (x, y, z, old, id) => {
  if (FKIND[old] || FKIND[id] || BLK[id].solid !== BLK[old].solid || (id === 0) !== (old === 0)) Fluid.touch(x, y, z);
};
