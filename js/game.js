// Ядро игры: состояние, спавн, столкновения, эффекты. Никакого DOM — только логика.
window.RG = window.RG || {};

(function () {
  const C = RG.CONFIG;
  const U = RG.util;

  const POWERUP_TYPES = ['magnet', 'shield', 'x2'];
  const TRAIN_LEN = [6, 8, 10, 13];

  function Game(audio) {
    this.audio = audio || null;
    this.hooks = {};
    this.state = 'menu'; // menu | playing | crashing | over | paused
    this.best = U.storage.get(C.STORAGE_KEY_BEST, 0) | 0;
    this.player = new RG.Player();
    this.time = 0;
    this.resetWorld();
  }

  Game.prototype.resetWorld = function () {
    this.distance = 0;
    this.speed = C.SPEED_MIN;
    this.score = 0;
    this.coins = 0;
    this.obstacles = [];
    this.coinList = [];
    this.powerupList = [];
    this.particles = [];
    this.floats = [];
    this.effects = { magnet: 0, shield: false, x2: 0, invuln: 0 };
    this.lastRow = 0;
    this.busyUntil = [0, 0, 0];
    this.crashFlash = 0;
    this.overT = 0;
    this.camera = { x: 0, shakeX: 0, shakeY: 0, shake: 0, fovMul: 1 };
  };

  Game.prototype.start = function () {
    this.resetWorld();
    this.player.reset();
    this.state = 'playing';
    this.time = 0;
    // Немного препятствий заранее, чтобы не было пустой разгонной полосы.
    const seedZ = [32, 44, 56, 68];
    for (let i = 0; i < seedZ.length; i++) this.spawnRowAt(seedZ[i], i * 0.06);
    this.lastRow = 0;
  };

  Game.prototype.toMenu = function () {
    this.resetWorld();
    this.player.reset();
    this.state = 'menu';
  };

  Game.prototype.pause = function () { if (this.state === 'playing') this.state = 'paused'; };
  Game.prototype.resume = function () { if (this.state === 'paused') this.state = 'playing'; };

  Game.prototype.difficulty = function () {
    return U.clamp01(this.distance / C.SPEED_RAMP);
  };

  Game.prototype.stats = function () {
    return {
      score: Math.floor(this.score),
      coins: this.coins,
      distance: Math.floor(this.distance),
      best: this.best
    };
  };

  // ---------- Обновление ----------

  Game.prototype.update = function (dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;

    if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'crashing') this.updateCrash(dt);
    else if (this.state === 'menu') this.updateMenu(dt);
    else if (this.state === 'over') this.updateOver(dt);

    // Общее для всех состояний: тряска и «дыхание» FOV.
    const cam = this.camera;
    cam.shake = Math.max(0, cam.shake - dt * 26);
    if (cam.shake > 0.2) {
      cam.shakeX = (Math.random() * 2 - 1) * cam.shake;
      cam.shakeY = (Math.random() * 2 - 1) * cam.shake * 0.7;
    } else {
      cam.shakeX = 0; cam.shakeY = 0;
    }
    const fast = U.clamp01((this.speed - C.SPEED_MIN) / (C.SPEED_MAX - C.SPEED_MIN));
    const fovTarget = 1 + 0.055 * fast + (this.effects.x2 > 0 ? 0.012 : 0);
    cam.fovMul = U.lerpExp(cam.fovMul, fovTarget, 3, dt);
  };

  Game.prototype.updateMenu = function (dt) {
    this.speed = 9;
    this.distance += this.speed * dt;
    this.player.update(dt, this);
    this.updateParticles(dt);
    this.camera.x = U.lerpExp(this.camera.x, this.player.x * 0.55, 5, dt);
  };

  Game.prototype.updatePlaying = function (dt) {
    const p = this.player;

    this.distance += this.speed * dt;
    const sm = U.smoothstep(this.difficulty());
    this.speed = U.lerp(C.SPEED_MIN, C.SPEED_MAX, sm);

    const mul = this.effects.x2 > 0 ? 2 : 1;
    this.score += this.speed * dt * mul;

    p.update(dt, this);

    for (const k of ['magnet', 'x2', 'invuln']) {
      if (this.effects[k] > 0) this.effects[k] = Math.max(0, this.effects[k] - dt);
    }

    this.scrollWorld(dt);
    this.spawner();
    this.collide();
    this.pickups(dt);
    this.updateParticles(dt);

    this.camera.x = U.lerpExp(this.camera.x, p.x * 0.55, 5, dt);
    this.crashFlash = Math.max(0, this.crashFlash - dt * 1.6);
  };

  Game.prototype.updateCrash = function (dt) {
    const ts = 0.25; // замедление времени
    this.scrollWorld(dt * ts);
    this.updateParticles(dt);
    this.crashFlash = Math.max(0, this.crashFlash - dt * 1.2);
    this.overT -= dt;
    if (this.overT <= 0) this.finish();
  };

  Game.prototype.updateOver = function (dt) {
    this.updateParticles(dt);
  };

  Game.prototype.scrollWorld = function (dt) {
    const sp = this.speed * dt;

    for (const o of this.obstacles) o.z -= sp;
    for (const c of this.coinList) {
      if (!c.attracted) { c.z -= sp; c.spin += dt * 6; }
    }
    for (const s of this.powerupList) { s.z -= sp; s.spin += dt * 4; }

    this.obstacles = this.obstacles.filter(o => !o.dead && o.z + o.len > 2.0);
    this.coinList = this.coinList.filter(c => !c.dead && (c.attracted || c.z > 0.8));
    this.powerupList = this.powerupList.filter(s => !s.dead && s.z > 0.8);
  };

  // ---------- Спавн ----------

  Game.prototype.spawner = function () {
    const d = this.difficulty();
    const gapTime = U.lerp(C.GAP_TIME_MAX, C.GAP_TIME_MIN, d);
    const gapDist = Math.max(10, this.speed * gapTime);
    if (this.distance - this.lastRow >= gapDist) {
      this.lastRow = this.distance;
      this.spawnRowAt(C.SPAWN_Z + U.rand(-2, 2), d);
    }
  };

  Game.prototype.spawnRowAt = function (zs, d) {
    const busy = [0, 1, 2].filter(i => this.busyUntil[i] > zs - 2.5);
    const free = [0, 1, 2].filter(i => busy.indexOf(i) === -1);
    if (free.length === 0) {
      this.spawnCoinLine(U.pick([0, 1, 2]), zs + 1, 'line');
      return;
    }

    let type = U.weightedPick({
      train: 0.9 + 1.2 * d,
      barrier: 1.05,
      gate: 0.95,
      mixed: free.length >= 2 ? 0.45 + 0.45 * d : 0,
      coin: 0.8
    });
    if (free.length === 1) {
      type = U.chance(0.5) ? U.pick(['barrier', 'gate']) : 'coin';
      if (type === 'train') type = 'barrier';
    }

    const used = []; // полосы, занятые «серьёзно» (поезда) — туда не кладём монеты/бонусы

    if (type === 'train') {
      const maxTrains = free.length - 1; // минимум одна полоса должна остаться свободной
      if (maxTrains <= 0) {
        this.spawnCoinLine(U.pick(free), zs + 1, 'line');
        return;
      }
      let count = 1;
      if (maxTrains >= 2 && U.chance(0.2 + 0.4 * d)) count = 2;
      const lanes = U.shuffle(free.slice()).slice(0, count);
      for (const lane of lanes) {
        const lenIdx = Math.min(TRAIN_LEN.length - 1, U.randInt(0, d < 0.35 ? 1 : (d < 0.65 ? 2 : 3)));
        const len = TRAIN_LEN[lenIdx];
        this.obstacles.push(RG.makeTrain(lane, zs, len, U.randInt(0, 3)));
        this.busyUntil[lane] = zs + len + 0.6;
        used.push(lane);
      }
      const rest = free.filter(l => used.indexOf(l) === -1);
      if (rest.length) this.spawnCoinLine(U.pick(rest), zs + 1, 'line');
    } else if (type === 'barrier' || type === 'gate') {
      let lanes = U.shuffle(free.slice());
      let count = 1;
      if (free.length >= 2 && U.chance(0.25 + 0.3 * d)) count = 2;
      count = Math.min(count, free.length);
      lanes = lanes.slice(0, count);
      for (const lane of lanes) {
        let t = type;
        if (count > 1 && U.chance(0.35)) t = U.pick(['barrier', 'gate']);
        if (t === 'barrier') {
          this.obstacles.push(RG.makeBarrier(lane, zs));
          if (U.chance(0.55)) this.spawnCoinArc(lane, zs, 5);
        } else {
          this.obstacles.push(RG.makeGate(lane, zs));
          if (U.chance(0.55)) this.spawnCoinLine(lane, zs - 1.6, 'low', 5);
        }
        used.push(lane);
      }
      const rest = free.filter(l => used.indexOf(l) === -1);
      if (rest.length && U.chance(0.6)) this.spawnCoinLine(U.pick(rest), zs + 0.5, 'line');
    } else if (type === 'mixed') {
      const lanes = U.shuffle(free.slice()).slice(0, 2);
      this.obstacles.push(RG.makeBarrier(lanes[0], zs));
      this.obstacles.push(RG.makeGate(lanes[1], zs));
      this.spawnCoinArc(lanes[0], zs, 5);
      used.push(lanes[0], lanes[1]);
    } else {
      const lane = U.pick(free);
      if (U.chance(0.45)) this.spawnCoinArc(lane, zs, 7);
      else this.spawnCoinLine(lane, zs, 'line');
    }

    // Бонус — редко и только в свободных полосах.
    const bonusLanes = free.filter(l => used.indexOf(l) === -1);
    if (bonusLanes.length && this.powerupList.length < 2 && U.chance(0.07)) {
      this.spawnPowerup(U.pick(POWERUP_TYPES), U.pick(bonusLanes), zs + 2.5);
    }
  };

  Game.prototype.spawnCoinLine = function (lane, z0, kind, count) {
    count = count || U.randInt(5, 8);
    const step = 1.0;
    for (let i = 0; i < count; i++) {
      const y = kind === 'low' ? 0.38 : 0.42;
      this.coinList.push(RG.makeCoin(C.LANES[lane], y, z0 + i * step));
    }
  };

  Game.prototype.spawnCoinArc = function (lane, centerZ, count) {
    const step = 1.0;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const z = centerZ + (i - (count - 1) / 2) * step;
      const y = 0.42 + Math.sin(Math.PI * t) * 1.05;
      this.coinList.push(RG.makeCoin(C.LANES[lane], y, z));
    }
  };

  Game.prototype.spawnPowerup = function (type, lane, z) {
    this.powerupList.push(RG.makePowerup(type, lane, z));
  };

  // ---------- Столкновения ----------

  Game.prototype.collide = function () {
    const p = this.player;
    const phw = C.PLAYER_HW - 0.05;
    const py0 = p.y;
    const py1 = p.y + p.hitHeight();
    const pz0 = C.PLAYER_Z - 0.38;
    const pz1 = C.PLAYER_Z + 0.38;

    for (const o of this.obstacles) {
      if (o.dead) continue;
      if (o.z > pz1 || o.z + o.len < pz0) continue;
      if (Math.abs(p.x - o.x) > phw + o.hw - 0.08) continue;
      if (py0 >= o.y1 - 0.06 || py1 <= o.y0 + 0.06) continue;
      this.hitObstacle(o);
      if (this.state !== 'playing') break;
    }
  };

  Game.prototype.hitObstacle = function (o) {
    if (this.effects.invuln > 0) return;

    if (this.effects.shield) {
      this.effects.shield = false;
      this.effects.invuln = 1.4;
      o.dead = true;
      this.camera.shake = 14;
      this.burst(o.x, 1.2, Math.max(o.z, 3), '#7fd7ff', 22, 3);
      this.addFloat(o.x, 1.7, Math.max(o.z, 4), 'ЩИТ!', '#7fd7ff');
      if (this.audio) this.audio.play('shield');
      return;
    }

    if (this.audio) this.audio.play('crash');
    this.camera.shake = 26;
    this.crashFlash = 1;
    this.burst(o.x, Math.min(1.5, o.y1 * 0.7), Math.max(o.z, 3), '#ffd75e', 30, 3.4);
    this.player.crash();
    this.state = 'crashing';
    this.overT = 1.05;
  };

  // ---------- Сбор предметов ----------

  Game.prototype.pickups = function (dt) {
    const p = this.player;

    for (const s of this.powerupList) {
      if (s.dead) continue;
      if (Math.abs(s.z - C.PLAYER_Z) < 0.9 && Math.abs(s.x - p.x) < 0.8 && p.y < 1.7) {
        this.applyPowerup(s);
      }
    }

    const magnetOn = this.effects.magnet > 0;
    for (const c of this.coinList) {
      if (c.dead) continue;

      if (magnetOn && !c.attracted && c.z < C.PLAYER_Z + 16 && c.z > C.PLAYER_Z - 2 &&
          Math.abs(c.x - p.x) < C.MAGNET_RADIUS) {
        c.attracted = true;
      }

      if (c.attracted) {
        const k = Math.min(1, dt * 9 + 0.03);
        c.x += (p.x - c.x) * k;
        c.y += (p.y + 0.65 - c.y) * k;
        c.z += (C.PLAYER_Z - c.z) * k;
        if (Math.abs(c.z - C.PLAYER_Z) < 0.4 && Math.abs(c.x - p.x) < 0.4) this.collectCoin(c);
        continue;
      }

      if (Math.abs(c.z - C.PLAYER_Z) < 0.75 && Math.abs(c.x - p.x) < 0.55) {
        const dy = c.y - (p.y + 0.55);
        if (dy < 0.75 && dy > -0.75) this.collectCoin(c);
      }
    }
  };

  Game.prototype.collectCoin = function (c) {
    c.dead = true;
    this.coins++;
    this.score += C.COIN_VALUE * (this.effects.x2 > 0 ? 2 : 1);
    this.burst(c.x, c.y, c.z, '#ffd75e', 4, 1.6);
    if (this.audio) this.audio.play('coin');
  };

  Game.prototype.applyPowerup = function (s) {
    s.dead = true;
    const label = { magnet: 'МАГНИТ!', shield: 'ЩИТ!', x2: '×2 ОЧКИ!' }[s.type];
    const color = { magnet: '#ff5fa2', shield: '#7fd7ff', x2: '#ffd75e' }[s.type];

    if (s.type === 'magnet') this.effects.magnet = C.MAGNET_TIME;
    else if (s.type === 'shield') this.effects.shield = true;
    else if (s.type === 'x2') this.effects.x2 = C.X2_TIME;

    this.addFloat(s.x, 1.6, Math.max(s.z, 4), label, color);
    this.burst(s.x, s.y, Math.max(s.z, 4), color, 16, 2.6);
    if (this.audio) this.audio.play('power');
  };

  // ---------- Эффекты ----------

  Game.prototype.onLand = function () {
    this.camera.shake = Math.max(this.camera.shake, 3);
    this.dust(this.player.x, C.PLAYER_Z, 5);
    if (this.audio) this.audio.play('land');
  };

  Game.prototype.burst = function (x, y, z, color, n, spread) {
    spread = spread || 2.4;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x, y: y, z: z,
        vx: U.rand(-spread, spread),
        vy: U.rand(0.5, 4),
        vz: U.rand(-spread, spread),
        grav: 9,
        life: U.rand(0.3, 0.7),
        maxLife: 0.7,
        size: U.rand(0.05, 0.13),
        color: color
      });
    }
  };

  Game.prototype.dust = function (x, z, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + U.rand(-0.3, 0.3), y: U.rand(0, 0.15), z: z + U.rand(-0.2, 0.2),
        vx: U.rand(-1.6, 1.6), vy: U.rand(0.4, 1.8), vz: U.rand(-1.6, 1.6),
        grav: 4,
        life: U.rand(0.25, 0.5),
        maxLife: 0.5,
        size: U.rand(0.06, 0.14),
        color: '#9a91a8'
      });
    }
  };

  Game.prototype.addFloat = function (x, y, z, text, color) {
    this.floats.push({
      x: x, y: y, z: z, text: text, color: color || '#ffffff',
      life: 1.1, maxLife: 1.1, vy: 1.3
    });
  };

  Game.prototype.updateParticles = function (dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.grav) p.vy -= p.grav * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.35; }
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const f of this.floats) {
      f.life -= dt;
      f.y += f.vy * dt;
    }
    this.floats = this.floats.filter(f => f.life > 0);
  };

  // ---------- Финал ----------

  Game.prototype.finish = function () {
    const stats = this.stats();
    stats.isRecord = stats.score > this.best;
    if (stats.isRecord) {
      this.best = stats.score;
      U.storage.set(C.STORAGE_KEY_BEST, this.best);
    }
    stats.best = this.best;
    this.state = 'over';
    if (this.audio) this.audio.play('over');
    if (this.hooks.onGameOver) this.hooks.onGameOver(stats);
  };

  RG.Game = Game;
})();
