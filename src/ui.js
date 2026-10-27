/**
 * DOM side of the interface: element lookup, translations, the HUD, the
 * power-up timers, the launch hint, the pause button and the overlays.
 * Writes only when something visible changed. Nothing runs at import time.
 */
import { formatNumber, otherLanguage, translate } from './i18n.js';
import { POWER_UP_LABELS } from './view.js';

/** Timed effects, shown as chips while they last. */
const TIMED_EFFECTS = Object.freeze(['wide', 'slow']);

/**
 * Looks up the page elements the game updates.
 * @param {Document} doc
 */
export function getElements(doc) {
  const byId = (id) => doc.getElementById(id);
  return {
    stage: byId('stage'),
    canvas: byId('board'),
    newGame: byId('new-game'),
    lang: byId('lang-toggle'),
    pause: byId('pause'),
    score: byId('hud-score'),
    best: byId('hud-best'),
    level: byId('hud-level'),
    lives: byId('hud-lives'),
    effects: byId('effects'),
    hint: byId('hint'),
    overlay: byId('overlay'),
    overlayTitle: byId('overlay-title'),
    overlayText: byId('overlay-text'),
    overlayNote: byId('overlay-note'),
    overlayAction: byId('overlay-action'),
  };
}

/**
 * Translates every [data-i18n] text and [data-i18n-label] aria-label, the page
 * title and <html lang>, and labels the toggle with the other language.
 * @param {Document} doc
 * @param {'en'|'tr'} lang
 * @param {Record<string, number>} params values for placeholders such as {wideSeconds}
 */
export function applyTranslations(doc, lang, params) {
  doc.documentElement.lang = lang;
  doc.title = translate(lang, 'pageTitle');
  for (const el of doc.querySelectorAll('[data-i18n]')) {
    el.textContent = translate(lang, el.dataset.i18n, params);
  }
  for (const el of doc.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', translate(lang, el.dataset.i18nLabel, params));
  }
  doc.getElementById('lang-toggle').textContent = otherLanguage(lang).toUpperCase();
}

/**
 * Builds one chip per timed effect (name + shrinking bar) inside `container`.
 * Call it before applyTranslations so the chip names get translated too.
 * @param {HTMLElement} container
 * @param {Document} doc
 * @returns {(effects: {wide: number, slow: number}, config: typeof import('./config.js').DEFAULT_CONFIG) => void}
 *   updater to call every frame
 */
export function createEffectTimers(container, doc) {
  const chips = TIMED_EFFECTS.map((effect) => {
    const chip = doc.createElement('div');
    chip.className = `effect effect-${effect}`;
    chip.hidden = true;
    const name = doc.createElement('span');
    name.dataset.i18n = POWER_UP_LABELS[effect];
    const bar = doc.createElement('span');
    bar.className = 'effect-bar';
    const fill = doc.createElement('span');
    fill.className = 'effect-fill';
    bar.append(fill);
    chip.append(name, bar);
    container.append(chip);
    return { effect, chip, fill };
  });
  return function updateTimers(effects, config) {
    for (const { effect, chip, fill } of chips) {
      const left = effects[effect];
      if (chip.hidden !== left <= 0) chip.hidden = left <= 0;
      if (left > 0) fill.style.transform = `scaleX(${Math.min(1, left / config[`${effect}Duration`])})`;
    }
  };
}

/**
 * Updates the HUD values (score, best, level, lives).
 * @param {ReturnType<typeof getElements>} els
 * @param {{lang: string, score: number, best: number, level: number, levels: number, lives: number}} hud
 */
export function updateHud(els, { lang, score, best, level, levels, lives }) {
  setText(els.score, formatNumber(lang, score));
  setText(els.best, formatNumber(lang, best));
  setText(els.level, translate(lang, 'levelOf', { level, total: levels }));
  setText(els.lives, formatNumber(lang, lives));
}

/**
 * Shows or hides the launch hint and keeps the pause button's state, icon
 * and label in step with the game.
 * @param {ReturnType<typeof getElements>} els
 * @param {{lang: string, status: string, paused: boolean, frozen: boolean}} info
 */
export function syncControls(els, { lang, status, paused, frozen }) {
  const active = status === 'serve' || status === 'playing';
  setHidden(els.hint, status !== 'serve' || paused || frozen);
  if (els.pause.disabled === active) els.pause.disabled = !active;
  setAttr(els.pause, 'aria-label', translate(lang, paused ? 'resume' : 'pause'));
  setAttr(els.pause, 'data-paused', String(paused));
}

/**
 * Fills and shows the overlay card, or hides it when `overlay` is null.
 * @param {ReturnType<typeof getElements>} els
 * @param {import('./view.js').Overlay|null} overlay
 * @param {string} lang
 */
export function renderOverlay(els, overlay, lang) {
  setHidden(els.overlay, overlay === null);
  if (overlay === null) return;
  const say = ([key, params]) => translate(lang, key, params);
  els.overlay.dataset.kind = overlay.kind;
  setText(els.overlayTitle, say(overlay.title));
  setText(els.overlayText, say(overlay.text));
  setHidden(els.overlayNote, overlay.note === null);
  setText(els.overlayNote, overlay.note === null ? '' : say(overlay.note));
  setText(els.overlayAction, translate(lang, overlay.button));
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function setHidden(el, hidden) {
  if (el.hidden !== hidden) el.hidden = hidden;
}

function setAttr(el, name, value) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
