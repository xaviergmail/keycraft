import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const workerName = 'sw.0123456789abcdef.js';

async function release(extra: Record<string, string> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'keycraft-release-'));
  const files = {
    'index.html': '<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./icon.svg"><script src="./app.js"></script>',
    'app.js': 'console.log("offline");',
    'manifest.webmanifest': JSON.stringify({ start_url: './', scope: './', display: 'standalone', icons: [{ src: './icon.svg' }] }),
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  };
  const precache = JSON.stringify(Object.entries(files).map(([name, content]) => [
    `./${name}`, createHash('sha256').update(content).digest('hex'),
  ]));
  for (const [name, content] of Object.entries(files)) await writeFile(join(directory, name), content);
  await writeFile(join(directory, 'sw.js'), `importScripts('./${workerName}');`);
  await writeFile(join(directory, workerName), `const PRECACHE = ${precache};`);
  for (const [name, content] of Object.entries(extra)) await writeFile(join(directory, name), content);
  return directory;
}

function verify(directory: string) {
  return spawnSync(process.execPath, ['tools/verify-site.mjs', directory], { encoding: 'utf8' });
}

test('verifies a complete local release closure', async () => {
  const directory = await release();
  try {
    const result = verify(directory);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects stale files and escaped references', async () => {
  const stale = await release({ 'old-hash.js': 'stale' });
  try {
    assert.notEqual(verify(stale).status, 0);
  } finally {
    await rm(stale, { recursive: true, force: true });
  }

  const escaped = await release();
  try {
    await writeFile(join(escaped, 'index.html'), '<link rel="manifest" href="../manifest.webmanifest">');
    assert.notEqual(verify(escaped).status, 0);
  } finally {
    await rm(escaped, { recursive: true, force: true });
  }
});

test('rejects an asset served from a different build and a missing cached dependency', async () => {
  const mixed = await release({ 'app.js': 'not this build' });
  try {
    assert.match(verify(mixed).stderr, /Wrong release content: app.js/);
    await rm(join(mixed, 'app.js'));
    assert.match(verify(mixed).stderr, /Missing HTML reference/);
  } finally {
    await rm(mixed, { recursive: true, force: true });
  }
});

test('rejects a precache worker that the browser cannot parse', async () => {
  const invalid = await release({ [workerName]: 'const PRECACHE = []; path.replace(/^/+/, \"\");' });
  try {
    assert.notEqual(verify(invalid).status, 0);
    assert.match(verify(invalid).stderr, /regular expression|Unexpected token/);
  } finally {
    await rm(invalid, { recursive: true, force: true });
  }
});
