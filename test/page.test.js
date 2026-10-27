import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../src/config.js';
import { STRINGS, translate } from '../src/i18n.js';
import { helpTextParams } from '../src/view.js';

const ROOT = new URL('../', import.meta.url);
const HTML = readFileSync(new URL('index.html', ROOT), 'utf8');
const PARAMS = helpTextParams(DEFAULT_CONFIG);

/** Number of times `pattern` occurs in the page. */
function count(pattern) {
  return HTML.match(pattern)?.length ?? 0;
}

/** Asserts that `key` is translated in both languages. */
function assertKnown(key) {
  assert.ok(key in STRINGS.en && key in STRINGS.tr, `missing i18n key ${key}`);
}

test('page: every data-i18n text exists in both languages and matches the English default', () => {
  const elements = [...HTML.matchAll(/<(\w+)[^>]*\sdata-i18n="(\w+)"[^>]*>([^<]*)<\/\1>/g)];
  assert.ok(elements.length > 20);
  assert.equal(elements.length, count(/\sdata-i18n="/g), 'each data-i18n element holds plain text only');
  for (const [, , key, text] of elements) {
    assertKnown(key);
    assert.equal(text, translate('en', key, PARAMS), key);
  }
});

test('page: every data-i18n-label exists in both languages and matches the English default', () => {
  const labels = [...HTML.matchAll(/data-i18n-label="(\w+)" aria-label="([^"]*)"/g)];
  assert.ok(labels.length > 0);
  assert.equal(labels.length, count(/data-i18n-label="/g));
  for (const [, key, label] of labels) {
    assertKnown(key);
    assert.equal(label, translate('en', key, PARAMS), key);
  }
  assert.ok(HTML.includes(`<title>${STRINGS.en.pageTitle}</title>`));
});

test('page: head has the sharing tags, the favicon and the module entry point', () => {
  const required = [
    '<!doctype html>',
    '<html lang="en">',
    '<meta charset="utf-8">',
    '<meta name="viewport"',
    '<meta name="description"',
    '<meta property="og:title"',
    '<meta property="og:description"',
    '<meta property="og:url" content="https://celaldrg.github.io/breakout/">',
    '<meta property="og:image" content="https://celaldrg.github.io/breakout/docs/screenshot.png">',
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,',
    '<script type="module" src="src/main.js"></script>',
    'href="https://github.com/celaldrg/breakout"',
  ];
  for (const snippet of required) assert.ok(HTML.includes(snippet), snippet);
});

test('page: scripts, styles and module imports are local files that exist', () => {
  const pageFiles = [...HTML.matchAll(/<(?:script[^>]*\ssrc|link rel="stylesheet" href)="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(pageFiles.sort(), ['src/main.js', 'style.css']);
  for (const file of pageFiles) assert.ok(existsSync(new URL(file, ROOT)), file);

  const srcDir = new URL('src/', ROOT);
  for (const name of readdirSync(srcDir)) {
    const source = readFileSync(new URL(name, srcDir), 'utf8');
    for (const [, spec] of source.matchAll(/from '([^']+)'/g)) {
      assert.ok(spec.startsWith('./'), `${name} imports ${spec}`);
      assert.ok(existsSync(new URL(spec, srcDir)), `${name} imports missing ${spec}`);
    }
  }
});
