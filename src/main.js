/**
 * Entry point: connects the pure game engine to the canvas, the DOM HUD and
 * the controls, and runs the animation loop. `?demo` opens a deterministic
 * mid-game scene (used for the README screenshot) that stays frozen until
 * the first input and then plays on normally.
 */
import { DEFAULT_CONFIG } from './config.js';
import { createDemoState } from './demo.js';
import {
  createGame,
  drainEvents,
  launch,
  movePaddleTo,
  nextLevel,
  nudgePaddle,
  setPaused,
  togglePause,
  update,
} from './engine.js';
import { addFlash, addFloat, burst, createFx, stepFx } from './fx.js';
import { normalizeLanguage, otherLanguage, translate } from './i18n.js';
import { bindControls } from './input.js';
import { clamp } from './physics.js';
import { ACCENT, POWER_UP_COLORS, brickColor, drawScene } from './render.js';
import { createRng } from './rng.js';
import { loadValue, saveValue } from './storage.js';
import { applyTranslations, createEffectTimers, getElements, renderOverlay, syncControls, updateHud } from './ui.js';
import { POWER_UP_LABELS, fitView, helpTextParams, overlayFor, toWorldX } from './view.js';

const STORAGE_KEYS = Object.freeze({ lang: 'breakout.lang', best: 'breakout.best' });
const MAX_FRAME_SECONDS = 0.1;
const DEMO_FX_SEED = 2026;
const TEXT_PARAMS = Object.freeze(helpTextParams(DEFAULT_CONFIG));

/** Everything the page keeps between frames. */
const app = {
  els: null,
  ctx: null,
  controls: null,
  timers: null,
  game: null,
  fx: createFx(),
  rng: createRng(1),
  lang: 'en',
  best: 0,
  bestAtStart: 0,
  recordsBest: true,
  frozen: false,
  motion: true,
  view: null,
  clock: 0,
  lastFrame: 0,
  overlayKey: '',
};

/** How the page reacts to engine events (the overlays follow the status). */
const REACTIONS = Object.freeze({
  brick: (event) => sparks(event.x, event.y, brickColor(event), event.destroyed ? 16 : 6),
  paddle: (event) => sparks(event.x, event.y, ACCENT, 5, 90),
  powerup: (event) => announcePowerUp(event),
  lifelost: () => {
    if (app.motion) addFlash(app.fx);
  },
  won: () => celebrate(),
});

function boot() {
  const els = getElements(document);
  app.els = els;
  app.ctx = els.canvas.getContext('2d', { alpha: false });
  app.timers = createEffectTimers(els.effects, document);
  app.best = readBest();
  app.controls = bindControls(els.canvas, window, { move: movePaddle, primary, pause: pauseFromKey, wake });
  bindButtons(els);
  watchMotionPreference();
  watchSize(els);
  document.addEventListener('visibilitychange', pauseWhenHidden);
  setLanguage(loadValue(STORAGE_KEYS.lang, 'en'), false);
  if (new URLSearchParams(window.location.search).has('demo')) startDemo();
  else startGame();
  requestAnimationFrame(frame);
}

function readBest() {
  const value = Number(loadValue(STORAGE_KEYS.best, 0));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Starts a normal game with a fresh random seed. */
function startGame() {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));
  begin(createGame({ seed }), seed, { frozen: false, recordsBest: true });
}

/** Opens the frozen ?demo scene, with sparks over the brick broken last. */
function startDemo() {
  begin(createDemoState(), DEMO_FX_SEED, { frozen: true, recordsBest: false });
  const [ball] = app.game.balls;
  const gap = (brick) => Math.hypot(brick.x + brick.w / 2 - ball.x, brick.y + brick.h / 2 - ball.y);
  const broken = app.game.bricks.filter((brick) => !brick.alive);
  const last = broken.reduce((a, b) => (gap(b) < gap(a) ? b : a));
  burst(app.fx, app.rng, { x: last.x + last.w / 2, y: last.y + last.h / 2, color: brickColor(last), count: 24 });
  stepFx(app.fx, 0.16);
}

function begin(game, seed, { frozen, recordsBest }) {
  app.game = game;
  app.fx = createFx();
  app.rng = createRng(seed ^ 0x9e3779b9);
  app.frozen = frozen;
  app.recordsBest = recordsBest;
  app.bestAtStart = app.best;
  app.clock = 0;
}

function frame(now) {
  const dt = app.lastFrame ? Math.min((now - app.lastFrame) / 1000, MAX_FRAME_SECONDS) : 0;
  app.lastFrame = now;
  if (!app.frozen && !app.game.paused) advance(dt);
  render();
  syncDom();
  requestAnimationFrame(frame);
}

function advance(dt) {
  const { game } = app;
  const dir = app.controls.direction();
  if (dir !== 0) nudgePaddle(game, dir, dt);
  update(game, dt);
  for (const event of drainEvents(game)) REACTIONS[event.type]?.(event);
  stepFx(app.fx, dt);
  app.clock += dt;
  recordBest();
}

function recordBest() {
  if (!app.recordsBest || app.game.score <= app.best) return;
  app.best = app.game.score;
  saveValue(STORAGE_KEYS.best, app.best);
}

function sparks(x, y, color, count, speed) {
  if (app.motion) burst(app.fx, app.rng, { x, y, color, count, speed });
}

function announcePowerUp({ powerUp, x, y }) {
  const color = POWER_UP_COLORS[powerUp];
  const { width } = DEFAULT_CONFIG;
  const rise = app.motion ? 34 : 0;
  addFloat(app.fx, { x: clamp(x, 80, width - 80), y: y - 24, label: POWER_UP_LABELS[powerUp], color, rise });
  sparks(x, y, color, 12, 120);
}

function celebrate() {
  const { width, height } = DEFAULT_CONFIG;
  [ACCENT, ...Object.values(POWER_UP_COLORS)].forEach((color, i) => {
    sparks(width * (0.15 + 0.175 * i), height * 0.3, color, 24, 240);
  });
}

function render() {
  if (app.view === null) return;
  drawScene(app.ctx, {
    state: app.game,
    fx: app.fx,
    view: app.view,
    time: app.clock,
    motion: app.motion,
    label: (key) => translate(app.lang, key),
  });
}

function syncDom() {
  const { els, game, lang } = app;
  const best = Math.max(app.best, game.score);
  updateHud(els, {
    lang,
    score: game.score,
    best,
    level: game.levelIndex + 1,
    levels: game.levels.length,
    lives: game.lives,
  });
  app.timers(game.effects, game.config);
  syncControls(els, { lang, status: game.status, paused: game.paused, frozen: app.frozen });
  syncOverlay(best);
}

/** Re-renders the overlay only when its content changes; focuses its button when it appears. */
function syncOverlay(best) {
  const overlay = overlayFor(app.game, { best, bestAtStart: app.bestAtStart, recordsBest: app.recordsBest });
  const key = overlay === null ? '' : [overlay.kind, app.lang, app.game.score, best].join('|');
  if (key === app.overlayKey) return;
  const appearing = app.overlayKey === '';
  app.overlayKey = key;
  renderOverlay(app.els, overlay, app.lang);
  if (overlay !== null && appearing) app.els.overlayAction.focus({ preventScroll: true });
}

function movePaddle(localX) {
  if (app.frozen || app.view === null) return;
  movePaddleTo(app.game, toWorldX(app.view, localX));
}

/** Space, Enter, a tap or the overlay button: whatever moves the game on. */
function primary() {
  wake();
  const { game } = app;
  if (game.paused) setPaused(game, false);
  else if (game.status === 'serve') launch(game);
  else if (game.status === 'levelclear') nextLevel(game);
  else if (game.status === 'won' || game.status === 'gameover') startGame();
}

function pauseFromKey() {
  wake();
  const wasPaused = app.game.paused;
  togglePause(app.game);
  if (wasPaused) focusStage();
}

/** Any deliberate input brings the frozen demo scene to life. */
function wake() {
  app.frozen = false;
}

function pauseWhenHidden() {
  if (document.hidden && !app.frozen) setPaused(app.game, true);
}

function bindButtons(els) {
  els.newGame.addEventListener('click', () => {
    startGame();
    focusStage();
  });
  els.lang.addEventListener('click', (event) => {
    setLanguage(otherLanguage(app.lang));
    returnFocusAfterClick(event);
  });
  els.pause.addEventListener('click', (event) => {
    wake();
    togglePause(app.game);
    returnFocusAfterClick(event);
  });
  els.overlayAction.addEventListener('click', () => {
    primary();
    focusStage();
  });
}

/**
 * Pointer clicks hand focus back to the playfield, so a following Space
 * launches the ball instead of pressing the button again. Keyboard
 * activation (detail 0) leaves focus where it is.
 */
function returnFocusAfterClick(event) {
  if (event.detail > 0) focusStage();
}

function focusStage() {
  app.els.stage.focus({ preventScroll: true });
}

function setLanguage(lang, remember = true) {
  app.lang = normalizeLanguage(lang);
  if (remember) saveValue(STORAGE_KEYS.lang, app.lang);
  applyTranslations(document, app.lang, TEXT_PARAMS);
}

function watchMotionPreference() {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    app.motion = !query.matches;
  };
  apply();
  query.addEventListener('change', apply);
}

function watchSize(els) {
  const fit = () => fitCanvas(els.canvas);
  new ResizeObserver(fit).observe(els.stage);
  window.addEventListener('resize', fit);
  fit();
}

/** Sizes the canvas backing store to its CSS box times devicePixelRatio. */
function fitCanvas(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  app.view = { ...fitView(DEFAULT_CONFIG.width, DEFAULT_CONFIG.height, width, height), dpr, width, height };
}

boot();
