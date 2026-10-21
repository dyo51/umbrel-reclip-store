import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSections, parseLegendaryIndex, parseSections, safeExternalUrl, shouldRetryStatus } from '../web/markdown.js';

test('extracts only local Legendary category documents from the README index', () => {
  const markdown = `# Legendary OSINT\n\n## Table of Contents\n- [People & Social](./docs/people-social.md)\n- [Aviation](./docs/aviation.md)\n- [External](https://example.org/)\n- [Missing](./README.md)\n`;
  assert.deepEqual(parseLegendaryIndex(markdown), [
    { title: 'People & Social', path: 'docs/people-social.md' },
    { title: 'Aviation', path: 'docs/aviation.md' },
  ]);
});

test('parses sections, list entries, and multiple safe outbound links', () => {
  const markdown = `# Directory\n\n## People Search\n- [OSINT Framework](https://osintframework.com/) — A directory with [documentation](https://example.org/docs).\n\n### Social\n- [Mastodon](https://joinmastodon.org/) — Federated social network.\n`;
  const sections = parseSections(markdown);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, 'People Search');
  assert.equal(sections[0].items[0].links[0].label, 'OSINT Framework');
  assert.equal(sections[0].items[0].links[0].url, 'https://osintframework.com/');
  assert.equal(sections[0].items[0].links[1].label, 'documentation');
  assert.equal(sections[1].title, 'Social');
  assert.equal(sections[1].items[0].text.includes('Federated social network.'), true);
});

test('rejects unsafe and malformed outbound URLs', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('data:text/html,hello'), null);
  assert.equal(safeExternalUrl('https://example.org/path'), 'https://example.org/path');
  assert.equal(safeExternalUrl('not a url'), null);
});

test('filters resource entries across titles, descriptions, and link labels', () => {
  const source = [
    { title: 'BlueSky', category: 'People', items: [{ text: 'Find public profiles', links: [{ label: 'Atlas', url: 'https://example.org/' }] }] },
    { title: 'World imagery', category: 'Maps', items: [{ text: 'Satellite imagery', links: [{ label: 'Terra', url: 'https://example.net/' }] }] },
  ];
  const filtered = filterSections(source, 'atlas');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, 'BlueSky');
  assert.equal(filtered[0].items.length, 1);
  assert.equal(filterSections(source, 'people')[0].title, 'BlueSky');
  assert.deepEqual(filterSections(source, 'no-such-resource'), []);
});

test('strips raw HTML tags from parsed entries', () => {
  const sections = parseSections('## Test\n- [Safe](https://example.org/) <img src=x onerror=alert(1)>');
  assert.equal(sections[0].items[0].text.includes('<img'), false);
  assert.equal(sections[0].items[0].links[0].url, 'https://example.org/');
});

test('retries only transient upstream HTTP statuses', () => {
  assert.equal(shouldRetryStatus(429), true);
  assert.equal(shouldRetryStatus(503), true);
  assert.equal(shouldRetryStatus(404), false);
  assert.equal(shouldRetryStatus(403), false);
});

test('removes leading emoji decoration from catalog and section headings', () => {
  const index = parseLegendaryIndex('- [📚 Academic & Research Databases](./docs/academic.md)');
  const sections = parseSections('## 📚 Academic & Research Databases\n- [Google Scholar](https://example.org/)');
  assert.equal(index[0].title, 'Academic & Research Databases');
  assert.equal(sections[0].title, 'Academic & Research Databases');
});
