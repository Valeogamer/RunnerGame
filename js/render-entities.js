// Отрисовка объектов: поезда, барьеры, ворота, монеты, бонусы, игрок, эффекты.
window.RG = window.RG || {};

(function () {
  const C = RG.CONFIG;
  const U = RG.util;
  const P = RG.Renderer.palette;
  const FOG = P.FOG;
  const rr = P.rr;

  const hexCache = {};
  function hexToRgb(hex) {
    if (!hexCache[hex]) {
      const n = parseInt(hex.slice(1), 16);
      hexCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return hexCache[hex];
  }

  // ---------- Препятствия ----------

  RG.Renderer.prototype.drawObstacle = function (o) {
    const a = U.clamp01((o.z + o.len - 1.6) / 2.4);
    if (a <= 0) return;
    const ctx = this.ctx;
    ctx.globalAlpha = a;
    if (o.type === 'train') this.drawTrain(o);
    else if (o.type === 'barrier') this.drawBarrier(o);
    else this.drawGate(o);
    ctx.globalAlpha = 1;
  };

  RG.Renderer.prototype.drawTrain = function (o) {
    const ctx = this.ctx;
    const cols = P.TRAIN_COLORS[o.colorIdx % P.TRAIN_COLORS.length];
    const F = this.faces(o.x, 0, 2.35, o.z, o.z + o.len, 0.95);
    if (!F) return;
    const f = this.fog((F.z0 + F.z1) / 2);
    const near = [F.nA, F.nB, F.nC, F.nD];

    if (F.top) this.quad([F.fA, F.fB, F.nB, F.nA], U.rgb(U.mix(cols.top, FOG, f)));
    if (F.left) this.quad([F.nA, F.nD, F.fD, F.fA], U.rgb(U.mix(cols.side, FOG, f)));
    else if (F.right) this.quad([F.nB, F.nC, F.fC, F.fB], U.rgb(U.mix(cols.side, FOG, f)));
    this.quad(near, U.rgb(U.mix(cols.front, FOG, f)));

    // Полоса окон на борту
    const winCol = U.rgb(U.mix(P.WIN_DARK, FOG, f), 0.92);
    if (F.left) this.band(F.nA, F.fA, F.fD, F.nD, 0.06, 0.94, 0.3, 0.64, winCol);
    else if (F.right) this.band(F.nB, F.fB, F.fC, F.nC, 0.06, 0.94, 0.3, 0.64, winCol);

    // Детали передней части
    if (F.nA.s > 3) {
      this.band(F.nA, F.nB, F.nC, F.nD, 0.12, 0.88, 0.1, 0.42, winCol);
      this.band(F.nA, F.nB, F.nC, F.nD, 0.1, 0.9, 0.86, 0.96, U.rgb(U.mix([18, 20, 34], FOG, f)));
      const s = F.nA.s;
      for (const u of [0.22, 0.78]) {
        const pt = this.qp(F.nA, F.nB, F.nC, F.nD, u, 0.62);
        ctx.fillStyle = U.rgb(U.mix(P.LIGHT_Y, FOG, f));
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, 0.05 * s), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(8,10,22,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(F.nA.x, F.nA.y);
      ctx.lineTo(F.nB.x, F.nB.y);
      ctx.lineTo(F.nC.x, F.nC.y);
      ctx.lineTo(F.nD.x, F.nD.y);
      ctx.closePath();
      ctx.stroke();
    }
  };

  RG.Renderer.prototype.drawBarrier = function (o) {
    const ctx = this.ctx;
    // Ножки
    for (const s of [-0.58, 0.58]) {
      this.drawBox(o.x + s, 0, 0.38, o.z, o.z + 0.3, 0.07,
        { front: [90, 84, 96], side: [64, 60, 74], top: [110, 104, 120] });
    }
    const F = this.drawBox(o.x, 0.34, 0.85, o.z, o.z + 0.4, 0.78,
      { front: P.BARRIER_MAIN, side: U.mix(P.BARRIER_MAIN, [80, 60, 20], 0.4), top: U.mix(P.BARRIER_MAIN, [255, 240, 200], 0.3) });
    if (!F || F.nA.s < 3) return;
    // Чёрные косые полосы → вертикальные сегменты
    for (const u of [0.1, 0.38, 0.66]) {
      this.band(F.nA, F.nB, F.nC, F.nD, u, u + 0.12, 0.05, 0.95, U.rgb(U.mix(P.BARRIER_DARK, FOG, this.fog(o.z))));
    }
  };

  RG.Renderer.prototype.drawGate = function (o) {
    const ctx = this.ctx;
    // Стойки
    for (const s of [-0.72, 0.72]) {
      this.drawBox(o.x + s, 0, 2.1, o.z, o.z + 0.26, 0.08,
        { front: P.GATE_POST, side: U.mix(P.GATE_POST, [30, 30, 50], 0.5), top: U.mix(P.GATE_POST, [220, 220, 240], 0.3) });
    }
    const F = this.drawBox(o.x, 1.0, 1.62, o.z, o.z + 0.35, 0.8,
      { front: P.GATE_BAR, side: U.mix(P.GATE_BAR, [60, 30, 40], 0.4), top: U.mix(P.GATE_BAR, [255, 240, 240], 0.3) });
    if (!F || F.nA.s < 3) return;
    // Красно-белые дольки
    for (const u of [0.12, 0.4, 0.68]) {
      this.band(F.nA, F.nB, F.nC, F.nD, u, u + 0.14, 0.06, 0.94, U.rgb(U.mix(P.GATE_BAR2, FOG, this.fog(o.z))));
    }
    // Мигающий фонарик сверху
    const lamp = this.project(o.x, 1.72, Math.max(o.z, 1.3));
    if (lamp.s > 3) {
      const blink = 0.55 + 0.45 * Math.sin(this.game.time * 8);
      this.ctx.fillStyle = 'rgba(255,150,90,' + blink.toFixed(2) + ')';
      this.ctx.beginPath();
      this.ctx.arc(lamp.x, lamp.y, Math.max(1.5, 0.07 * lamp.s), 0, Math.PI * 2);
      this.ctx.fill();
    }
  };

  // ---------- Монеты и бонусы ----------

  RG.Renderer.prototype.drawCoin = function (c) {
    const ctx = this.ctx;
    const pt = this.project(c.x, c.y, c.z);
    if (c.z < 0.9 || pt.s < 1) return;
    const r = 0.34 * pt.s;
    const sq = 0.22 + 0.78 * Math.abs(Math.cos(c.spin));
    const f = this.fog(c.z);

    ctx.globalAlpha = 1 - f * 0.55;
    ctx.fillStyle = U.rgb(U.mix(P.COIN_EDGE, FOG, f * 0.6));
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, r * sq, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = U.rgb(U.mix(P.COIN_GOLD, FOG, f * 0.6));
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, r * sq * 0.78, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = U.rgb(U.mix(P.COIN_INNER, FOG, f * 0.6), 0.9);
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, r * sq * 0.4, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pt.s > 26) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(pt.x - r * sq * 0.3, pt.y - r * 0.35, r * sq * 0.16, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  RG.Renderer.prototype.drawPowerup = function (s) {
    const ctx = this.ctx;
    const bob = Math.sin(this.game.time * 3 + s.spin) * 0.1;
    const pt = this.project(s.x, s.y + bob, s.z);
    if (s.z < 0.9 || pt.s < 1) return;
    const pulse = 1 + 0.07 * Math.sin(this.game.time * 5 + s.spin);
    const r = 0.42 * pt.s * pulse;
    const color = { magnet: '#ff5fa2', shield: '#7fd7ff', x2: '#ffd75e' }[s.type];
    const f = this.fog(s.z);

    ctx.globalAlpha = 1 - f * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r * 1.25, 0, Math.PI * 2);
    ctx.fill();

    rr(ctx, pt.x - r, pt.y - r, r * 2, r * 2, r * 0.4);
    ctx.fillStyle = U.rgb(U.mix(hexToRgb(color), FOG, f * 0.5), 0.92);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.lineCap = 'round';
    if (s.type === 'x2') {
      ctx.font = 'bold ' + Math.round(r * 1.05) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×2', pt.x, pt.y + r * 0.05);
    } else if (s.type === 'magnet') {
      const mr = r * 0.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - r * 0.1, mr, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x - mr, pt.y - r * 0.1);
      ctx.lineTo(pt.x - mr, pt.y + r * 0.42);
      ctx.moveTo(pt.x + mr, pt.y - r * 0.1);
      ctx.lineTo(pt.x + mr, pt.y + r * 0.42);
      ctx.stroke();
    } else {
      const sr = r * 0.62;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - sr);
      ctx.lineTo(pt.x + sr * 0.85, pt.y - sr * 0.45);
      ctx.lineTo(pt.x + sr * 0.7, pt.y + sr * 0.35);
      ctx.quadraticCurveTo(pt.x, pt.y + sr * 1.05, pt.x - sr * 0.7, pt.y + sr * 0.35);
      ctx.lineTo(pt.x - sr * 0.85, pt.y - sr * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  };

  // ---------- Игрок ----------

  RG.Renderer.prototype.drawPlayer = function () {
    const game = this.game;
    const p = game.player;
    const ctx = this.ctx;
    const s = this.focal() / C.PLAYER_Z;

    // Тень
    const gc = this.project(p.x, 0, C.PLAYER_Z);
    const shrink = 1 - Math.min(0.45, p.y * 0.28);
    ctx.fillStyle = 'rgba(6,6,16,' + (0.38 * shrink).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(gc.x, gc.y, 0.5 * s * shrink, 0.14 * s * shrink, 0, 0, Math.PI * 2);
    ctx.fill();

    const feet = this.project(p.x, p.y, C.PLAYER_Z);

    // ---- Тело ----
    ctx.save();
    ctx.translate(feet.x, feet.y);
    if (p.crashT >= 0) {
      const f = Math.min(1, p.crashT * 2.0);
      ctx.rotate(-f * 1.2);
      ctx.globalAlpha = Math.max(0.2, 1 - f * 0.75);
    } else {
      ctx.rotate(p.tilt * 0.85);
    }
    if (game.effects && game.effects.invuln > 0 && p.crashT < 0) {
      ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(game.time * 30);
    }
    ctx.scale(s, -s);
    if (p.sliding && p.crashT < 0) ctx.scale(1, 0.52);

    this.drawRunnerBody(p);
    ctx.restore();

    // ---- Аура бонусов ----
    const px = feet.x, py = this.project(p.x, p.y + 0.75, C.PLAYER_Z).y;
    const t = game.time;
    if (game.effects) {
      if (game.effects.shield) {
        ctx.strokeStyle = 'rgba(127,215,255,0.75)';
        ctx.lineWidth = Math.max(2, 0.035 * s);
        ctx.beginPath();
        ctx.arc(px, py, 0.95 * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(127,215,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,245,255,0.9)';
        for (let i = 0; i < 3; i++) {
          const a0 = t * 4 + i * Math.PI * 2 / 3;
          ctx.beginPath();
          ctx.arc(px, py, 0.95 * s, a0, a0 + 0.5);
          ctx.stroke();
        }
      }
      if (game.effects.magnet > 0) {
        ctx.fillStyle = 'rgba(255,95,162,0.85)';
        for (let i = 0; i < 4; i++) {
          const a = t * 5 + i * Math.PI / 2;
          const rx = 1.05 * s, ry = 0.5 * s;
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * rx, py + Math.sin(a) * ry, Math.max(1.5, 0.05 * s), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (game.effects.x2 > 0) {
        ctx.fillStyle = 'rgba(255,220,110,0.9)';
        for (let i = 0; i < 5; i++) {
          const a = t * 3 + i * 1.3;
          const rad = (0.7 + 0.35 * Math.sin(t * 4 + i)) * s;
          const x = px + Math.cos(a) * rad, y = py + Math.sin(a) * rad * 0.8;
          const sr = Math.max(1.5, 0.055 * s);
          ctx.beginPath();
          ctx.moveTo(x, y - sr);
          ctx.lineTo(x + sr * 0.4, y);
          ctx.lineTo(x, y + sr);
          ctx.lineTo(x - sr * 0.4, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  };

  RG.Renderer.prototype.drawRunnerBody = function (p) {
    const ctx = this.ctx;
    const Pc = P.PLAYER;
    ctx.lineCap = 'round';

    const airborne = !p.onGround;
    const sliding = p.sliding && !airborne;
    const phase = p.runPhase;
    const swing = Math.sin(phase);
    const swingB = Math.sin(phase + Math.PI);
    const bob = airborne || sliding ? 0 : Math.abs(Math.sin(phase)) * 0.03;

    const hipY = 0.78 + bob * 0.5;
    let liftR, liftL, handY, handX;
    if (airborne) {
      liftR = 0.3; liftL = 0.24;
      handY = 1.32; handX = 0.4;
    } else if (sliding) {
      liftR = 0.18; liftL = 0.18;
      handY = 0.5; handX = 0.42;
    } else {
      liftR = Math.max(0, swing) * 0.3;
      liftL = Math.max(0, swingB) * 0.3;
      handY = 1.0 - swing * 0.26;
      handX = 0.36;
    }

    // Ноги
    const legs = [
      { x: -0.13, lift: liftL, sw: swingB },
      { x: 0.13, lift: liftR, sw: swing }
    ];
    for (const L of legs) {
      const hip = { x: L.x, y: hipY };
      const knee = { x: L.x + L.sw * 0.05, y: 0.42 + L.lift * 0.5 + bob * 0.4 };
      const foot = { x: L.x + L.sw * 0.06, y: 0.04 + L.lift };
      ctx.strokeStyle = U.rgb(Pc.pants);
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(hip.x, hip.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(foot.x, foot.y);
      ctx.stroke();
      ctx.fillStyle = U.rgb(Pc.shoe);
      ctx.beginPath();
      ctx.ellipse(foot.x, foot.y + 0.02, 0.09, 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Торс и рюкзак
    rr(ctx, -0.27, 0.72 + bob, 0.54, 0.48, 0.14);
    ctx.fillStyle = U.rgb(Pc.jacket);
    ctx.fill();
    rr(ctx, -0.19, 0.76 + bob, 0.38, 0.4, 0.1);
    ctx.fillStyle = U.rgb(Pc.backpack);
    ctx.fill();
    ctx.strokeStyle = U.rgb(Pc.jacketDark);
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(-0.2, 1.12 + bob);
    ctx.lineTo(0.2, 1.12 + bob);
    ctx.stroke();

    // Руки
    for (const sideSign of [-1, 1]) {
      const shoulder = { x: sideSign * 0.27, y: 1.1 - bob };
      const hand = { x: sideSign * handX, y: handY };
      const elbow = { x: sideSign * 0.33, y: (shoulder.y + hand.y) / 2 };
      ctx.strokeStyle = U.rgb(Pc.jacket);
      ctx.lineWidth = 0.13;
      ctx.beginPath();
      ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(hand.x, hand.y);
      ctx.stroke();
      ctx.fillStyle = U.rgb(Pc.skin);
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // Голова (вид со спины)
    const headY = 1.38 + bob;
    ctx.fillStyle = U.rgb(Pc.skin);
    ctx.beginPath();
    ctx.arc(0, headY, 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = U.rgb(Pc.hair);
    ctx.beginPath();
    ctx.arc(0, headY + 0.02, 0.203, 0, Math.PI * 2);
    ctx.fill();
    // Кепка (виден затылок кепки)
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(0, headY + 0.02, 0.207, Math.PI * 0.12, Math.PI * 0.88);
    ctx.fill();
    // Наушники
    ctx.strokeStyle = U.rgb(Pc.headset);
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.arc(0, headY, 0.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.fillStyle = U.rgb(Pc.headset);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sgn * 0.185, headY, 0.055, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = 'butt';
  };

  // ---------- Частицы и всплывающий текст ----------

  RG.Renderer.prototype.drawParticles = function () {
    const ctx = this.ctx;
    for (const p of this.game.particles) {
      if (p.z < 0.9) continue;
      const pt = this.project(p.x, p.y, p.z);
      const alpha = U.clamp01(p.life / p.maxLife);
      const r = Math.max(0.7, p.size * pt.s);
      ctx.fillStyle = U.rgb(hexToRgb(p.color), alpha * 0.95);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  RG.Renderer.prototype.drawFloats = function () {
    const ctx = this.ctx;
    for (const f of this.game.floats) {
      const pt = this.project(f.x, f.y, f.z);
      if (pt.s < 1) continue;
      const alpha = U.clamp01(f.life / 0.45);
      const size = U.clamp(f.s * 0.2, 12, 40);
      ctx.font = 'bold ' + Math.round(size) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.strokeStyle = 'rgba(10,10,26,0.85)';
      ctx.strokeText(f.text, pt.x, pt.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, pt.x, pt.y);
      ctx.globalAlpha = 1;
    }
  };

  // ---------- Экранные эффекты ----------

  RG.Renderer.prototype.drawOverlays = function () {
    const ctx = this.ctx;
    const g = this.game;
    const sf = U.clamp01((g.speed - 14) / 14);

    if (sf > 0.05) {
      const n = Math.round(4 + sf * 14);
      ctx.strokeStyle = 'rgba(200,215,255,' + (0.05 + 0.12 * sf).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const cx = this.w / 2, cy = this.h * 0.55;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = Math.max(this.w, this.h) * (0.3 + Math.random() * 0.3);
        const r1 = r0 + 40 + 160 * sf;
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      ctx.stroke();
    }

    if (g.crashFlash > 0) {
      ctx.fillStyle = 'rgba(255,70,80,' + (0.22 * g.crashFlash).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  };

  // ---------- Главный кадр ----------

  RG.Renderer.prototype.draw = function () {
    const g = this.game;
    this.drawSky();
    this.drawSkyline();
    this.drawGround();
    this.drawTrack();
    this.drawDecor();

    const list = [];
    for (const o of g.obstacles) {
      if (!o.dead && o.z + o.len > 1.6) list.push({ k: o.z + o.len * 0.5, f: () => this.drawObstacle(o) });
    }
    for (const c of g.coinList) {
      if (!c.dead && c.z > 0.9) list.push({ k: c.z, f: () => this.drawCoin(c) });
    }
    for (const s of g.powerupList) {
      if (!s.dead && s.z > 0.9) list.push({ k: s.z, f: () => this.drawPowerup(s) });
    }
    list.push({ k: C.PLAYER_Z, f: () => this.drawPlayer() });
    list.sort((a, b) => b.k - a.k);
    for (const it of list) it.f();

    this.drawParticles();
    this.drawFloats();
    this.drawOverlays();
  };
})();
