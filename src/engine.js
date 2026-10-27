import { DEFAULT_CONFIG } from './config.js';
import { LEVELS, buildBricks } from './levels.js';
import { circleRectHit, clamp, clampPaddleX, paddleBounce, reflect, steer } from './physics.js';
import { createPowerUp, tickEffects, updatePowerUps } from './powerups.js';
import { createRng } from './rng.js';

/**
 * @typedef {{x: number, y: number, vx: number, vy: number, r: number, stuck: boolean}} Ball
 * @typedef {{x: number, y: number, w: number, h: number, row: number, col: number,
 *   kind: 'normal'|'strong'|'unbreakable', hits: number, maxHits: number, points: number,
 *   drop: string|null, alive: boolean}} Brick
 * @typedef {{x: number, y: number, w: number, h: number, baseW: number}} Paddle
 *   x is the centre, y the top edge.
 * @typedef {'serve'|'playing'|'levelclear'|'won'|'gameover'} Status
 * @typedef {{
 *   config: typeof DEFAULT_CONFIG, levels: readonly (readonly string[])[], rng: () => number,
 *   levelIndex: number, score: number, lives: number, status: Status, paused: boolean,
 *   speed: number, paddle: Paddle, balls: Ball[], bricks: Brick[],
 *   powerUps: ReturnType<typeof createPowerUp>[], effects: {wide: number, slow: number},
 *   events: object[]
 * }} GameState
 *
 * Events pushed to `state.events` (read them with drainEvents):
 *   {type:'brick', x, y, kind, row, destroyed}  {type:'paddle', x, y}
 *   {type:'powerup', powerUp, x, y}  {type:'expire', effect}  {type:'lifelost', lives}
 *   {type:'levelclear'|'won', level, score}  {type:'gameover', score}
 */

/**
 * Creates a new game, waiting for the first launch on level `opts.level`.
 * @param {{seed?: number, levels?: readonly (readonly string[])[], level?: number,
 *   config?: Partial<typeof DEFAULT_CONFIG>}} [opts]
 * @returns {GameState}
 */
export function createGame(opts = {}) {
  const config = Object.freeze({ ...DEFAULT_CONFIG, ...opts.config });
  const state = {
    config,
    levels: opts.levels ?? LEVELS,
    rng: createRng(opts.seed ?? 1),
    levelIndex: 0,
    score: 0,
    lives: config.startLives,
    status: 'serve',
    paused: false,
    speed: config.baseSpeed,
    paddle: {
      x: config.width / 2,
      y: config.height - config.paddleBottom,
      w: config.paddleWidth,
      h: config.paddleHeight,
      baseW: config.paddleWidth,
    },
    balls: [],
    bricks: [],
    powerUps: [],
    effects: { wide: 0, slow: 0 },
    events: [],
  };
  loadLevel(state, opts.level ?? 0);
  return state;
}

/**
 * Creates a ball in flight.
 * @param {typeof DEFAULT_CONFIG} config
 * @param {number} x
 * @param {number} y
 * @param {number} [vx=0]
 * @param {number} [vy=0]
 * @returns {Ball}
 */
export function createBall(config, x, y, vx = 0, vy = 0) {
  return { x, y, vx, vy, r: config.ballRadius, stuck: false };
}

/**
 * Current ball speed: the level speed (capped) times the Slow ball factor.
 * @param {GameState} state
 * @returns {number}
 */
export function ballSpeed(state) {
  const { config } = state;
  const base = Math.min(state.speed, config.maxSpeed);
  return state.effects.slow > 0 ? base * config.slowFactor : base;
}

/**
 * Launches the ball waiting on the paddle at a slightly random upward angle.
 * @param {GameState} state
 * @returns {boolean} true if the ball was launched
 */
export function launch(state) {
  if (state.paused || state.status !== 'serve') return false;
  const speed = ballSpeed(state);
  for (const ball of state.balls) {
    const degrees = (10 + state.rng() * 15) * (state.rng() < 0.5 ? -1 : 1);
    const angle = (degrees * Math.PI) / 180;
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    ball.stuck = false;
  }
  state.status = 'playing';
  return true;
}

/**
 * Moves the paddle centre to `x` (pointer / touch control), clamped to the
 * field. A ball waiting on the paddle moves with it.
 * @param {GameState} state
 * @param {number} x world x
 */
export function movePaddleTo(state, x) {
  if (state.paused || !isActive(state)) return;
  const { paddle, config } = state;
  paddle.x = clampPaddleX(x, paddle.w, config.width);
  for (const ball of state.balls) {
    if (ball.stuck) ball.x = paddle.x;
  }
}

/**
 * Moves the paddle by keyboard: `dir` -1 = left, 1 = right, for `dt` seconds.
 * @param {GameState} state
 * @param {number} dir
 * @param {number} dt seconds
 */
export function nudgePaddle(state, dir, dt) {
  const { config, paddle } = state;
  const step = clamp(dir, -1, 1) * config.paddleSpeed * clamp(dt, 0, config.maxDt);
  movePaddleTo(state, paddle.x + step);
}

/**
 * Pauses or resumes. Only a game in progress (serve or playing) can pause.
 * @param {GameState} state
 * @param {boolean} paused
 * @returns {boolean} the resulting paused flag
 */
export function setPaused(state, paused) {
  state.paused = Boolean(paused) && isActive(state);
  return state.paused;
}

/**
 * Toggles pause (P / Escape).
 * @param {GameState} state
 * @returns {boolean} the resulting paused flag
 */
export function togglePause(state) {
  return setPaused(state, !state.paused);
}

/**
 * Starts the next level after a level clear, keeping score and lives.
 * @param {GameState} state
 * @returns {boolean} true if a new level was loaded
 */
export function nextLevel(state) {
  if (state.status !== 'levelclear') return false;
  loadLevel(state, state.levelIndex + 1);
  return true;
}

/**
 * Returns and clears the events produced since the last call.
 * @param {GameState} state
 * @returns {object[]}
 */
export function drainEvents(state) {
  const events = state.events;
  state.events = [];
  return events;
}

/**
 * Advances the simulation by `dt` seconds (clamped to config.maxDt). Ball
 * movement is split into sub-steps of at most half a ball radius so even a
 * ball at max speed cannot pass through a brick between two checks.
 * @param {GameState} state
 * @param {number} dt seconds since the previous frame
 */
export function update(state, dt) {
  if (state.paused || state.status !== 'playing') return;
  const { config } = state;
  const step = clamp(dt, 0, config.maxDt);
  if (step === 0) return;
  tickEffects(state, step);
  const speed = ballSpeed(state);
  for (const ball of state.balls) {
    const v = steer(ball.vx, ball.vy, speed, config.minVerticalRatio);
    ball.vx = v.vx;
    ball.vy = v.vy;
  }
  const substeps = Math.max(1, Math.ceil((speed * step) / (config.ballRadius / 2)));
  for (let i = 0; i < substeps; i += 1) {
    moveBalls(state, step / substeps, speed);
    if (state.status !== 'playing') return;
  }
  updatePowerUps(state, step);
}

/**
 * @param {GameState} state
 * @returns {boolean} true while serving or playing
 */
function isActive(state) {
  return state.status === 'serve' || state.status === 'playing';
}

/**
 * @param {GameState} state
 * @param {number} index level index (0-based)
 */
function loadLevel(state, index) {
  const { config, paddle } = state;
  state.levelIndex = index;
  state.bricks = buildBricks(state.levels[index], config, state.rng);
  state.speed = config.baseSpeed + index * config.speedPerLevel;
  paddle.x = config.width / 2;
  resetServe(state);
}

/**
 * Clears effects and falling power-ups and puts one ball on the paddle.
 * @param {GameState} state
 */
function resetServe(state) {
  const { config, paddle } = state;
  state.effects = { wide: 0, slow: 0 };
  state.powerUps = [];
  paddle.w = paddle.baseW;
  paddle.x = clampPaddleX(paddle.x, paddle.w, config.width);
  const ball = createBall(config, paddle.x, paddle.y - config.ballRadius - 1);
  ball.stuck = true;
  state.balls = [ball];
  state.status = 'serve';
}

/**
 * One sub-step: move every ball, resolve collisions, remove lost balls.
 * @param {GameState} state
 * @param {number} h sub-step length in seconds
 * @param {number} speed current ball speed
 */
function moveBalls(state, h, speed) {
  for (const ball of state.balls) {
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    collideWalls(ball, state.config.width);
    collidePaddle(state, ball, speed);
    collideBricks(state, ball, speed);
    if (state.status !== 'playing') return;
  }
  state.balls = state.balls.filter((ball) => ball.y - ball.r <= state.config.height);
  if (state.balls.length === 0) loseLife(state);
}

/**
 * Bounces off the left, right and top walls (the bottom is open).
 * @param {Ball} ball
 * @param {number} width field width
 */
function collideWalls(ball, width) {
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.r > width) {
    ball.x = width - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  }
}

/**
 * Bounces a falling ball off the paddle; the angle depends on where it hit.
 * @param {GameState} state
 * @param {Ball} ball
 * @param {number} speed
 */
function collidePaddle(state, ball, speed) {
  const { paddle, config } = state;
  if (ball.vy <= 0 || ball.y > paddle.y + paddle.h) return;
  const rect = { x: paddle.x - paddle.w / 2, y: paddle.y, w: paddle.w, h: paddle.h };
  if (!circleRectHit(ball.x, ball.y, ball.r, rect)) return;
  const offset = (ball.x - paddle.x) / (paddle.w / 2);
  const v = paddleBounce(offset, speed, config.maxBounceAngle);
  ball.vx = v.vx;
  ball.vy = v.vy;
  ball.y = paddle.y - ball.r;
  state.events.push({ type: 'paddle', x: ball.x, y: paddle.y });
}

/**
 * Resolves the deepest brick contact the ball is moving into: push the ball
 * out, reflect it on the correct axis (side -> vx, top/bottom -> vy, corner
 * -> along the diagonal) and damage that brick. One brick per sub-step, so a
 * ball hitting the seam between two bricks bounces once instead of twice.
 * @param {GameState} state
 * @param {Ball} ball
 * @param {number} speed
 */
function collideBricks(state, ball, speed) {
  let target = null;
  let contact = null;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const hit = circleRectHit(ball.x, ball.y, ball.r, brick);
    if (!hit || ball.vx * hit.nx + ball.vy * hit.ny >= 0) continue;
    if (!contact || hit.depth > contact.depth) {
      contact = hit;
      target = brick;
    }
  }
  if (!target) return;
  ball.x += contact.nx * contact.depth;
  ball.y += contact.ny * contact.depth;
  const r = reflect(ball.vx, ball.vy, contact.nx, contact.ny);
  const v = steer(r.vx, r.vy, speed, state.config.minVerticalRatio, contact.ny < 0 ? -1 : 1);
  ball.vx = v.vx;
  ball.vy = v.vy;
  hitBrick(state, target);
}

/**
 * Damages a brick: scores, drops its power-up and checks for a level clear
 * when it breaks. Unbreakable bricks only bounce the ball.
 * @param {GameState} state
 * @param {Brick} brick
 */
function hitBrick(state, brick) {
  if (brick.kind === 'unbreakable') return;
  const { config } = state;
  const x = brick.x + brick.w / 2;
  const y = brick.y + brick.h / 2;
  brick.hits -= 1;
  state.speed = Math.min(state.speed + config.speedUpPerHit, config.maxSpeed);
  const destroyed = brick.hits <= 0;
  state.events.push({ type: 'brick', x, y, kind: brick.kind, row: brick.row, destroyed });
  if (!destroyed) return;
  brick.alive = false;
  state.score += brick.points;
  if (brick.drop) state.powerUps.push(createPowerUp(brick.drop, x, y, config));
  if (!state.bricks.some((b) => b.alive && b.kind !== 'unbreakable')) clearLevel(state);
}

/**
 * All breakable bricks are gone: level clear, or a win after the last level.
 * @param {GameState} state
 */
function clearLevel(state) {
  const last = state.levelIndex >= state.levels.length - 1;
  state.status = last ? 'won' : 'levelclear';
  state.powerUps = [];
  state.events.push({ type: state.status, level: state.levelIndex + 1, score: state.score });
}

/**
 * The last ball fell out: lose a life, then serve again or end the game.
 * @param {GameState} state
 */
function loseLife(state) {
  state.lives -= 1;
  state.events.push({ type: 'lifelost', lives: state.lives });
  if (state.lives > 0) {
    resetServe(state);
    return;
  }
  state.status = 'gameover';
  state.powerUps = [];
  state.events.push({ type: 'gameover', score: state.score });
}
