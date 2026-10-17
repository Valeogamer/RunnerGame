// Управление: клавиатура + свайпы/тапы для тач-экранов.
window.RG = window.RG || {};

(function () {
  function InputManager(target, handlers) {
    this.target = target || document;
    this.h = handlers || {};
    this.swipeStart = null;
    this.bind();
  }

  InputManager.prototype.call = function (name, arg) {
    const fn = this.h[name];
    if (fn) fn(arg);
  };

  InputManager.prototype.bind = function () {
    const self = this;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      const code = e.code;
      let handled = true;
      switch (code) {
        case 'ArrowLeft': case 'KeyA': self.call('onLeft'); break;
        case 'ArrowRight': case 'KeyD': self.call('onRight'); break;
        case 'ArrowUp': case 'KeyW': case 'Space': self.call('onJump'); break;
        case 'ArrowDown': case 'KeyS': self.call('onSlide'); break;
        case 'KeyP': case 'Escape': self.call('onPause'); break;
        case 'KeyM': self.call('onMute'); break;
        case 'KeyR': self.call('onRestart'); break;
        case 'Enter': self.call('onConfirm'); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        self.call('onAny');
      }
    }, { passive: false });

    this.target.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      self.swipeStart = { x: e.clientX, y: e.clientY, t: performance.now() };
    });

    this.target.addEventListener('pointerup', function (e) {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      const st = self.swipeStart;
      self.swipeStart = null;
      if (!st) return;
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 26) {
        self.call('onTap');
        self.call('onAny');
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) self.call(dx > 0 ? 'onRight' : 'onLeft');
      else self.call(dy > 0 ? 'onSlide' : 'onJump');
      self.call('onAny');
    });

    // Свайп завершился за пределами канваса — не теряем жест.
    window.addEventListener('pointercancel', function () { self.swipeStart = null; });
  };

  RG.InputManager = InputManager;
})();
