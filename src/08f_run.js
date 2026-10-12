// ============================================================
//  «Дневной бег»: днём в тайге (после первой ночной встречи) играет трек «RUN RUN»,
//  помехи растут к его концу, а затем на 3 секунды — 3D-лицо с ужасающей улыбкой.
// ============================================================
Object.assign(Ents, {
  runS: null, runCool: 150, runT: 0, runRoll: 0, nightEnc: false,
  updateRunTrigger(dt, night) {
    const p = Player, L = this.mutant;
    this.runCool -= dt;
    const ok = this.nightEnc && night < 0.12 && this.deepOn && !this.inHouse && !this.indoor && !p.eyeInWater && this.runCool <= 0 && this.mutantCool <= 0 && !this.glitchS && !this.dreadS && !this.huntS && !this.hellS && !this.peekS && !L.active && this.omenT <= 0 && this.dayProbe <= 0 && Sfx.runReady();
    if (!ok) { this.runT = 0; return; }
    this.runT += dt; if (this.runT < 12) return;
    this.runRoll -= dt; if (this.runRoll > 0) return;
    this.runRoll = 8;
    if (Math.random() < 0.12) this.startRun();
  },
  startRun() {
    const d = Sfx.run(); if (!d) return false;
    this.runS = { t: 0, dur: d, phase: 0, st: 0 };
    this.mutantBurst = 0.2; Game.flickerPulse = 0.3;
    return true;
  },
  endRun() {
    this.runS = null; this.mutantK = 0; this.pictureOn = false; Portrait.hide();
    this.mutantCool = 150 + Math.random() * 100; this.runCool = (900 + Math.random() * 700) * (this.deepOn ? 0.6 : 1);
  },
  // скример по команде владельца-существа (NumPad 9): 3D-лицо с улыбкой во весь экран и крик, 3 секунды
  scrS: null,
  forceScreamer() {
    if (this.scrS || this.pictureOn) return false;
    this.scrS = { t: 0 }; this.pictureOn = true; this.mutantK = 0;
    Portrait.show('grin'); Sfx.staticBurst(); Game.flickerPulse = 0;
    try { Sfx.scream(); } catch (e) { }
    return true;
  },
  updateScreamer(dt) {
    const S = this.scrS; S.t += dt; Portrait.update(dt);
    if (S.t >= 3) { this.scrS = null; this.pictureOn = false; Portrait.hide(); this.mutantK = 0; }
  },
  updateRun(dt) {
    const S = this.runS; S.t += dt; Portrait.update(dt);
    if (S.phase === 0) {
      const u = clamp(S.t / S.dur, 0, 1);
      // помехи нарастают к концу: сначала редкие всплески, потом сплошные
      this.mutantK = Math.min(0.92, 0.04 + Math.pow(u, 2.2) * 0.9) * (0.8 + 0.2 * Math.random());
      if (u > 0.55 && Math.random() < dt * 2) Game.flickerPulse = 0.15;
      if (S.t >= S.dur) {
        S.phase = 1; S.st = 0; this.pictureOn = true; this.mutantK = 0; Portrait.show('grin');
        Sfx.staticBurst(); Game.flickerPulse = 0; try { Sfx.scream(); } catch (e) { }
      }
      return;
    }
    S.st += dt;
    if (S.st >= 3) this.endRun();
  }
});
