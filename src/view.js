/**
 * Pure helpers between the engine and the screen: fitting the world into
 * the canvas, converting pointer positions, telling a tap from a drag,
 * choosing which overlay to show and the names and numbers the texts quote.
 * No DOM access, so tests can import it.
 */

/** i18n key of each power-up's name (falling labels, timer chips, legend). */
export const POWER_UP_LABELS = Object.freeze({
  wide: 'powerWide',
  multi: 'powerMulti',
  slow: 'powerSlow',
  life: 'powerLife',
});

/**
 * Numbers quoted in the help texts, taken from the engine tuning so the page
 * never promises something the game does not do.
 * @param {typeof import('./config.js').DEFAULT_CONFIG} config
 * @returns {{wideSeconds: number, widePercent: number, slowSeconds: number, slowPercent: number, maxLives: number}}
 */
export function helpTextParams(config) {
  return {
    wideSeconds: config.wideDuration,
    widePercent: Math.round((config.wideFactor - 1) * 100),
    slowSeconds: config.slowDuration,
    slowPercent: Math.round((1 - config.slowFactor) * 100),
    maxLives: config.maxLives,
  };
}

/**
 * Scales the world uniformly to fit a box and centres it.
 * @param {number} worldWidth
 * @param {number} worldHeight
 * @param {number} boxWidth CSS pixels
 * @param {number} boxHeight CSS pixels
 * @returns {{scale: number, offsetX: number, offsetY: number}} CSS pixels per world unit and the margins
 */
export function fitView(worldWidth, worldHeight, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / worldWidth, boxHeight / worldHeight);
  return {
    scale,
    offsetX: (boxWidth - worldWidth * scale) / 2,
    offsetY: (boxHeight - worldHeight * scale) / 2,
  };
}

/**
 * Converts a horizontal position inside the canvas (CSS pixels from its left
 * edge) to a world x coordinate.
 * @param {{scale: number, offsetX: number}} view
 * @param {number} localX
 * @returns {number}
 */
export function toWorldX(view, localX) {
  return (localX - view.offsetX) / view.scale;
}

/**
 * True when a pointer gesture was short and still enough to count as a tap
 * (launch) rather than a drag (move the paddle).
 * @param {{duration: number, distance: number}} gesture milliseconds and CSS pixels
 * @param {number} [maxDuration=350]
 * @param {number} [maxDistance=12]
 * @returns {boolean}
 */
export function isTap({ duration, distance }, maxDuration = 350, maxDistance = 12) {
  return duration <= maxDuration && distance <= maxDistance;
}

/**
 * @typedef {[string, Record<string, number>]} Message i18n key and its parameters
 * @typedef {{kind: string, title: Message, text: Message, note: Message|null, button: string}} Overlay
 */

/**
 * Chooses the overlay for the current game state: level clear, win, game
 * over or pause. Returns null while the playfield should stay clear.
 * @param {import('./engine.js').GameState} state
 * @param {{best: number, bestAtStart: number, recordsBest: boolean}} scores
 *   `recordsBest` is false for the ?demo scene, which never claims a record
 * @returns {Overlay|null}
 */
export function overlayFor(state, { best, bestAtStart, recordsBest }) {
  const { status, score, levelIndex } = state;
  if (status === 'levelclear') {
    return {
      kind: status,
      title: ['levelClearTitle', { level: levelIndex + 1 }],
      text: ['levelClearText', { score, next: levelIndex + 2 }],
      note: null,
      button: 'nextLevel',
    };
  }
  if (status === 'won' || status === 'gameover') {
    const won = status === 'won';
    const record = recordsBest && score > bestAtStart;
    return {
      kind: status,
      title: [won ? 'wonTitle' : 'gameOverTitle', {}],
      text: [won ? 'wonText' : 'gameOverText', { score }],
      note: record ? ['newBest', {}] : ['bestScore', { best }],
      button: 'playAgain',
    };
  }
  if (state.paused) {
    return { kind: 'paused', title: ['pausedTitle', {}], text: ['pausedText', {}], note: null, button: 'resume' };
  }
  return null;
}
