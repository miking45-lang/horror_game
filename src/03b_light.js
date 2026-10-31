// ============================================================
//  Освещение (свет неба — старший ниббл, свет блоков — младший)
// ============================================================
function markLight(c, lx, lz) {
  if (c.mesh || c.state >= ST_LIT) World.markDirty(c, lx, lz);
}
function propagate(q, ch) {
  const chunks = World.chunks;
  let head = 0;
  while (head < q.length) {
    const x = q[head++], y = q[head++], z = q[head++];
    const c0 = chunks.get(ckey(x >> 4, z >> 4)); if (!c0) continue;
    const L0 = c0.light[(x & 15) + ((z & 15) << 4) + (y << 8)];
    const lv = ch ? L0 >> 4 : L0 & 15;
    if (lv <= 1) continue;
    for (let d = 0; d < 6; d++) {
      const ny = y + DY[d]; if (ny < 0 || ny >= WH) continue;
      const nx = x + DX[d], nz = z + DZ[d];
      const nc = (DX[d] === 0 && DZ[d] === 0) ? c0 : ((nx >> 4) === (x >> 4) && (nz >> 4) === (z >> 4)) ? c0 : chunks.get(ckey(nx >> 4, nz >> 4));
      if (!nc || !nc.lightable) continue;
      const ni = (nx & 15) + ((nz & 15) << 4) + (ny << 8);
      const op = OPAC[nc.blocks[ni]];
      if (op >= 15) continue;
      const nl = (ch && d === 3 && lv === 15 && op === 0) ? 15 : lv - 1 - op;
      if (nl <= 0) continue;
      const cur = nc.light[ni];
      if (nl > (ch ? cur >> 4 : cur & 15)) {
        nc.light[ni] = ch ? (cur & 15) | (nl << 4) : (cur & 240) | nl;
        q.push(nx, ny, nz);
        if (nc !== c0 || c0.state >= ST_LIT) markLight(nc, nx & 15, nz & 15);
      }
    }
  }
  q.length = 0;
}
function lightChunk(c) {
  c.lightable = true;
  const L = c.light, Bk = c.blocks; L.fill(0);
  const qs = [], qb = [];
  const bx = c.cx << 4, bz = c.cz << 4;
  const top = Math.min(WH - 1, c.maxY + 1);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let lv = 15;
    for (let y = WH - 1; y >= 0; y--) {
      const i = x + (z << 4) + (y << 8);
      const op = OPAC[Bk[i]];
      if (op >= 15) break;
      if (op > 0) { lv -= op; if (lv <= 0) break; }
      L[i] = lv << 4;
      if (y <= top && lv > 1) qs.push(bx + x, y, bz + z);
    }
  }
  for (let y = 0; y <= top; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const i = x + (z << 4) + (y << 8), e = EMIT[Bk[i]];
    if (e) { L[i] = (L[i] & 240) | e; qb.push(bx + x, y, bz + z); }
  }
  // свет от уже освещённых соседей
  const nb = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dz] of nb) {
    const n = World.chunks.get(ckey(c.cx + dx, c.cz + dz));
    if (!n || !n.lightable || n === c) continue;
    const yTop = Math.min(WH - 1, Math.max(n.maxY, c.maxY) + 1);
    for (let k = 0; k < 16; k++) {
      const lx = dx === -1 ? 15 : dx === 1 ? 0 : k, lz = dz === -1 ? 15 : dz === 1 ? 0 : k;
      const wx = (n.cx << 4) + lx, wz = (n.cz << 4) + lz;
      for (let y = 0; y <= yTop; y++) {
        const v = n.light[lx + (lz << 4) + (y << 8)];
        if ((v >> 4) > 1) qs.push(wx, y, wz);
        if ((v & 15) > 1) qb.push(wx, y, wz);
      }
    }
  }
  propagate(qs, 1); propagate(qb, 0);
  c.state = ST_LIT; c.dirty = true;
}
function relight(x, y, z) {
  const chunks = World.chunks;
  const c = chunks.get(ckey(x >> 4, z >> 4)); if (!c) return;
  const i0 = (x & 15) + ((z & 15) << 4) + (y << 8);
  for (const ch of [1, 0]) {
    const rq = [], aq = [];
    const cur = c.light[i0];
    const old = ch ? cur >> 4 : cur & 15;
    c.light[i0] = ch ? cur & 15 : cur & 240;
    rq.push(x, y, z, old);
    let head = 0;
    while (head < rq.length) {
      const px = rq[head++], py = rq[head++], pz = rq[head++], lv = rq[head++];
      for (let d = 0; d < 6; d++) {
        const ny = py + DY[d]; if (ny < 0 || ny >= WH) continue;
        const nx = px + DX[d], nz = pz + DZ[d];
        const nc = chunks.get(ckey(nx >> 4, nz >> 4));
        if (!nc || !nc.lightable) continue;
        const ni = (nx & 15) + ((nz & 15) << 4) + (ny << 8);
        const v = nc.light[ni], nv = ch ? v >> 4 : v & 15;
        if (nv === 0) continue;
        if ((ch && d === 3 && lv === 15 && nv === 15) || nv < lv) {
          // не гасим источник света
          if (!ch && EMIT[nc.blocks[ni]] && !(nx === x && ny === y && nz === z)) { aq.push(nx, ny, nz); continue; }
          nc.light[ni] = ch ? v & 15 : v & 240;
          rq.push(nx, ny, nz, nv);
          markLight(nc, nx & 15, nz & 15);
        } else aq.push(nx, ny, nz);
      }
    }
    if (!ch) {
      const e = EMIT[c.blocks[i0]];
      if (e) { c.light[i0] = (c.light[i0] & 240) | e; aq.push(x, y, z); }
    }
    propagate(aq, ch);
  }
  World.markDirty(c, x & 15, z & 15);
}
