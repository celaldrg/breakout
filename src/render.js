/**
 * Canvas drawing. drawScene sets one transform from the view (scale, offset
 * and devicePixelRatio), so everything below is drawn in world units.
 * Nothing here runs at import time or reads the DOM.
 */

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TAU = Math.PI * 2;
const ICON_INK = '#0f172a';

/** Brick colours by row: [highlight, base, shadow]. */
const ROW_COLORS = Object.freeze([
  ['#fda4af', '#f43f5e', '#9f1239'],
  ['#fdba74', '#f97316', '#9a3412'],
  ['#fde68a', '#f59e0b', '#92400e'],
  ['#86efac', '#22c55e', '#166534'],
  ['#67e8f9', '#06b6d4', '#155e75'],
  ['#a5b4fc', '#6366f1', '#3730a3'],
  ['#d8b4fe', '#a855f7', '#6b21a8'],
]);
const STEEL = Object.freeze(['#cbd5e1', '#64748b', '#334155']);

/** The game's accent colour (paddle, ball glow, paddle sparks). */
export const ACCENT = '#eab308';

/** Capsule colour of each power-up; the page legend uses the same ones. */
export const POWER_UP_COLORS = Object.freeze({
  wide: '#a78bfa',
  multi: '#34d399',
  slow: '#38bdf8',
  life: '#fb7185',
});
const POWER_UP_SHADES = Object.freeze({ wide: '#6d28d9', multi: '#047857', slow: '#0369a1', life: '#be123c' });

/**
 * Main colour of a brick; its break particles use it too.
 * @param {{kind: string, row: number}} brick
 * @returns {string}
 */
export function brickColor(brick) {
  return brickPalette(brick)[1];
}

/**
 * Draws one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   state: import('./engine.js').GameState,
 *   fx: import('./fx.js').Fx,
 *   view: {scale: number, offsetX: number, offsetY: number, dpr: number, width: number, height: number},
 *   time: number,
 *   motion: boolean,
 *   label: (key: string) => string,
 * }} scene `time` drives small pulses; `motion` is false for reduced motion
 */
export function drawScene(ctx, scene) {
  const { state, fx, view } = scene;
  const { config } = state;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#0b1324';
  ctx.fillRect(0, 0, view.width, view.height);
  const k = view.dpr * view.scale;
  ctx.setTransform(k, 0, 0, k, view.dpr * view.offsetX, view.dpr * view.offsetY);

  drawField(ctx, config);
  for (const brick of state.bricks) {
    if (brick.alive) drawBrick(ctx, brick);
  }
  for (const item of state.powerUps) drawPowerUp(ctx, item, scene, k);
  drawPaddle(ctx, state.paddle, state.effects.wide > 0, k);
  for (const ball of state.balls) drawBall(ctx, ball, state.effects.slow > 0, scene.motion);
  drawParticles(ctx, fx.particles);
  drawFloats(ctx, fx.floats, scene.label);
  drawFlash(ctx, fx.flash, config);
}

/**
 * @param {{kind: string, row: number}} brick
 * @returns {readonly string[]}
 */
function brickPalette(brick) {
  return brick.kind === 'unbreakable' ? STEEL : ROW_COLORS[brick.row % ROW_COLORS.length];
}

/** Starts a rounded-rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Starts a circle path. */
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

/** Night-sky gradient, a faint dot grid and a red glow at the open bottom. */
function drawField(ctx, { width, height }) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#16213d');
  sky.addColorStop(1, '#0a1121');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.09)';
  for (let y = 24; y < height; y += 32) {
    for (let x = 16; x < width; x += 32) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
  }

  const danger = ctx.createLinearGradient(0, height - 30, 0, height);
  danger.addColorStop(0, 'rgba(244, 63, 94, 0)');
  danger.addColorStop(1, 'rgba(244, 63, 94, 0.16)');
  ctx.fillStyle = danger;
  ctx.fillRect(0, height - 30, width, 30);
}

function drawBrick(ctx, brick) {
  const [light, base, dark] = brickPalette(brick);
  const { x, y, w, h } = brick;
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, light);
  fill.addColorStop(0.5, base);
  fill.addColorStop(1, dark);
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();

  if (brick.kind === 'unbreakable') {
    drawSteel(ctx, brick);
    return;
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  roundRect(ctx, x + 3, y + 2, w - 6, h * 0.3, 2);
  ctx.fill();
  if (brick.kind === 'strong') drawArmor(ctx, brick);
}

/** Strong bricks: a bright rim and one pip per remaining hit; cracked once hit. */
function drawArmor(ctx, brick) {
  const { x, y, w, h, hits, maxHits } = brick;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 3);
  ctx.stroke();

  const gap = 7;
  const startX = x + w / 2 - ((hits - 1) * gap) / 2;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < hits; i += 1) {
    circle(ctx, startX + i * gap, y + h / 2 + 1, 2);
    ctx.fill();
  }
  if (hits < maxHits) drawCrack(ctx, brick);
}

function drawCrack(ctx, { x, y, w, h }) {
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.16, y + 2);
  ctx.lineTo(x + w * 0.28, y + h * 0.45);
  ctx.lineTo(x + w * 0.22, y + h * 0.7);
  ctx.lineTo(x + w * 0.32, y + h - 2);
  ctx.moveTo(x + w * 0.28, y + h * 0.45);
  ctx.lineTo(x + w * 0.4, y + h * 0.36);
  ctx.stroke();
}

/** Unbreakable bricks: brushed steel with hatching and two rivets. */
function drawSteel(ctx, { x, y, w, h }) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 4);
  ctx.clip();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let sx = x - h; sx < x + w; sx += 8) {
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + h, y);
  }
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#e2e8f0';
  circle(ctx, x + 5, y + h / 2, 1.6);
  ctx.fill();
  circle(ctx, x + w - 5, y + h / 2, 1.6);
  ctx.fill();
}

function drawPowerUp(ctx, item, scene, k) {
  const color = POWER_UP_COLORS[item.type];
  const x = item.x - item.w / 2;
  const y = item.y - item.h / 2;
  const pulse = scene.motion ? 0.5 + 0.5 * Math.sin(scene.time * 6) : 0.5;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = (8 + 8 * pulse) * k;
  const fill = ctx.createLinearGradient(0, y, 0, y + item.h);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.4, color);
  fill.addColorStop(1, POWER_UP_SHADES[item.type]);
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, item.w, item.h, item.h / 2);
  ctx.fill();
  ctx.restore();
  drawPowerUpIcon(ctx, item.type, item.x, item.y);
}

/** Tiny vector icons, so capsules need no text or image files. */
const ICONS = Object.freeze({
  wide(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx + 7, cy);
    ctx.moveTo(cx - 4, cy - 3);
    ctx.lineTo(cx - 7, cy);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.moveTo(cx + 4, cy - 3);
    ctx.lineTo(cx + 7, cy);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.stroke();
  },
  multi(ctx, cx, cy) {
    for (const dx of [-5, 0, 5]) {
      circle(ctx, cx + dx, cy, 1.9);
      ctx.fill();
    }
  },
  slow(ctx, cx, cy) {
    ctx.lineWidth = 1.3;
    circle(ctx, cx, cy, 4.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2.6);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 2, cy + 0.6);
    ctx.stroke();
  },
  life(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 3.6);
    ctx.bezierCurveTo(cx - 6.5, cy - 0.6, cx - 3, cy - 5.4, cx, cy - 2);
    ctx.bezierCurveTo(cx + 3, cy - 5.4, cx + 6.5, cy - 0.6, cx, cy + 3.6);
    ctx.fill();
  },
});

function drawPowerUpIcon(ctx, type, cx, cy) {
  ctx.save();
  ctx.strokeStyle = ICON_INK;
  ctx.fillStyle = ICON_INK;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ICONS[type](ctx, cx, cy);
  ctx.restore();
}

/** Glowing amber paddle; violet end caps while Wide paddle is active. */
function drawPaddle(ctx, paddle, wide, k) {
  const { y, w, h } = paddle;
  const x = paddle.x - w / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(234, 179, 8, 0.7)';
  ctx.shadowBlur = 18 * k;
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, '#fef08a');
  fill.addColorStop(0.5, ACCENT);
  fill.addColorStop(1, '#a16207');
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  roundRect(ctx, x + h / 2, y + 2, w - h, 2.5, 1.25);
  ctx.fill();
  if (!wide) return;
  ctx.fillStyle = POWER_UP_COLORS.wide;
  roundRect(ctx, x + 3, y + h / 2 - 2, 10, 4, 2);
  ctx.fill();
  roundRect(ctx, x + w - 13, y + h / 2 - 2, 10, 4, 2);
  ctx.fill();
}

/** A bright core with a soft halo and a short comet tail; blue while slowed. */
function drawBall(ctx, ball, slow, motion) {
  const rgb = slow ? '56, 189, 248' : '250, 204, 21';
  if (motion && !ball.stuck) drawTrail(ctx, ball, rgb);
  const reach = ball.r * 3.4;
  const halo = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, reach);
  halo.addColorStop(0, `rgba(${rgb}, 0.55)`);
  halo.addColorStop(0.4, `rgba(${rgb}, 0.18)`);
  halo.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = halo;
  circle(ctx, ball.x, ball.y, reach);
  ctx.fill();

  const core = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.4, ball.r * 0.1, ball.x, ball.y, ball.r);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.6, slow ? '#bae6fd' : '#fef9c3');
  core.addColorStop(1, slow ? '#38bdf8' : '#facc15');
  ctx.fillStyle = core;
  circle(ctx, ball.x, ball.y, ball.r);
  ctx.fill();
}

function drawTrail(ctx, ball, rgb) {
  for (let i = 5; i >= 1; i -= 1) {
    const t = i * 0.014;
    ctx.fillStyle = `rgba(${rgb}, ${0.2 - i * 0.03})`;
    circle(ctx, ball.x - ball.vx * t, ball.y - ball.vy * t, ball.r * (1 - i * 0.12));
    ctx.fill();
  }
}

/** Additive light sparks: a soft halo around a bright core that shrinks as it fades. */
function drawParticles(ctx, particles) {
  if (particles.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const left = p.life / p.maxLife;
    const alpha = Math.min(1, left * 1.4);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha * 0.22;
    circle(ctx, p.x, p.y, p.size * 1.5);
    ctx.fill();
    ctx.globalAlpha = alpha;
    circle(ctx, p.x, p.y, p.size * (0.4 + 0.3 * left));
    ctx.fill();
  }
  ctx.restore();
}

function drawFloats(ctx, floats, label) {
  if (floats.length === 0) return;
  ctx.save();
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  for (const f of floats) {
    const text = label(f.label);
    ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 2);
    ctx.strokeText(text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(text, f.x, f.y);
  }
  ctx.restore();
}

function drawFlash(ctx, flash, { width, height }) {
  if (flash <= 0) return;
  ctx.fillStyle = `rgba(244, 63, 94, ${flash * 0.25})`;
  ctx.fillRect(0, 0, width, height);
}
