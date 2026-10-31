// ============================================================
//  Рендер WebGL2
// ============================================================
const GLSL_COMMON = `
precision highp float;
uniform float uSkySub; uniform vec3 uSkyTint; uniform float uGamma; uniform float uMinLight; uniform float uBlockMul; uniform float uHand;
uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd;
float lcurve(float l){ return l / ((1.0 - l) * 3.0 + 1.0); }
vec3 lightOf(float sky, float blk){
  float s = clamp(sky * 15.0 - uSkySub, 0.0, 15.0) / 15.0;
  vec3 c = max(vec3(lcurve(s)) * uSkyTint, vec3(lcurve(blk) * uBlockMul) * vec3(1.0, 0.84, 0.62));
  c = mix(c, 1.0 - pow(1.0 - c, vec3(3.0)), uGamma);
  return uMinLight + c * (1.0 - uMinLight);
}
float handL(vec3 rel){ return uHand * clamp(1.0 - length(rel) / 9.0, 0.0, 1.0); }
float fogF(float d){ return smoothstep(uFogStart, uFogEnd, d); }
`;
const VS_CHUNK = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aL;
uniform mat4 uVP; uniform vec3 uOffset; uniform float uCamY;
out vec2 vUV; out vec3 vL; out vec3 vRel; out float vWY; out float vTop; out vec4 vClip;
void main(){
  vec3 p = aPos / 32.0 + uOffset;
  vRel = p; vWY = p.y + uCamY;
  vUV = aUV / 4096.0; vL = aL.xyz; vTop = aL.w;
  vClip = uVP * vec4(p, 1.0);
  gl_Position = vClip;
}`;
const FS_CHUNK = `#version 300 es
${GLSL_COMMON}
uniform sampler2D uAtlas; uniform float uAlphaTest; uniform float uClipY; uniform float uClip;
in vec2 vUV; in vec3 vL; in vec3 vRel; in float vWY; in float vTop; in vec4 vClip;
out vec4 o;
void main(){
  if (uClip > 0.5 && vWY < uClipY) discard;
  vec4 t = texture(uAtlas, vUV);
  if (t.a < uAlphaTest) discard;
  vec3 c = t.rgb * lightOf(vL.x, max(vL.y, handL(vRel))) * vL.z;
  c = mix(c, uFogColor, fogF(length(vRel)));
  o = vec4(c, 1.0);
}`;
const FS_WATER = `#version 300 es
${GLSL_COMMON}
uniform sampler2D uAtlas; uniform sampler2D uRefl; uniform float uUseRefl; uniform float uWaterY;
uniform vec3 uCamPos; uniform float uTime; uniform vec3 uSunDir; uniform float uDay; uniform float uUnder;
uniform vec3 uSkyTop; uniform vec3 uSkyHor;
in vec2 vUV; in vec3 vL; in vec3 vRel; in float vWY; in float vTop; in vec4 vClip;
out vec4 o;
vec2 waveGrad(vec2 p, float t){
  vec2 g = vec2(0.0);
  vec2 d1 = normalize(vec2(1.0, 0.35)), d2 = normalize(vec2(-0.6, 1.0)), d3 = normalize(vec2(0.3, -1.0)), d4 = normalize(vec2(-1.0, -0.2));
  g += d1 * cos(dot(d1, p) * 0.75 + t * 1.1) * 0.75 * 0.055;
  g += d2 * cos(dot(d2, p) * 1.3 + t * 1.6) * 1.3 * 0.03;
  g += d3 * cos(dot(d3, p) * 2.9 + t * 2.3) * 2.9 * 0.012;
  g += d4 * cos(dot(d4, p) * 5.3 + t * 3.1) * 5.3 * 0.005;
  return g;
}
void main(){
  vec3 wp = vRel + uCamPos;
  vec4 t = texture(uAtlas, vUV);
  vec3 L = lightOf(vL.x, max(vL.y, handL(vRel))) * vL.z;
  vec3 base = mix(vec3(0.06, 0.14, 0.34), t.rgb * vec3(0.5, 0.66, 0.92), 0.4) * L;
  float dist = length(vRel);
  float ff = fogF(dist);
  if (vTop < 0.5) { o = vec4(mix(base, uFogColor, ff), 0.78); return; }
  vec2 g = waveGrad(wp.xz, uTime);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(-vRel);
  if (uUnder > 0.5) { o = vec4(mix(base * 0.8, uFogColor, ff), 0.86); return; }
  float ndv = max(dot(N, V), 0.0);
  float fres = clamp(0.3 + 0.7 * pow(1.0 - ndv, 3.0), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  float sky = clamp(vL.x * 15.0 - 0.0, 0.0, 15.0) / 15.0;
  vec3 skyc = mix(uSkyHor, uSkyTop, smoothstep(0.0, 0.5, R.y)) * lightOf(vL.x, 0.0);
  vec3 refl = skyc;
  if (uUseRefl > 0.5 && abs(wp.y - uWaterY) < 0.07) {
    vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
    suv += N.xz * 0.045 * clamp(12.0 / (dist + 4.0), 0.25, 1.0);
    refl = texture(uRefl, clamp(suv, 0.002, 0.998)).rgb;
  }
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0) * uDay * smoothstep(0.6, 1.0, sky);
  vec3 c = mix(base, refl, fres) + vec3(1.0, 0.93, 0.78) * spec * 2.5;
  float a = mix(0.74, 0.96, fres);
  o = vec4(mix(c, uFogColor, ff), mix(a, 1.0, ff));
}`;
const VS_ENT = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aL;
uniform mat4 uVP; uniform float uCamY;
out vec2 vUV; out vec3 vL; out vec3 vRel; out float vWY;
void main(){ vRel = aPos; vWY = aPos.y + uCamY; vUV = aUV; vL = aL.xyz; gl_Position = uVP * vec4(aPos, 1.0); }`;
const FS_ENT = `#version 300 es
${GLSL_COMMON}
uniform sampler2D uAtlas; uniform vec4 uColor; uniform float uUnlit; uniform float uFogOn; uniform float uClipY; uniform float uClip; uniform float uFogMul;
in vec2 vUV; in vec3 vL; in vec3 vRel; in float vWY;
out vec4 o;
void main(){
  if (uClip > 0.5 && vWY < uClipY) discard;
  vec4 t = texture(uAtlas, vUV) * uColor;
  if (t.a < 0.1) discard;
  vec3 c = uUnlit > 0.5 ? t.rgb : t.rgb * lightOf(vL.x, vL.y) * vL.z;
  if (uFogOn > 0.5) c = mix(c, uFogColor, fogF(length(vRel)) * uFogMul);
  o = vec4(c, t.a);
}`;
const VS_SKY = `#version 300 es
out vec2 vN;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0; vN = p; gl_Position = vec4(p, 0.9999, 1.0); }`;
const FS_SKY = `#version 300 es
precision highp float;
uniform mat4 uInv; uniform vec3 uSunDir; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uFogColor;
uniform float uNight; uniform float uSunset; uniform vec3 uCamPos; uniform float uClouds; uniform float uFlip;
uniform float uDay; uniform float uCave; uniform float uFogEnd; uniform vec2 uCloudOff;
in vec2 vN; out vec4 o;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec4 w = uInv * vec4(vN, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w); d.y *= uFlip;
  float hgt = d.y;
  vec3 col = mix(uHor, uTop, smoothstep(-0.02, 0.45, hgt));
  // закатное зарево
  float sd = max(dot(d, uSunDir), 0.0);
  col = mix(col, vec3(0.95, 0.38, 0.16) * (1.0 - uNight * 0.6), uSunset * pow(sd, 3.0) * (1.0 - smoothstep(0.0, 0.5, abs(hgt))) * 0.85);
  // звёзды (вращаются вместе с небом)
  if (uNight > 0.01 && hgt > -0.05) {
    vec3 s = d;
    float a = atan(uSunDir.y, uSunDir.x);
    float ca = cos(-a), sa = sin(-a);
    s = vec3(ca * s.x - sa * s.y, sa * s.x + ca * s.y, s.z);
    vec3 q = s * 220.0; vec3 cell = floor(q); vec3 fr = fract(q) - 0.5;
    float r = h3(cell);
    if (r > 0.9975 && max(abs(fr.x), max(abs(fr.y), abs(fr.z))) < 0.32) col += vec3(0.75 + 0.25 * h3(cell + 3.0)) * uNight * 0.85 * smoothstep(-0.05, 0.2, hgt);
  }
  // солнце — квадратное
  vec3 sr = normalize(cross(uSunDir, vec3(0.0, 0.0, 1.0))), su = cross(sr, uSunDir);
  float sdot = dot(d, uSunDir);
  if (sdot > 0.0) {
    vec2 p = vec2(dot(d, sr), dot(d, su)) / sdot;
    float m = max(abs(p.x), abs(p.y));
    if (m < 0.075) col = mix(col, vec3(1.0, 0.97, 0.82), 1.0 - uCave);
    else if (m < 0.2) col += vec3(1.0, 0.8, 0.5) * pow(1.0 - (m - 0.075) / 0.125, 2.0) * 0.25 * (1.0 - uNight) * (1.0 - uCave);
  } else {
    vec3 md = -uSunDir; float mdot = dot(d, md);
    vec2 p = vec2(dot(d, sr), dot(d, su)) / mdot;
    float m = max(abs(p.x), abs(p.y));
    if (m < 0.06) {
      vec2 pix = floor((p + 0.06) / 0.12 * 8.0);
      float cr = h2(pix + 7.0) > 0.72 ? 0.72 : 1.0;
      col = mix(col, vec3(0.86, 0.88, 0.95) * cr, 1.0 - uCave);
    } else if (m < 0.16) col += vec3(0.5, 0.55, 0.7) * pow(1.0 - (m - 0.06) / 0.1, 2.0) * 0.12 * uNight * (1.0 - uCave);
  }
  // облака — плоский блочный слой
  if (uClouds > 0.5 && d.y * sign(128.0 - uCamPos.y) > 0.0) {
    float t = (128.0 - uCamPos.y) / d.y;
    vec2 p = uCamPos.xz + d.xz * t;
    vec2 cell = floor((p + uCloudOff) / 12.0);
    float v = vnoise(cell * 0.23) * 0.7 + vnoise(cell * 0.61 + 17.0) * 0.3;
    if (v > 0.58) {
      vec3 cc = mix(vec3(0.95), vec3(0.08, 0.08, 0.1), uNight) * (1.0 - uCave);
      cc = mix(cc, vec3(0.5, 0.04, 0.04), clamp((uTop.r - uTop.g - 0.2) * 3.0, 0.0, 1.0));
      float fade = 1.0 - smoothstep(uFogEnd * 1.2, uFogEnd * 3.5, t);
      col = mix(col, cc, 0.82 * fade);
    }
  }
  // низ неба уходит в туман
  col = mix(col, uFogColor, 1.0 - smoothstep(-0.25, 0.12, hgt));
  col = mix(col, uFogColor, uCave);
  o = vec4(col, 1.0);
}`;

const Rend = {
  gl: null, canvas: null, W: 1, H: 1, stats: { chunks: 0, verts: 0 },
  init(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 недоступен');
    this.gl = gl;
    this.pChunk = this.prog(VS_CHUNK, FS_CHUNK);
    this.pWater = this.prog(VS_CHUNK, FS_WATER);
    this.pEnt = this.prog(VS_ENT, FS_ENT);
    this.pSky = this.prog(VS_SKY, FS_SKY);
    this.skyVAO = gl.createVertexArray();
    // атлас с мип-уровнями по тайлам
    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    let img = atlasImg;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ATLAS_SIZE, ATLAS_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
    let src = img.data, size = ATLAS_SIZE;
    for (let lvl = 1; lvl <= 4; lvl++) {
      const ns = size >> 1, dst = new Uint8ClampedArray(ns * ns * 4);
      for (let y = 0; y < ns; y++) for (let x = 0; x < ns; x++) {
        let r = 0, g = 0, b = 0, a = 0, wsum = 0;
        for (let k = 0; k < 4; k++) {
          const sx = x * 2 + (k & 1), sy = y * 2 + (k >> 1), i = (sy * size + sx) * 4, al = src[i + 3];
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; wsum += al;
        }
        const o = (y * ns + x) * 4;
        if (wsum) { dst[o] = r / wsum; dst[o + 1] = g / wsum; dst[o + 2] = b / wsum; }
        dst[o + 3] = a / 4;
      }
      gl.texImage2D(gl.TEXTURE_2D, lvl, gl.RGBA, ns, ns, 0, gl.RGBA, gl.UNSIGNED_BYTE, dst);
      src = dst; size = ns;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // общий индексный буфер квадов
    const MAXQ = 200000, idx = new Uint32Array(MAXQ * 6);
    for (let q = 0; q < MAXQ; q++) { const o = q * 6, v = q * 4; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    // динамический буфер сущностей
    this.entVAO = gl.createVertexArray(); this.entVBO = gl.createBuffer();
    gl.bindVertexArray(this.entVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.bindVertexArray(null);
    this.reflW = 0; this.reflH = 0;
    this.VP = m4(); this.P = m4(); this.V = m4(); this.tmp = m4(); this.inv = m4(); this.VPref = m4(); this.Mref = m4();
  },
  prog(vs, fs) {
    const gl = this.gl;
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  },
  resize(scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) { this.canvas.width = w; this.canvas.height = h; }
    this.W = w; this.H = h;
  },
  // динамический тайл экрана телевизора (+ мип-уровни тайла)
  updateTV(time, mode) {
    const gl = this.gl; if (!this.atlas) return;
    if (!this._tvBuf) this._tvBuf = new Uint8ClampedArray(TS * TS * 4);
    let src = tvScreenData(mode, time, this._tvBuf), size = TS;
    const ox0 = (TILE.tv_screen % ATLAS_COLS) * TS, oy0 = Math.floor(TILE.tv_screen / ATLAS_COLS) * TS;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    for (let lvl = 0; lvl <= 4; lvl++) {
      gl.texSubImage2D(gl.TEXTURE_2D, lvl, ox0 >> lvl, oy0 >> lvl, size, size, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(src.buffer, src.byteOffset, size * size * 4));
      if (lvl === 4) break;
      const ns = size >> 1, dst = new Uint8ClampedArray(ns * ns * 4);
      for (let y = 0; y < ns; y++) for (let x = 0; x < ns; x++) for (let k = 0; k < 4; k++) {
        const a = ((y * 2) * size + x * 2) * 4 + k, b = a + 4, c = a + size * 4, d = c + 4;
        dst[(y * ns + x) * 4 + k] = (src[a] + src[b] + src[c] + src[d]) / 4;
      }
      src = dst; size = ns;
    }
  },
  ensureRefl() {
    const gl = this.gl, w = Math.max(1, this.W >> 1), h = Math.max(1, this.H >> 1);
    if (w === this.reflW && h === this.reflH) return;
    if (this.reflFBO) { gl.deleteFramebuffer(this.reflFBO); gl.deleteTexture(this.reflTex); gl.deleteRenderbuffer(this.reflDepth); }
    this.reflW = w; this.reflH = h;
    this.reflTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.reflTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.reflDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.reflDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    this.reflFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.reflTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.reflDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },
  // ----- чанки -----
  uploadLayer(old, mb) {
    const gl = this.gl;
    if (!mb.n) { if (old) this.freeLayer(old); return null; }
    let L = old;
    if (!L) {
      L = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), count: 0 };
      gl.bindVertexArray(L.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, false, 16, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.UNSIGNED_SHORT, false, 16, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 16, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, L.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mb.data(), gl.STATIC_DRAW);
    L.count = (mb.n >> 2) * 6;
    return L;
  },
  freeLayer(L) { if (!L) return; this.gl.deleteVertexArray(L.vao); this.gl.deleteBuffer(L.vbo); },
  uploadChunk(c, m) {
    const M = c.mesh || {};
    M.opaque = this.uploadLayer(M.opaque, m.opaque);
    M.cutout = this.uploadLayer(M.cutout, m.cutout);
    M.water = this.uploadLayer(M.water, m.water);
    c.mesh = M;
  },
  freeChunk(c) {
    if (!c.mesh) return;
    this.freeLayer(c.mesh.opaque); this.freeLayer(c.mesh.cutout); this.freeLayer(c.mesh.water);
    c.mesh = null;
  },
  setCommon(P, env) {
    const gl = this.gl, u = P.u;
    gl.useProgram(P.p);
    if (u.uSkySub) gl.uniform1f(u.uSkySub, env.skySub);
    if (u.uSkyTint) gl.uniform3fv(u.uSkyTint, env.skyTint);
    if (u.uGamma) gl.uniform1f(u.uGamma, env.gamma);
    if (u.uMinLight) gl.uniform1f(u.uMinLight, env.minLight);
    if (u.uHand) gl.uniform1f(u.uHand, env.handLight || 0);
    if (u.uBlockMul) gl.uniform1f(u.uBlockMul, env.blockMul !== undefined ? env.blockMul : 1);
    if (u.uFogColor) gl.uniform3fv(u.uFogColor, env.fogColor);
    if (u.uFogStart) gl.uniform1f(u.uFogStart, env.fogStart);
    if (u.uFogEnd) gl.uniform1f(u.uFogEnd, env.fogEnd);
    if (u.uAtlas) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.uniform1i(u.uAtlas, 0); }
  },
  drawSky(cam, env, VProt, flip) {
    const gl = this.gl, P = this.pSky, u = P.u;
    gl.useProgram(P.p);
    m4invert(this.inv, VProt);
    gl.uniformMatrix4fv(u.uInv, false, this.inv);
    gl.uniform3fv(u.uSunDir, env.sunDir); gl.uniform3fv(u.uTop, env.skyTop); gl.uniform3fv(u.uHor, env.skyHor);
    gl.uniform3fv(u.uFogColor, env.fogColor); gl.uniform1f(u.uNight, env.night); gl.uniform1f(u.uSunset, env.sunset);
    gl.uniform3f(u.uCamPos, cam.x, cam.y, cam.z); gl.uniform1f(u.uClouds, env.clouds ? 1 : 0); gl.uniform1f(u.uFlip, flip);
    gl.uniform1f(u.uDay, env.day); gl.uniform1f(u.uCave, env.underwater ? 1 : env.cave); gl.uniform1f(u.uFogEnd, env.fogEnd); gl.uniform2f(u.uCloudOff, env.cloudOff, 0);
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.skyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  },
  visibleChunks(cam, VP, maxDist) {
    const pl = frustumPlanes(VP), out = [];
    for (const c of World.chunks.values()) {
      if (!c.mesh) continue;
      const x0 = (c.cx << 4) - cam.x, z0 = (c.cz << 4) - cam.z;
      if (maxDist) { const dx = Math.max(0, Math.abs(x0 + 8) - 8), dz = Math.max(0, Math.abs(z0 + 8) - 8); if (dx * dx + dz * dz > maxDist * maxDist) continue; }
      if (!aabbInFrustum(pl, x0, -cam.y, z0, x0 + 16, c.maxY + 1 - cam.y, z0 + 16)) continue;
      c._dist = (x0 + 8) * (x0 + 8) + (z0 + 8) * (z0 + 8);
      out.push(c);
    }
    out.sort((a, b) => a._dist - b._dist);
    return out;
  },
  drawChunks(list, layer, cam, VP, clip) {
    const gl = this.gl, P = this.pChunk, u = P.u;
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform1f(u.uCamY, cam.y);
    gl.uniform1f(u.uAlphaTest, layer === 'cutout' ? 0.5 : 0.0);
    gl.uniform1f(u.uClip, clip ? 1 : 0); gl.uniform1f(u.uClipY, clip || 0);
    let n = 0;
    for (const c of list) {
      const L = c.mesh[layer]; if (!L) continue;
      gl.uniform3f(u.uOffset, (c.cx << 4) - cam.x, -cam.y, (c.cz << 4) - cam.z);
      gl.bindVertexArray(L.vao);
      gl.drawElements(gl.TRIANGLES, L.count, gl.UNSIGNED_INT, 0);
      n += L.count;
    }
    return n;
  },
  // ----- кадр -----
  render(cam, env, scene) {
    const gl = this.gl;
    const aspect = this.W / this.H;
    m4persp(this.P, cam.fov * Math.PI / 180, aspect, 0.05, 1000);
    m4view(this.V, cam.yaw, cam.pitch);
    if (cam.roll) { const rz = m4rotZ(m4(), cam.roll); m4mul(this.V, rz, this.V); }
    m4mul(this.VP, this.P, this.V);
    const VP = this.VP;
    const waterY = SEA + 0.875;
    const list = this.visibleChunks(cam, VP, 0);
    // --- отражения ---
    let useRefl = false;
    if (env.reflections && cam.y > waterY + 0.05 && !env.underwater) {
      let any = false;
      for (const c of list) if (c.mesh.water && c._dist < 140 * 140) { any = true; break; }
      if (any) {
        useRefl = true;
        this.ensureRefl();
        const M = this.Mref; m4ident(M); M[5] = -1; M[13] = 2 * (waterY - cam.y);
        m4mul(this.VPref, VP, M);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.reflFBO);
        gl.viewport(0, 0, this.reflW, this.reflH);
        gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.drawSky(cam, env, VP, -1);
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.frontFace(gl.CW);
        const rl = this.visibleChunks(cam, this.VPref, Math.min(env.fogEnd, 96));
        this.setCommon(this.pChunk, env);
        this.drawChunks(rl, 'opaque', cam, this.VPref, waterY);
        gl.disable(gl.CULL_FACE);
        this.drawChunks(rl, 'cutout', cam, this.VPref, waterY);
        if (scene.ents) this.drawEnt(scene.ents, this.VPref, cam, env, { clip: waterY });
        if (scene.figure) this.drawEnt(scene.figure, this.VPref, cam, env, { clip: waterY, color: scene.figureColor, unlit: true });
        if (scene.mutant) { this.drawEnt(scene.mutant, this.VPref, cam, env, { clip: waterY, fogMul: scene.mutantFog }); this.drawEnt(scene.mutantEyes, this.VPref, cam, env, { clip: waterY, unlit: true, fogMul: 0.3 }); }
        if (scene.ghost) { this.drawEnt(scene.ghost, this.VPref, cam, env, { clip: waterY, fogMul: 0.7 }); this.drawEnt(scene.ghostEyes, this.VPref, cam, env, { clip: waterY, unlit: true, fogMul: 0.3 }); }
        gl.frontFace(gl.CCW);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
    }
    // --- основной проход ---
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawSky(cam, env, VP, 1);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    this.setCommon(this.pChunk, env);
    let n = this.drawChunks(list, 'opaque', cam, VP, 0);
    gl.disable(gl.CULL_FACE);
    n += this.drawChunks(list, 'cutout', cam, VP, 0);
    if (scene.ents) this.drawEnt(scene.ents, VP, cam, env, {});
    if (scene.figure) this.drawEnt(scene.figure, VP, cam, env, { color: scene.figureColor, unlit: true });
    if (scene.mutant) { this.drawEnt(scene.mutant, VP, cam, env, { fogMul: scene.mutantFog }); this.drawEnt(scene.mutantEyes, VP, cam, env, { unlit: true, fogMul: 0.3 }); }
    if (scene.sam) Sam.drawWorld(VP, cam, env);   // облик Сэма: модели игроков-Сэмов и снаряды
    // трещины
    if (scene.crack) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
      gl.depthMask(false);
      this.drawEnt(scene.crack, VP, cam, env, { unlit: true, fog: false });
      gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND);
    }
    if (scene.outline) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.drawEnt(scene.outline, VP, cam, env, { unlit: true, fog: false, color: [0, 0, 0, 0.55], mode: gl.LINES });
      gl.disable(gl.BLEND);
    }
    // вода (прозрачная) — от дальних к ближним
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    const P = this.pWater, u = P.u;
    this.setCommon(P, env);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, useRefl ? this.reflTex : this.atlas); gl.uniform1i(u.uRefl, 1);
    gl.uniform1f(u.uUseRefl, useRefl ? 1 : 0); gl.uniform1f(u.uWaterY, waterY);
    gl.uniform3f(u.uCamPos, cam.x, cam.y, cam.z); gl.uniform1f(u.uTime, env.time);
    gl.uniform3fv(u.uSunDir, env.sunDir); gl.uniform1f(u.uDay, env.day); gl.uniform1f(u.uUnder, env.underwater ? 1 : 0);
    gl.uniform3fv(u.uSkyTop, env.skyTop); gl.uniform3fv(u.uSkyHor, env.skyHor);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform1f(u.uCamY, cam.y);
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i], L = c.mesh.water; if (!L) continue;
      gl.uniform3f(u.uOffset, (c.cx << 4) - cam.x, -cam.y, (c.cz << 4) - cam.z);
      gl.bindVertexArray(L.vao);
      gl.drawElements(gl.TRIANGLES, L.count, gl.UNSIGNED_INT, 0);
      n += L.count;
    }
    gl.depthMask(true);
    if (scene.particles) this.drawEnt(scene.particles, VP, cam, env, {});
    gl.disable(gl.BLEND);
    if (scene.sam) Sam.drawFx(VP, cam, env);     // вспышки, дым, огонь, взрывы, гильзы
    // рука / предмет в руке
    if (scene.hand) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const Ph = m4persp(m4(), 70 * Math.PI / 180, aspect, 0.02, 10);
      const VPh = m4mul(m4(), Ph, scene.hand.model);
      gl.enable(gl.CULL_FACE);
      this.drawEnt(scene.hand.batch, VPh, cam, env, { fog: false, camY: -9999 });
      gl.disable(gl.CULL_FACE);
    }
    if (scene.samView) { gl.clear(gl.DEPTH_BUFFER_BIT); Sam.drawView(cam, env, aspect); }   // оружие с руками от первого лица
    gl.bindVertexArray(null);
    this.stats.chunks = list.length; this.stats.verts = n; this.stats.refl = useRefl;
  },
  drawEnt(batch, VP, cam, env, o) {
    if (!batch || !batch.n) return;
    const gl = this.gl, P = this.pEnt, u = P.u;
    this.setCommon(P, env);
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniform4fv(u.uColor, o.color || [1, 1, 1, 1]);
    gl.uniform1f(u.uUnlit, o.unlit ? 1 : 0);
    gl.uniform1f(u.uFogOn, o.fog === false ? 0 : 1); gl.uniform1f(u.uFogMul, o.fogMul !== undefined ? o.fogMul : 1);
    gl.uniform1f(u.uClip, o.clip ? 1 : 0); gl.uniform1f(u.uClipY, o.clip || 0);
    gl.uniform1f(u.uCamY, o.camY !== undefined ? o.camY : cam.y);
    gl.bindVertexArray(this.entVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
    gl.bufferData(gl.ARRAY_BUFFER, batch.f.subarray(0, batch.n * 9), gl.DYNAMIC_DRAW);
    gl.drawArrays(o.mode !== undefined ? o.mode : gl.TRIANGLES, 0, batch.n);
  }
};

// ---------- пакет динамической геометрии ----------
class Batch {
  constructor() { this.f = new Float32Array(9 * 4096); this.n = 0; }
  reset() { this.n = 0; return this; }
  vert(x, y, z, u, v, sky, blk, sh) {
    if ((this.n + 1) * 9 > this.f.length) { const nf = new Float32Array(this.f.length * 2); nf.set(this.f); this.f = nf; }
    const o = this.n * 9, f = this.f;
    f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = u; f[o + 4] = v; f[o + 5] = sky; f[o + 6] = blk; f[o + 7] = sh; f[o + 8] = 0;
    this.n++;
  }
  // p: 4 угла CCW, uv: [u0,v0,u1,v1] в пикселях атласа
  quad(p, uv, sky, blk, sh) {
    const S = ATLAS_SIZE;
    const c = [[uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]], [uv[0], uv[1]]];
    for (const k of [0, 1, 2, 0, 2, 3]) this.vert(p[k][0], p[k][1], p[k][2], c[k][0] / S, c[k][1] / S, sky, blk, sh);
  }
  // квад с отдельными UV и затенением на каждую вершину (гладкие меши)
  quadV(p, uv, sky, blk, sh) {
    const S = ATLAS_SIZE;
    for (const k of [0, 1, 2, 0, 2, 3]) this.vert(p[k][0], p[k][1], p[k][2], uv[k][0] / S, uv[k][1] / S, sky, blk, sh[k]);
  }
  line(a, b) { this.vert(a[0], a[1], a[2], 0, 0, 1, 1, 1); this.vert(b[0], b[1], b[2], 0, 0, 1, 1, 1); }
}
function tileRect(tile, x0 = 0, y0 = 0, x1 = 16, y1 = 16) {
  const tx = (tile % ATLAS_COLS) * TS, ty = Math.floor(tile / ATLAS_COLS) * TS;
  return [tx + x0 + 0.01, ty + y0 + 0.01, tx + x1 - 0.01, ty + y1 - 0.01];
}
// куб блока, трансформированный функцией tf(x,y,z)->[x,y,z]; локальные координаты 0..1
function batchBlock(b, id, tf, sky, blk, shadeMul = 1, frontFace = 4) {
  const d = BLK[id];
  if (d.render === R_CROSS) {
    const r = tileRect(d.tiles[0]);
    b.quad([[0, 0, 0.5], [1, 0, 0.5], [1, 1, 0.5], [0, 1, 0.5]].map(p => tf(...p)), r, sky, blk, shadeMul);
    b.quad([[1, 0, 0.5], [0, 0, 0.5], [0, 1, 0.5], [1, 1, 0.5]].map(p => tf(...p)), r, sky, blk, shadeMul);
    return;
  }
  if (d.render === R_TORCH) {
    for (const q of TORCH_Q[B.TORCH]) {
      const [u0, v0, u1, v1] = q.r;
      b.quad(q.p.map(p => tf(...p)), tileRect(TILE.torch, u0, v0, u1, v1), sky, 15 / 15, shadeMul);
    }
    return;
  }
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    let tile = d.tiles[f];
    if (d.front >= 0 && (f === frontFace || (id === B.TABLE && f === OPP[frontFace]))) tile = d.front;
    const pts = [];
    for (let c = 0; c < 4; c++) pts.push(tf(...F.corner[c].p));
    let r = tileRect(tile);
    if (d.render === R_LIQUID) r = tileRect(tile);
    b.quad(pts, r, sky, blk, FACE_SHADE[f] * shadeMul);
  }
}
// выдавленный спрайт (предметы в руке)
function batchSprite3D(b, tile, tf, sky, blk, depth = 1 / 16) {
  const t = TILES_ARR[tile];
  const tx = (tile % ATLAS_COLS) * TS, ty = Math.floor(tile / ATLAS_COLS) * TS;
  const z0 = -depth / 2, z1 = depth / 2;
  b.quad([[0, 0, z1], [1, 0, z1], [1, 1, z1], [0, 1, z1]].map(p => tf(...p)), [tx, ty, tx + 16, ty + 16], sky, blk, 1);
  b.quad([[1, 0, z0], [0, 0, z0], [0, 1, z0], [1, 1, z0]].map(p => tf(...p)), [tx + 16, ty, tx, ty + 16], sky, blk, 0.8);
  if (!t) return;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!t.alpha(x, y)) continue;
    const px0 = x / 16, px1 = (x + 1) / 16, py1 = 1 - y / 16, py0 = 1 - (y + 1) / 16;
    const r = [tx + x + 0.3, ty + y + 0.3, tx + x + 0.7, ty + y + 0.7];
    if (!t.alpha(x - 1, y)) b.quad([[px0, py0, z0], [px0, py0, z1], [px0, py1, z1], [px0, py1, z0]].map(p => tf(...p)), r, sky, blk, 0.7);
    if (!t.alpha(x + 1, y)) b.quad([[px1, py0, z1], [px1, py0, z0], [px1, py1, z0], [px1, py1, z1]].map(p => tf(...p)), r, sky, blk, 0.7);
    if (!t.alpha(x, y - 1)) b.quad([[px0, py1, z1], [px1, py1, z1], [px1, py1, z0], [px0, py1, z0]].map(p => tf(...p)), r, sky, blk, 0.95);
    if (!t.alpha(x, y + 1)) b.quad([[px0, py0, z0], [px1, py0, z0], [px1, py0, z1], [px0, py0, z1]].map(p => tf(...p)), r, sky, blk, 0.55);
  }
}
function batchBox(b, x0, y0, z0, x1, y1, z1, tile, tf, sky, blk, shadeMul = 1) {
  const r = tileRect(tile);
  const P = (x, y, z) => tf(x, y, z);
  b.quad([P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)], r, sky, blk, 0.62 * shadeMul);
  b.quad([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], r, sky, blk, 0.62 * shadeMul);
  b.quad([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], r, sky, blk, 1 * shadeMul);
  b.quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], r, sky, blk, 0.5 * shadeMul);
  b.quad([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], r, sky, blk, 0.8 * shadeMul);
  b.quad([P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0)], r, sky, blk, 0.8 * shadeMul);
}
