// ============================================================
//  Меню: заставка, миры, пауза, настройки, смерть
// ============================================================
const SPLASHES = ['Ты здесь не один!', 'Не оглядывайся!', 'Кто поставил этот факел?', 'Туман не рассеется', 'Слышишь шаги?',
  'Альфа-версия!', 'Копай глубже!', 'Не спи в пещере!', 'Сделано из кубов!', 'Сто процентов процедурно!', 'Он смотрит из тумана', 'Факелы кончаются!'];
const LOGO_FONT = {
  'Т': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'У': ['#...#', '#...#', '#...#', '.#.#.', '..#..', '.#...', '#....'],
  'М': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'А': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'Н': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'Ы': ['#...#', '#...#', '#...#', '###.#', '#..##', '#..##', '###.#'],
  'Й': ['#...#', '#..##', '#..##', '#.#.#', '##..#', '##..#', '#...#'],
  'К': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'Р': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  ' ': ['...', '...', '...', '...', '...', '...', '...']
};
const LOGO_BREVE = { 'Й': ['.#.#.', '..#..'] };
function renderLogo() {
  const lines = ['ТУМАННЫЙ', 'КРАЙ'];
  const P = 7, D = 3, TOPPAD = 3;
  const lineW = l => [...l].reduce((w, ch) => w + LOGO_FONT[ch][0].length + 1, -1);
  const W = Math.max(...lines.map(lineW)) * P + D + 4, H = (lines.length * 10 + TOPPAD) * P + D + 4;
  const [c, x] = pixCanvas(W, H);
  const stone = TILES_DATA.stone, cob = TILES_DATA.cobble;
  const pixels = [];
  lines.forEach((l, li) => {
    let cx = Math.floor((Math.max(...lines.map(lineW)) - lineW(l)) / 2);
    for (const ch of l) {
      const g = LOGO_FONT[ch];
      const oy = li * 10 + TOPPAD;
      g.forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '#') pixels.push([(cx + rx) * P, (oy + ry) * P]); }));
      if (LOGO_BREVE[ch]) LOGO_BREVE[ch].forEach((row, ry) => [...row].forEach((b, rx) => { if (b === '#') pixels.push([(cx + rx) * P, (oy - 3 + ry) * P]); }));
      cx += g[0].length + 1;
    }
  });
  // выдавливание
  for (let d = D; d > 0; d--) for (const [px, py] of pixels) { x.fillStyle = d === D ? '#0d0d0f' : '#2a2a2e'; x.fillRect(px + d, py + d, P, P); }
  for (const [px, py] of pixels) {
    for (let yy = 0; yy < P; yy++) for (let xx = 0; xx < P; xx++) {
      const t = (px + py) % 3 === 0 ? cob : stone;
      const [r, g, b] = t.get((px + xx) & 15, (py + yy) & 15);
      let f = 1.0; if (yy === 0 || xx === 0) f = 1.25; if (yy === P - 1 || xx === P - 1) f = 0.7;
      x.fillStyle = `rgb(${r * f},${g * f},${b * f})`; x.fillRect(px + xx, py + yy, 1, 1);
    }
  }
  return c.toDataURL();
}
function dirtBg() {
  const [c, x] = pixCanvas(16, 16);
  const t = TILES_DATA.dirt;
  for (let y = 0; y < 16; y++) for (let xx = 0; xx < 16; xx++) { const [r, g, b] = t.get(xx, y); x.fillStyle = `rgb(${r * 0.25},${g * 0.25},${b * 0.25})`; x.fillRect(xx, y, 1, 1); }
  return c.toDataURL();
}
function btnTex() {
  const [c, x] = pixCanvas(16, 16);
  const t = TILES_DATA.stone;
  for (let y = 0; y < 16; y++) for (let xx = 0; xx < 16; xx++) { const [r] = t.get(xx, y); const v = 96 + (r - 124) * 0.5; x.fillStyle = `rgb(${v},${v},${v + 2})`; x.fillRect(xx, y, 1, 1); }
  return c.toDataURL();
}

const NET_RULE = 'Пока вы играете с интернетом, ваш мир виден владельцу игры: он может зайти в любой онлайн-мир.';
const Menus = {
  cur: null, from: null, confirmNew: false, confirmDel: 0,
  init() {
    document.documentElement.style.setProperty('--dirt', `url(${dirtBg()})`);
    document.documentElement.style.setProperty('--btn', `url(${btnTex()})`);
    this.logo = renderLogo();
    this.el = $('menu');
    this.el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      Sfx.init(); Sfx.click();
      this.act(b.dataset.act, b);
    });
  },
  btn(label, act, cls = '') { return `<button class="mcb ${cls}" data-act="${act}">${label}</button>`; },
  show(name) {
    this.cur = name;
    const e = this.el; e.hidden = false;
    const inGame = Game.state === 'play';
    e.className = (inGame && name !== 'loading') ? 'menu dim' : 'menu dirt';
    let h = '';
    if (name === 'title') {
      const sp = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
      h = `<div class="logoWrap"><img class="logo" src="${this.logo}" alt="Туманный Край"><div class="splash">${sp}</div></div>
      <div class="col">${this.btn('Одиночная игра', 'worlds')}
      ${Net.enabled() && Net.isOwner ? this.btn('Игра с другом', 'net') : ''}
      ${Net.isOwner ? this.btn('Миры пользователей', 'owner') : ''}
      <div class="row">${this.btn('Настройки', 'settings', 'half')}${this.btn('Управление', 'controls', 'half')}</div>
      ${Net.enabled() && !Net.isOwner && /owner/.test(location.hash) ? this.btn('Вход владельца', 'ownerLogin', 'tiny') : ''}</div>
      ${matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches ? '<div class="note">Для игры нужны клавиатура и мышь</div>' : ''}
      <div class="foot"><span>Туманный Край альфа 0.1</span><span>Текстуры и звуки созданы кодом</span></div>`;
    } else if (name === 'worlds') {
      const ns = Game.newSlot, svNew = Game.savedInfo(ns);
      h = `<div class="mtitle">Одиночная игра</div><div class="col">`;
      for (let n = 1; n <= SLOTS; n++) {
        const sv = Game.savedInfo(n), sel = n === ns;
        if (sv) h += `<div class="row wslot${sel ? ' sel' : ''}">${this.btn(`${sel ? '▶ ' : ''}${n}. «${sv.name}» · ${sv.mode === 'creative' ? 'Творч.' : 'Выжив.'} · день ${sv.day}`, 'play:' + n, 'slotb')}${this.btn(this.confirmDel === n ? 'Точно?' : 'Удалить', 'del:' + n, 'tiny' + (this.confirmDel === n ? ' warn' : ''))}</div>`;
        else h += `<div class="row wslot${sel ? ' sel' : ''}">${this.btn(`${sel ? '▶ ' : ''}${n}. Пусто`, 'pick:' + n, 'slotb')}${this.btn(sel ? 'Выбран' : 'Выбрать', 'pick:' + n, 'tiny' + (sel ? ' on' : ''))}</div>`;
      }
      h += `<div class="sep">Новый мир → слот ${ns}</div>
        <label class="lbl" for="seedIn">Сид мира (пусто — случайный)</label>
        <input id="seedIn" class="mcin" maxlength="32" autocomplete="off" spellcheck="false">
        ${this.btn('Режим: ' + (Game.newMode === 'creative' ? 'Творческий' : 'Выживание'), 'mode')}
        <div class="note">${Game.newMode === 'creative' ? 'Бесконечные блоки, полёт (двойной пробел), мгновенная ломка' : 'Добывай, крафти, береги здоровье. Ночью и в пещерах опасно'}</div>
        ${this.btn(svNew && this.confirmNew ? `Заменить мир в слоте ${ns}?` : `Создать новый мир (слот ${ns})`, 'create', svNew && this.confirmNew ? 'warn' : '')}
        ${this.btn('Назад', 'title')}</div>
        ${Net.enabled() ? '<div class="note">' + NET_RULE + '</div>' : ''}`;
    } else if (name === 'net') {
      h = `<div class="mtitle">Игра с другом</div><div class="col">
        <label class="lbl" for="nickIn">Ваш ник</label><input id="nickIn" class="mcin" maxlength="16" autocomplete="off" spellcheck="false">
        <div class="note">Чтобы друг зашёл к вам: начните свой мир, нажмите Esc — там будет код мира. Чтобы зайти к другу: введите его код.</div>
        <label class="lbl" for="codeIn">Код мира друга</label><input id="codeIn" class="mcin" maxlength="8" autocomplete="off" spellcheck="false">
        ${this.btn('Подключиться', 'netjoin')}
        <div class="note" id="netStatus">${Net.err ? 'Ошибка: ' + Net.err : ''}</div>
        ${this.btn('Назад', 'title')}</div><div class="note">${NET_RULE}</div>`;
    } else if (name === 'owner') {
      h = `<div class="mtitle">Миры пользователей</div><div class="olist" id="ownerList"><div class="note">Загрузка…</div></div>
        <div class="col"><div class="note" id="netStatus"></div>
        <div class="row">${this.btn('Обновить', 'owner', 'half')}${this.btn('Выйти из аккаунта', 'ownerout', 'half')}</div>
        ${this.btn('Назад', 'title')}</div>`;
    } else if (name === 'ownerLogin') {
      h = `<div class="mtitle">Вход владельца</div><div class="col">
        <label class="lbl" for="ownEmail">Почта</label><input id="ownEmail" class="mcin" autocomplete="username" spellcheck="false">
        <label class="lbl" for="ownPass">Пароль</label><input id="ownPass" class="mcin" type="password" autocomplete="current-password">
        ${this.btn('Войти', 'ownerdo')}<div class="note" id="netStatus"></div>${this.btn('Назад', 'title')}</div>`;
    } else if (name === 'loading') {
      h = `<div class="mtitle">Генерация мира</div><div class="note" id="loadNote">Строим ландшафт…</div><div class="bar"><b id="loadBar"></b></div>`;
    } else if (name === 'pause') {
      h = `<div class="mtitle">Меню игры</div><div class="col">${this.btn('Вернуться к игре', 'resume')}
        <div class="row">${this.btn('Настройки', 'settings', 'half')}${this.btn('Управление', 'controls', 'half')}</div>
        ${this.btn(Net.role === 'guest' ? 'Выйти из чужого мира' : 'Сохранить и выйти в меню', 'quit')}</div>
        ${Net.role === 'host' && Net.code && Net.isOwner ? `<div class="note">Код мира для друга: <b class="netcode">${Net.code}</b></div>` : ''}
        ${Net.role === 'guest' ? '<div class="note">Вы в чужом мире — ваши действия видит хозяин, мир сохраняется у него</div>' : ''}`;
    } else if (name === 'death') {
      h = `<div class="mtitle death">Вы погибли!</div><div class="note">Вещи остались на месте гибели</div><div class="col">${this.btn('Возродиться', 'respawn')}${this.btn('Выйти в меню', 'quit')}</div>`;
      e.className = 'menu deathbg';
    } else if (name === 'settings') {
      const S = Game.settings;
      const sl = (k, label, min, max, step, fmt) => `<div class="mcs" data-k="${k}" data-min="${min}" data-max="${max}" data-step="${step}"><i style="left:${((S[k] - min) / (max - min)) * 100}%"></i><span>${label}: ${fmt(S[k])}</span></div>`;
      const pct = v => Math.round(v * 100) + '%';
      const tg = (k, label, on = 'Вкл', off = 'Выкл') => this.btn(`${label}: ${S[k] ? on : off}`, 'tog:' + k, 'half');
      h = `<div class="mtitle">Настройки</div><div class="grid2">
        ${sl('render', 'Дальность', 3, 12, 1, v => v + ' чанков')}${sl('fov', 'Поле зрения', 50, 110, 1, v => v + '°')}
        ${sl('sens', 'Чувствительность', 0, 1, 0.01, pct)}${sl('bright', 'Яркость', 0, 1, 0.01, v => v < 0.05 ? 'Мрачно' : v > 0.95 ? 'Ярко' : pct(v))}
        ${sl('vol', 'Громкость', 0, 1, 0.01, pct)}${sl('music', 'Музыка', 0, 1, 0.01, pct)}
        ${tg('refl', 'Отражения воды')}${tg('fogThick', 'Туман', 'Густой', 'Обычный')}
        ${tg('clouds', 'Облака')}${tg('bob', 'Покачивание')}
        ${tg('figure', 'Фигура в тумане')}${tg('mutant', 'Мутант (ночью и днём)')}
        ${tg('shadows', 'Силуэты')}${this.btn('Интерфейс: ' + (S.gui ? '×' + S.gui : 'Авто'), 'gui', 'half')}
        ${this.btn('Полный экран', 'fullscreen', 'half wide')}
        ${sl('res', 'Разрешение', 0.4, 1, 0.05, pct).replace('class="mcs"', 'class="mcs wide"')}
        </div><div class="col">${this.btn('Готово', 'back')}</div>`;
    } else if (name === 'controls') {
      const rows = [['W A S D', 'ходьба'], ['Пробел', 'прыжок / плыть вверх'], ['Shift', 'красться (не упадёшь с края)'], ['Ctrl + W или W дважды', 'бег'],
        ['ЛКМ', 'ломать блок (держать)'], ['ПКМ', 'поставить блок / открыть верстак, печь, сундук'], ['Колесо, 1–9', 'выбор слота'],
        ['E', 'инвентарь'], ['Q', 'выбросить предмет'], ['СКМ', 'взять блок (творческий)'], ['Пробел ×2', 'полёт (творческий)'], ['F3', 'отладка'], ['F1', 'скрыть интерфейс'], ['Esc', 'меню']];
      h = `<div class="mtitle">Управление</div><div class="keys">${rows.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div>
        <div class="note">В инвентаре: ЛКМ — взять стак, ПКМ — половину или один, Shift+ЛКМ — быстро переложить, 1–9 над ячейкой — в хотбар</div>
        <div class="col">${this.btn('Готово', 'back')}</div>`;
    }
    e.innerHTML = h;
    if (name === 'settings') this.bindSliders();
    if (name === 'net') { const n = $('nickIn'); n.value = Game.settings.nick || ''; n.oninput = () => { Game.settings.nick = n.value; Game.saveSettings(); }; }
    if (name === 'owner') this.fillOwner();
    if (name === 'worlds') { const i = $('seedIn'); i.value = Game.newSeed || ''; i.oninput = () => { Game.newSeed = i.value; }; }
  },
  netStatus(t) { const e = $('netStatus'); if (e) e.textContent = t; },
  fillOwner() {
    Net.listRooms().then(list => {
      const el = $('ownerList'); if (!el || this.cur !== 'owner') return;
      const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const ago = t => { const m = Math.floor((Date.now() - (t || 0)) / 60000); return m < 1 ? 'только что' : m + ' мин назад'; };
      el.innerHTML = list.length ? list.map(r => `<div class="orow"><div>${esc(r.n)} — «${esc(r.w)}»<small>${r.mode === 'creative' ? 'Творческий' : 'Выживание'} · день ${(r.c || 0) + 1} · гостей: ${r.players > 1 ? r.players - 1 : 0} · обновлено ${ago(r.t)}</small></div>${this.btn('Войти', 'oj:' + r.code, 'tiny')}</div>`).join('')
        : '<div class="note">Сейчас никто не играет онлайн</div>';
    }).catch(e => this.netStatus('Ошибка: ' + e.message));
  },
  hide() { this.cur = null; this.el.hidden = true; this.el.innerHTML = ''; },
  bindSliders() {
    this.el.querySelectorAll('.mcs').forEach(el => {
      const k = el.dataset.k, min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step;
      const set = (ev) => {
        const r = el.getBoundingClientRect();
        let v = min + clamp((ev.clientX - r.left) / r.width, 0, 1) * (max - min);
        v = Math.round(v / step) * step; v = +v.toFixed(3);
        if (Game.settings[k] !== v) { Game.settings[k] = v; Game.applySettings(); this.show('settings'); }
      };
      el.addEventListener('mousedown', ev => {
        set(ev);
        const mv = e2 => { const nel = this.el.querySelector(`.mcs[data-k="${k}"]`); if (nel) { const r = nel.getBoundingClientRect(); set({ clientX: e2.clientX, target: nel }); } };
        const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); Game.saveSettings(); };
        addEventListener('mousemove', mv); addEventListener('mouseup', up);
      });
    });
  },
  act(a, b) {
    if (a === 'worlds') { this.confirmNew = false; this.confirmDel = 0; Game.newSlot = Game.freeSlot(); this.show('worlds'); }
    else if (a.startsWith('pick:')) { Game.newSlot = +a.slice(5); this.confirmNew = false; this.confirmDel = 0; this.show('worlds'); }
    else if (a.startsWith('play:')) Game.loadWorld(+a.slice(5));
    else if (a.startsWith('del:')) {
      const n = +a.slice(4);
      if (this.confirmDel !== n) { this.confirmDel = n; this.show('worlds'); return; }
      lsDel(slotKey(n)); this.confirmDel = 0; if (Game.newSlot === n) this.confirmNew = false; this.show('worlds');
    }
    else if (a === 'title') this.show('title');
    else if (a === 'net' || a === 'owner' || a === 'ownerLogin') this.show(a);
    else if (a === 'netjoin') { this.netStatus('Подключение…'); Net.join($('codeIn').value, false).catch(e => this.netStatus(e.message)); }
    else if (a.startsWith('oj:')) { this.netStatus('Подключение…'); Net.join(a.slice(3), true).catch(e => this.netStatus(e.message)); }
    else if (a === 'ownerdo') { this.netStatus('Вход…'); Net.ownerLogin($('ownEmail').value, $('ownPass').value).then(() => this.show('title')).catch(e => this.netStatus(e.message)); }
    else if (a === 'ownerout') Net.ownerLogout().then(() => this.show('title'));
    else if (a === 'settings' || a === 'controls') { this.from = this.cur; this.show(a); }
    else if (a === 'back') { Game.saveSettings(); this.show(this.from || (Game.state === 'play' ? 'pause' : 'title')); }
    else if (a === 'mode') { Game.newMode = Game.newMode === 'creative' ? 'survival' : 'creative'; this.show('worlds'); }
    else if (a === 'create') {
      if (Game.savedInfo(Game.newSlot) && !this.confirmNew) { this.confirmNew = true; this.show('worlds'); return; }
      const s = (Game.newSeed || '').trim();
      Game.newWorld(s ? strSeed(s) : (Math.random() * 2147483647) | 0, Game.newMode, s || null);
    }
    else if (a === 'resume') { this.hide(); Game.captureMouse(true); }
    else if (a === 'quit') { Game.saveWorld(); Game.toTitle(); }
    else if (a === 'respawn') { Game.respawn(); }
    else if (a.startsWith('tog:')) { const k = a.slice(4); Game.settings[k] = !Game.settings[k]; Game.applySettings(); Game.saveSettings(); this.show('settings'); }
    else if (a === 'gui') { Game.settings.gui = (Game.settings.gui + 1) % 5; Game.applySettings(); Game.saveSettings(); this.show('settings'); }
    else if (a === 'fullscreen') {
      const d = document.documentElement;
      try { if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(() => { }); } catch (e) { }
    }
  }
};
