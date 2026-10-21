import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

test('HTML has unique IDs for the app shell', () => {
  assert.equal(new Set(ids).size, ids.length);
});

test('every literal DOM ID used by the app exists in the HTML', () => {
  const references = [...app.matchAll(/\bbyId\('([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(references)].filter((id) => !ids.includes(id));
  assert.deepEqual(missing, []);
});

test('the app shell uses an accessible search form and main landmark', () => {
  assert.match(html, /<form id="search-form"[^>]*role="search"/);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /<label for="search-input">/);
});
