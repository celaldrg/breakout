import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FX_CONFIG, addFlash, addFloat, burst, createFx, stepFx } from '../src/fx.js';
import { createRng } from '../src/rng.js';

const SPARK = Object.freeze({ x: 100, y: 50, color: '#f43f5e', count: 12 });

/** One particle at the origin with the given velocity. */
function particle(vx, vy) {
  return { x: 0, y: 0, vx, vy, life: 1, maxLife: 1, size: 2, color: '#fff' };
}

test('burst: adds the requested particles at the spot, deterministically', () => {
  const a = createFx();
  const b = createFx();
  burst(a, createRng(7), SPARK);
  burst(b, createRng(7), SPARK);
  assert.equal(a.particles.length, 12);
  assert.deepEqual(a.particles, b.particles);
  for (const p of a.particles) {
    assert.equal(p.x, 100);
    assert.equal(p.y, 50);
    assert.equal(p.color, '#f43f5e');
    assert.ok(p.life > 0 && p.life === p.maxLife);
  }
});

test('burst: keeps at most maxParticles, dropping the oldest', () => {
  const fx = createFx();
  const rng = createRng(1);
  burst(fx, rng, { ...SPARK, color: 'old', count: FX_CONFIG.maxParticles - 10 });
  burst(fx, rng, { ...SPARK, color: 'new', count: 40 });
  assert.equal(fx.particles.length, FX_CONFIG.maxParticles);
  assert.equal(fx.particles.filter((p) => p.color === 'new').length, 40);
  assert.equal(fx.particles.at(-1).color, 'new');
});

test('stepFx: particles fall, slow down and disappear when their life runs out', () => {
  const fx = createFx();
  fx.particles.push(particle(100, 0));
  stepFx(fx, 0.1);
  const [p] = fx.particles;
  assert.ok(p.vy > 0 && p.y > 0, 'gravity pulls it down');
  assert.ok(p.vx > 0 && p.vx < 100, 'drag slows it down');

  burst(fx, createRng(3), { ...SPARK, count: 20 });
  const longest = Math.max(...fx.particles.map((item) => item.life));
  stepFx(fx, longest);
  assert.equal(fx.particles.length, 0);
});

test('addFloat + stepFx: labels rise, then expire; rise 0 keeps them still', () => {
  const fx = createFx();
  addFloat(fx, { x: 10, y: 100, label: 'powerWide', color: '#a78bfa' });
  stepFx(fx, 0.5);
  assert.equal(fx.floats.length, 1);
  assert.ok(fx.floats[0].y < 100);
  stepFx(fx, 1);
  assert.equal(fx.floats.length, 0);

  addFloat(fx, { x: 10, y: 100, label: 'powerWide', color: '#a78bfa', rise: 0 });
  stepFx(fx, 0.5);
  assert.equal(fx.floats[0].y, 100);
});

test('addFlash: clamps to 1, keeps the stronger flash and fades out to 0', () => {
  const fx = createFx();
  addFlash(fx, 3);
  assert.equal(fx.flash, 1);
  addFlash(fx, 0.2);
  assert.equal(fx.flash, 1);
  stepFx(fx, 0.1);
  assert.ok(fx.flash > 0 && fx.flash < 1);
  stepFx(fx, 5);
  assert.equal(fx.flash, 0);
});
