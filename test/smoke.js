// Смоук-тесты игровой логики в Node (без DOM). Запуск: node test/smoke.js
'use strict';
const fs = require('fs');
const path = require('path');

// --- Мини-окружение ---
global.window = global;
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

const root = path.join(__dirname, '..');
for (const f of ['config', 'utils', 'entities', 'game']) {
  const src = fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8');
  (0, eval)(src); // eslint-disable-line no-eval
}

const C = window.RG.CONFIG;
const U = window.RG.util;

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

function cleanTrack(game) {
  game.obstacles = [];
  game.coinList = [];
  game.powerupList = [];
  game.lastRow = 1e9; // отключаем спавнер для изолированных проверок
}

// --- Тест 1: честность генерации (все три полосы никогда не блокируются) ---
(function fairnessTest() {
  console.log('\n[1] Честность генерации препятствий');
  const game = new window.RG.Game(null);
  game.state = 'playing';
  let z = 20;
  for (let i = 0; i < 260; i++) {
    const difficulty = Math.min(1, i / 180);
    game.distance = difficulty * C.SPEED_RAMP;
    game.spawnRowAt(z, difficulty);
    z += U.rand(10, 18);
  }

  const trains = game.obstacles.filter(o => o.type === 'train');
  let bad = null;
  const probe = [];
  for (const t of trains) { probe.push(t.z); probe.push(t.z + t.len); }
  for (const pz of probe) {
    const lanes = new Set();
    for (const t of trains) if (pz > t.z + 0.01 && pz < t.z + t.len - 0.01) lanes.add(t.lane);
    if (lanes.size >= 3) { bad = 'z=' + pz.toFixed(1); break; }
  }
  check('поезда никогда не занимают все 3 полосы на одной глубине', !bad, bad);

  let overlap = null;
  for (const o of game.obstacles) {
    if (o.type === 'train') continue;
    for (const t of trains) {
      if (t.lane !== o.lane) continue;
      const a0 = o.z, a1 = o.z + o.len, b0 = t.z, b1 = t.z + t.len;
      if (a0 < b1 - 1.0 && a1 > b0 + 1.0) { overlap = o.type + ' lane ' + o.lane + ' z=' + o.z.toFixed(1); break; }
    }
    if (overlap) break;
  }
  check('барьеры/ворота не пересекаются с поездами', !overlap, overlap);

  let coinBug = null;
  for (const c of game.coinList) {
    for (const t of trains) {
      if (Math.abs(t.x - c.x) < 0.8 && c.z > t.z - 0.4 && c.z < t.z + t.len + 0.4) {
        coinBug = 'coin z=' + c.z.toFixed(1) + ' lane x=' + c.x;
        break;
      }
    }
    if (coinBug) break;
  }
  check('монеты не спавнятся внутри поездов', !coinBug, coinBug);
  console.log('  (поездов: ' + trains.length + ', монет: ' + game.coinList.length + ', препятствий: ' + game.obstacles.length + ')');
})();

// --- Тест 2: столкновение с поездом ведёт к game over и рекорду ---
(function crashTest() {
  console.log('\n[2] Столкновение и рекорд');
  const game = new window.RG.Game(null);
  let overStats = null;
  game.hooks.onGameOver = s => { overStats = s; };
  game.start();
  cleanTrack(game);
  game.score = 250;
  game.obstacles.push(window.RG.makeTrain(1, C.PLAYER_Z + 6, 8, 0));
  for (let i = 0; i < 400 && game.state !== 'over'; i++) game.update(1 / 60);
  check('столкновение с поездом → game over', game.state === 'over', game.state);
  check('hook onGameOver вызван', !!overStats);
  check('рекорд сохранён в localStorage', overStats && overStats.best === Math.floor(game.score) &&
    U.storage.get(C.STORAGE_KEY_BEST, 0) === overStats.best, 'best=' + (overStats && overStats.best));
})();

// --- Тест 3: прыжок через барьер и подкат под ворота ---
(function actionTest() {
  console.log('\n[3] Прыжок и подкат');

  // Без действия — должен быть крах
  const g0 = new window.RG.Game(null);
  g0.start(); cleanTrack(g0);
  const b0 = window.RG.makeBarrier(1, C.PLAYER_Z + 8);
  g0.obstacles.push(b0);
  for (let i = 0; i < 120 && g0.state === 'playing'; i++) g0.update(1 / 60);
  check('барьер без прыжка = крах', g0.state !== 'playing', g0.state);

  // С прыжком — проходим
  const game = new window.RG.Game(null);
  game.start(); cleanTrack(game);
  const barrier = window.RG.makeBarrier(1, C.PLAYER_Z + 9);
  game.obstacles.push(barrier);
  for (let i = 0; i < 150; i++) {
    const dz = barrier.z - C.PLAYER_Z;
    if (dz > 2.2 && dz < 3.2 && game.player.onGround) game.player.jump();
    game.update(1 / 60);
    if (game.state !== 'playing') break;
  }
  check('барьер перепрыгнут', game.state === 'playing', game.state);

  // Ворота с подкатом
  const g1 = new window.RG.Game(null);
  g1.start(); cleanTrack(g1);
  const gateNo = window.RG.makeGate(1, C.PLAYER_Z + 8);
  g1.obstacles.push(gateNo);
  for (let i = 0; i < 120 && g1.state === 'playing'; i++) g1.update(1 / 60);
  check('ворота без подката = крах', g1.state !== 'playing', g1.state);

  const game2 = new window.RG.Game(null);
  game2.start(); cleanTrack(game2);
  const gate = window.RG.makeGate(1, C.PLAYER_Z + 8);
  game2.obstacles.push(gate);
  for (let i = 0; i < 150; i++) {
    if (gate.z - C.PLAYER_Z < 3.0) game2.player.dive();
    game2.update(1 / 60);
    if (game2.state !== 'playing') break;
  }
  check('подкат пройден под воротами', game2.state === 'playing', game2.state);
})();

// --- Тест 4: монеты, магнит, ×2, щит ---
(function pickupTest() {
  console.log('\n[4] Монеты и бонусы');
  const game = new window.RG.Game(null);
  game.start(); cleanTrack(game);
  game.score = 0;

  const myCoins = [];
  for (let i = 0; i < 6; i++) {
    const c = window.RG.makeCoin(C.LANES[1], 0.42, C.PLAYER_Z + 8 + i * 1.0);
    game.coinList.push(c); myCoins.push(c);
  }
  game.powerupList.push(window.RG.makePowerup('x2', 1, C.PLAYER_Z + 20));

  for (let i = 0; i < 240 && game.state === 'playing'; i++) {
    if (game.distance > 40 && game.lastRow > 1e6) game.lastRow = 1e9;
    game.update(1 / 60);
  }
  check('вся линия монет собрана', myCoins.every(c => c.dead), 'собрано: ' + myCoins.filter(c => c.dead).length);
  check('×2 активирован', game.effects.x2 > 0);
  check('очки за монеты начислены (с удвоением)', game.score >= 120, 'очки: ' + game.score);

  // Магнит: монета в соседней полосе притягивается
  const g2 = new window.RG.Game(null);
  g2.start(); cleanTrack(g2);
  g2.effects.magnet = C.MAGNET_TIME;
  const mc = window.RG.makeCoin(C.LANES[2], 0.42, C.PLAYER_Z + 12);
  g2.coinList.push(mc);
  for (let i = 0; i < 240 && g2.state === 'playing'; i++) g2.update(1 / 60);
  check('магнит притягивает монету из соседней полосы', mc.dead);

  // Щит поглощает столкновение с поездом
  const g3 = new window.RG.Game(null);
  g3.start(); cleanTrack(g3);
  g3.effects.shield = true;
  const train = window.RG.makeTrain(1, C.PLAYER_Z + 8, 8, 0);
  g3.obstacles.push(train);
  for (let i = 0; i < 120 && g3.state === 'playing'; i++) g3.update(1 / 60);
  check('щит поглотил удар и игра продолжается', g3.state === 'playing' && !g3.effects.shield);
  check('столкнувшийся поезд уничтожен', train.dead);
})();

// --- Тест 5: длинный прогон с ботом (стабильность) ---
(function botRun() {
  console.log('\n[5] Прогон 180 секунд с ботом');
  const game = new window.RG.Game(null);
  let crashes = 0;
  game.hooks.onGameOver = () => { crashes++; };
  game.start();

  const dt = 1 / 60;
  for (let frame = 0; frame < 180 * 60 && crashes < 3; frame++) {
    if (game.state === 'over') game.start();
    if (game.state !== 'playing') { game.update(dt); continue; }

    const p = game.player;
    const laneScore = [2, 2, 2];
    const nearest = [null, null, null];
    for (const o of game.obstacles) {
      const dz = o.z - C.PLAYER_Z;
      const farDz = o.z + o.len - C.PLAYER_Z;
      if (farDz < -1.5 || dz > 42) continue; // объект ещё «рядом» с игроком
      let sc = o.type === 'train' ? 0 : 1.6;
      if (o.type === 'train' && dz > 26) sc = 1.4;
      if (sc < laneScore[o.lane]) laneScore[o.lane] = sc;
      if (!nearest[o.lane] || o.z < nearest[o.lane].z) nearest[o.lane] = o;
    }
    let best = p.lane;
    for (let l = 0; l < 3; l++) if (laneScore[l] > laneScore[best] + 0.01) best = l;
    const dir = Math.sign(best - p.lane);
    if (dir) p.moveLane(dir); // по одной полосе за кадр, как живой игрок

    const ob = nearest[p.lane];
    if (ob) {
      const dz = ob.z - C.PLAYER_Z;
      if (ob.type === 'barrier' && dz < 3.4 && dz > 1.4 && p.onGround) p.jump();
      else if (ob.type === 'gate' && dz < 2.6 && dz > 0.6 && p.onGround) p.dive();
    }
    if (p.sliding && U.chance(0.3)) game.dust(p.x, C.PLAYER_Z, 1);
    game.update(dt);
  }
  check('бот доезжает без падений дольше минуты', game.distance > 900, 'дистанция: ' + Math.round(game.distance));
  check('набраны монеты за прогон', game.coins > 20, 'монет: ' + game.coins);
  check('скорость растёт до максимума', game.speed > C.SPEED_MAX * 0.98, 'скорость: ' + game.speed.toFixed(1));
  check('очки начисляются', game.score > 3000, 'очки: ' + Math.round(game.score));
  console.log('  (дистанция: ' + Math.round(game.distance) + ' м, монет: ' + game.coins +
    ', очков: ' + Math.round(game.score) + ', падений бота: ' + crashes + ')');
})();

console.log('\n' + (failures === 0 ? 'ВСЕ ТЕСТЫ ПРОЙДЕНЫ ✔' : failures + ' тест(ов) упало ✘'));
process.exit(failures === 0 ? 0 : 1);
