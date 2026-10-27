/**
 * Interface strings in English and Turkish, plus small helpers to pick a
 * language, fill {placeholders} and format numbers. Pure module: it never
 * touches the DOM, so tests can import it directly.
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

const LOCALES = Object.freeze({ en: 'en-US', tr: 'tr-TR' });

/** Every visible string of the game, keyed by language. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Breakout – brick-breaking arcade game',
    newGame: 'New game',
    switchLanguage: 'TR – Switch to Turkish',
    pause: 'Pause',
    resume: 'Resume',
    hudLabel: 'Game status',
    score: 'Score',
    best: 'Best',
    level: 'Level',
    lives: 'Lives',
    levelOf: '{level} / {total}',
    stageLabel:
      'Breakout playfield. Move with the arrow keys, A and D, the mouse or by dragging; launch with Space or a tap; pause with P.',
    launchHint: 'Tap or press Space to launch',
    pausedTitle: 'Paused',
    pausedText: 'Take a breather. Press P or Esc to carry on.',
    levelClearTitle: 'Level {level} cleared!',
    levelClearText: 'Score so far: {score}. Level {next} is up next.',
    nextLevel: 'Next level',
    gameOverTitle: 'Game over',
    gameOverText: 'Final score: {score}.',
    wonTitle: 'You win!',
    wonText: 'All three levels cleared. Final score: {score}.',
    newBest: 'New best score!',
    bestScore: 'Best score: {best}',
    playAgain: 'Play again',
    powerWide: 'Wide paddle',
    powerMulti: 'Multi-ball',
    powerSlow: 'Slow ball',
    powerLife: 'Extra life',
    powerWideInfo: '{widePercent}% wider paddle for {wideSeconds} s',
    powerMultiInfo: 'Two more balls join the rally',
    powerSlowInfo: 'Every ball {slowPercent}% slower for {slowSeconds} s',
    powerLifeInfo: 'One more life, up to {maxLives}',
    howTitle: 'How to play',
    ctlMove: 'Move',
    ctlMoveAlt: 'or mouse / drag',
    ctlLaunch: 'Launch',
    ctlLaunchAlt: 'or click / tap',
    ctlPauseAlt: 'also when the tab is hidden',
    keySpace: 'Space',
    goal: 'Break every breakable brick to clear a level. Clear all three levels to win.',
    powerUpsTitle: 'Power-ups',
    bricksTitle: 'Bricks',
    brickNormal: 'Normal: 1 hit',
    brickStrong: 'Strong: 2–3 hits',
    brickSteel: 'Steel: unbreakable',
    source: 'Source on GitHub',
  }),
  tr: Object.freeze({
    pageTitle: 'Breakout – tuğla kırma oyunu',
    newGame: 'Yeni oyun',
    switchLanguage: 'EN – İngilizceye geç',
    pause: 'Duraklat',
    resume: 'Devam et',
    hudLabel: 'Oyun durumu',
    score: 'Skor',
    best: 'En iyi',
    level: 'Bölüm',
    lives: 'Can',
    levelOf: '{level} / {total}',
    stageLabel:
      'Breakout oyun alanı. Ok tuşları, A ve D, fare ya da sürükleyerek hareket et; Boşluk ya da dokunuşla fırlat; P ile duraklat.',
    launchHint: 'Fırlatmak için dokun ya da Boşluk’a bas',
    pausedTitle: 'Duraklatıldı',
    pausedText: 'Biraz soluklan. Devam etmek için P ya da Esc’ye bas.',
    levelClearTitle: '{level}. bölüm tamam!',
    levelClearText: 'Şu ana kadarki skor: {score}. Sırada {next}. bölüm var.',
    nextLevel: 'Sonraki bölüm',
    gameOverTitle: 'Oyun bitti',
    gameOverText: 'Son skor: {score}.',
    wonTitle: 'Kazandın!',
    wonText: 'Üç bölümü de bitirdin. Son skor: {score}.',
    newBest: 'Yeni rekor!',
    bestScore: 'En iyi skor: {best}',
    playAgain: 'Tekrar oyna',
    powerWide: 'Geniş raket',
    powerMulti: 'Çoklu top',
    powerSlow: 'Yavaş top',
    powerLife: 'Ekstra can',
    powerWideInfo: 'Raket {wideSeconds} sn boyunca %{widePercent} daha geniş',
    powerMultiInfo: 'Oyuna iki top daha katılır',
    powerSlowInfo: 'Tüm toplar {slowSeconds} sn boyunca %{slowPercent} yavaş',
    powerLifeInfo: 'Bir can daha (en fazla {maxLives})',
    howTitle: 'Nasıl oynanır',
    ctlMove: 'Hareket',
    ctlMoveAlt: 'ya da fare / sürükle',
    ctlLaunch: 'Fırlat',
    ctlLaunchAlt: 'ya da tıkla / dokun',
    ctlPauseAlt: 'sekme gizlenince de durur',
    keySpace: 'Boşluk',
    goal: 'Bölümü geçmek için kırılabilen bütün tuğlaları kır. Üç bölümü de bitirirsen kazanırsın.',
    powerUpsTitle: 'Güçlendiriciler',
    bricksTitle: 'Tuğlalar',
    brickNormal: 'Normal: 1 vuruş',
    brickStrong: 'Sağlam: 2–3 vuruş',
    brickSteel: 'Çelik: kırılmaz',
    source: 'GitHub’da kaynak kod',
  }),
});

const formatters = new Map();

/**
 * Returns a supported language code, falling back to the default (English).
 * @param {unknown} value
 * @returns {'en'|'tr'}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : LANGUAGES[0];
}

/**
 * The language the toggle button switches to.
 * @param {string} lang
 * @returns {'en'|'tr'}
 */
export function otherLanguage(lang) {
  return normalizeLanguage(lang) === 'en' ? 'tr' : 'en';
}

/**
 * Formats a number with the language's digit grouping (1,250 or 1.250).
 * @param {string} lang
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(lang, value) {
  const code = normalizeLanguage(lang);
  if (!formatters.has(code)) formatters.set(code, new Intl.NumberFormat(LOCALES[code]));
  return formatters.get(code).format(value);
}

/**
 * Looks up a string and fills its {placeholders}. Numbers are formatted for
 * the language; a key missing in Turkish falls back to English, and an
 * unknown key is returned as is so a typo is visible instead of blank.
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const code = normalizeLanguage(lang);
  const template = STRINGS[code][key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.hasOwn(params, name)) return match;
    const value = params[name];
    return typeof value === 'number' ? formatNumber(code, value) : String(value);
  });
}
