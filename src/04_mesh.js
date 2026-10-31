// ============================================================
//  Построение геометрии чанков (сглаженный свет + ambient occlusion)
// ============================================================
const PX = 18, PXZ = 324, PYN = 130;
const padB = new Uint8Array(PXZ * PYN), padL = new Uint8Array(PXZ * PYN);
const POS = 32, UVS = 16; // единицы: 1/32 блока, 1/16 пикселя атласа

class MeshBuf {
  constructor() { this.cap = 1 << 14; this.alloc(); this.n = 0; }
  alloc() { this.ab = new ArrayBuffer(this.cap * 16); this.u16 = new Uint16Array(this.ab); this.u8 = new Uint8Array(this.ab); }
  grow() { const old = this.u8; this.cap *= 2; this.alloc(); this.u8.set(old); }
  v(x, y, z, u, v, sky, blk, sh, fl) {
    if (this.n >= this.cap) this.grow();
    const o = this.n << 3, b = this.n << 4;
    this.u16[o] = x; this.u16[o + 1] = y; this.u16[o + 2] = z; this.u16[o + 3] = 0;
    this.u16[o + 4] = u; this.u16[o + 5] = v;
    this.u8[b + 12] = sky; this.u8[b + 13] = blk; this.u8[b + 14] = sh; this.u8[b + 15] = fl;
    this.n++;
  }
  data() { return this.u8.subarray(0, this.n * 16); }
}
const MB_OPAQUE = new MeshBuf(), MB_CUT = new MeshBuf(), MB_WATER = new MeshBuf();

const poff = (x, y, z) => x + z * PX + y * PXZ;
// грани: +X, -X, +Y, -Y, +Z, -Z
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }
];
const SU = [-1, 1, 1, -1], SV = [-1, -1, 1, 1];
const FACE_SHADE = [0.62, 0.62, 1.0, 0.5, 0.8, 0.8];
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];
for (const F of FACES) {
  F.no = poff(F.n[0], F.n[1], F.n[2]);
  F.uo = poff(F.u[0], F.u[1], F.u[2]);
  F.vo = poff(F.v[0], F.v[1], F.v[2]);
  F.corner = [];
  for (let c = 0; c < 4; c++) {
    const p = [0, 1, 2].map(k => 0.5 + 0.5 * (F.n[k] + SU[c] * F.u[k] + SV[c] * F.v[k]));
    F.corner.push({ p, tu: (SU[c] + 1) / 2, tv: (1 - SV[c]) / 2 });
  }
}
const ORIENT_FACE = [4, 1, 5, 0]; // 0:юг(+Z) 1:запад(-X) 2:север(-Z) 3:восток(+X)
const OPP = [1, 0, 3, 2, 5, 4];

function fillPad(c) {
  const top = Math.min(WH - 1, c.maxY + 1);
  const srcs = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) srcs.push(World.chunks.get(ckey(c.cx + dx, c.cz + dz)));
  for (let pz = 0; pz < PX; pz++) for (let px = 0; px < PX; px++) {
    const lx = px - 1, lz = pz - 1;
    const s = srcs[((lz >> 4) + 1) * 3 + (lx >> 4) + 1];
    const sx = lx & 15, sz = lz & 15;
    const col = px + pz * PX;
    padB[col] = B.BEDROCK; padL[col] = 0;
    if (!s) { for (let y = 0; y <= top; y++) { padB[col + (y + 1) * PXZ] = B.STONE; padL[col + (y + 1) * PXZ] = 0; } continue; }
    const sb = s.blocks, sl = s.light;
    let si = sx + (sz << 4), pi = col + PXZ;
    for (let y = 0; y <= top; y++, si += 256, pi += PXZ) { padB[pi] = sb[si]; padL[pi] = sl[si]; }
    if (top + 2 < PYN) { padB[col + (top + 2) * PXZ] = 0; padL[col + (top + 2) * PXZ] = 240; }
  }
}

function faceVisible(id, nid) {
  if (nid === 0) return true;
  if (OPQ[nid]) return false;
  if (nid === id) return id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES;
  const d = BLK[id];
  if (d.render === R_LIQUID && BLK[nid].render === R_LIQUID) return false;
  return true;
}

const _ao = [0, 0, 0, 0], _sk = [0, 0, 0, 0], _bl = [0, 0, 0, 0];
function cubeFace(mb, x, y, z, pi, f, tile, topH, liquid, flag) {
  const F = FACES[f];
  const fi = pi + F.no;
  const tx = (tile % ATLAS_COLS) * TS * UVS, ty = Math.floor(tile / ATLAS_COLS) * TS * UVS;
  const shadeF = FACE_SHADE[f];
  if (liquid) {
    const l = padL[fi];
    for (let c = 0; c < 4; c++) { _ao[c] = 3; _sk[c] = (l >> 4) * 17; _bl[c] = (l & 15) * 17; }
  } else {
    for (let c = 0; c < 4; c++) {
      const s1 = fi + SU[c] * F.uo, s2 = fi + SV[c] * F.vo, cc = s1 + SV[c] * F.vo;
      const o1 = OPQ[padB[s1]], o2 = OPQ[padB[s2]], oc = OPQ[padB[cc]];
      _ao[c] = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
      let l = padL[fi], sk = l >> 4, bl = l & 15, n = 1;
      if (!o1) { l = padL[s1]; sk += l >> 4; bl += l & 15; n++; }
      if (!o2) { l = padL[s2]; sk += l >> 4; bl += l & 15; n++; }
      if (!oc && !(o1 && o2)) { l = padL[cc]; sk += l >> 4; bl += l & 15; n++; }
      _sk[c] = Math.round(sk * 17 / n); _bl[c] = Math.round(bl * 17 / n);
    }
  }
  const flip = (_ao[0] + _ao[2] + (_sk[0] + _sk[2] + _bl[0] + _bl[2]) / 64) < (_ao[1] + _ao[3] + (_sk[1] + _sk[3] + _bl[1] + _bl[3]) / 64);
  for (let k = 0; k < 4; k++) {
    const c = flip ? (k + 1) & 3 : k;
    const C = F.corner[c];
    const py = C.p[1] === 1 ? topH : C.p[1];
    const u = tx + (C.tu ? TS * UVS - 1 : 1), v = ty + (C.tv ? TS * UVS - 1 : 1);
    mb.v((x + C.p[0]) * POS, (y + py) * POS, (z + C.p[2]) * POS, u, v, _sk[c], _bl[c], Math.round(255 * shadeF * AO_CURVE[_ao[c]]), flag);
  }
}
function quad(mb, pts, uvs, sky, blk, sh) {
  for (let k = 0; k < 4; k++) mb.v(Math.round(pts[k][0] * POS), Math.round(pts[k][1] * POS), Math.round(pts[k][2] * POS), uvs[k][0], uvs[k][1], sky, blk, sh, 0);
}
function crossMesh(mb, x, y, z, tile, l) {
  const tx = (tile % ATLAS_COLS) * TS * UVS, ty = Math.floor(tile / ATLAS_COLS) * TS * UVS;
  const sky = (l >> 4) * 17, blk = (l & 15) * 17, sh = 240;
  const a = 0.15, b = 0.85, e = TS * UVS - 1;
  const uv = [[tx + 1, ty + e], [tx + e, ty + e], [tx + e, ty + 1], [tx + 1, ty + 1]];
  quad(mb, [[x + a, y, z + a], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + a]], uv, sky, blk, sh);
  quad(mb, [[x + a, y, z + b], [x + b, y, z + a], [x + b, y + 1, z + a], [x + a, y + 1, z + b]], uv, sky, blk, sh);
}
const TORCH_DIR = { [B.TORCH_N]: [0, -1], [B.TORCH_S]: [0, 1], [B.TORCH_E]: [1, 0], [B.TORCH_W]: [-1, 0] };
// геометрия факела (и для руки/предметов): возвращает список квадов
function torchQuads(id) {
  const x0 = -1 / 16, x1 = 1 / 16, h = 12 / 16;
  const d = TORCH_DIR[id] || [0, 0];
  const bx = 0.5 + d[0] * 0.36, by = d[0] || d[1] ? 0.2 : 0, bz = 0.5 + d[1] * 0.36;
  const tf = (lx, ly, lz) => [bx + lx - d[0] * ly * 0.42, by + ly, bz + lz - d[1] * ly * 0.42];
  const Q = [];
  const side = (a, b2, c, dd) => Q.push({ p: [a, b2, c, dd].map(q => tf(...q)), r: [7, 4, 9, 16] });
  side([x0, 0, x1], [x1, 0, x1], [x1, h, x1], [x0, h, x1]);   // +Z
  side([x1, 0, x0], [x0, 0, x0], [x0, h, x0], [x1, h, x0]);   // -Z
  side([x1, 0, x1], [x1, 0, x0], [x1, h, x0], [x1, h, x1]);   // +X
  side([x0, 0, x0], [x0, 0, x1], [x0, h, x1], [x0, h, x0]);   // -X
  Q.push({ p: [[x0, h, x1], [x1, h, x1], [x1, h, x0], [x0, h, x0]].map(q => tf(...q)), r: [7, 4, 9, 6] });
  Q.push({ p: [[x0, 0, x0], [x1, 0, x0], [x1, 0, x1], [x0, 0, x1]].map(q => tf(...q)), r: [7, 14, 9, 16] });
  return Q;
}
const TORCH_Q = {};
for (let id = B.TORCH; id <= B.TORCH_W; id++) TORCH_Q[id] = torchQuads(id);
function torchMesh(mb, x, y, z, id, l) {
  const tile = TILE.torch, tx = (tile % ATLAS_COLS) * TS, ty = Math.floor(tile / ATLAS_COLS) * TS;
  const sky = (l >> 4) * 17, blk = Math.max(l & 15, 14) * 17;
  for (const q of TORCH_Q[id]) {
    const [u0, v0, u1, v1] = q.r;
    const uv = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]].map(([u, v]) => [(tx + u) * UVS, (ty + v) * UVS]);
    quad(mb, q.p.map(p => [x + p[0], y + p[1], z + p[2]]), uv, sky, blk, 255);
  }
}

// параллелепипед с «срезом» текстуры по реальным размерам; tiles[6] — тайл каждой грани, mask — какие грани рисовать
function meshBox(mb, x, y, z, b, tiles, l, mask, pi) {
  const sky = (l >> 4) * 17, blk = (l & 15) * 17, e = TS * UVS - 2;
  for (let f = 0; f < 6; f++) {
    if (!(mask & (1 << f))) continue;
    const F = FACES[f], na = F.n[0] ? 0 : F.n[1] ? 1 : 2, ns = F.n[na];
    if (pi !== undefined && ((ns > 0 && b[na + 3] >= 1) || (ns < 0 && b[na] <= 0)) && OPQ[padB[pi + F.no]]) continue;
    const tile = tiles[f], tx = (tile % ATLAS_COLS) * TS * UVS, ty = Math.floor(tile / ATLAS_COLS) * TS * UVS;
    const au = F.u[0] ? 0 : F.u[1] ? 1 : 2, su = F.u[au], av = F.v[0] ? 0 : F.v[1] ? 1 : 2, sv = F.v[av];
    for (let k = 0; k < 4; k++) {
      const C = F.corner[k], q = [0, 0, 0];
      for (let a = 0; a < 3; a++) q[a] = C.p[a] ? b[a + 3] : b[a];
      const pu = su > 0 ? q[au] : 1 - q[au], pv = sv > 0 ? q[av] : 1 - q[av];
      mb.v(Math.round((x + q[0]) * POS), Math.round((y + q[1]) * POS), Math.round((z + q[2]) * POS),
        tx + 1 + Math.round(pu * e), ty + 1 + Math.round((1 - pv) * e), sky, blk, Math.round(255 * FACE_SHADE[f]), 0);
    }
  }
}

function meshChunk(c) {
  fillPad(c);
  MB_OPAQUE.n = 0; MB_CUT.n = 0; MB_WATER.n = 0;
  const wx0 = c.cx << 4, wz0 = c.cz << 4;
  const maxY = Math.min(WH, c.maxY);
  for (let y = 0; y < maxY; y++) for (let z = 0; z < 16; z++) {
    let pi = poff(1, y + 1, z + 1);
    for (let x = 0; x < 16; x++, pi++) {
      const id = padB[pi];
      if (!id) continue;
      const d = BLK[id];
      if (d.render === R_CUBE) {
        const mb = d.cutout ? MB_CUT : MB_OPAQUE;
        let front = -1;
        if (d.oriented) front = ORIENT_FACE[World.orientOf(wx0 + x, y, wz0 + z)];
        for (let f = 0; f < 6; f++) {
          if (!faceVisible(id, padB[pi + FACES[f].no])) continue;
          let tile = d.tiles[f];
          if (front >= 0 && (f === front || (id === B.TABLE && f === OPP[front]))) tile = d.front;
          cubeFace(mb, x, y, z, pi, f, tile, 1, false, 0);
        }
      } else if (d.render === R_LIQUID) {
        const kind = FKIND[id], lvl = FLEVEL[id], above = padB[pi + PXZ];
        const topH = (FKIND[above] === kind) ? 1 : (lvl >= (kind === 1 ? 8 : 4) ? 0.875 : 0.14 + 0.74 * (lvl / (kind === 1 ? 8 : 4)));
        const mb = kind === 1 ? MB_WATER : MB_OPAQUE;
        for (let f = 0; f < 6; f++) {
          const nid = padB[pi + FACES[f].no];
          if (f === 2) { if (FKIND[nid] !== kind && !OPQ[nid]) cubeFace(mb, x, y, z, pi, f, d.tiles[f], topH, true, 255); continue; }
          if (FKIND[nid] === kind) {                       // сосед — та же жидкость: боковая грань нужна, только если он ниже
            if (f !== 3) {
              const nl = FLEVEL[nid], na = padB[pi + FACES[f].no + PXZ];
              const nTop = FKIND[na] === kind ? 1 : (nl >= (kind === 1 ? 8 : 4) ? 0.875 : 0.14 + 0.74 * (nl / (kind === 1 ? 8 : 4)));
              if (nTop < topH - 0.01) cubeFace(mb, x, y, z, pi, f, d.tiles[f], topH, true, 0);
            }
            continue;
          }
          if (!faceVisible(id, nid)) continue;
          cubeFace(mb, x, y, z, pi, f, d.tiles[f], topH, true, 0);
        }
      } else if (d.render === R_CACTUS) {
        const l = padL[pi], sky = (l >> 4) * 17, blk = (l & 15) * 17, e = TS * UVS - 1, a = 1 / 16, b = 15 / 16;
        const mk = tile => { const tx = (tile % ATLAS_COLS) * TS * UVS, ty = Math.floor(tile / ATLAS_COLS) * TS * UVS; return [[tx + 1, ty + e], [tx + e, ty + e], [tx + e, ty + 1], [tx + 1, ty + 1]]; };
        const uvS = mk(d.tiles[0]);
        quad(MB_CUT, [[x + a, y, z + b], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + b]], uvS, sky, blk, 235);
        quad(MB_CUT, [[x + b, y, z + a], [x + a, y, z + a], [x + a, y + 1, z + a], [x + b, y + 1, z + a]], uvS, sky, blk, 205);
        quad(MB_CUT, [[x + b, y, z + b], [x + b, y, z + a], [x + b, y + 1, z + a], [x + b, y + 1, z + b]], uvS, sky, blk, 220);
        quad(MB_CUT, [[x + a, y, z + a], [x + a, y, z + b], [x + a, y + 1, z + b], [x + a, y + 1, z + a]], uvS, sky, blk, 190);
        if (padB[pi + PXZ] !== B.CACTUS) quad(MB_CUT, [[x + a, y + 1, z + b], [x + b, y + 1, z + b], [x + b, y + 1, z + a], [x + a, y + 1, z + a]], mk(d.tiles[2]), sky, blk, 255);
      } else if (d.render === R_DOOR) {
        const o = World.orientOf(wx0 + x, y, wz0 + z), bx = doorBox(id, o), t = d.tiles[0];
        meshBox(MB_CUT, x, y, z, bx, [t, t, t, t, t, t], padL[pi], 63, pi);
      } else if (d.render === R_PLATE) {
        const v = World.orientOf(wx0 + x, y, wz0 + z), bx = plateBox(id, v), t = d.tiles[0];
        meshBox(MB_CUT, x, y, z, bx, [t, t, t, t, t, t], padL[pi], 63, id === B.LADDER ? undefined : pi);
      } else if (d.render === R_PANE) {
        const shape = paneShape(padB[pi - 1], padB[pi + 1], padB[pi - PX], padB[pi + PX]), l = padL[pi];
        const G = TILE.glass, E = TILE.pane_edge;
        for (const q of shape) {
          // широкие грани — стекло, торцы, верх и низ — тонкая кромка
          const big = q.ax === 0 ? [E, E, E, E, G, G] : [G, G, E, E, E, E];
          const mask = q.ax === 0 ? (4 | 8 | 16 | 32 | (q.box[0] > 0 ? 2 : 0) | (q.box[3] < 1 ? 1 : 0)) : (4 | 8 | 1 | 2 | (q.box[2] > 0 ? 32 : 0) | (q.box[5] < 1 ? 16 : 0));
          meshBox(MB_CUT, x, y, z, q.box, big, l, mask, undefined);
        }
      } else if (d.render === R_SWITCH) {
        const k = World.orientOf(wx0 + x, y, wz0 + z), sh = switchShape(id, k), l = padL[pi], t = d.tiles[0];
        meshBox(MB_CUT, x, y, z, sh.base, [t, t, t, t, t, t], l, 63, undefined);
        if (sh.handle) {
          const H = sh.handle, hw = 1 / 16, sky = (l >> 4) * 17, blk = (l & 15) * 17, st = TILE.lever_stick;
          const tx = (st % ATLAS_COLS) * TS * UVS, ty = Math.floor(st / ATLAS_COLS) * TS * UVS, e = TS * UVS - 2;
          const uv = [[tx + 1, ty + 1 + e], [tx + 1 + e, ty + 1 + e], [tx + 1 + e, ty + 1], [tx + 1, ty + 1]];
          const ring = P0 => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + P0[0] + (a * H.u1[0] + b * H.u2[0]) * hw, y + P0[1] + (a * H.u1[1] + b * H.u2[1]) * hw, z + P0[2] + (a * H.u1[2] + b * H.u2[2]) * hw]);
          const A = ring(H.pv), Bq = ring(H.tip);
          for (let i = 0; i < 4; i++) {
            const j = (i + 1) & 3, q = [A[i], A[j], Bq[j], Bq[i]], shd = 190 + i * 20;
            quad(MB_CUT, q, uv, sky, blk, shd); quad(MB_CUT, [q[3], q[2], q[1], q[0]], uv, sky, blk, shd);
          }
          quad(MB_CUT, Bq, uv, sky, blk, 255); quad(MB_CUT, [Bq[3], Bq[2], Bq[1], Bq[0]], uv, sky, blk, 255);
        }
      } else if (d.render === R_CROSS) {
        crossMesh(MB_CUT, x, y, z, d.tiles[0], padL[pi]);
      } else if (d.render === R_TORCH) {
        torchMesh(MB_CUT, x, y, z, id, padL[pi]);
      }
    }
  }
  return { opaque: MB_OPAQUE, cutout: MB_CUT, water: MB_WATER };
}
