// ============================================================
//  Игра: цикл, окружение, сохранения, ввод
// ============================================================
const DAY_LEN = 720;
const HAND_CFG = {
  arm: { x: 0.5, y: -0.36, z: -0.62, ry: 0.35, rx: -1.15, rz: -0.1 },
  block: { x: 0.5, y: -0.42, z: -0.8, ry: 0.78, rx: 0, s: 0.36 },
  item: { x: 0.5, y: -0.28, z: -0.8, ry: 2.3, rz: 0.05, s: 0.42 },
  small: { x: 0.46, y: -0.2, z: -0.72, ry: 2.3, rz: 0.05, s: 0.46 },
  tool: { x: 0.5, y: -0.26, z: -0.78, ry: 2.75, rx: 0.0, rz: 0.55, s: 0.5 }
}; // секунд на полные сутки
const SAVE_KEY = 'tumanny_krai_world_v1', SET_KEY = 'tumanny_krai_settings_v1', SLOTS = 3;
const slotKey = n => n === 1 ? SAVE_KEY : SAVE_KEY + '_s' + n;
const Game = {
  state: 'menu', mode: 'survival', time: 0, dayTime: 0.02, dayCount: 0, fps: 0, freeLook: false,
  newMode: 'survival', newSeed: '', worldName: '', slot: 1, newSlot: 1,
  settings: { render: 6, fov: 70, sens: 0.45, vol: 0.8, music: 0.55, bright: 0.35, refl: true, clouds: true, figure: true, mutant: true, shadows: true, bob: true, fogThick: true, gui: 0, res: 1 },
  env: { night: 0, fogEnd: 100 },
  eyeSky: 1, curFov: 70,
  init() {
    try { const s = JSON.parse(lsGet(SET_KEY) || 'null'); if (s) Object.assign(this.settings, s); } catch (e) { }
    this.canvas = $('game');
    try { Rend.init(this.canvas); }
    catch (e) { $('fatal').hidden = false; $('fatal').textContent = 'Не удалось запустить WebGL2: ' + e.message; throw e; }
    World.onMesh = c => { const m = meshChunk(c); Rend.uploadChunk(c, m); c.dirty = false; };
    World.onUnload = c => Rend.freeChunk(c);
    UI.init(); Menus.init();
    this.bindInput();
    this.applySettings();
    this.batches = { ents: new Batch(), fig: new Batch(), crack: new Batch(), outline: new Batch(), hand: new Batch(), mutant: new Batch(), mutantEyes: new Batch(), ghost: new Batch(), ghostEyes: new Batch() };
    Menus.show('title'); Net.boot();
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },
  applySettings() {
    const S = this.settings;
    Sfx.setVol(S.vol, S.music);
    UI.applyScale();
  },
  saveSettings() { lsSet(SET_KEY, JSON.stringify(this.settings)); },
  savedInfo(n = 1) {
    try {
      const d = JSON.parse(lsGet(slotKey(n)) || 'null'); if (!d) return null;
      return { name: d.name || String(d.seed), seed: d.seed, mode: d.mode, day: (d.dayCount || 0) + 1 };
    } catch (e) { return null; }
  },
  // первый свободный слот (или 1, если все заняты)
  freeSlot() { for (let n = 1; n <= SLOTS; n++) if (!this.savedInfo(n)) return n; return 1; },
  // ---------- мир ----------
  newWorld(seed, mode, name) {
    this.slot = this.newSlot; this.mode = mode; this.worldName = name || String(seed);
    World.reset(seed); Fluid.qW.clear(); Fluid.qL.clear(); Ents.clear(); Glimpse.reset();
    this.time = 0; this.dayTime = 0.02; this.dayCount = 0;
    Player.slots = new Array(36).fill(null); Player.selected = 0; Player.reset();
    if (mode === 'creative') {
      [B.GRASS, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.TORCH, B.STONE_BRICKS, B.LANTERN, B.JACK].forEach((id, i) => Player.slots[i] = { id, count: 64, dmg: 0 });
    }
    // точка появления — суша у начала координат
    let sx = 0, sz = 0;
    outer: for (let r = 0; r < 400; r += 4) for (let a = 0; a < 16; a++) {
      const x = Math.round(Math.cos(a / 16 * PI2) * r), z = Math.round(Math.sin(a / 16 * PI2) * r);
      const h = World.gen.height(x, z), bio = World.gen.biome(x, z, h);
      if (h > SEA + 1 && h < 90 && bio !== BIOME.DESERT) { sx = x; sz = z; break outer; }
    }
    Player.x = sx + 0.5; Player.z = sz + 0.5; Player.y = WH; Player.yaw = 0; Player.pitch = 0;
    Player.spawn = [sx + 0.5, -1, sz + 0.5];
    this.startLoading(true);
  },
  loadWorld(n = 1) {
    let d; try { d = JSON.parse(lsGet(slotKey(n))); } catch (e) { d = null; }
    if (!d) return;
    this.slot = n;
    this.mode = d.mode; this.worldName = d.name || String(d.seed);
    World.reset(d.seed); Fluid.qW.clear(); Fluid.qL.clear(); Ents.clear(); Glimpse.reset();
    for (const [k, arr] of d.mods) { const m = new Map(); for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]); World.mods.set(k, m); }
    for (const [k, v] of d.orient || []) World.orient.set(k, v);
    for (const [k, v] of d.containers || []) World.containers.set(k, v);
    this.time = d.time || 0; this.dayTime = d.dayTime || 0; this.dayCount = d.dayCount || 0; Ents.encounters = d.enc || 0; Ents.nightEnc = !!d.nenc || (d.enc || 0) > 0;
    const p = d.player;
    Player.reset();
    Object.assign(Player, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.health, selected: p.selected || 0, spawn: p.spawn, flying: !!p.flying });
    Player.slots = p.slots.map(s => s ? { id: s.id, count: s.count, dmg: s.dmg || 0 } : null);
    while (Player.slots.length < 36) Player.slots.push(null);
    Player.armor = [0, 1, 2, 3].map(i => { const s = (p.armor || [])[i]; return s && ITEMS[s.id] && ITEMS[s.id].armor ? { id: s.id, count: 1, dmg: s.dmg || 0 } : null; });
    this.startLoading(false);
  },
  // чужой мир по сети: только изменения блоков, без инвентаря хозяина; ничего не сохраняем
  loadSnapshot(d, mode, meta) {
    this.slot = 0; this.mode = mode; this.worldName = d.w || 'Чужой мир';
    World.reset(d.seed); Fluid.qW.clear(); Fluid.qL.clear(); Ents.clear(); Glimpse.reset();
    for (const [k, arr] of d.mods || []) { const m = new Map(); for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]); World.mods.set(k, m); }
    for (const [k, v] of d.orient || []) World.orient.set(k, v);
    this.time = 0; this.dayTime = d.d || 0; this.dayCount = d.c || 0;
    Player.reset(); Player.slots = new Array(36).fill(null); Player.selected = 0;
    if (mode === 'creative') [B.GRASS, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.TORCH, B.STONE_BRICKS, B.LANTERN, B.JACK].forEach((id, i) => Player.slots[i] = { id, count: 64, dmg: 0 });
    const at = d.at || [0.5, 100, 0.5];
    Player.x = at[0] + 1; Player.y = at[1] + 0.2; Player.z = at[2]; Player.yaw = 0; Player.pitch = 0;
    Player.spawn = [at[0] + 1, at[1], at[2]];
    this.startLoading(false);
  },
  saveWorld() {
    if (this.state !== 'play' || Net.role === 'guest' || !this.slot) return;
    const p = Player;
    const d = {
      v: 1, name: this.worldName, seed: World.seed, mode: this.mode, time: this.time, dayTime: this.dayTime, dayCount: this.dayCount,
      player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.dead ? 20 : p.health, slots: p.slots, armor: p.armor, selected: p.selected, spawn: p.spawn, flying: p.flying },
      mods: [...World.mods].map(([k, m]) => { const a = []; for (const [i, id] of m) a.push(i, id); return [k, a]; }),
      orient: [...World.orient], containers: [...World.containers], enc: Ents.encounters, nenc: Ents.nightEnc ? 1 : 0
    };
    if (p.dead) { d.player.x = p.spawn[0]; d.player.y = p.spawn[1]; d.player.z = p.spawn[2]; }
    if (!lsSet(slotKey(this.slot), JSON.stringify(d))) console.warn('Не удалось сохранить мир');
  },
  startLoading(fresh) {
    this.state = 'loading'; this.fresh = fresh;
    UI.closeScreen(); UI.gui = null;
    Menus.show('loading');
    $('hud').hidden = true;
  },
  loadingTick() {
    const R = this.settings.render, pcx = Math.floor(Player.x) >> 4, pcz = Math.floor(Player.z) >> 4;
    World.update(pcx, pcz, R, 40);
    const need = Math.min(R, 3);
    let total = 0, done = 0;
    for (let dz = -need; dz <= need; dz++) for (let dx = -need; dx <= need; dx++) { total++; const c = World.chunk(pcx + dx, pcz + dz); if (c && c.mesh && !c.dirty) done++; }
    const bar = $('loadBar'); if (bar) bar.style.width = Math.round(done / total * 100) + '%';
    if (done === total) {
      if (this.fresh || Player.spawn[1] < 0) {
        const ty = World.topY(Math.floor(Player.x), Math.floor(Player.z));
        Player.spawn[1] = ty + 1;
        if (this.fresh) Player.y = ty + 1;
      }
      this.state = 'play';
      Menus.hide(); $('hud').hidden = false;
      if (!Net.role) Net.startHost();
      UI.refreshHotbar(); UI.refreshHud();
      Sfx.nextCave = 50; Sfx.nextMusic = 25 + Math.random() * 30;
      this.captureMouse();
    }
  },
  toTitle() {
    Net.stop();
    this.state = 'menu';
    UI.setStatic(0); Sfx.setStatic(0, 0); Glimpse.reset(); Glimpse.draw({ x: 0, y: 0, z: 0 }); this.blockMul = 1;
    UI.closeScreen();
    World.reset(0); Ents.clear();
    $('hud').hidden = true;
    document.exitPointerLock && document.exitPointerLock();
    Menus.show('title');
  },
  respawn() {
    Player.reset();
    Player.x = Player.spawn[0]; Player.y = Player.spawn[1]; Player.z = Player.spawn[2];
    Menus.hide(); UI.refreshHud(); UI.refreshHotbar();
    this.captureMouse(true);
  },
  // ---------- мышь ----------
  captureMouse(fromClick) {
    if (this.state !== 'play' || UI.gui || Menus.cur) return;
    $('clickHint').hidden = true;
    if (this.freeLook || document.pointerLockElement === this.canvas) return;
    this._req = { click: !!fromClick, done: false };
    try {
      const r = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => this.lockFailed());
    } catch (e) { this.lockFailed(); }
  },
  lockFailed() {
    const q = this._req; if (!q || q.done) return; q.done = true;
    if (this.state !== 'play' || UI.gui || Menus.cur) return;
    if (q.click) this._lockFails = (this._lockFails || 0) + 1;
    if (!this._everLocked && this._lockFails >= 2) { this.freeLook = true; UI.toast('Браузер не даёт захватить мышь: осматривайтесь движением мыши или стрелками'); return; }
    $('clickHint').hidden = false;
  },
  releaseMouse() { if (document.pointerLockElement) document.exitPointerLock(); },
  locked() { return document.pointerLockElement === this.canvas || this.freeLook; },
  bindInput() {
    const cv = this.canvas;
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === cv) { this._everLocked = true; this._lockT = performance.now(); this.freeLook = false; if (this._req) this._req.done = true; $('clickHint').hidden = true; return; }
      Input.keys = {}; Input.mouse = [false, false, false];
      if (this.state === 'play' && !UI.gui && !Menus.cur && !Player.dead && !Net.cmdOn) Menus.show('pause');
    });
    document.addEventListener('pointerlockerror', () => this.lockFailed());
    cv.addEventListener('mousedown', e => {
      Sfx.init();
      if (this.state !== 'play' || UI.gui || Menus.cur) return;
      if (!this.locked()) { this.captureMouse(true); return; }
      Input.mouse[e.button] = true; Input.clicked[e.button] = true;
      e.preventDefault();
    });
    $('clickHint').addEventListener('mousedown', () => { Sfx.init(); this.captureMouse(true); });
    addEventListener('mouseup', e => { Input.mouse[e.button] = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (this.state === 'play' && this.locked() && !UI.gui && !Menus.cur) {
        const mx = e.movementX || 0, my = e.movementY || 0;
        if (Math.abs(mx) > 300 || Math.abs(my) > 300 || performance.now() - (this._lockT || 0) < 120) return;
        Input.dx += mx; Input.dy += my;
      }
    });
    addEventListener('wheel', e => {
      if (this.state !== 'play' || UI.gui || Menus.cur) return;
      Player.selected = (Player.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      UI.refreshHotbar();
    }, { passive: true });
    addEventListener('keydown', e => {
      const c = e.code;
      if (['F1', 'F3', 'Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(c) && this.state === 'play' && document.activeElement?.tagName !== 'INPUT') e.preventDefault();
      if (this.state !== 'play') return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (UI.gui) {
        if (c === 'Escape' || c === 'KeyE') { UI.closeScreen(); e.preventDefault(); }
        else if (/^Digit[1-9]$/.test(c)) UI.swapHotbar(+c.slice(5) - 1);
        return;
      }
      if (Menus.cur) {
        if (c === 'Escape' && Menus.cur === 'pause') { Menus.hide(); this.captureMouse(true); }
        else if ((c === 'Escape' || c === 'Numpad5') && Menus.cur === 'morph') { Menus.hide(); this.captureMouse(true); }
        return;
      }
      if (c === 'Numpad5' && Net.canCmd()) { e.preventDefault(); Menus.show('morph'); this.releaseMouse(); return; }
      if ((c === 'Numpad4' || c === 'Numpad6') && Net.canCmd() && Net.form === 'creature') { e.preventDefault(); if (!e.repeat) Net.setStatic(c === 'Numpad4'); return; }
      if (c === 'Numpad8' && Net.canCmd() && Net.form === 'creature') { e.preventDefault(); if (!e.repeat) Net.toggleArms(); return; }
      if ((c === 'Numpad1' || c === 'Numpad2') && Net.canCmd() && Net.form === 'creature') { e.preventDefault(); if (!e.repeat) Net.cry(c === 'Numpad2' ? 1 : 0); return; }
      if (['NumpadAdd', 'Equal', 'NumpadSubtract', 'Minus'].includes(c) && Net.canCmd() && Net.form === 'creature') {
        e.preventDefault(); Net.setScale(c === 'NumpadAdd' || c === 'Equal' ? 0.1 : -0.1); return;
      }
      if ((c === 'KeyT' || c === 'Slash') && Net.canCmd()) { e.preventDefault(); Net.cmdOpen(c === 'Slash' ? '/' : ''); return; }
      const wasDown = Input.keys[c];
      Input.keys[c] = true;
      // двойное нажатие «вперёд» — бег, как в Minecraft
      if (c === 'KeyW' && !e.repeat && !wasDown) {
        const now = performance.now();
        if (now - (Player.lastW || -1e9) < 300 && !Player.sneaking) { Player.sprinting = true; Player.lastW = -1e9; }
        else Player.lastW = now;
      }
      if (/^Digit[1-9]$/.test(c)) { Player.selected = +c.slice(5) - 1; UI.refreshHotbar(); }
      else if (c === 'KeyE' && !Player.dead) UI.openInventory();
      else if (c === 'F3') UI.debug = !UI.debug;
      else if (c === 'F1') UI.hideHud = !UI.hideHud;
      else if (c === 'Escape' && !this.locked()) Menus.show('pause');
      else if (c === 'Escape' && this.freeLook) Menus.show('pause');
      else if (c === 'KeyQ') {
        const st = Player.held();
        if (st) {
          const n = e.ctrlKey ? st.count : 1;
          Ents.dropItem(Player.x, Player.y + EYE - 0.3, Player.z, { id: st.id, count: n, dmg: st.dmg }, false, lookDir());
          st.count -= n; if (st.count <= 0) Player.slots[Player.selected] = null;
          UI.refreshHotbar();
        }
      } else if (c === 'Space' && !e.repeat && this.mode === 'creative') {
        const now = performance.now();
        if (now - Player.lastSpace < 300) { Player.flying = !Player.flying; Player.vy = 0; Player.lastSpace = -1; }
        else Player.lastSpace = now;
      }
    });
    addEventListener('keyup', e => { Input.keys[e.code] = false; });
    addEventListener('blur', () => { Input.keys = {}; Input.mouse = [false, false, false]; });
    addEventListener('beforeunload', () => this.saveWorld());
    setInterval(() => { if (this.state === 'play') this.saveWorld(); }, 45000);
  },
  // ---------- окружение ----------
  computeEnv() {
    const S = this.settings, e = this.env, t = this.dayTime;
    const ang = t * PI2, sh = Math.sin(ang);
    const sd = [Math.cos(ang), sh, 0.22]; const l = Math.hypot(...sd); e.sunDir = sd.map(v => v / l);
    const day = clamp(sh * 3.2 + 0.3, 0, 1);
    e.day = day; e.night = 1 - clamp(sh * 3 + 0.8, 0, 1);
    e.sunset = clamp(1 - Math.abs(sh) * 3.2, 0, 1);
    e.skySub = (1 - day) * 9;
    const mixv = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    e.skyTint = mixv([0.62, 0.7, 1.0], [1, 1, 0.97], day);
    let top = mixv([0.01, 0.012, 0.03], [0.43, 0.58, 0.9], day);
    let hor = mixv([0.05, 0.057, 0.088], [0.7, 0.78, 0.9], day);
    hor = mixv(hor, [0.85, 0.46, 0.26], e.sunset * 0.55 * (day > 0.05 ? 1 : 0.3));
    // «старая» мрачность: чуть серее
    const des = (c, k) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map(v => v + (g - v) * k); };
    top = des(top, 0.12); hor = des(hor, 0.15);
    e.skyTop = top; e.skyHor = hor;
    e.gamma = S.bright; e.minLight = 0.02 + S.bright * 0.06;
    const dk = Ents.dreadK || 0;      // «долгая ночь»: почти полная тьма
    if (dk > 0.001) { e.skySub = lerp(e.skySub, 15, dk); e.minLight *= 1 - 0.9 * dk; e.gamma *= 1 - 0.85 * dk; e.skyTint = e.skyTint.map(v => v * (1 - 0.5 * dk)); top = top.map(v => v * (1 - 0.92 * dk)); hor = hor.map(v => v * (1 - 0.92 * dk)); e.skyTop = top; e.skyHor = hor; }
    const gk = Ents.glitchK || 0;      // «сбой мира»: красное небо
    if (gk > 0.001) { const red = (c, w) => c.map((v, i) => v + (w[i] - v) * gk); top = red(top, [0.62, 0.02, 0.02]); hor = red(hor, [0.85, 0.12, 0.06]); e.skyTop = top; e.skyHor = hor; e.skyTint = red(e.skyTint, [1, 0.62, 0.55]); e.skySub = lerp(e.skySub, 0, gk * 0.7); }
    const hk = Ents.huntK || 0;        // «охота»: ночь чуть темнее
    if (hk > 0.001) { e.skySub = lerp(e.skySub, 12, hk * 0.6); e.minLight *= 1 - 0.5 * hk; e.gamma *= 1 - 0.3 * hk; top = top.map(v => v * (1 - 0.5 * hk)); hor = hor.map(v => v * (1 - 0.5 * hk)); e.skyTop = top; e.skyHor = hor; }
    const dpk = Ents.deepK || 0;       // еловая чаща: гуще и мрачнее
    if (dpk > 0.001) { const gm = (c, k) => c.map(v => v * (1 - k * dpk)); top = gm(top, 0.25); hor = gm(hor, 0.3); e.skyTop = top; e.skyHor = hor; e.minLight *= 1 - 0.2 * dpk; }
    // пещера: чем меньше неба видно глазу, тем темнее туман
    const p = Player;
    const eyeL = World.light(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z)) >> 4;
    this.eyeSky += (eyeL / 15 - this.eyeSky) * 0.03;
    e.cave = 1 - smooth(clamp((this.eyeSky - 0.15) / 0.5, 0, 1));
    const dist = S.render * 16;
    let fogEnd = dist * 0.95, fogStart = dist * 0.55;
    if (S.fogThick) { fogEnd = dist * 0.8; fogStart = dist * 0.12; }
    const nightK = e.night;
    fogEnd = lerp(fogEnd, Math.max(26, fogEnd * 0.5), nightK * (S.fogThick ? 1 : 0.4));
    fogStart = lerp(fogStart, 2, nightK * (S.fogThick ? 1 : 0.3));
    fogEnd = lerp(fogEnd, Math.min(fogEnd, 44), e.cave); fogStart = lerp(fogStart, 3, e.cave);
    if (dpk > 0.001) { fogEnd = lerp(fogEnd, Math.max(24, fogEnd * 0.55), dpk); fogStart = lerp(fogStart, fogStart * 0.3, dpk); }
    let fc = mixv(hor, [0, 0, 0], e.cave);
    e.underwater = p.eyeInWater;
    const lava = isLava(World.get(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z)));
    if (e.underwater) {
      const lf = Math.max(0.08, clamp(eyeL / 15 - e.skySub / 15, 0, 1));
      fc = [0.02 * lf + 0.005, 0.07 * lf + 0.008, 0.2 * lf + 0.02]; fogStart = 0; fogEnd = 18;
    }
    if (lava) { fc = [0.6, 0.12, 0.0]; fogStart = 0; fogEnd = 1.5; }
    if (!e.underwater && !lava && Ents.dayFog > 0.001) { const k = Ents.dayFog * (1 - e.cave); fogEnd = lerp(fogEnd, Math.max(fogEnd, 128), k); fogStart = lerp(fogStart, Math.max(fogStart, 70), k); }
    e.fogColor = fc; e.fogStart = fogStart; e.fogEnd = fogEnd;
    e.time = this.time; e.clouds = S.clouds; e.reflections = S.refl;
    e.cloudOff = this.time * 0.8;
    return e;
  },
  // ---------- мигание света при помехах ----------
  blockMul: 1, flickerPulse: 0, flT: 0, flTarget: 1, flOn: true,
  updateFlicker(k, dt) {
    this.flickerPulse = Math.max(0, this.flickerPulse - dt);
    const kk = Math.max(k, this.flickerPulse > 0 ? 0.75 : 0);
    if (kk < 0.04) { this.blockMul = Math.min(1, this.blockMul + dt * 5); this.flT = 0; this.flOn = true; return; }
    this.flT -= dt;
    if (this.flT <= 0) {
      const off = Math.random() < 0.18 + 0.6 * kk;
      if (off && this.flOn && kk > 0.25) Sfx.flick();
      this.flOn = !off;
      this.flTarget = off ? Math.random() * (0.5 - 0.4 * kk) : 0.78 + Math.random() * 0.22;
      this.flT = off ? 0.03 + Math.random() * (0.07 + 0.25 * kk) : 0.05 + Math.random() * (0.8 - 0.65 * kk);
    }
    this.blockMul = this.flTarget;
  },
  // ---------- рука ----------
  buildHand() {
    const b = this.batches.hand.reset(), p = Player, st = p.held();
    const l = World.light(Math.floor(p.x), Math.floor(p.y + EYE), Math.floor(p.z));
    const sky = (l >> 4) / 15, blk = (l & 15) / 15;
    const sw = p.swing, sq = Math.sin(Math.sqrt(sw) * Math.PI), sp = Math.sin(sw * Math.PI), s2 = Math.sin(Math.sqrt(sw) * PI2);
    const ph = p.bob * 1.7, ba = this.settings.bob ? p.bobAmt : 0;
    const bx = Math.sin(ph) * 0.035 * ba, by = -Math.abs(Math.cos(ph)) * 0.05 * ba;
    const eq = 1 - p.equip;
    const M = m4(), T = m4(), R = m4();
    const apply = (m) => m4mul(M, M, m);
    m4ident(M);
    const H = HAND_CFG;
    if (!st) {
      const c = H.arm;
      apply(m4translate(T, c.x + bx - sq * 0.3, c.y + by - eq * 0.6 + s2 * 0.12, c.z - sp * 0.25));
      apply(m4rotY(R, c.ry + sq * 0.35));
      apply(m4rotX(R, c.rx + sq * 0.9));
      apply(m4rotZ(R, c.rz));
      batchBox(b, -0.11, -1.2, -0.11, 0.11, 0, 0.11, TILE.skin, (x, y, z) => [x, y, z], sky, blk);
      return { batch: b, model: M };
    }
    const it = ITEMS[st.id];
    const cube = it.block && BLK[it.block].render === R_CUBE;
    if (cube) {
      const c = H.block;
      apply(m4translate(T, c.x + bx - sq * 0.3, c.y + by - eq * 0.6 + s2 * 0.15, c.z - sp * 0.25));
      apply(m4rotY(R, c.ry + sq * 0.2));
      apply(m4rotX(R, c.rx - sq * 0.55));
      apply(m4scale(T, c.s, c.s, c.s));
      batchBlock(b, it.block, (x, y, z) => [x - 0.5, y - 0.5, z - 0.5], sky, blk, 1, 4);
    } else {
      const c = (it.block && it.sprite === undefined) ? H.small : (it.tool ? H.tool : H.item);
      const tile = it.sprite !== undefined ? it.sprite : BLK[it.block].icon;
      apply(m4translate(T, c.x + bx - sq * 0.3, c.y + by - eq * 0.6 + s2 * 0.15, c.z - sp * 0.25));
      apply(m4rotX(R, -sq * 0.9 + (c.rx || 0)));
      apply(m4rotY(R, c.ry));
      apply(m4rotZ(R, c.rz));
      apply(m4scale(T, c.s, c.s, c.s));
      batchSprite3D(b, tile, (x, y, z) => [x - 0.5, y - 0.5, z], sky, it.block === B.TORCH ? 1 : blk);
    }
    return { batch: b, model: M };
  },
  buildTargetGfx(cam) {
    const t = Player.target, cr = this.batches.crack.reset(), ol = this.batches.outline.reset();
    if (!t || UI.hideHud) return { crack: null, outline: null };
    const bx = smallBox(t.id, t.x, t.y, t.z), e = 0.002;
    const x0 = t.x + bx[0] - e - cam.x, y0 = t.y + bx[1] - e - cam.y, z0 = t.z + bx[2] - e - cam.z;
    const x1 = t.x + bx[3] + e - cam.x, y1 = t.y + bx[4] + e - cam.y, z1 = t.z + bx[5] + e - cam.z;
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => ol.line(P[a], P[b]));
    if (Player.breakP > 0 && Player.breakPos) {
      const stage = clamp(Math.floor(Player.breakP * 10), 0, 9);
      batchBox(cr, x0, y0, z0, x1, y1, z1, TILE['crack' + stage], (x, y, z) => [x, y, z], 1, 1);
    }
    return { crack: cr.n ? cr : null, outline: ol };
  },
  // ---------- цикл ----------
  loop(ts) {
    requestAnimationFrame(t => this.loop(t));
    let dt = (ts - this.last) / 1000; this.last = ts;
    if (!(dt > 0)) dt = 0.016; dt = Math.min(dt, 0.1);
    this._fc = (this._fc || 0) + 1; this._ft = (this._ft || 0) + dt;
    if (this._ft >= 1) { this.fps = this._fc; this._fc = 0; this._ft = 0; }
    Rend.resize(this.settings.res);
    if (this.state === 'loading') { this.loadingTick(); return; }
    if (this.state !== 'play') return;
    const paused = (Menus.cur === 'pause' || Menus.cur === 'settings' || Menus.cur === 'controls');
    const p = Player;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    const LR = Math.max(this.settings.render, Ents.dayLoad ? 8 : 0);
    World.update(pcx, pcz, LR, paused ? 12 : 6);
    this._unl = (this._unl || 0) + dt; if (this._unl > 2) { this._unl = 0; World.unloadFar(pcx, pcz, LR); }
    if (!paused) {
      const sdt = Math.min(dt, 0.1);
      if (Ents.huntLock) { Input.mouse[0] = Input.mouse[1] = Input.mouse[2] = false; Input.clicked[0] = Input.clicked[1] = Input.clicked[2] = false; Input.dx = Input.dy = 0; }
      this.time += sdt;
      if (!Ents.dreadS && !Ents.huntS) this.dayTime += sdt / DAY_LEN; if (this.dayTime >= 1) { this.dayTime -= 1; this.dayCount++; }
      // обзор
      if (this.locked() && !UI.gui && !Menus.cur) {
        const k = (0.0005 + this.settings.sens * 0.0045);
        p.yaw -= Input.dx * k; p.pitch = clamp(p.pitch - Input.dy * k, -1.55, 1.55);
        if (Input.keys.ArrowLeft) p.yaw += 2.2 * sdt; if (Input.keys.ArrowRight) p.yaw -= 2.2 * sdt;
        if (Input.keys.ArrowUp) p.pitch = clamp(p.pitch + 1.6 * sdt, -1.55, 1.55); if (Input.keys.ArrowDown) p.pitch = clamp(p.pitch - 1.6 * sdt, -1.55, 1.55);
      }
      Input.dx = Input.dy = 0;
      const here = World.chunk(pcx, pcz);
      if (!p.dead && here && here.state >= ST_LIT) {
        if (UI.gui || Menus.cur) { const keep = Input.keys; Input.keys = {}; playerPhysics(sdt, this.mode === 'creative'); Input.keys = keep; }
        else playerPhysics(sdt, this.mode === 'creative');
        if (!UI.gui && !Menus.cur && this.locked()) { Net.cap++; try { playerInteract(sdt); } finally { Net.cap--; } } else { p.breakP = 0; p.swinging = false; p.target = null; }
        survivalTick(sdt);
      }
      if (p.equip < 1) p.equip = Math.min(1, p.equip + sdt * 4);
      Ents.update(sdt);
      if (!UI.gui && !Menus.cur && !Net.observer()) Glimpse.update(sdt);
      Fluid.update(sdt); Net.cap++; try { Switch.tick(sdt); } finally { Net.cap--; }
      for (const [key, c] of World.containers) if (c.type === 'furnace') furnaceTick(c, key, sdt);
      UI.tickGui();
    }
    // камера
    const sk = (paused || p.dead) ? 0 : Ents.staticLevel();
    this.updateFlicker(paused ? 0 : Math.max(sk, 0.5 * Ents.dreadK), paused ? 0 : dt);
    const env = this.computeEnv();
    env.blockMul = this.blockMul;
    {   // свет от предмета в руке (факел, фонарь...): мигает вместе с остальным светом через blockMul
      const h = p.held(), em = h && h.id < 256 ? EMIT[h.id] : 0, tgt = em ? Math.min(15, em) / 15 * 0.8 : 0;
      this.handL = (this.handL || 0) + (tgt - (this.handL || 0)) * (1 - Math.exp(-dt * 9));
      env.handLight = this.handL * (0.96 + 0.04 * Math.sin(this.time * 11.3) * Math.sin(this.time * 4.1));
    }
    const targetFov = this.settings.fov * (p.sprinting ? 1.12 : 1) * (p.eyeInWater ? 0.9 : 1) * (p.flying && p.sprinting ? 1.08 : 1);
    this.curFov += (targetFov - this.curFov) * (1 - Math.exp(-10 * dt));
    const ph = p.bob * 1.7, ba = this.settings.bob ? p.bobAmt : 0;
    const cam = {
      x: p.x + Math.cos(p.yaw) * Math.sin(ph) * 0.045 * ba, y: p.y + EYE * (p.hs || 1) - (p.sneaking ? 0.1 : 0) + (-Math.abs(Math.cos(ph)) * 0.07 + 0.035) * ba,
      z: p.z - Math.sin(p.yaw) * Math.sin(ph) * 0.045 * ba, yaw: p.yaw, pitch: p.pitch, fov: this.curFov,
      roll: Math.sin(ph) * 0.006 * ba + (p.hurtT > 0 ? Math.sin(p.hurtT * 30) * 0.03 : 0)
    };
    if (p.dead) { cam.y = p.y + 0.3; cam.roll = 0.5; }
    const tg = this.buildTargetGfx(cam);
    const fig = Ents.buildFigure(this.batches.fig, cam);
    const scene = {
      ents: Ents.build(this.batches.ents, cam), figure: fig, figureColor: [0.022, 0.02, 0.026, 1],
      crack: tg.crack, outline: tg.outline, hand: (UI.hideHud || p.dead) ? null : this.buildHand(),
      mutant: Ents.buildMutant(this.batches.mutant, this.batches.mutantEyes, cam, Net.morphMutant() || undefined), mutantEyes: this.batches.mutantEyes, mutantFog: Ents.mutant.day ? 0.45 : 1,
      ghost: Ents.buildMutant(this.batches.ghost, this.batches.ghostEyes, cam, Ents.ghost), ghostEyes: this.batches.ghostEyes
    };
    this._tvT = (this._tvT || 0) - dt;
    if (this._tvT <= 0) { this._tvT = 1 / 14; Rend.updateTV(this.time, Ents.tvMode()); }
    Rend.render(cam, env, scene);
    Glimpse.draw(cam);
    Net.tick(dt); Net.drawTags(cam);
    UI.setStatic(Ents.pictureOn ? 0 : sk, Ents.mutantBurst > 0 && !Ents.pictureOn); Sfx.setStatic(sk, dt);
    $('waterFx').classList.toggle('on', !!p.eyeInWater);
    UI.updateHud(dt);
    Sfx.update(dt, { underwater: p.eyeInWater, skyLight: this.eyeSky, night: env.night > 0.5, taiga: !!Ents.deepOn, evening: this.dayTime > 0.4 && this.dayTime < 0.52, dayCount: this.dayCount, y: p.y, paused: paused || Menus.cur === 'death' });
  }
};
window.addEventListener('load', () => Game.init());
