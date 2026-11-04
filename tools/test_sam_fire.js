// Проверка: выстрел не должен сжимать и опускать Сэма (src/08m_sam.js, настоящий код SamModel).
//   node tools/test_sam_fire.js
const fs = require('fs'), zlib = require('zlib'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const data = fs.readFileSync(path.join(root, 'src/00c_sam_data.js'), 'latin1');
const buf = zlib.gunzipSync(Buffer.from(/SAM_DATA_B64 = "([^"]+)"/.exec(data)[1], 'base64'));
const jl = buf.readUInt32LE(4), D = JSON.parse(buf.toString('utf8', 8, 8 + jl));
let off = 8 + jl; while (off % 4) off++;
const bytes = new Uint8Array(buf.buffer, buf.byteOffset + off, buf.length - off);
// копия с выравниванием: Int16Array требует чётного смещения от начала буфера
const bin = new Uint8Array(new ArrayBuffer(bytes.length + 8), 8); bin.set(bytes);

const src = fs.readFileSync(path.join(root, 'src/08m_sam.js'), 'utf8');
const code = src.slice(src.indexOf('// ---------- кватернионы'), src.indexOf('// матрица (column-major)'));
const ctx = { clamp: (v, a, b) => Math.min(b, Math.max(a, v)), Math, Float32Array, Int16Array };
vm.runInNewContext(code + '\nthis.SamModel = SamModel;', ctx);
const md = new ctx.SamModel('sam', D.models.sam, bin);

const SAM_BODY = { colt: ['Body_Idle_DualColt', 'Body_Fire_Pistol'], shot1: ['Body_Idle_SingleShotgun', 'Body_Fire_SingleShotgun'], shot2: ['Body_Idle_DoubleShotgun', 'Body_Fire_DoubleShotgun'],
  tommy: ['Body_Idle_Tommygun', 'Body_Fire_AssaultRifle'], mini: ['Body_Idle_Minigun', 'Body_Fire_AssaultRifle'], rocket: ['Body_Idle_RocketLauncher', 'Body_Fire_RocketLauncher'],
  grenade: ['Body_GrenadeLauncherIdle_NotReady', 'Body_Fire_RocketLauncher'], laser: ['Body_Idle_Laser', 'Body_Fire_Laser'], sniper: ['Body_Idle_Sniper', 'Body_Fire_Sniper'], cannon: ['Body_Idle_Cannon', 'Body_Fire_Cannon'] };
const BONES = ['Pelvis', 'Head', 'R_Hand', 'L_Hand', 'L_Foot', 'R_Foot'];
const pose = (legs, idle, fire, t) => {
  md.rest(); md.layer(md.clip(legs), 0.3, true); md.layer(md.clip('Body_Idle'), 0, false); md.layer(md.clip(idle), 0.3, true);
  if (fire) md.layer(md.clip(fire), t, false, 1);
  md.fk();
  return Object.fromEntries(BONES.map(b => [b, md.boneXf(b).p]));
};
let bad = 0, worst = 0;
const rel = Object.values(md.clips).filter(c => c.rel).map(c => c.name);
console.log('относительные клипы:', rel.join(', '));
if (!rel.includes('Body_Fire_Pistol') || rel.includes('Body_Throw_Explosives') || rel.includes('Body_KnifeBackStab')) { console.log('ОШИБКА: неверное определение'); bad++; }
for (const legs of ['Idle', 'Run', 'CrouchIdle']) for (const k in SAM_BODY) {
  const [idle, fire] = SAM_BODY[k], c = md.clip(fire), base = pose(legs, idle);
  for (let t = 0; t <= c.len; t += 1 / 30) {
    const p = pose(legs, idle, fire, t);
    for (const b of BONES) {
      const d = Math.hypot(p[b][0] - base[b][0], p[b][1] - base[b][1], p[b][2] - base[b][2]);
      worst = Math.max(worst, d);
      const lim = (b === 'R_Hand' || b === 'L_Hand') ? 0.5 : b === 'Head' ? 0.25 : 0.001;
      if (d > lim) { bad++; console.log('ОШИБКА', legs, k, b, 't=' + t.toFixed(2), 'сдвиг', d.toFixed(3)); }
    }
  }
}
console.log('наибольший сдвиг кости при выстреле, м:', worst.toFixed(3));
console.log(bad ? 'ПРОВАЛ: ' + bad : 'OK');
process.exit(bad ? 1 : 0);
