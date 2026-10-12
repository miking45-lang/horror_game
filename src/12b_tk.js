// ============================================================
//  Телекинез деревьев (как физпушка в Garry's Mod). Владелец в облике существа:
//  ПКМ по дереву (до 48 блоков) — существо тянет к нему руку, дерево отрывается и висит перед вами;
//  пока ПКМ зажата — дерево следует за прицелом, колёсико наклоняет его;
//  ЛКМ при зажатой ПКМ — ладонь раскрывается, дерево летит по прицелу, разбивается, ломает блоки и ранит игрока;
//  отпустили ПКМ без броска — дерево падает и рассыпается не полностью.
//  Мир меняет только хозяин мира (по месту удара), остальные видят полёт и обломки.
// ============================================================
const TK = {
  held: null,            // своё удерживаемое дерево
  remote: new Map(),     // чужие удерживаемые деревья: id -> T
  flying: [],            // летящие/падающие деревья (у всех)
  debris: [],            // обломки (у всех)
  sendT: 0, openT: 0, lastAim: null,
  canUse() { return Net.canCmd() && Net.form === 'creature' && Game.state === 'play' && !UI.gui && !Menus.cur && !Player.dead; },
  // ---------- ввод (только у владельца) ----------
  mouseDown(btn) {
    if (this.heldP) { if (btn === 0) this.releasePlayer(true); return true; }
    if (this.held) { if (btn === 0) this.release(true); return true; }
    if (btn === 2 && this.canUse() && this.grabPlayer()) return true;
    if (btn === 0 && this.canUse() && this.trySlash()) return true;
    if (btn !== 2 || !this.canUse()) return false;
    return this.grab();
  },
  // ЛКМ вплотную к хозяину мира — рассечение (у хозяина: падение от первого лица, затем вид со стороны)
  slashT: 0,
  trySlash() {
    const q = Net.peers.get(Net.hostUid), p = Player, hs = p.hs || 1;
    if (!q || performance.now() - (q.seen || 0) > 5000) return false;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), f = lookDir(), fn = Math.hypot(f[0], f[2]) || 1;
    if (d > 2.2 + 1.4 * hs || Math.abs(q.y - p.y) > 2.5 * hs) return false;
    if (d > 0.5 && (dx * f[0] + dz * f[2]) / (d * fn) < 0.35) return false;   // игрок должен быть перед вами
    const now = performance.now(); if (now - this.slashT < 4000) return true;
    this.slashT = now;
    Net.send('cmd', { u: Net.uid, c: 'slash', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), hs });
    return true;
  },
  mouseUp(btn) {
    if (btn === 2 && this.heldP) { this.releasePlayer(false); return true; }
    if (btn === 2 && this.held) { this.release(false); return true; } return false;
  },
  wheel(dy) { if (this.heldP) return true; if (!this.held) return false; this.held.tilt += (dy > 0 ? 1 : -1) * Math.PI / 12; return true; },
  // ---------- поворот: вокруг оси «вправо от взгляда» (наклон), затем по курсу владельца ----------
  rot(T, o) {
    const a0 = -T.yaw0, c0 = Math.cos(a0), s0 = Math.sin(a0);
    let x = o[0] * c0 + o[2] * s0, y = o[1], z = -o[0] * s0 + o[2] * c0;           // в систему владельца на момент захвата
    const ct = Math.cos(T.tilt), st = Math.sin(T.tilt);
    const y2 = y * ct - z * st, z2 = y * st + z * ct; y = y2; z = z2;                // наклон колёсиком
    const a = T.yawC, c = Math.cos(a), s = Math.sin(a);
    return [x * c + z * s, y, -x * s + z * c];
  },
  // ---------- захват ----------
  grab() {
    const p = Player, d = lookDir(), ey = p.y + EYE * (p.hs || 1);
    const hit = raycast(p.x, ey, p.z, d[0], d[1], d[2], 48);
    if (!hit || !(isLogId(hit.id) || isLeafId(hit.id))) return false;
    // ствол: связанные брёвна; крона: листья не дальше 4 шагов от ствола
    let start = hit;
    if (isLeafId(hit.id)) {   // попали в листву — ищем ближайшее бревно рядом
      let best = null, bd = 1e9;
      for (let dx = -4; dx <= 4; dx++) for (let dy = -6; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) {
        if (isLogId(World.get(hit.x + dx, hit.y + dy, hit.z + dz))) { const dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; best = { x: hit.x + dx, y: hit.y + dy, z: hit.z + dz }; } }
      }
      if (!best) return false; start = best;
    }
    const key = (x, y, z) => x + ',' + y + ',' + z, seen = new Set(), logs = [], cells = [];
    const q = [[start.x, start.y, start.z]]; seen.add(key(start.x, start.y, start.z));
    while (q.length && logs.length < 220) {
      const [x, y, z] = q.shift(); logs.push([x, y, z]);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const nx = x + dx, ny = y + dy, nz = z + dz, k = key(nx, ny, nz);
        if (seen.has(k) || Math.abs(nx - start.x) > 6 || Math.abs(nz - start.z) > 6 || ny < 1) continue;
        if (isLogId(World.get(nx, ny, nz))) { seen.add(k); q.push([nx, ny, nz]); }
      }
    }
    const lq = logs.map(l => [l[0], l[1], l[2], 0]);
    for (const l of logs) cells.push([l[0], l[1], l[2], World.get(l[0], l[1], l[2])]);
    const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    while (lq.length && cells.length < 600) {
      const [x, y, z, dep] = lq.shift(); if (dep >= 4) continue;
      for (const [dx, dy, dz] of N6) {
        const nx = x + dx, ny = y + dy, nz = z + dz, k = key(nx, ny, nz);
        if (seen.has(k)) continue; seen.add(k);
        const id = World.get(nx, ny, nz);
        if (isLeafId(id)) { cells.push([nx, ny, nz, id]); lq.push([nx, ny, nz, dep + 1]); }
      }
    }
    if (!cells.length) return false;
    // центр масс — точка, за которую держим
    let cx = 0, cy = 0, cz = 0; for (const c of cells) { cx += c[0] + 0.5; cy += c[1] + 0.5; cz += c[2] + 0.5; }
    cx /= cells.length; cy /= cells.length; cz /= cells.length;
    const blocks = cells.map(c => [+(c[0] + 0.5 - cx).toFixed(2), +(c[1] + 0.5 - cy).toFixed(2), +(c[2] + 0.5 - cz).toFixed(2), c[3]]);
    // убираем дерево из мира (изменения уйдут хозяину и остальным как обычные правки блоков)
    Net.cap++; try { for (const c of cells) World.set(c[0], c[1], c[2], 0); } finally { Net.cap--; }
    const dist = clamp(Math.hypot(cx - p.x, cy - ey, cz - p.z), 6, 16);
    const id = Math.random().toString(36).slice(2, 9);
    this.held = { id, blocks, pos: [cx, cy, cz], dist, yaw0: p.yaw, yawC: p.yaw, tilt: 0 };
    Net.send('gt', { u: Net.uid, id, b: blocks.flat(), x: cx, y: cy, z: cz, y0: p.yaw });
    this.openT = 0; Net.lastSent = ''; Net.sendT = 0;
    return true;
  },
  release(thrown) {
    const H = this.held; if (!H) return;
    this.held = null;
    const d = lookDir(), v = thrown ? [d[0] * 34, d[1] * 34 + 2, d[2] * 34] : [0, 0, 0];
    const F = { id: H.id, blocks: H.blocks, pos: H.pos.slice(), vel: v, yaw0: H.yaw0, yawC: H.yawC, tilt: H.tilt, spin: thrown ? 2.2 : 0.4, t: 0, mode: thrown ? 'throw' : 'drop' };
    this.flying.push(F);
    Net.send('gx', { u: Net.uid, id: H.id, x: F.pos[0], y: F.pos[1], z: F.pos[2], vx: v[0], vy: v[1], vz: v[2], yc: F.yawC, t: F.tilt, m: F.mode });
    this.openT = thrown ? 0.5 : 0.25;   // ладонь разжата, затем рука опускается
    this.lastAim = F.pos.slice(); Net.lastSent = ''; Net.sendT = 0;
  },
  // куда тянется рука (для позы существа): [x,y,z] или 0, и раскрыта ли ладонь
  aim() {
    if (this.heldP) return { ag: this.heldP.pos.map(v => +v.toFixed(1)), ao: 0 };
    if (this.held) return { ag: this.held.pos.map(v => +v.toFixed(1)), ao: 0 };
    if (this.openT > 0 && this.lastAim) return { ag: this.lastAim.map(v => +v.toFixed(1)), ao: 1 };
    return { ag: 0, ao: 0 };
  },
  // ---------- игрок в руках (владелец берёт хозяина мира) ----------
  heldP: null, carried: null, pflight: null,
  grabPlayer() {
    const q = Net.peers.get(Net.hostUid), p = Player;
    if (!q || performance.now() - (q.seen || 0) > 5000) return false;
    const d = lookDir(), ey = p.y + EYE * (p.hs || 1), C = [q.x, q.y + 0.9, q.z];
    const t = (C[0] - p.x) * d[0] + (C[1] - ey) * d[1] + (C[2] - p.z) * d[2];
    if (t < 1 || t > 48) return false;
    const miss = Math.hypot(C[0] - (p.x + d[0] * t), C[1] - (ey + d[1] * t), C[2] - (p.z + d[2] * t));
    if (miss > 0.9) return false;
    const hit = raycast(p.x, ey, p.z, d[0], d[1], d[2], t);
    if (hit && hit.t < t - 0.6) return false;                     // игрока закрывает стена
    this.heldP = { pos: C.slice(), dist: clamp(t, 3, 16) };
    this.sendT = 0; Net.lastSent = ''; Net.sendT = 0;
    return true;
  },
  releasePlayer(thrown) {
    const H = this.heldP; if (!H) return;
    this.heldP = null;
    const d = lookDir(), v = thrown ? [d[0] * 30, d[1] * 30 + 3, d[2] * 30] : [0, 0, 0];
    Net.send('pt', { u: Net.uid, vx: +v[0].toFixed(2), vy: +v[1].toFixed(2), vz: +v[2].toFixed(2) });
    this.openT = thrown ? 0.5 : 0.25; this.lastAim = H.pos.slice(); Net.lastSent = ''; Net.sendT = 0;
  },
  // у хозяина мира: владелец держит/бросает его игрока
  onPHold(v) {
    if (!v || Net.role !== 'host' || !Net.isOwnerPeer(v.u) || !Number.isFinite(v.x)) return;
    const p = Player; if (p.dead || Ents.killS || Ents.mawS || Ents.slashS) return;
    if (!this.carried) this.carried = { tgt: [v.x, v.y, v.z], seen: performance.now(), peak: p.y };
    else { this.carried.tgt = [v.x, v.y, v.z]; this.carried.seen = performance.now(); }
    this.pflight = null;
  },
  onPThrow(v) {
    if (!v || Net.role !== 'host' || !Net.isOwnerPeer(v.u) || !this.carried) return;
    this.carried = null;
    this.pflight = { v: [+v.vx || 0, +v.vy || 0, +v.vz || 0], t: 0 };
  },
  hostCarry(dt) {
    const p = Player;
    if (this.carried) {
      const C = this.carried;
      if (performance.now() - C.seen > 1500 || p.dead) { this.carried = null; this.pflight = p.dead ? null : { v: [0, 0, 0], t: 0 }; return; }
      const k = Math.min(1, dt * 12);
      p.x += (C.tgt[0] - p.x) * k; p.y += (C.tgt[1] - p.y) * k; p.z += (C.tgt[2] - p.z) * k;
      p.vx = p.vy = p.vz = 0; p.fallDist = 0; Ents.huntLock = true;
      return;
    }
    if (!this.pflight) return;
    // полёт после броска или падение: своя баллистика, удар — по скорости в момент столкновения
    const F = this.pflight; F.t += dt; Ents.huntLock = true;
    F.v[1] -= 25 * dt;
    const nx = p.x + F.v[0] * dt, ny = p.y + F.v[1] * dt, nz = p.z + F.v[2] * dt;
    const solidAt = (x, y, z) => { for (const yy of [0.05, 0.9, 1.75]) for (const dx of [-0.29, 0.29]) for (const dz of [-0.29, 0.29]) if (SOLID[World.get(Math.floor(x + dx), Math.floor(y + yy), Math.floor(z + dz))]) return true; return false; };
    if (solidAt(nx, ny, nz) || F.t > 10 || ny < -20) {
      const speed = Math.hypot(F.v[0], F.v[1], F.v[2]);
      this.pflight = null; Ents.huntLock = false; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
      let dmg = Math.max(0, Math.ceil(speed - 10));                       // чем выше/дальше/сильнее — тем больнее
      if (isWater(World.get(Math.floor(p.x), Math.floor(p.y + 0.2), Math.floor(p.z)))) dmg = Math.floor(dmg * 0.2);
      if (dmg > 0) { hurtPlayer(dmg, true); Game.flickerPulse = Math.max(Game.flickerPulse || 0, 0.15); }
      this._lastLand = { speed: +speed.toFixed(1), dmg };
      return;
    }
    p.x = nx; p.y = ny; p.z = nz; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
  },
  // ---------- сеть ----------
  onGrab(v) {
    if (!v || v.u === Net.uid || !Array.isArray(v.b)) return;
    const blocks = []; for (let i = 0; i + 3 < v.b.length && blocks.length < 700; i += 4) blocks.push([v.b[i], v.b[i + 1], v.b[i + 2], v.b[i + 3] | 0]);
    this.remote.set(v.id, { id: v.id, blocks, pos: [v.x, v.y, v.z], tgt: [v.x, v.y, v.z], yaw0: v.y0 || 0, yawC: v.y0 || 0, tilt: 0, seen: performance.now() });
  },
  onPose(v) {
    const T = v && this.remote.get(v.id); if (!T) return;
    T.tgt = [v.x, v.y, v.z]; T.yawC = v.yc; T.tilt = v.t; T.seen = performance.now();
  },
  onThrow(v) {
    const T = v && this.remote.get(v.id); if (!T) return;
    this.remote.delete(v.id);
    this.flying.push({ id: v.id, blocks: T.blocks, pos: [v.x, v.y, v.z], vel: [v.vx, v.vy, v.vz], yaw0: T.yaw0, yawC: v.yc, tilt: v.t, spin: v.m === 'throw' ? 2.2 : 0.4, t: 0, mode: v.m === 'throw' ? 'throw' : 'drop' });
  },
  // ---------- кадр ----------
  update(dt) {
    const p = Player;
    if (this.held && !this.canUse()) this.release(false);   // сменили облик/вышли — дерево падает
    if (this.heldP && !this.canUse()) this.releasePlayer(false);
    if (this.heldP) {                       // держим игрока: точка перед прицелом
      const H = this.heldP, d = lookDir(), ey = p.y + EYE * (p.hs || 1), k = Math.min(1, dt * 9);
      const tg = [p.x + d[0] * H.dist, ey + d[1] * H.dist, p.z + d[2] * H.dist];
      for (let i = 0; i < 3; i++) H.pos[i] += (tg[i] - H.pos[i]) * k;
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 0.066; Net.send('ph', { u: Net.uid, x: +H.pos[0].toFixed(2), y: +(H.pos[1] - 0.9).toFixed(2), z: +H.pos[2].toFixed(2) }); }
    }
    this.hostCarry(dt);
    if (this.held) {
      const H = this.held, d = lookDir(), ey = p.y + EYE * (p.hs || 1), k = Math.min(1, dt * 9);
      const tg = [p.x + d[0] * H.dist, ey + d[1] * H.dist, p.z + d[2] * H.dist];
      for (let i = 0; i < 3; i++) H.pos[i] += (tg[i] - H.pos[i]) * k;
      H.yawC = p.yaw;
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 0.1; Net.send('gp', { u: Net.uid, id: H.id, x: +H.pos[0].toFixed(2), y: +H.pos[1].toFixed(2), z: +H.pos[2].toFixed(2), yc: +H.yawC.toFixed(3), t: +H.tilt.toFixed(3) }); }
    }
    if (this.openT > 0) { this.openT -= dt; if (this.openT <= 0) { this.lastAim = null; Net.lastSent = ''; Net.sendT = 0; } }
    const now = performance.now();
    for (const [id, T] of this.remote) {
      if (now - T.seen > 6000) { this.remote.delete(id); continue; }
      const k = Math.min(1, dt * 12); for (let i = 0; i < 3; i++) T.pos[i] += (T.tgt[i] - T.pos[i]) * k;
    }
    // полёт / падение
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const F = this.flying[i]; F.t += dt;
      F.vel[1] -= (F.mode === 'throw' ? 8 : 22) * dt;
      for (let a = 0; a < 3; a++) F.pos[a] += F.vel[a] * dt;
      F.tilt += F.spin * dt;
      const hitAt = this.collide(F);
      if (hitAt || F.t > 8 || F.pos[1] < -10) { this.flying.splice(i, 1); this.impact(F, hitAt || F.pos); }
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const b = this.debris[i]; b.t += dt; if (b.t > b.life) { this.debris.splice(i, 1); continue; }
      b.vy -= 18 * dt; const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, nz = b.z + b.vz * dt;
      if (SOLID[World.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { b.vx *= 0.4; b.vz *= 0.4; b.vy = Math.abs(b.vy) * 0.25; }
      else { b.x = nx; b.y = ny; b.z = nz; }
    }
  },
  // столкновение: проверяем часть блоков дерева и (при броске) игрока
  collide(F) {
    const n = F.blocks.length, step = Math.max(1, Math.floor(n / 70)), p = Player;
    for (let j = 0; j < n; j += step) {
      const o = this.rot(F, F.blocks[j]), x = F.pos[0] + o[0], y = F.pos[1] + o[1], z = F.pos[2] + o[2];
      if (SOLID[World.get(Math.floor(x), Math.floor(y), Math.floor(z))]) return [x, y, z];
      if (F.mode === 'throw' && Net.role === 'host' && !p.dead && Math.abs(x - p.x) < 0.9 && Math.abs(z - p.z) < 0.9 && y > p.y - 0.3 && y < p.y + 2.1) return [x, y, z];
    }
    return null;
  },
  impact(F, at) {
    const thrown = F.mode === 'throw', n = F.blocks.length;
    // обломки (видят все)
    const cnt = thrown ? 90 : 45;
    for (let i = 0; i < cnt && this.debris.length < 400; i++) {
      const b = F.blocks[Math.floor(Math.random() * n)], o = this.rot(F, b), sp = thrown ? 9 : 4;
      this.debris.push({ id: b[3], x: F.pos[0] + o[0], y: F.pos[1] + o[1], z: F.pos[2] + o[2], vx: (Math.random() - 0.5) * sp, vy: Math.random() * sp * 0.8, vz: (Math.random() - 0.5) * sp, s: 0.12 + Math.random() * 0.22, t: 0, life: 1.6 + Math.random() * 1.6 });
    }
    this._last = { at: at.map(v => +v.toFixed(1)), mode: F.mode };
    try { Sfx.breakB(thrown ? 'wood' : 'grass'); if (thrown) Sfx.staticBurst(); } catch (e) { }
    if (thrown) Game.flickerPulse = Math.max(Game.flickerPulse || 0, 0.2);
    if (Net.role !== 'host') return;   // мир и урон — только у хозяина
    const p = Player, R = thrown ? 3.2 + Math.min(2, n / 150) : 1.6;
    Net.cap++;
    try {
      for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) {
        const x = Math.floor(at[0]) + dx, y = Math.floor(at[1]) + dy, z = Math.floor(at[2]) + dz;
        if (y < 1 || y >= WH) continue;
        const id = World.get(x, y, z); if (!id || id === B.BEDROCK) continue;
        const d = Math.hypot(x + 0.5 - at[0], y + 0.5 - at[1], z + 0.5 - at[2]); if (d > R) continue;
        if (Math.random() < 1 - Math.pow(d / R, 1.5)) World.set(x, y, z, 0);   // в центре — всё, к краю — реже
      }
      // падение (не бросок): часть дерева остаётся кучей на земле
      if (!thrown) for (const b of F.blocks) {
        if (Math.random() > 0.4) continue;
        const o = this.rot(F, b), x = Math.floor(F.pos[0] + o[0]), z = Math.floor(F.pos[2] + o[2]), y = World.topY(x, z) + 1;
        if (y > 0 && y < WH && !World.get(x, y, z)) World.set(x, y, z, b[3]);
      }
    } finally { Net.cap--; }
    // урон игроку: чем ближе к центру удара, тем больше
    const d = Math.hypot(p.x - at[0], p.y + 0.9 - at[1], p.z - at[2]), reach = R + 1.5;
    if (!p.dead && d < reach) hurtPlayer(Math.ceil((thrown ? 22 : 10) * (1 - d / reach)), true);
  },
  // ---------- отрисовка ----------
  drawTree(batch, cam, T) {
    const l = World.light(Math.floor(T.pos[0]), Math.floor(T.pos[1]) + 8, Math.floor(T.pos[2])), sky = Math.max(0.75, (l >> 4) / 15), blk = (l & 15) / 15;
    // базис поворота один раз на дерево
    const ex = this.rot(T, [1, 0, 0]), ey = this.rot(T, [0, 1, 0]), ez = this.rot(T, [0, 0, 1]);
    for (const b of T.blocks) {
      const o = this.rot(T, b), bx = T.pos[0] + o[0] - cam.x, by = T.pos[1] + o[1] - cam.y, bz = T.pos[2] + o[2] - cam.z;
      batchBlock(batch, b[3], (x, y, z) => { x -= 0.5; y -= 0.5; z -= 0.5; return [bx + ex[0] * x + ey[0] * y + ez[0] * z, by + ex[1] * x + ey[1] * y + ez[1] * z, bz + ex[2] * x + ey[2] * y + ez[2] * z]; }, sky, blk);
    }
  },
  draw(batch, cam) {
    if (this.held) this.drawTree(batch, cam, this.held);
    for (const T of this.remote.values()) this.drawTree(batch, cam, T);
    for (const F of this.flying) this.drawTree(batch, cam, F);
    for (const b of this.debris) {
      const s = b.s * Math.min(1, (b.life - b.t) / 0.5 + 0.2), x0 = b.x - cam.x, y0 = b.y - cam.y, z0 = b.z - cam.z;
      const l = World.light(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z));
      batchBlock(batch, b.id, (x, y, z) => [x0 + (x - 0.5) * s, y0 + (y - 0.5) * s, z0 + (z - 0.5) * s], (l >> 4) / 15, (l & 15) / 15);
    }
  },
  clear() { this.heldP = null; this.carried = null; this.pflight = null; this.held = null; this.remote.clear(); this.flying.length = 0; this.debris.length = 0; this.openT = 0; this.lastAim = null; }
};
