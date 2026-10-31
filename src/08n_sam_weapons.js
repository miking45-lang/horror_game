// ============================================================
//  Облик «Серьёзный Сэм»: оружие. Вид от первого лица (клипы игры с их событиями: звук, вспышка, гильзы, огонь),
//  выстрелы, снаряды, взрывы, частицы эффектов из .pfx игры, переключение оружия как в Serious Sam HD.
// ============================================================
// Как ведёт себя оружие (порт WeaponStats мода): время между выстрелами, урон (здоровье игрока — 20), дробь, разброс.
const SAM_STATS = {
  hd_knife: { cd: 0.6, dmg: 7, melee: 3, hit: 0.3 },
  hd_chainsaw: { cd: 0.15, dmg: 3, melee: 3, auto: 1, hold: 1, every: 1.9 },
  hd_colt: { cd: 0.5, dmg: 5, pel: 1, spr: 0.4, alt: 1 },
  hd_singleshotgun: { cd: 1.15, dmg: 3.2, pel: 8, spr: 4.5 },
  hd_doubleshotgun: { cd: 1.7, dmg: 3.2, pel: 14, spr: 5.5 },
  hd_tommygun: { cd: 0.1, dmg: 3, pel: 1, spr: 1.6, auto: 1 },
  hd_minigun: { cd: 0.05, dmg: 2.4, pel: 1, spr: 2.6, auto: 1, hold: 1, spin: 0.35 },
  hd_rocketlauncher: { cd: 0.63, dmg: 10, proj: 'rocket', blast: 2.6 },
  hd_grenadelauncher: { cd: 0.67, dmg: 9, proj: 'grenade', blast: 2.2 },
  hd_flamer: { cd: 0.1, dmg: 1.5, proj: 'flame', auto: 1, hold: 1, every: 0.85 },
  hd_laser: { cd: 0.15, dmg: 4.5, proj: 'laser', auto: 1, alt: 1 },
  hd_sniper: { cd: 1.5, dmg: 38, pel: 1, spr: 0.02, range: 300, zoom: 4 },
  hd_cannon: { cd: 1.0, dmg: 20, proj: 'cannonball', blast: 3.2, charge: 1 },
  hd_seriousbomb: { cd: 2.0, dmg: 300, bomb: 32 }
};
// клавиши 1–9, 0: группы оружия, повторное нажатие листает внутри группы (как в Serious Sam)
const SAM_SLOTS = [['hd_knife', 'hd_chainsaw'], ['hd_colt'], ['hd_singleshotgun', 'hd_doubleshotgun'], ['hd_tommygun', 'hd_minigun'],
  ['hd_rocketlauncher', 'hd_grenadelauncher'], ['hd_flamer'], ['hd_laser'], ['hd_sniper'], ['hd_cannon'], ['hd_seriousbomb']];
// поза Сэма (верх тела) под оружие и клип выстрела — клипы его модели
const SAM_BODY = {
  hd_knife: ['Body_Idle_Knife', 'Body_KnifeBackStab'], hd_chainsaw: ['Body_Idle_Chainsaw', null],
  hd_colt: ['Body_Idle_DualColt', 'Body_Fire_Pistol'], hd_singleshotgun: ['Body_Idle_SingleShotgun', 'Body_Fire_SingleShotgun'],
  hd_doubleshotgun: ['Body_Idle_DoubleShotgun', 'Body_Fire_DoubleShotgun'], hd_tommygun: ['Body_Idle_Tommygun', 'Body_Fire_AssaultRifle'],
  hd_minigun: ['Body_Idle_Minigun', 'Body_Fire_AssaultRifle'], hd_rocketlauncher: ['Body_Idle_RocketLauncher', 'Body_Fire_RocketLauncher'],
  hd_grenadelauncher: ['Body_GrenadeLauncherIdle_NotReady', 'Body_Fire_RocketLauncher'], hd_flamer: ['Body_Idle_Flamer', null],
  hd_laser: ['Body_Idle_Laser', 'Body_Fire_Laser'], hd_sniper: ['Body_Idle_Sniper', 'Body_Fire_Sniper'],
  hd_cannon: ['Body_Idle_Cannon', 'Body_Fire_Cannon'], hd_seriousbomb: ['Body_Idle_SeriousBomb', 'Body_Throw_Explosives']
};

Object.assign(Sam, {
  // ---------- описание оружия: роли клипов (как WeaponDef.resolveClips) ----------
  prepWeapon(w, i) {
    const names = Object.keys(w.clips), has = n => names.includes(n), first = (...a) => a.find(has) || null;
    const isFire = n => {
      const l = n.toLowerCase();
      if (/aim|singlearm|noreload|_old|idle|zoom|activate|sprint|reload|arms_|shove|fast|teeth/.test(l)) return false;
      return l.startsWith('fire') || l.includes('_fire') || l.startsWith('attack') || l.startsWith('barrelfire') || l.includes('throw') || l === 'plant';
    };
    let fire = names.filter(isFire);
    if (fire.some(n => n.toLowerCase().startsWith('barrelfire'))) fire = fire.filter(n => n.toLowerCase().startsWith('barrelfire'));
    else if (fire.includes('Fire') && fire.length > 1) fire = ['Fire', ...fire.filter(n => n !== 'Fire' && !n.includes('_Fire'))];
    return Object.assign({}, w, {
      i, st: SAM_STATS[w.id] || { cd: 0.5, dmg: 4 }, fire,
      activate: first('Activate'), idle: first('Idle', 'Idle01', 'Wait', 'Wait01', 'IdleMinigun'),
      boring: ['Boring', 'Boring01', 'Wait02', 'Idle02'].filter(has), body: SAM_BODY[w.id] || ['Body_Idle', null]
    });
  },
  onReady() {
    for (const w of this.weapons) for (const h of ['R_Hand', 'L_Hand']) this.gripOf(w, h);   // хват оружия от третьего лица
    // листы «…_add» в игре всегда складываются со светом (чёрный фон без прозрачности)
    const fixE = list => { for (const e of list || []) e.additive = e.additive || /_add$/.test(e.tex); };
    for (const w in this.D.fx) for (const k in this.D.fx[w]) fixE(this.D.fx[w][k].em);
    for (const k in this.D.proj) { fixE(this.D.proj[k].trail); fixE(this.D.proj[k].boom); }
    for (const k in this.D.hits) fixE(this.D.hits[k]);
    this.cur = this.cur || 'hd_tommygun';
    this.view.select(this.W[this.cur]);
    this.buildBar();
  },
  // ---------- включение облика ----------
  on() { return Net.form === 'sam'; },
  activate() { this.load(); this.showBar(); },
  deactivate() { this.view.def = null; this.fireHeld = false; $('samBar') && ($('samBar').style.opacity = 0); },

  // ---------- выбор оружия ----------
  select(id) {
    if (!this.W[id] || this.state !== 'ready') return;
    if (this.cur !== id) { this.prev = this.cur; this.cur = id; this.view.select(this.W[id]); this.cool = Math.max(this.cool || 0, this.clipLen(this.W[id], this.W[id].activate) || 0.2); this.charge = -1; Net.samSync && Net.samSync(); }
    this.showBar();
  },
  slotKey(n) {
    const g = SAM_SLOTS[n]; if (!g) return;
    const k = g.indexOf(this.cur);
    this.select(k >= 0 ? g[(k + 1) % g.length] : g[0]);
  },
  wheel(d) {
    const ids = SAM_SLOTS.flat(), k = ids.indexOf(this.cur);
    this.select(ids[(k + (d > 0 ? 1 : -1) + ids.length) % ids.length]);
  },
  clipLen(w, n) { return n && w.clips[n] ? w.clips[n][0] : 0; },

  // ---------- вид от первого лица (порт ViewWeapon) ----------
  view: {
    def: null, clip: null, prev: null, t: 0, pt: 0, loop: true, ploop: true, blendL: 0, blendT: 0, flash: 0,
    idleFor: 0, nextBoring: 10, holdPlaying: false, sinceShot: 0, spinVel: 0, spinA: 0, layer: null, layerT: 0, pending: [],
    select(d) {
      this.def = d; this.holdPlaying = false; this.layer = null; this.spinVel = 0; this.clip = this.prev = null; this.flash = 0; this.idleFor = 0;
      this.nextBoring = 8 + Math.random() * 8; this.pending.length = 0; Sam.viewFx.length = 0;
      if (d.activate) this.play(d.activate, false, 0); else this.play(d.idle, true, 0);
    },
    play(n, loop, blend) {
      const d = this.def; if (!n || !d || !d.clips[n]) return;
      if (this.clip && blend > 0) { this.prev = this.clip; this.pt = this.t; this.ploop = this.loop; this.blendT = this.blendL = blend; } else { this.prev = null; this.blendL = 0; }
      this.clip = n; this.t = 0; this.loop = loop; this.idleFor = 0;
      this.collect(n, -1, 0.0001);
    },
    collect(n, a, b) { const c = this.def.clips[n]; if (c) for (const e of c[1]) if (e[0] > a && e[0] <= b) this.pending.push(e); },
    shot(variant) {
      const d = this.def; if (!d) return;
      if (d.st.melee && d.id === 'hd_knife') { this.play(d.fire[variant % Math.max(1, d.fire.length)] || d.fire[0], false, 0.05); return; }
      if (!d.fire.length) return;
      const n = d.fire[((variant % d.fire.length) + d.fire.length) % d.fire.length];
      if (d.st.hold) { this.sinceShot = 0; if (!this.holdPlaying) { this.holdPlaying = true; if (d.clips.IdleToFire) this.play('IdleToFire', false, 0.04); else this.play(n, true, 0.05); } }
      else if (n.toLowerCase().startsWith('barrelfire') && d.clips.Fire) { this.play('Fire', false, 0.02); this.layer = n; this.layerT = 0; }
      else this.play(n, false, 0.02);
    },
    advance(dt) {
      const d = this.def; if (!d) return;
      if (this.layer) { this.layerT += dt; const lc = d.clips[this.layer]; if (!lc || this.layerT > lc[0]) this.layer = null; }
      if (this.holdPlaying) { this.sinceShot += dt; if (this.sinceShot > 0.25) { this.holdPlaying = false; this.play(d.idle, true, 0.15); } }
      if (!this.clip) return;
      const c = d.clips[this.clip], len = c ? Math.max(c[0], 0.01) : 0, t0 = this.t;
      this.t += dt;
      if (this.blendL > 0) this.blendL = Math.max(0, this.blendL - dt);
      if (this.prev) this.pt += dt;
      if (this.t >= len) {
        if (this.loop) {
          this.collect(this.clip, t0, len); this.t -= len; if (this.t > len) this.t = 0; this.collect(this.clip, -1, this.t);
          if (this.clip === d.idle) { this.idleFor += len; if (d.boring.length && this.idleFor > this.nextBoring) { this.nextBoring = 10 + Math.random() * 10; this.play(d.boring[Math.floor(Math.random() * d.boring.length)], false, 0.15); } }
        } else {
          this.collect(this.clip, t0, len); this.t = len;
          if (this.holdPlaying && d.fire.length) this.play(d.fire[0], true, 0.03); else this.play(d.idle, true, 0.12);
        }
      } else this.collect(this.clip, t0, this.t);
    },
    busy() { return this.clip && !this.loop; }
  },
  viewFx: [],          // спрайты огня на стволе (пространство вида)
  // ---------- кадр: оружие в руках ----------
  update(dt) {
    if (this.state !== 'ready') return;
    const v = this.view, d = v.def; if (!d) return;
    this.clock = (this.clock || 0) + dt;
    this.cool = Math.max(0, (this.cool || 0) - dt);
    v.advance(dt);
    for (let i = this.viewFx.length - 1; i >= 0; i--) { const s = this.viewFx[i]; s.age += dt; if (s.age >= s.life) this.viewFx.splice(i, 1); }
    if (v.flash > 0) v.flash -= dt;
    // события клипов: звуки, вспышка, эффекты (огонь у ствола, гильзы)
    for (const e of v.pending) {
      if (e[1] === 'snd') this.sound(d.id + '.' + e[2].toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''));
      else if (e[1] === 'flash') v.flash = 0.07;
      else if (e[1] === 'fx') this.effect(d, e[2], e[3]);
    }
    v.pending.length = 0;
    // огнемёт: пламя у ствола, пока держим
    if (d.st.proj === 'flame' && v.holdPlaying) { this.flameT = (this.flameT || 0) + dt; if (this.flameT > 0.05) { this.flameT = 0; this.startViewFx(d, 'Fire', 0.3); } }
    // миниган раскручивает стволы
    const md = this.models[d.id], sb = md ? md.index.Barrels : undefined;
    if (sb !== undefined && d.st.spin) {
      const tgt = this.fireHeld ? 1 : 0;
      v.spinVel += (tgt - v.spinVel) * Math.min(1, dt * (tgt > v.spinVel ? 1.2 / d.st.spin : 1.4));
      if (v.spinVel < 0.003) v.spinVel = 0;
      v.spinA += v.spinVel * 1200 * Math.PI / 180 * dt;
    }
    this.fireLogic(dt);
    this.tickWorld(dt);
  },
  // ---------- стрельба (порт WeaponLogic) ----------
  fireLogic(dt) {
    const d = this.view.def, st = d.st, down = this.fireHeld, pressed = this.firePressed;
    this.firePressed = false;
    if (st.charge) {                                   // пушка: держим — заряжаем, отпускаем — выстрел
      if (this.charge < 0) { if (pressed && this.cool <= 0) this.charge = 0; return; }
      if (down && this.charge < 1.7) { this.charge += dt; return; }
      const c = this.charge; this.charge = -1; this.shoot(d, c); return;
    }
    const want = st.auto ? down : pressed;
    if (want && st.spin && this.cool <= 0) { this.spinT = (this.spinT || 0) + dt; if (this.spinT < st.spin) return; }
    else if (!down) this.spinT = 0;
    if (want && this.cool <= 0) this.shoot(d, 0);
  },
  shoot(d, charge) {
    const st = d.st, p = Player;
    const variant = this.variant = (this.variant || 0) + 1;
    this.cool = st.cd;
    this.view.shot(variant);
    if (!st.every || this.clock - (this.lastSnd || -99) >= st.every) { this.lastSnd = this.clock; this.sound(d.id + '.fire', undefined, undefined, undefined, 1, 0.97 + Math.random() * 0.06); }
    const eye = [p.x, p.y + EYE * (p.hs || 1) - (p.sneaking ? 0.1 : 0), p.z], dir = lookDir();
    const ev = { w: d.i, v: variant, o: eye.map(x => +x.toFixed(2)), d: dir.map(x => +x.toFixed(3)) };
    if (st.bomb) { this.seriousBomb(eye, true); ev.k = 'b'; }
    else if (st.melee) { this.meleeT = st.hit && d.id === 'hd_knife' ? st.hit : 0; if (!this.meleeT) this.melee(d); }
    else if (st.proj) {
      const shots = this.launch(d, eye, dir, variant, charge, true);
      ev.p = shots;
    } else {
      const hits = [];
      for (let i = 0; i < (st.pel || 1); i++) hits.push(this.hitscan(d, eye, this.spread(dir, st.spr || 0), st.range || 100, true));
      ev.h = hits;
    }
    this.bodyFire = 1;
    Net.samShot && Net.samShot(ev);
  },
  spread(dir, deg) {
    if (!deg) return dir;
    const up = Math.abs(dir[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nz = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    const r = nz(cr(dir, up)), u = nz(cr(r, dir));
    const k = Math.tan(deg * Math.PI / 180) * Math.sqrt(Math.random()), a = Math.random() * PI2;
    return nz([0, 1, 2].map(i => dir[i] + r[i] * k * Math.cos(a) + u[i] * k * Math.sin(a)));
  },
  // луч по блокам (шаг по клеткам) — первая твёрдая клетка или вода
  trace(o, d, maxD) {
    let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
    const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
    const tdx = sx ? Math.abs(1 / d[0]) : 1e9, tdy = sy ? Math.abs(1 / d[1]) : 1e9, tdz = sz ? Math.abs(1 / d[2]) : 1e9;
    let tx = sx ? (sx > 0 ? x + 1 - o[0] : o[0] - x) * tdx : 1e9, ty = sy ? (sy > 0 ? y + 1 - o[1] : o[1] - y) * tdy : 1e9, tz = sz ? (sz > 0 ? z + 1 - o[2] : o[2] - z) * tdz : 1e9;
    let t = 0, n = [0, 1, 0];
    for (let i = 0; i < 1200 && t <= maxD; i++) {
      const id = World.get(x, y, z);
      if (id && (SOLID[id] || FKIND[id])) return { t, x, y, z, id, n, p: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] };
      if (tx < ty && tx < tz) { t = tx; x += sx; tx += tdx; n = [-sx, 0, 0]; } else if (ty < tz) { t = ty; y += sy; ty += tdy; n = [0, -sy, 0]; } else { t = tz; z += sz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  },
  material(id) {
    if (FKIND[id] === 1) return 'water';
    const s = BLK[id] && BLK[id].sound;
    return { grass: 'grass', wood: 'wood', sand: 'sand', gravel: 'sand', snow: 'snow', glass: 'ice', cloth: 'default' }[s] || (id === B.IRON_ORE ? 'metal' : 'stone');
  },
  // другие игроки на луче: [u, расстояние]
  peerOnRay(o, d, maxT) {
    let best = null;
    for (const [u, q] of Net.peers) {
      if (q.dd || performance.now() - (q.seen || 0) > 5000) continue;
      const hs = q.hs || 1, x0 = q.cx - 0.35 * hs, x1 = q.cx + 0.35 * hs, y0 = q.cy, y1 = q.cy + 1.85 * hs, z0 = q.cz - 0.35 * hs, z1 = q.cz + 0.35 * hs;
      let tn = 0, tf = maxT;
      for (const [a0, a1, oo, dd] of [[x0, x1, o[0], d[0]], [y0, y1, o[1], d[1]], [z0, z1, o[2], d[2]]]) {
        if (Math.abs(dd) < 1e-6) { if (oo < a0 || oo > a1) { tn = 1e9; break; } continue; }
        let t0 = (a0 - oo) / dd, t1 = (a1 - oo) / dd; if (t0 > t1) [t0, t1] = [t1, t0];
        tn = Math.max(tn, t0); tf = Math.min(tf, t1);
      }
      if (tn <= tf && tn < maxT && (!best || tn < best[1])) best = [u, tn];
    }
    return best;
  },
  hitscan(d, o, dir, range, mine) {
    const h = this.trace(o, dir, range), end = h ? h.t : range;
    const pe = mine ? this.peerOnRay(o, dir, end) : null;
    if (pe) {
      const p = [o[0] + dir[0] * pe[1], o[1] + dir[1] * pe[1], o[2] + dir[2] * pe[1]];
      Net.samDamage && Net.samDamage(pe[0], d.st.dmg);
      this.impact(p, 'flesh', [-dir[0], -dir[1], -dir[2]]);
      return [...p.map(x => +x.toFixed(2)), 'flesh'];
    }
    if (!h) return null;
    const m = this.material(h.id);
    this.impact(h.p, m, h.n);
    return [...h.p.map(x => +x.toFixed(2)), m];
  },
  impact(p, mat, n) {
    if (mat !== 'flesh') this.burst(this.D.hits[mat] || this.D.hits.default, p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03, 0.5);
    else this.burstBlood(p);
    if (mat !== 'flesh') this.sound('hit.' + mat, p[0], p[1], p[2], 0.6, 0.9 + Math.random() * 0.2);
  },
  melee(d) {
    const p = Player, eye = [p.x, p.y + EYE, p.z], dir = lookDir(), reach = d.st.melee;
    for (const [u, q] of Net.peers) {
      if (q.dd) continue;
      const to = [q.cx - eye[0], q.cy + 0.9 - eye[1], q.cz - eye[2]], dist = Math.hypot(...to);
      if (dist > reach + 0.4 || (to[0] * dir[0] + to[1] * dir[1] + to[2] * dir[2]) / dist < 0.5) continue;
      Net.samDamage && Net.samDamage(u, d.st.dmg);
      this.burstBlood([q.cx, q.cy + 1, q.cz]);
      if (d.id === 'hd_knife') this.sound('hd_knife.slash', q.cx, q.cy + 1, q.cz);
    }
  },
  seriousBomb(at, mine) {
    this.bombFlash = 1.2;
    this.burst((this.D.proj.hd_rocket || {}).boom || [], at[0], at[1] + 1, at[2], 6);
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI2; this.burst((this.D.proj.hd_cannonball || {}).boom || [], at[0] + Math.cos(a) * 9, at[1] + 2, at[2] + Math.sin(a) * 9, 2.5); }
    this.sound('proj_hd_cannonball.hit', at[0], at[1], at[2], 1.4, 0.6);
    if (mine) for (const [u, q] of Net.peers) if (!q.dd && Math.hypot(q.cx - at[0], q.cy - at[1], q.cz - at[2]) < 32) Net.samDamage && Net.samDamage(u, 300);
  },
  // ---------- снаряды ----------
  shots: [],
  launch(d, eye, dir, variant, charge, mine) {
    const st = d.st, kind = 'hd_' + st.proj, pd = this.D.proj[kind]; if (!pd) return null;
    const up = Math.abs(dir[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
    const r = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]], rl = Math.hypot(...r) || 1;
    for (let i = 0; i < 3; i++) r[i] /= rl;
    const u2 = [r[1] * dir[2] - r[2] * dir[1], r[2] * dir[0] - r[0] * dir[2], r[0] * dir[1] - r[1] * dir[0]];
    let side = 0.22, down = -0.18;
    if (st.alt && st.proj === 'laser') { const c = d.fire[((variant % d.fire.length) + d.fire.length) % d.fire.length] || 'RD', s = c.slice(-2); side = s[0] === 'L' ? -0.32 : 0.32; down = s[1] === 'U' ? 0.08 : -0.16; }
    const from = [0, 1, 2].map(i => eye[i] + dir[i] * 0.7 + r[i] * side + u2[i] * down);
    const out = [];
    const add = (dv, speed, fiery) => {
      const s = { kind, pd, x: from[0], y: from[1], z: from[2], px: from[0], py: from[1], pz: from[2], vx: dv[0] * speed, vy: dv[1] * speed, vz: dv[2] * speed,
        age: 0, life: st.proj === 'flame' ? 0.6 + Math.random() * 0.3 : Math.max(0.5, pd.life), mine, fiery, dmg: st.dmg * (fiery ? 1.4 : 1), blast: st.blast ? st.blast * 2 * (fiery ? 1.3 : 1) : 0, acc: new Float32Array(16), bounces: 0 };
      this.shots.push(s); out.push([+dv[0].toFixed(3), +dv[1].toFixed(3), +dv[2].toFixed(3), +speed.toFixed(2), fiery ? 1 : 0]);
      if (pd.model === null && st.proj !== 'flame') return;
    };
    const base = (pd.speed || 30);
    if (st.proj === 'flame') {
      for (let i = 0; i < 2; i++) { const k = Math.tan(11 * Math.PI / 180) * Math.sqrt(Math.random()), a = Math.random() * PI2; const fd = [0, 1, 2].map(j => dir[j] + r[j] * k * Math.cos(a) + u2[j] * k * Math.sin(a)); const l = Math.hypot(...fd); add(fd.map(x => x / l), base * (0.5 + Math.random() * 0.6) * 0.4, 0); }
    } else {
      const fiery = st.charge && charge >= 0.7;
      const sp = st.proj === 'laser' ? base : st.proj === 'cannonball' ? (fiery ? base * (1.6 + Math.min(1, (charge - 0.7) / 1) ) / 1.6 : base * 0.6) : base * (st.proj === 'grenade' ? 0.75 : 1);
      add(dir, sp, fiery);
      if (pd.model && this.D.snd['proj_' + kind + '.fly']) this.sound('proj_' + kind + '.fly', from[0], from[1], from[2], 0.8);
    }
    return { f: from.map(x => +x.toFixed(2)), s: out };
  },
  // снаряды чужого Сэма: те же траектории, только картинка и звук
  remoteShot(q, ev) {
    const d = this.weapons[ev.w]; if (!d) return;
    q.samFire = 1; q.samW = d.id;
    this.sound(d.id + '.fire', ev.o[0], ev.o[1], ev.o[2], 1, 0.97 + Math.random() * 0.06);
    if (ev.k === 'b') { this.seriousBomb(ev.o, false); return; }
    if (ev.h) for (const h of ev.h) if (h) this.impact([h[0], h[1], h[2]], h[3], [-ev.d[0], -ev.d[1], -ev.d[2]]);
    if (ev.p) {
      const kind = 'hd_' + d.st.proj, pd = this.D.proj[kind];
      for (const s of ev.p.s) this.shots.push({ kind, pd, x: ev.p.f[0], y: ev.p.f[1], z: ev.p.f[2], px: ev.p.f[0], py: ev.p.f[1], pz: ev.p.f[2],
        vx: s[0] * s[3], vy: s[1] * s[3], vz: s[2] * s[3], age: 0, life: d.st.proj === 'flame' ? 0.75 : Math.max(0.5, pd.life), mine: false, fiery: !!s[4], dmg: 0, blast: d.st.blast ? d.st.blast * 2 : 0, acc: new Float32Array(16), bounces: 0 });
    }
  },
  tickShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], k = s.kind;
      s.age += dt; s.px = s.x; s.py = s.y; s.pz = s.z;
      const grav = k.endsWith('grenade') ? 16 : k.endsWith('cannonball') ? (s.fiery ? 2.4 : 20) : 0;
      if (k.endsWith('flame')) { const f = Math.pow(0.93, dt * 20); s.vx *= f; s.vy = s.vy * f + 1.6 * dt; s.vz *= f; }
      s.vy -= grav * dt;
      const sp = Math.hypot(s.vx, s.vy, s.vz), stepLen = sp * dt;
      let done = false;
      if (stepLen > 0) {
        const dir = [s.vx / sp, s.vy / sp, s.vz / sp], h = this.trace([s.x, s.y, s.z], dir, stepLen);
        const pe = s.mine && !k.endsWith('flame') ? this.peerOnRay([s.x, s.y, s.z], dir, h ? h.t : stepLen) : null;
        if (pe) { s.x += dir[0] * pe[1]; s.y += dir[1] * pe[1]; s.z += dir[2] * pe[1]; if (s.mine && !s.blast) Net.samDamage && Net.samDamage(pe[0], s.dmg); done = true; }
        else if (h) {
          const bounce = (k.endsWith('grenade') || (k.endsWith('cannonball') && !s.fiery)) && s.age < s.life;
          if (bounce && FKIND[h.id] !== 1) {
            s.x = h.p[0] + h.n[0] * 0.12; s.y = h.p[1] + h.n[1] * 0.12; s.z = h.p[2] + h.n[2] * 0.12;
            const vn = s.vx * h.n[0] + s.vy * h.n[1] + s.vz * h.n[2];
            s.vx = (s.vx - 2 * vn * h.n[0]) * 0.55; s.vy = (s.vy - 2 * vn * h.n[1]) * 0.45; s.vz = (s.vz - 2 * vn * h.n[2]) * 0.55;
            s.bounces++;
            if (Math.abs(vn) > 3) this.sound('hit.stone', s.x, s.y, s.z, 0.5, 0.7);
          } else { s.x = h.p[0] + h.n[0] * 0.05; s.y = h.p[1] + h.n[1] * 0.05; s.z = h.p[2] + h.n[2] * 0.05; done = true; s.mat = this.material(h.id); }
        } else { s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; }
      }
      if (!done && s.age >= s.life) done = true;
      this.trail(s);
      if (done) { this.explode(s); this.shots.splice(i, 1); }
    }
  },
  explode(s) {
    const k = s.kind;
    if (k.endsWith('flame')) return;
    if (k.endsWith('laser')) { this.burst(s.pd.boom, s.x, s.y, s.z, 0.6); if (s.mat) this.sound('hit.' + s.mat, s.x, s.y, s.z, 0.4); return; }
    this.burst(s.pd.boom, s.x, s.y, s.z, k.endsWith('cannonball') ? 1.4 : 1);
    this.sound('proj_' + k + '.hit', s.x, s.y, s.z, 1.4, 0.95 + Math.random() * 0.1);
    if (!s.blast) return;
    // ударная волна: камера трясётся, игроки рядом получают урон (считает тот, кто стрелял)
    const p = Player, dd = Math.hypot(p.x - s.x, p.y + 1 - s.y, p.z - s.z);
    this.shake = Math.max(this.shake || 0, clamp(1 - dd / (s.blast * 4), 0, 1) * 0.8);
    if (s.mine) for (const [u, q] of Net.peers) {
      if (q.dd) continue;
      const r = Math.hypot(q.cx - s.x, q.cy + 0.9 - s.y, q.cz - s.z);
      if (r < s.blast * 1.6) Net.samDamage && Net.samDamage(u, Math.max(1, s.dmg * 1.6 * (1 - r / (s.blast * 1.6))));
    }
  },
  tickWorld(dt) {
    this.tickShots(dt);
    if (this.meleeT > 0 && (this.meleeT -= dt) <= 0) this.melee(this.view.def);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.age += dt; if (q.age >= q.life) { this.parts.splice(i, 1); continue; }
      if (q.age < 0) continue;
      if (q.shell) {
        q.vy -= 9 * dt * Math.max(0.4, q.e.gravity * 0.6);
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt, nz = q.z + q.vz * dt;
        if (SOLID[World.get(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { q.vy = -q.vy * 0.35; q.vx *= 0.6; q.vz *= 0.6; q.spin *= 0.5; if (Math.abs(q.vy) < 0.25) { q.vy = 0; q.vx *= 0.5; q.vz *= 0.5; } }
        else { q.x = nx; q.y = ny; q.z = nz; }
        q.rot += q.spin * dt; continue;
      }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const drag = Math.pow((Math.abs(q.vx) + Math.abs(q.vz) > 6) ? 0.88 : 0.96, dt * 20);
      q.vx *= drag; q.vz *= drag; q.vy = q.vy * drag - q.e.gravity * 3.2 * dt;
      q.rot += q.spin * dt;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt * 0.8);
  },

  // ---------- частицы (порт ProjFx / Fx) ----------
  parts: [],
  rr(r) { return r[0] + Math.random() * (r[1] - r[0]); },
  bits(e) { const n = e.name.toLowerCase(); return /drop|spark|shrapnel|part|debri/.test(n); },
  spawn(e, x, y, z, scale) {
    if (this.parts.length > 3000) return null;
    const q = { e, x, y, z, vx: 0, vy: 0, vz: 0, age: 0 };
    const sp = this.rr(e.speed) * scale;
    if (sp > 0) { let a = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]; const l = Math.hypot(...a) || 1; q.vx = a[0] / l * sp; q.vy = a[1] / l * sp; q.vz = a[2] / l * sp; }
    q.life = Math.max(0.1, this.rr(e.life));
    let s = this.rr(e.size); if (this.bits(e)) s = Math.min(s, 0.45);
    q.size = s * scale; q.rot = this.rr(e.rot) * Math.PI / 180; q.spin = this.rr(e.spin) * Math.PI / 180;
    q.frame = e.rnd ? Math.floor(Math.random() * e.cols * e.rows) : -1;
    this.parts.push(q);
    return q;
  },
  burst(list, x, y, z, scale) {
    if (!list) return;
    for (const e of list) {
      if (e.life[0] < 0) continue;
      let n; if (e.rate >= 1000) n = this.bits(e) ? 16 : 1; else n = Math.max(1, Math.min(30, Math.round(e.rate * 0.3)));
      const stream = e.rate < 1000 && n > 1;
      for (let k = 0; k < n; k++) {
        const j = n > 1 ? (stream ? Math.max(0.3, e.size[1] * 0.2) : 0.3) * scale : 0, g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
        const q = this.spawn(e, x + g() * j, y + Math.abs(g()) * j, z + g() * j, scale);
        if (q && stream) q.age = -(k / e.rate);
      }
    }
  },
  burstBlood(p) {
    const e = { name: 'blood', tex: null, additive: false, cols: 1, rows: 1, rnd: false, rate: 1, life: [0.3, 0.6], speed: [1, 3], spin: [0, 0], size: [0.05, 0.12], rot: [0, 0], grow: 1, gravity: 2, colors: [[0, 150, 10, 10, 255]], alphas: [[0, 0, 0, 0, 255], [1, 0, 0, 0, 0]], intensity: [] };
    for (let i = 0; i < 10; i++) this.spawn(e, p[0], p[1], p[2], 1);
  },
  trail(s) {
    const set = s.pd; if (!set || !set.trail) return;
    if (s.kind.endsWith('cannonball') && !s.fiery) return;
    for (let i = 0; i < set.trail.length && i < 16; i++) {
      const e = set.trail[i]; if (e.life[0] < 0) continue;
      s.acc[i] += Math.min(e.rate, 200) / 60;
      const n = Math.min(s.acc[i] | 0, 8); s.acc[i] -= n;
      for (let k = 0; k < n; k++) {
        const f = (k + Math.random()) / Math.max(1, n);
        const q = this.spawn(e, s.px + (s.x - s.px) * f, s.py + (s.y - s.py) * f, s.pz + (s.z - s.pz) * f, 1);
        if (q && s.kind.endsWith('flame')) { q.life = Math.min(q.life, 0.4 + Math.random() * 0.3); q.size *= 0.7 + Math.random() * 0.5; }
      }
    }
  },
  // эффект клипа: огонь у ствола (в пространстве вида) и/или гильзы в мир
  effect(d, name, loc) {
    const ef = this.D.fx[d.id] && this.D.fx[d.id][name]; if (!ef) return;
    const shell = ef.em.some(e => /shell/i.test(e.name)), viewOnes = ef.em.some(e => !/shell/i.test(e.name));
    if (viewOnes) this.startViewFx(d, name, 1);
    if (shell && this.lastViewXf) {
      const md = this.models[d.id], pt = md && md.locator(loc || ef.loc);
      if (!pt) return;
      const w = m4xv(this.lastViewXf, pt[0], pt[1], pt[2], 1);   // вид → мир (относительно камеры)
      const cam = this.lastCam, rx = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)], f = lookDir();
      for (const e of ef.em) {
        if (!/shell/i.test(e.name)) continue;
        const sx = 1.3 + Math.random() * 0.8, sy = 0.9 + Math.random() * 0.6, sz = 0.2 + Math.random() * 0.5;
        const q = { e, shell: true, x: w[0] + cam.x, y: w[1] + cam.y, z: w[2] + cam.z, vx: rx[0] * sx - f[0] * sz, vy: sy, vz: rx[2] * sx - f[2] * sz, age: 0,
          life: Math.max(0.5, this.rr(e.life)) * 1.5, size: Math.max(0.035, this.rr(e.size)) * 1.4, rot: Math.random() * PI2, spin: (Math.random() - 0.5) * 25,
          frame: e.rnd ? Math.floor(Math.random() * e.cols * e.rows) : 0 };
        this.parts.push(q);
      }
    }
  },
  startViewFx(d, name, scale) {
    const ef = this.D.fx[d.id] && this.D.fx[d.id][name]; if (!ef) return;
    for (const e of ef.em) {
      if (/shell/i.test(e.name)) continue;
      const n = Math.max(1, Math.min(2, Math.round(e.rate * Math.max(e.life[0], 0.02) * 0.1)));
      for (let i = 0; i < n; i++) this.viewFx.push({ e, loc: ef.loc, age: 0, life: Math.max(0.04, Math.min(0.5, Math.max(e.life[0], e.life[1]))), size: this.rr(e.size) * scale, rot: this.rr(e.rot) * Math.PI / 180 });
    }
  },
  keyAt(keys, t) {
    if (!keys || !keys.length) return null;
    if (t <= keys[0][0]) return keys[0];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], f = (t - a[0]) / Math.max(1e-4, b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * f); }
    return keys[keys.length - 1];
  },
  colour(e, t, view) {
    const c = this.keyAt(e.colors, t);
    let r = c ? c[1] : 255, g = c ? c[2] : 255, b = c ? c[3] : 255;
    if (view) { const a = this.keyAt(e.alphas, t); return [r / 255, g / 255, b / 255, (a ? a[4] : 255) / 255]; }
    const fade = Math.min(1, (1 - t) / 0.15);
    if (e.additive) { const inn = this.keyAt(e.intensity, t); const m = 0.9 * (inn ? clamp(inn[1], 0, 1) : 1) * fade; return [r * m / 255, g * m / 255, b * m / 255, 1]; }
    const a2 = this.keyAt(e.alphas, t), al = (!c && !a2) ? 255 : Math.max(c ? c[4] : 0, a2 ? a2[4] : 0);
    return [r / 255, g / 255, b / 255, clamp(al * fade, 0, 255) / 255];
  }
});
