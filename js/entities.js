// Сущности: игрок и фабрики объектов мира.
window.RG = window.RG || {};

(function () {
  const C = RG.CONFIG;
  const U = RG.util;

  function Player() {
    this.reset();
  }

  Player.prototype.reset = function () {
    this.lane = 1;
    this.x = C.LANES[1];
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.sliding = false;
    this.slideT = 0;
    this.slideQueued = false;
    this.runPhase = 0;
    this.tilt = 0;
    this.crashT = -1; // >=0 — идёт анимация падения
  };

  Player.prototype.moveLane = function (dir) {
    const n = U.clamp(this.lane + dir, 0, 2);
    if (n === this.lane) return false;
    this.lane = n;
    return true;
  };

  Player.prototype.jump = function () {
    if (!this.onGround) return false;
    this.sliding = false;
    this.slideT = 0;
    this.slideQueued = false;
    this.vy = C.JUMP_V;
    this.onGround = false;
    return true;
  };

  // Вниз: на земле — подкат, в воздухе — быстрое падение с авто-подкатом.
  Player.prototype.dive = function () {
    if (this.onGround) {
      if (this.sliding) return false;
      this.sliding = true;
      this.slideT = C.SLIDE_TIME;
      return true;
    }
    this.vy = Math.min(this.vy, -13);
    this.slideQueued = true;
    return false;
  };

  Player.prototype.hitHeight = function () {
    return this.sliding ? C.PLAYER_H_SLIDE : C.PLAYER_H;
  };

  Player.prototype.crash = function () {
    this.crashT = 0;
  };

  Player.prototype.update = function (dt, game) {
    const target = C.LANES[this.lane];
    this.x = U.lerpExp(this.x, target, 12, dt);
    this.tilt = U.clamp((target - this.x) * 0.22, -0.4, 0.4);

    if (!this.onGround) {
      this.vy -= C.GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
        if (game && game.onLand) game.onLand();
        if (this.slideQueued) {
          this.slideQueued = false;
          this.sliding = true;
          this.slideT = C.SLIDE_TIME;
        }
      }
    }

    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.sliding = false;
    }

    this.runPhase += dt * (6 + (game ? game.speed : C.SPEED_MIN) * 0.5);
    if (this.crashT >= 0) this.crashT += dt;
  };

  // ---- Фабрики объектов ----

  function makeTrain(lane, z, len, colorIdx) {
    return {
      type: 'train', lane: lane, x: C.LANES[lane],
      z: z, len: len, hw: 0.95, y0: 0, y1: 2.35,
      colorIdx: colorIdx, dead: false
    };
  }

  function makeBarrier(lane, z) {
    return {
      type: 'barrier', lane: lane, x: C.LANES[lane],
      z: z, len: 0.4, hw: 0.78, y0: 0, y1: 0.85, dead: false
    };
  }

  function makeGate(lane, z) {
    return {
      type: 'gate', lane: lane, x: C.LANES[lane],
      z: z, len: 0.35, hw: 0.8, y0: 1.0, y1: 1.62, dead: false
    };
  }

  function makeCoin(x, y, z) {
    return {
      x: x, y: y, z: z,
      spin: Math.random() * Math.PI * 2,
      attracted: false, dead: false
    };
  }

  function makePowerup(type, lane, z) {
    return {
      type: type, lane: lane, x: C.LANES[lane],
      z: z, y: 0.85, spin: Math.random() * Math.PI * 2, dead: false
    };
  }

  RG.Player = Player;
  RG.makeTrain = makeTrain;
  RG.makeBarrier = makeBarrier;
  RG.makeGate = makeGate;
  RG.makeCoin = makeCoin;
  RG.makePowerup = makePowerup;
})();
