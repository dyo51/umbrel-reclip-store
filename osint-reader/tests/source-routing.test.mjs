import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceRequestPath } from '../web/markdown.js';

const appSource = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

test('builds same-origin paths for the index and approved Markdown documents', () => {
  assert.equal(sourceRequestPath('README.md'), '/source/README.md');
  assert.equal(sourceRequestPath('docs/academic.md'), '/source/docs/academic.md');
});

test('frontend source fetches stay on the app origin', () => {
  assert.match(appSource, /sourceRequestPath\(path\)/);
  assert.doesNotMatch(appSource, /https:\/\/raw\.githubusercontent\.com\//);
});

test('same-origin fetches retain Umbrel authentication for config and source routes', () => {
  const sourceFetch = appSource.match(/async function fetchRemoteMarkdown\(path\) \{([\s\S]*?)\n\}/)?.[1];
  const configFetch = appSource.match(/async function loadConfig\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(sourceFetch, 'source fetch implementation should be present');
  assert.ok(configFetch, 'config fetch implementation should be present');
  assert.match(sourceFetch, /credentials:\s*'same-origin'/);
  assert.match(configFetch, /credentials:\s*'same-origin'/);
});

test('rejects paths that could escape the fixed source route', () => {
  for (const path of ['../README.md', 'docs/../README.md', '/README.md', 'https://example.com/README.md', 'README.md?query=x', 'docs//academic.md']) {
    assert.throws(() => sourceRequestPath(path), /Caminho inválido/);
  }
});
