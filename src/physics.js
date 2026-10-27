/**
 * Pure 2D helpers: circle vs axis-aligned box collision, reflection and
 * velocity shaping. No game state lives here.
 */

/**
 * Limits a number to the closed range [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  if (value < min) return min;
  return value > max ? max : value;
}

/**
 * Tests a circle against an axis-aligned rectangle.
 * The normal points from the rectangle towards the circle centre. Face hits
 * give an exact axis normal (side: nx = +-1, top/bottom: ny = +-1); corner
 * hits give the diagonal from the corner to the centre.
 * @param {number} cx circle centre x
 * @param {number} cy circle centre y
 * @param {number} r circle radius
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @returns {{nx: number, ny: number, depth: number} | null} null when apart
 */
export function circleRectHit(cx, cy, r, rect) {
  const px = clamp(cx, rect.x, rect.x + rect.w);
  const py = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - px;
  const dy = cy - py;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) return null;
  if (distSq > 0) {
    const dist = Math.sqrt(distSq);
    return { nx: dx / dist, ny: dy / dist, depth: r - dist };
  }
  return insideHit(cx, cy, r, rect);
}

/**
 * Resolves a circle whose centre is inside the rectangle by pushing it out
 * through the nearest face.
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @returns {{nx: number, ny: number, depth: number}}
 */
function insideHit(cx, cy, r, rect) {
  const faces = [
    { nx: -1, ny: 0, gap: cx - rect.x },
    { nx: 1, ny: 0, gap: rect.x + rect.w - cx },
    { nx: 0, ny: -1, gap: cy - rect.y },
    { nx: 0, ny: 1, gap: rect.y + rect.h - cy },
  ];
  const best = faces.reduce((a, b) => (b.gap < a.gap ? b : a));
  return { nx: best.nx, ny: best.ny, depth: best.gap + r };
}

/**
 * Reflects a velocity about a unit surface normal (v - 2(v.n)n). With an
 * axis normal this flips exactly one component; with a corner normal both
 * change. A velocity already moving away from the surface is returned as is.
 * @param {number} vx
 * @param {number} vy
 * @param {number} nx unit normal x
 * @param {number} ny unit normal y
 * @returns {{vx: number, vy: number}}
 */
export function reflect(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  if (dot >= 0) return { vx, vy };
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}

/**
 * Rescales a velocity to `speed` and keeps it from going too flat, so the
 * ball can never bounce horizontally forever.
 * @param {number} vx
 * @param {number} vy
 * @param {number} speed target magnitude
 * @param {number} minVertical smallest allowed |vy| / speed, in [0, 1)
 * @param {number} [fallbackSignY=-1] vertical direction used when vy is 0
 * @returns {{vx: number, vy: number}}
 */
export function steer(vx, vy, speed, minVertical, fallbackSignY = -1) {
  const len = Math.hypot(vx, vy);
  let ux = len > 0 ? vx / len : 0;
  let uy = len > 0 ? vy / len : fallbackSignY;
  if (Math.abs(uy) < minVertical) {
    uy = (uy === 0 ? fallbackSignY : Math.sign(uy)) * minVertical;
    ux = (ux < 0 ? -1 : 1) * Math.sqrt(1 - minVertical * minVertical);
  }
  return { vx: ux * speed, vy: uy * speed };
}

/**
 * Velocity after bouncing off the paddle. The angle from vertical grows
 * linearly with the hit position: centre goes straight up, edges go out at
 * `maxAngle` (60 degrees by default).
 * @param {number} offset hit position, -1 = left edge, 0 = centre, 1 = right edge
 * @param {number} speed resulting speed
 * @param {number} [maxAngle=Math.PI / 3] angle at the edges, in radians
 * @returns {{vx: number, vy: number}} vy is always negative (upwards)
 */
export function paddleBounce(offset, speed, maxAngle = Math.PI / 3) {
  const angle = clamp(offset, -1, 1) * maxAngle;
  return { vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) };
}

/**
 * Keeps a paddle's centre so the whole paddle stays inside the field.
 * @param {number} x desired centre x
 * @param {number} width paddle width
 * @param {number} fieldWidth playfield width
 * @returns {number}
 */
export function clampPaddleX(x, width, fieldWidth) {
  return clamp(x, width / 2, fieldWidth - width / 2);
}
