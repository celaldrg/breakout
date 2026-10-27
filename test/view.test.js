import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.js';
import { STRINGS } from '../src/i18n.js';
import { POWER_UP_TYPES } from '../src/powerups.js';
import { POWER_UP_LABELS, fitView, helpTextParams, isTap, overlayFor, toWorldX } from '../src/view.js';

/** The game-state fields overlayFor reads. */
function state(fields) {
  return { status: 'playing', score: 0, levelIndex: 0, paused: false, ...fields };
}

const SCORES = Object.freeze({ best: 500, bestAtStart: 300, recordsBest: true });

test('fitView: scales the world uniformly into any box and centres it', () => {
  assert.deepEqual(fitView(480, 640, 360, 480), { scale: 0.75, offsetX: 0, offsetY: 0 });
  assert.deepEqual(fitView(480, 640, 600, 480), { scale: 0.75, offsetX: 120, offsetY: 0 });
  assert.deepEqual(fitView(480, 640, 240, 640), { scale: 0.5, offsetX: 0, offsetY: 160 });
});

test('toWorldX: turns a pointer x inside the canvas back into world units', () => {
  const view = fitView(480, 640, 600, 480);
  assert.equal(toWorldX(view, 120), 0);
  assert.equal(toWorldX(view, 300), 240);
  assert.equal(toWorldX(view, 480), 480);
});

test('isTap: short, still presses are taps; long or moving ones are drags', () => {
  assert.equal(isTap({ duration: 120, distance: 3 }), true);
  assert.equal(isTap({ duration: 350, distance: 12 }), true);
  assert.equal(isTap({ duration: 351, distance: 0 }), false);
  assert.equal(isTap({ duration: 100, distance: 13 }), false);
});

test('overlayFor: nothing while serving or playing; a pause card while paused', () => {
  assert.equal(overlayFor(state({ status: 'serve' }), SCORES), null);
  assert.equal(overlayFor(state({ status: 'playing' }), SCORES), null);
  const paused = overlayFor(state({ paused: true }), SCORES);
  assert.equal(paused.kind, 'paused');
  assert.equal(paused.button, 'resume');
});

test('overlayFor: level clear names the cleared and the next level', () => {
  const overlay = overlayFor(state({ status: 'levelclear', levelIndex: 0, score: 420 }), SCORES);
  assert.deepEqual(overlay, {
    kind: 'levelclear',
    title: ['levelClearTitle', { level: 1 }],
    text: ['levelClearText', { score: 420, next: 2 }],
    note: null,
    button: 'nextLevel',
  });
});

test('overlayFor: game over and win report a new best only when one was set', () => {
  const record = overlayFor(state({ status: 'gameover', score: 500 }), SCORES);
  assert.deepEqual(record.title, ['gameOverTitle', {}]);
  assert.deepEqual(record.text, ['gameOverText', { score: 500 }]);
  assert.deepEqual(record.note, ['newBest', {}]);
  assert.equal(record.button, 'playAgain');

  const plain = overlayFor(state({ status: 'gameover', score: 200 }), SCORES);
  assert.deepEqual(plain.note, ['bestScore', { best: 500 }]);

  const demo = overlayFor(state({ status: 'won', score: 900 }), { ...SCORES, recordsBest: false });
  assert.deepEqual(demo.title, ['wonTitle', {}]);
  assert.deepEqual(demo.note, ['bestScore', { best: 500 }], 'the demo never claims a record');
});

test('overlayFor: every overlay string exists in both languages', () => {
  const states = [
    state({ paused: true }),
    state({ status: 'levelclear' }),
    state({ status: 'gameover', score: 900 }),
    state({ status: 'gameover' }),
    state({ status: 'won', score: 900 }),
  ];
  for (const s of states) {
    const { title, text, note, button } = overlayFor(s, SCORES);
    for (const key of [title[0], text[0], note?.[0], button].filter(Boolean)) {
      assert.ok(key in STRINGS.en && key in STRINGS.tr, `missing overlay string ${key}`);
    }
  }
});

test('POWER_UP_LABELS: every power-up has a name in both languages', () => {
  assert.deepEqual(Object.keys(POWER_UP_LABELS).sort(), [...POWER_UP_TYPES].sort());
  for (const key of Object.values(POWER_UP_LABELS)) {
    assert.ok(key in STRINGS.en && key in STRINGS.tr, `missing power-up name ${key}`);
  }
});

test('helpTextParams: the help texts quote the engine tuning', () => {
  assert.deepEqual(helpTextParams(DEFAULT_CONFIG), {
    wideSeconds: 12,
    widePercent: 50,
    slowSeconds: 10,
    slowPercent: 40,
    maxLives: 5,
  });
  const custom = { ...DEFAULT_CONFIG, wideFactor: 2, wideDuration: 8, slowFactor: 0.75, slowDuration: 6, maxLives: 4 };
  assert.deepEqual(helpTextParams(custom), {
    wideSeconds: 8,
    widePercent: 100,
    slowSeconds: 6,
    slowPercent: 25,
    maxLives: 4,
  });
});
