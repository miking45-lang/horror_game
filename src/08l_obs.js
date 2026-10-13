// ============================================================
//  Сцены существа глазами остальных игроков.
//  Жертва (хозяин мира или игрок в общем мире 666) рассылает начало сцены ('sc'),
//  а у всех остальных — включая владельца-существо — та же сцена проигрывается в мире,
//  на месте жертвы: без камеры, смерти и вспышек экрана, со звуком только поблизости.
//  Каждая копия сцены — отдельный объект поверх Ents (Object.create), поэтому
//  её состояние (killS, mawS, …, huntLock, mutantK) не смешивается с вашим.
// ============================================================
Object.assign(Ents, {
  obs: [],
  obsTg: null,
  // цель сцены: у жертвы — сам игрок, у наблюдателя — неподвижная копия жертвы
  tgt() { return this.obsTg || Player; },
  // звук сцены: у жертвы всегда, у наблюдателя — только рядом
  sfxOk() { const t = this.obsTg; return !t || Math.hypot(t.x - Player.x, t.y - Player.y, t.z - Player.z) < 32; },
  obsStart(v) {
    if (!v || typeof v.u !== 'string' || !['kill', 'maw', 'slash', 'burst'].includes(v.k)) return;
    if (![v.x, v.y, v.z].every(Number.isFinite) || Game.state !== 'play') return;
    if (Math.hypot(v.x - Player.x, v.z - Player.z) > 140) return;            // далеко — не видно и мир там может быть не загружен
    this.obs = this.obs.filter(o => o.u !== v.u);
    if (this.obs.length >= 4) return;
    const c = Object.create(Ents);
    c.obsTg = { x: v.x, y: v.y, z: v.z, yaw: Number.isFinite(v.yaw) ? v.yaw : 0, pitch: 0, vx: 0, vy: 0, vz: 0, dead: false };
    c.killS = c.killL = c.mawS = c.mawL = c.slashS = c.slashL = c.burstS = null;
    c.huntLock = false; c.mutantK = 0; c.mutantBurst = 0;
    try {
      if (v.k === 'kill') c.killInit(+v.sx, +v.sz, clamp(+v.hs || 1, 0.5, 10));
      else if (v.k === 'maw') { c.mawS = { ph: 3, pt: 0, t: 0, roarDur: 0, blood: [], bitten: false, cam: null, camDir: null }; c.mawStart3(); }
      else if (v.k === 'slash') {
        c.slashS = { ph: 1, pt: 0, t: 0, from: [+v.fx || v.x, +v.fz || v.z], hs: clamp(+v.hs || 1, 0.5, 10), side: v.side < 0 ? -1 : 1, blood: [], cut: false, cam: null, camDir: null, fp: { roll: 0, dy: 0 } };
        c.slashStart1();
      } else if (v.k === 'burst') { c.burstInit(v.pv); if (c.sfxOk()) try { Sfx.gore(); } catch (e) { } }
    } catch (e) { return; }
    this.obs.push({ u: v.u, k: v.k, c });
  },
  obsUpdate(dt) {
    for (let i = this.obs.length - 1; i >= 0; i--) {
      const o = this.obs[i], c = o.c;
      try {
        if (o.k === 'kill' && c.killS) c.updateKill(dt);
        else if (o.k === 'maw' && c.mawS) c.updateMaw(dt);
        else if (o.k === 'slash' && c.slashS) c.updateSlash(dt);
        else if (o.k === 'burst' && c.burstS) c.updateBurst(dt);
      } catch (e) { c[o.k + 'S'] = null; }
      if (!c[o.k + 'S']) this.obs.splice(i, 1);
    }
  },
  obsDraw(batch, cam) {
    for (const o of this.obs) {
      const c = o.c;
      if (o.k === 'kill' && c.killS) {
        if (c.killS.ph === 0) { const t = c.obsTg; Net.drawAv(batch, cam, { cx: t.x, cy: t.y, cz: t.z, cya: t.yaw, pi: t.pitch || 0, s: 0, walk: 0, wph: 0, m: '', o: 0, _st: c.obsSt || (c.obsSt = {}) }); }   // пока существо бежит — жертва стоит и оборачивается
        c.drawKill(batch, cam);
      }
      else if (o.k === 'maw' && c.mawS) c.drawMaw(batch, cam);
      else if (o.k === 'slash' && c.slashS) c.drawSlash(batch, cam);
      else if (o.k === 'burst' && c.burstS) c.drawBurst(batch, cam);
    }
  },
  // существо из чужой сцены (рисуется вместо существа-владельца, пока идёт сцена)
  obsCreature() {
    for (const o of this.obs) { const c = o.c, L = c.killL || c.mawL || c.slashL; if (L) return L; }
    return null;
  },
  // жертва в сцене — её обычная модель не рисуется
  obsHides(u) { for (const o of this.obs) if (o.u === u) return true; return false; }
});
