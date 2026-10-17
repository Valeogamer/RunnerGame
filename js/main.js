// Точка входа: связывает игру, рендер, ввод и DOM-интерфейс.
window.RG = window.RG || {};

(function () {
  const C = RG.CONFIG;
  const U = RG.util;

  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    const canvas = $('game');
    const audio = new RG.AudioSystem();
    const game = new RG.Game(audio);
    const renderer = new RG.Renderer(canvas, game);

    const ui = {
      hud: $('hud'),
      score: $('score'),
      dist: $('dist'),
      coins: $('coins'),
      best: $('best'),
      menu: $('menu'),
      menuBest: $('menu-best'),
      pause: $('pause'),
      over: $('over'),
      overTitle: $('over-title'),
      overScore: $('over-score'),
      overCoins: $('over-coins'),
      overDist: $('over-dist'),
      overBest: $('over-best'),
      recordBadge: $('badge-record'),
      powerups: $('powerups'),
      btnMute: $('btn-mute')
    };

    // ---------- Управление состоянием ----------

    function showMenu() {
      game.toMenu();
      ui.menu.classList.remove('hidden');
      ui.pause.classList.add('hidden');
      ui.over.classList.add('hidden');
      ui.hud.classList.add('hidden');
      ui.menuBest.textContent = U.fmt(game.best);
    }

    function startGame() {
      audio.ensure();
      game.start();
      ui.menu.classList.add('hidden');
      ui.pause.classList.add('hidden');
      ui.over.classList.add('hidden');
      ui.hud.classList.remove('hidden');
    }

    function pauseGame() {
      if (game.state !== 'playing') return;
      game.pause();
      ui.pause.classList.remove('hidden');
      audio.play('click');
    }

    function resumeGame() {
      if (game.state !== 'paused') return;
      game.resume();
      ui.pause.classList.add('hidden');
      audio.play('click');
    }

    function primaryAction() {
      if (game.state === 'menu') startGame();
      else if (game.state === 'playing') {
        if (game.player.jump()) audio.play('jump');
      } else if (game.state === 'over') startGame();
      else if (game.state === 'paused') resumeGame();
    }

    game.hooks.onGameOver = function (stats) {
      ui.overScore.textContent = U.fmt(stats.score);
      ui.overCoins.textContent = U.fmt(stats.coins);
      ui.overDist.textContent = U.fmt(stats.distance) + ' м';
      ui.overBest.textContent = U.fmt(stats.best);
      ui.recordBadge.classList.toggle('hidden', !stats.isRecord);
      ui.overTitle.textContent = stats.isRecord ? 'Новый рекорд!' : 'Игра окончена';
      ui.over.classList.remove('hidden');
    };

    const input = new RG.InputManager(document, {
      onAny: function () { audio.ensure(); },
      onLeft: function () {
        if (game.state === 'playing') game.player.moveLane(-1);
      },
      onRight: function () {
        if (game.state === 'playing') game.player.moveLane(1);
      },
      onJump: function () { primaryAction(); },
      onTap: function () { primaryAction(); },
      onSlide: function () {
        if (game.state !== 'playing') return;
        const wasSliding = game.player.sliding;
        game.player.dive();
        if (!wasSliding && game.player.sliding && game.player.onGround) audio.play('slide');
      },
      onPause: function () {
        if (game.state === 'playing') pauseGame();
        else if (game.state === 'paused') resumeGame();
      },
      onMute: function () { toggleMute(); },
      onRestart: function () {
        if (game.state === 'playing' || game.state === 'paused' || game.state === 'over') startGame();
      },
      onConfirm: function () { primaryAction(); }
    });

    function toggleMute() {
      const muted = audio.toggleMuted();
      ui.btnMute.textContent = muted ? '🔇' : '🔊';
    }
    ui.btnMute.textContent = audio.muted ? '🔇' : '🔊';

    // ---------- Кнопки ----------

    $('btn-play').addEventListener('click', function () { audio.play('click'); startGame(); });
    $('btn-resume').addEventListener('click', resumeGame);
    $('btn-restart').addEventListener('click', startGame);
    $('btn-restart-pause').addEventListener('click', startGame);
    $('btn-menu').addEventListener('click', function () { audio.play('click'); showMenu(); });
    $('btn-menu2').addEventListener('click', function () { audio.play('click'); showMenu(); });
    $('btn-pause').addEventListener('click', pauseGame);
    ui.btnMute.addEventListener('click', toggleMute);

    // ---------- HUD ----------

    let lastScore = -1, lastCoins = -1, lastBest = -1, lastDist = -1;
    let chipKey = '', chipBars = {};

    const CHIP_DEFS = {
      magnet: { icon: '🧲', cls: 'magnet', max: C.MAGNET_TIME },
      shield: { icon: '🛡️', cls: 'shield', max: 1 },
      x2: { icon: '×2', cls: 'x2', max: C.X2_TIME }
    };

    function activeEffects() {
      const out = [];
      if (game.effects.magnet > 0) out.push({ k: 'magnet', t: game.effects.magnet });
      if (game.effects.shield) out.push({ k: 'shield', t: 1 });
      if (game.effects.x2 > 0) out.push({ k: 'x2', t: game.effects.x2 });
      return out;
    }

    function updatePowerups() {
      const act = activeEffects();
      const key = act.map(function (a) { return a.k; }).join(',');
      if (key !== chipKey) {
        chipKey = key;
        chipBars = {};
        ui.powerups.innerHTML = '';
        for (const a of act) {
          const def = CHIP_DEFS[a.k];
          const el = document.createElement('div');
          el.className = 'chip powerup ' + def.cls;
          el.innerHTML = '<span class="icon">' + def.icon + '</span>' +
            '<i class="bar"><b></b></i>';
          ui.powerups.appendChild(el);
          chipBars[a.k] = el.querySelector('b');
        }
      }
      for (const a of act) {
        const bar = chipBars[a.k];
        if (bar) {
          const def = CHIP_DEFS[a.k];
          bar.style.width = Math.round(U.clamp01(a.t / def.max) * 100) + '%';
        }
      }
    }

    function updateHud() {
      const sc = Math.floor(game.score);
      if (sc !== lastScore) { ui.score.textContent = U.fmt(sc); lastScore = sc; }
      if (game.coins !== lastCoins) { ui.coins.textContent = U.fmt(game.coins); lastCoins = game.coins; }
      if (game.best !== lastBest) { ui.best.textContent = U.fmt(game.best); lastBest = game.best; }
      const dm = Math.floor(game.distance);
      if (dm !== lastDist) { ui.dist.textContent = U.fmt(dm) + ' м'; lastDist = dm; }
      updatePowerups();
    }

    // ---------- Цикл ----------

    let last = performance.now();
    function frame(now) {
      const dt = (now - last) / 1000;
      last = now;
      game.update(dt);
      renderer.draw();
      if (game.state !== 'menu') updateHud();
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', function () { renderer.resize(); });
    window.addEventListener('visibilitychange', function () {
      if (document.hidden) { pauseGame(); last = performance.now(); }
    });
    window.addEventListener('blur', function () { pauseGame(); });

    showMenu();
    requestAnimationFrame(frame);

    // Отладочный доступ (консоль/тесты): RG.instance.game, .renderer, .audio
    RG.instance = { game: game, renderer: renderer, audio: audio };
  });
})();
