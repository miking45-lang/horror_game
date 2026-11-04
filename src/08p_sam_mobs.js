// ============================================================
//  Мобы Serious Sam: яйца призыва в творческом инвентаре владельца, поведение, отрисовка.
//  Данные — SAMOB_LIST и SAMOB_DATA_B64 (tools/export_samobs.py), снаряды и частицы — общие с обликом Сэма.
//  Мобов считает тот, кто их призвал; остальным игрокам он рассылает их положение (событие smb),
//  а попадания чужих игроков приходят к нему событием smh.
// ============================================================
const SAMOB_RU = {
  kamikaze: 'Камикадзе', rocketeer: 'Ракетчик', firecracker: 'Фейерверкер', bomberman: 'Бомбист', gnaar: 'Гнаар', gnaar_female: 'Гнаар (самка)',
  kleer: 'Клир', werebull: 'Сирианский оборотень', arachnoid: 'Детёныш арахноида', arachnoid_general: 'Арахноид-генерал',
  biomech_red: 'Биомеханоид-майор', biomech_blue: 'Биомеханоид-солдат', reptiloid: 'Рептилоид', reptiloid_red: 'Рептилоид-горец', reptiloid_blue: 'Рептилоид-демон',
  harpy: 'Гарпия', zorg_soldier: 'Зорг-солдат', zorg_commander: 'Зорг-командир', zumbul: 'Зумбул', cucurbito: 'Кукурбито-тыква', demon: 'Скифский демон',
  lava_golem: 'Лавовый голем', gizmo: 'Болотный попрыгун', khnum: 'Хнум', mordekai: 'Мордекай-призыватель', ughzan: 'Уг-Зан III (босс)',
  ss3_kamikaze: 'Камикадзе (SS3)', ss3_kamikaze_large: 'Большой камикадзе (SS3)', ss3_rocketeer: 'Ракетчик (SS3)', ss3_gnaar: 'Гнаар (SS3)', ss3_kleer: 'Клир (SS3)',
  ss3_werebull: 'Оборотень (SS3)', ss3_arachnoid: 'Молодой арахноид (SS3)', ss3_arachnoid_big: 'Арахноид-генерал (SS3)', ss3_biomech_small: 'Биомеханоид-солдат (SS3)',
  ss3_biomech_big: 'Биомеханоид-майор (SS3)', ss3_reptiloid: 'Рептилоид-горец (SS3)', ss3_harpy: 'Гарпия (SS3)', ss3_soldier_rifle: 'Солдат с винтовкой (SS3)',
  ss3_soldier_shotgun: 'Солдат с дробовиком (SS3)', ss3_scrapjack: 'Скрэпджек (SS3)', ss3_cave_demon: 'Пещерный демон (SS3)', ss3_spider_small: 'Пещерный паук (SS3)',
  ss3_spider_big: 'Гигантский паук (SS3)', ss3_witch_bride: 'Ведьма-невеста (SS3)', ss3_scrapjack_boss: 'Босс Скрэпджек (SS3)', ss3_khnum: 'Хнум (SS3)', ss3_ughzan: 'Уг-Зан IV (босс, SS3)'
};
// здоровье в единицах урона оружия Сэма (автомат — 3 за выстрел, ракета — 10)
const SAMOB_HP = {
  kamikaze: 3, rocketeer: 9, firecracker: 9, bomberman: 9, gnaar: 12, gnaar_female: 12, kleer: 20, werebull: 60, arachnoid: 60, arachnoid_general: 400,
  biomech_red: 500, biomech_blue: 90, reptiloid: 120, reptiloid_red: 300, reptiloid_blue: 2000, harpy: 12, zorg_soldier: 12, zorg_commander: 25, zumbul: 40,
  cucurbito: 45, demon: 150, lava_golem: 30, gizmo: 3, khnum: 600, mordekai: 200, ughzan: 3000, ss3_kamikaze: 3, ss3_kamikaze_large: 8, ss3_rocketeer: 9, ss3_gnaar: 12,
  ss3_kleer: 20, ss3_werebull: 60, ss3_arachnoid: 60, ss3_arachnoid_big: 400, ss3_biomech_small: 90, ss3_biomech_big: 500, ss3_reptiloid: 120, ss3_harpy: 12,
  ss3_soldier_rifle: 10, ss3_soldier_shotgun: 10, ss3_scrapjack: 200, ss3_cave_demon: 30, ss3_spider_small: 15, ss3_spider_big: 150, ss3_witch_bride: 150,
  ss3_scrapjack_boss: 2000, ss3_khnum: 600, ss3_ughzan: 3000
};
// снаряды: вид следа и взрыва (общие с оружием Сэма), скорость, урон в сердечках/2, взрыв; hitscan — без снаряда
const SAMOB_SHOTS = {
  rocket: { kind: 'hd_rocket', speed: 22, dmg: 6, blast: 2.2 }, firecracker: { kind: 'hd_rocket', speed: 20, dmg: 2, blast: 1.2 },
  laser: { kind: 'hd_laser', speed: 34, dmg: 2 }, fireball: { kind: 'hd_rocket', speed: 16, dmg: 4, blast: 1.6 }, blade: { kind: 'hd_laser', speed: 22, dmg: 3, noTrail: 1 },
  bomb: { kind: 'hd_grenade', speed: 13, dmg: 6, blast: 2.5, lob: 1 }, cannonball: { kind: 'hd_cannonball', speed: 24, dmg: 10, blast: 3, lob: 1 },
  gun: { hit: 1, dmg: 1 }, bullet: { hit: 1, dmg: 2 }, shotgun: { hit: 6, dmg: 1, spr: 4 }
};
// мобы, у которых в игре шаги не размечены событиями: два шага за цикл бега
const SAMOB_DEF_STEPS = [{ t: 0.02, mat: 'step', alt: 'step' }, { t: 0.52, mat: 'step', alt: 'step' }];
const SAMOB_MAX = 64, SAMOB_ITEM = 400, SAMOB_CLEAR_ITEM = 399, SAMOB_ST = ['idle', 'run', 'attack', 'melee', 'wound', 'death', 'spawn'];

// значок яйца: два цвета как у яиц призыва (основной из таблицы моба, крапинки темнее или светлее)
function samEggIcon(x, S, col, spot) {
  const R = ['......oooo......', '.....oAAAAo.....', '....oAABAAAo....', '...oAAAAAABAo...', '...oABAAAAAAo...', '..oAAAAABAAAAo..', '..oAAABAAAAABo..', '.oAABAAAAABAAAo.', '.oAAAAAABAAAAAo.', '.oABAAAAAAAABAo.', '.oAAAABAAAAAAAo.', '.oAAAAAAABAAAAo.', '..oAABAAAAAABo..', '..ooAAAABAAoo...', '....oooooooo....', '................'];
  const u = S / 16, c = { o: '#1a1a1a', A: `rgb(${col[0]},${col[1]},${col[2]})`, B: `rgb(${spot[0]},${spot[1]},${spot[2]})` };
  for (let r = 0; r < 16; r++) for (let k = 0; k < 16; k++) { const v = R[r][k]; if (v !== '.') { x.fillStyle = c[v]; x.fillRect(k * u, r * u, Math.ceil(u), Math.ceil(u)); } }
}
SAMOB_LIST.forEach((T, i) => {
  const c = (T.egg || [120, 120, 120]).map(v => clamp(v, 25, 235)), lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  const spot = c.map(v => clamp(lum > 110 ? v * 0.45 : v * 1.9 + 45, 0, 255) | 0);
  T.ti = i; T.hp = SAMOB_HP[T.id] || Math.round(8 * T.height * T.height);
  T.ru = SAMOB_RU[T.id] || T.title;
  T.draw = T.height > 40 ? 40 / T.height : 1;     // самые большие боссы иначе не влезают в кадр и в туман
  T.h = T.height * T.draw; T.r = (T.radius || 0.6) * T.draw;
  T.w = clamp(T.r * 0.6, 0.3, 0.9); T.hc = Math.min(T.h, 3.2);
  ITEMS[SAMOB_ITEM + i] = { id: SAMOB_ITEM + i, name: 'Яйцо призыва: ' + T.ru, stack: 64, sprite: TILE.sam_egg, ownerOnly: true, samEgg: i, iconFn: (x, S) => samEggIcon(x, S, c, spot) };
});
ITEMS[SAMOB_CLEAR_ITEM] = { id: SAMOB_CLEAR_ITEM, name: 'Убрать всех мобов Сэма', stack: 1, sprite: TILE.sam_egg, ownerOnly: true, samClear: true, iconFn: (x, S) => samEggIcon(x, S, [190, 30, 30], [30, 30, 30]) };

const SamMobs = {
  state: 'none', list: [], next: 1, auth: false, netT: 0, sentEmpty: true, snapT: 0,
  // ---------- загрузка пакета: мобы подмешиваются к ресурсам облика Сэма ----------
  load() {
    if (this.state !== 'none') return this.loading;
    this.state = 'loading';
    this.loading = (async () => {
      await Sam.load();
      if (Sam.state !== 'ready') throw new Error('нет ресурсов Сэма');
      const raw = Uint8Array.from(atob(SAMOB_DATA_B64), c => c.charCodeAt(0));
      const buf = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const dv = new DataView(buf.buffer), jl = dv.getUint32(4, true);
      const D = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + jl)));
      let off = 8 + jl; while (off % 4) off++;
      const bin = buf.subarray(off);
      for (const k in D.tex) { D.tex[k].bin = bin; Sam.D.tex[k] = D.tex[k]; }
      for (const k in D.snd) { for (const r of D.snd[k]) r.bin = bin; Sam.D.snd[k] = D.snd[k]; }
      for (const k in D.models) { D.models[k].vb.bin = bin; D.models[k].ib.bin = bin; }
      this.D = D; this.bin = bin; this.state = 'ready';
    })().catch(e => { this.state = 'error'; console.error(e); UI.toast('Мобы Сэма не загрузились: ' + e.message); });
    return this.loading;
  },
  // модели создаются при первом появлении моба
  model(name) {
    let md = Sam.models[name];
    if (!md && this.D && this.D.models[name]) md = Sam.models[name] = new SamModel(name, this.D.models[name], this.bin);
    return md || null;
  },
  clear() { this.list = []; this.auth = false; this.sentEmpty = true; },
  // ---------- яйцо в руке, правая кнопка ----------
  useItem(st) {
    const it = ITEMS[st.id]; if (!it) return false;
    if (it.samClear) { this.despawnAll(); UI.toast('Мобы Сэма убраны'); return true; }
    if (it.samEgg === undefined) return false;
    if (!Net.isOwner) return true;
    const p = Player, eye = [p.x, p.y + EYE, p.z], d = lookDir(), h = Sam.trace(eye, d, 64);
    let x, y, z;
    if (h && !FKIND[h.id]) { x = h.p[0] + h.n[0] * 0.5; z = h.p[2] + h.n[2] * 0.5; y = h.n[1] > 0 ? h.y + 1 : h.n[1] < 0 ? h.y - 2 : h.y; }
    else if (h) { x = h.p[0]; y = h.p[1] + 0.5; z = h.p[2]; }
    else { x = eye[0] + d[0] * 12; y = eye[1] + d[1] * 12; z = eye[2] + d[2] * 12; }
    const yaw = Math.atan2(-(p.x - x), -(p.z - z)), ti = it.samEgg;
    const go = () => { if (this.state === 'ready') this.spawn(ti, x, y, z, yaw); };
    if (this.state === 'ready') go();
    else { if (this.state === 'none') UI.toast('Загрузка мобов Сэма…'); this.load().then(go); }
    if (Game.mode === 'survival') { st.count--; if (st.count <= 0) p.slots[p.selected] = null; UI.refreshHotbar(); }
    return true;
  },
  spawn(ti, x, y, z, yaw) {
    if (this.list.length >= SAMOB_MAX) { UI.toast('Слишком много мобов: не больше ' + SAMOB_MAX); return null; }
    const T = SAMOB_LIST[ti], md = this.model('mob_' + T.id); if (!md) return null;
    const m = { i: this.next++, T, md, x, y, z, vx: 0, vy: 0, vz: 0, yaw, hp: T.hp, tt: 0, cd: 0.5, rest: 0, burst: 0, shots: 0, hitDone: false, ground: false, tgt: null, tgtT: 0, idleS: 3 + Math.random() * 8, seen: false, t: 0, S: null };
    this.setState(m, md.clip('spawn') ? 'spawn' : 'idle', true);
    this.list.push(m); this.auth = true; this.sentEmpty = false;
    this.say(m, 'sight');
    return m;
  },
  despawnAll() { this.list = []; if (this.auth) this.netSend(true); },
  // ---------- анимация ----------
  setState(m, st, now, forceRole) {
    if (m.st === st && !now) return;
    const md = m.md;
    let role = forceRole && md.clip(forceRole) ? forceRole : st;
    if (st === 'run' && m.T.charge && md.clip('charge') && m.charging) role = 'charge';
    if (st === 'melee' && !md.clip('melee')) role = 'attack';
    if (st === 'attack' && !md.clip('attack')) role = 'melee';
    if (st === 'run' && !md.clip('run')) role = 'walk';
    const c = md.clip(role);
    if (m.c && !now) { m.pc = m.c; m.pt = m.t; m.pl = m.loop; m.bl = 0.2; } else { m.pc = null; m.bl = 0; }
    m.st = st; m.role = role; m.tt = 0; m.t = 0; m.c = c; m.loop = st === 'idle' || st === 'run'; m.hitDone = false; m.sf = 0;
  },
  // выстрел другой пушкой: своя анимация отдачи с начала (та же уже идущая не перезапускается)
  playGun(m, role) {
    if (!m.md.clip(role) || (role === m.role && m.t < this.clipLen(m))) return;
    m.pc = m.c; m.pt = m.t; m.pl = false; m.bl = 0.08; m.c = m.md.clip(role); m.role = role; m.t = 0; m.tt = 0;
  },
  // ---------- шаги: события кадров бега, звук по блоку под ногами ----------
  surfaceOf(m) {
    const id = World.get(Math.floor(m.x), Math.floor(m.y - 0.2), Math.floor(m.z));
    if (!id) return null;
    const s = Sam.material(id);
    return s === 'ice' ? 'stone' : s;
  },
  footstep(m, ev) {
    const T = m.T, vol = clamp(0.45 + T.h * 0.08, 0.45, 1), low = T.h > 3.2 ? clamp(1.15 - T.h * 0.05, 0.6, 1) : 1;
    if (ev.snd) {
      if (ev.len && m.stepLock > m.clock) return;
      if (ev.len) m.stepLock = m.clock + ev.len;
      Sam.sound('mob.' + T.id + '.' + ev.snd, m.x, m.y, m.z, vol, 0.97 + Math.random() * 0.06);
      return;
    }
    const surf = this.surfaceOf(m); if (!surf) return;
    const fam = (T.steps && T.steps.family) || (T.id.startsWith('ss3_') ? 'ss3' : 'hd'), table = SAMOB_SURFACE[fam] || {}, names = Object.keys(table[surf] || table.default || {});
    const nm = names.includes(ev.mat) ? ev.mat : names.includes(ev.alt) ? ev.alt : names[0]; if (!nm) return;
    const mat = table[surf] ? surf : 'default';
    Sam.sound('steps.' + fam + '.' + mat + '.' + nm, m.x, m.y, m.z, vol, low * (0.95 + Math.random() * 0.1));
  },
  stepTick(m, dt) {
    m.clock = (m.clock || 0) + dt;
    if (m.st !== 'run' || !m.c || m.T.archetype === 'flyer' || m.c.len <= 0) return;
    const pl = Player; if (Math.hypot(m.x - pl.x, m.y - pl.y, m.z - pl.z) > 60) return;
    const list = (m.T.steps && m.T.steps.clips[m.role]) || SAMOB_DEF_STEPS;
    const f = (m.t % m.c.len) / m.c.len, f0 = m.sf === undefined ? f : m.sf;
    m.sf = f;
    for (const ev of list) {
      const hit = f0 <= f ? (ev.t > f0 && ev.t <= f) : (ev.t > f0 || ev.t <= f);
      if (!hit) continue;
      if (ev.once && m.onceDone === m.role) continue;
      if (ev.once) m.onceDone = m.role;
      this.footstep(m, ev);
    }
  },
  clipLen(m) { return m.c ? m.c.len : 0.4; },
  pose(m) {
    const md = m.md;
    md.rest();
    md.layer(md.clip('idle'), m.st === 'idle' ? m.t : 0, true);
    if (m.pc && m.bl > 0) md.layer(m.pc, m.pt, m.pl, 1);
    if (m.c) md.layer(m.c, m.t, m.loop, m.bl > 0 ? 1 - m.bl / 0.2 : 1);
    md.fk();
    return md;
  },
  say(m, role, vol = 1) { Sam.sound('mob.' + m.T.id + '.' + role, m.x, m.y + m.T.h * 0.6, m.z, vol, 0.96 + Math.random() * 0.08); },
  // ---------- цели ----------
  targets() {
    const out = [], p = Player, now = performance.now();
    if (!p.dead) out.push({ u: null, x: p.x, y: p.y, z: p.z });
    if (Net.peers) for (const [u, q] of Net.peers) if (!q.dd && now - (q.seen || 0) < 5000) out.push({ u, x: q.cx, y: q.cy, z: q.cz });
    return out;
  },
  hurt(tg, d) {
    if (tg.u === null) hurtPlayer(Math.max(1, Math.round(d)));
    else Net.samDamage && Net.samDamage(tg.u, d);
  },
  // первый игрок на отрезке (для снарядов мобов): { u, x, y, z, t }
  playerOnRay(o, d, maxT) {
    let best = null;
    for (const tg of this.targets()) {
      let tn = 0, tf = maxT, ok = true;
      for (const [a0, a1, oo, dd] of [[tg.x - 0.4, tg.x + 0.4, o[0], d[0]], [tg.y, tg.y + 1.85, o[1], d[1]], [tg.z - 0.4, tg.z + 0.4, o[2], d[2]]]) {
        if (Math.abs(dd) < 1e-6) { if (oo < a0 || oo > a1) { ok = false; break; } continue; }
        let t0 = (a0 - oo) / dd, t1 = (a1 - oo) / dd; if (t0 > t1) [t0, t1] = [t1, t0];
        tn = Math.max(tn, t0); tf = Math.min(tf, t1);
      }
      if (ok && tn <= tf && tn < maxT && (!best || tn < best.t)) { tg.t = tn; best = tg; }
    }
    return best;
  },
  blastPlayers(s) {
    for (const tg of this.targets()) {
      const r = Math.hypot(tg.x - s.x, tg.y + 0.9 - s.y, tg.z - s.z), R = s.blast * 1.6;
      if (r < R) this.hurt(tg, Math.max(1, s.dmg * (1 - r / R)));
    }
  },
  // ---------- попадания по мобам ----------
  onRay(o, d, maxT) {
    let best = null, bt = maxT;
    for (const m of this.list) {
      if (m.st === 'death') continue;
      const w = Math.max(0.45, m.T.r * 0.75), h = m.T.h;
      let tn = 0, tf = bt, ok = true;
      for (const [a0, a1, oo, dd] of [[m.x - w, m.x + w, o[0], d[0]], [m.y, m.y + h, o[1], d[1]], [m.z - w, m.z + w, o[2], d[2]]]) {
        if (Math.abs(dd) < 1e-6) { if (oo < a0 || oo > a1) { ok = false; break; } continue; }
        let t0 = (a0 - oo) / dd, t1 = (a1 - oo) / dd; if (t0 > t1) [t0, t1] = [t1, t0];
        tn = Math.max(tn, t0); tf = Math.min(tf, t1);
      }
      if (ok && tn <= tf && tn < bt) { best = m; bt = tn; }
    }
    return best ? [best, bt] : null;
  },
  // kb — отбрасывание [x, z] от удара рукой или мечом
  damage(m, d, kb) {
    m.fl = 0.12;
    if (!this.auth) { if (Net.send && Net.role && Net.ch) Net.send('smh', { i: m.i, d: +d.toFixed(1), k: kb ? kb.map(v => +v.toFixed(1)) : undefined }); return; }
    if (m.st === 'death') return;
    if (kb && m.T.h < 4) { m.kbx = kb[0]; m.kbz = kb[1]; if (m.ground) m.vy = Math.max(m.vy, 4); }
    m.hp -= d;
    if (m.hp <= 0) return this.die(m);
    if (!m.tgt) m.tgtT = 0;
    if (m.md.clip('wound') && m.st !== 'wound' && m.st !== 'spawn' && m.T.h < 4 && d >= m.T.hp * 0.2 && Math.random() < 0.6) { this.setState(m, 'wound'); this.say(m, 'wound'); }
    else if (Math.random() < 0.15) this.say(m, 'wound', 0.7);
  },
  die(m) {
    if (m.T.archetype === 'kamikaze') return this.explode(m);
    this.say(m, 'death');
    if (m.md.clip('death')) { this.setState(m, 'death'); m.dieT = m.c.len + 1.5; }
    else { this.gib(m); this.remove(m); }
  },
  gib(m) {
    this.say(m, 'gib');
    const n = clamp(Math.round(m.T.h * 2), 2, 10);
    for (let k = 0; k < n; k++) Sam.burstBlood([m.x + (Math.random() - 0.5) * m.T.r, m.y + Math.random() * m.T.h, m.z + (Math.random() - 0.5) * m.T.r]);
  },
  explode(m) {
    const big = m.T.h > 2.4, R = big ? 6 : 4, c = [m.x, m.y + 1, m.z];
    Sam.burst((Sam.D.proj.hd_rocket || {}).boom, c[0], c[1], c[2], big ? 2 : 1.4);
    Sam.sound('proj_hd_rocket.hit', c[0], c[1], c[2], 1.4, 0.9);
    this.say(m, 'explode');
    this.blastPlayers({ x: c[0], y: c[1], z: c[2], blast: R / 1.6, dmg: big ? 18 : 12 });
    const pl = Player, dd = Math.hypot(pl.x - c[0], pl.y + 1 - c[1], pl.z - c[2]);
    Sam.shake = Math.max(Sam.shake || 0, clamp(1 - dd / (R * 4), 0, 1) * 0.8);
    this.remove(m);
    if (this.auth && Net.role && Net.ch) Net.send('smf', { x: 1, f: c.map(v => +v.toFixed(2)), s: big ? 2 : 1.4 });
  },
  remove(m) { const k = this.list.indexOf(m); if (k >= 0) this.list.splice(k, 1); },
  // моб под прицелом в пределах удара, блок перед ним закрывает: [моб, расстояние] или null
  aimed(p, d) {
    const eye = [p.x, p.y + EYE, p.z], h = Sam.trace(eye, d, 5);
    return this.onRay(eye, d, h ? h.t : 5);
  },
  // удар рукой или оружием из инвентаря; урон — из предмета (меч), перезарядка как у ударов в Minecraft
  swing(p, d, g) {
    if (p.atkCD > 0) return false;
    const st = p.held(), it = st && ITEMS[st.id], t = it && it.tool, m = g[0], eye = [p.x, p.y + EYE, p.z];
    p.atkCD = t && t.type === 'sword' ? 0.45 : 0.35; p.swing = 0.001;
    const fl = Math.hypot(d[0], d[2]) || 1, k = m.T.h < 2.6 ? 6 : 3.5;
    this.damage(m, (t && t.dmg ? t.dmg : 1) * 2, [d[0] / fl * k, d[2] / fl * k]);
    Sam.burstBlood([eye[0] + d[0] * g[1], eye[1] + d[1] * g[1], eye[2] + d[2] * g[1]]);
    Sam.sound('hd_knife.slash', m.x, m.y + 1, m.z, 0.6, 0.9 + Math.random() * 0.2);
    if (t && Game.mode === 'survival') {   // износ: меч за удар как за блок киркой, остальное вдвое быстрее (как блок мечом)
      st.dmg = (st.dmg || 0) + (t.type === 'sword' ? 1 : 2);
      if (st.dmg >= t.dur) { p.slots[p.selected] = null; Sfx.breakB('glass'); }
      UI.refreshHotbar();
    }
    return true;
  },
  // ---------- выстрелы ----------
  gunOf(m) { const g = m.T.gun_list; return g && g.length ? g[(m.gunI || 0) % g.length] : null; },
  muzzle(m, gun) {
    const T = m.T, c = Math.cos(m.yaw), s = Math.sin(m.yaw), k = T.draw;
    let mp = T.muzzle_pos || [0, T.height * 0.65, -(T.radius || 0.6)];
    if (gun) {
      mp = gun.pos;
      const b = gun.bone && this.pose(m).boneXf(gun.bone);   // по кости — ствол там, где он сейчас в анимации
      if (b && gun.off) { const r = qrot(b.q, 0, gun.off[0], gun.off[1], gun.off[2], [0, 0, 0]); mp = [b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2]]; }
    }
    return [m.x + (mp[0] * c + mp[2] * s) * k, m.y + mp[1] * k, m.z + (-mp[0] * s + mp[2] * c) * k];
  },
  fire(m, tg) {
    const T = m.T, gun = this.gunOf(m), sd = SAMOB_SHOTS[(gun && gun.shot) || T.shot] || SAMOB_SHOTS.fireball, f = this.muzzle(m, gun);
    const to = [tg.x - f[0], tg.y + 1 - f[1], tg.z - f[2]], L = Math.hypot(...to) || 1, dir = to.map(v => v / L);
    this.say(m, 'attack');
    if (sd.hit) {
      for (let k = 0; k < sd.hit; k++) {
        const dv = Sam.spread(dir, sd.spr || 1.5), h = Sam.trace(f, dv, 100), end = h ? h.t : 100, pl = this.playerOnRay(f, dv, end), hitT = pl ? pl.t : end;
        this.tracer(f, dv, hitT);
        if (pl) this.hurt(pl, sd.dmg);
        else if (h) Sam.impact(h.p, Sam.material(h.id), h.n);
      }
      return;
    }
    const pd = Sam.D.proj[sd.kind]; if (!pd) return;
    if (sd.lob) dir[1] += L / (sd.speed * sd.speed) * 7;
    const l2 = Math.hypot(...dir), v = dir.map(x => x / l2 * sd.speed), mdl = gun && gun.skin && this.D.models['mobp_' + gun.skin] ? 'mobp_' + gun.skin : T.proj ? 'mobp_' + T.id : null;
    if (mdl) this.model(mdl);
    this.addShot(sd, pd, f, v, mdl, T.id, true);
    if (this.auth && Net.role && Net.ch) Net.send('smf', { t: (gun && gun.shot) || T.shot, m: T.id, f: f.map(x => +x.toFixed(2)), v: v.map(x => +x.toFixed(2)) });
  },
  addShot(sd, pd, f, v, mdl, id, enemy, extra) {
    Sam.shots.push({ ...extra, kind: sd.kind, pd, x: f[0], y: f[1], z: f[2], px: f[0], py: f[1], pz: f[2], vx: v[0], vy: v[1], vz: v[2], age: 0, life: 5, mine: false, enemy, fiery: false, dmg: sd.dmg, blast: sd.blast ? sd.blast * 2 : 0, acc: new Float32Array(16), bounces: 0, mdl, noTrail: sd.noTrail });
  },
  tracerE: { name: 'tracer', tex: null, additive: false, cols: 1, rows: 1, rnd: false, rate: 1, life: [0.05, 0.12], speed: [0, 0], spin: [0, 0], size: [0.05, 0.08], rot: [0, 0], grow: 1, gravity: 0, colors: [[0, 255, 225, 130, 255]], alphas: [[0, 0, 0, 0, 255], [1, 0, 0, 0, 0]], intensity: [] },
  tracer(f, d, len) { const n = Math.min(14, Math.ceil(len / 1.5)); for (let k = 1; k <= n; k++) { const t = k / n * len; Sam.spawn(this.tracerE, f[0] + d[0] * t, f[1] + d[1] * t, f[2] + d[2] * t, 1); } },
  // ---------- физика ----------
  physics(m, dt, flyTo) {
    const T = m.T, w = T.w, hc = T.hc;
    if (!World.loaded(Math.floor(m.x), Math.floor(m.z))) { m.vx = m.vz = m.vy = 0; return false; }
    if (flyTo !== undefined) m.vy = clamp((flyTo - m.y) * 2, -5, 5);
    else m.vy = Math.max(m.vy - 26 * dt, -40);
    const box = () => [[m.x - w, m.y, m.z - w], [m.x + w, m.y + hc, m.z + w]];
    let b = box(), dy = m.vy * dt, ay = sweepAxis(b[0], b[1], 1, dy);
    m.y += ay; m.ground = false;
    if (ay !== dy) { if (m.vy < 0) m.ground = true; m.vy = 0; }
    let blocked = false;
    const kx = m.kbx || 0, kz = m.kbz || 0;
    if (kx || kz) { const f = Math.exp(-7 * dt); m.kbx = Math.abs(kx * f) < 0.05 ? 0 : kx * f; m.kbz = Math.abs(kz * f) < 0.05 ? 0 : kz * f; }
    b = box(); let dx = (m.vx + kx) * dt, ax = sweepAxis(b[0], b[1], 0, dx); m.x += ax; if (Math.abs(ax - dx) > 1e-4 && !kx) blocked = true;
    b = box(); let dz = (m.vz + kz) * dt, az = sweepAxis(b[0], b[1], 2, dz); m.z += az; if (Math.abs(az - dz) > 1e-4 && !kz) blocked = true;
    if (blocked && m.ground && flyTo === undefined) m.vy = T.h > 4 ? 10 : 8.2;   // порог в один блок перепрыгивает
    if (m.y < -30) { this.remove(m); return false; }
    return true;
  },
  turnTo(m, dx, dz, dt, rate = 7) {
    const want = Math.atan2(-dx, -dz), wr = a => ((a + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
    m.yaw += wr(want - m.yaw) * Math.min(1, dt * rate);
  },
  // ---------- поведение (считает только тот, кто призвал) ----------
  think(m, dt) {
    const T = m.T, arc = T.archetype;
    m.tt += dt; m.cd = Math.max(0, m.cd - dt); m.rest = Math.max(0, m.rest - dt);
    const flyer = arc === 'flyer';
    if (m.st === 'death') { m.vx = m.vz = 0; this.physics(m, dt); m.dieT -= dt; if (m.dieT <= 0) { this.remove(m); } return; }
    if (m.st === 'spawn') { m.vx = m.vz = 0; this.physics(m, dt); if (m.tt >= this.clipLen(m)) this.setState(m, 'idle'); return; }
    if (m.st === 'wound') { m.vx *= 0.8; m.vz *= 0.8; this.physics(m, dt, flyer ? m.y : undefined); if (m.tt >= this.clipLen(m)) this.setState(m, 'run'); return; }
    // ближайший игрок
    m.tgtT -= dt;
    if (m.tgtT <= 0 || !m.tgt) {
      m.tgtT = 0.4; let best = null, bd = 110;
      for (const tg of this.targets()) { const dd = Math.hypot(tg.x - m.x, tg.y - m.y, tg.z - m.z); if (dd < bd) { bd = dd; best = tg; } }
      m.tgt = best;
      if (best && !m.seen) { m.seen = true; this.say(m, 'sight'); }
    }
    m.idleS -= dt;
    if (m.idleS <= 0) { m.idleS = 5 + Math.random() * 10; this.say(m, 'idle', 0.7); }
    const tg = m.tgt;
    if (!tg) { m.vx = m.vz = 0; this.physics(m, dt, flyer ? m.y : undefined); this.setState(m, 'idle'); return; }
    const dx = tg.x - m.x, dz = tg.z - m.z, dy = tg.y - m.y, dh = Math.hypot(dx, dz) || 0.01, nx = dx / dh, nz = dz / dh;
    const reach = (T.reach || 1.4) * Math.max(T.draw, 0.5) + T.r * 0.6;
    const flyY = flyer ? tg.y + (dh > 5 ? 3 : 0.6) : undefined;
    this.turnTo(m, dx, dz, dt);
    // удар вблизи
    if (m.st === 'attack' || m.st === 'melee') {
      m.vx = m.vz = 0; this.physics(m, dt, flyY);
      const hitAt = m.c && m.c.hit ? m.c.hit : (T.melee_hit_time || this.clipLen(m) * 0.45);
      if (m.melee) {
        if (!m.hitDone && m.tt >= hitAt) {
          m.hitDone = true; this.say(m, 'melee');
          if (Math.hypot(dx, dy * 0.5, dz) <= reach + 1) this.hurt(tg, Math.max(1, (T.damage || 0.2) * 20));
        }
      } else if (m.shots > 0) {
        m.shotT -= dt;
        if (m.animIn > 0 && (m.animIn -= dt) <= 0) { const g = this.gunOf(m); if (g) this.playGun(m, g.anim); }
        if (m.shotT <= 0) {
          this.fire(m, tg); m.shots--;
          m.gunI = (m.gunI || 0) + 1;                       // следующий выстрел — из другой пушки
          const next = this.gunOf(m), cd = Math.max(T.cooldown || 1, 0.08), lead = next ? Math.min(next.t || 0, cd * 0.9) : 0;
          m.shotT = cd; m.animIn = next ? Math.max(cd - lead, 0.001) : 0;
        }
      }
      if (m.tt >= this.clipLen(m) && (m.melee || m.shots <= 0)) { m.melee = false; m.rest = T.rest || T.cooldown || 1.5; m.cd = 0.5; this.setState(m, 'idle'); }
      return;
    }
    if (arc === 'kamikaze') {
      if (Math.hypot(dx, dy, dz) < 2.2) { this.explode(m); return; }
    } else if (dh <= reach && Math.abs(dy) < T.h + 2 && m.cd <= 0 && (m.md.clip('melee') || !T.shot)) {
      m.melee = true; this.setState(m, 'melee'); return;
    } else if (T.shot && m.rest <= 0 && m.cd <= 0) {
      const R = T.range || [3, 40], eyeY = m.y + T.h * 0.7, L = Math.hypot(dx, tg.y + 1 - eyeY, dz);
      if (L <= R[1] && Sam.trace([m.x, eyeY, m.z], [dx / L, (tg.y + 1 - eyeY) / L, dz / L], L) === null) {
        const g = this.gunOf(m);
        m.melee = false; m.shots = T.burst || 1; m.animIn = 0; this.setState(m, 'attack', false, g && g.anim);
        m.shotT = g ? (g.t || 0.01) : Math.min(T.fire_time || 0.2, this.clipLen(m)); return;
      }
    }
    // догнать
    const keep = T.shot ? (T.range ? T.range[0] : 4) : reach * 0.7, go = (T.speed || 0) > 0 && (dh > keep);
    if (go) {
      m.charging = !!T.charge && dh > 8;
      const sp = m.charging && T.charge_speed ? Math.min(T.charge_speed, 14) : T.speed;
      m.vx = nx * sp; m.vz = nz * sp;
      if (T.leap && m.ground && dh > 3 && dh < 8 && Math.random() < dt * 1.5) m.vy = 8.5;
      this.setState(m, 'run');
    } else { m.vx = m.vz = 0; this.setState(m, 'idle'); }
    this.physics(m, dt, flyY);
  },
  // ---------- кадр ----------
  update(dt) {
    if (this.state !== 'ready') return;
    const list = this.list;
    for (let k = list.length - 1; k >= 0; k--) {
      const m = list[k];
      if (m.bl > 0) m.bl = Math.max(0, m.bl - dt);
      if (m.fl > 0) m.fl -= dt;
      m.t += dt; m.pt += dt;
      this.stepTick(m, dt);
      if (this.auth) this.think(m, dt);
      else {
        const f = Math.min(1, dt * 10);
        m.x += (m.nx - m.x) * f; m.y += (m.ny - m.y) * f; m.z += (m.nz - m.z) * f;
        const wr = a => ((a + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
        m.yaw += wr(m.nyaw - m.yaw) * f;
      }
    }
    if (this.auth) {
      this.netT -= dt;
      if (this.netT <= 0 && !(this.sentEmpty && !list.length)) { this.netT = 0.2; this.netSend(false); }
    } else if (list.length && (this.snapT -= dt) <= 0) this.list = [];   // призвавший ушёл
  },
  // ---------- сеть ----------
  netSend(force) {
    if (!Net.role || !Net.ch) return;
    this.sentEmpty = !this.list.length;
    Net.send('smb', { a: this.list.map(m => [m.i, m.T.ti, +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), SAMOB_ST.indexOf(m.st), m.st === 'attack' ? m.role : 0]) });
  },
  onSnap(v) {
    if (!v || !v.a || this.auth) return;
    if (this.state !== 'ready') { if (this.state === 'none') this.load(); return; }
    this.snapT = 3;
    const old = new Map(this.list.map(m => [m.i, m])), out = [];
    for (const r of v.a) {
      let m = old.get(r[0]);
      const T = SAMOB_LIST[r[1]]; if (!T) continue;
      if (!m) { const md = this.model('mob_' + T.id); if (!md) continue; m = { i: r[0], T, md, x: r[2], y: r[3], z: r[4], yaw: r[5], t: 0, pt: 0, bl: 0 }; this.setState(m, 'idle', true); }
      m.nx = r[2]; m.ny = r[3]; m.nz = r[4]; m.nyaw = r[5];
      const st = SAMOB_ST[r[6]] || 'idle';
      if (st !== m.st) { this.setState(m, st, false, r[7] || undefined); if (st === 'death') this.say(m, 'death'); else if (st === 'attack') this.say(m, 'attack'); }
      else if (st === 'attack' && r[7] && r[7] !== m.role) this.playGun(m, r[7]);
      out.push(m);
    }
    this.list = out;
  },
  onHit(v) { if (!v || !this.auth) return; const m = this.list.find(q => q.i === v.i); if (m) this.damage(m, v.d, v.k); },
  onShot(v) {
    if (!v || (this.auth && !v.g) || Sam.state !== 'ready') return;
    if (v.x) { Sam.burst((Sam.D.proj.hd_rocket || {}).boom, v.f[0], v.f[1], v.f[2], v.s || 1); Sam.sound('proj_hd_rocket.hit', v.f[0], v.f[1], v.f[2], 1.4, 0.9); return; }
    const sd = SAMOB_SHOTS[v.t], pd = sd && Sam.D.proj[sd.kind]; if (!pd) return;
    const T = SAMOB_LIST.find(q => q.id === v.m), mdl = this.state !== 'ready' ? null : v.g || (T && T.proj ? 'mobp_' + T.id : null);
    if (mdl) this.model(mdl);
    this.addShot(v.b ? { ...sd, blast: v.b } : sd, pd, v.f, v.v, mdl, v.m, false, v.k ? { mS: v.k, fxS: v.x2 } : undefined);
  },
  // ---------- отрисовка (из Sam.drawWorld) ----------
  draw(VP, cam, env) {
    if (this.state !== 'ready' || !this.list.length) return;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    for (const m of this.list) {
      const dx = m.x - cam.x, dz = m.z - cam.z, d = Math.hypot(dx, dz), far = 40 + m.T.h * 3;
      if (d > 240 || ((dx * fx + dz * fz) < -far && d > far)) continue;
      const md = this.pose(m);
      // свет: ярчайший по высоте тела (ноги большого моба могут оказаться внутри блока, где темно)
      let l = 0, sk = 0, bk = 0;
      for (const f of [0.1, 0.5, 1]) { l = World.light(Math.floor(m.x), Math.floor(m.y + 0.5 + (m.T.h - 0.5) * f), Math.floor(m.z)); sk = Math.max(sk, l >> 4); bk = Math.max(bk, l & 15); }
      const M = m4(), R = m4();
      m4translate(M, dx, m.y - cam.y, dz);
      m4mul(M, M, m4rotY(R, m.yaw));
      if (m.T.draw !== 1) m4mul(M, M, m4scale(R, m.T.draw, m.T.draw, m.T.draw));
      Sam.drawModel(md, VP, M, env, { sky: sk / 15, blk: bk / 15, flash: m.fl > 0 ? 0.8 : 0 });
    }
  }
};
