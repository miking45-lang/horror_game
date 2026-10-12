// ============================================================
//  Процедурные текстуры 16×16 (оригинальные, в духе старых воксельных игр)
// ============================================================
const ATLAS_SIZE = 256, TS = 16, ATLAS_COLS = 16;
const TILE = {};
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = ATLAS_SIZE;
const atlasCtx = atlasCanvas.getContext('2d');
const atlasImg = atlasCtx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
let tileCount = 0;

class Tile {
  constructor(seed) { this.d = new Uint8ClampedArray(TS * TS * 4); this.r = mulberry32(seed); }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= TS || y >= TS) return;
    const i = (y * TS + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  get(x, y) { const i = (y * TS + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  alpha(x, y) { if (x < 0 || y < 0 || x >= TS || y >= TS) return 0; return this.d[(y * TS + x) * 4 + 3]; }
  copy(o) { this.d.set(o.d); return this; }
  pick(pal) { return pal[Math.floor(this.r() * pal.length)]; }
}
function C(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
function shade(c, f) { return [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)]; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
// бесшовный value-noise для тайла
function tileNoise(r, cell) {
  const n = TS / cell, g = [];
  for (let i = 0; i < n * n; i++) g.push(r());
  return (x, y) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
    const v = (a, b) => g[((b % n + n) % n) * n + ((a % n + n) % n)];
    return lerp(lerp(v(x0, y0), v(x0 + 1, y0), tx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
  };
}
function wrapD(a, b) { let d = Math.abs(a - b); return Math.min(d, TS - d); }
function voronoi(r, n) {
  const pts = []; for (let i = 0; i < n; i++) pts.push([r() * TS, r() * TS, r()]);
  return (x, y) => {
    let d1 = 1e9, d2 = 1e9, id = 0, dx0 = 0, dy0 = 0;
    for (let i = 0; i < n; i++) {
      const dx = wrapD(x + 0.5, pts[i][0]), dy = wrapD(y + 0.5, pts[i][1]);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
    }
    let sx = (x + 0.5) - pts[id][0]; if (sx > 8) sx -= 16; if (sx < -8) sx += 16;
    let sy = (y + 0.5) - pts[id][1]; if (sy > 8) sy -= 16; if (sy < -8) sy += 16;
    return { d1, d2, id, v: pts[id][2], sx, sy };
  };
}
function addTile(name, fn) {
  const t = new Tile(strSeed(name) ^ 0x5eed);
  fn(t);
  const idx = tileCount++;
  TILE[name] = idx;
  const ox = (idx % ATLAS_COLS) * TS, oy = Math.floor(idx / ATLAS_COLS) * TS;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const si = (y * TS + x) * 4, di = ((oy + y) * ATLAS_SIZE + ox + x) * 4;
    for (let k = 0; k < 4; k++) atlasImg.data[di + k] = t.d[si + k];
  }
  TILES_DATA[name] = t; TILES_ARR[idx] = t;
  return idx;
}
const TILES_DATA = {}, TILES_ARR = [];

// ---------- базовые генераторы ----------
function genStone(t, base = 124, spread = 26) {
  const n = tileNoise(t.r, 4), n2 = tileNoise(t.r, 2);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let v = n(x, y) * 0.5 + n2(x, y) * 0.25 + t.r() * 0.25;
    v = Math.round(v * 5) / 5;
    const g = base - spread / 2 + v * spread;
    t.set(x, y, [g, g, g + 1]);
  }
}
function genCobble(t, mortar = [62, 62, 62], lo = 96, hi = 150, moss = false) {
  const vr = voronoi(t.r, 9), mn = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const o = vr(x, y);
    if (o.d2 - o.d1 < 1.15) { t.set(x, y, shade(mortar, 0.85 + t.r() * 0.3)); continue; }
    let g = lo + o.v * (hi - lo) + (t.r() - 0.5) * 12;
    if (o.sx < -0.8 && o.sy < -0.8) g += 16;
    if (o.d2 - o.d1 < 2.2 && (o.sx > 0.5 || o.sy > 0.5)) g -= 16;
    let c = [g, g, g];
    if (moss && mn(x, y) > 0.55 && t.r() < 0.85) c = shade(t.pick([C('#4e7a34'), C('#5d8c3c'), C('#3f6a2b')]), 0.85 + t.r() * 0.3);
    t.set(x, y, c);
  }
}
const DIRT_PAL = [C('#79553a'), C('#866043'), C('#966c4a'), C('#6a4b34'), C('#9b7456')];
function genDirt(t) {
  const n = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let v = n(x, y) * 0.6 + t.r() * 0.4;
    let c = DIRT_PAL[clamp(Math.floor(v * 4), 0, 3)];
    if (t.r() < 0.05) c = DIRT_PAL[4];
    t.set(x, y, c);
  }
}
const GRASS_PAL = [C('#557f33'), C('#5f8d38'), C('#4b732d'), C('#6a9a40'), C('#628f3a')];
function genGrassTop(t) {
  const n = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) * 0.4 + t.r() * 0.6;
    t.set(x, y, GRASS_PAL[clamp(Math.floor(v * 5), 0, 4)]);
  }
}
function genSideFringe(t, pal, dark) {
  genDirt(t);
  for (let x = 0; x < TS; x++) {
    let d = 3 + (t.r() < 0.45 ? 1 : 0) + (t.r() < 0.18 ? 1 : 0);
    for (let y = 0; y < d; y++) t.set(x, y, y === d - 1 ? dark : t.pick(pal));
  }
}
function genRings(t, bark, light, dark) {
  const n = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
    const d = Math.max(dx, dy) * 0.7 + Math.hypot(dx, dy) * 0.3;
    if (x === 0 || y === 0 || x === 15 || y === 15) { t.set(x, y, shade(bark, 0.85 + t.r() * 0.3)); continue; }
    const ring = Math.floor(d + n(x, y) * 0.8);
    t.set(x, y, shade(ring % 2 ? dark : light, 0.93 + t.r() * 0.12));
  }
}
function genPlanks(t, base = C('#9c7b4b'), seam = C('#5d4526')) {
  for (let b = 0; b < 4; b++) {
    const tone = 0.9 + t.r() * 0.18, sx = Math.floor(t.r() * 16);
    for (let yy = 0; yy < 4; yy++) {
      const y = b * 4 + yy;
      let streak = t.r();
      for (let x = 0; x < TS; x++) {
        if (t.r() < 0.25) streak = t.r();
        let c = shade(base, tone * (0.9 + streak * 0.16));
        if (yy === 3) c = shade(seam, 0.9 + t.r() * 0.2);
        else if (x === sx) c = shade(seam, 1.1);
        t.set(x, y, c);
      }
    }
  }
}
function genLeaves(t, pal) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (t.r() < 0.2) { t.set(x, y, [20, 40, 10], 0); continue; }
    t.set(x, y, t.pick(pal));
  }
}
function genOre(t, cols) {
  genStone(t);
  const blobs = 4 + Math.floor(t.r() * 2);
  for (let b = 0; b < blobs; b++) {
    const bx = 1 + Math.floor(t.r() * 13), by = 1 + Math.floor(t.r() * 13);
    const shape = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [-1, 1]];
    const k = 3 + Math.floor(t.r() * 4);
    for (let i = 0; i < k; i++) {
      const [ox, oy] = shape[i];
      const c = i === 0 ? cols[2] : (ox + oy >= 2 ? cols[1] : cols[0]);
      t.set(bx + ox, by + oy, c);
    }
  }
}
function genSimpleNoise(t, pal, cell = 4, w = 0.4) {
  const n = tileNoise(t.r, cell);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) * w + t.r() * (1 - w);
    t.set(x, y, pal[clamp(Math.floor(v * pal.length), 0, pal.length - 1)]);
  }
}
function drawPixels(t, rows, map) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x]; if (ch === '.' || ch === ' ') continue;
    const c = map[ch]; if (c) t.set(x, y, typeof c === 'function' ? c(x, y) : c);
  }
}

// ---------- блоки ----------
addTile('stone', t => genStone(t));
addTile('cobble', t => genCobble(t));
addTile('mossy', t => genCobble(t, [55, 60, 52], 92, 140, true));
addTile('dirt', genDirt);
addTile('grass_top', genGrassTop);
addTile('grass_side', t => genSideFringe(t, GRASS_PAL, C('#44692a')));
addTile('snow_side', t => genSideFringe(t, [C('#f2f6fb'), C('#e4ecf4'), C('#d6e0ea')], C('#c3cedb')));
addTile('snow', t => genSimpleNoise(t, [C('#d2dce8'), C('#e0e8f1'), C('#edf2f8'), C('#f7fafc')], 4, 0.5));
addTile('sand', t => genSimpleNoise(t, [C('#c9bd87'), C('#d6cb96'), C('#dcd29f'), C('#e2d9a9')], 2, 0.2));
addTile('sandstone_side', t => {
  genSimpleNoise(t, [C('#cbbf86'), C('#d4c891'), C('#dbd09c')], 2, 0.3);
  for (let x = 0; x < TS; x++) {
    t.set(x, 0, C('#e3d9a8')); t.set(x, 1, C('#dcd19e'));
    t.set(x, 4, C('#b9ad75')); t.set(x, 11, C('#b5a970')); t.set(x, 15, C('#a99d64'));
  }
});
addTile('sandstone_top', t => genSimpleNoise(t, [C('#d6cb96'), C('#dcd29f'), C('#e0d6a5')], 4, 0.6));
addTile('gravel', t => {
  const vr = voronoi(t.r, 22);
  const pal = [C('#827c78'), C('#64605e'), C('#968e88'), C('#766a62'), C('#54504e'), C('#8a8078')];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const o = vr(x, y);
    let c = pal[Math.floor(o.v * pal.length)];
    if (o.d2 - o.d1 < 0.7) c = shade(c, 0.72);
    else if (o.sx < -0.4 && o.sy < -0.4) c = shade(c, 1.15);
    t.set(x, y, c);
  }
});
addTile('log_side', t => {
  const cols = [C('#665131'), C('#554328'), C('#765e3a'), C('#4a3a22')];
  const colv = []; for (let x = 0; x < TS; x++) colv.push(t.r());
  for (let x = 0; x < TS; x++) {
    let v = colv[x];
    for (let y = 0; y < TS; y++) {
      if (t.r() < 0.12) v = t.r();
      const furrow = (x % 4 === 1) ? 0.75 : 1;
      t.set(x, y, shade(cols[Math.floor(v * 3)], furrow * (0.95 + t.r() * 0.1)));
    }
  }
});
addTile('log_top', t => genRings(t, C('#5d4a2d'), C('#b8945f'), C('#9c7a49')));
addTile('birch_side', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#d8d6cc'), 0.9 + t.r() * 0.12));
  for (let i = 0; i < 9; i++) {
    const y = Math.floor(t.r() * 16), x0 = Math.floor(t.r() * 16), len = 2 + Math.floor(t.r() * 4);
    for (let k = 0; k < len; k++) t.set((x0 + k) % 16, y, k === 0 || k === len - 1 ? C('#5a5850') : C('#2c2b27'));
  }
});
addTile('birch_top', t => genRings(t, C('#d8d6cc'), C('#d6c48e'), C('#bfa874')));
addTile('planks', t => genPlanks(t));
addTile('leaves', t => genLeaves(t, [C('#3a6e20'), C('#305e1a'), C('#468028'), C('#285016'), C('#528c30')]));
addTile('birch_leaves', t => genLeaves(t, [C('#5f8a3a'), C('#557d34'), C('#6b9844'), C('#4c7030')]));
addTile('spruce_side', t => {
  const cols = [C('#43301d'), C('#352616'), C('#52402a'), C('#2a1d10')];
  const colv = []; for (let x = 0; x < TS; x++) colv.push(t.r());
  for (let x = 0; x < TS; x++) {
    let v = colv[x];
    for (let y = 0; y < TS; y++) {
      if (t.r() < 0.1) v = t.r();
      const furrow = (x % 3 === 1) ? 0.7 : 1;
      t.set(x, y, shade(cols[Math.floor(v * 3.99)], furrow * (0.92 + t.r() * 0.12)));
    }
  }
});
addTile('spruce_top', t => genRings(t, C('#3b2a18'), C('#9a7a48'), C('#6f5530')));
addTile('spruce_leaves', t => genLeaves(t, [C('#1c4529'), C('#163a22'), C('#235233'), C('#12301c'), C('#2b623b')]));
addTile('podzol_top', t => genSimpleNoise(t, [C('#4d3419'), C('#5c3f1e'), C('#3f2a14'), C('#6b4a23'), C('#7a5628')], 4, 0.6));
addTile('podzol_side', t => genSideFringe(t, [C('#4d3419'), C('#5c3f1e'), C('#3f2a14'), C('#6b4a23')], C('#33210f')));
addTile('water', t => {
  const n = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y);
    const c = v > 0.62 ? C('#4d78d4') : v > 0.4 ? C('#3761c0') : C('#2d52ad');
    t.set(x, y, shade(c, 0.95 + t.r() * 0.1), 190);
  }
});
addTile('lava', t => {
  const n = tileNoise(t.r, 4), n2 = tileNoise(t.r, 2);
  const pal = [C('#a8290a'), C('#cf4a0c'), C('#e8700f'), C('#f79a1c'), C('#ffc83a')];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) * 0.7 + n2(x, y) * 0.3;
    t.set(x, y, pal[clamp(Math.floor(v * 5.5 - 0.3), 0, 4)]);
  }
});
addTile('glass', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) t.set(x, y, (x + y) % 5 === 0 ? C('#9fb8c0') : C('#d8eef2'), 255);
    else t.set(x, y, [200, 230, 240], 0);
  }
  for (let k = 0; k < 4; k++) { t.set(3 + k, 5 - k, C('#ffffff'), 220); t.set(9 + k, 12 - k, C('#ffffff'), 200); }
  t.set(4, 5, C('#ffffff'), 160);
});
addTile('bedrock', t => {
  const n = tileNoise(t.r, 2);
  const pal = [C('#151515'), C('#2e2e2e'), C('#4a4a4a'), C('#6a6a6a'), C('#8a8a8a')];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) * 0.6 + t.r() * 0.4;
    t.set(x, y, pal[clamp(Math.floor(v * 5), 0, 4)]);
  }
});
addTile('coal_ore', t => genOre(t, [C('#2a2a2a'), C('#141414'), C('#444444')]));
addTile('iron_ore', t => genOre(t, [C('#caa289'), C('#9c7560'), C('#ead0bc')]));
addTile('gold_ore', t => genOre(t, [C('#f0d23c'), C('#b8961c'), C('#fff39a')]));
addTile('diamond_ore', t => genOre(t, [C('#4fd8e0'), C('#239aa2'), C('#b8fbff')]));
addTile('bricks', t => {
  const pal = [C('#8f4535'), C('#9c4e3c'), C('#843d2f'), C('#a65a46')];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 12;
    if (y % 4 === 3 || (x + 16 - off) % 8 === 0) { t.set(x, y, shade(C('#a49c90'), 0.9 + t.r() * 0.15)); continue; }
    let c = t.pick(pal); if (y % 4 === 0) c = shade(c, 1.1);
    t.set(x, y, c);
  }
});
addTile('stone_bricks', t => {
  genStone(t, 120, 16);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const top = y < 8, vx = top ? 15 : 7;
    const ly = y % 8;
    if (ly === 7 || x === vx) t.set(x, y, C('#4e4e50'));
    else if (ly === 0 || x === (vx + 1) % 16) t.set(x, y, C('#9c9c9e'));
    else if (ly === 6 || x === vx - 1) t.set(x, y, C('#6a6a6c'));
  }
});
addTile('table_top', t => {
  genPlanks(t, C('#a78655'));
  for (let i = 0; i < TS; i++) {
    t.set(i, 0, C('#5a4222')); t.set(i, 15, C('#5a4222')); t.set(0, i, C('#5a4222')); t.set(15, i, C('#5a4222'));
    if (i > 0 && i < 15) { t.set(5, i, C('#6e522c')); t.set(10, i, C('#6e522c')); t.set(i, 5, C('#6e522c')); t.set(i, 10, C('#6e522c')); }
  }
  [[1, 1], [14, 1], [1, 14], [14, 14]].forEach(([x, y]) => t.set(x, y, C('#8a8a8a')));
});
function tableSide(t, front) {
  genPlanks(t, C('#8c6c40'));
  for (let x = 0; x < TS; x++) { t.set(x, 0, C('#b08c58')); t.set(x, 1, C('#a07e4c')); t.set(x, 2, C('#5a4222')); }
  for (let y = 3; y < TS; y++) { t.set(0, y, C('#5a4222')); t.set(15, y, C('#5a4222')); }
  if (front) {
    // молоток
    drawPixels(t, [
      '................', '................', '................', '................',
      '...ggggg........', '...gGGGg........', '...ggggg........', '.....h..........',
      '.....h..........', '.....h..........', '.....h..........', '.....h..........',
      '.....h..........', '................', '................', '................'],
      { g: C('#6d6d6d'), G: C('#9a9a9a'), h: C('#4a3218') });
    // клещи
    drawPixels(t, [
      '................', '................', '................', '................',
      '..........g..g..', '..........g..g..', '...........gg...', '...........gg...',
      '..........h..h..', '..........h..h..', '.........h....h.', '.........h....h.',
      '................', '................', '................', '................'],
      { g: C('#7a7a7a'), h: C('#4a3218') });
  } else {
    // пила
    drawPixels(t, [
      '................', '................', '................', '................',
      '..hh............', '..hhwwwwwwwwww..', '..hhwwwwwwwwww..', '..hh.v.v.v.v.v..',
      '................', '................', '................', '................',
      '................', '................', '................', '................'],
      { h: C('#4a3218'), w: C('#a8a8a8'), v: C('#7a7a7a') });
    drawPixels(t, [
      '................', '................', '................', '................',
      '................', '................', '................', '................',
      '................', '...kkkkkkkkkk...', '...k........k...', '...kkkkkkkkkk...',
      '................', '................', '................', '................'],
      { k: C('#5a4222') });
  }
}
addTile('table_side', t => tableSide(t, false));
addTile('table_front', t => tableSide(t, true));
function furnaceBase(t) {
  genStone(t, 118, 30);
  for (let i = 0; i < TS; i++) { t.set(i, 0, C('#9a9a9a')); t.set(0, i, C('#8e8e8e')); t.set(i, 15, C('#4c4c4c')); t.set(15, i, C('#555555')); }
}
addTile('furnace_side', furnaceBase);
addTile('furnace_top', t => { genStone(t, 132, 14); for (let i = 0; i < TS; i++) { t.set(i, 0, C('#6a6a6a')); t.set(i, 15, C('#6a6a6a')); t.set(0, i, C('#6a6a6a')); t.set(15, i, C('#6a6a6a')); } });
function furnaceFront(t, lit) {
  furnaceBase(t);
  for (let x = 2; x < 14; x++) { t.set(x, 3, C('#3c3c3c')); t.set(x, 4, C('#a8a8a8')); }
  for (let y = 7; y < 14; y++) for (let x = 3; x < 13; x++) {
    const border = y === 7 || x === 3 || x === 12;
    if (border) { t.set(x, y, C('#3a3a3a')); continue; }
    if (!lit) t.set(x, y, shade(C('#161616'), 0.8 + t.r() * 0.4));
    else {
      const h = (13 - y) / 6 + t.r() * 0.35;
      t.set(x, y, h > 0.95 ? C('#3a1a08') : h > 0.7 ? C('#d8500c') : h > 0.4 ? C('#f39420') : C('#ffd860'));
    }
  }
  for (let x = 3; x < 13; x++) t.set(x, 14, C('#5a5a5a'));
}
addTile('furnace_front', t => furnaceFront(t, false));
addTile('furnace_lit', t => furnaceFront(t, true));
function chestBase(t) {
  genPlanks(t, C('#8a5f2c'), C('#4d3214'));
  for (let i = 0; i < TS; i++) { t.set(i, 0, C('#3c260e')); t.set(i, 15, C('#3c260e')); t.set(0, i, C('#3c260e')); t.set(15, i, C('#3c260e')); }
}
addTile('chest_side', t => { chestBase(t); for (let x = 1; x < 15; x++) t.set(x, 5, C('#3c260e')); });
addTile('chest_top', chestBase);
addTile('chest_front', t => {
  chestBase(t); for (let x = 1; x < 15; x++) t.set(x, 5, C('#3c260e'));
  drawPixels(t, ['', '', '', '', '.......kk.......', '......kggk......', '......kGgk......', '......kggk......', '.......kk.......'],
    { k: C('#2a2a2a'), g: C('#b4b4b4'), G: C('#e8e8e8') });
});
addTile('torch', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [0, 0, 0], 0);
  const rows = { 4: [C('#fff7c8'), C('#ffe98a')], 5: [C('#ffd23c'), C('#ffb91e')], 6: [C('#e8781a'), C('#c85a12')] };
  for (const y in rows) { t.set(7, +y, rows[y][0]); t.set(8, +y, rows[y][1]); }
  for (let y = 7; y < 16; y++) { t.set(7, y, C('#8a6a30')); t.set(8, y, C('#5e4620')); }
});
addTile('tallgrass', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [0, 0, 0], 0);
  for (let b = 0; b < 9; b++) {
    let x = 1 + t.r() * 13; const h = 5 + Math.floor(t.r() * 8), lean = (t.r() - 0.5) * 0.5;
    const c = t.pick(GRASS_PAL);
    for (let k = 0; k < h; k++) { t.set(Math.round(x), 15 - k, shade(c, 0.8 + k / h * 0.4)); x += lean; }
  }
});
function flower(t, petal, petalD, center) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [0, 0, 0], 0);
  drawPixels(t, [
    '................', '................', '................', '......pPp.......',
    '.....pPcPp......', '.....PcCcP......', '.....pPcPp......', '......pPp.......',
    '.......s........', '.......s........', '.....ll s.......', '......lls.......',
    '.......s.ll.....', '.......sll......', '.......s........', '.......s........'],
    { p: petalD, P: petal, c: center, C: shade(center, 0.7), s: C('#3f7a24'), l: C('#4e8e2e') });
}
addTile('flower_red', t => flower(t, C('#d0302a'), C('#9a1c18'), C('#f2d24a')));
addTile('flower_yellow', t => flower(t, C('#f2d83a'), C('#c9a91c'), C('#d86a1a')));
addTile('dead_bush', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [0, 0, 0], 0);
  drawPixels(t, [
    '................', '................', '..b.........b...', '...b.......b....',
    '....b..b..b.....', '.b...b.b.b...b..', '..b...bbb...b...', '...b...b...b....',
    '....bb.b.bb.....', '......bbb.......', '.......b........', '.......b........',
    '.......b........', '......bb........', '.......b........', '.......b........'],
    { b: C('#7a5a2a') });
});
function pumpkinSide(t) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const rib = x % 4 === 0 ? 0.78 : x % 4 === 2 ? 1.08 : 1;
    t.set(x, y, shade(C('#c9731a'), rib * (0.93 + t.r() * 0.1)));
  }
  for (let x = 0; x < TS; x++) { t.set(x, 0, shade(C('#a85a10'), 1)); t.set(x, 15, shade(C('#8e4a0c'), 1)); }
}
addTile('pumpkin_side', pumpkinSide);
addTile('pumpkin_top', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const a = Math.atan2(y - 7.5, x - 7.5), r = Math.hypot(x - 7.5, y - 7.5);
    const rib = Math.cos(a * 8) > 0.6 ? 0.8 : 1;
    t.set(x, y, shade(C('#c9731a'), rib * (0.9 + t.r() * 0.1) * (1.05 - r / 30)));
  }
  drawPixels(t, ['', '', '', '', '', '', '.......gg.......', '......gGGg......', '......gGGg......', '.......gg.......'],
    { g: C('#4e5e1c'), G: C('#6b7d28') });
});
function pumpkinFace(t, glow) {
  pumpkinSide(t);
  const d = glow ? (x, y) => ((x + y) % 3 ? C('#ffd23c') : C('#fff09a')) : C('#3a1c06');
  drawPixels(t, [
    '................', '................', '................', '...X......X.....',
    '..XXX....XXX....', '.XXXXX..XXXXX...', '................', '................',
    '................', '..X..X..X..X.X..', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...',
    '....X..X..X.....', '................', '................', '................'],
    { X: d });
}
addTile('pumpkin_face', t => pumpkinFace(t, false));
addTile('jack_face', t => pumpkinFace(t, true));
addTile('bookshelf', t => {
  genPlanks(t);
  const pal = [C('#7a2222'), C('#27466e'), C('#2f6a2e'), C('#8a6a22'), C('#5a2e6e'), C('#3e3e3e'), C('#6e3a1c')];
  for (const y0 of [1, 9]) {
    let x = 1;
    while (x < 15) {
      const w = t.r() < 0.35 ? 2 : 1, c = t.pick(pal), h = 5 + (t.r() < 0.4 ? 1 : 0);
      for (let k = 0; k < w && x < 15; k++, x++) for (let y = 0; y < 6; y++) {
        if (y < 6 - h) t.set(x, y0 + y, C('#2a1c0e'));
        else t.set(x, y0 + y, y === 6 - h ? shade(c, 1.35) : shade(c, 0.9 + t.r() * 0.2));
      }
      if (t.r() < 0.2 && x < 15) { for (let y = 0; y < 6; y++) t.set(x, y0 + y, C('#2a1c0e')); x++; }
    }
  }
});
addTile('clay', t => genSimpleNoise(t, [C('#9aa0ae'), C('#a2a8b6'), C('#aab0be'), C('#949aa8')], 4, 0.3));
addTile('obsidian', t => {
  const n = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) * 0.6 + t.r() * 0.4;
    let c = v > 0.78 ? C('#3e2c5e') : v > 0.55 ? C('#1f172e') : v > 0.3 ? C('#140f1f') : C('#0c0914');
    if (t.r() < 0.03) c = C('#6a4e96');
    t.set(x, y, c);
  }
});
addTile('wool', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const w = ((x + y) % 4 < 2 ? 1 : 0.93) * (0.95 + t.r() * 0.07);
    t.set(x, y, shade(C('#e6e6e2'), w));
  }
});
addTile('lantern', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const fr = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8;
    if (fr) { t.set(x, y, shade(C('#3c3c42'), (x < 1 || y < 1) ? 1.4 : 0.85 + t.r() * 0.3)); continue; }
    const cx = x < 7 ? 4.5 : 10.5, cy = y < 7 ? 4.5 : 10.5, r = Math.hypot(x - cx, y - cy);
    t.set(x, y, r < 1.3 ? C('#fff4c4') : r < 2.4 ? C('#ffd873') : C('#e7a43a'));
  }
});
function genBucket(t, fill) {
  clearTile(t);
  const metal = C('#c4c4c8');
  for (let y = 4; y <= 14; y++) {
    const hw = Math.round(6 - (y - 4) * 0.32), x0 = 8 - hw, x1 = 7 + hw;
    for (let x = x0; x <= x1; x++) {
      let c = x === x0 ? shade(metal, 0.72) : x === x1 ? shade(metal, 0.82) : shade(metal, 0.92 + ((x + y) % 3) * 0.04);
      if (y === 4) c = shade(metal, 1.12);
      if (y === 14) c = shade(metal, 0.7);
      t.set(x, y, c);
    }
    if (y === 5 && fill) for (let x = x0 + 1; x < x1; x++) t.set(x, y, fill[(x + y) % 2]);
    if (y === 5 && !fill) for (let x = x0 + 1; x < x1; x++) t.set(x, y, [58, 58, 64]);
  }
  for (const [x, y] of [[3, 4], [3, 3], [4, 2], [5, 2], [6, 1], [7, 1], [8, 1], [9, 1], [10, 2], [11, 2], [12, 3], [12, 4]]) t.set(x, y, C('#8f8f96'));
  outlineSprite(t, 0.5);
}
addTile('bucket', t => genBucket(t, null));
addTile('bucket_water', t => genBucket(t, [C('#3a6fd8'), C('#4b86ee')]));
addTile('bucket_lava', t => genBucket(t, [C('#ff8a1a'), C('#ffc23a')]));
addTile('cactus_side', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let c = mixc(C('#2c7a2e'), C('#3f9a3b'), ((x % 5) === 2 ? 0.8 : 0.25) + t.r() * 0.2);
    if (x === 0 || x === 15) c = shade(c, 0.7);
    if ((x === 2 || x === 7 || x === 12) && (y % 4 === 1)) c = C('#e8e2a0');       // колючки
    t.set(x, y, c);
  }
});
addTile('cactus_top', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let c = mixc(C('#3f9a3b'), C('#52b04a'), t.r() * 0.5);
    if (x < 1 || y < 1 || x > 14 || y > 14) c = C('#2a6f2a');
    if (x === 7 || x === 8 || y === 7 || y === 8) c = shade(c, 0.85);
    t.set(x, y, c);
  }
});
addTile('sleeve', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { let c = mixc(C('#3f6aa6'), C('#4e7dbd'), ((x + y) % 4) / 6 + t.r() * 0.15); if (y % 5 === 0) c = shade(c, 0.88); t.set(x, y, c); } });
addTile('skin', t => genSimpleNoise(t, [C('#c4906a'), C('#c99670'), C('#bf8a64')], 4, 0.3));
addTile('shadow', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade([14, 12, 16], 0.8 + t.r() * 0.4)); });
addTile('white', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [255, 255, 255]); });
addTile('blood', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#6e0606'), 0.65 + t.r() * 0.55)); });

// ---------- трещины разрушения ----------
(function () {
  const r = mulberry32(777);
  const pts = [];
  // случайные ветвящиеся трещины из центра
  const walkers = [];
  for (let i = 0; i < 6; i++) walkers.push({ x: 7 + r() * 2, y: 7 + r() * 2, a: r() * PI2 });
  for (let step = 0; step < 60; step++) {
    for (const w of walkers) {
      w.a += (r() - 0.5) * 1.1; w.x += Math.cos(w.a); w.y += Math.sin(w.a);
      const x = Math.floor(w.x), y = Math.floor(w.y);
      if (x >= 0 && y >= 0 && x < 16 && y < 16) pts.push([x, y]);
    }
    if (r() < 0.08 && walkers.length < 14) { const w = walkers[Math.floor(r() * walkers.length)]; walkers.push({ x: w.x, y: w.y, a: w.a + (r() < 0.5 ? 1 : -1) }); }
  }
  for (let s = 0; s < 10; s++) {
    addTile('crack' + s, t => {
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [128, 128, 128], 255);
      const n = Math.floor(pts.length * (s + 1) / 10);
      for (let i = 0; i < n; i++) t.set(pts[i][0], pts[i][1], i % 3 ? [40, 40, 40] : [70, 70, 70], 255);
    });
  }
})();

// ---------- предметы (спрайты) ----------
function outlineSprite(t, dark = 0.4) {
  const add = [];
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (t.alpha(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (t.alpha(x + dx, y + dy)) { const c = t.get(x + dx, y + dy); add.push([x, y, shade(c, dark)]); break; }
    }
  }
  for (const [x, y, c] of add) t.set(x, y, c);
}
function clearTile(t) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [0, 0, 0], 0); }
// координаты вдоль рукояти: u (к верху-справа), v (перпендикуляр)
const HANDLE = { ax: 2.5, ay: 13.5, dx: Math.SQRT1_2, dy: -Math.SQRT1_2 };
function hUV(x, y) {
  const px = x + 0.5 - HANDLE.ax, py = y + 0.5 - HANDLE.ay;
  return [px * HANDLE.dx + py * HANDLE.dy, px * -HANDLE.dy + py * HANDLE.dx];
}
function drawHandle(t, len) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const [u, v] = hUV(x, y);
    if (u >= -0.3 && u <= len && Math.abs(v) < 0.75) t.set(x, y, (x + y) % 2 ? C('#7a5a2c') : C('#5a4020'));
  }
}
const MAT = {
  wood: [C('#9a7442'), C('#bf9660'), C('#6e5028')],
  stone: [C('#8a8a8a'), C('#adadad'), C('#626262')],
  iron: [C('#d6d6d6'), C('#f4f4f4'), C('#a2a2a2')],
  gold: [C('#f0d040'), C('#fff08a'), C('#c09a1e')],
  diamond: [C('#4cdcd2'), C('#aefaf4'), C('#23a098')]
};
function headPix(t, x, y, m, u, v) {
  const c = (u + v < -1.5) ? m[1] : (u + v > 2.5 ? m[2] : m[0]);
  t.set(x, y, c);
}
function genPick(t, m) {
  clearTile(t); drawHandle(t, 11.2);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const [u, v] = hUV(x, y);
    // дуга: центр на рукояти
    const cu = 3.2, d = Math.hypot(u - cu, v), ang = Math.atan2(v, u - cu);
    const lim = 1.02; // рад
    if (Math.abs(ang) < lim && d > 7.4 && d < 9.4 - Math.abs(ang) * 0.9) headPix(t, x, y, m, u - 10, v);
  }
  outlineSprite(t);
}
function genAxe(t, m) {
  clearTile(t); drawHandle(t, 11.5);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const [u, v] = hUV(x, y);
    if (u > 6.2 && u < 11.8 && v > 0.3 && v < 1.2 + (u - 6) * 0.55 && v < 4.6) headPix(t, x, y, m, 8 - u, -v + 1);
    if (u > 9.5 && u < 11.8 && v < 0.3 && v > -1.4) headPix(t, x, y, m, 0, 3);
  }
  outlineSprite(t);
}
function genShovel(t, m) {
  clearTile(t); drawHandle(t, 8.2);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const [u, v] = hUV(x, y);
    const inRect = u > 8 && u < 13.2 && Math.abs(v) < 2.1;
    const tip = u >= 13.2 && Math.hypot((u - 13.2) * 1.2, v) < 2.1;
    if (inRect || tip) headPix(t, x, y, m, 10 - u, v);
  }
  outlineSprite(t);
}
function genSword(t, m) {
  clearTile(t);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const [u, v] = hUV(x, y);
    if (u >= -0.8 && u < 3 && Math.abs(v) < 0.75) t.set(x, y, (x + y) % 2 ? C('#7a5a2c') : C('#5a4020'));            // рукоять
    else if (u >= 3 && u < 4.4 && Math.abs(v) < 2.5) t.set(x, y, Math.abs(v) < 1 ? C('#6a6a70') : C('#8b8b92'));        // гарда
    else if (u >= 4.4 && u < 14.8) {                                                                                 // клинок
      const tip = u > 12.5 ? (14.8 - u) / 2.3 : 1, w = 1.15 * tip + 0.15;
      if (Math.abs(v) < w) t.set(x, y, v > 0.25 ? m[1] : v < -0.35 ? m[2] : m[0]);
    }
  }
  outlineSprite(t);
}
const ARMOR_SHAPES = {
  helmet: ['', '', '....########....', '...##########...', '...##########...', '...##########...', '...###....###...', '...##......##...', '...##......##...'],
  chest: ['', '..###......###..', '..####....####..', '..############..', '..############..', '..############..', '...##########...', '...##########...', '...##########...', '...##########...', '...##########...'],
  legs: ['', '..############..', '..############..', '..############..', '..###......###..', '..###......###..', '..###......###..', '..###......###..', '..###......###..', '..###......###..'],
  boots: ['', '', '', '...###....###...', '...###....###...', '...###....###...', '..####....####..', '..####....####..', '.#####....#####.']
};
function genArmor(t, m, kind) {
  clearTile(t);
  const rows = ARMOR_SHAPES[kind], oy = kind === 'boots' ? 3 : kind === 'helmet' ? 2 : 1;
  const on = (x, y) => { const r = rows[y - oy]; return !!r && r[x] === '#'; };
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (!on(x, y)) continue;
    let c = m[0];
    if (!on(x, y - 1) || !on(x - 1, y)) c = m[1]; else if (!on(x, y + 1) || !on(x + 1, y)) c = m[2];
    else if ((x * 7 + y * 13) % 5 === 0) c = m[2];
    t.set(x, y, c);
  }
  if (kind === 'helmet') { for (let x = 6; x <= 9; x++) t.set(x, 6 + 0, m[2]); }
  outlineSprite(t);
}
for (const k of ['iron', 'gold', 'diamond']) for (const kind of ['helmet', 'chest', 'legs', 'boots']) addTile('armor_' + kind + '_' + k, t => genArmor(t, MAT[k], kind));
for (const k of Object.keys(MAT)) addTile('sword_' + k, t => genSword(t, MAT[k]));
for (const k of Object.keys(MAT)) {
  addTile('pick_' + k, t => genPick(t, MAT[k]));
  addTile('axe_' + k, t => genAxe(t, MAT[k]));
  addTile('shovel_' + k, t => genShovel(t, MAT[k]));
}
addTile('stick', t => { clearTile(t); drawHandle(t, 13); outlineSprite(t, 0.5); });
addTile('coal', t => {
  clearTile(t);
  drawPixels(t, ['', '', '', '......aab.......', '....aabbbba.....', '...abbcbbbbb....', '...bbbbbbcbba...', '..abbbbbbbbbb...',
    '..bbcbbbbbbbba..', '..abbbbbbcbbb...', '...bbbbbbbbba...', '....abbbbbb.....', '......aabb......'],
    { a: C('#3a3a3a'), b: C('#1c1c1c'), c: C('#5a5a5a') });
  outlineSprite(t, 0.6);
});
addTile('charcoal', t => {
  clearTile(t);
  drawPixels(t, ['', '', '', '......aab.......', '....aabbbba.....', '...abbcbbbbb....', '...bbbbbbcbba...', '..abbbbbbbbbb...',
    '..bbcbbbbbbbba..', '..abbbbbbcbbb...', '...bbbbbbbbba...', '....abbbbbb.....', '......aabb......'],
    { a: C('#4a3a2c'), b: C('#241a12'), c: C('#6a5440') });
  outlineSprite(t, 0.6);
});
function ingot(t, m) {
  clearTile(t);
  drawPixels(t, ['', '', '', '', '', '.......hhhh.....', '.....hhhHHmm....', '...hhhHHHmmmd...', '..mhHHHmmmmddd..', '..mmmmmmmddddd..',
    '...dmmmmmddddd..', '.....ddmmddd....', '.......ddd......'],
    { h: m[1], H: shade(m[1], 1.05), m: m[0], d: m[2] });
  outlineSprite(t, 0.45);
}
addTile('iron_ingot', t => ingot(t, MAT.iron));
addTile('gold_ingot', t => ingot(t, MAT.gold));
addTile('diamond', t => {
  clearTile(t);
  drawPixels(t, ['', '', '', '.....hhhhhh.....', '....hHHmmmmd....', '...hHHmmmmmmd...', '..hHmmmmmmmmdd..', '...dmmmmmmmdd...',
    '....dmmmmmmd....', '.....dmmmmd.....', '......dmmd......', '.......dd.......'],
    { h: C('#d8fffb'), H: C('#ffffff'), m: C('#4cdcd2'), d: C('#239a92') });
  outlineSprite(t, 0.4);
});

// ---------- Мутант ----------
addTile('mut_body', t => {
  const n = tileNoise(t.r, 4), n2 = tileNoise(t.r, 2);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const v = n(x, y) * 0.6 + n2(x, y) * 0.4;
    let c = mixc(C('#070608'), C('#1c1a1f'), v);
    if (v > 0.78) c = C('#2c2a31');             // влажный блик
    if (t.r() < 0.03) c = C('#231417');         // тёмные прожилки
    t.set(x, y, c);
  }
  for (let k = 0; k < 3; k++) { let x = Math.floor(t.r() * 16); for (let y = 0; y < 16; y++) { if (t.r() < 0.3) x = (x + (t.r() < 0.5 ? 1 : 15)) % 16; t.set(x, y, C('#1e1216')); } }
});
addTile('mut_rib', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#2a272c'), 0.8 + t.r() * 0.35)); });
addTile('mut_skin', t => {
  const n = tileNoise(t.r, 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let c = mixc(C('#6f6c5f'), C('#8f8b79'), n(x, y));
    if ((x + Math.floor(y / 3)) % 7 === 0 && t.r() < 0.7) c = shade(c, 1.18);   // натянутые складки
    t.set(x, y, shade(c, 0.93 + t.r() * 0.1));
  }
  for (let k = 0; k < 4; k++) {                      // вены
    let x = Math.floor(t.r() * 16), y = Math.floor(t.r() * 16);
    for (let s = 0; s < 9; s++) { t.set(x & 15, y & 15, C('#6b6668')); x += t.r() < 0.5 ? 1 : 0; y += t.r() < 0.6 ? 1 : -1; }
  }
});
addTile('teeth', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, (x % 4 === 3) ? C('#6b5f45') : shade(C('#d6ccb0'), 0.85 + t.r() * 0.2));
});
addTile('claw', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#b9ae95'), 0.8 + t.r() * 0.3)); });
addTile('socket', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, [4 + t.r() * 6, 3, 4]); });
addTile('glow_red', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const r = Math.hypot(x - 7.5, y - 7.5) / 8; t.set(x, y, r < 0.45 ? C('#fff0d0') : r < 0.8 ? C('#ff6a3a') : C('#d81c10')); } });
addTile('glint', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const r = Math.hypot(x - 7.5, y - 7.5);
    t.set(x, y, r < 3 ? C('#fff6e6') : r < 6 ? C('#e8d9c0') : C('#a8977a'));
  }
});


// ---------- Телевизор ----------
function tvBezel(t, light) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let c = shade(C('#3b3a3d'), 0.9 + t.r() * 0.15);
    if (x === 0 || y === 0 || x === 15) c = shade(c, 0.7);
    t.set(x, y, c);
  }
  t.set(12, 14, light ? C('#e24b3b') : C('#5a2420')); t.set(13, 14, light ? C('#e24b3b') : C('#5a2420'));
  for (let x = 3; x < 9; x += 2) t.set(x, 14, C('#1d1c1e'));
}
addTile('tv_side', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#34333a'), 0.9 + t.r() * 0.18));
  for (let y = 3; y < 13; y += 2) for (let x = 3; x < 13; x++) t.set(x, y, C('#1a191d'));
});
addTile('tv_top', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#3b3a40'), 0.9 + t.r() * 0.15)); t.set(7, 7, C('#222')); t.set(8, 7, C('#222')); });
addTile('tv_off', t => {
  tvBezel(t, false);
  for (let y = 1; y <= 12; y++) for (let x = 1; x <= 14; x++) {
    let c = mixc(C('#14171a'), C('#262c30'), (x + y) / 26);
    if ((x - y + 20) % 11 === 0 && y < 9) c = shade(c, 1.5);
    t.set(x, y, c);
  }
});
// динамический экран: рисуется каждый кадр (режимы anim / static / face)
addTile('tv_screen', t => { tvBezel(t, true); for (let y = 1; y <= 12; y++) for (let x = 1; x <= 14; x++) t.set(x, y, C('#5b8fd0')); });
function tvScreenData(mode, time, out) {
  const base = new Uint8ClampedArray(TS * TS * 4);
  const put = (x, y, c) => { const i = (y * TS + x) * 4; base[i] = c[0]; base[i + 1] = c[1]; base[i + 2] = c[2]; base[i + 3] = 255; };
  const tl = new Tile(1); tvBezel(tl, true);
  base.set(tl.d);
  const W = 14, H = 12, X0 = 1, Y0 = 1, rnd = Math.random;
  if (mode === 'anim') {
    // зацикленный мультик: холмы едут, солнце ходит по кругу, облако плывёт
    const ph = (time * 2.2) % 16, sp = (time / 7) % 1;
    const sx = 7 + Math.cos(sp * PI2) * 5.5, sy = 6 - Math.sin(sp * PI2) * 3.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + ph) * PI2 / 16;
      const ridge = 7.2 + Math.sin(u) * 1.6 + Math.sin(u * 2 + 1) * 0.9;
      const ridge2 = 9 + Math.sin(u * 1.0 + 2.2) * 1.1;
      let c = mixc(C('#3d7fd6'), C('#9fd0f2'), y / H);
      if (Math.hypot(x - sx, (y - sy) * 1.1) < 1.9) c = C('#ffe27a');
      const cx = ((x + ph * 0.5) % 16 + 16) % 16;
      if (y >= 1 && y <= 3 && ((cx > 2 && cx < 7 && y === 2) || (cx > 3 && cx < 6 && (y === 1 || y === 3)))) c = C('#f4f7ff');
      if (y > ridge) c = mixc(C('#5d6f9a'), C('#46567c'), (y - ridge) / 3);
      if (y > ridge2) c = (x + Math.floor(ph)) % 4 < 2 ? C('#3f9a46') : C('#348a3c');
      put(X0 + x, Y0 + y, c);
    }
    // строки развёртки
    for (let y = 1; y < H; y += 2) for (let x = 0; x < W; x++) { const i = ((Y0 + y) * TS + X0 + x) * 4; base[i] *= 0.88; base[i + 1] *= 0.88; base[i + 2] *= 0.88; }
  } else {
    const band = Math.floor(time * 14) % H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 40 + rnd() * 190;
      if (Math.abs(y - band) < 2) v = v * 0.5 + 110;
      const g = v | 0; put(X0 + x, Y0 + y, [g, g, Math.min(255, g + 8)]);
    }
    if (mode === 'face') {
      // бледное лицо с чёрными глазницами посреди помех
      const flick = 0.75 + 0.25 * Math.sin(time * 9) + (rnd() < 0.07 ? -0.4 : 0);
      for (let y = 2; y <= 11; y++) for (let x = 4; x <= 11; x++) {
        const nx = (x - 7.5) / 4.0, ny = (y - 6.6) / 5.2;
        if (nx * nx + ny * ny > 1) continue;
        if (rnd() < 0.18) continue;
        let c = mixc(C('#d6d1be'), C('#908c7c'), Math.abs(nx) * 0.8);
        if ((y === 6 || y === 7) && ((x >= 5 && x <= 6) || (x >= 9 && x <= 10))) c = [6, 5, 6];
        if (y === 10 && x >= 6 && x <= 9) c = [30, 24, 24];
        put(X0 + x - 1 + 0, Y0 + y - 1, c.map(v => v * flick));
      }
    }
  }
  out.set(base);
  return out;
}


// ---------- Двери и стеклянные панели ----------
function genDoorWood(t, upper) {
  const base = C('#8c6a3a'), dark = C('#4e3a1e'), light = C('#a98652');
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const streak = 0.92 + ((x * 7 + (x >> 1) * 3) % 5) * 0.03 + t.r() * 0.05;
    t.set(x, y, shade(base, streak));
  }
  // рама
  for (let i = 0; i < TS; i++) { t.set(i, 0, dark); t.set(i, 15, dark); t.set(0, i, dark); t.set(15, i, dark); t.set(1, i, shade(base, 0.8)); t.set(14, i, shade(base, 0.8)); }
  const panel = (x0, y0, x1, y1) => {
    for (let x = x0; x <= x1; x++) { t.set(x, y0, dark); t.set(x, y1, light); }
    for (let y = y0; y <= y1; y++) { t.set(x0, y, dark); t.set(x1, y, light); }
    for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) t.set(x, y, shade(base, 0.82 + t.r() * 0.08));
  };
  if (upper) {   // верхняя половина: четыре окошка-филёнки
    panel(3, 2, 6, 6); panel(9, 2, 12, 6); panel(3, 9, 6, 13); panel(9, 9, 12, 13);
  } else {       // нижняя половина: две большие филёнки и ручка
    panel(3, 2, 12, 6); panel(3, 9, 12, 14);
    t.set(12, 1, C('#d8d0b8')); t.set(12, 2, C('#a89e84')); t.set(11, 1, C('#7a7260'));
  }
}
function genDoorIron(t, upper) {
  const base = C('#c4c6ca');
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(base, 0.93 + t.r() * 0.1));
  for (let i = 0; i < TS; i++) { t.set(i, 0, C('#8a8c92')); t.set(i, 15, C('#8a8c92')); t.set(0, i, C('#8a8c92')); t.set(15, i, C('#8a8c92')); }
  const rivet = (x, y) => { t.set(x, y, C('#e8eaee')); t.set(x + 1, y + 1, C('#7c7e84')); };
  if (upper) {
    for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) {
      const bar = (x === 5 || x === 8 || x === 11) || (y === 5 || y === 8 || y === 11);
      t.set(x, y, bar ? C('#9a9ca2') : C('#3c3e44'));
    }
    rivet(2, 2); rivet(13, 2); rivet(2, 13); rivet(13, 13);
  } else {
    for (let y = 2; y <= 13; y++) { t.set(2, y, C('#9a9ca2')); t.set(13, y, C('#9a9ca2')); }
    for (let x = 2; x <= 13; x++) { t.set(x, 2, C('#9a9ca2')); t.set(x, 13, C('#9a9ca2')); t.set(x, 8, C('#9a9ca2')); }
    rivet(3, 3); rivet(11, 3); rivet(3, 9); rivet(11, 9);
    t.set(12, 1, C('#f0f0f4')); t.set(12, 2, C('#b8bac0')); t.set(11, 1, C('#7c7e84'));
  }
}
addTile('door_wood_lo', t => genDoorWood(t, false));
addTile('door_wood_hi', t => genDoorWood(t, true));
addTile('door_iron_lo', t => genDoorIron(t, false));
addTile('door_iron_hi', t => genDoorIron(t, true));
function genDoorItem(t, wood) {
  clearTile(t);
  const A = wood ? [C('#8c6a3a'), C('#4e3a1e'), C('#a98652'), C('#d8d0b8')] : [C('#c4c6ca'), C('#8a8c92'), C('#e8eaee'), C('#f0f0f4')];
  for (let y = 1; y <= 14; y++) for (let x = 4; x <= 11; x++) {
    let c = shade(A[0], 0.94 + ((x + y) % 3) * 0.04);
    if (x === 4 || y === 1 || y === 14 || x === 11) c = A[1];
    else if (x === 5 || y === 2) c = A[2];
    t.set(x, y, c);
  }
  if (wood) { for (const [x0, y0] of [[6, 3], [9, 3]]) for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 2; x++) t.set(x, y, A[1]); for (let y = 8; y <= 12; y++) for (let x = 6; x <= 9; x++) t.set(x, y, shade(A[0], 0.8)); }
  else { for (let y = 3; y <= 6; y++) for (let x = 6; x <= 9; x++) t.set(x, y, (x + y) % 2 ? C('#3c3e44') : C('#6c6e74')); }
  t.set(9, 8, A[3]);
  outlineSprite(t, 0.45);
}
addTile('door_wood_item', t => genDoorItem(t, true));
addTile('door_iron_item', t => genDoorItem(t, false));
// ---------- другие игроки (сетевая игра) ----------
addTile('av_skin', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#c4906a'), 0.94 + t.r() * 0.08)); });
addTile('av_hair', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#3b2a1e'), 0.85 + t.r() * 0.25)); });
addTile('av_face', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#c4906a'), 0.94 + t.r() * 0.08));
  for (let y = 0; y < 4; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#3b2a1e'), 0.85 + t.r() * 0.25));
  for (const x0 of [3, 10]) { t.set(x0, 7, C('#ffffff')); t.set(x0 + 1, 7, C('#2a3a8a')); t.set(x0, 8, C('#ffffff')); t.set(x0 + 1, 8, C('#2a3a8a')); }
  for (let x = 6; x <= 9; x++) t.set(x, 12, C('#7a4a36'));
  t.set(7, 10, C('#a87454')); t.set(8, 10, C('#a87454'));
});
addTile('av_side', t => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#c4906a'), 0.94 + t.r() * 0.08));
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (y < 5 || (x > 9 && y < 11)) t.set(x, y, shade(C('#3b2a1e'), 0.85 + t.r() * 0.25));
});
addTile('av_shirt', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#3e8a8c'), 0.9 + t.r() * 0.12)); });
addTile('av_shirt2', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#7a1e22'), 0.9 + t.r() * 0.12)); });
addTile('av_pants', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#3a3f8a'), 0.88 + t.r() * 0.12)); });
// ---------- лестница и люки ----------
addTile('ladder', t => {
  clearTile(t);
  const wood = C('#8c6a3a'), dark = C('#4e3a1e'), light = C('#a98652');
  for (let y = 0; y < TS; y++) for (const x of [2, 3, 12, 13]) t.set(x, y, (x === 2 || x === 12) ? light : shade(wood, 0.85 + ((y * 5) % 3) * 0.06));
  for (let y = 0; y < TS; y++) { t.set(1, y, dark); t.set(4, y, dark); t.set(11, y, dark); t.set(14, y, dark); }
  for (const y0 of [1, 5, 9, 13]) for (let x = 5; x <= 10; x++) { t.set(x, y0, light); t.set(x, y0 + 1, shade(wood, 0.9)); t.set(x, y0 + 2, dark); }
});
addTile('trap_wood', t => {
  const base = C('#8c6a3a'), dark = C('#4e3a1e'), light = C('#a98652');
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(base, 0.92 + ((x * 7 + (x >> 1) * 3) % 5) * 0.03 + t.r() * 0.05));
  for (let i = 0; i < TS; i++) { t.set(i, 0, dark); t.set(i, 15, dark); t.set(0, i, dark); t.set(15, i, dark); }
  // шесть окошек-прорезей
  for (const [x0, y0] of [[2, 2], [7, 2], [12, 2], [2, 9], [7, 9], [12, 9]]) for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x0 + 2; x++) t.set(x, y, [0, 0, 0], 0);
  for (let i = 1; i < 15; i++) { t.set(i, 7, light); t.set(i, 8, dark); }
});
addTile('trap_iron', t => {
  const base = C('#c4c6ca');
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(base, 0.93 + t.r() * 0.1));
  for (let i = 0; i < TS; i++) { t.set(i, 0, C('#8a8c92')); t.set(i, 15, C('#8a8c92')); t.set(0, i, C('#8a8c92')); t.set(15, i, C('#8a8c92')); }
  for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) if ((x + y) % 3 === 0) t.set(x, y, [0, 0, 0], 0); else if ((x + y) % 3 === 1) t.set(x, y, C('#9a9ca2'));
  for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13]]) { t.set(x, y, C('#e8eaee')); t.set(x + 1, y + 1, C('#7c7e84')); }
});
addTile('pane_edge', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, (x + y) % 4 === 0 ? C('#a9c6cf') : C('#d8eef2')); });
addTile('pane_item', t => {
  clearTile(t);
  for (let y = 1; y <= 14; y++) for (let x = 5; x <= 10; x++) {
    const edge = x === 5 || x === 10 || y === 1 || y === 14;
    t.set(x, y, edge ? C('#d8eef2') : C('#b4dcea'), edge ? 255 : 200);
  }
  for (let k = 0; k < 4; k++) t.set(6 + (k >> 1), 3 + k * 2, C('#ffffff'), 230);
  outlineSprite(t, 0.55);
});


// ---------- рычаг, кнопки, глина, кирпич ----------
addTile('lever_stick', t => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t.set(x, y, shade(C('#8c6a3a'), 0.85 + ((x + y) % 3) * 0.06 + t.r() * 0.05)); });
addTile('lever_item', t => {
  clearTile(t);
  for (let y = 11; y <= 14; y++) for (let x = 4; x <= 11; x++) t.set(x, y, (x + y) % 3 ? C('#8a8a8a') : C('#6e6e6e'));
  for (let i = 0; i < 9; i++) { const x = 8 - Math.round(i * 0.5), y = 11 - i; t.set(x, y, C('#9a7a46')); t.set(x + 1, y, C('#7a5c30')); }
  t.set(3, 1, C('#b89258')); t.set(4, 1, C('#9a7a46')); t.set(3, 2, C('#8c6a3a'));
  outlineSprite(t, 0.45);
});
function genBtnItem(t, fn, edge) {
  clearTile(t);
  for (let y = 6; y <= 10; y++) for (let x = 4; x <= 11; x++) {
    let c = fn(x, y);
    if (x === 4 || y === 6) c = shade(c, 1.15); if (x === 11 || y === 10) c = shade(c, 0.78);
    t.set(x, y, c);
  }
  outlineSprite(t, 0.45);
}
addTile('btn_stone_item', t => genBtnItem(t, (x, y) => shade(C('#8a8a8a'), 0.92 + ((x * 3 + y * 5) % 4) * 0.04)));
addTile('btn_wood_item', t => genBtnItem(t, (x, y) => shade(C('#9c7b4b'), 0.9 + ((x + y * 2) % 3) * 0.06)));
addTile('clay_ball', t => {
  clearTile(t);
  drawPixels(t, ['', '', '', '', '.....hhhh.....', '...hhHHHHmmm...', '..hHHHmmmmmmd..', '..hHmmmmmmmmd..', '..hmmmmmmmmdd..', '..mmmmmmmmddd..',
    '...mmmmmmddd...', '....ddmmddd....'], { h: C('#c4cbd6'), H: C('#d9dfe8'), m: C('#a5adbb'), d: C('#7e8696') });
  outlineSprite(t, 0.5);
});
addTile('brick_item', t => {
  clearTile(t);
  for (let y = 5; y <= 11; y++) for (let x = 2; x <= 13; x++) {
    let c = shade(C('#a8503a'), 0.92 + ((x * 7 + y * 3) % 5) * 0.03);
    if (y === 5) c = shade(C('#c4684e'), 1.0); if (y === 11) c = shade(C('#6e3022'), 1.0); if (x === 13) c = shade(c, 0.8);
    t.set(x, y, c);
  }
  outlineSprite(t, 0.45);
});

atlasCtx.putImageData(atlasImg, 0, 0);

// тайл → uv (в пикселях атласа)
function tileUV(idx) { return [(idx % ATLAS_COLS) * TS, Math.floor(idx / ATLAS_COLS) * TS]; }
