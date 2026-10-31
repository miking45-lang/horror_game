// ============================================================
//  Мир: чанки, генерация, освещение
// ============================================================
const CS = 16, WH = 128, SEA = 62, CVOL = CS * CS * WH;
const ST_GEN = 1, ST_LIT = 2;
const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
function ckey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
function bidx(x, y, z) { return x + (z << 4) + (y << 8); }
function pkey(x, y, z) { return x + ',' + y + ',' + z; }

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
    this.blocks = new Uint8Array(CVOL); this.light = new Uint8Array(CVOL);
    this.state = 0; this.lightable = false; this.dirty = true; this.mesh = null; this.maxY = 0; this.hasWater = false;
  }
}

const World = {
  chunks: new Map(), seed: 0, gen: null,
  mods: new Map(),        // ckey -> Map(idx -> id)
  orient: new Map(),      // "x,y,z" -> 0..3
  containers: new Map(),  // "x,y,z" -> {type, slots, ...}
  onUnload: null, onMesh: null,
  order: [], orderR: -1,
  reset(seed) {
    for (const c of this.chunks.values()) if (this.onUnload) this.onUnload(c);
    this.chunks.clear(); this.mods.clear(); this.orient.clear(); this.containers.clear();
    this.seed = seed; this.gen = new Gen(seed);
  },
  chunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); },
  get(x, y, z) {
    if (y < 0) return B.BEDROCK; if (y >= WH) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || !c.state) return 0;
    return c.blocks[(x & 15) + ((z & 15) << 4) + (y << 8)];
  },
  // для физики: незагруженное — твёрдое
  getPhys(x, y, z) {
    if (y < 0) return B.BEDROCK; if (y >= WH) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || c.state < ST_LIT) return B.BEDROCK;
    return c.blocks[(x & 15) + ((z & 15) << 4) + (y << 8)];
  },
  loaded(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return !!(c && c.state >= ST_LIT); },
  light(x, y, z) {
    if (y >= WH) return 240; if (y < 0) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || c.state < ST_LIT) return 240;
    return c.light[(x & 15) + ((z & 15) << 4) + (y << 8)];
  },
  set(x, y, z, id) {
    if (y < 0 || y >= WH) return false;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || !c.state) return false;
    const lx = x & 15, lz = z & 15, i = lx + (lz << 4) + (y << 8);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    let m = this.mods.get(c.key); if (!m) { m = new Map(); this.mods.set(c.key, m); }
    m.set(i, id);
    if (y + 1 > c.maxY) c.maxY = y + 1;
    if (FKIND[id] === 1) c.hasWater = true;
    this.markDirty(c, lx, lz);
    if (c.state >= ST_LIT) relight(x, y, z);
    if (!BLK[id].oriented) this.orient.delete(pkey(x, y, z));
    if (this.onSet) this.onSet(x, y, z, old, id);
    return true;
  },
  markDirty(c, lx, lz) {
    c.dirty = true;
    const l = lx === 0 ? -1 : lx === 15 ? 1 : 0, f = lz === 0 ? -1 : lz === 15 ? 1 : 0;
    if (l) this.dirtyAt(c.cx + l, c.cz);
    if (f) this.dirtyAt(c.cx, c.cz + f);
    if (l && f) this.dirtyAt(c.cx + l, c.cz + f);
  },
  dirtyAt(cx, cz) { const c = this.chunks.get(ckey(cx, cz)); if (c) c.dirty = true; },
  orientOf(x, y, z) {
    const o = this.orient.get(pkey(x, y, z));
    return o === undefined ? Math.floor(hash3(x, y, z, 99) * 4) : o;
  },
  topY(x, z) { for (let y = WH - 1; y > 0; y--) { const b = this.get(x, y, z); if (b && SOLID[b]) return y; } return 0; },

  // ---------- загрузка/выгрузка ----------
  buildOrder(R) {
    const o = [], L = R + 2;
    for (let dz = -L; dz <= L; dz++) for (let dx = -L; dx <= L; dx++) o.push([dx, dz, Math.max(Math.abs(dx), Math.abs(dz)), dx * dx + dz * dz]);
    o.sort((a, b) => a[3] - b[3]);
    this.order = o; this.orderR = R;
  },
  neighborsState(cx, cz, st) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = this.chunks.get(ckey(cx + dx, cz + dz));
      if (!n || n.state < st) return false;
    }
    return true;
  },
  update(pcx, pcz, R, budgetMs) {
    if (this.orderR !== R) this.buildOrder(R);
    const t0 = performance.now();
    let work = 0;
    for (const [dx, dz, ring] of this.order) {
      if (performance.now() - t0 > budgetMs) break;
      const cx = pcx + dx, cz = pcz + dz, k = ckey(cx, cz);
      let c = this.chunks.get(k);
      if (!c) {
        c = new Chunk(cx, cz); this.chunks.set(k, c);
        this.gen.generate(c); this.applyMods(c); c.state = ST_GEN; work++;
        continue;
      }
      if (c.state === ST_GEN && ring <= R + 1 && this.neighborsState(cx, cz, ST_GEN)) { lightChunk(c); work++; continue; }
      if (c.state === ST_LIT && c.dirty && ring <= R && this.neighborsState(cx, cz, ST_LIT)) {
        if (this.onMesh) this.onMesh(c); work++;
      }
    }
    return work;
  },
  unloadFar(pcx, pcz, R) {
    for (const [k, c] of this.chunks) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > R + 3) {
        if (this.onUnload) this.onUnload(c);
        this.chunks.delete(k);
      }
    }
  },
  applyMods(c) {
    const m = this.mods.get(c.key); if (!m) return;
    for (let [i, id] of m) {
      if (SWINFO[id] && SWINFO[id].kind === 'btn' && SWINFO[id].on) { id = SWINFO[id].off; m.set(i, id); }   // кнопки после загрузки отпущены
      c.blocks[i] = id; const y = i >> 8; if (y + 1 > c.maxY) c.maxY = y + 1;
      if (FKIND[id] === 1) c.hasWater = true;
    }
  }
};
