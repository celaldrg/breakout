import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ballSpeed,
  createBall,
  createGame,
  drainEvents,
  launch,
  nextLevel,
  setPaused,
  togglePause,
  update,
} from '../src/engine.js';
import { applyPowerUp } from '../src/powerups.js';
import { LEVELS, buildBricks } from '../src/levels.js';
import { createRng } from '../src/rng.js';

const FRAME = 1 / 60;

/** Places a ball below the field so the next update loses it. */
function dropBall(state) {
  return createBall(state.config, 100, state.config.height + 20, 0, 300);
}

/** Leaves only `keep` alive among breakable bricks, then hits it from below. */
function breakLastBrick(state) {
  const breakable = state.bricks.filter((b) => b.kind !== 'unbreakable');
  const keep = breakable.find((b) => b.kind === 'normal');
  for (const brick of breakable) {
    if (brick !== keep) brick.alive = false;
  }
  keep.drop = null;
  state.status = 'playing';
  state.balls = [createBall(state.config, keep.x + keep.w / 2, keep.y + keep.h + 9, 0, -1)];
  update(state, FRAME);
}

test('a new game waits on level 1 with 3 lives and the ball on the paddle', () => {
  const state = createGame({ seed: 9 });
  assert.equal(state.status, 'serve');
  assert.equal(state.levelIndex, 0);
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.balls.length, 1);
  assert.equal(state.balls[0].stuck, true);
  assert.equal(state.bricks.length, buildBricks(LEVELS[0], state.config, createRng(9)).length);

  const before = { ...state.balls[0] };
  update(state, FRAME);
  assert.deepEqual(state.balls[0], before, 'nothing moves before launch');
});

test('launch sends the ball upwards once', () => {
  const state = createGame({ seed: 9 });
  assert.equal(launch(state), true);
  assert.equal(state.status, 'playing');
  const [ball] = state.balls;
  assert.equal(ball.stuck, false);
  assert.ok(ball.vy < 0);
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - ballSpeed(state)) < 1e-9);
  assert.equal(launch(state), false);
});

test('pause freezes the simulation', () => {
  const state = createGame({ seed: 9 });
  launch(state);
  assert.equal(togglePause(state), true);
  const before = { ...state.balls[0] };
  update(state, FRAME);
  assert.deepEqual(state.balls[0], before);
  assert.equal(launch(state), false);
  assert.equal(setPaused(state, false), false);
  update(state, FRAME);
  assert.notDeepEqual(state.balls[0], before);
});

test('balls bounce off the side and top walls', () => {
  const state = createGame({ seed: 9, levels: [['.........1']] });
  state.status = 'playing';
  const speed = ballSpeed(state);
  state.balls = [createBall(state.config, 8, 400, -speed * 0.8, -speed * 0.6)];
  update(state, FRAME);
  assert.ok(state.balls[0].vx > 0);
  state.balls = [createBall(state.config, 240, 8, speed * 0.6, -speed * 0.8)];
  update(state, FRAME);
  assert.ok(state.balls[0].vy > 0);
});

test('losing the last ball costs a life and serves again', () => {
  const state = createGame({ seed: 9 });
  launch(state);
  applyPowerUp(state, 'wide');
  state.balls = [dropBall(state)];
  update(state, FRAME);

  assert.equal(state.lives, 2);
  assert.equal(state.status, 'serve');
  assert.equal(state.balls.length, 1);
  assert.equal(state.balls[0].stuck, true);
  assert.equal(state.effects.wide, 0, 'effects cleared');
  assert.equal(state.paddle.w, state.paddle.baseW);
  assert.deepEqual(drainEvents(state).filter((e) => e.type === 'lifelost'), [{ type: 'lifelost', lives: 2 }]);
});

test('losing one of several balls costs nothing', () => {
  const state = createGame({ seed: 9 });
  launch(state);
  state.balls.push(dropBall(state));
  update(state, FRAME);
  assert.equal(state.lives, 3);
  assert.equal(state.balls.length, 1);
  assert.equal(state.status, 'playing');
});

test('losing the last ball on the last life ends the game', () => {
  const state = createGame({ seed: 9 });
  state.lives = 1;
  launch(state);
  state.balls = [dropBall(state)];
  update(state, FRAME);
  assert.equal(state.lives, 0);
  assert.equal(state.status, 'gameover');
  assert.equal(launch(state), false);
  assert.equal(setPaused(state, true), false, 'cannot pause a finished game');
  assert.ok(drainEvents(state).some((e) => e.type === 'gameover'));
});

test('clearing every breakable brick clears the level; nextLevel loads the next one', () => {
  const state = createGame({ seed: 9 });
  state.score = 500;
  breakLastBrick(state);
  assert.equal(state.status, 'levelclear');
  assert.ok(drainEvents(state).some((e) => e.type === 'levelclear' && e.level === 1));

  assert.equal(nextLevel(state), true);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.status, 'serve');
  assert.equal(state.score, 510, 'score kept');
  assert.equal(state.lives, 3, 'lives kept');
  assert.equal(state.speed, state.config.baseSpeed + state.config.speedPerLevel);
  assert.equal(state.bricks.length, LEVELS[1].join('').replace(/\./g, '').length);
  assert.equal(nextLevel(state), false, 'only after a level clear');
});

test('unbreakable bricks do not block a level clear', () => {
  const state = createGame({ seed: 9, levels: [['1#........'], ['1.........']] });
  breakLastBrick(state);
  assert.equal(state.status, 'levelclear');
  assert.equal(state.bricks.find((b) => b.kind === 'unbreakable').alive, true);
});

test('clearing level 3 wins the game', () => {
  const state = createGame({ seed: 9, level: 2 });
  breakLastBrick(state);
  assert.equal(state.status, 'won');
  assert.equal(nextLevel(state), false);
  assert.ok(drainEvents(state).some((e) => e.type === 'won' && e.level === 3));
});

test('the three hand-made levels are well formed', () => {
  assert.equal(LEVELS.length, 3);
  for (const [i, layout] of LEVELS.entries()) {
    for (const row of layout) assert.match(row, /^[.123#]{10}$/, `level ${i + 1}`);
    const bricks = buildBricks(layout, createGame().config, createRng(1));
    assert.ok(bricks.some((b) => b.kind === 'normal'), `level ${i + 1} has normal bricks`);
    assert.ok(bricks.some((b) => b.kind === 'strong'), `level ${i + 1} has strong bricks`);
  }
  const steel = (i) => LEVELS[i].join('').includes('#');
  assert.ok(steel(1) && steel(2), 'levels 2 and 3 have unbreakable bricks');
});
