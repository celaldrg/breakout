/**
 * Visual effects kept apart from the game rules: light particles, floating
 * labels and a short screen flash. Pure data and functions with an injected
 * random source, so the effects are deterministic and testable; the
 * renderer only draws them.
 */

/** Tuning values, in world units and seconds. */
export const FX_CONFIG = Object.freeze({
  maxParticles: 360,
  gravity: 420,
  drag: 2.2,
  flashDecay: 2.6,
});

/**
 * @typedef {{x: number, y: number, vx: number, vy: number, life: number,
 *   maxLife: number, size: number, color: string}} Particle
 * @typedef {{x: number, y: number, label: string, color: string, life: number,
 *   maxLife: number, rise: number}} FloatLabel
 *   `label` is an i18n key, translated when drawn.
 * @typedef {{particles: Particle[], floats: FloatLabel[], flash: number}} Fx
 */

/**
 * Creates an empty effects container.
 * @returns {Fx}
 */
export function createFx() {
  return { particles: [], floats: [], flash: 0 };
}

/**
 * Throws `count` particles out of (x, y) in random directions. The oldest
 * particles are dropped when the cap is reached.
 * @param {Fx} fx
 * @param {() => number} rng seeded random source
 * @param {{x: number, y: number, color: string, count: number, speed?: number,
 *   life?: number, size?: number}} spec
 */
export function burst(fx, rng, { x, y, color, count, speed = 170, life = 0.7, size = 2.6 }) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const velocity = speed * (0.35 + rng() * 0.65);
    const ttl = life * (0.55 + rng() * 0.45);
    fx.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * 0.2,
      life: ttl,
      maxLife: ttl,
      size: size * (0.6 + rng() * 0.7),
      color,
    });
  }
  const extra = fx.particles.length - FX_CONFIG.maxParticles;
  if (extra > 0) fx.particles.splice(0, extra);
}

/**
 * Adds a label that floats up and fades out (power-up names).
 * @param {Fx} fx
 * @param {{x: number, y: number, label: string, color: string, life?: number, rise?: number}} spec
 *   `label` is an i18n key; `rise` is the upward speed (0 keeps it still)
 */
export function addFloat(fx, { x, y, label, color, life = 1.2, rise = 34 }) {
  fx.floats.push({ x, y, label, color, life, maxLife: life, rise });
}

/**
 * Starts (or strengthens) the red flash shown when a life is lost.
 * @param {Fx} fx
 * @param {number} [amount=1] strength in [0, 1]
 */
export function addFlash(fx, amount = 1) {
  fx.flash = Math.min(1, Math.max(fx.flash, amount));
}

/**
 * Advances every effect by `dt` seconds and removes the finished ones.
 * @param {Fx} fx
 * @param {number} dt seconds
 */
export function stepFx(fx, dt) {
  const damping = Math.exp(-FX_CONFIG.drag * dt);
  for (const p of fx.particles) {
    p.life -= dt;
    p.vx *= damping;
    p.vy = p.vy * damping + FX_CONFIG.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const f of fx.floats) {
    f.life -= dt;
    f.y -= f.rise * dt;
  }
  fx.floats = fx.floats.filter((f) => f.life > 0);
  fx.flash = Math.max(0, fx.flash - FX_CONFIG.flashDecay * dt);
}
