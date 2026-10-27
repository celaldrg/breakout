import { pickPowerUp } from './powerups.js';

/**
 * Brick legend used by the level layouts. '.' (or any other character)
 * is an empty cell.
 */
export const BRICK_LEGEND = Object.freeze({
  1: Object.freeze({ kind: 'normal', hits: 1 }),
  2: Object.freeze({ kind: 'strong', hits: 2 }),
  3: Object.freeze({ kind: 'strong', hits: 3 }),
  '#': Object.freeze({ kind: 'unbreakable', hits: 0 }),
});

/**
 * The three hand-designed levels, one string per brick row and one
 * character per column (10 columns).
 */
export const LEVELS = Object.freeze([
  // 1 - Sunrise: a gentle arch with a strong crown.
  Object.freeze([
    '..222222..',
    '.11111111.',
    '1111111111',
    '1111111111',
    '1111111111',
    '.11111111.',
  ]),
  // 2 - Diamond: strong rim, two steel studs on the flanks.
  Object.freeze([
    '....33....',
    '...2112...',
    '..211112..',
    '.21111112.',
    '#.211112.#',
    '...2112...',
    '....11....',
  ]),
  // 3 - Fortress: thick walls, steel pillars and a gated front.
  Object.freeze([
    '3332222333',
    '2111111112',
    '21#1111#12',
    '2111331112',
    '21#1111#12',
    '2111111112',
    '##..11..##',
  ]),
]);

/**
 * Builds the bricks of one level. Each breakable brick may carry a power-up
 * (`drop`), decided here with the seeded RNG so a seed fixes the whole level.
 * @param {readonly string[]} layout rows of legend characters
 * @param {typeof import('./config.js').DEFAULT_CONFIG} config
 * @param {() => number} rng seeded random source
 * @returns {import('./engine.js').Brick[]}
 */
export function buildBricks(layout, config, rng) {
  const { cols, sideMargin, brickGap, brickHeight, topMargin, width } = config;
  const w = (width - 2 * sideMargin - (cols - 1) * brickGap) / cols;
  const bricks = [];
  layout.forEach((line, row) => {
    for (let col = 0; col < Math.min(line.length, cols); col += 1) {
      const spec = BRICK_LEGEND[line[col]];
      if (!spec) continue;
      const breakable = spec.kind !== 'unbreakable';
      bricks.push({
        x: sideMargin + col * (w + brickGap),
        y: topMargin + row * (brickHeight + brickGap),
        w,
        h: brickHeight,
        row,
        col,
        kind: spec.kind,
        hits: spec.hits,
        maxHits: spec.hits,
        points: spec.hits * config.pointsPerHit,
        drop: breakable && rng() < config.dropChance ? pickPowerUp(rng) : null,
        alive: true,
      });
    }
  });
  return bricks;
}
