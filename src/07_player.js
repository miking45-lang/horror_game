// ============================================================
//  Игрок: физика, инвентарь, добыча и установка блоков
// ============================================================
const HW = 0.3, PH = 1.8, EYE = 1.62;
const Player = {
  x: 0, y: 80, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
  onGround: false, flying: false, sneaking: false, sprinting: false,
  inWater: false, eyeInWater: false, inLava: false,
  health: 20, air: 15, fallDist: 0, hurtT: 0, lastHurt: 0, regenT: 0, lavaT: 0, drownT: 0, dead: false,
  slots: new Array(36).fill(null), selected: 0, armor: [null, null, null, null],
  spawn: [0, 80, 0], walkDist: 0, stepAcc: 0, bob: 0, bobAmt: 0,
  swing: 0, swinging: false, equip: 1, lastSel: -1,
  target: null, breakP: 0, breakPos: null, digSoundT: 0, placeCD: 0, jumpCD: 0, lastSpace: -1,
  reset() {
    this.vx = this.vy = this.vz = 0; this.health = 20; this.air = 15; this.fallDist = 0; this.dead = false;
    this.flying = false; this.breakP = 0; this.armor = [null, null, null, null];
  },
  armorPts() { let n = 0; for (const a of this.armor) if (a && ITEMS[a.id] && ITEMS[a.id].armor) n += ITEMS[a.id].armor.pts; return n; },
  held() { return this.slots[this.selected]; },
  box() { const s = this.hs || 1; return [this.x - HW * s, this.y, this.z - HW * s, this.x + HW * s, this.y + PH * s, this.z + HW * s]; }
};
const Input = { keys: {}, mouse: [false, false, false], dx: 0, dy: 0, wheel: 0, clicked: [false, false, false] };

// ---------- инвентарь ----------
function stackEq(a, b) { return a && b && a.id === b.id && !ITEMS[a.id]?.tool && !ITEMS[a.id]?.armor; }
function addToSlots(slots, st, order) {
  const ms = maxStack(st.id);
  for (const i of order) { const s = slots[i]; if (st.count <= 0) break; if (s && stackEq(s, st) && s.count < ms) { const k = Math.min(ms - s.count, st.count); s.count += k; st.count -= k; } }
  for (const i of order) { if (st.count <= 0) break; if (!slots[i]) { const k = Math.min(ms, st.count); slots[i] = { id: st.id, count: k, dmg: st.dmg || 0 }; st.count -= k; } }
  return st.count;
}
const INV_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8].concat(Array.from({ length: 27 }, (_, i) => 9 + i));
function giveItem(id, count, dmg = 0) {
  const st = { id, count, dmg };
  const left = addToSlots(Player.slots, st, INV_ORDER);
  UI.refreshHotbar();
  return left;
}

// ---------- столкновения ----------
function solidAt(x, y, z) { return SOLID[World.getPhys(x, y, z)]; }
// коробки клетки в мировых координатах: null — пусто, список — частичные формы или целый куб
function cellBoxes(x, y, z) {
  const id = World.getPhys(x, y, z);
  if (!SOLID[id]) return null;
  if (PARTIAL[id]) return blockParts(id, x, y, z).map(q => [x + q[0], y + q[1], z + q[2], x + q[3], y + q[4], z + q[5]]);
  return [[x, y, z, x + 1, y + 1, z + 1]];
}
function sweepAxis(mn, mx, ax, d) {
  if (d === 0) return 0;
  const e = 1e-5, a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
  const lo = [mn[0], mn[1], mn[2]], hi = [mx[0], mx[1], mx[2]];
  if (d > 0) hi[ax] += d; else lo[ax] += d;
  let r = d;
  for (let y = Math.floor(lo[1] + e); y <= Math.floor(hi[1] - e); y++)
    for (let z = Math.floor(lo[2] + e); z <= Math.floor(hi[2] - e); z++)
      for (let x = Math.floor(lo[0] + e); x <= Math.floor(hi[0] - e); x++) {
        const bs = cellBoxes(x, y, z); if (!bs) continue;
        for (const bb of bs) {
          if (!(mn[a1] < bb[a1 + 3] - e && mx[a1] > bb[a1] + e && mn[a2] < bb[a2 + 3] - e && mx[a2] > bb[a2] + e)) continue;
          if (d > 0) { if (bb[ax] >= mx[ax] - e) r = Math.min(r, Math.max(0, bb[ax] - mx[ax] - e)); }
          else if (bb[ax + 3] <= mn[ax] + e) r = Math.max(r, Math.min(0, bb[ax + 3] - mn[ax] + e));
        }
      }
  return r;
}
function boxSolid(x0, y0, z0, x1, y1, z1) {
  const e = 1e-5;
  for (let y = Math.floor(y0 + e); y <= Math.floor(y1 - e); y++)
    for (let z = Math.floor(z0 + e); z <= Math.floor(z1 - e); z++)
      for (let x = Math.floor(x0 + e); x <= Math.floor(x1 - e); x++) {
        const bs = cellBoxes(x, y, z); if (!bs) continue;
        for (const bb of bs) if (x0 < bb[3] - e && x1 > bb[0] + e && y0 < bb[4] - e && y1 > bb[1] + e && z0 < bb[5] - e && z1 > bb[2] + e) return true;
      }
  return false;
}
function fluidInBox(kind, minL, x0, y0, z0, x1, y1, z1) {
  const e = 1e-5;
  for (let y = Math.floor(y0 + e); y <= Math.floor(y1 - e); y++)
    for (let z = Math.floor(z0 + e); z <= Math.floor(z1 - e); z++)
      for (let x = Math.floor(x0 + e); x <= Math.floor(x1 - e); x++) { const id = World.get(x, y, z); if (FKIND[id] === kind && FLEVEL[id] >= minL) return true; }
  return false;
}
function blockInBox(id, x0, y0, z0, x1, y1, z1) {
  const e = 1e-5;
  for (let y = Math.floor(y0 + e); y <= Math.floor(y1 - e); y++)
    for (let z = Math.floor(z0 + e); z <= Math.floor(z1 - e); z++)
      for (let x = Math.floor(x0 + e); x <= Math.floor(x1 - e); x++) if (World.get(x, y, z) === id) return true;
  return false;
}

// ---------- физика игрока ----------
function onLadder(p) {
  const b = p.box();
  for (let y = Math.floor(b[1]); y <= Math.floor(b[1] + 1.2); y++) for (let x = Math.floor(b[0]); x <= Math.floor(b[3]); x++) for (let z = Math.floor(b[2]); z <= Math.floor(b[5]); z++)
    if (World.get(x, y, z) === B.LADDER) return true;
  return false;
}
function playerPhysics(dt, creative) {
  const p = Player, k = Ents.huntLock ? {} : Input.keys;
  const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  p.sneaking = !!(k.ShiftLeft || k.ShiftRight) && !p.flying;
  if (k.ControlLeft && fwd > 0) p.sprinting = true;
  if (fwd <= 0 || p.sneaking) p.sprinting = false;
  const b = p.box();
  p.inWater = fluidInBox(1, 3, b[0], b[1], b[2], b[3], b[4] - 0.2, b[5]);
  p.inLava = fluidInBox(2, 1, b[0], b[1], b[2], b[3], b[4] - 0.2, b[5]);
  p.eyeInWater = isWater(World.get(Math.floor(p.x), Math.floor(p.y + EYE - 0.12), Math.floor(p.z)));
  if (!p.flying) {   // течение уносит игрока
    const fx0 = Math.floor(p.x), fy0 = Math.floor(p.y + 0.3), fz0 = Math.floor(p.z), fd = Fluid.flowDir(fx0, fy0, fz0);
    if (fd[0] || fd[1]) { const pw = (p.inWater ? 7 : 3.5) * dt; p.vx += fd[0] * pw; p.vz += fd[1] * pw; }
  }
  const liquid = p.inWater || p.inLava;
  let speed = p.flying ? (p.sprinting ? 21 : 10.9) : p.sneaking ? 1.3 : p.sprinting ? 5.6 : 4.3;
  if (liquid && !p.flying) speed = p.inLava ? 1.2 : (p.sprinting ? 3 : 2.2);
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let ix = -sy * fwd + cy * str, iz = -cy * fwd - sy * str;
  const il = Math.hypot(ix, iz); if (il > 0) { ix /= il; iz /= il; }
  const tx = ix * speed, tz = iz * speed;
  let rate = p.flying ? 8 : p.onGround ? 14 : liquid ? 5 : (il > 0 ? 2.8 : 0.5);
  const f = 1 - Math.exp(-rate * dt);
  p.vx += (tx - p.vx) * f; p.vz += (tz - p.vz) * f;
  // вертикаль
  const space = !!k.Space;
  if (p.flying) {
    const ty = (space ? 9 : 0) - ((k.ShiftLeft || k.ShiftRight) ? 9 : 0);
    p.vy += (ty - p.vy) * (1 - Math.exp(-10 * dt));
  } else if (liquid) {
    p.vy -= (p.inLava ? 4 : 7) * dt;
    p.vy *= Math.exp(-2.5 * dt);
    if (space) p.vy = Math.min(p.vy + 22 * dt, p.inLava ? 1.6 : 3.2);
    if (p.vy < -3.5) p.vy = -3.5;
  } else if (onLadder(p)) {                        // лестница: вверх — W или пробел, Shift — держаться, иначе медленно сползаем
    p.vy -= 28 * dt;
    if (k.KeyW || space) p.vy = 2.6;
    else if (p.sneaking) p.vy = 0;
    else p.vy = Math.max(p.vy, -2.6);
    p.fallDist = 0;
    if (p.vy > 0) { p.stepAcc += p.vy * dt; if (p.stepAcc > 1.2) { p.stepAcc = 0; Sfx.step('wood'); } }
  } else {
    p.vy -= 28 * dt;
    if (p.vy < -60) p.vy = -60;
    if (space && p.onGround && p.jumpCD <= 0) {
      p.vy = 8.6; p.onGround = false; p.jumpCD = 0.2;
      if (p.sprinting) { p.vx += -sy * 1.5; p.vz += -cy * 1.5; }
    }
  }
  p.jumpCD -= dt;
  // перемещение с подшагами
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy), Math.abs(p.vz)) * dt / 0.35));
  const h = dt / steps;
  const wasGround = p.onGround;
  let landed = false;
  for (let s = 0; s < steps; s++) {
    let bx = p.box();
    let mn = [bx[0], bx[1], bx[2]], mx = [bx[3], bx[4], bx[5]];
    const dy = p.vy * h, ay = sweepAxis(mn, mx, 1, dy);
    p.y += ay;
    if (ay !== dy) { if (dy < 0) { landed = true; } p.vy = 0; }
    else if (dy < 0) p.onGround = false;
    const grounded = landed || (wasGround && ay === 0);
    for (const ax of [0, 2]) {
      bx = p.box(); mn = [bx[0], bx[1], bx[2]]; mx = [bx[3], bx[4], bx[5]];
      let d = (ax === 0 ? p.vx : p.vz) * h;
      if (p.sneaking && grounded && !p.flying && d !== 0) {
        const nb = bx.slice(); nb[ax] += d; nb[ax + 3] += d;
        if (!boxSolid(nb[0], nb[1] - 0.6, nb[2], nb[3], nb[1], nb[5])) d = 0;
      }
      const a = sweepAxis(mn, mx, ax, d);
      if (ax === 0) { p.x += a; if (a !== d) p.vx = 0; } else { p.z += a; if (a !== d) p.vz = 0; }
    }
  }
  if (landed) {
    if (!p.onGround && !creative && !liquid) {
      const dmg = Math.ceil(p.fallDist - 3.2);
      if (dmg > 0) { hurtPlayer(dmg, true); Sfx.material('stone', 0.4, true); }
    }
    p.onGround = true; p.fallDist = 0;
    if (p.flying && creative) p.flying = false;
  } else {
    // стоим ли на земле?
    const bx = p.box();
    p.onGround = boxSolid(bx[0], bx[1] - 0.02, bx[2], bx[3], bx[1], bx[5]) && p.vy <= 0;
  }
  if (!p.onGround && p.vy < 0 && !liquid && !p.flying && !onLadder(p)) p.fallDist += -p.vy * dt;
  if (liquid || p.flying) p.fallDist = 0;
  // шаги
  const hs = Math.hypot(p.vx, p.vz);
  if (p.onGround && hs > 0.5) {
    p.walkDist += hs * dt;
    p.stepAcc += hs * dt;
    if (p.stepAcc > (p.sprinting ? 2.2 : 1.9)) {
      p.stepAcc = 0;
      const under = World.get(Math.floor(p.x), Math.floor(p.y - 0.1), Math.floor(p.z));
      if (under && !p.sneaking) Sfx.step(BLK[under].sound);
    }
  }
  p.bobAmt += ((p.onGround && hs > 0.5 && !p.flying ? Math.min(1, hs / 4.3) : 0) - p.bobAmt) * (1 - Math.exp(-8 * dt));
  p.bob = p.walkDist;
  // вход в воду
  if (p.inWater && !p._wasWater && p.vy < -4) Sfx.splash(Math.min(0.5, -p.vy / 20));
  p._wasWater = p.inWater;
  if (p.y < -30) { hurtPlayer(100, true); }
}

function hurtPlayer(dmg, bypass) {
  const p = Player;
  if (Game.mode === 'creative' || p.dead) return;
  const pts = p.armorPts();
  if (!bypass && pts > 0) {                         // броня гасит часть урона (падение, утопление и бездна её обходят)
    const hit = dmg;
    dmg = Math.floor(dmg * (1 - Math.min(0.8, pts * 0.04)) + Math.random());
    for (let i = 0; i < 4; i++) { const a = p.armor[i]; if (!a) continue; a.dmg = (a.dmg || 0) + Math.max(1, Math.floor(hit / 4)); if (a.dmg >= ITEMS[a.id].armor.dur) { p.armor[i] = null; Sfx.breakB('glass'); } }
    UI.refreshHud();
    if (dmg <= 0) { Sfx.material('stone', 0.5, true); return; }
  }
  p.health = Math.max(0, p.health - dmg);
  p.lastHurt = Game.time; p.hurtT = 0.4;
  Sfx.hurt();
  UI.flashHurt();
  if (p.health <= 0) killPlayer();
  UI.refreshHud();
}
function killPlayer() {
  const p = Player; p.dead = true;
  for (let i = 0; i < 36; i++) if (p.slots[i]) { Ents.dropItem(p.x, p.y + 1, p.z, p.slots[i], true); p.slots[i] = null; }
  for (let i = 0; i < 4; i++) if (p.armor[i]) { Ents.dropItem(p.x, p.y + 1, p.z, p.armor[i], true); p.armor[i] = null; }
  UI.showDeath();
}
function survivalTick(dt) {
  const p = Player;
  if (Game.mode === 'creative') { p.health = 20; p.air = 15; return; }
  if (p.eyeInWater) {
    p.air -= dt;
    if (p.air < 0) { p.drownT -= dt; if (p.drownT <= 0) { p.drownT = 1; hurtPlayer(2, true); } }
  } else p.air = Math.min(15, p.air + dt * 5);
  {   // кактус колется
    const bb = p.box(); let touch = false;
    for (let yy = Math.floor(bb[1]); yy <= Math.floor(bb[4]) && !touch; yy++) for (let zz = Math.floor(bb[2] - 0.1); zz <= Math.floor(bb[5] + 0.1) && !touch; zz++) for (let xx = Math.floor(bb[0] - 0.1); xx <= Math.floor(bb[3] + 0.1); xx++) if (World.get(xx, yy, zz) === B.CACTUS) { touch = true; break; }
    p.cactusT = (p.cactusT || 0) - dt;
    if (touch && p.cactusT <= 0) { p.cactusT = 0.5; hurtPlayer(1); }
  }
  if (p.inLava) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = 0.5; hurtPlayer(4); Sfx.fizz(); } }
  if (p.health < 20 && Game.time - p.lastHurt > 5) {
    p.regenT += dt; if (p.regenT > 3.5) { p.regenT = 0; p.health = Math.min(20, p.health + 1); UI.refreshHud(); }
  }
  if (p.hurtT > 0) p.hurtT -= dt;
}

// ---------- луч взгляда ----------
function lookDir() {
  const p = Player, cp = Math.cos(p.pitch);
  return [-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp];
}
function raycast(ox, oy, oz, dx, dy, dz, maxD) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = sx ? Math.abs(1 / dx) : 1e9, tdy = sy ? Math.abs(1 / dy) : 1e9, tdz = sz ? Math.abs(1 / dz) : 1e9;
  let tmx = sx ? (sx > 0 ? (x + 1 - ox) : (ox - x)) * tdx : 1e9;
  let tmy = sy ? (sy > 0 ? (y + 1 - oy) : (oy - y)) * tdy : 1e9;
  let tmz = sz ? (sz > 0 ? (z + 1 - oz) : (oz - z)) * tdz : 1e9;
  let n = [0, 0, 0], t = 0;
  for (let i = 0; i < 64; i++) {
    const id = World.get(x, y, z);
    if (id && BLK[id].selectable) {
      if (BLK[id].render === R_CUBE || rayHitsSmall(id, ox, oy, oz, dx, dy, dz, x, y, z)) return { x, y, z, n, id, t };
    }
    if (tmx < tmy && tmx < tmz) { t = tmx; if (t > maxD) break; x += sx; tmx += tdx; n = [-sx, 0, 0]; }
    else if (tmy < tmz) { t = tmy; if (t > maxD) break; y += sy; tmy += tdy; n = [0, -sy, 0]; }
    else { t = tmz; if (t > maxD) break; z += sz; tmz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
function smallBox(id, x, y, z) {
  if (PARTIAL[id] && x !== undefined) {
    const bs = blockParts(id, x, y, z), u = [1, 1, 1, 0, 0, 0];
    for (const q of bs) for (let a = 0; a < 3; a++) { u[a] = Math.min(u[a], q[a]); u[a + 3] = Math.max(u[a + 3], q[a + 3]); }
    return u;
  }
  if (id === B.CACTUS) return [0.0625, 0, 0.0625, 0.9375, 1, 0.9375];
  if (BLK[id].render === R_CROSS) return [0.15, 0, 0.15, 0.85, 0.85, 0.85];
  if (isTorch(id)) {
    const d = TORCH_DIR[id];
    if (!d) return [0.38, 0, 0.38, 0.62, 0.72, 0.62];
    const cx = 0.5 + d[0] * 0.27, cz = 0.5 + d[1] * 0.27;
    return [cx - 0.16, 0.2, cz - 0.16, cx + 0.16, 0.95, cz + 0.16];
  }
  return [0, 0, 0, 1, 1, 1];
}
function rayHitsSmall(id, ox, oy, oz, dx, dy, dz, x, y, z) {
  const parts = PARTIAL[id] ? blockParts(id, x, y, z) : null;
  if (parts) { for (const q of parts) if (rayHitsBox(q, ox - x, oy - y, oz - z, dx, dy, dz)) return true; return false; }
  return rayHitsBox(smallBox(id), ox - x, oy - y, oz - z, dx, dy, dz);
}
function rayHitsBox(b, ox0, oy0, oz0, dx, dy, dz) {
  let t0 = 0, t1 = 100;
  const o = [ox0, oy0, oz0], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < b[a] || o[a] > b[a + 3]) return false; continue; }
    let ta = (b[a] - o[a]) / d[a], tb = (b[a + 3] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

// ---------- добыча ----------
function toolOf(st) { return st && ITEMS[st.id] && ITEMS[st.id].tool; }
function canHarvest(id, st) {
  const d = BLK[id]; if (!d.tier) return true;
  const t = toolOf(st); return !!(t && t.type === d.tool && t.tier >= d.tier);
}
function breakTime(id, st) {
  const d = BLK[id];
  if (d.hardness < 0) return Infinity;
  if (d.hardness === 0) return 0.05;
  const t = toolOf(st);
  const spd = t && t.type === d.tool ? t.speed : (t && t.type === 'sword' ? 1.6 : 1);
  return d.hardness * (canHarvest(id, st) ? 1.5 : 5) / spd;
}
function dropsOf(id, st) {
  const d = BLK[id];
  if (!canHarvest(id, st)) return null;
  if (d.drop === -1) return Math.random() < 0.06 ? { id: I.STICK, count: 1 } : null;
  if (d.drop === -2 || d.drop === 0) return null;
  if (id === B.GLASS) return null;
  return { id: d.drop, count: d.dropN || 1 };
}
function isWaterNear(x, y, z) {
  if (y > SEA) return false;
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) if (isWater(World.get(x + dx, y + dy, z + dz))) return true;
  return false;
}
function breakBlock(x, y, z, player = true) {
  const id = World.get(x, y, z); if (!id) return;
  const d = BLK[id];
  const fill = 0;
  World.set(x, y, z, fill);
  World.orient.delete(pkey(x, y, z));
  if (DOORINFO[id]) removeDoorPartner(x, y, z, id);
  if (SWINFO[id] && SWINFO[id].on) Power.update(x, y, z);
  Ents.breakParticles(x, y, z, id);
  Sfx.breakB(d.sound);
  if (Game.mode === 'survival' && player) {
    const st = Player.held();
    const dr = dropsOf(id, st);
    if (dr) Ents.dropItem(x + 0.5, y + 0.3, z + 0.5, { id: dr.id, count: dr.count, dmg: 0 });
    const t = toolOf(st);
    if (t && d.hardness > 0) { st.dmg = (st.dmg || 0) + (t.type === 'sword' ? 2 : 1); if (st.dmg >= t.dur) { Player.slots[Player.selected] = null; Sfx.breakB('glass'); } UI.refreshHotbar(); }
  }
  const key = pkey(x, y, z), cont = World.containers.get(key);
  if (cont) {
    for (const s of cont.slots) if (s) Ents.dropItem(x + 0.5, y + 0.5, z + 0.5, s);
    World.containers.delete(key);
    if (UI.openContainerKey === key) UI.closeScreen();
  }
  afterChange(x, y, z);
}
// соседние блоки, которым нужна опора / которые падают
function removeDoorPartner(x, y, z, id) {
  const py = DOORINFO[id].half ? y - 1 : y + 1, pid = World.get(x, py, z);
  if (DOORINFO[pid] && DOORINFO[pid].half !== DOORINFO[id].half) {
    World.set(x, py, z, 0); World.orient.delete(pkey(x, py, z)); Ents.breakParticles(x, py, z, pid);
  }
}
function afterChange(x, y, z) {
  const up = World.get(x, y + 1, z);
  if (DOORINFO[up] && !DOORINFO[up].half && !SOLID[World.get(x, y, z)]) popBlock(x, y + 1, z);
  if (!OPQ[World.get(x, y, z)]) for (let k = 0; k < 6; k++) {
    const nx = x + DX[k], ny = y + DY[k], nz = z + DZ[k];
    if (SWINFO[World.get(nx, ny, nz)] && World.orientOf(nx, ny, nz) === k) popBlock(nx, ny, nz);
  }
  if (!OPQ[World.get(x, y, z)]) for (const [dx, dz, e] of [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]])   // лестница без стены падает
    if (World.get(x + dx, y, z + dz) === B.LADDER && World.orientOf(x + dx, y, z + dz) === e) popBlock(x + dx, y, z + dz);
  if (up === B.CACTUS) { const cur = World.get(x, y, z); if (cur !== B.SAND && cur !== B.CACTUS) popBlock(x, y + 1, z); }
  if (up && (BLK[up].support && (up === B.TORCH || BLK[up].render === R_CROSS)) && !SOLID[World.get(x, y, z)]) popBlock(x, y + 1, z);
  if (up && BLK[up].gravity && !SOLID[World.get(x, y, z)]) Ents.startFalling(x, y + 1, z, up);
  const wall = [[1, 0, B.TORCH_W], [-1, 0, B.TORCH_E], [0, 1, B.TORCH_N], [0, -1, B.TORCH_S]];
  if (!OPQ[World.get(x, y, z)]) for (const [dx, dz, tid] of wall) if (World.get(x + dx, y, z + dz) === tid) popBlock(x + dx, y, z + dz);
}
function popBlock(x, y, z) {
  const id = World.get(x, y, z); if (!id) return;
  World.set(x, y, z, 0);
  if (SWINFO[id] && SWINFO[id].on) Power.update(x, y, z);
  if (DOORINFO[id]) {
    removeDoorPartner(x, y, z, id);
    if (Game.mode === 'survival' && !DOORINFO[id].half) Ents.dropItem(x + 0.5, y + 0.3, z + 0.5, { id: DOORINFO[id].lo, count: 1, dmg: 0 });
    Ents.breakParticles(x, y, z, id); Sfx.breakB(BLK[id].sound);
    afterChange(x, y, z); return;
  }
  if (Game.mode === 'survival') { const dr = dropsOf(id, null); if (dr) Ents.dropItem(x + 0.5, y + 0.3, z + 0.5, { id: dr.id, count: 1, dmg: 0 }); }
  Ents.breakParticles(x, y, z, id);
  afterChange(x, y, z);
}
// ---------- установка ----------
function supportOK(id, x, y, z) {
  const below = World.get(x, y - 1, z);
  if (id === B.DEAD_BUSH) return below === B.SAND;
  if (id === B.CACTUS) return below === B.SAND || below === B.CACTUS;
  if (BLK[id].render === R_CROSS) return below === B.GRASS || below === B.DIRT || below === B.SNOW_GRASS;
  return true;
}
function placeBlock(hit) {
  const st = Player.held(); if (!st) return false;
  const it = ITEMS[st.id]; if (!it || !it.block) return false;
  let id = it.block;
  let x = hit.x, y = hit.y, z = hit.z;
  const tgt = World.get(x, y, z);
  if (!BLK[tgt].replaceable) { x += hit.n[0]; y += hit.n[1]; z += hit.n[2]; }
  if (y < 0 || y >= WH) return false;
  const cur = World.get(x, y, z);
  if (cur && !BLK[cur].replaceable) return false;
  if (id === B.TORCH) {
    const n = BLK[tgt].replaceable ? [0, 1, 0] : hit.n;
    if (n[1] === 1) { if (!OPQ[World.get(x, y - 1, z)]) return false; }
    else if (n[1] === -1) { if (!OPQ[World.get(x, y - 1, z)]) return false; }
    else {
      id = n[0] === 1 ? B.TORCH_W : n[0] === -1 ? B.TORCH_E : n[2] === 1 ? B.TORCH_N : B.TORCH_S;
      if (!OPQ[World.get(x - n[0], y, z - n[2])]) return false;
    }
  }
  if (!supportOK(id, x, y, z)) return false;
  if (SWINFO[id]) {
    const n = BLK[tgt].replaceable ? [0, 1, 0] : hit.n;
    const k = n[0] > 0 ? 0 : n[0] < 0 ? 1 : n[1] > 0 ? 2 : n[1] < 0 ? 3 : n[2] > 0 ? 4 : 5;
    if (!OPQ[World.get(x - n[0], y - n[1], z - n[2])]) return false;
    World.set(x, y, z, id); World.orient.set(pkey(x, y, z), k);
    Sfx.place(BLK[id].sound);
    if (Game.mode === 'survival') { st.count--; if (st.count <= 0) Player.slots[Player.selected] = null; UI.refreshHotbar(); }
    return true;
  }
  if (id === B.LADDER || TRAPINFO[id]) {
    const n = BLK[tgt].replaceable ? [0, 1, 0] : hit.n;
    const [fx, , fz] = lookDir(), lookO = Math.abs(fz) > Math.abs(fx) ? (fz < 0 ? 0 : 2) : (fx < 0 ? 3 : 1);
    // сторона клетки, где стена, к которой приложили: 0 +Z, 1 -X, 2 -Z, 3 +X
    const wallO = n[2] < 0 ? 0 : n[0] > 0 ? 1 : n[2] > 0 ? 2 : n[0] < 0 ? 3 : -1;
    let v;
    if (id === B.LADDER) {
      if (wallO < 0 || !OPQ[World.get(x - n[0], y, z - n[2])]) return false;   // лестница — только на стену
      v = wallO;
    } else if (wallO >= 0) {                                   // люк на стене: петли к стене, верх/низ — по точке попадания
      const hy = Player.y + EYE + lookDir()[1] * hit.t - y;
      v = wallO + (hy > 0.5 ? 4 : 0);
    } else v = lookO + (n[1] < 0 ? 4 : 0);                     // на полу — нижняя половина, на потолке — верхняя
    if (TRAPINFO[id]) {
      const sb = trapBox(id, v), b = Player.box();
      if (Game.mode !== 'spectator' && x + sb[3] > b[0] && x + sb[0] < b[3] && y + sb[4] > b[1] && y + sb[1] < b[4] && z + sb[5] > b[2] && z + sb[2] < b[5]) return false;
    }
    World.orient.set(pkey(x, y, z), v); World.set(x, y, z, id);
    if (TRAPINFO[id] && TRAPINFO[id].mat === 'iron' && Power.trapPowered(x, y, z)) toggleTrap(x, y, z, true);
    Sfx.place(BLK[id].sound);
    if (Game.mode === 'survival') { st.count--; if (st.count <= 0) Player.slots[Player.selected] = null; UI.refreshHotbar(); }
    return true;
  }
  if (DOORINFO[id]) {
    const up = World.get(x, y + 1, z);
    if (y + 1 >= WH || (up && !BLK[up].replaceable) || !SOLID[World.get(x, y - 1, z)]) return false;
    const [fx, , fz] = lookDir();
    const o = Math.abs(fz) > Math.abs(fx) ? (fz < 0 ? 0 : 2) : (fx < 0 ? 3 : 1), di = DOORINFO[id];
    const sb = doorBox(di.ids[0], o), b = Player.box();
    if (Game.mode !== 'spectator' && x + sb[3] > b[0] && x + sb[0] < b[3] && z + sb[5] > b[2] && z + sb[2] < b[5] && y + 2 > b[1] && y < b[4]) return false;
    World.set(x, y, z, di.ids[0]); World.set(x, y + 1, z, di.ids[1]);
    World.orient.set(pkey(x, y, z), o); World.orient.set(pkey(x, y + 1, z), o);
    Sfx.place(BLK[id].sound);
    if (Game.mode === 'survival') { st.count--; if (st.count <= 0) Player.slots[Player.selected] = null; UI.refreshHotbar(); }
    return true;
  }
  if (SOLID[id] && !PARTIAL[id]) {
    const b = Player.box();
    if (x + 1 > b[0] && x < b[3] && y + 1 > b[1] && y < b[4] && z + 1 > b[2] && z < b[5] && Game.mode !== 'spectator') return false;
  }
  if (BLK[id].oriented) {
    const [fx, , fz] = lookDir();
    const o = Math.abs(fz) > Math.abs(fx) ? (fz < 0 ? 0 : 2) : (fx < 0 ? 3 : 1);
    World.orient.set(pkey(x, y, z), o);
  }
  World.set(x, y, z, id);
  Sfx.place(BLK[id].sound);
  if (Game.mode === 'survival') { st.count--; if (st.count <= 0) Player.slots[Player.selected] = null; UI.refreshHotbar(); }
  if (BLK[id].gravity && !SOLID[World.get(x, y - 1, z)]) Ents.startFalling(x, y, z, id);
  return true;
}

// ведро: набрать источник / вылить жидкость
function useBucket(st, hit) {
  const p = Player, creative = Game.mode === 'creative', d = lookDir();
  const swap = id => { if (!creative) { p.slots[p.selected] = { id, count: 1, dmg: 0 }; UI.refreshHotbar(); } };
  if (st.id === 310) {
    for (let t = 0.2; t <= 5.2; t += 0.08) {
      const x = Math.floor(p.x + d[0] * t), y = Math.floor(p.y + EYE + d[1] * t), z = Math.floor(p.z + d[2] * t), id = World.get(x, y, z);
      if (FKIND[id] && FLEVEL[id] >= (FKIND[id] === 1 ? 8 : 4)) {
        World.set(x, y, z, 0); swap(FKIND[id] === 1 ? 311 : 312);
        Sfx.splash(0.18); p.swing = 0.001; p.placeCD = 0.3; return true;
      }
      if (id && SOLID[id]) break;
    }
    return false;
  }
  if (!hit) return false;
  let x = hit.x, y = hit.y, z = hit.z;
  if (!BLK[World.get(x, y, z)].replaceable) { x += hit.n[0]; y += hit.n[1]; z += hit.n[2]; }
  if (!Fluid.flowable(World.get(x, y, z))) return false;
  const water = st.id === 311;
  World.set(x, y, z, water ? B.WATER : B.LAVA); Fluid.touch(x, y, z);
  if (water) Sfx.splash(0.25); else Sfx.fizz();
  swap(310); p.swing = 0.001; p.placeCD = 0.3; return true;
}
// ---------- рычаги, кнопки и питание железных дверей ----------
const Power = {
  // дверь с нижней клеткой (x,y,z) запитана: рядом включённый рычаг/кнопка либо такой же, приделанный к соседнему блоку
  doorPowered(x, y, z) {
    for (const yy of [y, y + 1]) for (let k = 0; k < 6; k++) {
      const nx = x + DX[k], ny = yy + DY[k], nz = z + DZ[k], nid = World.get(nx, ny, nz), si = SWINFO[nid];
      if (si && si.on) return true;
      if (OPQ[nid]) for (let j = 0; j < 6; j++) {
        const mx = nx + DX[j], my = ny + DY[j], mz = nz + DZ[j], mid = World.get(mx, my, mz), mi = SWINFO[mid];
        if (mi && mi.on && World.orientOf(mx, my, mz) === j) return true;
      }
    }
    return false;
  },
  // люк запитан: рядом включённый рычаг/кнопка или такой же на соседнем блоке
  trapPowered(x, y, z) {
    for (let k = 0; k < 6; k++) {
      const nx = x + DX[k], ny = y + DY[k], nz = z + DZ[k], nid = World.get(nx, ny, nz), si = SWINFO[nid];
      if (si && si.on) return true;
      if (OPQ[nid]) for (let j = 0; j < 6; j++) {
        const mx = nx + DX[j], my = ny + DY[j], mz = nz + DZ[j], mi = SWINFO[World.get(mx, my, mz)];
        if (mi && mi.on && World.orientOf(mx, my, mz) === j) return true;
      }
    }
    return false;
  },
  // пересчитать все железные двери вокруг переключателя
  update(x, y, z) {
    for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const cx = x + dx, cy = y + dy, cz = z + dz, di = DOORINFO[World.get(cx, cy, cz)];
      if (di && di.mat === 'iron' && !di.half) toggleDoor(cx, cy, cz, this.doorPowered(cx, cy, cz));
      const ti = TRAPINFO[World.get(cx, cy, cz)];
      if (ti && ti.mat === 'iron') toggleTrap(cx, cy, cz, this.trapPowered(cx, cy, cz));
    }
  }
};
const Switch = {
  timers: [],
  use(x, y, z) {
    const id = World.get(x, y, z), si = SWINFO[id]; if (!si) return false;
    if (si.kind === 'lever') {
      World.set(x, y, z, si.on ? si.off : si.onId);
      Sfx.lever && Sfx.lever(!si.on);
    } else {
      if (si.on) return false;
      World.set(x, y, z, si.onId); this.timers.push({ x, y, z, t: si.wood ? 1.5 : 1.0 });
      Sfx.button && Sfx.button(si.wood, true);
    }
    Power.update(x, y, z);
    return true;
  },
  tick(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const T = this.timers[i]; T.t -= dt;
      if (T.t > 0) continue;
      this.timers.splice(i, 1);
      const si = SWINFO[World.get(T.x, T.y, T.z)];
      if (si && si.on) { World.set(T.x, T.y, T.z, si.off); Sfx.button && Sfx.button(si.wood, false); Power.update(T.x, T.y, T.z); }
    }
  }
};
// открыть / закрыть дверь (обе половины); возвращает true, если состояние изменилось
function toggleTrap(x, y, z, want) {
  const id = World.get(x, y, z), ti = TRAPINFO[id]; if (!ti) return false;
  const open = want === undefined ? !ti.open : want;
  if (open === ti.open) return false;
  const v = World.orientOf(x, y, z);
  World.set(x, y, z, open ? ti.openId : ti.closed); World.orient.set(pkey(x, y, z), v);
  Sfx.door(ti.mat, open, x + 0.5, y + 0.5, z + 0.5);
  return true;
}
function toggleDoor(x, y, z, want) {
  const di = DOORINFO[World.get(x, y, z)]; if (!di) return false;
  const ly = di.half ? y - 1 : y, lo = World.get(x, ly, z), dl = DOORINFO[lo];
  if (!dl || dl.half || !DOORINFO[World.get(x, ly + 1, z)]) return false;
  const open = want === undefined ? !dl.open : want;
  if (open === dl.open) return false;
  const o = World.orientOf(x, ly, z);
  if (!open) {   // нельзя захлопнуть дверь на игроке
    const sb = doorBox(dl.ids[0], o), b = Player.box();
    if (x + sb[3] > b[0] && x + sb[0] < b[3] && z + sb[5] > b[2] && z + sb[2] < b[5] && ly + 2 > b[1] && ly < b[4]) return false;
  }
  World.set(x, ly, z, open ? dl.ids[2] : dl.ids[0]); World.set(x, ly + 1, z, open ? dl.ids[3] : dl.ids[1]);
  World.orient.set(pkey(x, ly, z), o); World.orient.set(pkey(x, ly + 1, z), o);
  Sfx.door(dl.mat, open, x + 0.5, ly + 1, z + 0.5);
  Ents.doorEvent && Ents.doorEvent(x, ly, z, open);
  return true;
}
// взаимодействие каждый кадр
function playerInteract(dt) {
  const p = Player, creative = Game.mode === 'creative';
  const d = lookDir();
  const hit = raycast(p.x, p.y + EYE, p.z, d[0], d[1], d[2], creative ? 5.5 : 4.6);
  p.target = hit;
  p.placeCD -= dt;
  // левая кнопка — ломать
  if (Input.mouse[0] && hit) {
    p.swinging = true;
    const same = p.breakPos && p.breakPos[0] === hit.x && p.breakPos[1] === hit.y && p.breakPos[2] === hit.z;
    if (!same) { p.breakPos = [hit.x, hit.y, hit.z]; p.breakP = 0; }
    if (creative) {
      if (p.placeCD <= 0) { if (hit.id !== B.BEDROCK || creative) breakBlock(hit.x, hit.y, hit.z); p.placeCD = 0.22; p.breakPos = null; }
    } else {
      const bt = breakTime(hit.id, p.held());
      if (bt !== Infinity) {
        p.breakP += dt / bt;
        p.digSoundT -= dt;
        if (p.digSoundT <= 0) { p.digSoundT = 0.24; Sfx.dig(BLK[hit.id].sound); if (Math.random() < 0.6) Ents.digParticle(hit); }
        if (p.breakP >= 1) { breakBlock(hit.x, hit.y, hit.z); p.breakP = 0; p.breakPos = null; p.placeCD = 0.15; }
      }
    }
  } else {
    if (!Input.mouse[0]) { p.breakP = 0; p.breakPos = null; }
    p.swinging = false;
  }
  if (Input.clicked[0] && !hit) p.swing = p.swing > 0 ? p.swing : 0.001;
  // правая кнопка — поставить / открыть
  const hb = p.held();
  const bucketUsed = !!(Input.clicked[2] && p.placeCD <= 0 && hb && hb.id >= 310 && hb.id <= 312 && useBucket(hb, hit));
  if (bucketUsed) Input.mouse[2] = false;
  const hbA = p.slots[p.selected], armA = hbA && ITEMS[hbA.id] && ITEMS[hbA.id].armor;
  if (armA && Input.clicked[2] && p.placeCD <= 0 && !bucketUsed && !(hit && (hit.id === B.TABLE || hit.id === B.FURNACE || hit.id === B.FURNACE_LIT || hit.id === B.CHEST || isSwitch(hit.id) || isDoor(hit.id)))) {
    // правая кнопка с бронёй в руке — надеть (если слот занят, меняем)
    const old = p.armor[armA.slot]; p.armor[armA.slot] = hbA; p.slots[p.selected] = old || null;
    Sfx.material('stone', 0.5, true); p.swing = 0.001; p.placeCD = 0.3; Input.mouse[2] = false; UI.refreshHotbar(); UI.refreshHud();
  } else if (Input.mouse[2] && p.placeCD <= 0 && !bucketUsed) {
    if (hit) {
      const tid = hit.id;
      if (Input.clicked[2] && !p.sneaking && (tid === B.TABLE || tid === B.FURNACE || tid === B.FURNACE_LIT || tid === B.CHEST)) {
        UI.openBlockScreen(tid, hit.x, hit.y, hit.z);
        Input.mouse[2] = false;
      } else if (Input.clicked[2] && !p.sneaking && isSwitch(tid)) {
        Switch.use(hit.x, hit.y, hit.z); p.swing = 0.001; p.placeCD = 0.25; Input.mouse[2] = false;
      } else if (Input.clicked[2] && !p.sneaking && isTrap(tid)) {
        if (TRAPINFO[tid].mat === 'iron') Sfx.dig('metal');      // железный люк — только рычагом или кнопкой
        else toggleTrap(hit.x, hit.y, hit.z);
        p.swing = 0.001; p.placeCD = 0.25; Input.mouse[2] = false;
      } else if (Input.clicked[2] && !p.sneaking && isDoor(tid)) {
        if (DOORINFO[tid].mat === 'iron') Sfx.dig('metal');      // железная дверь руками не открывается — только рычагом или кнопкой
        else toggleDoor(hit.x, hit.y, hit.z);
        p.swing = 0.001; p.placeCD = 0.25; Input.mouse[2] = false;
      } else if (Input.clicked[2] && (tid === B.TV || tid === B.TV_ON) && !p.slots[p.selected]) {
        // голой рукой включаем / выключаем телевизор
        const o = World.orientOf(hit.x, hit.y, hit.z), on = tid === B.TV;
        World.set(hit.x, hit.y, hit.z, on ? B.TV_ON : B.TV); World.orient.set(pkey(hit.x, hit.y, hit.z), o);
        Sfx.tv(on); p.swing = 0.001; p.placeCD = 0.3; Input.mouse[2] = false;
      } else if (placeBlock(hit)) { p.swing = 0.001; p.placeCD = 0.22; }
      else p.placeCD = 0.05;
    }
  }
  if (Input.clicked[1] && hit && creative) {
    // средняя кнопка: взять блок
    let id = isSwitch(hit.id) ? SWINFO[hit.id].off : isDoor(hit.id) ? DOORINFO[hit.id].lo : isTrap(hit.id) ? TRAPINFO[hit.id].closed : isTorch(hit.id) ? B.TORCH : hit.id === B.FURNACE_LIT ? B.FURNACE : hit.id === B.TV_ON ? B.TV : hit.id;
    if (ITEMS[id]) {
      const idx = p.slots.slice(0, 9).findIndex(s => s && s.id === id);
      if (idx >= 0) p.selected = idx; else p.slots[p.selected] = { id, count: 64, dmg: 0 };
      UI.refreshHotbar();
    }
  }
  if (p.swinging || p.swing > 0) {
    p.swing += dt * 3.2;
    if (p.swing >= 1) p.swing = p.swinging ? 0.001 : 0;
  }
  Input.clicked[0] = Input.clicked[1] = Input.clicked[2] = false;
}
