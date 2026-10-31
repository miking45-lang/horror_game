// ============================================================
//  Облик «Серьёзный Сэм» (владелец, NumPad 5): модель классического Сэма, оружие HD с руками от первого лица,
//  их анимации, звуки, вспышки, гильзы, снаряды и взрывы. Ресурсы — SAM_DATA_B64 (tools/export_sam.py).
//  Здесь: распаковка пакета, скелетная анимация и отрисовка на видеокарте.
// ============================================================
const SAM_VS = `#version 300 es
layout(location=0) in vec4 aPos; layout(location=1) in vec4 aNrm; layout(location=2) in vec2 aUV;
layout(location=3) in uvec4 aBone; layout(location=4) in vec4 aW;
uniform mat4 uVP; uniform mat4 uM; uniform vec3 uLo; uniform vec3 uSpan; uniform vec4 uBones[192];
out vec2 vUV; out vec3 vN; out vec3 vRel;
vec3 xf(uint b, vec3 p, float w1) { int i = int(b) * 3; return vec3(dot(uBones[i], vec4(p, w1)), dot(uBones[i + 1], vec4(p, w1)), dot(uBones[i + 2], vec4(p, w1))); }
void main(){
  vec3 p = uLo + (aPos.xyz + 32768.0) / 65535.0 * uSpan;
  vec3 sp = xf(aBone.x, p, 1.0) * aW.x + xf(aBone.y, p, 1.0) * aW.y + xf(aBone.z, p, 1.0) * aW.z + xf(aBone.w, p, 1.0) * aW.w;
  vec3 sn = xf(aBone.x, aNrm.xyz, 0.0) * aW.x + xf(aBone.y, aNrm.xyz, 0.0) * aW.y + xf(aBone.z, aNrm.xyz, 0.0) * aW.z + xf(aBone.w, aNrm.xyz, 0.0) * aW.w;
  vec4 wp = uM * vec4(sp, 1.0);
  vRel = wp.xyz; vN = normalize(mat3(uM) * sn); vUV = aUV;
  gl_Position = uVP * wp;
}`;
const SAM_FS = `#version 300 es
${GLSL_COMMON}
uniform sampler2D uTex; uniform float uSky; uniform float uBlk; uniform float uAlpha; uniform float uFogOn; uniform float uFlash; uniform vec3 uSun;
in vec2 vUV; in vec3 vN; in vec3 vRel;
out vec4 o;
void main(){
  vec4 t = texture(uTex, vUV);
  if (t.a < uAlpha) discard;
  vec3 n = normalize(vN);
  float sh = 0.62 + 0.38 * max(dot(n, uSun), 0.0) + 0.1 * n.y;
  vec3 c = t.rgb * lightOf(uSky, uBlk) * sh + t.rgb * uFlash;
  if (uFogOn > 0.5) c = mix(c, uFogColor, fogF(length(vRel)));
  o = vec4(c, 1.0);
}`;
// частицы и вспышки: спрайты с покадровой анимацией из листа текстуры
const SAMFX_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aCol;
uniform mat4 uVP; out vec2 vUV; out vec4 vCol; out vec3 vRel;
void main(){ vUV = aUV; vCol = aCol; vRel = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`;
const SAMFX_FS = `#version 300 es
${GLSL_COMMON}
uniform sampler2D uTex; uniform float uAdd; uniform float uFogOn;
in vec2 vUV; in vec4 vCol; in vec3 vRel; out vec4 o;
void main(){
  vec4 t = texture(uTex, vUV) * vCol;
  float f = uFogOn > 0.5 ? fogF(length(vRel)) : 0.0;
  if (uAdd > 0.5) { o = vec4(t.rgb * t.a * (1.0 - f), 1.0); return; }
  if (t.a < 0.01) discard;
  o = vec4(mix(t.rgb, uFogColor, f), t.a);
}`;

// ---------- кватернионы (x, y, z, w) ----------
function qmulTo(o, oi, a, ai, b, bi) {
  const ax = a[ai], ay = a[ai + 1], az = a[ai + 2], aw = a[ai + 3], bx = b[bi], by = b[bi + 1], bz = b[bi + 2], bw = b[bi + 3];
  o[oi] = aw * bx + ax * bw + ay * bz - az * by; o[oi + 1] = aw * by - ax * bz + ay * bw + az * bx;
  o[oi + 2] = aw * bz + ax * by - ay * bx + az * bw; o[oi + 3] = aw * bw - ax * bx - ay * by - az * bz;
}
function qrot(q, qi, x, y, z, out) {
  const qx = q[qi], qy = q[qi + 1], qz = q[qi + 2], qw = q[qi + 3];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + (qy * tz - qz * ty); out[1] = y + qw * ty + (qz * tx - qx * tz); out[2] = z + qw * tz + (qx * ty - qy * tx);
  return out;
}

// ---------- модель: данные + поза ----------
class SamModel {
  constructor(name, m, bin) {
    this.name = name; this.m = m; this.bin = bin;
    this.nb = m.bones.length;
    this.parent = m.bones.map(b => b[1]);
    this.restQ = new Float32Array(this.nb * 4); this.restP = new Float32Array(this.nb * 3);
    this.inv = new Float32Array(this.nb * 12);
    this.index = {};
    m.bones.forEach((b, i) => {
      this.index[b[0]] = i;
      this.restQ.set(b.slice(2, 6), i * 4); this.restP.set(b.slice(6, 9), i * 3);
      this.inv.set(m.inv[i], i * 12);
    });
    this.clips = {};
    for (const cn in m.clips) {
      const c = m.clips[cn];
      const q = new Int16Array(bin.buffer, bin.byteOffset + c.q[0], c.q[1] / 2);
      const p = c.p ? new Float32Array(bin.buffer.slice(bin.byteOffset + c.p[0], bin.byteOffset + c.p[0] + c.p[1])) : null;
      this.clips[cn] = { name: cn, n: c.n, fps: c.fps, mask: c.mask, pb: c.pb, q, p, len: c.n / Math.max(c.fps, 1) };
    }
    this.loc = m.loc || {};
    // поза
    this.lq = new Float32Array(this.nb * 4); this.lp = new Float32Array(this.nb * 3);
    this.wq = new Float32Array(this.nb * 4); this.wp = new Float32Array(this.nb * 3);
    this.skin = new Float32Array(Math.max(this.nb, 1) * 12);
    this.tq = new Float32Array(this.nb * 4); this.tp = new Float32Array(this.nb * 3);
    this.gl = null; this.rest();
  }
  clip(n) { return n ? this.clips[n] || null : null; }
  rest() { this.lq.set(this.restQ); this.lp.set(this.restP); }
  // клип в момент t поверх текущей позы с весом w (кости вне mask не трогаем)
  layer(c, t, loop, w = 1) {
    if (!c || w <= 0.001) return;
    let f = t * c.fps; const n = Math.max(c.n, 1);
    f = loop ? ((f % n) + n) % n : clamp(f, 0, c.n);
    const i0 = Math.floor(f), i1 = Math.min(i0 + 1, c.n), a = f - i0, mk = c.mask, nm = mk.length, q = c.q, S = 1 / 32767;
    const o0 = i0 * nm * 4, o1 = i1 * nm * 4, lq = this.lq;
    for (let k = 0; k < nm; k++) {
      const b = mk[k], j0 = o0 + k * 4, j1 = o1 + k * 4;
      let x1 = q[j1] * S, y1 = q[j1 + 1] * S, z1 = q[j1 + 2] * S, w1 = q[j1 + 3] * S;
      const x0 = q[j0] * S, y0 = q[j0 + 1] * S, z0 = q[j0 + 2] * S, w0 = q[j0 + 3] * S;
      if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
      let x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a, z = z0 + (z1 - z0) * a, ww = w0 + (w1 - w0) * a;
      const bo = b * 4;
      if (w < 0.999) {
        const s = (lq[bo] * x + lq[bo + 1] * y + lq[bo + 2] * z + lq[bo + 3] * ww) < 0 ? -1 : 1;
        x = lq[bo] + (x * s - lq[bo]) * w; y = lq[bo + 1] + (y * s - lq[bo + 1]) * w; z = lq[bo + 2] + (z * s - lq[bo + 2]) * w; ww = lq[bo + 3] + (ww * s - lq[bo + 3]) * w;
      }
      const l = Math.hypot(x, y, z, ww) || 1;
      lq[bo] = x / l; lq[bo + 1] = y / l; lq[bo + 2] = z / l; lq[bo + 3] = ww / l;
    }
    if (c.p) {
      const np = c.pb.length, p = c.p, lp = this.lp;
      for (let k = 0; k < np; k++) {
        const b = c.pb[k] * 3, j0 = (i0 * np + k) * 3, j1 = (i1 * np + k) * 3;
        for (let e = 0; e < 3; e++) { const v = p[j0 + e] + (p[j1 + e] - p[j0 + e]) * a; lp[b + e] += (v - lp[b + e]) * w; }
      }
    }
  }
  // поворот кости вокруг её локальной оси Z (стволы минигана)
  spin(b, ang) {
    if (b < 0 || !ang) return;
    const h = ang * 0.5, r = [0, 0, Math.sin(h), Math.cos(h)];
    qmulTo(this.lq, b * 4, this.lq.slice(b * 4, b * 4 + 4), 0, r, 0);
  }
  fk() {
    const nb = this.nb, lq = this.lq, lp = this.lp, wq = this.wq, wp = this.wp, r = [0, 0, 0];
    for (let i = 0; i < nb; i++) {
      const pa = this.parent[i];
      if (pa < 0) { wq.set(lq.subarray(i * 4, i * 4 + 4), i * 4); wp.set(lp.subarray(i * 3, i * 3 + 3), i * 3); continue; }
      qmulTo(wq, i * 4, wq, pa * 4, lq, i * 4);
      qrot(wq, pa * 4, lp[i * 3], lp[i * 3 + 1], lp[i * 3 + 2], r);
      wp[i * 3] = wp[pa * 3] + r[0]; wp[i * 3 + 1] = wp[pa * 3 + 1] + r[1]; wp[i * 3 + 2] = wp[pa * 3 + 2] + r[2];
    }
    const S = this.skin, iv = this.inv;
    for (let i = 0; i < nb; i++) {
      const x = wq[i * 4], y = wq[i * 4 + 1], z = wq[i * 4 + 2], w = wq[i * 4 + 3];
      const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
      const T = [wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2]], o = i * 12, v = i * 12;
      for (let row = 0; row < 3; row++) {
        const a0 = R[row * 3], a1 = R[row * 3 + 1], a2 = R[row * 3 + 2];
        S[o + row * 4] = a0 * iv[v] + a1 * iv[v + 4] + a2 * iv[v + 8];
        S[o + row * 4 + 1] = a0 * iv[v + 1] + a1 * iv[v + 5] + a2 * iv[v + 9];
        S[o + row * 4 + 2] = a0 * iv[v + 2] + a1 * iv[v + 6] + a2 * iv[v + 10];
        S[o + row * 4 + 3] = a0 * iv[v + 3] + a1 * iv[v + 7] + a2 * iv[v + 11] + T[row];
      }
    }
  }
  // точка крепления (ствол, затвор...) или кость в пространстве модели с последней позой
  locator(name, out = [0, 0, 0]) {
    const l = this.loc[name];
    if (!l) return null;
    const r = qrot(this.wq, l[0] * 4, l[1], l[2], l[3], [0, 0, 0]);
    out[0] = this.wp[l[0] * 3] + r[0]; out[1] = this.wp[l[0] * 3 + 1] + r[1]; out[2] = this.wp[l[0] * 3 + 2] + r[2];
    return out;
  }
  // положение и поворот кости (кватернион) после fk
  boneXf(name) {
    const i = this.index[name]; if (i === undefined) return null;
    return { p: [this.wp[i * 3], this.wp[i * 3 + 1], this.wp[i * 3 + 2]], q: [this.wq[i * 4], this.wq[i * 4 + 1], this.wq[i * 4 + 2], this.wq[i * 4 + 3]] };
  }
}
// матрица (column-major) из кватерниона и сдвига
function m4fromQP(o, q, p) {
  const [x, y, z, w] = q;
  o[0] = 1 - 2 * (y * y + z * z); o[1] = 2 * (x * y + z * w); o[2] = 2 * (x * z - y * w); o[3] = 0;
  o[4] = 2 * (x * y - z * w); o[5] = 1 - 2 * (x * x + z * z); o[6] = 2 * (y * z + x * w); o[7] = 0;
  o[8] = 2 * (x * z + y * w); o[9] = 2 * (y * z - x * w); o[10] = 1 - 2 * (x * x + y * y); o[11] = 0;
  o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
  return o;
}

const Sam = {
  state: 'none', D: null, bin: null, models: {}, tex: {}, snd: {}, sndBuf: {}, weapons: [], W: {},
  // ---------- распаковка пакета ----------
  load() {
    if (this.state !== 'none') return this.loading;
    this.state = 'loading';
    this.loading = (async () => {
      const raw = Uint8Array.from(atob(SAM_DATA_B64), c => c.charCodeAt(0));
      const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(ds).arrayBuffer());
      const dv = new DataView(buf.buffer);
      if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'SAMP') throw new Error('пакет Сэма повреждён');
      const jl = dv.getUint32(4, true);
      this.D = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + jl)));
      let off = 8 + jl; while (off % 4) off++;
      this.bin = buf.subarray(off);
      for (const n in this.D.models) this.models[n] = new SamModel(n, this.D.models[n], this.bin);
      this.weapons = this.D.weapons.map((w, i) => this.prepWeapon(w, i));
      for (const w of this.weapons) this.W[w.id] = w;
      this.state = 'ready';
      this.onReady();
    })().catch(e => { this.state = 'error'; console.error(e); UI.toast('Облик Сэма не загрузился: ' + e.message); });
    return this.loading;
  },
  bytes(r) { return this.bin.subarray(r[0], r[0] + r[1]); },
  // ---------- ресурсы на видеокарте ----------
  ensureGL() {
    if (this.prog) return true;
    const gl = Rend.gl; if (!gl) return false;
    this.prog = Rend.prog(SAM_VS, SAM_FS);
    this.fxProg = Rend.prog(SAMFX_VS, SAMFX_FS);
    this.fxVAO = gl.createVertexArray(); this.fxVBO = gl.createBuffer();
    gl.bindVertexArray(this.fxVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.fxVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.bindVertexArray(null);
    this.fxF = new Float32Array(9 * 6 * 2048);
    this.white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 200, 200, 255]));
    return true;
  },
  upload(md) {
    if (md.gl) return md.gl;
    const gl = Rend.gl, m = md.m;
    const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, this.bytes(m.vb), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.SHORT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.BYTE, true, 24, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.HALF_FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_BYTE, 24, 16);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 24, 20);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.bytes(m.ib), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    md.gl = { vao, vbo, ibo, type: m.i32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, size: m.i32 ? 4 : 2 };
    for (const t of m.tex) this.texture(t);
    return md.gl;
  },
  texture(key) {
    let t = this.tex[key];
    if (t) return t;
    const info = this.D.tex[key], gl = Rend.gl;
    t = this.tex[key] = { gl: null, alpha: info ? info[5] : false };
    if (!info) return t;
    const blob = new Blob([this.bytes(info)], { type: info[2] });
    createImageBitmap(blob).then(img => {
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      t.gl = tx; t.w = img.width; t.h = img.height;
    }).catch(() => { });
    return t;
  },
  // ---------- отрисовка модели: VP — проекция·вид, M — модель (относительно камеры) ----------
  drawModel(md, VP, M, env, o = {}) {
    if (!md || !this.ensureGL()) return;
    const gl = Rend.gl, P = this.prog, u = P.u, g = this.upload(md), m = md.m;
    Rend.setCommon(P, env);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uM, false, M);
    gl.uniform3fv(u.uLo, m.lo); gl.uniform3fv(u.uSpan, m.span);
    gl.uniform4fv(u['uBones[0]'], md.skin);
    gl.uniform1f(u.uSky, o.sky !== undefined ? o.sky : 1); gl.uniform1f(u.uBlk, o.blk || 0);
    gl.uniform1f(u.uFogOn, o.fog === false ? 0 : 1); gl.uniform1f(u.uFlash, o.flash || 0);
    const sd = env.sunDir || [0.3, 0.8, 0.2], sl = Math.hypot(sd[0], Math.max(sd[1], 0.35), sd[2]);
    gl.uniform3f(u.uSun, sd[0] / sl, Math.max(sd[1], 0.35) / sl, sd[2] / sl);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.uTex, 0);
    gl.bindVertexArray(g.vao);
    for (const [ti, first, count] of m.groups) {
      if (o.skipTex && o.skipTex.has(ti)) continue;
      const t = this.texture(m.tex[ti]);
      gl.bindTexture(gl.TEXTURE_2D, t.gl || this.white);
      gl.uniform1f(u.uAlpha, t.alpha ? 0.5 : 0.0);
      gl.drawElements(gl.TRIANGLES, count * 3, g.type, first * 3 * g.size);
    }
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, Rend.atlas);
  },
  // ---------- звук ----------
  sound(key, x, y, z, vol = 1, pitch = 1) {
    const list = this.D && this.D.snd[key];
    if (!list || !Sfx.ctx || !Sfx.on) return;
    const vi = Math.floor(Math.random() * list.length), k = key + '#' + vi;
    const go = buf => {
      const ctx = Sfx.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.playbackRate.value = pitch;
      let v = vol;
      let out = g;
      if (x !== undefined) {
        const p = Player, dx = x - p.x, dy = y - (p.y + EYE), dz = z - p.z, d = Math.hypot(dx, dy, dz);
        v *= clamp(1 - d / 72, 0, 1) ** 1.6;
        if (v < 0.005) return;
        const right = [Math.cos(p.yaw), -Math.sin(p.yaw)], pan = clamp((dx * right[0] + dz * right[1]) / Math.max(d, 1), -1, 1) * 0.75;
        const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); out = pn;
      }
      g.gain.value = v * 0.8;
      s.connect(g); out.connect(Sfx.sfx || Sfx.master); s.start();
      return s;
    };
    const b = this.sndBuf[k];
    if (b) return go(b);
    if (b === null) return;
    this.sndBuf[k] = null;
    const r = list[vi];
    Sfx.ctx.decodeAudioData(this.bytes(r).slice().buffer).then(buf => { this.sndBuf[k] = buf; go(buf); }, () => { });
  }
};
