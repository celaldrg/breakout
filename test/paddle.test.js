import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paddleBounce } from '../src/physics.js';
import { ballSpeed, createBall, createGame, movePaddleTo, nudgePaddle, update } from '../src/engine.js';

const FRAME = 1 / 60;

/** Angle from straight up, in degrees (positive = to the right). */
function angleOf(vx, vy) {
  return (Math.atan2(vx, -vy) * 180) / Math.PI;
}

test('paddleBounce: centre goes straight up, edges go out at 60 degrees', () => {
  const centre = paddleBounce(0, 300);
  assert.ok(Math.abs(centre.vx) < 1e-9);
  assert.equal(centre.vy, -300);

  const angleAt = (offset) => {
    const v = paddleBounce(offset, 300);
    return angleOf(v.vx, v.vy);
  };
  assert.ok(Math.abs(angleAt(1) - 60) < 1e-9);
  assert.ok(Math.abs(angleAt(-1) + 60) < 1e-9);
  assert.ok(Math.abs(angleAt(0.5) - 30) < 1e-9);
  assert.ok(Math.abs(angleAt(3) - 60) < 1e-9, 'clamped');

  const edge = paddleBounce(1, 300);
  assert.ok(Math.abs(Math.hypot(edge.vx, edge.vy) - 300) < 1e-9, 'speed kept');
});

/** Drops a ball onto the paddle at `offset` (-1..1) and returns its new angle. */
function bounceAt(offset) {
  const state = createGame({ seed: 1, levels: [['1.........']] });
  state.status = 'playing';
  const { paddle, config } = state;
  const x = paddle.x + (offset * paddle.w) / 2;
  state.balls = [createBall(config, x, paddle.y - config.ballRadius - 2, 0, ballSpeed(state))];
  update(state, FRAME);
  const [ball] = state.balls;
  assert.ok(ball.vy < 0, 'ball bounced upwards');
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - ballSpeed(state)) < 1e-6);
  return angleOf(ball.vx, ball.vy);
}

test('the engine bounces off the paddle by hit position', () => {
  assert.ok(Math.abs(bounceAt(0)) < 1e-6, 'centre -> straight up');
  assert.ok(Math.abs(bounceAt(1) - 60) < 0.5, 'right edge -> about +60');
  assert.ok(Math.abs(bounceAt(-1) + 60) < 0.5, 'left edge -> about -60');
  assert.ok(bounceAt(0.5) > 20 && bounceAt(0.5) < 40, 'half way -> about 30');
});

test('the paddle stays inside the field and carries the waiting ball', () => {
  const state = createGame({ seed: 1 });
  const { paddle, config } = state;
  movePaddleTo(state, -500);
  assert.equal(paddle.x, paddle.w / 2);
  assert.equal(state.balls[0].x, paddle.x, 'stuck ball follows');
  movePaddleTo(state, 10_000);
  assert.equal(paddle.x, config.width - paddle.w / 2);

  movePaddleTo(state, 200);
  nudgePaddle(state, 1, 0.1);
  assert.ok(Math.abs(paddle.x - (200 + config.paddleSpeed * config.maxDt)) < 1e-9, 'dt clamped');
  nudgePaddle(state, -1, 0.02);
  assert.ok(paddle.x < 200 + config.paddleSpeed * config.maxDt);
});
