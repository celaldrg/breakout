/**
 * Creates a small, fast seeded pseudo-random generator (mulberry32).
 * The same seed always yields the same sequence, which keeps tests and
 * the `?demo` scene deterministic.
 * @param {number} [seed=1] any integer; it is reduced to 32 bits
 * @returns {() => number} function returning floats in [0, 1)
 */
export function createRng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
