// ============================================================
//  Блоки, предметы, рецепты
// ============================================================
const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANKS: 5, LOG: 6, LEAVES: 7, SAND: 8, GRAVEL: 9, WATER: 10,
  GLASS: 11, BEDROCK: 12, COAL_ORE: 13, IRON_ORE: 14, GOLD_ORE: 15, DIAMOND_ORE: 16, BRICKS: 17, TABLE: 18,
  FURNACE: 19, FURNACE_LIT: 20, CHEST: 21, TORCH: 22, TORCH_N: 23, TORCH_S: 24, TORCH_E: 25, TORCH_W: 26,
  TALLGRASS: 27, FLOWER_RED: 28, FLOWER_YELLOW: 29, BIRCH_LOG: 30, BIRCH_LEAVES: 31, MOSSY: 32, BOOKSHELF: 33,
  SNOW_GRASS: 34, SNOW: 35, SANDSTONE: 36, CLAY: 37, OBSIDIAN: 38, WOOL: 39, LANTERN: 40, DEAD_BUSH: 41,
  PUMPKIN: 42, JACK: 43, LAVA: 44, STONE_BRICKS: 45, TV: 46, TV_ON: 47, WATER_F1: 48, WATER_F7: 54, LAVA_F1: 55, LAVA_F3: 57, CACTUS: 58,
  DOOR_W: 59, DOOR_W_H: 60, DOOR_W_O: 61, DOOR_W_OH: 62, DOOR_I: 63, DOOR_I_H: 64, DOOR_I_O: 65, DOOR_I_OH: 66, PANE: 67,
  LEVER: 68, LEVER_ON: 69, BTN_S: 70, BTN_S_ON: 71, BTN_W: 72, BTN_W_ON: 73,
  SPRUCE_LOG: 74, SPRUCE_LEAVES: 75, PODZOL: 76,
  LADDER: 77, TRAP_W: 78, TRAP_W_O: 79, TRAP_I: 80, TRAP_I_O: 81
};
const R_CUBE = 0, R_CROSS = 1, R_TORCH = 2, R_LIQUID = 3, R_CACTUS = 4, R_DOOR = 5, R_PANE = 6, R_SWITCH = 7, R_PLATE = 8;
const BLK = [];
function defBlock(id, o) {
  const d = Object.assign({
    id, name: '?', solid: true, opaque: true, cutout: false, render: R_CUBE, light: 0, opacity: 15,
    hardness: 1, tool: null, tier: 0, drop: id, sound: 'stone', support: false, gravity: false,
    replaceable: false, selectable: true, oriented: false, fuel: 0, smelt: 0, item: true
  }, o);
  if (!d.opaque && o.opacity === undefined) d.opacity = 0;
  const t = o.tex || {};
  const all = t.all;
  d.tiles = [t.side || all, t.side || all, t.top || all, t.bottom || t.top || all, t.side || all, t.side || all].map(n => {
    if (n === undefined) return 0;
    if (TILE[n] === undefined) throw new Error('нет тайла ' + n);
    return TILE[n];
  });
  d.front = t.front !== undefined ? TILE[t.front] : -1;
  d.icon = t.icon !== undefined ? TILE[t.icon] : d.tiles[4];
  BLK[id] = d;
  return d;
}
defBlock(B.AIR, { name: 'Воздух', solid: false, opaque: false, selectable: false, item: false, hardness: 0 });
defBlock(B.GRASS, { name: 'Блок травы', tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'grass' });
defBlock(B.DIRT, { name: 'Земля', tex: { all: 'dirt' }, hardness: 0.5, tool: 'shovel', sound: 'gravel' });
defBlock(B.STONE, { name: 'Камень', tex: { all: 'stone' }, hardness: 1.5, tool: 'pick', tier: 1, drop: B.COBBLE });
defBlock(B.COBBLE, { name: 'Булыжник', tex: { all: 'cobble' }, hardness: 2, tool: 'pick', tier: 1, smelt: B.STONE });
defBlock(B.PLANKS, { name: 'Доски', tex: { all: 'planks' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15 });
defBlock(B.LOG, { name: 'Бревно', tex: { top: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15, smelt: 315 });
defBlock(B.LEAVES, { name: 'Листва', tex: { all: 'leaves' }, opaque: false, cutout: true, opacity: 1, hardness: 0.2, tool: 'axe', sound: 'grass', drop: -1 });
defBlock(B.SAND, { name: 'Песок', tex: { all: 'sand' }, hardness: 0.5, tool: 'shovel', sound: 'sand', gravity: true, smelt: B.GLASS });
defBlock(B.GRAVEL, { name: 'Гравий', tex: { all: 'gravel' }, hardness: 0.6, tool: 'shovel', sound: 'gravel', gravity: true });
defBlock(B.WATER, { name: 'Вода', tex: { all: 'water' }, solid: false, opaque: false, opacity: 2, render: R_LIQUID, selectable: false, replaceable: true, hardness: 100, item: false });
defBlock(B.GLASS, { name: 'Стекло', tex: { all: 'glass' }, opaque: false, cutout: true, hardness: 0.3, sound: 'glass', drop: 0 });
defBlock(B.BEDROCK, { name: 'Коренная порода', tex: { all: 'bedrock' }, hardness: -1 });
defBlock(B.COAL_ORE, { name: 'Угольная руда', tex: { all: 'coal_ore' }, hardness: 3, tool: 'pick', tier: 1, drop: 257 });
defBlock(B.IRON_ORE, { name: 'Железная руда', tex: { all: 'iron_ore' }, hardness: 3, tool: 'pick', tier: 2, smelt: 258 });
defBlock(B.GOLD_ORE, { name: 'Золотая руда', tex: { all: 'gold_ore' }, hardness: 3, tool: 'pick', tier: 3, smelt: 259 });
defBlock(B.DIAMOND_ORE, { name: 'Алмазная руда', tex: { all: 'diamond_ore' }, hardness: 3, tool: 'pick', tier: 3, drop: 260 });
defBlock(B.BRICKS, { name: 'Кирпичи', tex: { all: 'bricks' }, hardness: 2, tool: 'pick', tier: 1 });
defBlock(B.TABLE, { name: 'Верстак', tex: { top: 'table_top', bottom: 'planks', side: 'table_side', front: 'table_front' }, oriented: true, hardness: 2.5, tool: 'axe', sound: 'wood', fuel: 15 });
defBlock(B.FURNACE, { name: 'Печь', tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front', icon: 'furnace_front' }, oriented: true, hardness: 3.5, tool: 'pick', tier: 1 });
defBlock(B.FURNACE_LIT, { name: 'Горящая печь', tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_lit' }, oriented: true, light: 13, hardness: 3.5, tool: 'pick', tier: 1, drop: B.FURNACE, item: false });
defBlock(B.CHEST, { name: 'Сундук', tex: { top: 'chest_top', side: 'chest_side', front: 'chest_front', icon: 'chest_front' }, oriented: true, hardness: 2.5, tool: 'axe', sound: 'wood', fuel: 15 });
const torchBase = { name: 'Факел', tex: { all: 'torch' }, solid: false, opaque: false, cutout: true, render: R_TORCH, light: 14, hardness: 0, sound: 'wood', support: true, drop: B.TORCH };
defBlock(B.TORCH, Object.assign({}, torchBase));
defBlock(B.TORCH_N, Object.assign({}, torchBase, { item: false }));
defBlock(B.TORCH_S, Object.assign({}, torchBase, { item: false }));
defBlock(B.TORCH_E, Object.assign({}, torchBase, { item: false }));
defBlock(B.TORCH_W, Object.assign({}, torchBase, { item: false }));
const plantBase = { solid: false, opaque: false, cutout: true, render: R_CROSS, hardness: 0, sound: 'grass', support: true };
defBlock(B.TALLGRASS, Object.assign({}, plantBase, { name: 'Высокая трава', tex: { all: 'tallgrass' }, replaceable: true, drop: -2 }));
defBlock(B.FLOWER_RED, Object.assign({}, plantBase, { name: 'Красный цветок', tex: { all: 'flower_red' } }));
defBlock(B.FLOWER_YELLOW, Object.assign({}, plantBase, { name: 'Жёлтый цветок', tex: { all: 'flower_yellow' } }));
defBlock(B.BIRCH_LOG, { name: 'Берёзовое бревно', tex: { top: 'birch_top', side: 'birch_side' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15, smelt: 315 });
defBlock(B.SPRUCE_LOG, { name: 'Еловое бревно', tex: { top: 'spruce_top', side: 'spruce_side' }, hardness: 2, tool: 'axe', sound: 'wood', fuel: 15, smelt: 315 });
defBlock(B.SPRUCE_LEAVES, { name: 'Еловая хвоя', tex: { all: 'spruce_leaves' }, opaque: false, cutout: true, opacity: 1, hardness: 0.2, tool: 'axe', sound: 'grass', drop: -1 });
defBlock(B.PODZOL, { name: 'Подзол', tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'grass' });
defBlock(B.BIRCH_LEAVES, { name: 'Берёзовая листва', tex: { all: 'birch_leaves' }, opaque: false, cutout: true, opacity: 1, hardness: 0.2, tool: 'axe', sound: 'grass', drop: -1 });
defBlock(B.MOSSY, { name: 'Замшелый булыжник', tex: { all: 'mossy' }, hardness: 2, tool: 'pick', tier: 1 });
defBlock(B.BOOKSHELF, { name: 'Книжная полка', tex: { top: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood', fuel: 15 });
defBlock(B.SNOW_GRASS, { name: 'Заснеженная трава', tex: { top: 'snow', bottom: 'dirt', side: 'snow_side' }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'snow' });
defBlock(B.SNOW, { name: 'Снег', tex: { all: 'snow' }, hardness: 0.2, tool: 'shovel', sound: 'snow' });
defBlock(B.SANDSTONE, { name: 'Песчаник', tex: { top: 'sandstone_top', side: 'sandstone_side' }, hardness: 0.8, tool: 'pick', tier: 1 });
defBlock(B.CLAY, { name: 'Глина', tex: { all: 'clay' }, hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 313, dropN: 4 });
defBlock(B.OBSIDIAN, { name: 'Обсидиан', tex: { all: 'obsidian' }, hardness: 50, tool: 'pick', tier: 4 });
defBlock(B.WOOL, { name: 'Шерсть', tex: { all: 'wool' }, hardness: 0.8, sound: 'cloth' });
defBlock(B.LANTERN, { name: 'Фонарь', tex: { all: 'lantern' }, light: 15, hardness: 1, tool: 'pick', tier: 0, sound: 'glass' });
defBlock(B.DEAD_BUSH, Object.assign({}, plantBase, { name: 'Сухой куст', tex: { all: 'dead_bush' }, replaceable: true, drop: 256 }));
defBlock(B.PUMPKIN, { name: 'Тыква', tex: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face', icon: 'pumpkin_face' }, oriented: true, hardness: 1, tool: 'axe', sound: 'wood' });
defBlock(B.JACK, { name: 'Светильник Джека', tex: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_face', icon: 'jack_face' }, oriented: true, light: 15, hardness: 1, tool: 'axe', sound: 'wood' });
defBlock(B.LAVA, { name: 'Лава', tex: { all: 'lava' }, solid: false, opaque: false, opacity: 15, render: R_LIQUID, light: 15, selectable: false, replaceable: true, hardness: 100, item: false });
defBlock(B.STONE_BRICKS, { name: 'Каменные кирпичи', tex: { all: 'stone_bricks' }, hardness: 1.5, tool: 'pick', tier: 1 });
defBlock(B.TV, { name: 'Телевизор', tex: { top: 'tv_top', side: 'tv_side', front: 'tv_off', icon: 'tv_off' }, oriented: true, hardness: 1.2, tool: 'pick', tier: 0, sound: 'glass' });
defBlock(B.TV_ON, { name: 'Включённый телевизор', tex: { top: 'tv_top', side: 'tv_side', front: 'tv_screen' }, oriented: true, light: 9, hardness: 1.2, tool: 'pick', tier: 0, sound: 'glass', drop: B.TV, item: false });
defBlock(B.CACTUS, { name: 'Кактус', tex: { top: 'cactus_top', side: 'cactus_side', icon: 'cactus_side' }, render: R_CACTUS, opaque: false, cutout: true, hardness: 0.4, sound: 'cloth', opacity: 0 });
// двери: низ/верх × закрыта/открыта; ориентация (какая сторона клетки занята полотном) хранится в World.orient
const DOORINFO = new Array(256).fill(null);
{
  const mk = (mat, ids, tiles, name, hard, tool, tier, snd) => {
    // ids: [низ закрыт, верх закрыт, низ открыт, верх открыт]
    ids.forEach((id, k) => {
      const half = k & 1, open = k >> 1;
      defBlock(id, {
        name, tex: { all: tiles[half] }, solid: true, opaque: false, cutout: true, opacity: 0, render: R_DOOR, oriented: true,
        hardness: hard, tool, tier, sound: snd, drop: ids[0], item: k === 0, fuel: mat === 'wood' ? 10 : 0
      });
      DOORINFO[id] = { mat, half, open: !!open, lo: ids[0], ids };
    });
  };
  mk('wood', [B.DOOR_W, B.DOOR_W_H, B.DOOR_W_O, B.DOOR_W_OH], ['door_wood_lo', 'door_wood_hi'], 'Деревянная дверь', 3, 'axe', 0, 'wood');
  mk('iron', [B.DOOR_I, B.DOOR_I_H, B.DOOR_I_O, B.DOOR_I_OH], ['door_iron_lo', 'door_iron_hi'], 'Железная дверь', 5, 'pick', 1, 'metal');
}
// лестница: прислонена к стене (ориентация 0..3 — к какой стороне клетки), по ней лазят
defBlock(B.LADDER, { name: 'Лестница', tex: { all: 'ladder' }, solid: false, opaque: false, cutout: true, opacity: 0, render: R_PLATE, oriented: true, hardness: 0.4, tool: 'axe', sound: 'wood', fuel: 5 });
// люки: ориентация = сторона петель (0..3) + 4, если люк в верхней половине клетки
const TRAPINFO = new Array(256).fill(null);
{
  const mk = (mat, closed, open, name, tile, hard, tool, tier, snd) => [closed, open].forEach((id, k) => {
    defBlock(id, { name, tex: { all: tile }, solid: true, opaque: false, cutout: true, opacity: 0, render: R_PLATE, oriented: true, hardness: hard, tool, tier, sound: snd, drop: closed, item: k === 0, fuel: mat === 'wood' ? 10 : 0 });
    TRAPINFO[id] = { mat, open: !!k, closed, openId: open };
  });
  mk('wood', B.TRAP_W, B.TRAP_W_O, 'Деревянный люк', 'trap_wood', 3, 'axe', 0, 'wood');
  mk('iron', B.TRAP_I, B.TRAP_I_O, 'Железный люк', 'trap_iron', 5, 'pick', 1, 'metal');
}
const isTrap = id => !!TRAPINFO[id];
defBlock(B.PANE, { name: 'Стеклянная панель', tex: { all: 'glass' }, solid: true, opaque: false, cutout: true, opacity: 0, render: R_PANE, hardness: 0.3, sound: 'glass', drop: 0 });
// частичные формы (столкновения, прицеливание, подсветка рамкой)
const PARTIAL = new Uint8Array(256);
PARTIAL[B.PANE] = 1; for (let i = 0; i < 256; i++) if (DOORINFO[i]) PARTIAL[i] = 1;
const isDoor = id => !!DOORINFO[id];
PARTIAL[B.LADDER] = 1; for (let i = 0; i < 256; i++) if (TRAPINFO[i]) PARTIAL[i] = 1;
// рычаг и кнопки: состояние — отдельный id, сторона крепления (индекс 0..5 в порядке +X,-X,+Y,-Y,+Z,-Z) хранится в World.orient
const SWINFO = new Array(256).fill(null);
{
  const mk = (kind, wood, off, on, name, tile, snd) => {
    [off, on].forEach((id, k) => {
      defBlock(id, { name, tex: { all: tile }, solid: false, opaque: false, cutout: true, opacity: 0, render: R_SWITCH, oriented: true, hardness: 0.5, tool: wood ? 'axe' : 'pick', tier: 0, sound: snd, drop: off, item: k === 0, fuel: kind === 'btn' && wood ? 5 : 0 });
      SWINFO[id] = { kind, wood, on: !!k, off, onId: on };
    });
  };
  mk('lever', false, B.LEVER, B.LEVER_ON, 'Рычаг', 'cobble', 'stone');
  mk('btn', false, B.BTN_S, B.BTN_S_ON, 'Каменная кнопка', 'stone', 'stone');
  mk('btn', true, B.BTN_W, B.BTN_W_ON, 'Деревянная кнопка', 'planks', 'wood');
}
const isSwitch = id => !!SWINFO[id];
for (let i = 0; i < 256; i++) if (SWINFO[i]) PARTIAL[i] = 1;

// закрытые двери не пропускают взгляд существа
const LOSB = new Uint8Array(256);
for (let i = 0; i < 256; i++) if ((DOORINFO[i] && !DOORINFO[i].open) || (TRAPINFO[i] && !TRAPINFO[i].open)) LOSB[i] = 1;
// ---------- формы дверей и панелей (в координатах клетки 0..1) ----------
const DOOR_T = 3 / 16, PANE_A = 7 / 16, PANE_B = 9 / 16;
function doorBox(id, o) {
  const e = DOORINFO[id].open ? (o + 1) & 3 : o, t = DOOR_T;
  return e === 0 ? [0, 0, 1 - t, 1, 1, 1] : e === 1 ? [0, 0, 0, t, 1, 1] : e === 2 ? [0, 0, 0, 1, 1, t] : [1 - t, 0, 0, 1, 1, 1];
}
const paneJoin = n => n === B.PANE || n === B.GLASS || OPQ[n] === 1;
// соседи: -X, +X, -Z, +Z → панели вдоль X и Z (если соединений нет — крест)
function paneShape(nxm, nxp, nzm, nzp) {
  let a = paneJoin(nxm), b = paneJoin(nxp), c = paneJoin(nzm), d = paneJoin(nzp);
  if (!(a || b || c || d)) a = b = c = d = true;
  const A = PANE_A, Bq = PANE_B, out = [];
  if (a || b) out.push({ ax: 0, box: [a ? 0 : A, 0, A, b ? 1 : Bq, 1, Bq] });                 // полоса вдоль X
  if (c || d) out.push({ ax: 2, box: [A, 0, c ? 0 : A, Bq, 1, d ? 1 : Bq] });                 // полоса вдоль Z
  return out;
}

// форма рычага / кнопки для стороны крепления k; handle — тонкая «палка» рычага (опорная точка, конец, поперечные оси)
function switchShape(id, k) {
  const di = SWINFO[id], a = k >> 1, sg = (k & 1) ? -1 : 1, hA = a === 0 ? 2 : 0, vA = a === 1 ? 2 : 1;
  const dep = di.kind === 'btn' ? (di.on ? 1 / 16 : 2 / 16) : 3 / 16;
  const wh = di.kind === 'btn' ? 6 / 16 : 6 / 16, wv = di.kind === 'btn' ? 4 / 16 : 5 / 16;
  const lo = [0, 0, 0], hi = [1, 1, 1];
  lo[a] = sg > 0 ? 0 : 1 - dep; hi[a] = sg > 0 ? dep : 1;
  lo[hA] = 0.5 - wh / 2; hi[hA] = 0.5 + wh / 2; lo[vA] = 0.5 - wv / 2; hi[vA] = 0.5 + wv / 2;
  const base = [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]];
  if (di.kind !== 'lever') return { base, handle: null, bounds: base };
  const n = [0, 0, 0]; n[a] = sg;
  const t = [0, 0, 0]; t[vA] = 1;
  const sgn = di.on ? 1 : -1, c = Math.SQRT1_2 * 0.9, d = [n[0] * 0.5 + t[0] * sgn * c, n[1] * 0.5 + t[1] * sgn * c, n[2] * 0.5 + t[2] * sgn * c];
  const dl = Math.hypot(d[0], d[1], d[2]); for (let i = 0; i < 3; i++) d[i] /= dl;
  const pv = [0.5, 0.5, 0.5]; pv[a] = sg > 0 ? dep : 1 - dep;
  const tip = [pv[0] + d[0] * 0.5, pv[1] + d[1] * 0.5, pv[2] + d[2] * 0.5];
  // поперечные оси
  const u1 = [d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]];
  const ul = Math.hypot(u1[0], u1[1], u1[2]) || 1; for (let i = 0; i < 3; i++) u1[i] /= ul;
  const u2 = [d[1] * u1[2] - d[2] * u1[1], d[2] * u1[0] - d[0] * u1[2], d[0] * u1[1] - d[1] * u1[0]];
  const bounds = base.slice();
  for (let i = 0; i < 3; i++) { bounds[i] = Math.min(bounds[i], tip[i] - 0.07, pv[i] - 0.07); bounds[i + 3] = Math.max(bounds[i + 3], tip[i] + 0.07, pv[i] + 0.07); }
  return { base, handle: { pv, tip, u1, u2 }, bounds };
}
// тонкая пластина у стороны e клетки (как полотно двери): 0 +Z, 1 -X, 2 -Z, 3 +X
function sidePlate(e, t) { return e === 0 ? [0, 0, 1 - t, 1, 1, 1] : e === 1 ? [0, 0, 0, t, 1, 1] : e === 2 ? [0, 0, 0, 1, 1, t] : [1 - t, 0, 0, 1, 1, 1]; }
const TRAP_T = 3 / 16;
function trapBox(id, v) {
  if (TRAPINFO[id].open) return sidePlate(v & 3, TRAP_T);
  return (v & 4) ? [0, 1 - TRAP_T, 0, 1, 1, 1] : [0, 0, 0, 1, TRAP_T, 1];
}
function plateBox(id, v) { return id === B.LADDER ? sidePlate(v & 3, 1.5 / 16) : trapBox(id, v); }
function blockParts(id, x, y, z) {
  if (id === B.LADDER || TRAPINFO[id]) return [plateBox(id, World.orientOf(x, y, z))];
  if (SWINFO[id]) return [switchShape(id, World.orientOf(x, y, z)).bounds];   // список частичных форм для физики/прицела
  if (id === B.PANE) return paneShape(World.get(x - 1, y, z), World.get(x + 1, y, z), World.get(x, y, z - 1), World.get(x, y, z + 1)).map(q => q.box);
  if (DOORINFO[id]) return [doorBox(id, World.orientOf(x, y, z))];
  return null;
}

// текучие жидкости: уровень 1..7 (вода), 1..3 (лава); источник — WATER / LAVA
const FKIND = new Uint8Array(256), FLEVEL = new Uint8Array(256);   // FKIND: 1 вода, 2 лава
FKIND[B.WATER] = 1; FLEVEL[B.WATER] = 8; FKIND[B.LAVA] = 2; FLEVEL[B.LAVA] = 4;
for (let l = 1; l <= 7; l++) {
  const id = B.WATER_F1 + l - 1; FKIND[id] = 1; FLEVEL[id] = l;
  defBlock(id, { name: 'Вода', tex: { all: 'water' }, solid: false, opaque: false, opacity: 2, render: R_LIQUID, selectable: false, replaceable: true, hardness: 100, item: false, drop: 0 });
}
for (let l = 1; l <= 3; l++) {
  const id = B.LAVA_F1 + l - 1; FKIND[id] = 2; FLEVEL[id] = l;
  defBlock(id, { name: 'Лава', tex: { all: 'lava' }, solid: false, opaque: false, opacity: 15, render: R_LIQUID, light: 15, selectable: false, replaceable: true, hardness: 100, item: false, drop: 0 });
}
const waterId = l => l >= 8 ? B.WATER : B.WATER_F1 + l - 1, lavaId = l => l >= 4 ? B.LAVA : B.LAVA_F1 + l - 1;
for (let i = 0; i < 256; i++) if (!BLK[i]) BLK[i] = BLK[0];

// быстрые таблицы
const OPQ = new Uint8Array(256), OPAC = new Uint8Array(256), EMIT = new Uint8Array(256), SOLID = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  const d = BLK[i];
  OPQ[i] = d.opaque && d.render === R_CUBE ? 1 : 0;
  OPAC[i] = d.opaque ? 15 : d.opacity;
  EMIT[i] = d.light; SOLID[i] = d.solid ? 1 : 0;
}
const isTorch = id => id >= B.TORCH && id <= B.TORCH_W;
const isLiquid = id => FKIND[id] > 0, isWater = id => FKIND[id] === 1, isLava = id => FKIND[id] === 2;

// ---------- предметы ----------
const ITEMS = [], RECIPES_ARMOR = [];
for (let i = 0; i < 256; i++) {
  const d = BLK[i];
  if (i && d !== BLK[0] && d.item) ITEMS[i] = { id: i, name: d.name, stack: 64, block: i, fuel: d.fuel, smelt: d.smelt };
}
const I = { STICK: 256, COAL: 257, IRON: 258, GOLD: 259, DIAMOND: 260 };
ITEMS[256] = { id: 256, name: 'Палка', stack: 64, sprite: TILE.stick, fuel: 5 };
ITEMS[257] = { id: 257, name: 'Уголь', stack: 64, sprite: TILE.coal, fuel: 80 };
ITEMS[258] = { id: 258, name: 'Железный слиток', stack: 64, sprite: TILE.iron_ingot };
ITEMS[259] = { id: 259, name: 'Золотой слиток', stack: 64, sprite: TILE.gold_ingot };
ITEMS[260] = { id: 260, name: 'Алмаз', stack: 64, sprite: TILE.diamond };
const TOOL_MATS = [
  { k: 'wood', adj: ['Деревянная', 'Деревянный', 'Деревянная'], tier: 1, speed: 2, dur: 60, fuel: 10 },
  { k: 'stone', adj: ['Каменная', 'Каменный', 'Каменная'], tier: 2, speed: 4, dur: 132 },
  { k: 'iron', adj: ['Железная', 'Железный', 'Железная'], tier: 3, speed: 6, dur: 251 },
  { k: 'gold', adj: ['Золотая', 'Золотой', 'Золотая'], tier: 1, speed: 12, dur: 33 },
  { k: 'diamond', adj: ['Алмазная', 'Алмазный', 'Алмазная'], tier: 4, speed: 8, dur: 1562 }
];
const TOOL_TYPES = [['pick', 'кирка'], ['axe', 'топор'], ['shovel', 'лопата']];
const TOOL_ID = {};
{
  let id = 270;
  TOOL_MATS.forEach(m => TOOL_TYPES.forEach(([t, nm], ti) => {
    ITEMS[id] = {
      id, name: m.adj[ti] + ' ' + nm, stack: 1, sprite: TILE[t + '_' + m.k],
      tool: { type: t, tier: m.tier, speed: m.speed, dur: m.dur }, fuel: m.fuel || 0
    };
    TOOL_ID[t + '_' + m.k] = id; id++;
  }));
}
// мечи (id с 300, чтобы не сдвигать старые предметы)
{
  const dmg = { wood: 4, stone: 5, iron: 6, gold: 4, diamond: 7 };
  TOOL_MATS.forEach((m, i) => {
    const id = 300 + i;
    ITEMS[id] = { id, name: m.adj[1] + ' меч', stack: 1, sprite: TILE['sword_' + m.k], tool: { type: 'sword', tier: m.tier, speed: 1.6, dur: m.dur, dmg: dmg[m.k] }, fuel: m.fuel || 0 };
    TOOL_ID['sword_' + m.k] = id;
  });
}
// броня: id с 320 (шлем, нагрудник, поножи, ботинки) × железо, золото, алмаз
const ARMOR_MATS = [
  { k: 'iron', n: ['Железный шлем', 'Железный нагрудник', 'Железные поножи', 'Железные ботинки'], pts: [2, 6, 5, 2], dur: [165, 240, 225, 195], ing: 258 },
  { k: 'gold', n: ['Золотой шлем', 'Золотой нагрудник', 'Золотые поножи', 'Золотые ботинки'], pts: [2, 5, 3, 1], dur: [77, 112, 105, 91], ing: 259 },
  { k: 'diamond', n: ['Алмазный шлем', 'Алмазный нагрудник', 'Алмазные поножи', 'Алмазные ботинки'], pts: [3, 8, 6, 3], dur: [363, 528, 495, 429], ing: 260 }
];
const ARMOR_KINDS = ['helmet', 'chest', 'legs', 'boots'];
const ARMOR_PAT = [['III', 'I I'], ['I I', 'III', 'III'], ['III', 'I I', 'I I'], ['I I', 'I I']];
{
  let id = 320;
  ARMOR_MATS.forEach(m => ARMOR_KINDS.forEach((kd, si) => {
    ITEMS[id] = { id, name: m.n[si], stack: 1, sprite: TILE['armor_' + kd + '_' + m.k], armor: { slot: si, pts: m.pts[si], dur: m.dur[si], mat: m.k } };
    RECIPES_ARMOR.push({ pattern: ARMOR_PAT[si], key: { I: m.ing }, out: id });
    id++;
  }));
}
ITEMS[B.DOOR_W].sprite = TILE.door_wood_item; ITEMS[B.DOOR_I].sprite = TILE.door_iron_item;
ITEMS[B.PANE].sprite = TILE.pane_item;
ITEMS[B.LADDER].sprite = TILE.ladder; ITEMS[B.TRAP_W].sprite = TILE.trap_wood; ITEMS[B.TRAP_I].sprite = TILE.trap_iron;
ITEMS[B.LEVER].sprite = TILE.lever_item; ITEMS[B.BTN_S].sprite = TILE.btn_stone_item; ITEMS[B.BTN_W].sprite = TILE.btn_wood_item;
ITEMS[313] = { id: 313, name: 'Глиняный шарик', stack: 64, sprite: TILE.clay_ball, smelt: 314 };
ITEMS[314] = { id: 314, name: 'Кирпич', stack: 64, sprite: TILE.brick_item };
ITEMS[315] = { id: 315, name: 'Древесный уголь', stack: 64, sprite: TILE.charcoal, fuel: 80 };
ITEMS[310] = { id: 310, name: 'Ведро', stack: 1, sprite: TILE.bucket };
ITEMS[311] = { id: 311, name: 'Ведро с водой', stack: 1, sprite: TILE.bucket_water };
ITEMS[312] = { id: 312, name: 'Ведро с лавой', stack: 1, sprite: TILE.bucket_lava, fuel: 1000 };
const SMELT = { [B.IRON_ORE]: 258, [B.GOLD_ORE]: 259, [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE, [313]: 314, [B.LOG]: 315, [B.BIRCH_LOG]: 315, [B.SPRUCE_LOG]: 315 };
function fuelOf(id) { const it = ITEMS[id]; return it ? it.fuel || 0 : 0; }
function itemName(id) { return ITEMS[id] ? ITEMS[id].name : '?'; }
function maxStack(id) { return ITEMS[id] ? ITEMS[id].stack : 64; }

// ---------- рецепты ----------
const RECIPES = [];
function recipe(pattern, key, out, count = 1) {
  RECIPES.push({ pattern, key, out, count, w: Math.max(...pattern.map(r => r.length)), h: pattern.length });
}
const isLeafId = id => id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES;
const isLogId = id => id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG;
const LOGS = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG];
recipe(['L'], { L: LOGS }, B.PLANKS, 4);
recipe(['P', 'P'], { P: B.PLANKS }, I.STICK, 4);
recipe(['PP', 'PP'], { P: B.PLANKS }, B.TABLE);
recipe(['c', 's'], { c: [I.COAL, 315], s: I.STICK }, B.TORCH, 4);
recipe(['CCC', 'C C', 'CCC'], { C: B.COBBLE }, B.FURNACE);
recipe(['III', 'IGI', 'III'], { I: I.IRON, G: B.GLASS }, B.TV);
for (const r of RECIPES_ARMOR) recipe(r.pattern, r.key, r.out);
recipe(['PP', 'PP', 'PP'], { P: B.PLANKS }, B.DOOR_W, 3);
recipe(['II', 'II', 'II'], { I: I.IRON }, B.DOOR_I, 3);
recipe(['GGG', 'GGG'], { G: B.GLASS }, B.PANE, 16);
recipe(['s s', 'sss', 's s'], { s: I.STICK }, B.LADDER, 3);
recipe(['PPP', 'PPP'], { P: B.PLANKS }, B.TRAP_W, 2);
recipe(['II', 'II'], { I: I.IRON }, B.TRAP_I);
recipe(['##', '##'], { '#': 313 }, B.CLAY);
recipe(['##', '##'], { '#': 314 }, B.BRICKS);
recipe(['s', 'C'], { s: I.STICK, C: B.COBBLE }, B.LEVER);
recipe(['S'], { S: B.STONE }, B.BTN_S);
recipe(['P'], { P: B.PLANKS }, B.BTN_W);
recipe(['I I', ' I '], { I: I.IRON }, 310);
recipe(['PPP', 'P P', 'PPP'], { P: B.PLANKS }, B.CHEST);
recipe(['##', '##'], { '#': B.SAND }, B.SANDSTONE);
recipe(['##', '##'], { '#': B.STONE }, B.STONE_BRICKS, 4);
recipe(['PPP', 'sss', 'PPP'], { P: B.PLANKS, s: I.STICK }, B.BOOKSHELF);
recipe(['p', 't'], { p: B.PUMPKIN, t: B.TORCH }, B.JACK);
recipe([' I ', 'ItI', ' I '], { I: I.IRON, t: B.TORCH }, B.LANTERN, 2);
recipe(['CL'], { C: B.COBBLE, L: [B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES] }, B.MOSSY);
{
  const matItem = { wood: B.PLANKS, stone: B.COBBLE, iron: I.IRON, gold: I.GOLD, diamond: I.DIAMOND };
  for (const m of TOOL_MATS) {
    const X = matItem[m.k];
    recipe(['XXX', ' s ', ' s '], { X, s: I.STICK }, TOOL_ID['pick_' + m.k]);
    recipe(['XX', 'Xs', ' s'], { X, s: I.STICK }, TOOL_ID['axe_' + m.k]);
    recipe(['X', 's', 's'], { X, s: I.STICK }, TOOL_ID['shovel_' + m.k]);
    recipe(['X', 'X', 's'], { X, s: I.STICK }, TOOL_ID['sword_' + m.k]);
  }
}
function keyMatch(k, id) { return Array.isArray(k) ? k.includes(id) : k === id; }
// grid: массив слотов size×size
function matchRecipe(grid, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grid[y * size + x]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.w !== w || r.h !== h) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const px = mirror ? w - 1 - x : x;
        const ch = (r.pattern[y][px] || ' ');
        const s = grid[(y0 + y) * size + x0 + x];
        if (ch === ' ') { if (s) ok = false; }
        else if (!s || !keyMatch(r.key[ch], s.id)) ok = false;
      }
      if (ok) return { id: r.out, count: r.count };
    }
  }
  return null;
}
