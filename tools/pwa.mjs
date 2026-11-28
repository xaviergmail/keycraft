import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STATIC_FILES = ['manifest.webmanifest', 'icon.svg', 'icon-192.svg', 'icon-512.svg'];

function normaliseAssetPath(name) {
  const clean = name.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!clean || clean === '.' || clean.split('/').some(part => part === '..')) {
    throw new Error(`PWA asset escapes the output scope: ${name}`);
  }
  return `./${clean}`;
}

function serviceWorker(version, assets) {
  const precache = JSON.stringify(assets);
  return `/* KeyCraft offline worker ${version} */
const VERSION = ${JSON.stringify(version)};
const PRECACHE = ${precache};
const CACHE_PREFIX = 'keycraft-pwa-';
const scopePath = encodeURIComponent(new URL(self.registration.scope).pathname);
const CACHE_NAME = CACHE_PREFIX + scopePath + '-' + VERSION;
const OWNED_PREFIX = CACHE_PREFIX + scopePath + '-';

function inScope(request) {
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

function relativePath(request) {
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  return url.pathname.slice(scope.pathname.length);
}

function immutableAsset(request) {
  return inScope(request) && relativePath(request).startsWith('assets/');
}

async function selectedMatch(request) {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request, { ignoreSearch: true });
}

async function oldImmutableMatch(request) {
  if (!immutableAsset(request)) return undefined;
  const names = await caches.keys();
  for (const name of names) {
    if (!name.startsWith(OWNED_PREFIX) || name === CACHE_NAME) continue;
    const cache = await caches.open(name);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

async function scopedClients() {
  const scope = new URL(self.registration.scope);
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  return clients.filter(client => {
    try {
      const url = new URL(client.url);
      return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
    } catch {
      return false;
    }
  });
}

async function tellClients(message) {
  for (const client of await scopedClients()) client.postMessage({ ...message, version: VERSION });
}

async function removeOldCaches() {
  if ((await scopedClients()).length) return;
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith(OWNED_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // A deployment can switch releases while this worker downloads its shell.
    // Verify all responses before making this generation eligible to activate.
    const entries = await Promise.all(PRECACHE.map(async ([path, expected]) => {
      const request = new Request(new URL(path, self.registration.scope), { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok || response.redirected) throw new Error('Missing release asset: ' + path);
      const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
      let actual = '';
      for (const byte of new Uint8Array(digest)) actual += byte.toString(16).padStart(2, '0');
      if (actual !== expected) throw new Error('Wrong release asset: ' + path);
      return [request, response];
    }));
    const cache = await caches.open(CACHE_NAME);
    for (const [request, response] of entries) await cache.put(request, response);
    await tellClients({ type: 'KEYCRAFT_UPDATE_READY' });
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // No clients.claim(): existing tabs keep their old generation until their
    // own safe navigation. Old caches are removed only when no scoped tab can need them.
    await removeOldCaches();
    await tellClients({ type: 'KEYCRAFT_OFFLINE_READY' });
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'KEYCRAFT_ACTIVATE') {
    event.waitUntil(self.skipWaiting());
  } else if (event.data?.type === 'KEYCRAFT_STATUS') {
    event.waitUntil(tellClients({ type: 'KEYCRAFT_OFFLINE_READY' }));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !inScope(request)) return;
  event.respondWith((async () => {
    const lookup = request.mode === 'navigate' && relativePath(request) === ''
      ? new URL('./index.html', self.registration.scope).href
      : request;
    return await selectedMatch(lookup) ?? await oldImmutableMatch(request) ?? fetch(request);
  })());
});
`;
}

/** @returns {import('vite').Plugin} */
export function pwa() {
  let publicDir;

  return {
    name: 'keycraft-pwa',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir || join(config.root, 'public');
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const names = [...new Set([...Object.keys(bundle), ...STATIC_FILES])].sort();
        const assets = names.map(name => {
          const entry = bundle[name];
          const content = entry
            ? (entry.type === 'chunk' ? entry.code : entry.source)
            : readFileSync(join(publicDir, name));
          const hash = createHash('sha256').update(content).digest('hex');
          return [normaliseAssetPath(name), hash];
        });
        const version = createHash('sha256').update(serviceWorker('', assets)).digest('hex').slice(0, 16);
        const versionedName = `sw.${version}.js`;
        this.emitFile({ type: 'asset', fileName: versionedName, source: serviceWorker(version, assets) });
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: `/* KeyCraft stable worker entry ${version} */\nimportScripts('./${versionedName}');\n`,
        });
      },
    },
  };
}
