// ============================================================
//  Сетевая игра через Supabase (Realtime + одна таблица комнат).
//  Каждый игрок, пока играет с интернетом, «держит» комнату своего мира.
//  Друг заходит по коду комнаты, владелец игры видит список всех комнат и заходит в любую.
// ============================================================
// Настройки проекта Supabase. Пока url или anonKey пусты, сетевые функции выключены.
const NET_CONFIG = {
  url: 'https://kqomsznvqwnntnivjafk.supabase.co',   // Project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtxb21zem52cXdubnRuaXZqYWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NjUxOTAsImV4cCI6MjEwNzM0MTE5MH0.esFiNYcKJ9dNtXNPfcPFlkueq5FsYwvRnn3uxGGRLJM',   // публичный anon-ключ (Settings → API → Legacy)
  ownerEmail: 'Ertyunjoki@hotmail.com'   // почта аккаунта владельца
};
const NET_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const NET_SNAP_CHUNK = 100000;   // снимок мира отправляется кусками, чтобы не упереться в лимит сообщения

const Net = {
  loaded: false, loading: null, sb: null, ch: null, uid: null, isOwner: false, err: '',
  role: null,               // 'host' | 'guest' | null
  code: null, hostUid: null, guestOwner: false, joining: false,
  peers: new Map(),         // uid -> { n, o, x, y, z, ya, pi, h, s, cx, cy, cz, cya, walk, seen }
  cap: 0, applying: false, dirty: new Map(), flushT: 0, sendT: 0, lastSent: '', lastSentT: 0, timeT: 0, hbT: 0,
  snapWait: null, evQueue: [], subs: [],
  vanish: false, cmdOn: false, form: 'player',
  nPres: 1, lastJoinT: -1e9, fxT: 0, fxOn: false, fxTgt: null, fxK: [0, 0, 0, 0, 0, 0], fxTv: 'anim', fxSendT: 0, fxWas: false,
  // ---------- настройка ----------
  cfg() {
    let o = null; try { o = JSON.parse(lsGet('tk_net_cfg') || 'null'); } catch (e) { }
    return o && o.url && o.anonKey ? o : NET_CONFIG;
  },
  enabled() { const c = this.cfg(); return !!(c.url && c.anonKey); },
  nick() { return ((Game.settings.nick || '').trim() || 'Игрок').slice(0, 16); },
  script(src) {
    return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('нет связи: ' + src)); document.head.appendChild(s); });
  },
  load() {
    if (this.loaded) return Promise.resolve(true);
    if (!this.enabled()) return Promise.reject(new Error('Сетевая игра не настроена'));
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (typeof supabase === 'undefined') throw new Error('Библиотека сети не загрузилась');
      const c = this.cfg();
      this.sb = supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      const { data } = await this.sb.auth.getSession();
      if (!data.session) {
        const r = await this.sb.auth.signInAnonymously();
        if (r.error) throw new Error('Включите анонимный вход: Authentication → Sign In / Providers → Anonymous');
      }
      await this.setUser();
      this.loaded = true;
      return true;
    })();
    this.loading.catch(e => { this.err = e.message; this.loading = null; });
    return this.loading;
  },
  async setUser() {
    const { data } = await this.sb.auth.getSession();
    const u = data.session ? data.session.user : null, own = (this.cfg().ownerEmail || '').toLowerCase();
    this.uid = u ? u.id : null;
    this.isOwner = !!(u && u.email && own && u.email.toLowerCase() === own);
  },
  // при запуске игры: если владелец уже входил в этом браузере — показать его кнопку
  boot() { if (this.enabled()) this.load().then(() => { if (Menus.cur === 'title') Menus.show('title'); }).catch(() => { }); },
  async ownerLogin(email, pass) {
    await this.load();
    const r = await this.sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (r.error) throw new Error('Неверная почта или пароль');
    await this.setUser();
    if (!this.isOwner) { await this.sb.auth.signOut(); await this.sb.auth.signInAnonymously(); await this.setUser(); throw new Error('Этот аккаунт не владелец игры'); }
  },
  async ownerLogout() { await this.sb.auth.signOut(); await this.sb.auth.signInAnonymously(); await this.setUser(); },
  // ---------- канал комнаты (Realtime) ----------
  makeChannel(code) {
    const ch = this.sb.channel('tk-room-' + code, { config: { broadcast: { self: false }, presence: { key: this.uid } } });
    ch.on('broadcast', { event: 'pos' }, m => this.onPos(m.payload))
      .on('broadcast', { event: 'ev' }, m => this.onEv(m.payload))
      .on('broadcast', { event: 'time' }, m => this.onTime(m.payload))
      .on('broadcast', { event: 'join' }, m => this.onJoin(m.payload))
      .on('broadcast', { event: 'snap' }, m => this.onSnap(m.payload))
      .on('broadcast', { event: 'bye' }, m => this.onBye(m.payload))
      .on('broadcast', { event: 'fx' }, m => this.onFx(m.payload))
      .on('broadcast', { event: 'fxs' }, m => this.onFxs(m.payload))
      .on('broadcast', { event: 'cry' }, m => this.onCry(m.payload))
      .on('presence', { event: 'sync' }, () => { try { this.nPres = this.ch ? Object.keys(this.ch.presenceState()).length : 1; } catch (e) { } })
      .on('presence', { event: 'join' }, m => this.onPresJoin(m.newPresences || []))
      .on('presence', { event: 'leave' }, m => this.onPresLeave(m.leftPresences || []));
    return ch;
  },
  subscribe(ch) {
    return new Promise((ok, bad) => {
      const tm = setTimeout(() => bad(new Error('нет связи с сервером')), 15000);
      ch.subscribe(st => {
        if (st === 'SUBSCRIBED') { clearTimeout(tm); ok(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(tm); bad(new Error('нет связи с сервером')); }
      });
    });
  },
  send(event, payload) {
    if (!this.ch) return;
    // хозяин один в мире — не тратим сообщения впустую (лимит бесплатного плана)
    if (this.role === 'host' && event !== 'snap' && this.nPres < 2 && performance.now() - this.lastJoinT > 120000) return;
    this.ch.send({ type: 'broadcast', event, payload });
  },
  // ---------- комната хозяина ----------
  newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; },
  async startHost() {
    if (this.role || !this.enabled()) return;
    try { await this.load(); } catch (e) { return; }
    if (Game.state !== 'play' || this.role) return;
    const code = this.newCode();
    this.role = 'host'; this.code = code;
    try {
      const row = { code, host: this.uid, n: this.nick(), owner: this.isOwner ? 1 : 0, w: Game.worldName, seed: World.seed, mode: Game.mode, d: Game.dayTime, c: Game.dayCount, pl: 1, updated_at: new Date().toISOString() };
      const r = await this.sb.from('rooms').insert(row);
      if (r.error) throw new Error(r.error.message);
      this.ch = this.makeChannel(code);
      await this.subscribe(this.ch);
      await this.ch.track({ u: this.uid, n: this.nick(), o: this.isOwner ? 1 : 0, h: 1 });
      this.nPres = 1; this.timeT = 0; this.hbT = 5; this.fxWas = false;
    } catch (e) { this.err = e.message; this.stop(); }
  },
  // снимок мира для нового гостя: всё, что игрок изменил, плюс время и позиция хозяина
  snapshot() {
    return JSON.stringify({
      seed: World.seed, mode: Game.mode, w: Game.worldName, d: Game.dayTime, c: Game.dayCount, at: [Player.x, Player.y, Player.z],
      mods: [...World.mods].map(([k, m]) => { const a = []; for (const [i, id] of m) a.push(i, id); return [k, a]; }),
      orient: [...World.orient]
    });
  },
  onJoin(v) {
    if (this.role !== 'host' || !v || !v.u || v.u === this.uid) return;
    this.lastJoinT = performance.now();
    const s = this.snapshot(), a = Math.random().toString(36).slice(2), N = Math.max(1, Math.ceil(s.length / NET_SNAP_CHUNK));
    for (let i = 0; i < N; i++) this.send('snap', { to: v.u, a, i, n: N, s: s.slice(i * NET_SNAP_CHUNK, (i + 1) * NET_SNAP_CHUNK) });
  },
  onSnap(v) {
    const w = this.snapWait;
    if (!w || !v || v.to !== this.uid) return;
    if (!w.a) w.a = v.a;                       // принимаем только первый ответ хозяина, куски одного снимка
    if (v.a !== w.a || w.parts[v.i] !== undefined) return;
    w.parts[v.i] = v.s; w.n = v.n; w.got++;
    if (w.got === w.n && w.resolve) { const r = w.resolve; w.resolve = null; r(w.parts.join('')); }
  },
  // ---------- вход в чужой мир ----------
  async join(code, asOwner) {
    if (this.joining) return;
    this.joining = true;
    try {
      await this.load();
      code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) throw new Error('Код — 6 символов');
      const r = await this.sb.rpc('get_room', { p_code: code });
      if (r.error) throw new Error('Не удалось проверить код: ' + r.error.message);
      const meta = Array.isArray(r.data) ? r.data[0] : r.data;
      if (!meta) throw new Error('Мир с таким кодом не найден или хозяин вышел');
      if (meta.host === this.uid) throw new Error('Это ваш собственный мир');
      Menus.netStatus('Подключение к миру «' + meta.w + '»…');
      this.role = 'guest'; this.code = code; this.guestOwner = !!asOwner; this.hostUid = meta.host;
      const w = { a: null, parts: [], n: -1, got: 0, resolve: null, tm: 0 };
      this.snapWait = w;
      const got = new Promise((ok, bad) => { w.resolve = ok; w.tm = setTimeout(() => bad(new Error('Хозяин мира не ответил')), 20000); });
      this.vanish = !!asOwner;                      // владелец заходит невидимым
      const ch = this.makeChannel(code); this.ch = ch;
      await this.subscribe(ch);
      await ch.track({ u: this.uid, n: this.nick(), o: asOwner ? 1 : 0, h: 0, v: this.vanish ? 1 : 0 });
      const ask = () => { if (!w.a) this.send('join', { u: this.uid, n: this.nick(), o: asOwner ? 1 : 0 }); };
      ask(); const rt = setInterval(ask, 5000);
      let text;
      try { text = await got; } finally { clearInterval(rt); clearTimeout(w.tm); }
      const snap = JSON.parse(text);
      const q = this.evQueue; this.snapWait = null; this.evQueue = [];
      Game.loadSnapshot(snap, asOwner ? 'creative' : snap.mode, meta);
      for (const v of q) this.applyBlocks(v.b || []);
    } catch (e) {
      this.stop(); throw e;
    } finally { this.joining = false; }
  },
  // ---------- приём сообщений ----------
  onPos(v) {
    if (!v || v.u === this.uid) return;
    let q = this.peers.get(v.u);
    if (!q) { q = { cx: v.x, cy: v.y, cz: v.z, cya: v.ya, walk: 0, wph: 0 }; this.peers.set(v.u, q); }
    Object.assign(q, v); q.seen = performance.now();
  },
  onEv(v) {
    if (!v || v.u === this.uid) return;
    if (this.snapWait) this.evQueue.push(v); else this.applyBlocks(v.b || []);
  },
  onTime(v) {
    if (this.role === 'guest' && v && typeof v.d === 'number' && Math.abs(v.d - Game.dayTime) > 0.004) { Game.dayTime = v.d; Game.dayCount = v.c || 0; }
  },
  onPresJoin(list) {
    for (const p of list) if (p.u !== this.uid && this.role === 'host' && !p.o && !p.h) UI.toast((p.n || 'Игрок') + ' зашёл в мир');
  },
  onPresLeave(list) {
    for (const p of list) {
      if (p.u === this.uid) continue;
      if (this.role === 'guest' && p.u === this.hostUid) { this.stop(); Game.toTitle(); UI.toast('Хозяин мира вышел из игры'); return; }
      const q = this.peers.get(p.u);
      if (q && this.role === 'host' && !q.o) UI.toast((q.n || 'Игрок') + ' вышел из мира');
      this.peers.delete(p.u); this.dropTag(p.u);
    }
  },
  applyBlocks(list) {
    this.applying = true;
    try {
      for (const [x, y, z, id, o] of list) {
        const k = pkey(x, y, z);
        if (o >= 0) World.orient.set(k, o); else World.orient.delete(k);
        if (World.loaded(x, z)) World.set(x, y, z, id);
        else {                                         // чанк ещё не загружен — запомним изменение, оно применится при загрузке
          const ck = ckey(x >> 4, z >> 4); let m = World.mods.get(ck); if (!m) { m = new Map(); World.mods.set(ck, m); }
          m.set((x & 15) + ((z & 15) << 4) + (y << 8), id);
          const c = World.chunks.get(ck); if (c && c.state) { c.blocks[(x & 15) + ((z & 15) << 4) + (y << 8)] = id; c.dirty = true; }
        }
      }
    } finally { this.applying = false; }
  },
  // изменение блока от действий игрока — в очередь на отправку
  noteSet(x, y, z) { if (this.role && this.cap > 0 && !this.applying) this.dirty.set(pkey(x, y, z), [x, y, z]); },
  flush() {
    if (!this.dirty.size || !this.ch) return;
    const b = [];
    for (const [k, [x, y, z]] of this.dirty) { const o = World.orient.get(k); b.push([x, y, z, World.get(x, y, z), o === undefined ? -1 : o]); }
    this.dirty.clear();
    this.send('ev', { u: this.uid, b });
  },
  // строка в таблице комнат: число игроков, время суток, отметка «жив»
  heartbeat() {
    if (!this.code || !this.sb) return;
    const pl = this.ch ? Object.values(this.ch.presenceState()).filter(a => a.length && !a[a.length - 1].v).length : 1;
    this.sb.from('rooms').update({ d: Game.dayTime, c: Game.dayCount, pl, updated_at: new Date().toISOString() })
      .eq('code', this.code).eq('host', this.uid).then(() => { }, () => { });
  },
  // ---------- каждый кадр ----------
  tick(dt) {
    if (!this.role || !this.ch) return;
    const p = Player;
    this.flushT -= dt; if (this.flushT <= 0) { this.flushT = 0.1; this.flush(); }
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.15;
      const h = p.held();
      const v = { n: this.nick(), o: (this.role === 'guest' && this.guestOwner) ? 1 : 0, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ya: +p.yaw.toFixed(2), pi: +p.pitch.toFixed(2), h: h ? h.id : 0, s: p.sneaking ? 1 : 0, m: this.form === 'creature' ? 'c' : this.form === 'black' ? 'b' : '', hs: this.form === 'creature' ? this.cScale : 1, ar: this.form === 'creature' && this.armSpin ? 1 : 0 };
      const sig = JSON.stringify(v), now = performance.now();
      // двигаемся или стоим — раз в 2 секунды шлём позицию, чтобы нас не сочли пропавшими
      if (!this.vanish && (sig !== this.lastSent || now - this.lastSentT > 2000)) { this.lastSent = sig; this.lastSentT = now; this.send('pos', { u: this.uid, ...v }); }
    }
    if (this.role === 'host') {
      this.timeT -= dt;
      if (this.timeT <= 0) { this.timeT = 4; this.send('time', { d: Game.dayTime, c: Game.dayCount }); }
      this.hbT -= dt;
      if (this.hbT <= 0) { this.hbT = 5; this.heartbeat(); }
      this.fxSendT -= dt;
      if (this.fxSendT <= 0) {
        this.fxSendT = 0.1;
        const pk = this.fxPack(), act = this.fxActive(pk);
        if (act || this.fxWas) this.send('fx', act ? pk : { z: 1 });
        this.fxWas = act;
      }
    }
    // плавное движение чужих игроков
    for (const q of this.peers.values()) {
      if (q.L) q.L.t += dt;
      const k = 1 - Math.exp(-dt * 12), ox = q.cx, oz = q.cz;
      q.cx += (q.x - q.cx) * k; q.cy += (q.y - q.cy) * k; q.cz += (q.z - q.cz) * k;
      let da = q.ya - q.cya; da = ((da + Math.PI) % PI2 + PI2) % PI2 - Math.PI; q.cya += da * k;
      const sp = Math.hypot(q.cx - ox, q.cz - oz) / Math.max(dt, 1e-3);
      q.walk += ((sp > 0.4 ? 1 : 0) - q.walk) * Math.min(1, dt * 8); q.wph += dt * Math.min(sp, 6) * 2.2;
    }
  },
  stop() {
    if (this.role === 'host' && this.sb && this.code) {
      this.sb.from('rooms').delete().eq('code', this.code).eq('host', this.uid).then(() => { }, () => { });
    }
    if (this.ch) {
      const ch = this.ch; this.ch = null;
      try { ch.untrack(); } catch (e) { }
      try { this.sb.removeChannel(ch); } catch (e) { }
    }
    for (const k of this.peers.keys()) this.dropTag(k);
    this.peers.clear(); this.dirty.clear();
    this.snapWait = null; this.evQueue = [];
    if (this.fxOn) this.fxClear();
    if (this.cmdOn) this.cmdClose(true);
    this.vanish = false; this.form = 'player'; Player.hs = 1; this.armSpin = false;
    this.role = null; this.code = null; this.hostUid = null; this.lastSent = ''; this.guestOwner = false; this.hbT = 0; this.timeT = 0;
  },
  // ---------- команды владельца (в чужом мире) ----------
  cmdHelp: 'Команды: /vanish [on|off] — невидимость, /help — список. NumPad 5 — выбор облика',
  canCmd() { return this.role === 'guest' && this.guestOwner; },
  cmdOpen(prefix) {
    if (!this.canCmd() || this.cmdOn) return;
    this.cmdOn = true; Input.keys = {}; Input.mouse = [false, false, false];
    let el = $('cmdBar');
    if (!el) {
      el = document.createElement('div'); el.id = 'cmdBar';
      el.innerHTML = '<input id="cmdIn" autocomplete="off" spellcheck="false" maxlength="80" placeholder="/vanish">';
      document.body.appendChild(el);
      const i = el.firstChild;
      i.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { const v = i.value; Net.cmdClose(); Net.runCmd(v); e.preventDefault(); }
        else if (e.key === 'Escape') { Net.cmdClose(); e.preventDefault(); }
      });
      i.addEventListener('keyup', e => e.stopPropagation());
    }
    el.style.display = 'block';
    const i = $('cmdIn'); i.value = prefix || '';
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => i.focus(), 0);
  },
  cmdClose(quiet) {
    this.cmdOn = false;
    const el = $('cmdBar'); if (el) { el.style.display = 'none'; const i = $('cmdIn'); if (i) i.blur(); }
    if (!quiet) Game.captureMouse(true);
  },
  runCmd(line) {
    line = (line || '').trim().replace(/^\//, '');
    if (!line) return;
    if (!this.canCmd()) { UI.toast('Команды доступны владельцу в чужом мире'); return; }
    const parts = line.split(/\s+/), n = parts[0].toLowerCase(), a = (parts[1] || '').toLowerCase();
    if (n === 'vanish') this.setVanish(a === 'on' ? true : a === 'off' ? false : !this.vanish);
    else if (n === 'help') UI.toast(this.cmdHelp);
    else UI.toast('Неизвестная команда: /' + n + '. ' + this.cmdHelp);
  },
  setVanish(on) {
    if (on === this.vanish) { UI.toast(on ? 'Вы уже невидимы' : 'Вы уже видимы'); return; }
    this.vanish = on;
    if (this.ch) this.ch.track({ u: this.uid, n: this.nick(), o: 1, h: 0, v: on ? 1 : 0 });
    if (on) this.send('bye', { u: this.uid }); else { this.lastSent = ''; this.sendT = 0; }
    UI.toast(on ? 'Невидимость включена: игроки вас не видят' : 'Невидимость выключена: игроки вас видят');
  },
  // звуки существа: NumPad 1 / NumPad 2 в облике существа. Слышат владелец и хозяин мира, громкость не зависит от расстояния
  cryT: [0, 0],
  cry(k = 0) {
    if (!this.canCmd() || this.form !== 'creature') return;
    const now = performance.now(); if (now - (this.cryT[k] || 0) < 1000) return;
    this.cryT[k] = now;
    if (Sfx.ctx && !Sfx.cryBufs[k]) Sfx.loadCry();
    Sfx.cry(k, 1, 0);
    const p = Player;
    this.send('cry', { u: this.uid, k, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
  },
  onCry(v) {   // звук слышит только хозяин мира, на полной громкости, без расстояния
    if (!v || v.u === this.uid || this.role !== 'host') return;
    Sfx.cry(v.k | 0, 1, 0);
  },
  // NumPad 8 в облике существа: медленное вращение руками на 360°, повторное нажатие — стоп
  armSpin: false,
  toggleArms() {
    if (!this.canCmd() || this.form !== 'creature') return;
    this.armSpin = !this.armSpin; this.lastSent = ''; this.sendT = 0;
    UI.toast(this.armSpin ? 'Существо вращает руками' : 'Вращение руками остановлено');
  },
  // облик владельца: 'player' | 'creature' (основное существо) | 'black' (чёрный скин)
  // рост существа: клавиши +/- в облике существа; размер запоминается при переключении облика
  cScale: 1,
  setScale(d) {
    if (!this.canCmd() || this.form !== 'creature') return;
    this.cScale = Math.round(clamp(this.cScale + d, 0.5, 2.5) * 10) / 10;
    Player.hs = this.cScale;
    this.lastSent = ''; this.sendT = 0;
    UI.toast('Рост существа: ' + Math.round(this.cScale * 100) + '%');
  },
  setForm(f) {
    if (!this.canCmd() || !['creature', 'black', 'player'].includes(f)) return;
    this.form = f;
    Player.hs = f === 'creature' ? this.cScale : 1;
    this.lastSent = ''; this.sendT = 0;
    UI.toast(f === 'creature' ? 'Вы — основное существо: ник скрыт, события существа у игрока остановлены'
      : f === 'black' ? 'Вы — чёрный скин: ник скрыт' : 'Вы снова игрок: ник виден');
  },
  // у хозяина: игрок в облике существа (если есть)
  creaturePeer() {
    const now = performance.now();
    for (const q of this.peers.values()) if (q.m === 'c' && now - (q.seen || 0) < 10000) return q;
    return null;
  },
  // модель существа на месте такого игрока (для отрисовки)
  morphMutant() {
    const q = this.creaturePeer(); if (!q) return null;
    const look = q.cya + Math.PI, wrap = a => ((a + Math.PI) % PI2 + PI2) % PI2 - Math.PI, now = performance.now();
    const L = q.L || (q.L = { active: true, day: false, A: 0, S: 0, snapT: 0, twitchV: 0, gp: 0, phase: 0, t: Math.random() * 100,
      by: look, hy: 0, hp: 0, hyT: 0, hpT: 0, hT: 0, hroll: 0, last: now });
    const dt = Math.min(0.1, (now - L.last) / 1000); L.last = now; L.t += dt;
    // корпус стоит на месте и разворачивается, только когда существо идёт (вперёд, назад, вбок)
    if (q.walk > 0.15) L.by += wrap(look - L.by) * Math.min(1, dt * 7 * q.walk);
    // голова сама крутится за взглядом — рывками, с перехлёстом, почти задом наперёд
    const rel = clamp(wrap(look - L.by), -2.7, 2.7), pt = clamp(-(q.pi || 0), -1.2, 1.2);
    L.hT -= dt;
    if (L.hT <= 0) {
      L.hT = 0.05 + Math.random() * 0.18;
      const k = 0.5 + Math.random() * 0.7;
      L.hyT = L.hy + (rel - L.hy) * k; L.hpT = L.hp + (pt - L.hp) * k;
    }
    const f = 1 - Math.exp(-dt * 30);
    L.hy += (L.hyT - L.hy) * f; L.hp += (L.hpT - L.hp) * f;
    // чем сильнее голова вывернута, тем сильнее она заваливается набок и дёргается
    const tw = Math.min(1, Math.abs(L.hy) / 1.5);
    L.hroll = Math.sign(L.hy) * tw * 0.5 + (Math.random() - 0.5) * 0.06 * (0.3 + tw);
    // руки: медленно крутятся, пока включено; после выключения доворачиваются до обычного положения
    if (q.ar) L.armA = (L.armA || 0) + dt * 1.3;
    else if (L.armA) { const tg = Math.ceil(L.armA / PI2 - 0.02) * PI2; L.armA += Math.min(tg - L.armA, dt * 1.3); if (Math.abs(tg - L.armA) < 1e-3) L.armA = 0; }
    L.x = q.cx; L.y = q.cy; L.z = q.cz; L.yaw = L.by; L.walk = q.walk; L.wph = q.wph; L.hs = q.hs || 1;
    return L;
  },
  onBye(v) { if (!v || v.u === this.uid) return; this.peers.delete(v.u); this.dropTag(v.u); },
  // ---------- события хозяина → наблюдателю ----------
  // Существо и помехи «живут» у хозяина мира. Гость не запускает свои события, а повторяет то, что происходит у хозяина.
  FX_SFX: ['staticBurst', 'scream', 'scream2', 'smile', 'dread', 'hunt', 'huntStop', 'glitch', 'smex', 'hell', 'run', 'omen3', 'omen2', 'omen', 'sting'],
  hookSfx() {
    for (const n of this.FX_SFX) {
      const f0 = Sfx[n]; if (typeof f0 !== 'function') continue;
      Sfx[n] = function (...a) { const r = f0.apply(this, a); if (Net.role === 'host' && Net.ch) Net.send('fxs', { n, a }); return r; };
    }
  },
  observer() { return this.role === 'guest'; },
  fxPack() {
    const E = Ents, M = E.mutant, m = {};
    for (const k in M) { const t = typeof M[k]; if (t === 'number') m[k] = +M[k].toFixed(3); else if (t === 'boolean') m[k] = M[k]; }
    const S = E.peekS, pk = (S && S.fx !== undefined) ? { fx: S.fx, fy: S.fy, fz: S.fz, t: +S.t.toFixed(2) } : null;
    const r3 = v => +(v || 0).toFixed(3);
    return { m, k: [E.mutantK, E.mutantBurst, E.dreadK, E.huntK, E.glitchK, E.dayFog].map(r3), dl: E.dayLoad ? 1 : 0, bl: E.blackOn ? 1 : 0,
      pc: E.pictureOn ? (Portrait.mode || 'hunt') : '', tv: E.tvMode(), fp: +(Game.flickerPulse || 0).toFixed(2), pk };
  },
  fxActive(p) { return !!(p.m.active || p.k.some(v => v > 0.004) || p.bl || p.pc || p.fp > 0 || p.pk); },
  onFxs(v) {
    if (this.role !== 'guest' || !v || !Game.settings.mutant || !this.FX_SFX.includes(v.n)) return;
    try { Sfx[v.n](...(v.a || [])); } catch (e) { }
  },
  onFx(v) {
    if (this.role !== 'guest' || !v || !Game.settings.mutant) return;
    if (v.z) { this.fxClear(); return; }
    const E = Ents, M = E.mutant;
    this.fxT = performance.now(); this.fxOn = true;
    const m = v.m || {}, was = M.active, px = M.x, py = M.y, pz = M.z, pyaw = M.yaw, pt = M.t, pw = M.wph;
    Object.assign(M, m);
    this.fxTgt = { x: m.x, y: m.y, z: m.z, yaw: m.yaw };
    if (was && m.active) { M.x = px; M.y = py; M.z = pz; M.yaw = pyaw; M.wph = pw; if (Math.abs(pt - m.t) < 0.6) M.t = pt; }   // плавность между пакетами
    this.fxK = v.k || [0, 0, 0, 0, 0, 0];
    E.mutantBurst = Math.max(E.mutantBurst || 0, this.fxK[1]);
    E.dayLoad = !!v.dl;
    const bl = !!v.bl; if (bl !== E.blackOn) { E.blackOn = bl; BlackFx.set(bl); }
    const pc = v.pc || '';
    if (pc && !Portrait.on) Portrait.show(pc); else if (!pc && Portrait.on) Portrait.hide();
    E.pictureOn = !!pc;
    Game.flickerPulse = Math.max(Game.flickerPulse || 0, v.fp || 0);
    this.fxTv = v.tv || 'anim';
    E.peekS = v.pk ? Object.assign(E.peekS || {}, v.pk) : null;
  },
  // каждый кадр у гостя: плавно подтягиваем повторённое состояние
  fxStep(dt) {
    if (!this.fxOn) return;
    const E = Ents, M = E.mutant, T = this.fxTgt, K = this.fxK, a = 1 - Math.exp(-dt * 12);
    if (performance.now() - this.fxT > 5000) { this.fxClear(); return; }   // от хозяина давно ничего нет
    if (M.active && T) {
      const k = 1 - Math.exp(-dt * 14);
      M.x += (T.x - M.x) * k; M.y += (T.y - M.y) * k; M.z += (T.z - M.z) * k;
      let da = T.yaw - M.yaw; da = ((da + Math.PI) % PI2 + PI2) % PI2 - Math.PI; M.yaw += da * k;
      M.t += dt; M.wph += dt * 4.75 * (M.walk || 0);
    }
    if (E.peekS) E.peekS.t += dt;
    E.mutantK += ((this.form === 'creature' ? 0 : K[0]) - E.mutantK) * a;   // в облике существа свои помехи не видим
    E.mutantBurst = Math.max(0, E.mutantBurst - dt);
    E.dreadK += (K[2] - E.dreadK) * a; E.huntK += (K[3] - E.huntK) * a; E.glitchK += (K[4] - E.glitchK) * a; E.dayFog += (K[5] - E.dayFog) * a;
    Portrait.update(dt);
  },
  fxClear() {
    const E = Ents;
    this.fxOn = false; this.fxTgt = null; this.fxK = [0, 0, 0, 0, 0, 0]; this.fxTv = 'anim';
    E.mutant.active = false; E.mutant.gp = 0; E.peekS = null;
    E.mutantK = 0; E.mutantBurst = 0; E.dreadK = 0; E.huntK = 0; E.glitchK = 0; E.dayFog = 0; E.dayLoad = false;
    if (E.blackOn) { E.blackOn = false; BlackFx.set(false); }
    if (Portrait.on) Portrait.hide();
    E.pictureOn = false;
  },
  // ---------- владелец: список миров ----------
  async listRooms() {
    await this.load();
    const since = new Date(Date.now() - 60000).toISOString();
    const r = await this.sb.from('rooms').select('*').gte('updated_at', since).order('updated_at', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return (r.data || []).map(x => ({ ...x, t: Date.parse(x.updated_at) || 0, players: Math.max(0, (x.pl || 1) - 1) }));
  },
  // ---------- отрисовка чужих игроков ----------
  buildAvatars(batch, cam) {
    if (!this.peers.size) return;
    const now = performance.now();
    for (const q of this.peers.values()) {
      if (now - (q.seen || 0) > 15000 || q.m === 'c') continue;            // существо рисуется отдельной моделью
      const l = World.light(Math.floor(q.cx), Math.floor(q.cy + 1), Math.floor(q.cz));
      const sky = (l >> 4) / 15, blk = (l & 15) / 15;
      const c = Math.cos(q.cya), s = Math.sin(q.cya), sn = q.s ? 0.15 : 0;
      const tf = (x, y, z) => [q.cx + x * c + z * s - cam.x, q.cy + y - cam.y, q.cz - x * s + z * c - cam.z];
      const sw = Math.sin(q.wph) * 0.7 * q.walk;
      // коробка с вращением вокруг оси X в точке py (руки и ноги качаются)
      const box = (x0, y0, z0, x1, y1, z1, tiles, rot = 0, py = 0, lean = 0) => {
        const cr = Math.cos(rot), sr = Math.sin(rot), cl = Math.cos(lean), sl = Math.sin(lean);
        const T = (x, y, z) => { let yy = y - py, y2 = yy * cr - z * sr + py, z2 = yy * sr + z * cr; if (lean) { const yb = y2 - 0.75; y2 = yb * cl - z2 * sl + 0.75; z2 = yb * sl + z2 * cl; } return tf(x, y2, z2); };
        avBox(batch, x0, y0, z0, x1, y1, z1, tiles, T, sky, blk);
      };
      const dark = q.m === 'b', SH = TILE.shadow;                         // чёрный скин
      const skin = dark ? SH : TILE.av_skin, shirt = dark ? SH : q.o ? TILE.av_shirt2 : TILE.av_shirt, pants = dark ? SH : TILE.av_pants;
      const S6 = t => [t, t, t, t, t, t];
      box(-0.25, 0, -0.125, 0, 0.75, 0.125, S6(pants), sw, 0.75);
      box(0, 0, -0.125, 0.25, 0.75, 0.125, S6(pants), -sw, 0.75);
      box(-0.25, 0.75, -0.125, 0.25, 1.5, 0.125, S6(shirt), 0, 0, sn);
      box(-0.5, 0.75, -0.125, -0.25, 1.5, 0.125, [shirt, shirt, shirt, skin, shirt, shirt], -sw * 0.8, 1.4, sn);
      box(0.25, 0.75, -0.125, 0.5, 1.5, 0.125, [shirt, shirt, shirt, skin, shirt, shirt], sw * 0.8, 1.4, sn);
      // голова: лицо смотрит туда же, куда игрок (−Z в локальных координатах), наклон по pitch
      const pi = -(q.pi || 0) * 0.8;
      box(-0.25, 1.5 - sn, -0.25, 0.25, 2.0 - sn, 0.25, dark ? S6(SH) : [TILE.av_side, TILE.av_side, TILE.av_hair, skin, TILE.av_hair, TILE.av_face], pi, 1.5 - sn);
    }
  },
  // подписи с именами над головами
  tags: new Map(),
  dropTag(k) { const e = this.tags.get(k); if (e) { e.remove(); this.tags.delete(k); } },
  drawTags(cam) {
    if (!this.peers.size) { if (this.tags.size) for (const k of [...this.tags.keys()]) this.dropTag(k); return; }
    const VP = Rend.VP; if (!VP) return;
    const W = innerWidth, H = innerHeight;
    for (const [k, q] of this.peers) {
      let e = this.tags.get(k);
      if (!e) { e = document.createElement('div'); e.className = 'nettag'; document.body.appendChild(e); this.tags.set(k, e); }
      if (q.m) { e.style.display = 'none'; continue; }                  // в облике существа или чёрного скина ника нет
      const name = (q.o ? '★ ' : '') + (q.n || 'Игрок');
      if (e.textContent !== name) e.textContent = name;
      const v = m4xv(VP, q.cx - cam.x, q.cy + 2.3 - cam.y, q.cz - cam.z, 1);
      const d = Math.hypot(q.cx - cam.x, q.cz - cam.z);
      if (v[3] <= 0.05 || d > 64 || UI.hideHud) { e.style.display = 'none'; continue; }
      e.style.display = 'block';
      e.style.left = ((v[0] / v[3] * 0.5 + 0.5) * W) + 'px'; e.style.top = ((1 - (v[1] / v[3] * 0.5 + 0.5)) * H) + 'px';
    }
  }
};
// коробка с разными тайлами на гранях: [+X, −X, +Y, −Y, +Z, −Z]
function avBox(b, x0, y0, z0, x1, y1, z1, tiles, P, sky, blk) {
  const R = tileRect;
  b.quad([P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)], R(tiles[0]), sky, blk, 0.62);
  b.quad([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], R(tiles[1]), sky, blk, 0.62);
  b.quad([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], R(tiles[2]), sky, blk, 1);
  b.quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], R(tiles[3]), sky, blk, 0.5);
  b.quad([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], R(tiles[4]), sky, blk, 0.8);
  b.quad([P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0)], R(tiles[5]), sky, blk, 0.8);
}
// все изменения блоков проходят через World.set — отмечаем те, что сделал сам игрок
{
  const set0 = World.set;
  World.set = function (x, y, z, id) { const r = set0.call(this, x, y, z, id); if (r) Net.noteSet(x, y, z); return r; };
}
Net.hookSfx();
