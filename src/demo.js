import { createBall, createGame } from './engine.js';
import { createPowerUp } from './powerups.js';

const DEMO_SEED = 2026;

/** Bricks knocked out in the demo scene, as [row, col] on level 1. */
const BROKEN = Object.freeze([
  [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 8],
  [4, 3], [4, 4], [4, 5], [4, 8], [4, 9],
  [3, 4], [3, 8],
  [1, 1], [0, 7],
]);

/**
 * Builds the deterministic mid-game scene used by `?demo` (README
 * screenshot): level 1 with a channel knocked out of the wall, a Wide paddle
 * capsule falling and the ball in flight.
 * @returns {import('./engine.js').GameState}
 */
export function createDemoState() {
  const state = createGame({ seed: DEMO_SEED });
  const { config } = state;
  const broken = new Set(BROKEN.map(([row, col]) => `${row},${col}`));
  for (const brick of state.bricks) {
    if (!broken.has(`${brick.row},${brick.col}`)) continue;
    brick.alive = false;
    brick.hits = 0;
    state.score += brick.points;
  }
  state.status = 'playing';
  state.paddle.x = 206;
  state.balls = [createBall(config, 300, 318, 165, -255)];
  state.powerUps = [createPowerUp('wide', 128, 352, config)];
  return state;
}
