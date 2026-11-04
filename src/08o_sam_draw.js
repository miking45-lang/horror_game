// ============================================================
//  Облик «Серьёзный Сэм»: отрисовка. Оружие с руками от первого лица, Сэм от третьего лица (свои и чужие),
//  снаряды, частицы, полоса выбора оружия как в Serious Sam HD.
// ============================================================
// Оружие в руке от третьего лица: в позе ожидания под это оружие ствол смотрит прямо вперёд, дальше оружие
// следует за кистью (отдача, покачивание). Ручная поправка: сдвиг в осях Сэма (м), наклон ствола вниз (рад), масштаб.
const SAM_GRIP = {
  def: { p: [0, 0, 0], tilt: 0, s: 1 },
  hd_colt: { p: [0, -0.03, 0.42], tilt: 0, s: 1 }    // у кольта начало координат позади рукояти
};
Object.assign(Sam, {
  // поворот модели оружия относительно кисти: Qh⁻¹ · Qw, где Qh — кисть в позе ожидания, Qw — «ствол вперёд»
  gripOf(w, hand) {
    const key = w.id + ':' + hand;
    if ((this.grips || (this.grips = {}))[key]) return this.grips[key];
    const md = this.models.sam, g = SAM_GRIP[w.id] || SAM_GRIP.def;
    md.rest(); md.layer(md.clip('Idle'), 0, true); md.layer(md.clip('Body_Idle'), 0, false); md.layer(md.clip(w.body[0]), 0, true); md.fk();
    const h = md.boneXf(hand), qi = [-h.q[0], -h.q[1], -h.q[2], h.q[3]];
    const t = g.tilt || 0, qw = [Math.sin(-t / 2), 0, 0, Math.cos(t / 2)];
    const q = [0, 0, 0, 1]; qmulTo(q, 0, qi, 0, qw, 0);
    // сдвиг в осях Сэма → в оси кисти
    const off = qrot(qi, 0, g.p[0], g.p[1], g.p[2], [0, 0, 0]);
    return (this.grips[key] = { q, off, s: g.s || 1 });
  },
  // ---------- поза Сэма от третьего лица ----------
  // q: { cx, cy, cz, cya, pi, walk, s (присел), samW (оружие), samFire (выстрел только что) }
  poseSam(q, S, dt) {
    const md = this.models.sam; if (!md) return null;
    const now = performance.now(), wrap = a => ((a + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
    if (S.t === undefined) { S.t = 0; S.ft = 9; S.by = q.cya; S.lx = q.cx; S.lz = q.cz; S.ly = q.cy; S.vx = 0; S.vz = 0; S.vy = 0; S.air = 0; }
    S.t += dt;
    // скорость по смещению (у чужих координаты приходят пакетами — сглаживаем)
    const k = dt > 0 ? 1 - Math.exp(-dt * 6) : 0;
    if (dt > 0) {
      S.vx += ((q.cx - S.lx) / dt - S.vx) * k; S.vz += ((q.cz - S.lz) / dt - S.vz) * k; S.vy += ((q.cy - S.ly) / dt - S.vy) * k;
      S.lx = q.cx; S.lz = q.cz; S.ly = q.cy;
    }
    const sp = Math.hypot(S.vx, S.vz);
    // корпус: за взглядом (Сэм стреляет туда, куда смотрит)
    S.by += wrap(q.cya - S.by) * Math.min(1, dt * 12);
    // ноги: стоит / идёт / бежит / пятится / бежит боком / присел / в воздухе
    const fx = -Math.sin(S.by), fz = -Math.cos(S.by), rx = Math.cos(S.by), rz = -Math.sin(S.by);
    const fwd = (S.vx * fx + S.vz * fz) / Math.max(sp, 1e-3), side = (S.vx * rx + S.vz * rz) / Math.max(sp, 1e-3);
    let legs = 'Idle', rate = 1;
    if (q.s) { legs = sp > 0.5 ? 'CrouchWalk' : 'CrouchIdle'; rate = clamp(sp / 1.3, 0.6, 1.6); }
    else if (sp > 0.5) {
      if (fwd < -0.6) { legs = 'BackPedalRun'; rate = clamp(sp / 3.5, 0.5, 1.6); }
      else if (Math.abs(side) > 0.75) { legs = side > 0 ? 'StrafeRunRight' : 'StrafeRunLeft'; rate = clamp(sp / 4, 0.5, 1.6); }
      else if (sp < 3) { legs = 'Walk'; rate = clamp(sp / 1.6, 0.5, 1.8); }
      else { legs = 'Run'; rate = clamp(sp / 5.6, 0.6, 1.6); }
    }
    S.air = (Math.abs(S.vy) > 3.5) ? Math.min(1, S.air + dt * 4) : Math.max(0, S.air - dt * 6);
    if (S.legs !== legs) { S.plegs = S.legs; S.plt = S.lt; S.lblend = 0.2; S.legs = legs; S.lt = 0; }
    S.lt = (S.lt || 0) + dt * rate; S.plt = (S.plt || 0) + dt * rate; S.lblend = Math.max(0, (S.lblend || 0) - dt);
    // выстрел
    const w = this.W[q.samW] || this.weapons[5];
    if (q.samFire) { q.samFire = 0; S.ft = 0; }
    S.ft += dt;
    md.rest();
    md.layer(md.clip(S.plegs), S.plt, true, 1);
    md.layer(md.clip(legs), S.lt, true, S.lblend > 0 ? 1 - S.lblend / 0.2 : 1);
    md.layer(md.clip('Jump_Idle_Fall'), S.t, true, S.air);
    md.layer(md.clip('Body_Idle'), 0, false);
    md.layer(md.clip(w.body[0]), S.t, true);
    const fc = md.clip(w.body[1]);
    if (fc && S.ft < fc.len) md.layer(fc, S.ft, false, S.ft < 0.05 ? S.ft / 0.05 : S.ft > fc.len - 0.15 ? (fc.len - S.ft) / 0.15 : 1);
    // наклон корпуса и головы за взглядом вверх-вниз
    const pit = clamp(q.pi || 0, -1.2, 1.2);
    for (const [bn, kk] of [['MidTorso', 0.35], ['Chest', 0.35], ['Neck', 0.3]]) {
      const b = md.index[bn]; if (b === undefined) continue;
      const h = -pit * kk * 0.5, r = [Math.sin(h), 0, 0, Math.cos(h)], cur = md.lq.slice(b * 4, b * 4 + 4);
      qmulTo(md.lq, b * 4, r, 0, cur, 0);
    }
    md.fk();
    S.yaw = S.by;
    return md;
  },
  // ---------- кадр мира: Сэмы, снаряды ----------
  drawWorld(VP, cam, env) {
    if (this.state !== 'ready' || !this.ensureGL()) return;
    const gl = Rend.gl, now = performance.now();
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    const list = [];
    for (const [u, q] of Net.peers) if (q.m === 's' && !q.dd && now - (q.seen || 0) < 15000 && !Ents.obsHides(u)) list.push([q, q._sam || (q._sam = {}), this.W[this.weapons[q.sw | 0] ? this.weapons[q.sw | 0].id : 'hd_tommygun']]);
    if (this.on() && Game.view && !Player.dead) {
      const q = Net.selfQ(); q.samW = this.cur; q.samFire = this.bodyFire; this.bodyFire = 0;
      this.selfS = this.selfS || {}; list.push([q, this.selfS, this.W[this.cur]]);
    }
    for (const [q, S, w] of list) {
      if (q.sw !== undefined && this.weapons[q.sw | 0]) q.samW = this.weapons[q.sw | 0].id;
      const dt = Math.min(0.1, (now - (S.last || now)) / 1000); S.last = now;
      const md = this.poseSam(q, S, dt); if (!md) continue;
      const l = World.light(Math.floor(q.cx), Math.floor(q.cy + 1), Math.floor(q.cz)), sky = (l >> 4) / 15, blk = (l & 15) / 15;
      const M = m4(), R = m4(), hs = q.hs || 1;
      m4translate(M, q.cx - cam.x, q.cy - cam.y, q.cz - cam.z);
      m4mul(M, M, m4rotY(R, S.yaw + (S === this.selfS ? this.dbgYaw || 0 : 0)));
      if (hs !== 1) m4mul(M, M, m4scale(R, hs, hs, hs));
      this.drawModel(md, VP, M, env, { sky, blk });
      // оружие в правой руке
      const wd = this.W[q.samW] || w, im = wd && this.models[wd.item];
      if (im) {
        im.rest(); im.fk();
        // кольты — в обеих руках
        for (const hn of wd.id === 'hd_colt' ? ['R_Hand', 'L_Hand'] : ['R_Hand']) {
          const hand = md.boneXf(hn), g = this.grips && this.grips[wd.id + ':' + hn]; if (!hand || !g) continue;
          const T = m4();
          const A = m4mul(m4(), M, m4fromQP(m4(), hand.q, hand.p));
          m4mul(A, A, m4fromQP(T, g.q, g.off));
          if (g.s !== 1) m4mul(A, A, m4scale(T, g.s, g.s, g.s));
          this.drawModel(im, VP, A, env, { sky, blk });
        }
      }
    }
    SamMobs.draw(VP, cam, env);   // мобы из яиц призыва
    // снаряды: модели по направлению полёта
    for (const s of this.shots) {
      const mdl = s.mdl ? this.models[s.mdl] : s.pd.model && this.models[s.pd.model]; if (!mdl) continue;
      const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, M = m4(), R = m4();
      m4translate(M, s.x - cam.x, s.y - cam.y, s.z - cam.z);
      m4mul(M, M, m4rotY(R, Math.atan2(-s.vx, -s.vz)));
      m4mul(M, M, m4rotX(R, Math.asin(clamp(s.vy / sp, -1, 1))));
      if (s.kind.endsWith('cannonball')) m4mul(M, M, m4rotX(R, s.age * 12));
      mdl.rest(); mdl.fk();
      const l = World.light(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z));
      this.drawModel(mdl, VP, M, env, { sky: (l >> 4) / 15, blk: (l & 15) / 15, flash: s.kind.endsWith('laser') ? 1.5 : 0 });
    }
  },
  // ---------- частицы мира (после прозрачной воды) ----------
  drawFx(VP, cam, env) {
    if (this.state !== 'ready' || !this.ensureGL() || (!this.parts.length && !this.shots.length)) return;
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)], f = [-Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
    const items = [];
    for (const q of this.parts) {
      if (q.age < 0) continue;
      const t = Math.min(1, q.age / q.life), e = q.e;
      const frame = q.frame >= 0 ? q.frame : Math.floor(t * e.cols * e.rows);
      const size = q.size * (1 + (e.grow - 1) * t);
      items.push([e.tex, e.additive, q.x - cam.x, q.y - cam.y, q.z - cam.z, size, q.rot, e, frame, this.colour(e, t)]);
    }
    // огни, летящие вместе со снарядом (life < 0 в .pfx)
    for (const s of this.shots) {
      if (!s.pd.trail) continue;
      for (const e of s.pd.trail) if (e.life[0] < 0) {
        const fr = e.ft > 0 ? Math.floor(s.age / e.ft) % (e.cols * e.rows) : 0;
        items.push([e.tex, e.additive, s.x - cam.x, s.y - cam.y, s.z - cam.z, e.size[0] * (s.kind.endsWith('laser') ? 0.6 : 1), (e.rot[0] + e.spin[0] * s.age) * Math.PI / 180, e, fr, this.colour(e, 0)]);
      }
    }
    if (!items.length) return;
    items.sort((a, b) => (a[1] - b[1]) || (b[2] * b[2] + b[3] * b[3] + b[4] * b[4] - (a[2] * a[2] + a[3] * a[3] + a[4] * a[4])));
    const quad = (it, F, n) => {
      const [, , x, y, z, size, rot, e, frame, col] = it, h = size * 0.5, cs = Math.cos(rot), sn = Math.sin(rot);
      const fr = clamp(frame, 0, e.cols * e.rows - 1), u0 = (fr % e.cols) / e.cols, v0 = Math.floor(fr / e.cols) / e.rows, u1 = u0 + 1 / e.cols, v1 = v0 + 1 / e.rows;
      const C = [[-1, -1, u1, v1], [-1, 1, u1, v0], [1, 1, u0, v0], [1, -1, u0, v1]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const a = (C[k][0] * cs - C[k][1] * sn) * h, b = (C[k][0] * sn + C[k][1] * cs) * h, o = n * 9;
        F[o] = x - right[0] * a + up[0] * b; F[o + 1] = y - right[1] * a + up[1] * b; F[o + 2] = z - right[2] * a + up[2] * b;
        F[o + 3] = C[k][2]; F[o + 4] = C[k][3]; F[o + 5] = col[0]; F[o + 6] = col[1]; F[o + 7] = col[2]; F[o + 8] = col[3]; n++;
      }
      return n;
    };
    this.flushSprites(items, quad, VP, env, true);
  },
  // общий вывод спрайтов, группами по текстуре и смешиванию
  flushSprites(items, quad, VP, env, fog) {
    const gl = Rend.gl, P = this.fxProg, u = P.u;
    Rend.setCommon(P, env);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform1f(u.uFogOn, fog ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.uTex, 0);
    gl.enable(gl.BLEND); gl.depthMask(false);
    gl.bindVertexArray(this.fxVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.fxVBO);
    let i = 0;
    while (i < items.length) {
      const tex = items[i][0], add = items[i][1];
      let n = 0, F = this.fxF;
      while (i < items.length && items[i][0] === tex && items[i][1] === add) {
        if ((n + 6) * 9 > F.length) { const nf = new Float32Array(F.length * 2); nf.set(F); F = this.fxF = nf; }
        n = quad(items[i], F, n); i++;
      }
      const t = tex ? this.texture(tex) : null;
      gl.bindTexture(gl.TEXTURE_2D, (t && t.gl) || this.white);
      gl.uniform1f(u.uAdd, add ? 1 : 0);
      if (add) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bufferData(gl.ARRAY_BUFFER, F.subarray(0, n * 9), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, n);
    }
    gl.bindVertexArray(null); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, Rend.atlas);
  },
  // ---------- оружие от первого лица ----------
  drawView(cam, env, aspect) {
    const v = this.view, d = v.def;
    if (this.state !== 'ready' || !d || !this.ensureGL()) return;
    const md = this.models[d.id]; if (!md) return;
    const gl = Rend.gl, p = Player;
    // поза: клип, плавно сменивший предыдущий; слой ствола у лазера; вращение стволов минигана
    md.rest();
    if (v.prev) md.layer(md.clip(v.prev), v.pt, v.ploop, 1);
    md.layer(md.clip(v.clip), v.t, v.loop, v.prev && v.blendT > 0 ? 1 - v.blendL / v.blendT : 1);
    if (v.layer) md.layer(md.clip(v.layer), v.layerT, false, 1);
    if (md.index.Barrels !== undefined) md.spin(md.index.Barrels, v.spinA);
    md.fk();
    // своя проекция с полем зрения оружия из игры; при прицеле снайперки оружие не видно
    if (this.zoom > 0.5) return;
    const P = m4persp(m4(), d.fov * Math.PI / 180, aspect, 0.02, 30), M = m4(), T = m4();
    const ph = p.bob * 1.7, ba = Game.settings.bob ? p.bobAmt : 0, eq = 1 - p.equip;
    m4translate(M, d.off[0] + Math.sin(ph) * 0.012 * ba, d.off[1] - Math.abs(Math.cos(ph)) * 0.016 * ba - eq * 0.3, d.off[2]);
    const sw = this.sway || (this.sway = [0, 0]);
    m4mul(M, M, m4rotY(T, sw[0])); m4mul(M, M, m4rotX(T, sw[1]));
    const l = World.light(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z));
    const sky = Math.max((l >> 4) / 15, 0.25), blk = Math.max((l & 15) / 15, (env.handLight || 0));
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    this.drawModel(md, P, M, env, { sky, blk: Math.max(blk, v.flash > 0 ? 0.9 : 0), fog: false });
    // вид → мир: для гильз (вылетают из окна затвора)
    const V = m4view(m4(), cam.yaw, cam.pitch), Vi = m4invert(m4(), V);
    this.lastViewXf = m4mul(m4(), Vi, M); this.lastCam = cam;
    // вспышка у дула
    if (v.flash > 0 && d.flash) {
      const fm = this.models[d.flash[0]], pt = md.locator(d.flash[1]);
      if (fm && pt) {
        const A = m4mul(m4(), M, m4translate(T, pt[0], pt[1], pt[2]));
        m4mul(A, A, m4rotZ(T, Math.random() * PI2));
        fm.rest(); fm.fk();
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
        this.drawModel(fm, P, A, env, { sky: 0, blk: 0, flash: 1.6, fog: false });
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    }
    // огонь у ствола: спрайты в плоскости экрана в точке крепления
    if (this.viewFx.length) {
      const items = [];
      for (const s of this.viewFx) {
        const pt = md.locator(s.loc); if (!pt) continue;
        const w = m4xv(M, pt[0], pt[1], pt[2], 1), t = Math.min(1, s.age / s.life), e = s.e;
        items.push([e.tex, e.additive, w[0], w[1], w[2], s.size * (1 + (e.grow - 1) * t), s.rot, e, e.rnd ? 0 : Math.floor(t * e.cols * e.rows), this.colour(e, t, true)]);
      }
      items.sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
      const quad = (it, F, n) => {
        const [, , x, y, z, size, rot, e, frame, col] = it, h = size * 0.5, cs = Math.cos(rot), sn = Math.sin(rot);
        const fr = clamp(frame, 0, e.cols * e.rows - 1), u0 = (fr % e.cols) / e.cols, v0 = Math.floor(fr / e.cols) / e.rows, u1 = u0 + 1 / e.cols, v1 = v0 + 1 / e.rows;
        const C = [[-1, -1, u1, v1], [-1, 1, u1, v0], [1, 1, u0, v0], [1, -1, u0, v1]];
        for (const k of [0, 1, 2, 0, 2, 3]) {
          const a = (C[k][0] * cs - C[k][1] * sn) * h, b = (C[k][0] * sn + C[k][1] * cs) * h, o = n * 9;
          F[o] = x + a; F[o + 1] = y + b; F[o + 2] = z; F[o + 3] = C[k][2]; F[o + 4] = C[k][3];
          F[o + 5] = col[0]; F[o + 6] = col[1]; F[o + 7] = col[2]; F[o + 8] = col[3]; n++;
        }
        return n;
      };
      this.flushSprites(items, quad, P, env, false);
    }
  },
  // ---------- интерфейс: полоса выбора оружия и вспышка Серьёзной бомбы ----------
  buildBar() {
    let bar = $('samBar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'samBar'; document.body.appendChild(bar);
      const fl = document.createElement('div'); fl.id = 'samFlash'; document.body.appendChild(fl);
      const sc = document.createElement('div'); sc.id = 'samScope'; document.body.appendChild(sc);
    }
    bar.innerHTML = '';
    SAM_SLOTS.forEach((g, i) => {
      const col = document.createElement('div'); col.className = 'samslot';
      const num = document.createElement('b'); num.textContent = (i + 1) % 10; col.appendChild(num);
      for (const id of g) {
        const im = document.createElement('img'); im.dataset.w = id; im.alt = '';
        const ti = this.D.tex[this.D.icons[id]];
        if (ti) im.src = URL.createObjectURL(new Blob([this.bytes(ti)], { type: ti[2] }));
        col.appendChild(im);
      }
      bar.appendChild(col);
    });
    const nm = document.createElement('div'); nm.id = 'samName'; bar.appendChild(nm);
    this.showBar();
  },
  showBar() {
    const bar = $('samBar'); if (!bar || this.state !== 'ready') return;
    for (const im of bar.querySelectorAll('img')) im.classList.toggle('on', im.dataset.w === this.cur);
    const w = this.W[this.cur]; if ($('samName') && w) $('samName').textContent = w.title;
    bar.style.opacity = 1; this.barT = 2.2;
  },
  hud(dt) {
    const on = this.on() && this.state === 'ready' && !UI.hideHud && !Player.dead;
    const hud = $('hud'); if (hud) hud.classList.toggle('sam', this.on());
    const bar = $('samBar');
    if (bar) { this.barT = (this.barT || 0) - dt; bar.style.opacity = on && this.barT > 0 ? Math.min(1, this.barT * 2) : 0; }
    const fl = $('samFlash'); if (fl) fl.style.opacity = clamp(this.bombFlash || 0, 0, 1);
    const sc = $('samScope'); if (sc) sc.style.display = on && this.zoom > 0.5 ? 'block' : 'none';
  }
});
