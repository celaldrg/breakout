/**
 * Default tuning values for the engine. Lengths are world units (the
 * playfield is `width` x `height`; the UI scales it to the canvas), times are
 * seconds and speeds are world units per second.
 */
export const DEFAULT_CONFIG = Object.freeze({
  width: 480,
  height: 640,

  cols: 10,
  sideMargin: 16,
  topMargin: 64,
  brickHeight: 18,
  brickGap: 4,
  pointsPerHit: 10,

  paddleWidth: 84,
  paddleHeight: 12,
  paddleBottom: 40,
  paddleSpeed: 560,

  ballRadius: 7,
  baseSpeed: 300,
  speedPerLevel: 30,
  speedUpPerHit: 2.5,
  maxSpeed: 640,
  maxBounceAngle: Math.PI / 3,
  minVerticalRatio: Math.sin(Math.PI / 12),
  maxDt: 0.05,

  startLives: 3,
  maxLives: 5,
  maxBalls: 9,

  dropChance: 0.2,
  powerUpSpeed: 140,
  powerUpWidth: 30,
  powerUpHeight: 14,
  wideFactor: 1.5,
  wideDuration: 12,
  slowFactor: 0.6,
  slowDuration: 10,
  multiSpread: Math.PI / 7,
});
