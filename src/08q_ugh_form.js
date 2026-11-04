// ============================================================
//  Облик владельца «Уг-Зан» (босс Serious Sam 3, четыре ноги, пушки на плечах).
//  NumPad 4 — левая пушка, 6 — правая, 2 — топот ближайшей к цели ногой, 5 — рёв, 0 — меню обликов.
//  Модель и звуки — из пакета мобов (SAMOB_DATA_B64). У всех играет музыка босса, пока кто-то в этом облике.
//  Столкновения остаются как у обычного игрока: иначе великан застревал бы в каждом дереве.
// ============================================================
const UGH_ID = 'ss3_ughzan', UGH_EYE = 34, UGH_CAM = 48;
const UGH_T = SAMOB_LIST.find(t => t.id === UGH_ID);
// клипы подъёма: пушка поднята к этому моменту, дальше клип только держит позу (кадр 70 у левой, 60 у правой)
const UGH_GUN = {
  gl: { raise: 'raise_l', fire: 'attack', up: 70 / 30, gun: 0, sd: { kind: 'hd_rocket', speed: 56, dmg: 14, blast: 5, fx: 2.4 } },
  gr: { raise: 'raise_r', fire: 'attack2', up: 2, gun: 1, sd: { kind: 'hd_rocket', speed: 46, dmg: 20, blast: 6, fx: 3 } }
};
// ноги: клип топота и точка удара в координатах модели, удар о землю на 28-м кадре клипа (22.2 кадра в секунду)
const UGH_LEGS = { melee: [48.74, -50.47], melee_lf: [-48.74, -50.47], melee_rb: [48.85, 50.84], melee_lb: [-48.9, 50.79] }, UGH_STOMP_T = 28 / 22.2;
const UGH_STEPS = [0.1923, 0.4615, 0.7308, 0.9615];   // шаги в цикле ходьбы (Walk, Walk_Left, Walk_Right, Walk_Back)
const UGH_NATURAL = 12.56;                            // скорость клипа ходьбы в метрах модели в секунду

const Ugh = {
  self: {}, musicOn: false,
  on() { return Net.form === 'ugh'; },
  scale() { return UGH_T.draw; },
  activate() { SamMobs.load(); if (!Game.view) Game.view = 1; },
  // ---------- клавиши ----------
  key(c) {
    if (c === 'Numpad0') { Menus.show('morph'); Game.releaseMouse(); return; }
    if (SamMobs.state !== 'ready') return;
    if (c === 'Numpad4') this.action('gl');
    else if (c === 'Numpad6') this.action('gr');
    else if (c === 'Numpad5') this.action('ro');
    else if (c === 'Numpad2') this.action(this.nearestLeg());
  },
  // выбор ноги: ближайшая к другому игроку или мобу, а если рядом никого — к точке, куда смотрим
  nearestLeg() {
    const p = Player, now = performance.now(); let tx, tz, best = 1e9;
    const see = (x, z) => { const d = Math.hypot(x - p.x, z - p.z); if (d < best) { best = d; tx = x; tz = z; } };
    for (const q of Net.peers.values()) if (!q.dd && now - (q.seen || 0) < 5000) see(q.cx, q.cz);
    for (const m of SamMobs.list) if (m.st !== 'death') see(m.x, m.z);
    if (best === 1e9) { const d = lookDir(); tx = p.x + d[0] * 20; tz = p.z + d[2] * 20; }
    let leg = 'melee', bd = 1e9;
    for (const k in UGH_LEGS) { const w = this.legWorld(p.x, p.z, this.self.by === undefined ? p.yaw : this.self.by, k), d = Math.hypot(w[0] - tx, w[1] - tz); if (d < bd) { bd = d; leg = k; } }
    return leg;
  },
  legWorld(x, z, yaw, leg) {
    const l = UGH_LEGS[leg], k = this.scale(), c = Math.cos(yaw), s = Math.sin(yaw);
    return [x + (l[0] * c + l[1] * s) * k, z + (-l[0] * s + l[1] * c) * k];
  },
  // ---------- действия: начинает у себя и рассылает остальным ----------
  action(a) {
    if (!this.start(this.self, a)) return;
    if (Net.role && Net.ch) Net.send('ugh', { u: Net.uid, a });
  },
  onNet(v) {
    if (!v || v.u === Net.uid) return;
    const q = Net.peers.get(v.u); if (!q) return;
    if (SamMobs.state === 'none') SamMobs.load();
    if (SamMobs.state === 'ready') this.start(q._ugh || (q._ugh = {}), v.a);
  },
  start(S, a) {
    if (a === 'gl' || a === 'gr') {
      S.guns = S.guns || {};
      if (S.guns[a]) return false;
      S.guns[a] = { ph: 'up', t: 0 };
      S.say = S.say || [];
      S.say.push('prepare');
      return true;
    }
    if (S.top) return false;
    if (a === 'ro') { S.top = { clip: 'anger', t: 0, roar: true }; (S.say = S.say || []).push('snarl'); return true; }
    if (UGH_LEGS[a]) { S.top = { clip: a, t: 0, leg: a }; return true; }
    return false;
  },
  // ---------- кадр: и свой облик, и чужие ----------
  update(dt) {
    const now = performance.now();
    let want = this.on();
    for (const q of Net.peers.values()) if (q.m === 'u' && !q.dd && now - (q.seen || 0) < 15000) want = true;
    this.music(want);
    if (SamMobs.state !== 'ready' || Sam.state !== 'ready') return;
    if (!this.md) { this.md = SamMobs.model('mob_' + UGH_ID); if (!this.md) return; }
    if (this.on() && !Player.dead) this.advance(this.self, { cx: Player.x, cy: Player.y, cz: Player.z, cya: Player.yaw }, dt, true);
    for (const [u, q] of Net.peers) if (q.m === 'u' && !q.dd) this.advance(q._ugh || (q._ugh = {}), q, dt, false, u);
  },
  sayAt(key, q, vol = 1) { Sam.sound('mob.' + UGH_ID + '.' + key, q.cx, q.cy + 12, q.cz, vol); },
  advance(S, q, dt, mine) {
    const wrap = a => ((a + Math.PI) % PI2 + PI2) % PI2 - Math.PI, md = this.md;
    if (S.t === undefined) { Object.assign(S, { t: 0, by: q.cya, lx: q.cx, lz: q.cz, vx: 0, vz: 0, legs: null, lt: 0, plt: 0, lblend: 0, sf: 0 }); }
    S.t += dt;
    const k = dt > 0 ? 1 - Math.exp(-dt * 6) : 0;
    if (dt > 0) { S.vx += ((q.cx - S.lx) / dt - S.vx) * k; S.vz += ((q.cz - S.lz) / dt - S.vz) * k; S.lx = q.cx; S.lz = q.cz; }
    S.by += wrap(q.cya - S.by) * Math.min(1, dt * 3.5);
    // ноги: вперёд, назад и вбок — свои клипы оригинала
    const sp = Math.hypot(S.vx, S.vz), fx = -Math.sin(S.by), fz = -Math.cos(S.by), rx = Math.cos(S.by), rz = -Math.sin(S.by);
    let legs = null;
    if (sp > 0.6) {
      const f = (S.vx * fx + S.vz * fz) / sp, s = (S.vx * rx + S.vz * rz) / sp;
      legs = Math.abs(s) > Math.abs(f) ? (s > 0 ? 'walk_right' : 'walk_left') : (f >= 0 ? 'run' : 'walk_back');
    }
    if (S.legs !== legs) { S.plegs = S.legs; S.plt = S.lt; S.lblend = 0.3; S.legs = legs; if (legs && S.plegs) { /* фаза ног сохраняется */ } else S.lt = 0; }
    const rate = clamp(sp / (UGH_NATURAL * this.scale()), 0.4, 2);
    S.lt += dt * rate; S.plt += dt * rate; S.lblend = Math.max(0, S.lblend - dt);
    // шаги
    const walkClip = legs && md.clip(legs);
    if (walkClip) {
      const fr = (S.lt % walkClip.len) / walkClip.len, f0 = S.sf;
      for (const t of UGH_STEPS) if (f0 <= fr ? (t > f0 && t <= fr) : (t > f0 || t <= fr)) {
        this.sayAt('foot_stomp', q, 0.9);
        const pl = Player, dd = Math.hypot(pl.x - q.cx, pl.z - q.cz);
        Sam.shake = Math.max(Sam.shake || 0, clamp(1 - dd / 50, 0, 1) * 0.25);
      }
      S.sf = fr;
    }
    // звуки, запрошенные действиями
    if (S.say && S.say.length) { for (const s of S.say) this.sayAt(s, q); S.say.length = 0; }
    // пушки: подъём -> выстрел -> опускание
    if (S.guns) for (const g in S.guns) {
      const G = S.guns[g], D = UGH_GUN[g];
      const t0 = G.t; G.t += dt;
      if (G.ph === 'up' && G.t >= D.up) { G.ph = 'fire'; G.t = 0; this.sayAt('attack', q); if (mine) this.fireGun(S, q, g); }
      else if (G.ph === 'fire' && G.t >= (md.clip(D.fire) ? md.clip(D.fire).len : 1)) { G.ph = 'down'; G.t = 0; this.sayAt('unprepare', q); }
      else if (G.ph === 'down' && G.t >= D.up) { delete S.guns[g]; }
    }
    // рёв и топот
    if (S.top) {
      const T = S.top, c = md.clip(T.clip), t0 = T.t;
      T.t += dt;
      if (T.roar && t0 < 25 / 30 && T.t >= 25 / 30) this.sayAt('anger', q);
      if (T.leg && t0 < UGH_STOMP_T && T.t >= UGH_STOMP_T) this.stomp(S, q, T.leg, mine);
      if (!c || T.t >= c.len) S.top = null;
    }
  },
  // поза: ноги — верх тела (рёв, топот) — пушки поверх всего
  pose(S) {
    const md = this.md;
    md.rest();
    md.layer(md.clip('idle'), S.t, true);
    if (S.plegs && S.lblend > 0) md.layer(md.clip(S.plegs), S.plt, true, S.lblend / 0.3);
    if (S.legs) md.layer(md.clip(S.legs), S.lt, true, S.lblend > 0 ? 1 - S.lblend / 0.3 : 1);
    if (S.top) {
      const c = md.clip(S.top.clip);
      if (c) md.layer(c, S.top.t, false, clamp(Math.min(S.top.t / 0.25, (c.len - S.top.t) / 0.35), 0, 1));
    }
    if (S.guns) for (const g in S.guns) {
      const G = S.guns[g], D = UGH_GUN[g], r = md.clip(D.raise);
      if (G.ph === 'up') md.layer(r, G.t, false);
      else if (G.ph === 'fire') { md.layer(r, D.up, false); md.layer(md.clip(D.fire), G.t, false); }
      else md.layer(r, Math.max(0, D.up - G.t), false);
    }
    md.fk();
    return md;
  },
  // точка выстрела — кость пушки в текущей позе
  fireGun(S, q, g) {
    const D = UGH_GUN[g], gun = UGH_T.gun_list[D.gun], md = this.pose(S), b = md.boneXf(gun.bone), k = this.scale();
    let mp = gun.pos;
    if (b) { const r = qrot(b.q, 0, gun.off[0], gun.off[1], gun.off[2], [0, 0, 0]); mp = [b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2]]; }
    const c = Math.cos(S.by), s = Math.sin(S.by), f = [q.cx + (mp[0] * c + mp[2] * s) * k, q.cy + mp[1] * k, q.cz + (-mp[0] * s + mp[2] * c) * k];
    // летит туда, куда смотрит прицел камеры
    const p = Player, d = lookDir(), eye = [p.x, p.y + UGH_EYE, p.z], h = Sam.trace(eye, d, 300), L = h ? h.t : 300;
    const to = [eye[0] + d[0] * L - f[0], eye[1] + d[1] * L - f[1], eye[2] + d[2] * L - f[2]], tl = Math.hypot(...to) || 1;
    const sd = D.sd, v = to.map(x => x / tl * sd.speed), pd = Sam.D.proj[sd.kind], mdl = gun.skin ? 'mobp_' + gun.skin : null;
    if (mdl) SamMobs.model(mdl);
    if (!pd) return;
    SamMobs.addShot(sd, pd, f, v, mdl, UGH_ID, false, { mine: true, fxS: sd.fx, mS: k });
    if (Net.role && Net.ch) Net.send('smf', { t: 'rocket', m: UGH_ID, g: mdl, f: f.map(x => +x.toFixed(2)), v: v.map(x => +x.toFixed(2)), k: +k.toFixed(3), b: sd.blast, x2: sd.fx });
  },
  stomp(S, q, leg, mine) {
    const w = this.legWorld(q.cx, q.cz, S.by, leg);
    let y = q.cy;
    if (World.loaded(Math.floor(w[0]), Math.floor(w[1]))) y = World.topY(Math.floor(w[0]), Math.floor(w[1])) + 1;
    Sam.burst((Sam.D.proj.hd_rocket || {}).boom, w[0], y, w[1], 3.2);
    this.sayAt('shockwave', { cx: w[0], cy: y - 12, cz: w[1] }, 1.2);
    const pl = Player, dd = Math.hypot(pl.x - w[0], pl.z - w[1]);
    Sam.shake = Math.max(Sam.shake || 0, clamp(1 - dd / 70, 0, 1));
    if (!mine) return;
    const R = 13, now = performance.now();
    for (const [u, p] of Net.peers) {
      if (p.dd || now - (p.seen || 0) > 5000) continue;
      const r = Math.hypot(p.cx - w[0], p.cz - w[1]);
      if (r < R && Math.abs(p.cy - y) < 8) Net.samDamage && Net.samDamage(u, Math.max(2, 24 * (1 - r / R)));
    }
    for (const m of SamMobs.list.slice()) {
      const r = Math.hypot(m.x - w[0], m.z - w[1]) - m.T.r * 0.5;
      if (r < R && Math.abs(m.y - y) < 10) SamMobs.damage(m, Math.max(5, 90 * (1 - Math.max(r, 0) / R)));
    }
  },
  // ---------- отрисовка (из Sam.drawWorld) ----------
  draw(VP, cam, env) {
    if (!this.md) return;
    const now = performance.now(), one = (S, q, fog) => {
      if (S.t === undefined) return;
      const md = this.pose(S), k = this.scale(), M = m4(), R = m4();
      let sk = 0, bk = 0;
      for (const f of [0.1, 0.5, 1]) { const l = World.light(Math.floor(q.cx), Math.floor(q.cy + 0.5 + UGH_T.h * f), Math.floor(q.cz)); sk = Math.max(sk, l >> 4); bk = Math.max(bk, l & 15); }
      m4translate(M, q.cx - cam.x, q.cy - cam.y, q.cz - cam.z);
      m4mul(M, M, m4rotY(R, S.by));
      m4mul(M, M, m4scale(R, k, k, k));
      Sam.drawModel(md, VP, M, env, { sky: sk / 15, blk: bk / 15, fog });
    };
    for (const q of Net.peers.values()) if (q.m === 'u' && !q.dd && now - (q.seen || 0) < 15000 && q._ugh) one(q._ugh, q, true);
    if (this.on() && Game.view && !Player.dead) { const p = Player; one(this.self, { cx: p.x, cy: p.y, cz: p.z }, false); }
  },
  // ---------- музыка босса ----------
  music(want) {
    if (want === this.musicOn && (!want || this.musSrc || this.musLoading)) { return; }
    const ctx = Sfx.ctx; if (!ctx) return;
    if (!want) {
      this.musicOn = false;
      const g = this.musGain, s = this.musSrc; this.musSrc = null; this.musGain = null;
      if (g && s) { g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => { try { s.stop(); } catch (e) { } }, 3000); }
      return;
    }
    this.musicOn = true;
    if (SamMobs.state !== 'ready') { if (SamMobs.state === 'none') SamMobs.load(); return; }
    const list = Sam.D.snd['mob.' + UGH_ID + '.music1']; if (!list) return;
    const play = buf => {
      this.musLoading = false;
      if (!this.musicOn || this.musSrc) return;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
      s.connect(g); g.connect(Sfx.mus || Sfx.master); s.start();
      this.musSrc = s; this.musGain = g;
    };
    if (this.musBuf) return play(this.musBuf);
    if (this.musLoading) return;
    this.musLoading = true;
    ctx.decodeAudioData(Sam.bytes(list[0]).slice().buffer).then(b => { this.musBuf = b; play(b); }, () => { this.musLoading = false; });
  }
};
