// Псевдо-3D рендер на Canvas 2D: проекция, фон, трек, объекты.
window.RG = window.RG || {};

(function () {
  const C = RG.CONFIG;
  const U = RG.util;

  // ---- Палитра ----
  const SKY_TOP = [13, 18, 51];
  const SKY_MID = [38, 48, 94];
  const SKY_LOW = [106, 74, 126];
  const SKY_HORIZON = [217, 107, 116];
  const FOG = [74, 60, 110];
  const GROUND_BOTTOM = [28, 26, 40];
  const BALLAST = [44, 39, 56];
  const SLEEPER = [79, 64, 76];
  const RAIL = [140, 145, 172];
  const WALL_LOW = [40, 35, 62];
  const WALL_TOP = [56, 48, 88];
  const COLUMN = [70, 60, 106];

  const TRAIN_COLORS = [
    { front: [205, 70, 95], side: [166, 52, 76], top: [220, 106, 128] },
    { front: [63, 143, 216], side: [46, 112, 178], top: [108, 172, 228] },
    { front: [79, 195, 127], side: [56, 158, 100], top: [122, 212, 158] },
    { front: [232, 178, 61], side: [196, 146, 44], top: [242, 202, 114] }
  ];
  const WIN_DARK = [22, 30, 47];
  const LIGHT_Y = [255, 233, 168];
  const BARRIER_MAIN = [235, 160, 44];
  const BARRIER_DARK = [40, 34, 30];
  const GATE_BAR = [214, 74, 86];
  const GATE_BAR2 = [240, 240, 246];
  const GATE_POST = [86, 92, 122];
  const COIN_GOLD = [255, 215, 94];
  const COIN_INNER = [255, 238, 165];
  const COIN_EDGE = [168, 112, 32];

  const PLAYER = {
    jacket: [255, 77, 90], jacketDark: [206, 54, 70], backpack: [46, 55, 86],
    pants: [40, 48, 76], shoe: [238, 242, 255], skin: [240, 192, 144],
    hair: [38, 27, 22], headset: [24, 24, 38]
  };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function Renderer(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.skyline = [];
    this.clouds = [];
    this.vignette = null;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildSkyline();
    this.buildClouds();
    const r = Math.max(w, h) * 0.72;
    const g = this.ctx.createRadialGradient(w / 2, h * 0.55, r * 0.42, w / 2, h * 0.55, r);
    g.addColorStop(0, 'rgba(6,6,18,0)');
    g.addColorStop(1, 'rgba(6,6,18,0.5)');
    this.vignette = g;
  };

  Renderer.prototype.buildSkyline = function () {
    const rnd = U.seededRandom(7331);
    const totalW = this.w * 2.4;
    const out = [];
    let x = 0;
    while (x < totalW) {
      const bw = 30 + rnd() * 70;
      const bh = 30 + rnd() * (this.h * 0.16);
      const windows = [];
      const cols = Math.max(1, Math.floor(bw / 16));
      const rows = Math.max(1, Math.floor(bh / 20));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rnd() < 0.3) windows.push([6 + cx * 16, 8 + cy * 20]);
        }
      }
      out.push({ x: x, w: bw, h: bh, windows: windows });
      x += bw + 4 + rnd() * 18;
    }
    this.skyline = out;
    this.skylineW = x;
  };

  Renderer.prototype.buildClouds = function () {
    const rnd = U.seededRandom(4242);
    const out = [];
    for (let i = 0; i < 7; i++) {
      out.push({
        x: rnd() * this.w * 1.6,
        y: this.h * (0.05 + rnd() * 0.2),
        scale: 0.5 + rnd() * 1.3,
        speed: 4 + rnd() * 10
      });
    }
    this.clouds = out;
  };

  Renderer.prototype.focal = function () {
    return this.h * C.FOV * this.game.camera.fovMul;
  };

  Renderer.prototype.fog = function (z) {
    return U.clamp01((z - 14) / 68);
  };

  Renderer.prototype.project = function (x, y, z) {
    z = Math.max(z, 1.2);
    const cam = this.game.camera;
    const s = this.focal() / z;
    return {
      x: this.w / 2 + (x - cam.x) * s + cam.shakeX,
      y: this.h * C.HORIZON + (C.CAM_Y - y) * s + cam.shakeY,
      s: s
    };
  };

  Renderer.prototype.quad = function (pts, fill) {
    if (!fill) return;
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  };

  // Углы параллелепипеда: near (z0) и far (z1).
  Renderer.prototype.faces = function (x, y0, y1, z0, z1, hw) {
    if (z1 <= Math.max(z0, 1.2) + 0.02) return null;
    z0 = Math.max(z0, 1.2);
    const p = this.project.bind(this);
    const camX = this.game.camera.x;
    return {
      nA: p(x - hw, y1, z0), nB: p(x + hw, y1, z0),
      nC: p(x + hw, y0, z0), nD: p(x - hw, y0, z0),
      fA: p(x - hw, y1, z1), fB: p(x + hw, y1, z1),
      fC: p(x + hw, y0, z1), fD: p(x - hw, y0, z1),
      top: y1 < C.CAM_Y,
      left: (x - hw) > camX,
      right: (x + hw) < camX,
      z0: z0, z1: z1
    };
  };

  Renderer.prototype.drawBox = function (x, y0, y1, z0, z1, hw, cols, alpha) {
    const F = this.faces(x, y0, y1, z0, z1, hw);
    if (!F) return;
    const f = this.fog((F.z0 + F.z1) / 2);
    const ctx = this.ctx;
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);

    if (F.top) {
      this.quad([F.fA, F.fB, F.nB, F.nA], U.rgb(U.mix(cols.top, FOG, f)));
    }
    if (F.left) {
      this.quad([F.nA, F.nD, F.fD, F.fA], U.rgb(U.mix(cols.side, FOG, f)));
    } else if (F.right) {
      this.quad([F.nB, F.nC, F.fC, F.fB], U.rgb(U.mix(cols.side, FOG, f)));
    }
    this.quad([F.nA, F.nB, F.nC, F.nD], U.rgb(U.mix(cols.front, FOG, f)));
    ctx.globalAlpha = 1;
    return F;
  };

  // Точка внутри четырёхугольника (tl, tr, br, bl) по долям u, v.
  Renderer.prototype.qp = function (tl, tr, br, bl, u, v) {
    const top = { x: U.lerp(tl.x, tr.x, u), y: U.lerp(tl.y, tr.y, u) };
    const bot = { x: U.lerp(bl.x, br.x, u), y: U.lerp(bl.y, br.y, u) };
    return { x: U.lerp(top.x, bot.x, v), y: U.lerp(top.y, bot.y, v) };
  };

  Renderer.prototype.band = function (tl, tr, br, bl, u0, u1, v0, v1, fill) {
    this.quad([
      this.qp(tl, tr, br, bl, u0, v0),
      this.qp(tl, tr, br, bl, u1, v0),
      this.qp(tl, tr, br, bl, u1, v1),
      this.qp(tl, tr, br, bl, u0, v1)
    ], fill);
  };

  // ---------- Фон ----------

  Renderer.prototype.drawSky = function () {
    const ctx = this.ctx;
    const hz = this.h * C.HORIZON;
    const g = ctx.createLinearGradient(0, 0, 0, hz + this.h * 0.1);
    g.addColorStop(0, U.rgb(SKY_TOP));
    g.addColorStop(0.55, U.rgb(SKY_MID));
    g.addColorStop(0.88, U.rgb(SKY_LOW));
    g.addColorStop(1, U.rgb(SKY_HORIZON));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, hz + this.h * 0.1);

    // Луна с ореолом
    const mx = this.w * 0.75, my = hz * 0.42, mr = Math.max(14, this.h * 0.035);
    const glow = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 5);
    glow.addColorStop(0, 'rgba(244,240,255,0.5)');
    glow.addColorStop(1, 'rgba(244,240,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    ctx.fillStyle = '#f4f0ff';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    // Облака-полосы
    const t = this.game.time;
    ctx.fillStyle = 'rgba(30,30,70,0.55)';
    for (const c of this.clouds) {
      const cw = 120 * c.scale, ch = 14 * c.scale;
      let cx = (c.x + t * c.speed + this.game.camera.x * -6) % (this.w + 300);
      if (cx < -150) cx += this.w + 300;
      rr(ctx, cx - cw / 2, c.y, cw, ch, ch / 2);
      ctx.fill();
    }
  };

  Renderer.prototype.drawSkyline = function () {
    const ctx = this.ctx;
    const hz = this.h * C.HORIZON;
    const cam = this.game.camera;
    const off = -((cam.x * 10 + this.game.distance * 0.25) % this.skylineW);
    for (let rep = 0; rep < 2; rep++) {
      const baseX = off + rep * this.skylineW;
      for (const b of this.skyline) {
        const x = baseX + b.x;
        if (x > this.w + 60 || x + b.w < -60) continue;
        ctx.fillStyle = '#0b1126';
        ctx.fillRect(x, hz - b.h, b.w, b.h + 2);
        ctx.fillStyle = 'rgba(255,210,122,0.75)';
        for (const wnd of b.windows) {
          ctx.fillRect(x + wnd[0], hz - b.h + wnd[1], 4, 6);
        }
      }
    }
  };

  Renderer.prototype.drawGround = function () {
    const ctx = this.ctx;
    const hz = this.h * C.HORIZON;
    const g = ctx.createLinearGradient(0, hz, 0, this.h);
    g.addColorStop(0, U.rgb(U.mix(FOG, BALLAST, 0.55)));
    g.addColorStop(0.16, U.rgb(BALLAST));
    g.addColorStop(0.6, U.rgb(U.mix(BALLAST, GROUND_BOTTOM, 0.7)));
    g.addColorStop(1, U.rgb(GROUND_BOTTOM));
    ctx.fillStyle = g;
    ctx.fillRect(0, hz - 1, this.w, this.h - hz + 1);

    // Балластная подушка под путями
    const n0 = this.project(-5.2, 0, 1.3);
    const n1 = this.project(5.2, 0, 1.3);
    const f0 = this.project(-5.2, 0, 110);
    const f1 = this.project(5.2, 0, 110);
    this.quad([f0, f1, n1, n0], U.rgb(U.mix(BALLAST, FOG, 0.35)));

    // Стены коридора
    for (const side of [-1, 1]) {
      const x = 5.0 * side;
      const bn = this.project(x, 0, 1.3), tn = this.project(x, 1.8, 1.3);
      const bf = this.project(x, 0, 110), tf = this.project(x, 1.8, 110);
      this.quad([tn, tf, bf, bn], U.rgb(U.mix(WALL_LOW, FOG, 0.22)));
      const t2n = this.project(x, 1.8, 1.3), t2f = this.project(x, 1.8, 110);
      const t3n = this.project(x, 3.4, 1.3), t3f = this.project(x, 3.4, 110);
      this.quad([t3n, t3f, t2f, t2n], U.rgb(U.mix(WALL_TOP, FOG, 0.28)));
    }
  };

  Renderer.prototype.drawTrack = function () {
    const ctx = this.ctx;
    const gap = 2.0;
    const off = this.game.distance % gap;

    // Шпалы
    for (const lane of C.LANES) {
      const f = this.fog;
      for (let k = 0; k < 34; k++) {
        const z = 1.6 + k * gap - off;
        if (z < 0.9) continue;
        const a = this.project(lane - 0.95, 0.015, z);
        const b = this.project(lane + 0.95, 0.015, z);
        const c2 = this.project(lane + 0.95, 0.015, z + 0.5);
        const d2 = this.project(lane - 0.95, 0.015, z + 0.5);
        this.quad([d2, c2, b, a], U.rgb(U.mix(SLEEPER, FOG, f(z + 0.3))));
      }
    }

    // Рельсы
    for (const lane of C.LANES) {
      for (const s of [-0.62, 0.62]) {
        this.drawBox(lane + s, 0.02, 0.16, 1.3, 100, 0.055,
          { front: RAIL, side: U.mix(RAIL, [30, 30, 46], 0.5), top: U.mix(RAIL, [255, 255, 255], 0.25) });
      }
    }

    // Туманная дымка у горизонта (рисуется до объектов)
    const hz = this.h * C.HORIZON;
    const bandH = this.h * 0.12;
    const g = ctx.createLinearGradient(0, hz - 4, 0, hz + bandH);
    g.addColorStop(0, U.rgb(FOG, 0.85));
    g.addColorStop(0.5, U.rgb(FOG, 0.35));
    g.addColorStop(1, U.rgb(FOG, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, hz - 4, this.w, bandH + 4);
  };

  Renderer.prototype.drawDecor = function () {
    const dist = this.game.distance;
    const items = [];
    const colGap = 8, colOff = dist % colGap;
    for (let k = 0; k < 12; k++) {
      const z = 1.5 + k * colGap - colOff;
      if (z < 1.3) continue;
      items.push({ z: z, kind: 'col', side: -1 });
      items.push({ z: z, kind: 'col', side: 1 });
    }
    const bbGap = 27, bbOff = dist % bbGap;
    for (let k = 0; k < 4; k++) {
      const z = 8 + k * bbGap - bbOff;
      if (z < 1.3) continue;
      items.push({ z: z, kind: 'bb', side: (k % 2 === 0) ? 1 : -1, idx: k });
    }
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      if (it.kind === 'col') this.drawColumn(it.z, it.side);
      else this.drawBillboard(it.z, it.side, it.idx);
    }
  };

  Renderer.prototype.drawColumn = function (z, side) {
    const f = this.fog(z + 0.5);
    this.drawBox(4.72 * side, 0, 2.1, z, z + 0.7, 0.34,
      { front: COLUMN, side: U.mix(COLUMN, FOG, 0.3), top: U.mix(COLUMN, [200, 200, 230], 0.2) });
  };

  Renderer.prototype.drawBillboard = function (z, side, idx) {
    const ctx = this.ctx;
    const palette = [[67, 232, 240], [255, 95, 162], [255, 166, 61], [99, 240, 168]];
    const col = palette[idx % palette.length];
    const x = 4.68 * side;
    const z1 = z + 3.4;
    const f = this.fog(z + 1.7);
    const tl = this.project(x, 3.35, z);
    const tr = this.project(x, 3.35, z1);
    const br = this.project(x, 1.85, z1);
    const bl = this.project(x, 1.85, z);
    const main = U.mix(col, FOG, f);

    // Каркас и панель
    this.quad([tl, tr, br, bl], U.rgb(U.mix([26, 24, 44], FOG, f)));
    this.band(tl, tr, br, bl, 0.05, 0.95, 0.08, 0.92, U.rgb(main, 0.95));
    // «Надпись»: контрастные полосы
    this.band(tl, tr, br, bl, 0.18, 0.52, 0.3, 0.46, U.rgb(U.mix([16, 16, 30], main, 0.2)));
    this.band(tl, tr, br, bl, 0.58, 0.84, 0.3, 0.46, U.rgb(U.mix([16, 16, 30], main, 0.2)));
    this.band(tl, tr, br, bl, 0.18, 0.84, 0.62, 0.78, U.rgb(U.mix([255, 255, 255], main, 0.35), 0.85));
  };

  RG.Renderer = Renderer;
  RG.Renderer.palette = {
    FOG: FOG, TRAIN_COLORS: TRAIN_COLORS, PLAYER: PLAYER,
    WIN_DARK: WIN_DARK, LIGHT_Y: LIGHT_Y,
    BARRIER_MAIN: BARRIER_MAIN, BARRIER_DARK: BARRIER_DARK,
    GATE_BAR: GATE_BAR, GATE_BAR2: GATE_BAR2, GATE_POST: GATE_POST,
    COIN_GOLD: COIN_GOLD, COIN_INNER: COIN_INNER, COIN_EDGE: COIN_EDGE,
    rr: rr
  };
})();
