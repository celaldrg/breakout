import { clampPaddleX } from './physics.js';

/** Power-up kinds, in a fixed order. */
export const POWER_UP_TYPES = Object.freeze(['wide', 'multi', 'slow', 'life']);

/** Relative drop weights: extra lives are the rarest. */
const WEIGHTS = Object.freeze({ wide: 3, multi: 3, slow: 2.5, life: 1.5 });

/** Timed effects and how long each lasts (config key). */
const TIMED = Object.freeze({ wide: 'wideDuration', slow: 'slowDuration' });

/**
 * Picks a power-up kind using the weighted table.
 * @param {() => number} rng seeded random source
 * @returns {'wide'|'multi'|'slow'|'life'}
 */
export function pickPowerUp(rng) {
  const total = POWER_UP_TYPES.reduce((sum, type) => sum + WEIGHTS[type], 0);
  let roll = rng() * total;
  for (const type of POWER_UP_TYPES) {
    roll -= WEIGHTS[type];
    if (roll < 0) return type;
  }
  return POWER_UP_TYPES[POWER_UP_TYPES.length - 1];
}

/**
 * Creates a falling power-up capsule centred on (x, y).
 * @param {string} type one of POWER_UP_TYPES
 * @param {number} x
 * @param {number} y
 * @param {typeof import('./config.js').DEFAULT_CONFIG} config
 * @returns {{type: string, x: number, y: number, w: number, h: number, vy: number}}
 */
export function createPowerUp(type, x, y, config) {
  return { type, x, y, w: config.powerUpWidth, h: config.powerUpHeight, vy: config.powerUpSpeed };
}

/**
 * Moves falling power-ups, applies the ones the paddle catches and drops the
 * ones that left the field. Emits a `powerup` event per catch.
 * @param {import('./engine.js').GameState} state
 * @param {number} dt seconds
 */
export function updatePowerUps(state, dt) {
  const kept = [];
  for (const item of state.powerUps) {
    item.y += item.vy * dt;
    if (touchesPaddle(item, state.paddle)) {
      applyPowerUp(state, item.type);
      state.events.push({ type: 'powerup', powerUp: item.type, x: item.x, y: item.y });
    } else if (item.y - item.h / 2 <= state.config.height) {
      kept.push(item);
    }
  }
  state.powerUps = kept;
}

/**
 * Box overlap between a centred capsule and the paddle (centre x, top y).
 * @param {{x: number, y: number, w: number, h: number}} item
 * @param {{x: number, y: number, w: number, h: number}} paddle
 * @returns {boolean}
 */
function touchesPaddle(item, paddle) {
  return (
    Math.abs(item.x - paddle.x) < (item.w + paddle.w) / 2 &&
    item.y + item.h / 2 > paddle.y &&
    item.y - item.h / 2 < paddle.y + paddle.h
  );
}

/**
 * Applies a power-up immediately. Wide paddle and Slow ball are timed (a
 * second pickup refreshes the timer); Multi-ball clones the first ball in
 * flight into two more; Extra life adds a life up to the cap.
 * @param {import('./engine.js').GameState} state
 * @param {string} type one of POWER_UP_TYPES
 */
export function applyPowerUp(state, type) {
  const { config, paddle } = state;
  switch (type) {
    case 'wide':
      state.effects.wide = config.wideDuration;
      paddle.w = paddle.baseW * config.wideFactor;
      paddle.x = clampPaddleX(paddle.x, paddle.w, config.width);
      break;
    case 'slow':
      state.effects.slow = config.slowDuration;
      break;
    case 'multi':
      addMultiBalls(state);
      break;
    case 'life':
      state.lives = Math.min(state.lives + 1, config.maxLives);
      break;
    default:
      throw new RangeError(`Unknown power-up: ${type}`);
  }
}

/**
 * Adds two balls rotated left and right of the first ball in flight,
 * respecting the ball cap. Does nothing while the ball waits on the paddle.
 * @param {import('./engine.js').GameState} state
 */
function addMultiBalls(state) {
  const { config } = state;
  const source = state.balls.find((ball) => !ball.stuck);
  if (!source) return;
  for (const angle of [-config.multiSpread, config.multiSpread]) {
    if (state.balls.length >= config.maxBalls) return;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    state.balls.push({
      ...source,
      vx: source.vx * cos - source.vy * sin,
      vy: source.vx * sin + source.vy * cos,
    });
  }
}

/**
 * Counts down timed effects. When one runs out it is undone (the paddle
 * shrinks back) and an `expire` event is emitted.
 * @param {import('./engine.js').GameState} state
 * @param {number} dt seconds
 */
export function tickEffects(state, dt) {
  const { effects, paddle, config } = state;
  for (const effect of Object.keys(TIMED)) {
    if (effects[effect] <= 0) continue;
    effects[effect] = Math.max(0, effects[effect] - dt);
    if (effects[effect] > 0) continue;
    if (effect === 'wide') {
      paddle.w = paddle.baseW;
      paddle.x = clampPaddleX(paddle.x, paddle.w, config.width);
    }
    state.events.push({ type: 'expire', effect });
  }
}
