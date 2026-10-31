"""Облик «Серьёзный Сэм»: собирает модели, анимации, текстуры, звуки и эффекты в src/00c_sam_data.js.

    python tools/export_sam.py

Источники (только с этого компьютера, в репозиторий не кладутся сами файлы игры — только собранный пакет):
  * модель классического Сэма — из установленной Serious Sam Fusion 2017 (читается конвертером ss2td);
  * оружие HD (вид от первого лица с руками, модели в руке, снаряды, эффекты, звуки, иконки) — из ресурсов,
    которые export_weapons.py уже сделал для мода serious-sam-weapons-forge.

Пакет: gzip( "SAMP" | u32 длина JSON | JSON | выравнивание до 4 | двоичные блоки ). Всё little-endian.
Вершина модели (24 байта): pos int16×3 (+1 пусто) по рамке модели, нормаль int8×4, uv half×2, кости u8×4, веса u8×4.
Кадры анимаций: кватернионы int16×4 только для костей клипа (mask), позиции float32 для posBones.
"""
import base64
import gzip
import io
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS2TD = os.environ.get('SS2TD', r'C:\Users\PC\Desktop\генератор ии\universal-modder-main\work\sam-in-teardown\ss2td')
WEAP = os.environ.get('SSW_RES', r'C:\Users\PC\serious-sam-weapons-forge\src\generated\resources')
A = os.path.join(WEAP, 'assets', 'serioussamweapons')
OUT = os.path.join(ROOT, 'src', '00c_sam_data.js')

SAM_MDL = 'Content/SeriousSam3/Models/Player/SeriousSam/SeriousSam_Classic.mdl'
SAM_HEIGHT = 1.85
TEX_MAX = 512
HD = ['hd_knife', 'hd_chainsaw', 'hd_colt', 'hd_singleshotgun', 'hd_doubleshotgun', 'hd_tommygun', 'hd_minigun',
      'hd_rocketlauncher', 'hd_grenadelauncher', 'hd_flamer', 'hd_laser', 'hd_sniper', 'hd_cannon', 'hd_seriousbomb']
PROJ = ['hd_rocket', 'hd_grenade', 'hd_cannonball', 'hd_laser', 'hd_flame']
SAM_CLIPS = [
    # ноги (и покачивание рук при ходьбе)
    'Idle', 'Walk', 'Run', 'BackPedalRun', 'StrafeRunLeft', 'StrafeRunRight', 'CrouchIdle', 'CrouchWalk', 'Jump_Idle_Fall',
    # верх тела: общая поза пальцев/рук, поза под каждое оружие, выстрелы
    'Body_Idle', 'Body_Idle_Knife', 'Body_Idle_Chainsaw', 'Body_Idle_DualColt', 'Body_Idle_SingleShotgun', 'Body_Idle_DoubleShotgun',
    'Body_Idle_Tommygun', 'Body_Idle_Minigun', 'Body_Idle_RocketLauncher', 'Body_GrenadeLauncherIdle_NotReady', 'Body_Idle_Flamer',
    'Body_Idle_Laser', 'Body_Idle_Sniper', 'Body_Idle_Cannon', 'Body_Idle_SeriousBomb',
    'Body_Fire_Pistol', 'Body_Fire_SingleShotgun', 'Body_Fire_DoubleShotgun', 'Body_Fire_AssaultRifle', 'Body_Fire_RocketLauncher',
    'Body_Fire_Sniper', 'Body_Fire_Laser', 'Body_Fire_Cannon', 'Body_KnifeBackStab', 'Body_Throw_Explosives', 'DeathAbyssFall',
]


class Blob:
    """Двоичная часть пакета: блоки с выравниванием по 4 байта."""
    def __init__(self):
        self.b = bytearray()

    def add(self, data):
        while len(self.b) % 4:
            self.b.append(0)
        off = len(self.b)
        self.b += data
        return [off, len(data)]


BLOB = Blob()
TEXTURES = {}        # ключ -> [off, len, mime, w, h, alpha]


def r5(x):
    return round(float(x), 5)


# ---------------------------------------------------------------- текстуры
def add_texture(key, img, max_dim=TEX_MAX):
    if key in TEXTURES:
        return key
    im = img.convert('RGBA')
    if max(im.size) > max_dim:
        f = max_dim / max(im.size)
        im = im.resize((max(4, round(im.size[0] * f)), max(4, round(im.size[1] * f))), Image.LANCZOS)
    a = np.asarray(im)[..., 3]
    alpha = bool((a < 250).any())
    buf = io.BytesIO()
    if alpha:
        im.save(buf, 'WEBP', quality=86, method=6)
    else:
        im.convert('RGB').save(buf, 'WEBP', quality=84, method=6)
    TEXTURES[key] = BLOB.add(buf.getvalue()) + ['image/webp', im.size[0], im.size[1], alpha]
    return key


def png_texture(rel, max_dim=TEX_MAX):
    p = os.path.join(A, rel if rel.endswith('.png') else rel + '.png')
    key = rel.replace('.png', '')
    if key in TEXTURES:
        return key
    if not os.path.exists(p):
        return add_texture(key, Image.new('RGBA', (4, 4), (90, 90, 90, 255)))
    return add_texture(key, Image.open(p), max_dim)


# ---------------------------------------------------------------- модели
def pack_model(name, bones, tex, groups, pos, nrm, uv, bi, bw, idx, clips, locators, extra=None):
    """bones: [(name, parent, q4, p3, inv12)]; pos/nrm Nx3, uv Nx2, bi/bw Nx4, idx M; clips: {name: dict}."""
    pos = np.asarray(pos, np.float32); nrm = np.asarray(nrm, np.float32); uv = np.asarray(uv, np.float32)
    bi = np.asarray(bi, np.int64); bw = np.asarray(bw, np.float32); idx = np.asarray(idx, np.int64)
    nv = len(pos)
    lo = pos.min(axis=0) if nv else np.zeros(3, np.float32)
    hi = pos.max(axis=0) if nv else np.ones(3, np.float32)
    span = np.maximum(hi - lo, 1e-4)
    q = np.round((pos - lo) / span * 65535 - 32768).clip(-32768, 32767).astype(np.int16)
    n8 = np.round(nrm * 127).clip(-127, 127).astype(np.int8)
    uvh = uv.astype(np.float16)
    w8 = np.round(bw * 255).clip(0, 255).astype(np.uint8)
    # веса в сумме ровно 255
    w8[:, 0] += (255 - w8.astype(np.int32).sum(axis=1)).clip(-255, 255).astype(np.uint8)
    rec = np.zeros(nv, dtype=[('p', '<i2', 4), ('n', 'i1', 4), ('t', '<f2', 2), ('b', 'u1', 4), ('w', 'u1', 4)])
    rec['p'][:, :3] = q
    rec['n'][:, :3] = n8
    rec['t'] = uvh
    rec['b'] = bi.clip(0, 255).astype(np.uint8)
    rec['w'] = w8
    vb = BLOB.add(rec.tobytes())
    big = nv > 65535
    ib = BLOB.add(idx.astype('<u4' if big else '<u2').tobytes())
    m = {
        'bones': [[b[0], b[1]] + [r5(x) for x in b[2]] + [r5(x) for x in b[3]] for b in bones],
        'inv': [[r5(x) for x in b[4]] for b in bones],
        'tex': tex, 'groups': groups, 'nv': nv, 'ni': int(len(idx)), 'i32': big,
        'lo': [r5(x) for x in lo], 'span': [r5(x) for x in span], 'vb': vb, 'ib': ib,
        'clips': clips, 'loc': locators,
    }
    if extra:
        m.update(extra)
    return m


def pack_clip(frames, fps, mask, posBones, qframes, pframes):
    """qframes: [(frame)][len(mask)][4]; pframes: [(frame)][len(posBones)][3]."""
    qa = np.round(np.asarray(qframes, np.float32).reshape(-1) * 32767).clip(-32767, 32767).astype('<i2')
    c = {'n': int(frames), 'fps': r5(fps), 'mask': [int(x) for x in mask], 'pb': [int(x) for x in posBones],
         'q': BLOB.add(qa.tobytes())}
    if len(posBones):
        c['p'] = BLOB.add(np.asarray(pframes, '<f4').reshape(-1).tobytes())
    return c


def read_ssm2(path):
    d = open(path, 'rb').read()
    o = [4]

    def f(n):
        v = struct.unpack_from('>%df' % n, d, o[0]); o[0] += 4 * n; return v

    def i():
        v = struct.unpack_from('>i', d, o[0])[0]; o[0] += 4; return v

    def u():
        n = struct.unpack_from('>H', d, o[0])[0]; o[0] += 2; s = d[o[0]:o[0] + n].decode(); o[0] += n; return s

    assert d[:4] == b'SSM2', path
    height, radius = f(2)
    nb = i()
    bones = []
    for _ in range(nb):
        bones.append((u(), i(), f(4), f(3), f(12)))
    tex = [u() for _ in range(i())]
    groups = [list(struct.unpack_from('>3i', d, o[0] + 12 * k)) for k in range(i())]
    o[0] += 12 * len(groups)
    nv = i()
    arr = np.frombuffer(d, dtype=np.dtype([('p', '>f4', 3), ('n', '>f4', 3), ('t', '>f4', 2), ('b', 'u1', 4), ('w', '>f4', 4)]),
                        count=nv, offset=o[0])
    o[0] += arr.itemsize * nv
    ni = i()
    idx = np.frombuffer(d, '>i4', ni, o[0]); o[0] += 4 * ni
    clips = {}
    for _ in range(i()):
        name = u(); fr = i(); fps = f(1)[0]
        pbs = [i() for _ in range(i())]
        qs, ps = [], []
        for _f in range(fr + 1):
            qs.append(np.array(f(nb * 4), np.float32).reshape(nb, 4))
            ps.append(np.array(f(len(pbs) * 3), np.float32).reshape(len(pbs), 3))
        clips[name] = (fr, fps, pbs, qs, ps)
    locs = {}
    for _ in range(i()):
        ln = u(); bone = i(); lq = f(4); lp = f(3)
        locs[ln] = [bone] + [r5(x) for x in lp] + [r5(x) for x in lq]
    return dict(height=height, bones=bones, tex=tex, groups=groups, v=arr, idx=idx, clips=clips, locs=locs)


def export_ssm(name, max_tex=TEX_MAX):
    m = read_ssm2(os.path.join(A, 'ssm', name + '.ssm'))
    texk = [png_texture(t, max_tex) for t in m['tex']]
    nb = len(m['bones'])
    clips = {}
    for cn, (fr, fps, pbs, qs, ps) in m['clips'].items():
        clips[cn] = pack_clip(fr, fps, list(range(nb)), pbs, qs, ps)
    v = m['v']
    return pack_model(name, m['bones'], texk, m['groups'], v['p'], v['n'], v['t'], v['b'], v['w'], m['idx'], clips, m['locs'])


# ---------------------------------------------------------------- Сэм из файлов игры
def export_sam():
    sys.path.insert(0, SS2TD)
    import ctsemeta as C
    import mesh
    import model
    import pack as packmod
    import texture
    texture.BC1_FORMATS.add(81)        # футболка Сэма: BC3 под номером 81 (размер блоков выбирается по объёму данных)
    from build_enemy import load_textures
    from export_mc import clip_unit, inv34, read_mesh_light, smooth_normals
    P = packmod.Pack()
    md = model.load_model(P, SAM_MDL)
    bones = model.load_bones(P, md)
    clips_all = model.load_clips(P, md)
    names = [b.name for b in bones]
    chunks = []
    cache = {}
    for bmf, tmap, _ in md.meshes:
        ss = read_mesh_light(C.read_file(P.read(bmf)), 30000)
        tx = load_textures(P, SAM_MDL, tmap, cache)
        for s in ss:
            if s.name in ('Teeth',):
                continue
            mesh.guess_skin(s)
            img = tx.get(s.name)
            if img is not None:
                mesh.pick_uvs(s, img)
            if s.bone_idx is None or s.bone_w is None:
                print('  без костей:', s.name)
                continue
            gidx = [tuple(names.index(s.bones[k]) if s.bones[k] in names else 0 for k in bi) for bi in s.bone_idx]
            chunks.append([list(s.positions), list(s.uvs), gidx, list(s.bone_w), list(s.tris), img, s.name])
    ys = [p[1] for c in chunks for p in c[0]]
    scale = SAM_HEIGHT / (max(ys) - min(ys))
    print('  Сэм: высота %.2f м -> масштаб %.3f' % (max(ys) - min(ys), scale))
    from build_enemy import scaled_bones
    bones = scaled_bones(bones, scale)
    texk, tids = [], {}
    for c in chunks:
        c[0] = [tuple(x * scale for x in p) for p in c[0]]
        key = id(c[5])
        if key not in tids:
            tids[key] = len(texk)
            texk.append(add_texture('sam/%d_%s' % (len(texk), c[6].lower()),
                                    c[5] if c[5] is not None else Image.new('RGB', (4, 4), (120, 100, 80))))
        c.append(tids[key])
    pos, nrm, uv, bi, bw, idx, groups = [], [], [], [], [], [], []
    for t in range(len(texk)):
        start = len(idx) // 3
        for c in chunks:
            if c[7] != t:
                continue
            base = len(pos)
            n = smooth_normals(c[0], c[4])
            for k in range(len(c[0])):
                w = list(c[3][k]) + [0.0] * (4 - len(c[3][k]))
                b = list(c[2][k]) + [0] * (4 - len(c[2][k]))
                tot = sum(w[:4]) or 1.0
                pos.append(c[0][k]); nrm.append(n[k]); uv.append(c[1][k]); bi.append(b[:4]); bw.append([x / tot for x in w[:4]])
            for tr in c[4]:
                idx += [base + tr[0], base + tr[1], base + tr[2]]
        if len(idx) // 3 > start:
            groups.append([t, start, len(idx) // 3 - start])
    bl = [(b.name, b.parent, b.q, b.p, inv34(b.bind)) for b in bones]
    clips = {}
    for cn in SAM_CLIPS:
        cl = clips_all.get(cn)
        if not cl:
            print('  нет клипа', cn)
            continue
        unit = clip_unit(bones, cl, scale)
        mask = [k for k, b in enumerate(bones) if b.name in cl.rot]
        pbs = [k for k, b in enumerate(bones) if b.name in cl.pos]
        qs, ps = [], []
        for fi in range(cl.nframes + 1):
            qs.append([cl.local(bones[k], fi)[0] for k in mask])
            row = []
            for k in pbs:
                p = cl.local(bones[k], fi)[1]
                row.append([x * scale * unit for x in p])
            ps.append(row)
        clips[cn] = pack_clip(cl.nframes, 1.0 / cl.spf if cl.spf else 30.0, mask, pbs, qs, ps)
    print('  Сэм: %d вершин, %d треугольников, %d костей, %d клипов' % (len(pos), len(idx) // 3, len(bones), len(clips)))
    return pack_model('sam', bl, texk, groups, pos, nrm, uv, bi, bw, idx, clips, {})


TP_MODELS = {'hd_cannon': 'Content/SeriousSamHD/Models/Weapons/Cannon/Cannon_atachment.mdl'}


def export_game_static(path, name):
    """Жёсткая модель из файлов игры (одна кость), начало координат — как в игре."""
    sys.path.insert(0, SS2TD)
    import ctsemeta as C
    import mesh
    import model
    import pack as packmod
    import texture
    texture.BC1_FORMATS.add(81)
    from export_mc import read_mesh_light, safe_texture, smooth_normals
    P = packmod.Pack()
    md = model.load_model(P, path)
    pos, nrm, uv, idx, groups, texk = [], [], [], [], [], []
    for bmf, tmap, _ in md.meshes:
        for s in read_mesh_light(C.read_file(P.read(bmf)), 12000):
            img = safe_texture(P, tmap.get(s.name))
            if img is not None:
                mesh.pick_uvs(s, img)
            texk.append(add_texture('%s/%d' % (name, len(texk)), img if img is not None else Image.new('RGB', (4, 4), (40, 40, 44)), 256))
            base, start = len(pos), len(idx) // 3
            n = smooth_normals(s.positions, s.tris)
            pos += list(s.positions); nrm += n; uv += list(s.uvs)
            for tr in s.tris:
                idx += [base + tr[0], base + tr[1], base + tr[2]]
            groups.append([len(texk) - 1, start, len(idx) // 3 - start])
    nv = len(pos)
    print('  %s: %d вершин' % (name, nv))
    return pack_model(name, [('root', -1, (0, 0, 0, 1), (0, 0, 0), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0])], texk, groups, pos, nrm, uv,
                      [[0, 0, 0, 0]] * nv, [[1, 0, 0, 0]] * nv, idx, {}, {})


# ---------------------------------------------------------------- данные оружия, эффекты, звуки
def load_json(rel):
    p = os.path.join(A, rel)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def emitter(e):
    png_texture('textures/fx/' + e['tex'], 512)
    keep = ('name', 'tex', 'additive', 'cols', 'rows', 'ft', 'rnd', 'rate', 'life', 'speed', 'spin', 'size', 'rot', 'grow',
            'gravity', 'colors', 'alphas', 'intensity')
    o = {k: e[k] for k in keep if k in e}
    o['tex'] = 'textures/fx/' + e['tex']
    return o


SOUNDS = {}


def sound_set(key, folder, name):
    """key -> список вариантов звука (ogg), как их положил экспортёр мода."""
    files = []
    for k in range(1, 9):
        p = os.path.join(A, 'sounds', folder, '%s_%d.ogg' % (name, k))
        if os.path.exists(p):
            files.append(BLOB.add(open(p, 'rb').read()))
    if files:
        SOUNDS[key] = files


def main():
    root = json.load(open(os.path.join(WEAP, 'data', 'serioussamweapons', 'weapons.json'), encoding='utf-8'))
    wj = {w['id']: w for w in root['weapons']}
    models, weapons, fx = {}, [], {}
    for wid in HD:
        w = wj[wid]
        print(wid)
        models[wid] = export_ssm(wid)
        if w.get('item') and wid not in TP_MODELS:
            models[w['item']] = export_ssm(w['item'], 256)
        fl = w.get('flash') if isinstance(w.get('flash'), dict) else None
        if fl:
            models[fl['model']] = export_ssm(fl['model'], 256)
        clips = {}
        for cn, c in w['clips'].items():
            ev = []
            for e in c['events']:
                t = e['type']
                if t in ('CSamSound', 'SPuppetSound'):
                    ev.append([round(e['t'], 4), 'snd', e.get('CSamSound.2', '') or '', ''])
                elif t == 'CSamEffect':
                    ev.append([round(e['t'], 4), 'fx', e.get('CSamEffect.4', '') or '', e.get('CSamEffect.5', '') or ''])
                elif t == 'CRenderMuzzleFlash':
                    ev.append([round(e['t'], 4), 'flash', '', ''])
            clips[cn] = [round(c['len'], 4), ev]
        r = (w.get('params') or {}).get('render') or {}
        weapons.append({'id': wid, 'title': w['title'], 'kind': w['kind'], 'clips': clips,
                        'flash': [fl['model'], fl['locator']] if fl else None, 'item': w.get('item'),
                        'off': r.get('offset', [0.12, -0.2, -0.3]), 'fov': r.get('fov', 49)})
        for sn in w['sounds']:
            slug = ''.join(ch if ch.isalnum() or ch == '_' else '_' for ch in sn.lower()).strip('_')
            sound_set(wid + '.' + slug, wid, slug)
        f = load_json('fx/%s.json' % wid)
        if f:
            fx[wid] = {k: {'loc': v['locator'], 'em': [emitter(e) for e in v['emitters']]} for k, v in f.items()}
    proj = {}
    for pid in PROJ:
        p = root['projectiles'].get(pid, {})
        f = load_json('fx/proj_%s.json' % pid) or {'trail': [], 'boom': []}
        mdl = p.get('model')
        if mdl:
            models[mdl] = export_ssm(mdl, 256)
        prm = p.get('params', {})
        proj[pid] = {'model': mdl, 'speed': prm.get('1', 30), 'life': prm.get('5', 3),
                     'trail': [emitter(e) for e in f['trail']], 'boom': [emitter(e) for e in f['boom']]}
        sound_set('proj_%s.fly' % pid, 'proj_' + pid, 'fly')
        sound_set('proj_%s.hit' % pid, 'proj_' + pid, 'hit')
    hits = {}
    for mat, info in root['impacts'].items():
        if info.get('sounds'):
            sound_set('hit.' + mat, 'hit', mat)
        f = load_json('fx/hit_%s.json' % mat)
        if f:
            hits[mat] = [emitter(e) for e in f.get('boom', [])]
    icons = {wid: png_texture('textures/item/' + wid, 128) for wid in HD}
    print('sam')
    models['sam'] = export_sam()
    # оружие от третьего лица, для которого в игре своя модель (у пушки предмет на земле — модель от первого лица)
    for wid, path in TP_MODELS.items():
        models[wid + '_tp'] = export_game_static(path, wid + '_tp')
        next(w for w in weapons if w['id'] == wid)['item'] = wid + '_tp'
    meta = {'v': 1, 'models': models, 'tex': TEXTURES, 'snd': SOUNDS, 'weapons': weapons, 'fx': fx, 'proj': proj,
            'hits': hits, 'icons': icons}
    js = json.dumps(meta, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    head = b'SAMP' + struct.pack('<I', len(js)) + js
    while len(head) % 4:
        head += b' '
    raw = head + bytes(BLOB.b)
    gz = gzip.compress(raw, 9)
    b64 = base64.b64encode(gz).decode('ascii')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as fo:
        fo.write('// Облик «Серьёзный Сэм»: модели, анимации, текстуры, звуки и эффекты (tools/export_sam.py). Не править руками.\n')
        fo.write('const SAM_DATA_B64 = "%s";\n' % b64)
    print('пакет: %.1f МБ сырых, %.1f МБ gzip, %.1f МБ в js; текстур %d, звуков %d, моделей %d'
          % (len(raw) / 2 ** 20, len(gz) / 2 ** 20, len(b64) / 2 ** 20, len(TEXTURES), len(SOUNDS), len(models)))


if __name__ == '__main__':
    main()
