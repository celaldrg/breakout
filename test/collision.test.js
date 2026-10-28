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

/**
 * Runs one update() that is a single sub-step: the ball travels a quarter
 * radius (update() only splits moves longer than half a radius) at `angle`
 * radians above the +x axis and ends with its centre at `end`.
 * @returns {object} the ball right after that sub-step
 */
function subStepTo(state, end, angle) {
  const speed = ballSpeed(state);
  const travel = state.config.ballRadius / 4;
  const ux = Math.cos(angle);
  const uy = -Math.sin(angle);
  state.balls = [createBall(state.config, end.x - ux * travel, end.y - uy * travel, ux * speed, uy * speed)];
  update(state, travel / speed);
  return state.balls[0];
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
  assert.ok(ball.y - ball.r >= brick.y + brick.h - 1e-9, 'ball ends the frame below the brick');
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
  assert.ok(ball.x + ball.r <= brick.x + 1e-9, 'ball ends the frame left of the brick');
  assert.equal(brick.alive, false);
  assert.equal(state.score, 10);
});

// The sub-step below ends 1 unit deep inside the brick and nothing moves the
// ball afterwards, so only the push-out can put it back on the face it hit.
test('push-out: right after a hit from below the ball touches the bottom face', () => {
  const state = playing(['1.........', '....1.....']);
  const brick = brickAt(state, 1, 4);
  const bottom = brick.y + brick.h;
  const ball = subStepTo(state, { x: brick.x + brick.w / 2, y: bottom + state.config.ballRadius - 1 }, Math.PI / 2);

  assert.ok(Math.abs(ball.y - ball.r - bottom) < 1e-9, `ball top at ${ball.y - ball.r}, face at ${bottom}`);
  assert.ok(ball.vy > 0);
  assert.equal(brick.alive, false);
});

test('push-out: right after a hit from the side the ball touches the left face', () => {
  const state = playing(['1.........', '....1.....']);
  const brick = brickAt(state, 1, 4);
  const ball = subStepTo(state, { x: brick.x - state.config.ballRadius + 1, y: brick.y + brick.h / 2 }, Math.PI / 6);

  assert.ok(Math.abs(ball.x + ball.r - brick.x) < 1e-9, `ball right edge at ${ball.x + ball.r}, face at ${brick.x}`);
  assert.ok(ball.vx < 0);
  assert.equal(brick.alive, false);
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

// A ball can still overlap a brick it is already leaving (just after a bounce
// or a push-out). Only contacts it moves into count, so such an overlap must
// neither damage the brick nor bend the ball's path.
test('a ball overlapping a brick while moving away from it does not hit it', () => {
  const cases = [
    { name: 'below, moving down', at: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h + 2 }), angle: -Math.PI / 2 },
    { name: 'left, moving up-left', at: (b) => ({ x: b.x - 2, y: b.y + b.h / 2 }), angle: (5 * Math.PI) / 6 },
    { name: 'corner, moving down-left', at: (b) => ({ x: b.x - 2, y: b.y + b.h + 2 }), angle: (-3 * Math.PI) / 4 },
  ];
  for (const { name, at, angle } of cases) {
    const state = playing(['1.........', '....2.....']);
    const brick = brickAt(state, 1, 4);
    const speed = ballSpeed(state);
    const start = at(brick);
    const vx = speed * Math.cos(angle);
    const vy = -speed * Math.sin(angle);
    state.balls = [createBall(state.config, start.x, start.y, vx, vy)];
    assert.ok(circleRectHit(start.x, start.y, state.config.ballRadius, brick), `${name}: starts overlapping`);

    update(state, FRAME);

    const [ball] = state.balls;
    assert.equal(brick.hits, 2, `${name}: brick not damaged`);
    assert.equal(brick.alive, true, name);
    assert.equal(state.score, 0, name);
    assert.ok(Math.abs(ball.vx - vx) < 1e-9 && Math.abs(ball.vy - vy) < 1e-9, `${name}: velocity unchanged`);
    assert.deepEqual(drainEvents(state).filter((e) => e.type === 'brick'), [], name);
  }
});
