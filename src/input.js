/**
 * Keyboard and pointer controls. Turns raw DOM events into a few game
 * actions; the caller decides what each action does. Nothing runs at
 * import time.
 */
import { isTap } from './view.js';

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA', 'a']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD', 'd']);
const PAUSE_KEYS = new Set(['p', 'Escape']);

/**
 * @typedef {{
 *   move: (localX: number) => void,
 *   primary: () => void,
 *   pause: () => void,
 *   wake: () => void,
 * }} Actions
 *   move: put the paddle under a pointer x (CSS px from the canvas' left edge);
 *   primary: Space / Enter / tap (launch, next level, resume, restart);
 *   pause: P / Escape; wake: any deliberate input
 */

/**
 * Connects keyboard (on the window) and pointer input (on the canvas).
 * @param {HTMLCanvasElement} canvas the play area
 * @param {Window} win
 * @param {Actions} actions
 * @returns {{direction: () => number}} held arrow / A / D keys as -1, 0 or 1
 */
export function bindControls(canvas, win, actions) {
  const held = new Map();
  win.addEventListener('keydown', (event) => onKeyDown(event, held, actions));
  win.addEventListener('keyup', (event) => held.delete(event.code || event.key));
  win.addEventListener('blur', () => held.clear());
  bindPointer(canvas, actions);
  return {
    direction() {
      let sum = 0;
      for (const dir of held.values()) sum += dir;
      return Math.sign(sum);
    },
  };
}

/**
 * Movement direction of a key: -1 left, 1 right, 0 otherwise. Accepts both
 * the physical key position and the typed letter, so A / D work on any layout.
 * @param {KeyboardEvent} event
 * @returns {number}
 */
function moveDirection(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (LEFT_KEYS.has(event.code) || LEFT_KEYS.has(key)) return -1;
  if (RIGHT_KEYS.has(event.code) || RIGHT_KEYS.has(key)) return 1;
  return 0;
}

/**
 * @param {KeyboardEvent} event
 * @param {Map<string, number>} held
 * @param {Actions} actions
 */
function onKeyDown(event, held, actions) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const dir = moveDirection(event);
  if (dir !== 0) {
    event.preventDefault();
    held.set(event.code || event.key, dir);
    actions.wake();
    return;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (PAUSE_KEYS.has(key)) {
    if (!event.repeat) actions.pause();
    return;
  }
  if (key !== ' ' && key !== 'Enter') return;
  // A focused button or link handles its own Space / Enter.
  if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea')) return;
  event.preventDefault();
  if (!event.repeat) actions.primary();
}

/**
 * Mouse moves the paddle by hovering; touch and pen move it while pressed.
 * A short, still press is a tap (primary action).
 * @param {HTMLCanvasElement} canvas
 * @param {Actions} actions
 */
function bindPointer(canvas, actions) {
  let gesture = null;
  const localX = (event) => event.clientX - canvas.getBoundingClientRect().left;

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    capturePointer(canvas, event.pointerId);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, start: event.timeStamp, distance: 0 };
    actions.wake();
    actions.move(localX(event));
  });

  canvas.addEventListener('pointermove', (event) => {
    const pressed = gesture !== null && gesture.id === event.pointerId;
    if (pressed) {
      const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      gesture.distance = Math.max(gesture.distance, moved);
    }
    if (pressed || event.pointerType === 'mouse') actions.move(localX(event));
  });

  const finish = (event) => {
    if (gesture === null || gesture.id !== event.pointerId) return;
    const tap =
      event.type === 'pointerup' &&
      isTap({ duration: event.timeStamp - gesture.start, distance: gesture.distance });
    gesture = null;
    if (tap) actions.primary();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

/**
 * Keeps a pressed pointer's moves coming to the canvas after it slides off.
 * Capture throws for a pointer that is no longer active (it was already
 * released, or the event was synthetic); the press still counts without it.
 * @param {HTMLCanvasElement} canvas
 * @param {number} pointerId
 */
function capturePointer(canvas, pointerId) {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Nothing to capture: moves inside the canvas still reach the handlers.
  }
}
