// ============================================================
//  Генератор ландшафта
// ============================================================
const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOW: 3, MOUNT: 4, VOLC: 5, SPRUCE: 6 };
const VOLC = { S: 720, R: 140, RR: 52, RI: 22, RIM: 122, FLOOR: 84, LAVA: 90 };
class Gen {
  constructor(seed) {
    this.seed = seed;
    const s = (k) => new Simplex((seed ^ Math.imul(k, 0x9E3779B1)) | 0);
    this.nc = s(1); this.nh = s(2); this.nd = s(3); this.nm = s(4); this.nt = s(5); this.nu = s(6);
    this.ns = s(11); this.c1 = s(7); this.c2 = s(8); this.c3 = s(9); this.nx = s(10);
  }
  // расстояние до центра вулкана (если точка в его зоне), иначе null; по одному вулкану на ~половину ячеек 720×720
  volcano(x, z) {
    const S = VOLC.S, cx = Math.floor(x / S), cz = Math.floor(z / S), hs = this.seed | 0;
    if (hash3(cx, cz, 5, hs ^ 0x51ca) > 0.55) return null;
    const vx = (cx + 0.22 + 0.56 * hash3(cx, cz, 6, hs ^ 0x1234)) * S, vz = (cz + 0.22 + 0.56 * hash3(cx, cz, 7, hs ^ 0x4321)) * S;
    if (Math.hypot(vx, vz) < 220) return null;
    const d = Math.hypot(x - vx, z - vz);
    return d < VOLC.R ? d : null;
  }
  height(x, z) {
    const cont = this.nc.fbm2(x / 700, z / 700, 4);
    const hills = this.nh.fbm2(x / 170, z / 170, 4);
    const det = this.nd.fbm2(x / 40, z / 40, 3);
    const mn = Math.max(0, this.nm.fbm2(x / 330, z / 330, 3) - 0.12);
    let h = SEA + 3 + cont * 26 + hills * (6 + Math.max(0, cont) * 12) + det * 2.5 + Math.pow(mn * 2.4, 1.6) * 44;
    const vd = this.volcano(x, z);
    if (vd !== null) {
      const rough = this.nd.n2(x / 17, z / 17) * 2.6;
      if (vd >= VOLC.RR) { const t = 1 - (vd - VOLC.RR) / (VOLC.R - VOLC.RR); h = Math.max(h, h + (VOLC.RIM - h) * Math.pow(t, 1.5) + rough * t); }
      else { const t = smooth(clamp((vd - VOLC.RI) / (VOLC.RR - VOLC.RI), 0, 1)); h = VOLC.FLOOR + (VOLC.RIM - VOLC.FLOOR) * t + rough * t; }
      return clamp(Math.floor(h), 6, 124);
    }
    return clamp(Math.floor(h), 6, 118);
  }
  biome(x, z, h) {
    const t = this.nt.fbm2(x / 520, z / 520, 2), u = this.nu.fbm2(x / 440, z / 440, 2);
    { const vd = this.volcano(x, z); if (vd !== null && vd < 110 && h > SEA) return BIOME.VOLC; }
    if (h > 96) return BIOME.MOUNT;
    // еловые леса: сплошные массивы разного размера — от рощ до больших чащ (порог плавно меняется по карте)
    if (this.ns.fbm2(x / 650, z / 650, 2) > 0.26 - 0.18 * this.ns.n2(x / 1700 + 41.3, z / 1700 - 17.9)) return BIOME.SPRUCE;
    if (t < -0.28) return BIOME.SNOW;
    if (t > 0.26 && u < 0.05) return BIOME.DESERT;
    if (u > 0.12) return BIOME.FOREST;
    return BIOME.PLAINS;
  }
  generate(c) {
    const Bk = c.blocks, bx = c.cx << 4, bz = c.cz << 4;
    const H = new Int16Array(256), BI = new Uint8Array(256);
    let maxH = 0;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = this.height(bx + x, bz + z);
      H[x + z * 16] = h; BI[x + z * 16] = this.biome(bx + x, bz + z, h);
      if (h > maxH) maxH = h;
    }
    // сетка шума пещер (шаг 4) с трилинейной интерполяцией
    const GY = 33, gs = 5 * 5 * GY;
    const N1 = new Float32Array(gs), N2 = new Float32Array(gs), N3 = new Float32Array(gs);
    const yLim = Math.min(WH - 1, maxH + 1);
    for (let gy = 0; gy < GY; gy++) {
      const wy = gy * 4; if (wy > yLim + 4) break;
      for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) {
        const wx = bx + gx * 4, wz = bz + gz * 4, gi = (gy * 5 + gz) * 5 + gx;
        N1[gi] = this.c1.n3(wx / 46, wy / 26, wz / 46);
        N2[gi] = this.c2.n3(wx / 46, wy / 26, wz / 46);
        N3[gi] = wy < 52 ? this.c3.n3(wx / 64, wy / 30, wz / 64) : -1;
      }
    }
    const samp = (A, x, y, z) => {
      const gx = x >> 2, gy = y >> 2, gz = z >> 2, fx = (x & 3) / 4, fy = (y & 3) / 4, fz = (z & 3) / 4;
      const i000 = (gy * 5 + gz) * 5 + gx;
      const a = lerp(A[i000], A[i000 + 1], fx), b = lerp(A[i000 + 5], A[i000 + 6], fx);
      const c2 = lerp(A[i000 + 25], A[i000 + 26], fx), d = lerp(A[i000 + 30], A[i000 + 31], fx);
      return lerp(lerp(a, b, fz), lerp(c2, d, fz), fy);
    };
    const rng = mulberry32(Math.imul(c.cx, 73856093) ^ Math.imul(c.cz, 19349663) ^ this.seed);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = H[x + z * 16], bio = BI[x + z * 16];
      const wx = bx + x, wz = bz + z;
      const beach = h >= SEA - 2 && h <= SEA + 1;
      const under = h < SEA - 2;
      const sub = this.nx.n2(wx / 12, wz / 12);
      const vd = bio === BIOME.VOLC ? this.volcano(wx, wz) : null;
      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        const depth = h - y;
        if (y === 0) id = B.BEDROCK;
        else if (y < 5 && rng() < (5 - y) / 5 * 0.85) id = B.BEDROCK;
        else if (bio === BIOME.DESERT && !under) {
          if (depth < 4) id = B.SAND; else if (depth < 7) id = B.SANDSTONE;
        } else if (under) {
          if (depth < 3) id = sub > 0.35 ? B.GRAVEL : sub < -0.45 ? B.CLAY : (depth === 0 && sub > 0 ? B.SAND : B.DIRT);
          if (depth === 0 && sub > -0.1 && sub < 0.35) id = B.SAND;
        } else if (bio === BIOME.VOLC && !beach) {   // вулканическая порода
          if (depth < 4) { const r = hash3(wx, y, wz, 77); id = depth === 0 ? (r < 0.3 ? B.COBBLE : r < 0.5 ? B.GRAVEL : r < 0.58 ? B.COAL_ORE : r < 0.7 && vd < VOLC.RR + 10 ? B.OBSIDIAN : B.STONE) : (r < 0.3 ? B.COBBLE : B.STONE); }
        } else if (beach && bio !== BIOME.SNOW) {
          if (depth < 3) id = B.SAND; else if (depth < 5) id = B.SANDSTONE;
        } else if (bio === BIOME.MOUNT) {
          if (h > 104 && depth === 0) id = B.SNOW;
          else if (depth < 3 && h < 101 + sub * 4) id = depth === 0 ? B.GRASS : B.DIRT;
        } else {
          if (depth === 0) id = bio === BIOME.SNOW ? B.SNOW_GRASS : (bio === BIOME.SPRUCE && sub > -0.3) ? B.PODZOL : B.GRASS;
          else if (depth < 4) id = B.DIRT;
        }
        Bk[x + (z << 4) + (y << 8)] = id;
      }
      if (vd !== null && vd < VOLC.RR) for (let y = h + 1; y <= VOLC.LAVA; y++) Bk[x + (z << 4) + (y << 8)] = B.LAVA;   // кратер полон лавы
      for (let y = h + 1; y <= SEA; y++) Bk[x + (z << 4) + (y << 8)] = B.WATER;
      if (h < SEA) c.hasWater = true;
      // пещеры
      const lakeLv = 9 + Math.floor((this.c3.n3((bx + x) / 90 + 3.3, 1.5, (bz + z) / 90 - 9.1) + 1) * 5.5);   // уровень подземных лавовых озёр
      const cTop = (h <= SEA + 2) ? h - 6 : h;
      for (let y = 1; y <= cTop; y++) {
        const i = x + (z << 4) + (y << 8);
        if (Bk[i] === B.BEDROCK) continue;
        const a = samp(N1, x, y, z), b = samp(N2, x, y, z);
        let cave = a * a + b * b < 0.0075;
        if (!cave && y < 50) { const cv = samp(N3, x, y, z); cave = cv > 0.6 - (50 - y) * 0.002; }
        if (cave) Bk[i] = y <= lakeLv ? B.LAVA : B.AIR;
      }
    }
    // руды
    const vein = (id, count, y0, y1, size) => {
      for (let k = 0; k < count; k++) {
        let x = Math.floor(rng() * 16), y = Math.floor(y0 + rng() * (y1 - y0)), z = Math.floor(rng() * 16);
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < WH) {
            const i = x + (z << 4) + (y << 8);
            if (Bk[i] === B.STONE) Bk[i] = id;
          }
          const r = rng();
          if (r < 0.33) x += rng() < 0.5 ? 1 : -1; else if (r < 0.66) z += rng() < 0.5 ? 1 : -1; else y += rng() < 0.5 ? 1 : -1;
        }
      }
    };
    vein(B.DIRT, 6, 20, 90, 18); vein(B.GRAVEL, 5, 10, 70, 16);
    vein(B.COAL_ORE, 18, 5, 110, 10); vein(B.IRON_ORE, 12, 5, 64, 7);
    vein(B.GOLD_ORE, 3, 5, 32, 6); vein(B.DIAMOND_ORE, 2, 3, 16, 5);
    // подземелье
    if (rng() < 0.1) this.dungeon(c, H, rng);
    // одинокий факел в пещере (кто его поставил?)
    if (rng() < 0.22) {
      for (let t = 0; t < 12; t++) {
        const x = 1 + Math.floor(rng() * 14), z = 1 + Math.floor(rng() * 14), h = H[x + z * 16];
        const y = 12 + Math.floor(rng() * Math.max(1, h - 20));
        const i = x + (z << 4) + (y << 8);
        if (Bk[i] === B.AIR && SOLID[Bk[i - 256]] && OPQ[Bk[i - 256]] && Bk[i + 256] === B.AIR) { Bk[i] = B.TORCH; break; }
      }
    }
    // лавовые лужи на поверхности (редко, не рядом со стартом)
    if (rng() < 0.07 && (Math.abs(bx) > 48 || Math.abs(bz) > 48)) {
      const cx0 = 4 + Math.floor(rng() * 8), cz0 = 4 + Math.floor(rng() * 8), R = 2 + rng() * 1.8, h0 = H[cx0 + cz0 * 16];
      if (h0 > SEA + 2 && h0 < 112 && BI[cx0 + cz0 * 16] !== BIOME.SNOW) {
        for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx0 + dx, z = cz0 + dz;
          if (x < 0 || x > 15 || z < 0 || z > 15 || Math.hypot(dx, dz) > R * (0.78 + 0.22 * rng())) continue;
          const h = H[x + z * 16];
          if (Math.abs(h - h0) > 1 || h <= SEA + 1) continue;
          const i = x + (z << 4) + (h << 8);
          Bk[i] = B.LAVA; if (OPQ[Bk[i - 256]]) Bk[i - 256] = B.LAVA;
        }
      }
    }
    // поверхность: деревья, трава, цветы
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = H[x + z * 16], bio = BI[x + z * 16];
      if (h <= SEA || h > 114) continue;
      const i = x + (z << 4) + (h << 8), top = Bk[i];
      if (Bk[i + 256] !== B.AIR) continue;
      const inner = x >= 2 && x <= 13 && z >= 2 && z <= 13;
      if (bio === BIOME.SPRUCE && (top === B.GRASS || top === B.PODZOL)) {   // еловая чаща: ели почти вплотную, среди них высокие и великаны
        const r = rng(), t = rng(), inner3 = x >= 3 && x <= 12 && z >= 3 && z <= 12, inner4 = x >= 4 && x <= 11 && z >= 4 && z <= 11, inner5 = x >= 5 && x <= 10 && z >= 5 && z <= 10;
        if (inner3 && r < 0.1) {
          if (t > 0.97) this.deadTree(Bk, x, h, z, rng);
          else if (t < 0.07 && inner5) this.spruce(Bk, x, h, z, rng, 2);
          else if (t < 0.3 && inner4) this.spruce(Bk, x, h, z, rng, 1);
          else this.spruce(Bk, x, h, z, rng, 0);
          continue;
        }
        const g = rng();
        if (g < 0.09) Bk[i + 256] = B.TALLGRASS; else if (g > 0.9992) Bk[i + 256] = B.PUMPKIN;
        continue;
      }
      if (top === B.GRASS || top === B.SNOW_GRASS) {
        const r = rng();
        const treeP = bio === BIOME.FOREST ? 0.045 : bio === BIOME.SNOW ? 0.012 : bio === BIOME.MOUNT ? 0.006 : 0.005;
        if (inner && r < treeP) {
          const t = rng();
          if (bio === BIOME.FOREST && t < 0.35) this.tree(Bk, x, h, z, B.BIRCH_LOG, B.BIRCH_LEAVES, 5, rng);
          else if (t > 0.965 || (bio === BIOME.SNOW && t > 0.6)) this.deadTree(Bk, x, h, z, rng);
          else this.tree(Bk, x, h, z, B.LOG, B.LEAVES, 4, rng);
          continue;
        }
        if (top === B.GRASS) {
          const g = rng();
          if (g < (bio === BIOME.PLAINS ? 0.2 : 0.1)) Bk[i + 256] = B.TALLGRASS;
          else if (g < 0.215) Bk[i + 256] = rng() < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW;
          else if (g > 0.9985) Bk[i + 256] = B.PUMPKIN;
        }
      } else if (top === B.SAND && bio === BIOME.DESERT) {
        const r = rng();
        if (r < 0.012) Bk[i + 256] = B.DEAD_BUSH;
        else if (r < 0.032 && x >= 1 && x <= 14 && z >= 1 && z <= 14) {   // кактус: 1–3 блока, вокруг пусто
          const ch = 1 + Math.floor(rng() * 3); let ok = true;
          for (let k = 1; k <= ch && ok; k++) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (Bk[(x + dx) + ((z + dz) << 4) + ((h + k) << 8)] !== B.AIR) { ok = false; break; }
          if (ok) for (let k = 1; k <= ch; k++) Bk[i + (k << 8)] = B.CACTUS;
        }
      }
    }
    let mY = 0;
    for (let i = CVOL - 1; i >= 0; i--) if (Bk[i]) { mY = (i >> 8) + 1; break; }
    c.maxY = Math.max(mY, SEA + 1);
  }
  tree(Bk, x, y, z, log, leaves, base, rng) {
    const th = base + Math.floor(rng() * 3);
    if (y + th + 2 >= WH) return;
    Bk[x + (z << 4) + (y << 8)] = B.DIRT;
    for (let ly = y + th - 2; ly <= y + th + 1; ly++) {
      const top = ly >= y + th, r = top ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (ly === y + th + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && (top || rng() < 0.5)) continue;
        const i = (x + dx) + ((z + dz) << 4) + (ly << 8);
        if (Bk[i] === B.AIR || Bk[i] === B.TALLGRASS) Bk[i] = leaves;
      }
    }
    for (let k = 1; k <= th; k++) Bk[x + (z << 4) + ((y + k) << 8)] = log;
  }
  // ель: высокий ствол и густой ярусный конус хвои; kind 0 — обычная, 1 — высокая, 2 — великан
  spruce(Bk, x, y, z, rng, kind = 0) {
    const th = kind === 2 ? 26 + Math.floor(rng() * 9) : kind === 1 ? 16 + Math.floor(rng() * 7) : 9 + Math.floor(rng() * 6);
    const top = y + th + 1, low = kind === 2 ? 9 : kind === 1 ? 6 : 4, cap = kind === 2 ? 5 : kind === 1 ? 4 : 3, step = kind === 2 ? 3.6 : kind === 1 ? 3.1 : 2.6;
    if (top + 1 >= WH) return;
    Bk[x + (z << 4) + (y << 8)] = B.PODZOL;
    const crown = top - (y + low);
    for (let k = 0; k <= crown; k++) {
      const ly = top - k;
      let r = k === 0 ? 0 : Math.min(cap, 1 + Math.floor((k - 1) / step));
      if (k > 2 && k % 2 === 0) r = Math.max(1, r - 1);          // ярусы: чередуются широкие и узкие слои
      if (k >= crown - 1) r = Math.min(r, cap - 1);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (r >= 2 && Math.abs(dx) + Math.abs(dz) > r + (r >> 1) + 1) continue;   // скруглённые углы
        const i = (x + dx) + ((z + dz) << 4) + (ly << 8);
        if (Bk[i] === B.AIR || Bk[i] === B.TALLGRASS) Bk[i] = B.SPRUCE_LEAVES;
      }
    }
    for (let k = 1; k <= th; k++) Bk[x + (z << 4) + ((y + k) << 8)] = B.SPRUCE_LOG;
  }
  deadTree(Bk, x, y, z, rng) {
    const th = 4 + Math.floor(rng() * 3);
    if (y + th + 2 >= WH) return;
    for (let k = 1; k <= th; k++) Bk[x + (z << 4) + ((y + k) << 8)] = B.LOG;
    const br = 1 + Math.floor(rng() * 2);
    for (let b = 0; b < br; b++) {
      const d = Math.floor(rng() * 4), dx = [1, -1, 0, 0][d], dz = [0, 0, 1, -1][d];
      const by = y + th - 1 - b;
      Bk[(x + dx) + ((z + dz) << 4) + (by << 8)] = B.LOG;
      Bk[(x + dx * 2) + ((z + dz * 2) << 4) + ((by + 1) << 8)] = B.LOG;
    }
  }
  dungeon(c, H, rng) {
    const Bk = c.blocks;
    const cx = 4 + Math.floor(rng() * 8), cz = 4 + Math.floor(rng() * 8), y0 = 14 + Math.floor(rng() * 28);
    for (const [ax, az] of [[cx - 4, cz - 4], [cx + 4, cz + 4], [cx - 4, cz + 4], [cx + 4, cz - 4]])
      if (H[ax + az * 16] < y0 + 10) return;
    for (let y = y0; y <= y0 + 5; y++) for (let z = cz - 4; z <= cz + 4; z++) for (let x = cx - 4; x <= cx + 4; x++) {
      const wall = y === y0 || y === y0 + 5 || x === cx - 4 || x === cx + 4 || z === cz - 4 || z === cz + 4;
      const i = x + (z << 4) + (y << 8);
      if (wall) { if (Bk[i] !== B.AIR || y === y0) Bk[i] = (y === y0 && rng() < 0.6) || rng() < 0.3 ? B.MOSSY : B.COBBLE; }
      else Bk[i] = B.AIR;
    }
    Bk[(cx - 3) + ((cz) << 4) + ((y0 + 1) << 8)] = B.CHEST;
    if (rng() < 0.4) Bk[(cx + 3) + ((cz - 1) << 4) + ((y0 + 1) << 8)] = B.CHEST;
    if (rng() < 0.6) Bk[(cx + 1) + ((cz + 2) << 4) + ((y0 + 1) << 8)] = B.TORCH;
    if (rng() < 0.3) Bk[(cx) + ((cz - 3) << 4) + ((y0 + 1) << 8)] = B.BOOKSHELF;
  }
}
function lootFor(x, y, z) {
  const r = mulberry32(Math.floor(hash3(x, y, z, World.seed) * 1e9));
  const pool = [[I.COAL, 3, 12], [I.IRON, 1, 5], [I.GOLD, 1, 4], [I.STICK, 2, 8], [B.TORCH, 2, 10], [I.DIAMOND, 1, 2], [B.PUMPKIN, 1, 2], [B.OBSIDIAN, 1, 3], [TOOL_ID.pick_iron, 1, 1], [B.WOOL, 1, 4]];
  const slots = new Array(27).fill(null);
  const n = 3 + Math.floor(r() * 5);
  for (let k = 0; k < n; k++) {
    const p = pool[Math.floor(r() * (r() < 0.4 ? 5 : pool.length))];
    const cnt = p[1] + Math.floor(r() * (p[2] - p[1] + 1));
    slots[Math.floor(r() * 27)] = { id: p[0], count: cnt, dmg: 0 };
  }
  return slots;
}
