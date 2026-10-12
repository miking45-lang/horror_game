// ============================================================
//  Звук: всё синтезируется через WebAudio
// ============================================================
const Sfx = {
  ctx: null, on: false, vol: 0.8, musicVol: 0.6,
  nextCave: 40, caveScareT: 25, nextMusic: 90, musicPlaying: 0, windGain: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    setTimeout(() => this.loadScream(), 500); setTimeout(() => this.loadOmen(), 2500); setTimeout(() => this.loadSmile(), 3500); setTimeout(() => this.loadOmen2(), 6000); setTimeout(() => this.loadDread(), 9000); setTimeout(() => this.loadGlitch(), 11500); setTimeout(() => this.loadHunt(), 14000); setTimeout(() => this.loadOmen3(), 16500); setTimeout(() => this.loadMsg(), 19000); setTimeout(() => this.loadRun(), 20500); setTimeout(() => this.loadHell(), 22000); setTimeout(() => this.loadSmex(), 4500); setTimeout(() => this.loadCry(), 1500);
    this.master = ctx.createGain(); this.master.gain.value = this.vol;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000;
    this.master.connect(this.lp); this.lp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.gain.value = this.musicVol; this.mus.connect(this.master);
    // реверберация
    const len = ctx.sampleRate * 3.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir;
    this.revIn = ctx.createGain(); this.revIn.gain.value = 0.9;
    this.revIn.connect(this.rev); this.rev.connect(this.master);
    // шум
    const nl = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    // ветер
    const w = ctx.createBufferSource(); w.buffer = this.noise; w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380; wf.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    w.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master); w.start();
    this.windF = wf;
    // помехи (для Лешего): шипение + низкий гул
    const st = ctx.createBufferSource(); st.buffer = this.noise; st.loop = true;
    const sh = ctx.createBiquadFilter(); sh.type = 'highpass'; sh.frequency.value = 2600; this.stHP = sh;
    const sp = ctx.createBiquadFilter(); sp.type = 'peaking'; sp.frequency.value = 3200; sp.gain.value = 8;
    this.stGain = ctx.createGain(); this.stGain.gain.value = 0;
    st.connect(sh); sh.connect(sp); sp.connect(this.stGain); this.stGain.connect(this.master); st.start();
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 120;
    this.drGain = ctx.createGain(); this.drGain.gain.value = 0;
    for (const fr of [37, 37.6, 55.3]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(dl); o.start(); }
    dl.connect(this.drGain); this.drGain.connect(this.master);
    this.whOsc = ctx.createOscillator(); this.whOsc.type = 'sine'; this.whOsc.frequency.value = 6200;
    this.whGain = ctx.createGain(); this.whGain.gain.value = 0;
    this.whOsc.connect(this.whGain); this.whGain.connect(this.master); this.whOsc.start();
    this.hbT = 0;
    this.on = true;
  },
  setVol(v, m) { this.vol = v; this.musicVol = m; if (this.master) { this.master.gain.value = v; this.mus.gain.value = m; } },
  t() { return this.ctx.currentTime; },
  src(offset) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s._off = offset !== undefined ? offset : Math.random() * 1.5; return s; },
  // всплеск фильтрованного шума
  burst(t, type, f, q, dur, vol, dest, pan = 0, att = 0.006) {
    const ctx = this.ctx, s = this.src(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g);
    let out = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(dest || this.sfx);
    s.start(t, s._off, dur + 0.05);
    return fl;
  },
  tone(t, type, f0, f1, dur, vol, dest, attack = 0.005) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
    return o;
  },
  // мягкие, «круглые» звуки: фильтрованный шум с плавной атакой + тихий тональный «тук»
  material(m, vol, long, pan = 0) {
    if (!this.on) return;
    const t = this.t(), r = () => 0.92 + Math.random() * 0.16;
    const L = long ? 1 : 0;
    const B = (dt, type, f, q, dur, v, att = 0.012) => this.burst(t + dt, type, f * r(), q, dur, vol * v, null, pan, att);
    const T = (dt, type, f0, f1, dur, v, att = 0.01) => this.tone(t + dt, type, f0 * r(), f1, dur, vol * v, null, att);
    switch (m) {
      case 'grass':
        B(0, 'lowpass', 2300, 0.5, 0.11 + 0.06 * L, 0.65, 0.02); B(0.045, 'bandpass', 1500, 0.6, 0.08, 0.4, 0.02);
        if (L) B(0.1, 'lowpass', 1800, 0.5, 0.1, 0.35, 0.02); break;
      case 'gravel':
        for (let i = 0; i < 2 + 2 * L; i++) B(i * 0.034, 'lowpass', 1500 - i * 80, 0.7, 0.07, 0.55 - i * 0.05, 0.01);
        T(0, 'sine', 120, 85, 0.08, 0.3); break;
      case 'sand': B(0, 'lowpass', 2800, 0.4, 0.16 + 0.1 * L, 0.55, 0.025); B(0.05, 'bandpass', 1900, 0.5, 0.12, 0.3, 0.03); break;
      case 'snow': B(0, 'lowpass', 2200, 0.5, 0.1 + 0.06 * L, 0.5, 0.02); B(0.05, 'lowpass', 1700, 0.6, 0.09, 0.4, 0.02); break;
      case 'wood':
        T(0, 'sine', 240, 150, 0.11 + 0.05 * L, 0.7); T(0.0, 'triangle', 480, 300, 0.06, 0.18);
        B(0, 'bandpass', 650, 1.4, 0.08, 0.55, 0.008); if (L) { T(0.07, 'sine', 200, 130, 0.1, 0.4); B(0.07, 'bandpass', 560, 1.2, 0.07, 0.3); } break;
      case 'glass': {
        const base = [1568, 2093, 2637];
        base.forEach((f, i) => T(i * 0.012, 'sine', f, f * 0.992, 0.2 + 0.18 * L, 0.2 - i * 0.04, 0.004));
        B(0, 'lowpass', 3500, 0.5, 0.06, 0.25, 0.006); break; }
      case 'cloth': B(0, 'lowpass', 800, 0.5, 0.14, 0.8, 0.02); break;
      case 'metal':
        T(0, 'sine', 520, 505, 0.2 + 0.2 * L, 0.35, 0.003); T(0, 'sine', 1430, 1400, 0.14 + 0.1 * L, 0.2, 0.003); T(0, 'sine', 90, 60, 0.1, 0.5, 0.004);
        B(0, 'highpass', 2500, 0.8, 0.04, 0.3, 0.003); break;
      default:   // камень и прочее
        T(0, 'sine', 190, 105, 0.1 + 0.06 * L, 0.75, 0.006);
        B(0, 'lowpass', 1300, 0.9, 0.06 + 0.03 * L, 0.7, 0.006);
        if (L) { T(0.05, 'sine', 150, 90, 0.1, 0.4); B(0.05, 'lowpass', 1000, 0.8, 0.07, 0.35, 0.01); B(0.1, 'lowpass', 1600, 0.6, 0.05, 0.2, 0.01); }
    }
  },
  step(m) { this.material(m, 0.14, false); },
  dig(m) { this.material(m, 0.17, false); },
  breakB(m) { this.material(m, 0.36, true); },
  place(m) { this.material(m, 0.35, true); },
  pop() { if (!this.on) return; const t = this.t(); this.tone(t, 'sine', 420 + Math.random() * 100, 1100, 0.07, 0.12); },
  click() { if (!this.on) return; const t = this.t(); this.tone(t, 'square', 900, 700, 0.035, 0.05); this.burst(t, 'highpass', 3000, 1, 0.02, 0.05); },
  hurt() {
    if (!this.on) return; const t = this.t(), ctx = this.ctx;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.25);
    this.tone(t, 'sine', 90, 50, 0.12, 0.3);
  },
  splash(v = 0.3) {
    if (!this.on) return; const t = this.t();
    const f = this.burst(t, 'lowpass', 1600, 0.7, 0.5, v); f.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    this.burst(t + 0.05, 'bandpass', 3000, 1, 0.25, v * 0.4);
  },
  fizz() { if (!this.on) return; const t = this.t(); this.burst(t, 'highpass', 3500, 0.7, 0.4, 0.15); },
  lever(on) {
    if (!this.on || !this.ctx) return; const t = this.t();
    this.tone(t, 'square', on ? 260 : 190, on ? 150 : 110, 0.05, 0.16, null, 0.002);
    this.tone(t, 'sine', on ? 140 : 105, 70, 0.1, 0.4, null, 0.003);
    this.burst(t, 'bandpass', on ? 2600 : 1900, 1.5, 0.04, 0.22, null, 0, 0.002);
  },
  button(wood, on) {
    if (!this.on || !this.ctx) return; const t = this.t(), f = on ? 1 : 0.8;
    if (wood) { this.tone(t, 'sine', 330 * f, 200 * f, 0.07, 0.35, null, 0.002); this.burst(t, 'bandpass', 900, 1.5, 0.05, 0.3, null, 0, 0.002); }
    else { this.tone(t, 'square', 1500 * f, 1100 * f, 0.03, 0.09, null, 0.001); this.tone(t, 'sine', 160 * f, 90, 0.07, 0.3, null, 0.002); this.burst(t, 'highpass', 2800, 0.8, 0.03, 0.2, null, 0, 0.001); }
  },
  // ---------- двери ----------
  // стук в дверь: дерево — глухой, железо — звонкий металлический. Возвращает длительность (сек)
  knock(kind, vol = 1, pan = 0) {
    const times = kind === 'iron' ? [0, 0.36, 0.7] : [0, 0.46, 0.9];
    const total = times[times.length - 1] + (kind === 'iron' ? 1.2 : 0.5);
    if (!this.on || !this.ctx) return total;
    const ctx = this.ctx, t0 = this.t() + 0.05, bus = ctx.createGain();
    bus.gain.value = vol;
    if (kind === 'iron') this.route(bus, pan, 0.6, 0.7);
    else { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; bus.connect(lp); this.route(lp, pan, 0.3, 0.9); }
    times.forEach((dt, i) => {
      const t = t0 + dt + (Math.random() - 0.5) * 0.03, v = 1 - i * 0.04;
      if (kind === 'iron') {
        const f = 380 * (0.95 + Math.random() * 0.1);
        this.tone(t, 'sine', f, f * 0.99, 0.7, 0.34 * v, bus, 0.002);
        this.tone(t, 'sine', f * 2.76, f * 2.74, 0.45, 0.2 * v, bus, 0.002);
        this.tone(t, 'sine', f * 5.4, f * 5.35, 0.28, 0.1 * v, bus, 0.002);
        this.tone(t, 'square', 150, 80, 0.07, 0.25 * v, bus, 0.002);
        this.burst(t, 'highpass', 2200, 0.8, 0.05, 0.4 * v, bus, 0, 0.002);
      } else {
        this.tone(t, 'sine', 108, 58, 0.22, 1.0 * v, bus, 0.004);
        this.tone(t, 'triangle', 230, 115, 0.09, 0.4 * v, bus, 0.004);
        this.burst(t, 'lowpass', 320, 0.8, 0.1, 0.7 * v, bus, 0, 0.004);
      }
    });
    return total;
  },
  door(mat, open) {
    if (!this.on || !this.ctx) return;
    const t = this.t();
    if (mat === 'iron') {
      this.tone(t, 'sine', 640, 600, 0.3, 0.16, null, 0.003); this.tone(t, 'sine', 1640, 1580, 0.22, 0.09, null, 0.003);
      this.burst(t, 'highpass', 2800, 0.7, 0.06, 0.18, null, 0, 0.003);
      this.tone(t + (open ? 0.05 : 0), 'sine', 85, 52, 0.18, 0.45, null, 0.005);
      const f = this.burst(t + 0.04, 'bandpass', 900, 5, 0.3, 0.08, null, 0, 0.05); f.frequency.exponentialRampToValueAtTime(open ? 1500 : 600, t + 0.34);
    } else {
      const f = this.burst(t, 'bandpass', open ? 380 : 520, 4, 0.28, 0.12, null, 0, 0.04); f.frequency.exponentialRampToValueAtTime(open ? 560 : 330, t + 0.26);
      this.tone(t + (open ? 0.02 : 0.2), 'sine', 130, 70, 0.14, 0.5, null, 0.004);
      this.burst(t + (open ? 0.02 : 0.2), 'lowpass', 480, 0.8, 0.09, 0.4, null, 0, 0.004);
    }
  },
  // ---------------- хоррор ----------------
  swell(node, t, peak, att, hold, rel) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.setValueAtTime(peak, t + att + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + att + hold + rel);
    node.connect(g); return g;
  },
  route(g, pan, wet = 0.8, dry = 0.4) {
    const ctx = this.ctx, p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p);
    const dg = ctx.createGain(); dg.gain.value = dry; p.connect(dg); dg.connect(this.master);
    const wg = ctx.createGain(); wg.gain.value = wet; p.connect(wg); wg.connect(this.revIn);
  },
  cave(kind) {
    if (!this.on) return;
    const ctx = this.ctx, t = this.t() + 0.05, pan = Math.random() * 1.6 - 0.8;
    const k = kind !== undefined ? kind : Math.floor(Math.random() * 9);
    if (k === 0) { // гул
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170;
      for (const fr of [48, 48.7, 72.3]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 9); }
      this.route(this.swell(f, t, 0.22, 3, 1.5, 4), pan, 0.9, 0.5);
    } else if (k === 1) { // стон
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(105, t + 4.5);
      lfo.frequency.value = 4.2; lg.gain.value = 5; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.5; o.connect(f);
      o.start(t); lfo.start(t); o.stop(t + 5.5); lfo.stop(t + 5.5);
      this.route(this.swell(f, t, 0.14, 1.8, 0.8, 2.6), pan, 1.0, 0.25);
    } else if (k === 2) { // дыхание за спиной
      for (let i = 0; i < 2; i++) {
        const s = this.src(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = i ? 520 : 760; f.Q.value = 1.2;
        s.connect(f); s.start(t + i * 1.7, s._off, 2);
        this.route(this.swell(f, t + i * 1.7, 0.09, 0.7, 0.2, 0.9), pan * 0.4, 0.3, 0.8);
      }
    } else if (k === 3) { // скрежет
      const s = this.src(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 12;
      f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(980, t + 2.4);
      s.connect(f); s.start(t, s._off, 2.8);
      this.route(this.swell(f, t, 0.5, 1.2, 0.3, 1.2), pan, 0.9, 0.35);
    } else if (k === 4) { // стук
      const n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const tt = t + i * (0.55 + Math.random() * 0.25), o = ctx.createOscillator(), f = ctx.createBiquadFilter();
        o.type = 'sine'; o.frequency.setValueAtTime(95, tt); o.frequency.exponentialRampToValueAtTime(45, tt + 0.2);
        f.type = 'lowpass'; f.frequency.value = 500; o.connect(f); o.start(tt); o.stop(tt + 0.3);
        this.route(this.swell(f, tt, 0.5, 0.005, 0.02, 0.22), pan, 1.0, 0.3);
      }
    } else if (k === 5) { // шёпот
      for (let i = 0; i < 7; i++) {
        const tt = t + i * 0.16 + Math.random() * 0.1, s = this.src(), f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 2400; f.Q.value = 6;
        s.connect(f); s.start(tt, s._off, 0.3);
        this.route(this.swell(f, tt, 0.16, 0.04, 0.04, 0.12), pan, 0.7, 0.5);
      }
    } else if (k === 6) { // диссонанс
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      for (const fr of [233, 247, 349.2]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr * (0.5 + Math.round(Math.random())); o.connect(f); o.start(t); o.stop(t + 8); }
      this.route(this.swell(f, t, 0.06, 3.5, 0.5, 3.5), pan, 1.0, 0.2);
    } else if (k === 7) { // обвал вдали
      const s = this.src(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110;
      s.connect(f); s.start(t, 0, 5);
      this.route(this.swell(f, t, 0.9, 0.4, 1.2, 2.6), pan, 0.8, 0.6);
    } else { // шаги позади
      this.stepsBehind();
    }
  },
  // пещерные страшилки: длинные низкие стоны, удары, металл с эхом, далёкие «крики»
  caveScary() {
    if (!this.on) return 0;
    const ctx = this.ctx, t = this.t() + 0.05, pan = Math.random() * 1.6 - 0.8;
    const k = Math.floor(Math.random() * 7);
    if (k === 0) { // глубокий удар, затем гул
      this.tone(t, 'sine', 62, 28, 1.6, 0.5, null, 0.01);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      for (const fr of [38, 40.5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 7); }
      this.route(this.swell(f, t + 0.1, 0.2, 0.6, 1.2, 4.5), pan, 1.0, 0.4);
    } else if (k === 1) { // низкий протяжный «вопль» с дрожью
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = o2.type = 'sawtooth'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(260, t + 2.2); o.frequency.exponentialRampToValueAtTime(90, t + 5.5);
      o2.frequency.setValueAtTime(133, t); o2.frequency.exponentialRampToValueAtTime(268, t + 2.2); o2.frequency.exponentialRampToValueAtTime(93, t + 5.5);
      lfo.frequency.value = 6.5; lg.gain.value = 7; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2.2; o.connect(f); o2.connect(f);
      for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + 6.2); }
      this.route(this.swell(f, t, 0.1, 1.6, 1.5, 3.0), pan, 1.0, 0.2);
    } else if (k === 2) { // далёкий металлический лязг с эхом
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.9, v = 0.18 / (1 + i * 1.4);
        for (const fr of [410, 770, 1330]) this.tone(tt, 'sine', fr * (1 + Math.random() * 0.01), fr * 0.99, 1.4, v * 0.5, null, 0.004);
        this.burst(tt, 'highpass', 2200, 0.8, 0.05, v, null, pan, 0.002);
      }
    } else if (k === 3) { // что-то тащится по камню
      const s = this.src(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(180, t); f.frequency.linearRampToValueAtTime(330, t + 3.5);
      s.connect(f); s.start(t, s._off, 4.2);
      const lg = ctx.createGain(); lg.gain.value = 0; const am = ctx.createOscillator(), amg = ctx.createGain(); am.frequency.value = 3.1; amg.gain.value = 0.5; am.connect(amg); amg.connect(lg.gain); am.start(t); am.stop(t + 4.2);
      f.connect(lg); this.route(this.swell(lg, t, 0.55, 0.8, 1.8, 1.4), pan, 0.9, 0.35);
    } else if (k === 4) { // плач вдали: тонкий переливающийся
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(390, t + 1.6); o.frequency.exponentialRampToValueAtTime(610, t + 3.4); o.frequency.exponentialRampToValueAtTime(300, t + 5.5);
      lfo.frequency.value = 5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 1500; o.connect(f);
      o.start(t); lfo.start(t); o.stop(t + 6); lfo.stop(t + 6);
      this.route(this.swell(f, t, 0.05, 1.2, 2, 2.5), pan, 1.0, 0.1);
    } else if (k === 5) { // быстрые шорохи по камню над головой
      const n = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) { const tt = t + i * (0.07 + Math.random() * 0.12); this.burst(tt, 'bandpass', 1800 + Math.random() * 2500, 4, 0.05, 0.12, null, pan, 0.003); }
      this.tone(t + n * 0.14, 'sine', 70, 40, 0.5, 0.35, null, 0.01);
    } else { // нарастающий диссонанс, обрывается тишиной
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
      for (const fr of [155.6, 164.8, 233]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 6); }
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 4.5); g.gain.setValueAtTime(0.14, t + 4.5); g.gain.linearRampToValueAtTime(0, t + 4.58);
      f.connect(g); this.route(g, pan * 0.5, 0.8, 0.4);
    }
    return k;
  },
  stepsBehind() {
    if (!this.on) return;
    const ctx = this.ctx, t = this.t() + 0.1, pan = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.4);
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.52, v = 0.13 * (1 - i / (n + 2));
      for (let k = 0; k < 3; k++) {
        const s = this.src(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = 800 + Math.random() * 300; f.Q.value = 1;
        g.gain.setValueAtTime(0.0001, tt + k * 0.03); g.gain.exponentialRampToValueAtTime(v, tt + k * 0.03 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, tt + k * 0.03 + 0.07);
        s.connect(f); f.connect(g); s.start(tt + k * 0.03, s._off, 0.1);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.connect(lp);
        this.route(lp, pan, 0.25, 0.9);
      }
    }
  },
  vanish() {
    if (!this.on) return;
    const ctx = this.ctx, t = this.t();
    const s = this.src(), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.6);
    s.connect(f); s.start(t, s._off, 0.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.55); g.gain.linearRampToValueAtTime(0, t + 0.62);
    f.connect(g); this.route(g, 0, 0.9, 0.4);
    this.tone(t + 0.58, 'sine', 70, 35, 1.2, 0.35, this.revIn);
  },
  // ---------------- помехи ----------------
  setStatic(k, dt) {
    if (!this.on) return;
    const t = this.t();
    // шипение: громче и «плотнее» с каждым шагом
    const crackle = Math.random() < 0.08 + k * 0.2 ? 1.6 + k : 0.75 + Math.random() * 0.5;
    this.stGain.gain.setTargetAtTime(k > 0.005 ? (0.015 + Math.pow(k, 1.4) * 0.5) * crackle : 0, t, 0.02);
    this.stHP.frequency.setTargetAtTime(2600 - k * 2100, t, 0.1);
    // низкий гул и звон в ушах
    this.drGain.gain.setTargetAtTime(Math.pow(k, 1.2) * 0.38, t, 0.15);
    this.whGain.gain.setTargetAtTime(k > 0.5 ? (k - 0.5) * 0.05 : 0, t, 0.2);
    this.whOsc.frequency.setTargetAtTime(6200 + k * 2400, t, 0.3);
    // сердцебиение учащается
    if (k > 0.2) {
      this.hbT -= dt;
      if (this.hbT <= 0) {
        this.hbT = 60 / (50 + k * 110);
        const v = 0.1 + k * 0.5;
        this.tone(t, 'sine', 62, 38, 0.16, v); this.tone(t + 0.19, 'sine', 55, 34, 0.14, v * 0.7);
      }
    } else this.hbT = 0.3;
  },
  glimpse() {
    if (!this.on) return;
    const t = this.t(), s = this.src(), f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    s.connect(f); s.start(t, s._off, 0.6);
    this.route(this.swell(f, t, 0.07, 0.12, 0.05, 0.3), Math.random() * 1.2 - 0.6, 0.8, 0.3);
  },
  flick() {
    if (!this.on) return;
    const t = this.t();
    this.burst(t, 'highpass', 2500, 0.8, 0.03, 0.035);
    this.tone(t, 'square', 110, 90, 0.04, 0.02);
  },
  staticBurst() {
    if (!this.on) return;
    const t = this.t();
    const f = this.burst(t, 'highpass', 900, 0.7, 0.55, 0.7); f.frequency.exponentialRampToValueAtTime(5000, t + 0.5);
    this.burst(t, 'bandpass', 2400, 2, 0.45, 0.5);
    this.tone(t, 'sawtooth', 180, 40, 0.6, 0.25);
    this.tone(t + 0.02, 'square', 1250, 900, 0.35, 0.06);
  },
  tv(on) {
    if (!this.on || !this.ctx) return;
    const t = this.t();
    this.tone(t, 'square', 180, 120, 0.05, 0.25);
    if (on) { this.tone(t + 0.04, 'sine', 800, 15000, 0.35, 0.05); this.tone(t + 0.04, 'triangle', 60, 40, 0.25, 0.18); }
    else this.tone(t + 0.02, 'sine', 9000, 200, 0.2, 0.08);
  },
  // загруженный файл: проигрывается один раз, возвращает длительность (сек)
  scream() {
    if (!this.on || !this.ctx || typeof SCREAM_B64 === 'undefined') return 2.0;
    const ctx = this.ctx;
    if (this.screamBuf) {
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.screamBuf; g.gain.value = 1;
      s.connect(g); g.connect(this.master); s.start();
      return this.screamBuf.duration;
    }
    this.loadScream();
    return 2.0;
  },
  scream2() {
    if (!this.on || !this.ctx || typeof SCREAM2_B64 === 'undefined') return 3.0;
    if (this.scream2Buf) {
      const ctx = this.ctx, s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.scream2Buf; g.gain.value = 1;
      s.connect(g); g.connect(this.master); s.start();
      return this.scream2Buf.duration;
    }
    this.loadScream();
    return 3.0;
  },
  loadScream() {
    if (!this.scream2Buf && !this._s2 && this.ctx && typeof SCREAM2_B64 !== 'undefined') {
      this._s2 = true;
      try {
        const bin = atob(SCREAM2_B64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(u.buffer, b => { this.scream2Buf = b; }, () => { });
      } catch (e) { }
    }
    if (this.screamBuf || this._sl || !this.ctx || typeof SCREAM_B64 === 'undefined') return;
    this._sl = true;
    try {
      const bin = atob(SCREAM_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.screamBuf = b; }, () => { });
    } catch (e) { }
  },
  smile() {
    if (!this.on || !this.ctx || typeof SMILE_B64 === 'undefined') return 2.5;
    if (this.smileBuf) {
      const ctx = this.ctx, s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = this.smileBuf; g.gain.value = 1;
      s.connect(g); g.connect(this.master); s.start();
      return this.smileBuf.duration;
    }
    this.loadSmile();
    return 2.5;
  },
  loadSmile() {
    if (this.smileBuf || this._sm || !this.ctx || typeof SMILE_B64 === 'undefined') return;
    this._sm = true;
    try {
      const bin = atob(SMILE_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.smileBuf = b; }, () => { });
    } catch (e) { }
  },
  // «долгая ночь»: длинный трек, пока он играет, мир остаётся тёмной ночью. Возвращает длительность или 0, если ещё не загружен
  dreadReady() { return !!(this.on && this.ctx && this.dreadBuf); },
  dread() {
    if (!this.dreadReady()) return 0;
    const ctx = this.ctx, t = ctx.currentTime, d = this.dreadBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.dreadBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.25);
    g.gain.setValueAtTime(1.0, t + d - 4); g.gain.linearRampToValueAtTime(0, t + d - 0.1);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.eventStart(t, d);
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 90;
    return d;
  },
  loadDread() {
    if (this.dreadBuf || this._dr || !this.ctx || typeof DREAD_B64 === 'undefined') return;
    this._dr = true;
    try {
      const bin = atob(DREAD_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.dreadBuf = b; }, () => { });
    } catch (e) { }
  },
  // «охота»: длинный трек, пока он играет, существо идёт за игроком
  huntReady() { return !!(this.on && this.ctx && this.huntBuf); },
  hunt() {
    if (!this.huntReady()) return 0;
    const ctx = this.ctx, t = ctx.currentTime, d = this.huntBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.huntBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.6);
    g.gain.setValueAtTime(1.0, t + d - 3); g.gain.linearRampToValueAtTime(0, t + d - 0.05);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.eventStart(t, d);
    this._hunt = { src, g };
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 90;
    return d;
  },
  huntStop(fade) {
    const h = this._hunt; if (!h || !this.ctx) return; this._hunt = null;
    const t = this.ctx.currentTime; this.eventEnd = Math.min(this.eventEnd, t + (fade || 0.3));
    try { h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(Math.max(0.0001, h.g.gain.value), t); h.g.gain.linearRampToValueAtTime(0, t + (fade || 0.3)); h.src.stop(t + (fade || 0.3) + 0.05); } catch (e) { }
  },
  loadHunt() {
    if (this.huntBuf || this._ht || !this.ctx || typeof HUNT_B64 === 'undefined') return;
    this._ht = true;
    try {
      const bin = atob(HUNT_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.huntBuf = b; }, () => { });
    } catch (e) { }
  },
  // «сбой мира»: трек, под который деревья надстраиваются друг на друга, а небо красное
  glitchReady() { return !!(this.on && this.ctx && this.glitchBuf); },
  glitch() {
    if (!this.glitchReady()) return 0;
    const ctx = this.ctx, t = ctx.currentTime, d = this.glitchBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.glitchBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.3);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.eventStart(t, d);
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 60;
    return d;
  },
  loadGlitch() {
    if (this.glitchBuf || this._gl || !this.ctx || typeof GLITCH_B64 === 'undefined') return;
    this._gl = true;
    try {
      const bin = atob(GLITCH_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.glitchBuf = b; }, () => { });
    } catch (e) { }
  },
  // короткий звук «smex»: иногда звучит днём или ночью (после первой ночной встречи)
  smexReady() { return !!(this.on && this.ctx && this.smexBuf); },
  smex() {
    if (!this.smexReady()) return 0;
    const ctx = this.ctx, t = ctx.currentTime + 0.05, src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
    src.buffer = this.smexBuf; g.gain.value = 1.0; p.pan.value = Math.random() * 1.2 - 0.6;
    src.connect(g); g.connect(p); p.connect(this.master); src.start(t);
    return this.smexBuf.duration;
  },
  loadSmex() {
    if (this.smexBuf || this._sx || !this.ctx || typeof SMEX_B64 === 'undefined') return;
    this._sx = true;
    try {
      const bin = atob(SMEX_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.smexBuf = b; }, () => { });
    } catch (e) { }
  },
  // звуки существа (NumPad 1, NumPad 2 — когда владелец в облике существа); vol и pan — по расстоянию и направлению
  cryBufs: [], CRY_SRC: ['CRY_B64', 'CRY2_B64', 'CRY3_B64'],
  cryReady(k = 0) { return !!(this.on && this.ctx && this.cryBufs[k]); },
  cry(k = 0, vol = 1, pan = 0) {
    if (!this.cryReady(k)) return 0;
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(), buf = this.cryBufs[k];
    src.buffer = buf; g.gain.value = vol; p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g); g.connect(p); p.connect(this.master); src.start(ctx.currentTime + 0.02);
    return buf.duration;
  },
  loadCry() {
    if (this._cr || !this.ctx) return;
    this._cr = true;
    this.CRY_SRC.forEach((name, k) => {
      try {
        const all = { CRY_B64: typeof CRY_B64 !== 'undefined' ? CRY_B64 : null, CRY2_B64: typeof CRY2_B64 !== 'undefined' ? CRY2_B64 : null, CRY3_B64: typeof CRY3_B64 !== 'undefined' ? CRY3_B64 : null };
        const b64 = all[name];
        if (!b64) return;
        const bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(u.buffer, b => { this.cryBufs[k] = b; }, () => { });
      } catch (e) { }
    });
  },
  // ночной «HELP ME HELL»: помехи нарастают, с 14-й секунды — чёрный экран до конца трека
  hellReady() { return !!(this.on && this.ctx && this.hellBuf); },
  hell() {
    if (!this.hellReady()) return null;
    const ctx = this.ctx, t = ctx.currentTime + 0.1, d = this.hellBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.hellBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.5);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.eventStart(t, d);
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 120;
    return { t0: t, dur: d };
  },
  loadHell() {
    if (this.hellBuf || this._hl || !this.ctx || typeof HELL_B64 === 'undefined') return;
    this._hl = true;
    try {
      const bin = atob(HELL_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.hellBuf = b; }, () => { });
    } catch (e) { }
  },
  // дневной «RUN RUN»: помехи растут до конца трека, затем скример
  runReady() { return !!(this.on && this.ctx && this.runBuf); },
  run() {
    if (!this.runReady()) return 0;
    const ctx = this.ctx, t = ctx.currentTime + 0.1, d = this.runBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.runBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.8);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.eventStart(t, d);
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 120;
    return d + 0.1;
  },
  loadRun() {
    if (this.runBuf || this._rn || !this.ctx || typeof RUN_B64 === 'undefined') return;
    this._rn = true;
    try {
      const bin = atob(RUN_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.runBuf = b; }, () => { });
    } catch (e) { }
  },
  // трек «Message»: в тайге ночью (шанс 40% при очередной музыкальной паузе) и изредка среди обычной фоновой музыки
  msgReady() { return !!(this.on && this.ctx && this.msgBuf); },
  playMsg() {
    if (this.eventPlaying()) return 0;               // музыка событий главнее
    if (!this.msgReady()) return 0;
    const ctx = this.ctx, t = ctx.currentTime + 0.2, d = this.msgBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.msgBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 3);
    g.gain.setValueAtTime(0.9, t + d - 5); g.gain.linearRampToValueAtTime(0, t + d - 0.1);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.regEnc(src, g);
    return d;
  },
  loadMsg() {
    if (this.msgBuf || this._ms || !this.ctx || typeof MSG_B64 === 'undefined') return;
    this._ms = true;
    try {
      const bin = atob(MSG_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.msgBuf = b; }, () => { });
    } catch (e) { }
  },
  // третий предвестник «Dead Hill»: существо настроено серьёзно — готово напугать, а не просто наблюдать
  omen3Ready() { return !!(this.on && this.ctx && this.omen3Buf); },
  omen3Playing() { return !!(this.ctx && this.omen3End && this.ctx.currentTime < this.omen3End); },
  omen3() {
    if (this.eventPlaying()) return false;               // музыка событий главнее
    if (!this.omen3Ready() || this.omen3Playing() || this.omen2Playing()) return false;
    const ctx = this.ctx, t = ctx.currentTime, d = this.omen3Buf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.omen3Buf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.95, t + 4);
    g.gain.setValueAtTime(0.95, t + d - 7); g.gain.linearRampToValueAtTime(0, t + d - 0.2);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.regEnc(src, g);
    this.omen3End = t + d;
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 60;
    return true;
  },
  loadOmen3() {
    if (this.omen3Buf || this._o3 || !this.ctx || typeof OMEN3_B64 === 'undefined') return;
    this._o3 = true;
    try {
      const bin = atob(OMEN3_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.omen3Buf = b; }, () => { });
    } catch (e) { }
  },
  // второй предвестник: звучит перед каждой следующей встречей (после самой первой)
  omen2Ready() { return !!(this.on && this.ctx && this.omen2Buf); },
  omen2Playing() { return !!(this.ctx && this.omen2End && this.ctx.currentTime < this.omen2End); },
  omen2() {
    if (this.eventPlaying()) return false;               // музыка событий главнее
    if (!this.omen2Ready() || this.omen2Playing() || this.omen3Playing()) return false;
    const ctx = this.ctx, t = ctx.currentTime, d = this.omen2Buf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.omen2Buf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.95, t + 5);
    g.gain.setValueAtTime(0.95, t + d - 7); g.gain.linearRampToValueAtTime(0, t + d - 0.2);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.regEnc(src, g);
    this.omen2End = t + d;
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 60;
    return true;
  },
  loadOmen2() {
    if (this.omen2Buf || this._o2 || !this.ctx || typeof OMEN2_B64 === 'undefined') return;
    this._o2 = true;
    try {
      const bin = atob(OMEN2_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.omen2Buf = b; }, () => { });
    } catch (e) { }
  },
  // редкая музыка-предвестник перед появлением существа
  omenReady() { return !!(this.on && this.ctx && this.omenBuf); },
  omen() {
    if (this.eventPlaying()) return false;               // музыка событий главнее
    if (!this.omenReady()) return false;
    const ctx = this.ctx, t = ctx.currentTime, d = this.omenBuf.duration;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this.omenBuf;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.1, t + 4);
    g.gain.setValueAtTime(1.1, t + d - 5); g.gain.linearRampToValueAtTime(0, t + d - 0.2);
    src.connect(g); g.connect(this.mus); src.start(t);
    this.regEnc(src, g);
    this.nextMusic = Math.max(this.nextMusic, 0) + d + 60;   // обычная музыка не накладывается
    return true;
  },
  loadOmen() {
    if (this.omenBuf || this._ol || !this.ctx || typeof OMEN_B64 === 'undefined') return;
    this._ol = true;
    try {
      const bin = atob(OMEN_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.ctx.decodeAudioData(u.buffer, b => { this.omenBuf = b; }, () => { });
    } catch (e) { }
  },
  sting() {
    if (!this.on) return;
    const t = this.t() + 0.02;
    [55, 58.3, 82.4, 87.3, 116.5].forEach((f, i) => this.note(t + i * 0.012, f, 0.16, 5));
    const s = this.src(), bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9;
    bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 1.6);
    s.connect(bp); s.start(t, s._off, 2);
    this.route(this.swell(bp, t, 0.35, 0.08, 0.4, 1.2), 0, 0.8, 0.5);
  },
  // ---------------- музыка ----------------
  note(t, f, v, dur = 3.5) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 1], [2, 0.32], [3, 0.12], [4.02, 0.05]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m; og.gain.value = a;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    });
    const pb = this._pb;
    lp.connect(g); g.connect(pb ? pb[0] : this.mus);
    const w = ctx.createGain(); w.gain.value = 0.6; g.connect(w); w.connect(pb ? pb[1] : this.revIn);
  },
  playPiece() {
    if (!this.on || this.eventPlaying()) return 0;
    const pg = this.ctx.createGain(), pr = this.ctx.createGain(); pg.connect(this.mus); pr.connect(this.revIn);
    this.pieceBus = [pg, pr]; this._pb = this.pieceBus;
    const scales = [[0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 2, 5, 7, 9]];
    const sc = scales[Math.floor(Math.random() * scales.length)];
    const root = [146.83, 130.81, 164.81, 110][Math.floor(Math.random() * 4)];
    const fr = (deg) => root * Math.pow(2, (sc[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);
    let t = this.t() + 0.5, deg = 5 + Math.floor(Math.random() * 3);
    const len = 22 + Math.floor(Math.random() * 18);
    for (let i = 0; i < len; i++) {
      if (i % 6 === 0) { this.note(t, fr(0) / 2, 0.08, 6); if (Math.random() < 0.5) this.note(t, fr(2) / 2, 0.05, 6); }
      if (Math.random() < 0.82) this.note(t, fr(deg), 0.07 + Math.random() * 0.04, 3.5);
      if (Math.random() < 0.2) this.note(t + 0.02, fr(deg - 2), 0.04, 3.5);
      deg += Math.floor(Math.random() * 5) - 2; deg = clamp(deg, 2, 10);
      t += [0.7, 1.05, 1.4, 1.4, 2.1][Math.floor(Math.random() * 5)];
    }
    this._pb = null;
    return t - this.t() + 6;
  },
  // ---- приоритет музыки: треки событий главнее музыки встреч и фоновой музыки ----
  eventEnd: 0, encTracks: [],
  eventPlaying() { return !!(this.ctx && this.ctx.currentTime < this.eventEnd); },
  regEnc(src, g) { this.encTracks.push({ src, g }); src.onended = () => { this.encTracks = this.encTracks.filter(e => e.src !== src); }; },
  // трек события стартует: всё остальное плавно глушим и останавливаем
  eventStart(t, d) {
    this.eventEnd = Math.max(this.eventEnd, t + d);
    const now = this.ctx.currentTime, f = 1.2;
    for (const e of this.encTracks) {
      try { e.g.gain.cancelScheduledValues(now); e.g.gain.setValueAtTime(Math.max(0.0001, e.g.gain.value), now); e.g.gain.linearRampToValueAtTime(0, now + f); e.src.stop(now + f + 0.05); } catch (err) { }
    }
    this.encTracks = [];
    this.omenEnd = this.omen2End = this.omen3End = 0;
    if (this.pieceBus) { const pb = this.pieceBus; try { for (const n of pb) { n.gain.cancelScheduledValues(now); n.gain.setValueAtTime(n.gain.value, now); n.gain.linearRampToValueAtTime(0, now + f); } } catch (err) { } this.pieceBus = null; }
    this.nextMusic = Math.max(this.nextMusic, d + 30);
  },
  // вызывается каждый кадр
  update(dt, st) {
    if (!this.on) return;
    const t = this.t();
    this.lp.frequency.setTargetAtTime(st.underwater ? 520 : 20000, t, 0.08);
    const wind = st.paused ? 0 : clamp(st.skyLight - 0.4, 0, 1) * (0.012 + clamp((st.y - 70) / 50, 0, 1) * 0.05) * (st.night ? 1.4 : 1);
    this.windGain.gain.setTargetAtTime(wind, t, 1.5);
    if (st.paused) return;
    // настоящая пещера: нет неба над головой и мы под землёй
    if (st.skyLight < 0.2 && st.y < 60) {
      this.caveScareT -= dt;
      if (this.caveScareT <= 0) {
        this.caveScareT = 22 + Math.random() * 50;
        this.caveScary();
        if (Math.random() < 0.18 && typeof Ents !== 'undefined' && Game.settings.mutant) Ents.caveBlip = 1.4 + Math.random() * 1.6;   // редкие слабые помехи
      }
    } else this.caveScareT = Math.max(this.caveScareT, 12);
    this.nextCave -= dt;
    if (this.nextCave <= 0) {
      const dark = st.skyLight < 0.4 || st.night;
      if (dark || Math.random() < 0.25) this.cave();
      this.nextCave = dark ? 30 + Math.random() * 55 : 120 + Math.random() * 160;
    }
    // «Message» — только в тайге и только вечером, перед наступлением ночи: один бросок 40% за вечер
    if (st.taiga && st.evening && this.msgRolled !== st.dayCount && !this.eventPlaying()) {
      this.msgRolled = st.dayCount;
      const busy = this.omen2Playing() || this.omen3Playing() || !!this._hunt;
      if (!busy && this.msgReady() && Math.random() < 0.4) { const d = this.playMsg(); if (d) this.nextMusic = Math.max(this.nextMusic, d + 60); }
    }
    this.nextMusic -= dt;
    if (this.nextMusic <= 0 && this.eventPlaying()) this.nextMusic = 20;
    if (this.nextMusic <= 0 && this.musicVol > 0.01) {
      const busy = this.omen2Playing() || this.omen3Playing() || !!this._hunt;
      const d = this.playPiece();
      this.nextMusic = d + 150 + Math.random() * 240;
    }
  }
};
