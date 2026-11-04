"""Мобы Serious Sam для яиц призыва: собирает модели, анимации, текстуры и звуки в src/00d_samob_data.js.

    python tools/export_samobs.py [--only=id,id] [--tex=256]

Источник: ресурсы, которые export_mc.py уже сделал для мода serious-sam-forge из установленной игры
(assets/serioussam/ssm/*.ssm, textures, sounds, data/serioussam/roster.json). Файлы игры в репозиторий не кладутся —
только собранный пакет. Формат пакета тот же, что у export_sam.py ("SAMP" | JSON | двоичные блоки).
"""
import base64
import gzip
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_sam as X

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.environ.get('SSM_RES', r'C:\Users\PC\serious-sam-forge\src\generated\resources')
A = os.path.join(RES, 'assets', 'serioussam')
OUT = os.path.join(ROOT, 'src', '00d_samob_data.js')
# роли клипов, которые нужны игре (шаги, повороты и прочие узкие клипы не берём)
ROLES = ('idle', 'run', 'walk', 'charge', 'attack', 'melee', 'wound', 'death', 'spawn')
SND = ('idle', 'sight', 'attack', 'melee', 'wound', 'death', 'explode', 'gib', 'hit')
SND_VARIANTS = 2
# поля roster.json, которыми пользуется поведение
KEEP = ('id', 'title', 'archetype', 'speed', 'height', 'radius', 'shot', 'cooldown', 'burst', 'rest', 'range', 'reach', 'damage',
        'muzzle_pos', 'fire_time', 'melee_hit_time', 'death_time', 'leap', 'charge', 'charge_speed', 'boss', 'health', 'egg', 'gun_list')
STEP_ROLES = ('run', 'walk', 'charge')
# облик владельца Уг-Зан: роли сверх обычных, звуки, текстуры покрупнее, ходьба вбок и назад из файлов игры
UGH = 'ss3_ughzan'
UGH_ROLES = ('raise_l', 'raise_r', 'anger')
UGH_SND = ('anger', 'snarl', 'prepare', 'unprepare', 'shockwave', 'music1')
UGH_GAME_CLIPS = {'walk_back': 'Walk_Back', 'walk_left': 'Walk_Left', 'walk_right': 'Walk_Right'}
UGH_MDL = 'Content/SeriousSam3/Models/Enemies/Boss_Ughzan/Boss_Ughzan.mdl'


def read_ssm1(path):
    d = open(path, 'rb').read(); o = [4]
    if d[:4] != b'SSM1':
        raise ValueError(path)

    def f(n):
        v = struct.unpack_from('>%df' % n, d, o[0]); o[0] += 4 * n; return v

    def i():
        v = struct.unpack_from('>i', d, o[0])[0]; o[0] += 4; return v

    def u():
        n = struct.unpack_from('>H', d, o[0])[0]; o[0] += 2; s = d[o[0]:o[0] + n].decode(); o[0] += n; return s
    height, radius = f(2)
    nb = i()
    bones = [(u(), i(), f(4), f(3), f(12)) for _ in range(nb)]
    tex = [u() for _ in range(i())]
    groups = [list(struct.unpack_from('>3i', d, o[0] + 12 * k)) for k in range(i())]
    o[0] += 12 * len(groups)
    nv = i()
    arr = np.frombuffer(d, dtype=np.dtype([('p', '>f4', 3), ('n', '>f4', 3), ('t', '>f4', 2), ('b', 'u1', 4), ('w', '>f4', 4)]), count=nv, offset=o[0])
    o[0] += arr.itemsize * nv
    ni = i()
    idx = np.frombuffer(d, '>i4', ni, o[0]).copy(); o[0] += 4 * ni
    roots = [i() for _ in range(i())]
    clips = {}
    for _ in range(i()):
        role, name = u(), u()
        frames = i(); fps, natural, hit = f(3)
        nm = i(); mask = [i() for _ in range(nm)]
        n = frames + 1
        q = np.frombuffer(d, '>f4', n * (nb * 4 + len(roots) * 3), o[0]).reshape(n, nb * 4 + len(roots) * 3).astype(np.float32)
        o[0] += 4 * q.size
        clips[role] = dict(name=name, frames=frames, fps=fps, natural=natural, hit=hit, mask=mask or list(range(nb)),
                           q=q[:, :nb * 4].reshape(n, nb, 4), p=q[:, nb * 4:].reshape(n, len(roots), 3))
    return dict(height=height, radius=radius, bones=bones, tex=tex, groups=groups, v=arr, idx=idx, roots=roots, clips=clips)


def tex_path(t):
    t = t.split(':')[-1]
    for c in (t, t + '.png', 'textures/' + t, 'textures/' + t + '.png'):
        p = os.path.join(A, c.replace('/', os.sep))
        if os.path.isfile(p):
            return p
    return None


def texture(t, max_dim):
    key = 'mob/' + t.split(':')[-1].replace('.png', '')
    if key in X.TEXTURES:
        return key
    p = tex_path(t)
    img = Image.open(p) if p else Image.new('RGBA', (4, 4), (90, 90, 90, 255))
    if not p:
        print('  нет текстуры', t)
    return X.add_texture(key, img, max_dim)


def is_wanted(role):
    return any(role == r or role.startswith(r + '_') or (role.startswith(r) and role[len(r):].isdigit()) for r in ROLES)


def model(name, max_tex, keep_clips=True):
    m = read_ssm1(os.path.join(A, 'ssm', name + '.ssm'))
    if len(m['bones']) > 81:
        raise ValueError('%s: %d костей, шейдер рассчитан на 81' % (name, len(m['bones'])))
    texk = [texture(t, max_tex) for t in m['tex']]
    clips = {}
    if keep_clips:
        for role, c in m['clips'].items():
            if not is_wanted(role) and not (name == UGH and role in UGH_ROLES):
                continue
            mask = sorted(c['mask'])
            qs = c['q'][:, mask, :]
            pc = X.pack_clip(c['frames'], c['fps'], mask, m['roots'], qs, c['p'])
            pc['hit'] = X.r5(c['hit'])
            clips[role] = pc
        if name == UGH:
            clips.update(ugh_game_clips(m))
    v = m['v']
    return X.pack_model(name, m['bones'], texk, m['groups'], v['p'], v['n'], v['t'], v['b'], v['w'], m['idx'], clips, {})


def ugh_game_clips(m):
    """Walk_Left, Walk_Right, Walk_Back: в экспорте мода их нет, берём из модели игры (пакеты редактора 70_* пропускаем: там текстовый формат)."""
    sys.path.insert(0, X.SS2TD)
    import glob
    import pack as packmod
    import model as gm
    from export_mc import clip_unit
    og = glob.glob
    packmod.glob.glob = lambda x, **k: [f for f in og(x, **k) if not os.path.basename(f).startswith('70_')]
    try:
        P = packmod.Pack()
    finally:
        packmod.glob.glob = og
    md = gm.load_model(P, UGH_MDL)
    bones = gm.load_bones(P, md)
    cl = gm.load_clips(P, md)
    names = [b[0] for b in m['bones']]
    scale = m['bones'][0][3][1] / bones[0].p[1]
    out = {}
    for role, cn in UGH_GAME_CLIPS.items():
        c = cl[cn]
        unit = clip_unit(bones, c, scale)
        byname = {b.name: b for b in bones}
        mask = [i for i, n in enumerate(names) if n in c.rot and n in byname]
        pbs = [i for i, n in enumerate(names) if n in c.pos and n in byname]
        qs, ps = [], []
        for f in range(c.nframes + 1):
            qs.append([c.local(byname[names[i]], f)[0] for i in mask])
            ps.append([[x * scale * unit for x in c.local(byname[names[i]], f)[1]] for i in pbs])
        out[role] = X.pack_clip(c.nframes, 1.0 / c.spf if c.spf else 30.0, mask, pbs, qs, ps)
    print('  ходьба из игры: масштаб %.3f, клипы %s' % (scale, ' '.join(out)))
    return out


def sounds(mid):
    folder = os.path.join(A, 'sounds', mid)
    if not os.path.isdir(folder):
        return
    files = os.listdir(folder)
    for role in SND + (UGH_SND if mid == UGH else ()):
        got = sorted(n for n in files if n == role + '.ogg' or (n.startswith(role + '_') and n.endswith('.ogg')))[:SND_VARIANTS]
        if got:
            X.SOUNDS['mob.%s.%s' % (mid, role)] = [X.BLOB.add(open(os.path.join(folder, n), 'rb').read()) for n in got]


def main():
    only = next((a[7:].split(',') for a in sys.argv[1:] if a.startswith('--only=')), None)
    tex = int(next((a[6:] for a in sys.argv[1:] if a.startswith('--tex=')), 256))
    roster = json.load(open(os.path.join(RES, 'data', 'serioussam', 'roster.json'), encoding='utf-8'))['enemies']
    if only:
        roster = [r for r in roster if r['id'] in only]
    surface = json.load(open(os.path.join(RES, 'data', 'serioussam', 'roster.json'), encoding='utf-8'))['surface_steps']
    # шаги по поверхностям: steps.<семейство>.<материал>.<имя>
    for fam, mats in surface.items():
        for mat, names in mats.items():
            for nm in names:
                folder = os.path.join(A, 'sounds', 'steps', fam, mat)
                got = sorted(n for n in os.listdir(folder) if n == nm + '.ogg' or (n.startswith(nm + '_') and n.endswith('.ogg')))[:3]
                if got:
                    X.SOUNDS['steps.%s.%s.%s' % (fam, mat, nm)] = [X.BLOB.add(open(os.path.join(folder, n), 'rb').read()) for n in got]
    models, listed = {}, []
    for r in roster:
        mid = r['id']
        start = len(X.BLOB.b)
        models['mob_' + mid] = model(mid, 512 if mid == UGH else tex)
        for g in r.get('gun_list') or []:           # у пушек босса свои снаряды
            sk = g.get('skin')
            if sk and 'mobp_' + sk not in models and os.path.exists(os.path.join(A, 'ssm', 'proj_%s.ssm' % sk)):
                models['mobp_' + sk] = model('proj_' + sk, 128, False)
        if os.path.exists(os.path.join(A, 'ssm', 'proj_%s.ssm' % mid)):
            models['mobp_' + mid] = model('proj_' + mid, 128, False)
        sounds(mid)
        e = {k: r[k] for k in KEEP if k in r}
        e['roles'] = sorted(models['mob_' + mid]['clips'])
        e['proj'] = ('mobp_' + mid) in models
        st = r.get('steps')
        if st:
            e['steps'] = {'family': st['family'], 'clips': {k: v for k, v in st.get('clips', {}).items() if k in STEP_ROLES}}
            folder = os.path.join(A, 'sounds', mid)
            for role in st.get('sounds', {}):       # свой звук шага моба (топот хнума, биомеханоида...)
                got = sorted(n for n in os.listdir(folder) if n == role + '.ogg' or (n.startswith(role + '_') and n.endswith('.ogg')))[:3]
                if got:
                    X.SOUNDS['mob.%s.%s' % (mid, role)] = [X.BLOB.add(open(os.path.join(folder, n), 'rb').read()) for n in got]
        listed.append(e)
        print('%-22s %5d КБ, вершин %6d, костей %2d, клипы: %s' % (mid, (len(X.BLOB.b) - start) // 1024, models['mob_' + mid]['nv'], len(models['mob_' + mid]['bones']), ' '.join(e['roles'])))
    meta = {'v': 1, 'models': models, 'tex': X.TEXTURES, 'snd': X.SOUNDS}
    js = json.dumps(meta, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    head = b'SAMP' + struct.pack('<I', len(js)) + js
    while len(head) % 4:
        head += b' '
    gz = gzip.compress(head + bytes(X.BLOB.b), 9)
    b64 = base64.b64encode(gz).decode('ascii')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Мобы Serious Sam для яиц призыва (tools/export_samobs.py). Не править руками.\n')
        f.write('const SAMOB_LIST = ' + json.dumps(listed, separators=(',', ':'), ensure_ascii=False) + ';\n')
        f.write('const SAMOB_SURFACE = ' + json.dumps(surface, separators=(',', ':'), ensure_ascii=False) + ';\n')
        f.write('const SAMOB_DATA_B64 = "' + b64 + '";\n')
    print('мобов %d, пакет %d МБ (сырой %d МБ, JSON %d КБ) -> %s' % (len(listed), len(b64) // 1048576, (len(head) + len(X.BLOB.b)) // 1048576, len(js) // 1024, OUT))


if __name__ == '__main__':
    main()
