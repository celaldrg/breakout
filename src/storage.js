/**
 * The only place that touches localStorage. Every access is wrapped in
 * try/catch so private mode, blocked storage or a full quota never crash the
 * game; reads then fall back to defaults and writes report false.
 */

/**
 * Reads a JSON value.
 * @template T
 * @param {string} key
 * @param {T} fallback returned when the key is missing or unreadable
 * @returns {T}
 */
export function loadValue(key, fallback) {
  try {
    const raw = globalThis.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON value.
 * @param {string} key
 * @param {unknown} value any JSON-serialisable value
 * @returns {boolean} true if it was stored
 */
export function saveValue(key, value) {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
