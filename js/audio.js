// Простой синтезатор звуков на WebAudio — без внешних файлов.
window.RG = window.RG || {};

RG.AudioSystem = (function () {
  const U = RG.util;

  function AudioSystem() {
    this.ctx = null;
    this.muted = !!U.storage.get(RG.CONFIG.STORAGE_KEY_MUTED, false);
  }

  AudioSystem.prototype.ensure = function () {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* звук недоступен — не критично */ }
  };

  AudioSystem.prototype.setMuted = function (m) {
    this.muted = !!m;
    U.storage.set(RG.CONFIG.STORAGE_KEY_MUTED, this.muted);
  };

  AudioSystem.prototype.toggleMuted = function () {
    this.setMuted(!this.muted);
    if (!this.muted) this.ensure();
    return this.muted;
  };

  AudioSystem.prototype.tone = function (opt) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opt.delay || 0);
    const dur = opt.dur || 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.freq, t0);
    if (opt.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opt.slideTo), t0 + dur);
    const vol = opt.gain === undefined ? 0.14 : opt.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  AudioSystem.prototype.noise = function (opt) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opt.delay || 0);
    const dur = opt.dur || 0.2;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = opt.filter || 'lowpass';
    filter.frequency.setValueAtTime(opt.from || 800, t0);
    if (opt.to) filter.frequency.exponentialRampToValueAtTime(Math.max(10, opt.to), t0 + dur);
    const gain = ctx.createGain();
    const vol = opt.gain === undefined ? 0.2 : opt.gain;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  AudioSystem.prototype.play = function (name) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    switch (name) {
      case 'coin':
        this.tone({ freq: 1180, dur: 0.07, type: 'square', gain: 0.06 });
        this.tone({ freq: 1760, dur: 0.09, type: 'square', gain: 0.05, delay: 0.055 });
        break;
      case 'jump':
        this.tone({ freq: 320, slideTo: 640, dur: 0.16, type: 'sine', gain: 0.12 });
        break;
      case 'land':
        this.noise({ dur: 0.08, from: 500, to: 120, gain: 0.1 });
        break;
      case 'slide':
        this.noise({ dur: 0.22, from: 1400, to: 250, gain: 0.14 });
        break;
      case 'power':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.1, type: 'triangle', gain: 0.1, delay: i * 0.06 }));
        break;
      case 'shield':
        this.tone({ freq: 900, slideTo: 200, dur: 0.35, type: 'sawtooth', gain: 0.1 });
        this.noise({ dur: 0.25, from: 2200, to: 300, gain: 0.14 });
        break;
      case 'crash':
        this.noise({ dur: 0.45, from: 1600, to: 90, gain: 0.32 });
        this.tone({ freq: 220, slideTo: 55, dur: 0.5, type: 'sawtooth', gain: 0.18 });
        break;
      case 'click':
        this.tone({ freq: 620, dur: 0.06, type: 'triangle', gain: 0.09 });
        break;
      case 'over':
        [660, 523, 392, 262].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.12, delay: i * 0.16 }));
        break;
    }
  };

  return AudioSystem;
})();
