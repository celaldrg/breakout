import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import {
  POWER_UP_TYPES,
  applyPowerUp,
  createPowerUp,
  pickPowerUp,
  tickEffects,
  updatePowerUps,
} from '../src/powerups.js';
import { ballSpeed, createBall, createGame, drainEvents, update } from '../src/engine.js';

const FRAME = 1 / 60;

/** A game in play with one ball flying upwards in the middle of the field. */
function playing() {
  const state = createGame({ seed: 1, levels: [['1.........']] });
  state.status = 'playing';
  state.balls = [createBall(state.config, 240, 400, 0, -ballSpeed(state))];
  return state;
}

test('pickPowerUp is deterministic and can return every kind', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) {
    const kind = pickPowerUp(a);
    assert.equal(kind, pickPowerUp(b));
    seen.add(kind);
  }
  assert.deepEqual([...seen].sort(), [...POWER_UP_TYPES].sort());
});

test('Wide paddle widens the paddle, then expires', () => {
  const state = playing();
  const { paddle, config } = state;
  applyPowerUp(state, 'wide');
  assert.equal(paddle.w, paddle.baseW * config.wideFactor);
  assert.equal(state.effects.wide, config.wideDuration);

  tickEffects(state, config.wideDuration - 0.1);
  assert.equal(paddle.w, paddle.baseW * config.wideFactor, 'still active');

  tickEffects(state, 0.2);
  assert.equal(paddle.w, paddle.baseW);
  assert.equal(state.effects.wide, 0);
  assert.deepEqual(drainEvents(state), [{ type: 'expire', effect: 'wide' }]);
});

test('Wide paddle near a wall stays inside the field', () => {
  const state = playing();
  state.paddle.x = state.paddle.w / 2;
  applyPowerUp(state, 'wide');
  assert.equal(state.paddle.x, state.paddle.w / 2);
});

test('Slow ball slows every ball until it expires', () => {
  const state = playing();
  const { config } = state;
  const normal = ballSpeed(state);
  applyPowerUp(state, 'slow');
  assert.ok(Math.abs(ballSpeed(state) - normal * config.slowFactor) < 1e-9);

  update(state, FRAME);
  const [ball] = state.balls;
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - normal * config.slowFactor) < 1e-6);

  tickEffects(state, config.slowDuration);
  assert.equal(state.effects.slow, 0);
  assert.equal(ballSpeed(state), normal);
});

test('Multi-ball adds two balls in flight, up to the cap', () => {
  const state = playing();
  applyPowerUp(state, 'multi');
  assert.equal(state.balls.length, 3);
  assert.ok(state.balls.every((b) => !b.stuck));
  const directions = new Set(state.balls.map((b) => Math.atan2(b.vy, b.vx).toFixed(6)));
  assert.equal(directions.size, 3);

  for (let i = 0; i < 10; i += 1) applyPowerUp(state, 'multi');
  assert.equal(state.balls.length, state.config.maxBalls);
});

test('Multi-ball does nothing while the ball waits on the paddle', () => {
  const state = createGame({ seed: 1 });
  applyPowerUp(state, 'multi');
  assert.equal(state.balls.length, 1);
});

test('Extra life adds a life up to the cap', () => {
  const state = playing();
  applyPowerUp(state, 'life');
  assert.equal(state.lives, state.config.startLives + 1);
  for (let i = 0; i < 10; i += 1) applyPowerUp(state, 'life');
  assert.equal(state.lives, state.config.maxLives);
});

test('unknown power-ups are rejected', () => {
  assert.throws(() => applyPowerUp(playing(), 'teleport'), RangeError);
});

test('a falling capsule caught by the paddle applies its effect', () => {
  const state = playing();
  const { paddle, config } = state;
  state.powerUps = [createPowerUp('life', paddle.x, paddle.y - 10, config)];
  updatePowerUps(state, 0.05);
  assert.equal(state.powerUps.length, 0);
  assert.equal(state.lives, config.startLives + 1);
  const [event] = drainEvents(state);
  assert.equal(event.type, 'powerup');
  assert.equal(event.powerUp, 'life');
});

test('a missed capsule falls out of the field and is removed', () => {
  const state = playing();
  const { config } = state;
  state.powerUps = [createPowerUp('wide', 20, config.height - 2, config)];
  updatePowerUps(state, 0.05);
  assert.equal(state.powerUps.length, 1, 'still partly visible');
  updatePowerUps(state, 0.2);
  assert.equal(state.powerUps.length, 0);
  assert.equal(state.effects.wide, 0);
});

test('breaking a brick that carries a power-up drops it', () => {
  const state = createGame({ seed: 1, levels: [['1.........', '....1.....']] });
  state.status = 'playing';
  const brick = state.bricks.find((b) => b.col === 4);
  brick.drop = 'slow';
  state.balls = [createBall(state.config, brick.x + brick.w / 2, brick.y + brick.h + 9, 0, -1)];
  update(state, FRAME);
  assert.equal(brick.alive, false);
  assert.equal(state.powerUps.length, 1);
  assert.equal(state.powerUps[0].type, 'slow');
  assert.ok(Math.abs(state.powerUps[0].x - (brick.x + brick.w / 2)) < 1e-9);
});

test('seeded levels assign the same drops for the same seed', () => {
  const drops = (seed) => createGame({ seed }).bricks.map((b) => b.drop);
  assert.deepEqual(drops(7), drops(7));
  assert.ok(drops(7).some(Boolean), 'some bricks carry a power-up');
  assert.ok(drops(7).some((d) => d === null), 'not every brick does');
});
