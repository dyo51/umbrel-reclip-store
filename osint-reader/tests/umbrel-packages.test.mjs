import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packages = [
  {
    id: 'custom-store-legendary-osint',
    manifest: new URL('../../custom-store-legendary-osint/umbrel-app.yml', import.meta.url),
    compose: new URL('../../custom-store-legendary-osint/docker-compose.yml', import.meta.url),
  },
  {
    id: 'custom-store-awesome-osint',
    manifest: new URL('../../custom-store-awesome-osint/umbrel-app.yml', import.meta.url),
    compose: new URL('../../custom-store-awesome-osint/docker-compose.yml', import.meta.url),
  },
];

function readManifestPort(manifestUrl) {
  const text = readFileSync(manifestUrl, 'utf8');
  const match = text.match(/^port:\s*["']?(\d+)["']?\s*$/m);
  assert.ok(match, `manifest must declare a numeric host-facing port: ${manifestUrl}`);
  return Number(match[1]);
}

function readProxyPort(composeUrl) {
  const text = readFileSync(composeUrl, 'utf8');
  const match = text.match(/^\s+APP_PORT:\s*(\d+)\s*$/m);
  assert.ok(match, `app_proxy must declare its internal service port: ${composeUrl}`);
  return Number(match[1]);
}

test('OSINT app launch ports are unique across the two tiles', () => {
  const ports = packages.map(({ manifest }) => readManifestPort(manifest));
  assert.equal(new Set(ports).size, packages.length, 'each tile needs its own host-facing port');
});

test('OSINT app launch ports avoid Umbrel-reserved ports', () => {
  const reserved = new Set([80, 443, 2000]);
  for (const { id, manifest } of packages) {
    const port = readManifestPort(manifest);
    assert.equal(reserved.has(port), false, `${id} must not claim reserved Umbrel port ${port}`);
  }
});

test('app_proxy continues to target the Nginx internal port', () => {
  for (const { id, compose } of packages) {
    assert.equal(readProxyPort(compose), 80, `${id} Nginx service listens internally on port 80`);
  }
});
