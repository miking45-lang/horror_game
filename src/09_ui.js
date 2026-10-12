// ============================================================
//  Интерфейс: иконки, HUD, инвентарь, верстак, печь, сундук
// ============================================================
const $ = (id) => document.getElementById(id);
function pixCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function shadedAtlas(f) {
  const [c, x] = pixCanvas(ATLAS_SIZE, ATLAS_SIZE);
  const img = new ImageData(new Uint8ClampedArray(atlasImg.data), ATLAS_SIZE, ATLAS_SIZE);
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] *= f; img.data[i + 1] *= f; img.data[i + 2] *= f; }
  x.putImageData(img, 0, 0); return c;
}
const ICON = {};
function buildIcons() {
  const A0 = atlasCanvas, A1 = shadedAtlas(0.78), A2 = shadedAtlas(0.6);
  const S = 64, m = 4, W = S - 2 * m, k = W / 32;
  for (const idS in ITEMS) {
    const id = +idS, it = ITEMS[id];
    const [c, x] = pixCanvas(S, S);
    const d = it.block ? BLK[it.block] : null;
    if (d && d.render === R_CUBE) {
      const top = d.tiles[2], left = d.front >= 0 ? d.front : d.tiles[4], right = d.tiles[0];
      const draw = (A, t, a, b, c2, d2, e, f) => {
        const [tx, ty] = tileUV(t);
        x.setTransform(a, b, c2, d2, e, f);
        x.drawImage(A, tx, ty, 16, 16, 0, 0, 16.3, 16.3);
      };
      draw(A1, left, k, k / 2, 0, k, m, m + W / 4);
      draw(A2, right, k, -k / 2, 0, k, S / 2, m + W / 2);
      draw(A0, top, k, k / 2, -k, k / 2, S / 2, m);
      x.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      const t = it.sprite !== undefined ? it.sprite : d.icon;
      const [tx, ty] = tileUV(t);
      x.drawImage(A0, tx, ty, 16, 16, 0, 0, S, S);
    }
    ICON[id] = c.toDataURL();
  }
}
// сердца и пузырьки
function drawIconPix(rows, map) {
  const [c, x] = pixCanvas(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, xx) => { if (map[ch]) { x.fillStyle = map[ch]; x.fillRect(xx, y, 1, 1); } }));
  return c.toDataURL();
}
const HEART_ROWS = ['.oo...oo.', 'oRRo.oRRo', 'oRWRoRRRo', 'oRRRRRRRo', 'oRRRRRRRo', '.oRRRRRo.', '..oRRRo..', '...oRo...', '....o....'];
const HUD_IMG = {
  heart: drawIconPix(HEART_ROWS, { o: '#1a0606', R: '#c81e1e', W: '#ff9a9a' }),
  heartE: drawIconPix(HEART_ROWS, { o: '#1a0606', R: '#3b1414', W: '#3b1414' }),
  heartH: drawIconPix(HEART_ROWS.map(r => r.slice(0, 5).replace(/R|W/g, m => m) + r.slice(5).replace(/[RW]/g, 'E')), { o: '#1a0606', R: '#c81e1e', W: '#ff9a9a', E: '#3b1414' }),
  armor: drawIconPix(['.........', '.oo...oo.', 'oWWo.oWWo', 'oWWWoWWWo', 'oWWWWWWWo', 'oWWWWWWWo', 'oWWWWWWWo', '.oWWWWWo.', '..ooooo..'], { o: '#1a1c22', W: '#c9ccd6' }),
  armorH: drawIconPix(['.........', '.oo...oo.', 'oWWo.oEEo', 'oWWWoEEEo', 'oWWWEEEEo', 'oWWWEEEEo', 'oWWWEEEEo', '.oWWEEEo.', '..ooooo..'], { o: '#1a1c22', W: '#c9ccd6', E: '#3a3d46' }),
  armorE: drawIconPix(['.........', '.oo...oo.', 'oEEo.oEEo', 'oEEEoEEEo', 'oEEEEEEEo', 'oEEEEEEEo', 'oEEEEEEEo', '.oEEEEEo.', '..ooooo..'], { o: '#1a1c22', E: '#3a3d46' }),
  bubble: drawIconPix(['..ooooo..', '.oWWbbbo.', 'oWWbbbbbo', 'oWbbbbbbo', 'obbbbbbbo', 'obbbbbbbo', 'obbbbbbbo', '.obbbbbo.', '..ooooo..'], { o: '#0c2a52', W: '#e8f4ff', b: '#3d82d6' })
};

const UI = {
  s: 2, screen: null, cursor: null, craft2: new Array(4).fill(null), craft3: new Array(9).fill(null),
  openContainerKey: null, container: null, slots: [], hover: null, nameT: 0, debug: false, hideHud: false,
  creativeScroll: 0,
  init() {
    buildIcons();
    this.hud = $('hud'); this.scr = $('screen'); this.cur = $('cursorItem'); this.tip = $('tooltip');
    this.buildHotbarArt();
    document.addEventListener('mousemove', e => {
      this.mx = e.clientX; this.my = e.clientY;
      this.cur.style.left = e.clientX + 'px'; this.cur.style.top = e.clientY + 'px';
      this.tip.style.left = (e.clientX + 12) + 'px'; this.tip.style.top = (e.clientY - 24) + 'px';
    });
    window.addEventListener('resize', () => this.applyScale());
    this.applyScale();
  },
  applyScale() {
    const auto = clamp(Math.floor(Math.min(innerWidth / 330, innerHeight / 250)), 1, 4);
    this.s = Game.settings.gui ? Math.min(Game.settings.gui, auto + 1) : auto;
    document.documentElement.style.setProperty('--s', this.s + 'px');
    if (this.gui) this.renderGui();
  },
  stackHTML(st) {
    if (!st) return '';
    const it = ITEMS[st.id]; if (!it) return '';
    let h = `<div class="stk" style="background-image:url(${ICON[st.id]})">`;
    if (st.count > 1) h += `<span class="cnt">${st.count}</span>`;
    const dur = it.tool ? it.tool.dur : it.armor ? it.armor.dur : 0;
    if (dur && st.dmg > 0) {
      const f = 1 - st.dmg / dur;
      h += `<i class="dur"><b style="width:calc(var(--s)*${Math.max(1, Math.round(f * 13))});background:hsl(${Math.round(f * 120)},90%,45%)"></b></i>`;
    }
    return h + '</div>';
  },
  // ---------- HUD ----------
  buildHotbarArt() {
    const [c, x] = pixCanvas(182, 22);
    x.fillStyle = 'rgba(0,0,0,0.75)'; x.fillRect(0, 0, 182, 22);
    x.fillStyle = 'rgba(52,52,56,0.72)'; x.fillRect(1, 1, 180, 20);
    for (let i = 0; i < 9; i++) {
      const sx = 1 + i * 20;
      x.fillStyle = '#7d7d82'; x.fillRect(sx, 1, 20, 1); x.fillRect(sx, 1, 1, 20); x.fillRect(sx + 19, 1, 1, 20); x.fillRect(sx, 20, 20, 1);
      x.fillStyle = 'rgba(20,20,22,0.6)'; x.fillRect(sx + 1, 2, 18, 1); x.fillRect(sx + 1, 2, 1, 18);
    }
    $('hotbarBg').src = c.toDataURL();
    const [c2, x2] = pixCanvas(24, 24);
    x2.fillStyle = '#000'; x2.fillRect(0, 0, 24, 24);
    x2.fillStyle = '#f2f2f2'; x2.fillRect(1, 1, 22, 22);
    x2.clearRect(3, 3, 18, 18); x2.fillStyle = '#000'; x2.fillRect(3, 3, 18, 1); x2.fillRect(3, 3, 1, 18); x2.fillRect(20, 3, 1, 18); x2.fillRect(3, 20, 18, 1);
    x2.clearRect(4, 4, 16, 16);
    $('hotbarSel').src = c2.toDataURL();
    let h = '';
    for (let i = 0; i < 9; i++) h += `<div class="hslot" style="left:calc(var(--s)*${3 + i * 20});"></div>`;
    $('hotbarItems').innerHTML = h;
  },
  refreshHotbar() {
    const els = $('hotbarItems').children;
    for (let i = 0; i < 9; i++) els[i].innerHTML = this.stackHTML(Player.slots[i]);
    $('hotbarSel').style.left = `calc(var(--s)*${Player.selected * 20 - 1})`;
    if (Player.lastSel !== Player.selected || this._lastId !== (Player.held() && Player.held().id)) {
      Player.lastSel = Player.selected; this._lastId = Player.held() && Player.held().id;
      Player.equip = 0;
      const st = Player.held();
      if (st) { $('itemName').textContent = itemName(st.id); this.nameT = 2.2; }
    }
    if (this.gui) this.renderSlots();
  },
  refreshHud() {
    const surv = Game.mode === 'survival';
    let h = '';
    if (surv) {
      const hp = Player.health;
      for (let i = 0; i < 10; i++) {
        const v = hp - i * 2, src = v >= 2 ? HUD_IMG.heart : v === 1 ? HUD_IMG.heartH : HUD_IMG.heartE;
        const shake = hp <= 4 ? ` style="transform:translateY(calc(var(--s)*${Math.round(Math.random() * 2 - 1)}))"` : '';
        h += `<img src="${src}"${shake}>`;
      }
    }
    $('hearts').innerHTML = h;
    let ab = ''; const ap = surv ? Player.armorPts() : 0;
    if (ap > 0) for (let i = 0; i < 10; i++) { const v = ap - i * 2; ab += `<img src="${v >= 2 ? HUD_IMG.armor : v === 1 ? HUD_IMG.armorH : HUD_IMG.armorE}">`; }
    if ($('armorBar').innerHTML !== ab) $('armorBar').innerHTML = ab;
    let b = '';
    if (surv && Player.eyeInWater) {
      const n = Math.ceil(clamp(Player.air, 0, 15) / 1.5);
      for (let i = 0; i < 10; i++) b += i < n ? `<img src="${HUD_IMG.bubble}">` : '<img style="visibility:hidden">';
    }
    if ($('bubbles').innerHTML !== b) $('bubbles').innerHTML = b;
  },
  setStatic(k, burst) {
    const cv = $('staticFx'), game = Game.canvas;
    if (k < 0.01) {
      if (this._sk > 0) { cv.style.opacity = 0; game.style.filter = ''; game.style.transform = ''; this._sk = 0; }
      return;
    }
    this._sk = k;
    if (!this.stx) { this.stx = cv.getContext('2d'); this.simg = this.stx.createImageData(cv.width, cv.height); }
    const W = cv.width, H = cv.height, d = this.simg.data;
    let band = 0, shift = 0;
    const amp = burst ? 240 : 110 + 140 * k;
    for (let y = 0; y < H; y++) {
      if (Math.random() < 0.07) band = (Math.random() - 0.5) * 130; else band *= 0.82;
      const line = Math.random() < 0.035 * k * k ? 90 : 0;
      if (Math.random() < 0.05 * k * k) shift = Math.floor(Math.random() * 30); else if (Math.random() < 0.3) shift = 0;
      for (let x = 0; x < W; x++) {
        const r = Math.random(), v = clamp(r * r * amp + band + line, 0, 255), i = (y * W + ((x + shift) % W)) * 4;
        d[i] = v; d[i + 1] = v * 0.96; d[i + 2] = v * 1.05; d[i + 3] = 255;
      }
    }
    this.stx.putImageData(this.simg, 0, 0);
    cv.style.opacity = ((burst ? 0.85 : 0.025 + 0.48 * k * k * k + (Math.random() < 0.12 * k * k ? 0.2 * k * k : 0)) * (0.75 + Math.random() * 0.25)).toFixed(3);
    game.style.filter = `grayscale(${Math.min(1, k * 0.9).toFixed(2)})`;
    game.style.transform = (k > 0.3 && Math.random() < k * k * 0.6) ? `translate(${((Math.random() - 0.5) * k * k * 22).toFixed(1)}px, ${((Math.random() - 0.5) * k * k * 8).toFixed(1)}px)` : '';
  },
  toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(this._tt); this._tt = setTimeout(() => el.hidden = true, 6000); },
  flashHurt() { const o = $('hurtFx'); o.classList.remove('on'); void o.offsetWidth; o.classList.add('on'); },
  updateHud(dt) {
    this.nameT -= dt;
    $('itemName').style.opacity = clamp(this.nameT, 0, 1);
    if (Player.eyeInWater !== this._eyeW) { this._eyeW = Player.eyeInWater; this.refreshHud(); }
    if (Player.eyeInWater && Game.mode === 'survival') { const n = Math.ceil(clamp(Player.air, 0, 15) / 1.5); if (n !== this._bub) { this._bub = n; this.refreshHud(); } }
    if (Player.health <= 4 && Game.mode === 'survival' && Math.random() < dt * 8) this.refreshHud();
    this.hud.classList.toggle('hidden', this.hideHud);
    const dbg = $('debug');
    if (this.debug) {
      const p = Player, bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      const l = World.light(bx, Math.floor(p.y + EYE), bz);
      const fdir = ['юг (+Z)', 'запад (-X)', 'север (-Z)', 'восток (+X)'];
      const yawDeg = ((p.yaw * 180 / Math.PI) % 360 + 360) % 360;
      const face = fdir[Math.round(((180 - yawDeg) % 360 + 360) % 360 / 90) % 4];
      const t = Game.dayTime, hh = Math.floor((t * 24 + 6) % 24), mm = Math.floor(((t * 24 + 6) % 1) * 60);
      const bio = ['Равнины', 'Лес', 'Пустыня', 'Снега', 'Горы'][World.gen.biome(bx, bz, World.gen.height(bx, bz))];
      dbg.innerHTML = [
        `Alpha 0.1 (${Game.fps} к/с)`,
        `Чанки: ${World.chunks.size} загружено, ${Rend.stats.chunks} видно${Rend.stats.refl ? ', отражения' : ''}`,
        `Вершин: ${(Rend.stats.verts / 1000).toFixed(0)}k`,
        `&nbsp;`,
        `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Блок: ${bx} ${by} ${bz}`,
        `Чанк: ${bx & 15} ${by} ${bz & 15} в ${bx >> 4} ${bz >> 4}`,
        `Смотрит на: ${face}`,
        `Свет: небо ${l >> 4}, блок ${l & 15}`,
        `Биом: ${bio}`,
        `Время: ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} (день ${Game.dayCount + 1})`,
        `Сид: ${World.seed}`,
        `Мутант: ${Ents.mutant.active ? Math.round(Math.hypot(Ents.mutant.x - p.x, Ents.mutant.z - p.z)) + ' бл.' : 'нет'}`
      ].map(s => `<div>${s}</div>`).join('');
      dbg.hidden = false;
    } else dbg.hidden = true;
    $('ver').hidden = this.debug;
  },
  showDeath() {
    document.exitPointerLock && document.exitPointerLock();
    Menus.show('death');
  },
  // ---------- экраны с ячейками ----------
  guiBg(w, h, slots, extra) {
    const [c, x] = pixCanvas(w, h);
    // панель
    x.fillStyle = '#c6c6c6'; x.fillRect(2, 2, w - 4, h - 4);
    x.fillStyle = '#000'; x.fillRect(2, 0, w - 4, 1); x.fillRect(2, h - 1, w - 4, 1); x.fillRect(0, 2, 1, h - 4); x.fillRect(w - 1, 2, 1, h - 4);
    x.fillRect(1, 1, 1, 1); x.fillRect(w - 2, 1, 1, 1); x.fillRect(1, h - 2, 1, 1); x.fillRect(w - 2, h - 2, 1, 1);
    x.fillStyle = '#fff'; x.fillRect(2, 1, w - 5, 2); x.fillRect(1, 2, 2, h - 5);
    x.fillStyle = '#555'; x.fillRect(3, h - 3, w - 5, 2); x.fillRect(w - 3, 3, 2, h - 5);
    for (const s of slots) {
      const big = s.big ? 4 : 0, sx = s.x - 1 - big, sy = s.y - 1 - big, sz = 18 + big * 2;
      x.fillStyle = '#8b8b8b'; x.fillRect(sx, sy, sz, sz);
      x.fillStyle = '#373737'; x.fillRect(sx, sy, sz - 1, 1); x.fillRect(sx, sy, 1, sz - 1);
      x.fillStyle = '#fff'; x.fillRect(sx + 1, sy + sz - 1, sz - 1, 1); x.fillRect(sx + sz - 1, sy + 1, 1, sz - 1);
    }
    if (extra) extra(x);
    return c.toDataURL();
  },
  drawArrow(x, ax, ay, fill = 0) {
    x.fillStyle = '#8b8b8b';
    const draw = (col, lim) => {
      x.fillStyle = col;
      for (let i = 0; i < 22 && i < lim; i++) { const h = i < 15 ? 3 : Math.max(0, 15 - (i - 15) * 2); const hh = i < 15 ? 3 : 15 - (i - 15) * 2; x.fillRect(ax + i, ay + 8 - Math.floor(hh / 2), 1, hh); }
    };
    draw('#8b8b8b', 22); if (fill) draw('#fff', Math.floor(22 * fill));
  },
  drawFlame(x, fx, fy, fill) {
    const rows = ['....#.....', '...##..#..', '..###.##..', '..#######.', '.########.', '.#########', '##########', '##########', '.########.', '..######..'];
    rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
      if (ch !== '#') return;
      const on = (rows.length - yy) / rows.length <= fill;
      x.fillStyle = on ? (yy < 4 ? '#ffdc3c' : yy < 7 ? '#ff9a1c' : '#e0520c') : '#8b8b8b';
      x.fillRect(fx + xx + 2, fy + yy + 2, 1, 1);
    }));
  },
  invSlots(x0 = 8, y0 = 84) {
    const s = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) s.push({ arr: Player.slots, i: 9 + r * 9 + c, x: x0 + c * 18, y: y0 + r * 18, grp: 'inv' });
    for (let c = 0; c < 9; c++) s.push({ arr: Player.slots, i: c, x: x0 + c * 18, y: y0 + 58, grp: 'hot' });
    return s;
  },
  openInventory() {
    if (Game.mode === 'creative') return this.openCreative();
    const slots = this.invSlots();
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) slots.push({ arr: this.craft2, i: j * 2 + i, x: 98 + i * 18, y: 18 + j * 18, grp: 'craft' });
    slots.push({ out: 'craft2', x: 154, y: 28, grp: 'out', big: true });
    for (let i = 0; i < 4; i++) slots.push({ arr: Player.armor, i, x: 8, y: 8 + i * 18, grp: 'armor' });
    this.gui = {
      w: 176, h: 166, slots, labels: [['Создание', 97, 6]],
      bg: () => this.guiBg(176, 166, slots, x => {
        x.fillStyle = '#000'; x.fillRect(27, 7, 50, 72); x.fillStyle = '#191c22'; x.fillRect(28, 8, 48, 70);
        drawPlayerFigure(x, 40, 12);
        this.drawArrow(x, 134 - 12 + 2, 27);
      }),
      grid: this.craft2, size: 2
    };
    this.openScreen('inv');
  },
  openBlockScreen(id, x, y, z) {
    const key = pkey(x, y, z);
    if (id === B.TABLE) {
      const slots = this.invSlots();
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) slots.push({ arr: this.craft3, i: j * 3 + i, x: 30 + i * 18, y: 17 + j * 18, grp: 'craft' });
      slots.push({ out: 'craft3', x: 124, y: 35, grp: 'out', big: true });
      this.gui = { w: 176, h: 166, slots, labels: [['Верстак', 28, 6], ['Инвентарь', 8, 73]], bg: () => this.guiBg(176, 166, slots, xx => this.drawArrow(xx, 90, 35)), grid: this.craft3, size: 3 };
      this.openScreen('table');
      return;
    }
    let cont = World.containers.get(key);
    if (id === B.CHEST) {
      if (!cont) {
        const m = World.mods.get(ckey(x >> 4, z >> 4));
        const placed = m && m.has(bidx(x & 15, y, z & 15));
        cont = { type: 'chest', slots: placed ? new Array(27).fill(null) : lootFor(x, y, z) };
        World.containers.set(key, cont);
      }
      const slots = this.invSlots();
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) slots.push({ arr: cont.slots, i: r * 9 + c, x: 8 + c * 18, y: 18 + r * 18, grp: 'cont' });
      this.gui = { w: 176, h: 166, slots, labels: [['Сундук', 8, 6], ['Инвентарь', 8, 73]], bg: () => this.guiBg(176, 166, slots) };
      Sfx.material('wood', 0.3, true);
    } else {
      if (!cont) { cont = { type: 'furnace', slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 }; World.containers.set(key, cont); }
      const slots = this.invSlots();
      slots.push({ arr: cont.slots, i: 0, x: 56, y: 17, grp: 'cont' });
      slots.push({ arr: cont.slots, i: 1, x: 56, y: 53, grp: 'cont' });
      slots.push({ arr: cont.slots, i: 2, x: 116, y: 35, grp: 'fout', big: true });
      this.gui = {
        w: 176, h: 166, slots, labels: [['Печь', 8, 6], ['Инвентарь', 8, 73]], furnace: cont,
        bg: () => this.guiBg(176, 166, slots, xx => {
          const f = cont; this.drawFlame(xx, 56, 36, f.burnMax ? clamp(f.burn / f.burnMax, 0, 1) : 0);
          this.drawArrow(xx, 79, 34, clamp(f.cook / 10, 0, 1));
        })
      };
    }
    this.openContainerKey = key; this.container = cont;
    this.openScreen(id === B.CHEST ? 'chest' : 'furnace');
  },
  openCreative() {
    const all = Object.keys(ITEMS).map(Number).filter(id => ITEMS[id]);
    const rows = Math.ceil(all.length / 9), vis = 5;
    this.creativeAll = all;
    this.creativeScroll = clamp(this.creativeScroll, 0, Math.max(0, rows - vis));
    const slots = [];
    for (let r = 0; r < vis; r++) for (let c = 0; c < 9; c++) slots.push({ creative: r * 9 + c, x: 8 + c * 18, y: 18 + r * 18, grp: 'crea' });
    for (let c = 0; c < 9; c++) slots.push({ arr: Player.slots, i: c, x: 8 + c * 18, y: 112, grp: 'hot' });
    this.gui = {
      w: 196, h: 136, slots, labels: [['Все предметы', 8, 6], ['Прокрутка колесом · брось сюда предмет, чтобы удалить', 8, 100, 'small']],
      bg: () => this.guiBg(196, 136, slots, x => {
        x.fillStyle = '#8b8b8b'; x.fillRect(174, 17, 14, 90);
        x.fillStyle = '#373737'; x.fillRect(174, 17, 14, 1); x.fillRect(174, 17, 1, 90);
        const maxS = Math.max(1, rows - vis), ty = 18 + Math.round((this.creativeScroll / maxS) * (90 - 17));
        x.fillStyle = '#e0e0e0'; x.fillRect(175, ty, 12, 15); x.fillStyle = '#6b6b6b'; x.fillRect(176, ty + 14, 11, 1); x.fillRect(186, ty + 1, 1, 14);
      }),
      rows, vis
    };
    this.openScreen('creative');
  },
  openScreen(name) {
    this.screen = name;
    Game.releaseMouse();
    this.renderGui();
  },
  closeScreen() {
    if (!this.gui) return;
    // вернуть предметы из сетки и с курсора
    for (const g of [this.craft2, this.craft3]) for (let i = 0; i < g.length; i++) if (g[i]) { const left = giveItem(g[i].id, g[i].count, g[i].dmg); if (left) Ents.dropItem(Player.x, Player.y + 1.4, Player.z, { id: g[i].id, count: left, dmg: g[i].dmg }, false, lookDir()); g[i] = null; }
    if (this.cursor) { const left = giveItem(this.cursor.id, this.cursor.count, this.cursor.dmg); if (left) Ents.dropItem(Player.x, Player.y + 1.4, Player.z, { id: this.cursor.id, count: left, dmg: this.cursor.dmg }, false, lookDir()); this.cursor = null; }
    if (this.screen === 'chest') Sfx.material('wood', 0.25, true);
    this.gui = null; this.screen = null; this.openContainerKey = null; this.container = null;
    this.scr.innerHTML = ''; this.scr.className = ''; this.cur.innerHTML = ''; this.tip.hidden = true;
    this.refreshHotbar();
    Game.captureMouse();
  },
  renderGui() {
    const g = this.gui; if (!g) return;
    this.scr.className = 'dim';
    let h = `<div class="gui" id="guiPanel" style="width:calc(var(--s)*${g.w});height:calc(var(--s)*${g.h})"><img class="guibg" id="guiBg" src="${g.bg()}">`;
    for (const [t, x, y, cls] of g.labels) h += `<div class="glabel ${cls || ''}" style="left:calc(var(--s)*${x});top:calc(var(--s)*${y})">${t}</div>`;
    g.slots.forEach((s, k) => { h += `<div class="slot${s.big ? ' big' : ''}" data-k="${k}" style="left:calc(var(--s)*${s.x});top:calc(var(--s)*${s.y})"></div>`; });
    h += '</div>';
    this.scr.innerHTML = h;
    const panel = $('guiPanel');
    panel.addEventListener('mousedown', e => {
      const el = e.target.closest('.slot'); e.preventDefault(); e.stopPropagation();
      if (!el) return;
      this.clickSlot(g.slots[+el.dataset.k], e.button, e.shiftKey);
    });
    panel.addEventListener('contextmenu', e => e.preventDefault());
    panel.addEventListener('mouseover', e => { const el = e.target.closest('.slot'); this.hover = el ? g.slots[+el.dataset.k] : null; this.updateTip(); });
    panel.addEventListener('mouseleave', () => { this.hover = null; this.updateTip(); });
    panel.addEventListener('wheel', e => { if (this.screen === 'creative') { this.creativeScroll = clamp(this.creativeScroll + Math.sign(e.deltaY), 0, Math.max(0, g.rows - g.vis)); $('guiBg').src = g.bg(); this.renderSlots(); } e.preventDefault(); }, { passive: false });
    this.scr.onmousedown = e => {
      if (e.target !== this.scr || !this.cursor) return;
      // бросить предмет за пределами окна
      const n = e.button === 2 ? 1 : this.cursor.count;
      Ents.dropItem(Player.x, Player.y + 1.4, Player.z, { id: this.cursor.id, count: n, dmg: this.cursor.dmg }, false, lookDir());
      this.cursor.count -= n; if (this.cursor.count <= 0) this.cursor = null;
      this.renderSlots();
    };
    this.scr.oncontextmenu = e => e.preventDefault();
    this.renderSlots();
  },
  slotStack(s) {
    if (s.out) return this.craftResult(s.out);
    if (s.creative !== undefined) { const id = this.creativeAll[s.creative + this.creativeScroll * 9]; return id ? { id, count: 1 } : null; }
    return s.arr[s.i];
  },
  craftResult(which) {
    const grid = which === 'craft2' ? this.craft2 : this.craft3, size = which === 'craft2' ? 2 : 3;
    const r = matchRecipe(grid, size);
    return r ? { id: r.id, count: r.count, dmg: 0 } : null;
  },
  renderSlots() {
    const g = this.gui; if (!g) return;
    const els = this.scr.querySelectorAll('.slot');
    els.forEach((el, k) => { const h = this.stackHTML(this.slotStack(g.slots[k])); if (el._h !== h) { el.innerHTML = h; el._h = h; } });
    this.cur.innerHTML = this.cursor ? this.stackHTML(this.cursor) : '';
    this.updateTip();
  },
  updateTip() {
    const s = this.hover, st = s && !this.cursor ? this.slotStack(s) : null;
    if (!st) { this.tip.hidden = true; return; }
    const it = ITEMS[st.id];
    let h = `<div>${it.name}</div>`;
    if (it.tool && it.tool.dmg) h += `<div class="sub">Урон: ${it.tool.dmg}</div>`;
    if (it.tool) h += `<div class="sub">Прочность: ${it.tool.dur - (st.dmg || 0)} / ${it.tool.dur}</div>`;
    if (it.armor) h += `<div class="sub">Защита: ${it.armor.pts}</div><div class="sub">Прочность: ${it.armor.dur - (st.dmg || 0)} / ${it.armor.dur}</div>`;
    if (Game.mode === 'creative' && s.creative !== undefined) h += `<div class="sub">ЛКМ — стак, ПКМ — один</div>`;
    this.tip.innerHTML = h; this.tip.hidden = false;
  },
  clickSlot(s, btn, shift) {
    if (btn === 1) return;
    if (s.creative !== undefined) {
      const st = this.slotStack(s);
      if (this.cursor) { this.cursor = null; }
      else if (st) this.cursor = { id: st.id, count: btn === 2 ? 1 : maxStack(st.id), dmg: 0 };
      if (shift && st) { giveItem(st.id, maxStack(st.id)); this.cursor = null; }
      this.renderSlots(); return;
    }
    if (s.out) { this.takeOutput(s, shift); this.renderSlots(); return; }
    const arr = s.arr, i = s.i, cur = this.cursor, st = arr[i];
    if (s.grp === 'armor' && cur && !(ITEMS[cur.id].armor && ITEMS[cur.id].armor.slot === s.i)) return;   // в слот брони — только подходящая деталь
    if (shift && st) { this.quickMove(s); this.renderSlots(); return; }
    if (s.grp === 'fout') {
      if (!st) return;
      if (!cur) { this.cursor = st; arr[i] = null; }
      else if (stackEq(cur, st) && cur.count + st.count <= maxStack(st.id)) { cur.count += st.count; arr[i] = null; }
      this.renderSlots(); return;
    }
    if (btn === 0) {
      if (!cur) { this.cursor = st; arr[i] = null; }
      else if (!st) { arr[i] = cur; this.cursor = null; }
      else if (stackEq(cur, st)) { const k = Math.min(maxStack(st.id) - st.count, cur.count); st.count += k; cur.count -= k; if (!cur.count) this.cursor = null; }
      else { arr[i] = cur; this.cursor = st; }
    } else if (btn === 2) {
      if (!cur && st) { const h = Math.ceil(st.count / 2); this.cursor = { id: st.id, count: h, dmg: st.dmg }; st.count -= h; if (!st.count) arr[i] = null; }
      else if (cur && !st) { arr[i] = { id: cur.id, count: 1, dmg: cur.dmg }; cur.count--; if (!cur.count) this.cursor = null; }
      else if (cur && stackEq(cur, st) && st.count < maxStack(st.id)) { st.count++; cur.count--; if (!cur.count) this.cursor = null; }
      else if (cur && st) { arr[i] = cur; this.cursor = st; }
    }
    this.renderSlots();
    if (s.grp === 'hot') this.refreshHotbar();
    if (s.grp === 'armor') this.refreshHud();
  },
  consumeGrid(which) {
    const grid = which === 'craft2' ? this.craft2 : this.craft3;
    for (let i = 0; i < grid.length; i++) if (grid[i]) { grid[i].count--; if (grid[i].count <= 0) grid[i] = null; }
  },
  takeOutput(s, shift) {
    let res = this.craftResult(s.out); if (!res) return;
    if (shift) {
      let guard = 64;
      while (res && guard--) {
        const left = addToSlots(Player.slots, { id: res.id, count: res.count, dmg: 0 }, INV_ORDER);
        if (left) { if (left < res.count) { /* часть не влезла */ Ents.dropItem(Player.x, Player.y + 1.4, Player.z, { id: res.id, count: left }, false, lookDir()); } this.consumeGrid(s.out); break; }
        this.consumeGrid(s.out);
        res = this.craftResult(s.out);
      }
      this.refreshHotbar(); Sfx.pop(); return;
    }
    const cur = this.cursor;
    if (!cur) this.cursor = res;
    else if (cur.id === res.id && !ITEMS[res.id].tool && !ITEMS[res.id].armor && cur.count + res.count <= maxStack(res.id)) cur.count += res.count;
    else return;
    this.consumeGrid(s.out);
    Sfx.pop();
  },
  quickMove(s) {
    const st = s.arr[s.i]; if (!st) return;
    const ar = ITEMS[st.id].armor;
    if (ar && s.grp !== 'armor' && this.gui.slots.some(q => q.grp === 'armor') && !Player.armor[ar.slot]) { Player.armor[ar.slot] = st; s.arr[s.i] = null; Sfx.material('stone', 0.5, true); this.refreshHotbar(); this.refreshHud(); return; }
    let targets;
    if (s.grp === 'hot') targets = this.container && this.gui.slots.some(q => q.grp === 'cont') ? this.contTargets(st) : Array.from({ length: 27 }, (_, k) => 9 + k);
    else if (s.grp === 'inv') targets = this.container && this.gui.slots.some(q => q.grp === 'cont') ? this.contTargets(st) : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    else targets = [8, 7, 6, 5, 4, 3, 2, 1, 0].concat(Array.from({ length: 27 }, (_, k) => 35 - k));
    let arr = Player.slots;
    if (targets && targets.cont) { arr = targets.arr; targets = targets.idx; }
    const tmp = { id: st.id, count: st.count, dmg: st.dmg };
    const left = addToSlots(arr, tmp, targets);
    if (left) st.count = left; else s.arr[s.i] = null;
    this.refreshHotbar();
  },
  contTargets(st) {
    const c = this.container;
    if (c.type === 'chest') { const r = Array.from({ length: 27 }, (_, k) => k); r.cont = true; return { cont: true, arr: c.slots, idx: r }; }
    // печь: топливо или сырьё
    const idx = SMELT[st.id] !== undefined ? [0] : fuelOf(st.id) ? [1] : [0];
    return { cont: true, arr: c.slots, idx };
  },
  swapHotbar(n) {
    const s = this.hover; if (!s || !s.arr || s.out || s.creative !== undefined) {
      if (s && s.creative !== undefined) { const st = this.slotStack(s); if (st) { Player.slots[n] = { id: st.id, count: maxStack(st.id), dmg: 0 }; this.refreshHotbar(); } }
      return;
    }
    if (s.grp === 'armor') { const o = Player.slots[n]; if (o && !(ITEMS[o.id].armor && ITEMS[o.id].armor.slot === s.i)) return; }
    const a = s.arr[s.i]; s.arr[s.i] = Player.slots[n]; Player.slots[n] = a;
    this.refreshHotbar(); this.renderSlots(); this.refreshHud();
  },
  tickGui() {
    if (this.gui && this.gui.furnace) {
      const f = this.gui.furnace, sig = `${Math.round(f.burn * 4)}|${Math.round(f.cook * 4)}|${JSON.stringify(f.slots)}`;
      if (sig !== this._fsig) { this._fsig = sig; $('guiBg').src = this.gui.bg(); this.renderSlots(); }
    }
  }
};
// простая фигурка игрока в окне инвентаря (обобщённый человечек)
function drawPlayerFigure(x, ox, oy) {
  const R = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(ox + a, oy + b, w, h); };
  R('#3b2a1e', 8, 0, 8, 3); R('#c4906a', 8, 3, 8, 5); R('#2a1c14', 9, 4, 2, 1); R('#2a1c14', 13, 4, 2, 1);
  R('#6d6f77', 8, 8, 8, 12); R('#595b62', 4, 8, 4, 12); R('#595b62', 16, 8, 4, 12);
  R('#c4906a', 4, 19, 4, 3); R('#c4906a', 16, 19, 4, 3);
  R('#39404c', 8, 20, 4, 12); R('#323843', 12, 20, 4, 12); R('#2a2a2a', 8, 31, 8, 2);
  for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(ox + 8 + (i % 8), oy + 8 + i, 1, 1); }
}
function furnaceTick(f, key, dt) {
  const s = f.slots, inp = s[0], fuel = s[1], out = s[2];
  const res = inp ? SMELT[inp.id] : undefined;
  const canOut = res !== undefined && (!out || (out.id === res && out.count < maxStack(res)));
  if (f.burn > 0) f.burn -= dt;
  if (f.burn <= 0 && canOut && fuel && fuelOf(fuel.id)) {
    f.burn = f.burnMax = fuelOf(fuel.id); fuel.count--; if (fuel.count <= 0) s[1] = null;
  }
  if (f.burn > 0 && canOut) {
    f.cook += dt;
    if (f.cook >= 10) {
      f.cook = 0; inp.count--; if (inp.count <= 0) s[0] = null;
      if (out) out.count++; else s[2] = { id: res, count: 1, dmg: 0 };
    }
  } else f.cook = Math.max(0, f.cook - dt * 3);
  if (f.burn < 0) f.burn = 0;
  const [x, y, z] = key.split(',').map(Number);
  const cur = World.get(x, y, z), want = f.burn > 0 ? B.FURNACE_LIT : B.FURNACE;
  if ((cur === B.FURNACE || cur === B.FURNACE_LIT) && cur !== want) {
    const o = World.orientOf(x, y, z);
    World.set(x, y, z, want); World.orient.set(key, o);
  }
}
