import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';
import { loadValue, saveValue } from '../src/storage.js';
import { createDemoState } from '../src/demo.js';

test('createRng: same seed, same sequence, values in [0, 1)', () => {
  const a = createRng(123);
  const b = createRng(123);
  const c = createRng(124);
  const seqA = Array.from({ length: 50 }, a);
  assert.deepEqual(seqA, Array.from({ length: 50 }, b));
  assert.notDeepEqual(seqA, Array.from({ length: 50 }, c));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
});

/** Runs `fn` with globalThis.localStorage replaced by `fake`. */
function withStorage(fake, fn) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('storage round-trips JSON values', () => {
  const data = new Map();
  const fake = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
  withStorage(fake, () => {
    assert.equal(loadValue('best', 0), 0);
    assert.equal(saveValue('best', 1234), true);
    assert.equal(loadValue('best', 0), 1234);
    data.set('broken', '{nope');
    assert.equal(loadValue('broken', 'fallback'), 'fallback');
  });
});

test('storage never throws when localStorage is missing or blocked', () => {
  withStorage(undefined, () => {
    assert.equal(loadValue('k', 7), 7);
    assert.equal(saveValue('k', 1), false);
  });
  const blocked = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  withStorage(blocked, () => {
    assert.equal(loadValue('k', 'en'), 'en');
    assert.equal(saveValue('k', 'tr'), false);
  });
});

test('the demo scene is deterministic and mid-game', () => {
  const a = createDemoState();
  const b = createDemoState();
  assert.deepEqual(a.bricks, b.bricks);
  assert.deepEqual(a.balls, b.balls);
  assert.equal(a.status, 'playing');
  assert.equal(a.levelIndex, 0);
  assert.equal(a.balls.length, 1);
  assert.equal(a.balls[0].stuck, false);
  assert.equal(a.powerUps.length, 1);

  const broken = a.bricks.filter((brick) => !brick.alive);
  assert.ok(broken.length >= 10 && broken.length < a.bricks.length / 2);
  assert.equal(a.score, broken.reduce((sum, brick) => sum + brick.points, 0));
});
