import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballSpeed, createBall, createGame, update } from '../src/engine.js';

/**
 * Fires a ball at max speed, with the longest allowed frame, at a full row
 * of very thin bricks (4 units tall: a 32-unit frame step would jump over it
 * without sub-stepping) from many starting phases and angles.
 */
test('a ball at max speed never tunnels through a one-brick-thick row', () => {
  for (const degrees of [0, 25, -25]) {
    for (let phase = 0; phase < 32; phase += 1) {
      const state = createGame({ seed: 3, levels: [['1111111111']], config: { brickHeight: 4 } });
      const { config } = state;
      state.status = 'playing';
      state.speed = config.maxSpeed;
      const row = state.bricks[4];
      const angle = (degrees * Math.PI) / 180;
      const x = row.x + row.w / 2;
      const y = row.y + row.h + 60 + phase;
      state.balls = [createBall(config, x, y, Math.sin(angle), -Math.cos(angle))];

      let minY = Infinity;
      for (let frame = 0; frame < 8; frame += 1) {
        update(state, config.maxDt);
        minY = Math.min(minY, state.balls[0].y);
      }

      const label = `angle ${degrees}, phase ${phase}`;
      assert.equal(ballSpeed(state), config.maxSpeed, label);
      assert.ok(minY > row.y + row.h, `${label}: ball centre went past the row`);
      assert.ok(state.balls[0].vy > 0, `${label}: ball should be coming back down`);
      assert.ok(state.bricks.some((b) => !b.alive), `${label}: a brick should be hit`);
    }
  }
});

test('ball speed never exceeds the cap', () => {
  const state = createGame({ seed: 5, levels: [['1111111111', '1111111111']] });
  const { config } = state;
  state.status = 'playing';
  state.speed = config.maxSpeed - 1;
  const target = state.bricks.find((b) => b.row === 1 && b.col === 3);
  state.balls = [createBall(config, target.x + target.w / 2, target.y + target.h + 20, 0, -1)];
  for (let frame = 0; frame < 4; frame += 1) update(state, config.maxDt);

  assert.equal(state.speed, config.maxSpeed);
  const [ball] = state.balls;
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - config.maxSpeed) < 1e-6);
});
