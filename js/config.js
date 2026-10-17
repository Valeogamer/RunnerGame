// Игровые константы и настройки баланса.
window.RG = window.RG || {};

RG.CONFIG = {
  // Полосы (мировые координаты по X)
  LANES: [-2.2, 0, 2.2],
  LANE_W: 2.2,

  // Камера
  PLAYER_Z: 6,          // игрок всегда на этой глубине перед камерой
  SPAWN_Z: 78,          // на какой глубине спавнятся препятствия
  CAM_Y: 2.0,           // высота камеры
  HORIZON: 0.38,        // доля высоты экрана, где линия горизонта
  FOV: 0.8,             // фокусное = height * FOV

  // Скорость и сложность
  SPEED_MIN: 11,
  SPEED_MAX: 28,
  SPEED_RAMP: 2200,     // дистанция (м), за которую сложность доходит до максимума
  GAP_TIME_MIN: 0.80,   // сек между рядами на макс. сложности
  GAP_TIME_MAX: 1.35,   // сек между рядами в начале

  // Игрок
  GRAVITY: 26,
  JUMP_V: 7.6,
  SLIDE_TIME: 0.55,
  PLAYER_HW: 0.32,
  PLAYER_H: 1.45,
  PLAYER_H_SLIDE: 0.62,

  // Монеты / бонусы
  COIN_VALUE: 10,
  MAGNET_TIME: 8,
  MAGNET_RADIUS: 4.2,
  X2_TIME: 10,

  STORAGE_KEY_BEST: 'rg.best',
  STORAGE_KEY_MUTED: 'rg.muted'
};
