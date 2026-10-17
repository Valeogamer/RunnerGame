// Мелкие утилиты: математика, случайности, формат, localStorage.
window.RG = window.RG || {};

RG.util = (function () {
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clamp01(v) { return clamp(v, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Экспоненциальное сглаживание, независимое от FPS.
  function lerpExp(cur, target, rate, dt) {
    return target + (cur - target) * Math.exp(-rate * dt);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function chance(p) { return Math.random() < p; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function weightedPick(obj) {
    let total = 0;
    for (const k in obj) total += Math.max(0, obj[k]);
    let r = Math.random() * total;
    for (const k in obj) {
      r -= Math.max(0, obj[k]);
      if (r <= 0) return k;
    }
    return Object.keys(obj)[0];
  }
  // 1234567 -> "1 234 567"
  function fmt(n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  // Смешивание цветов: rgb-массивы [r,g,b] -> 'rgb(...)' с прозрачностью.
  function mix(a, b, t) {
    t = clamp01(t);
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }
  function rgb(c, alpha) {
    if (alpha === undefined || alpha === 1) return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  }
  const storage = {
    get(key, def) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
    }
  };
  function seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  return {
    clamp: clamp, clamp01: clamp01, lerp: lerp, lerpExp: lerpExp,
    rand: rand, randInt: randInt, chance: chance, pick: pick, shuffle: shuffle,
    smoothstep: smoothstep, weightedPick: weightedPick, fmt: fmt,
    mix: mix, rgb: rgb, storage: storage, seededRandom: seededRandom
  };
})();
