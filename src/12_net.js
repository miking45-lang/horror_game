// ============================================================
//  Сетевая игра через Supabase (Realtime + одна таблица комнат).
//  Каждый игрок, пока играет с интернетом, «держит» комнату своего мира.
//  Друг заходит по коду комнаты, владелец игры видит список всех комнат и заходит в любую.
// ============================================================
// Настройки проекта Supabase. Пока url или anonKey пусты, сетевые функции выключены.
const NET_CONFIG = {
  url: 'https://sjlmrsqgzxzmdjajtdig.supabase.co',   // Project URL
  anonKey: 'sb_publishable_Pdc898xP31yC3hklsP2FHA_cn1Z9UPU',   // публичный ключ (Settings → API)
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
      if (typeof supabase === 'undefined') await this.script(NET_SDK);
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
  send(event, payload) { if (this.ch) this.ch.send({ type: 'broadcast', event, payload }); },
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
      this.timeT = 0; this.hbT = 5;
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
      const ch = this.makeChannel(code); this.ch = ch;
      await this.subscribe(ch);
      await ch.track({ u: this.uid, n: this.nick(), o: asOwner ? 1 : 0, h: 0 });
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
    const pl = this.ch ? Object.keys(this.ch.presenceState()).length : 1;
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
      const v = { n: this.nick(), o: (this.role === 'guest' && this.guestOwner) ? 1 : 0, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ya: +p.yaw.toFixed(2), pi: +p.pitch.toFixed(2), h: h ? h.id : 0, s: p.sneaking ? 1 : 0 };
      const sig = JSON.stringify(v), now = performance.now();
      // двигаемся или стоим — раз в 2 секунды шлём позицию, чтобы нас не сочли пропавшими
      if (sig !== this.lastSent || now - this.lastSentT > 2000) { this.lastSent = sig; this.lastSentT = now; this.send('pos', { u: this.uid, ...v }); }
    }
    if (this.role === 'host') {
      this.timeT -= dt;
      if (this.timeT <= 0) { this.timeT = 4; this.send('time', { d: Game.dayTime, c: Game.dayCount }); }
      this.hbT -= dt;
      if (this.hbT <= 0) { this.hbT = 5; this.heartbeat(); }
    }
    // плавное движение чужих игроков
    for (const q of this.peers.values()) {
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
    this.role = null; this.code = null; this.hostUid = null; this.lastSent = ''; this.guestOwner = false; this.hbT = 0; this.timeT = 0;
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
      if (now - (q.seen || 0) > 15000) continue;
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
      const skin = TILE.av_skin, shirt = q.o ? TILE.av_shirt2 : TILE.av_shirt, pants = TILE.av_pants;
      const S6 = t => [t, t, t, t, t, t];
      box(-0.25, 0, -0.125, 0, 0.75, 0.125, S6(pants), sw, 0.75);
      box(0, 0, -0.125, 0.25, 0.75, 0.125, S6(pants), -sw, 0.75);
      box(-0.25, 0.75, -0.125, 0.25, 1.5, 0.125, S6(shirt), 0, 0, sn);
      box(-0.5, 0.75, -0.125, -0.25, 1.5, 0.125, [shirt, shirt, shirt, skin, shirt, shirt], -sw * 0.8, 1.4, sn);
      box(0.25, 0.75, -0.125, 0.5, 1.5, 0.125, [shirt, shirt, shirt, skin, shirt, shirt], sw * 0.8, 1.4, sn);
      // голова: лицо смотрит туда же, куда игрок (−Z в локальных координатах), наклон по pitch
      const pi = -(q.pi || 0) * 0.8;
      box(-0.25, 1.5 - sn, -0.25, 0.25, 2.0 - sn, 0.25, [TILE.av_side, TILE.av_side, TILE.av_hair, skin, TILE.av_hair, TILE.av_face], pi, 1.5 - sn);
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
