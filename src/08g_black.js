// ============================================================
//  «Чёрный экран»: ночью вне дома (после второй встречи) нарастают помехи и играет «HELP ME HELL»,
//  на 14-й секунде трека экран становится полностью чёрным до самого конца, потом всё прекращается.
// ============================================================
const BlackFx = {
  el: null,
  set(on) {
    if (!this.el) {
      const d = document.createElement('div'); d.id = 'blackFx';
      d.style.cssText = 'position:fixed;inset:0;z-index:8;background:#000;display:none;pointer-events:none';
      document.body.appendChild(d); this.el = d;
    }
    this.el.style.display = on ? 'block' : 'none';
  }
};
Object.assign(Ents, {
  hellS: null, hellCool: 300, hellT: 0, hellRoll: 0, blackOn: false, HELL_BLACK: 14,
  updateHellTrigger(dt, night) {
    const p = Player, L = this.mutant;
    this.hellCool -= dt;
    const ok = this.encounters >= 2 && night >= 0.8 && !this.inHouse && !this.indoor && !p.eyeInWater && this.hellCool <= 0 && this.mutantCool <= 0
      && !this.glitchS && !this.dreadS && !this.huntS && !this.runS && !this.peekS && !L.active && this.omenT <= 0 && Sfx.hellReady();
    if (!ok) { this.hellT = 0; return; }
    this.hellT += dt; if (this.hellT < 15) return;
    this.hellRoll -= dt; if (this.hellRoll > 0) return;
    this.hellRoll = 10;
    if (Math.random() < (this.deepOn ? 0.08 : 0.03)) this.startHell();
  },
  startHell() {
    const h = Sfx.hell(); if (!h) return false;
    this.hellS = { t: 0, t0: h.t0, dur: h.dur };
    this.mutantBurst = 0.15; Game.flickerPulse = 0.2;
    return true;
  },
  endHell() {
    this.hellS = null; this.blackOn = false; BlackFx.set(false); this.mutantK = 0;
    this.mutantCool = 150 + Math.random() * 100; this.hellCool = (900 + Math.random() * 600) * (this.deepOn ? 0.6 : 1);
  },
  updateHell(dt) {
    const S = this.hellS;
    // время ведём по аудиочасам, чтобы чернота точно совпала с 14-й секундой трека
    S.t = Sfx.ctx ? Math.max(0, Sfx.ctx.currentTime - S.t0) : S.t + dt;
    if (S.t < this.HELL_BLACK) {
      const u = S.t / this.HELL_BLACK;
      this.mutantK = Math.min(0.95, 0.05 + Math.pow(u, 1.6) * 0.9) * (0.85 + 0.15 * Math.random());
      if (u > 0.5 && Math.random() < dt * 2.5) Game.flickerPulse = 0.15;
      return;
    }
    if (!this.blackOn) { this.blackOn = true; this.mutantK = 0; this.mutantBurst = 0; Game.flickerPulse = 0; BlackFx.set(true); }
    if (S.t >= S.dur) this.endHell();
  }
});
