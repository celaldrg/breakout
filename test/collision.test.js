import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circleRectHit, reflect } from '../src/physics.js';
import { ballSpeed, createBall, createGame, drainEvents, update } from '../src/engine.js';

const FRAME = 1 / 60;

/**
 * A game in play on a custom single-level layout, with power-up drops
 * removed so only the collision under test happens.
 */
function playing(layout) {
  const state = createGame({ seed: 1, levels: [layout] });
  for (const brick of state.bricks) brick.drop = null;
  state.status = 'playing';
  return state;
}

function brickAt(state, row, col) {
  return state.bricks.find((b) => b.row === row && b.col === col);
}

test('circleRectHit: apart, face and corner contacts', () => {
  const rect = { x: 10, y: 10, w: 40, h: 20 };
  assert.equal(circleRectHit(30, 50, 5, rect), null);
  assert.equal(circleRectHit(30, 35, 5, rect), null, 'touching exactly is not a hit');

  const below = circleRectHit(30, 33, 5, rect);
  assert.deepEqual([below.nx, below.ny], [0, 1]);
  assert.ok(Math.abs(below.depth - 2) < 1e-9);

  const left = circleRectHit(7, 20, 5, rect);
  assert.deepEqual([left.nx, left.ny], [-1, 0]);

  const corner = circleRectHit(7, 33, 5, rect);
  assert.ok(corner.nx < 0 && corner.ny > 0);
  assert.ok(Math.abs(Math.hypot(corner.nx, corner.ny) - 1) < 1e-9);
});

test('reflect flips only the component along the normal', () => {
  assert.deepEqual(reflect(3, -4, 0, 1), { vx: 3, vy: 4 });
  assert.deepEqual(reflect(3, -4, -1, 0), { vx: -3, vy: -4 });
  assert.deepEqual(reflect(3, 4, 0, 1), { vx: 3, vy: 4 }, 'moving away: unchanged');
  const d = Math.SQRT1_2;
  const corner = reflect(d, -d, -d, d);
  assert.ok(Math.abs(corner.vx + d) < 1e-9 && Math.abs(corner.vy - d) < 1e-9);
});

test('DONE: a ball hitting a brick from below flips vy, destroys it and scores', () => {
  const state = playing(['1.........', '....1.....']);
  const brick = brickAt(state, 1, 4);
  const speed = ballSpeed(state);
  state.balls = [createBall(state.config, brick.x + brick.w / 2, brick.y + brick.h + 9, 0, -speed)];

  update(state, FRAME);

  const [ball] = state.balls;
  assert.ok(ball.vy > 0, 'vy flipped to downwards');
  assert.ok(Math.abs(ball.vx) < 1e-9, 'vx untouched');
  assert.ok(ball.y - ball.r >= brick.y + brick.h - 1e-9, 'ball pushed out below the brick');
  assert.equal(brick.alive, false);
  assert.equal(brick.hits, 0);
  assert.equal(state.score, 10);
  const events = drainEvents(state).filter((e) => e.type === 'brick');
  assert.deepEqual(events.map((e) => e.destroyed), [true]);
});

test('DONE: a ball hitting a brick from the side flips vx and keeps vy', () => {
  const state = playing(['1.........', '....1.....']);
  const brick = brickAt(state, 1, 4);
  const speed = ballSpeed(state);
  const vx = speed * Math.cos(Math.PI / 6);
  const vy = -speed * Math.sin(Math.PI / 6);
  state.balls = [createBall(state.config, brick.x - 9, brick.y + brick.h / 2, vx, vy)];

  update(state, FRAME);

  const [ball] = state.balls;
  assert.ok(ball.vx < 0, 'vx flipped to the left');
  assert.ok(Math.abs(ball.vy - vy) < 1e-6, 'vy unchanged');
  assert.ok(ball.x + ball.r <= brick.x + 1e-9, 'ball pushed out to the left');
  assert.equal(brick.alive, false);
  assert.equal(state.score, 10);
});

test('DONE: a strong brick loses one hit per contact and scores when it breaks', () => {
  const state = playing(['1.........', '....2.....']);
  const brick = brickAt(state, 1, 4);
  const shoot = () => {
    state.balls = [createBall(state.config, brick.x + brick.w / 2, brick.y + brick.h + 9, 0, -1)];
    update(state, FRAME);
  };

  shoot();
  assert.equal(brick.hits, 1);
  assert.equal(brick.alive, true);
  assert.equal(state.score, 0);
  assert.ok(state.balls[0].vy > 0);

  shoot();
  assert.equal(brick.hits, 0);
  assert.equal(brick.alive, false);
  assert.equal(state.score, 20);
});

test('an unbreakable brick bounces the ball and never breaks', () => {
  const state = playing(['1.........', '....#.....']);
  const brick = brickAt(state, 1, 4);
  for (let i = 0; i < 3; i += 1) {
    state.balls = [createBall(state.config, brick.x + brick.w / 2, brick.y + brick.h + 9, 0, -1)];
    update(state, FRAME);
    assert.ok(state.balls[0].vy > 0);
  }
  assert.equal(brick.alive, true);
  assert.equal(state.score, 0);
});

test('a corner hit reverses both components', () => {
  const state = playing(['1.........', '....1.....']);
  const brick = brickAt(state, 1, 4);
  const speed = ballSpeed(state);
  const d = speed * Math.SQRT1_2;
  state.balls = [createBall(state.config, brick.x - 6, brick.y + brick.h + 6, d, -d)];

  update(state, FRAME);

  const [ball] = state.balls;
  assert.ok(ball.vx < 0 && ball.vy > 0, `got vx=${ball.vx}, vy=${ball.vy}`);
  assert.equal(brick.alive, false);
});

test('a ball hitting the seam between two bricks bounces once and breaks one brick', () => {
  const state = playing(['1.........', '....11....']);
  const left = brickAt(state, 1, 4);
  const seamX = left.x + left.w + state.config.brickGap / 2;
  state.balls = [createBall(state.config, seamX, left.y + left.h + 9, 0, -1)];

  update(state, FRAME);
  update(state, FRAME);

  assert.ok(state.balls[0].vy > 0);
  const broken = state.bricks.filter((b) => b.row === 1 && !b.alive);
  assert.equal(broken.length, 1);
});
