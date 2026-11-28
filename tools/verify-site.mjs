#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { Script } from 'node:vm';

const [directory] = process.argv.slice(2);

function fail(message) {
  throw new Error(message);
}

function filesUnder(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(root, path));
    else if (entry.isFile()) files.push(relative(root, path).replaceAll(sep, '/'));
    else fail(`Unsupported entry in release: ${relative(root, path)}`);
  }
  return files;
}

function cleanReference(reference, fromFile) {
  if (!reference || reference.startsWith('#') || reference.startsWith('data:')) return undefined;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) fail(`External or absolute asset reference: ${reference}`);
  const sentinel = 'https://keycraft.invalid/keycraft/';
  const base = new URL(fromFile, sentinel);
  let resolved;
  try {
    resolved = new URL(reference, base);
  } catch {
    fail(`Invalid asset reference: ${reference}`);
  }
  let pathname;
  try {
    pathname = decodeURIComponent(resolved.pathname);
  } catch {
    fail(`Invalid escaped asset reference: ${reference}`);
  }
  if (resolved.origin !== base.origin || !pathname.startsWith('/keycraft/')) fail(`Escaped asset reference: ${reference}`);
  const candidate = pathname.slice('/keycraft/'.length);
  return candidate || 'index.html';
}

function requireFile(root, name, context) {
  const target = resolve(root, name);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootPrefix)) fail(`Asset escapes release: ${context}`);
  if (!existsSync(target) || !lstatSync(target).isFile()) fail(`Missing ${context}: ${name}`);
  return target;
}

function referencesInHtml(text) {
  const references = [];
  const pattern = /\b(?:src|href)=(["'])(.*?)\1/gi;
  for (const match of text.matchAll(pattern)) references.push(match[2]);
  return references;
}

function referencesInCss(text) {
  const references = [];
  const pattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  for (const match of text.matchAll(pattern)) references.push(match[2]);
  return references;
}

function parsePrecache(worker) {
  const match = worker.match(/const\s+PRECACHE\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) fail('Versioned service worker has no generated precache list');
  try {
    const list = JSON.parse(match[1]);
    if (!Array.isArray(list) || list.some(entry => !Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== 'string' || !/^[0-9a-f]{64}$/.test(entry[1]))) {
      fail('Invalid service worker precache list');
    }
    return list;
  } catch (error) {
    fail(`Invalid service worker precache JSON: ${error.message}`);
  }
}

function verify(directoryName) {
  if (!directoryName) fail('Usage: node tools/verify-site.mjs <site-directory>');
  const root = resolve(directoryName);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) fail(`Release directory does not exist: ${directoryName}`);
  const allFiles = filesUnder(root);
  if (!allFiles.length) fail('Release directory is empty');

  const allowed = new Set();
  const index = readFileSync(requireFile(root, 'index.html', 'entry HTML'), 'utf8');
  allowed.add('index.html');
  for (const reference of referencesInHtml(index)) {
    const target = cleanReference(reference, 'index.html');
    if (target) {
      requireFile(root, target, `HTML reference ${reference}`);
      allowed.add(target);
    }
  }

  const manifestName = [...allowed].find(name => name === 'manifest.webmanifest');
  if (!manifestName) fail('Entry HTML does not reference manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(requireFile(root, manifestName, 'web manifest'), 'utf8'));
  if (manifest.start_url !== './' && manifest.start_url !== '.') fail(`Manifest start_url must stay inside this site: ${manifest.start_url}`);
  if (manifest.scope !== './' && manifest.scope !== '.') fail(`Manifest scope must stay inside this site: ${manifest.scope}`);
  if (manifest.display !== 'standalone') fail('Manifest must use standalone display mode');
  if (!Array.isArray(manifest.icons) || !manifest.icons.length) fail('Manifest has no install icons');
  for (const icon of manifest.icons) {
    if (!icon || typeof icon.src !== 'string') fail('Manifest contains an invalid icon');
    const target = cleanReference(icon.src, 'manifest.webmanifest');
    if (!target) fail(`Manifest icon is not a local asset: ${icon.src}`);
    requireFile(root, target, `manifest icon ${icon.src}`);
    allowed.add(target);
  }

  const required = new Set(allowed);
  const stableWorker = readFileSync(requireFile(root, 'sw.js', 'stable service worker'), 'utf8');
  new Script(stableWorker, { filename: 'sw.js' });
  allowed.add('sw.js');
  const workerRefs = [...stableWorker.matchAll(/importScripts\(\s*["']\.\/(sw\.[0-9a-f]{16}\.js)["']\s*\)/g)].map(match => match[1]);
  if (workerRefs.length !== 1) fail('sw.js must import exactly one content-versioned worker');
  const versionedName = workerRefs[0];
  requireFile(root, versionedName, 'versioned service worker');
  allowed.add(versionedName);
  const versionedWorker = readFileSync(join(root, versionedName), 'utf8');
  new Script(versionedWorker, { filename: versionedName });
  const cached = new Set();
  for (const [reference, expected] of parsePrecache(versionedWorker)) {
    const target = cleanReference(reference, versionedName);
    if (!target || cached.has(target) || target === 'sw.js' || target === versionedName) {
      fail(`Invalid or duplicate precache asset: ${reference}`);
    }
    if (/\.(?:[cm]?tsx?|map)$/i.test(target)) fail(`Raw source in release: ${target}`);
    const asset = readFileSync(requireFile(root, target, `service worker precache ${reference}`));
    if (createHash('sha256').update(asset).digest('hex') !== expected) fail(`Wrong release content: ${target}`);
    cached.add(target);
    allowed.add(target);
  }
  for (const target of required) {
    if (!cached.has(target)) fail(`Required asset is not available offline: ${target}`);
  }

  for (const name of allFiles.filter(file => file.endsWith('.css'))) {
    const text = readFileSync(join(root, name), 'utf8');
    for (const reference of referencesInCss(text)) {
      const target = cleanReference(reference, name);
      if (!target) continue;
      requireFile(root, target, `CSS reference ${reference}`);
      if (!cached.has(target)) fail(`CSS asset is not available offline: ${target}`);
    }
  }

  const unapproved = allFiles.filter(name => !allowed.has(name)).sort();
  if (unapproved.length) fail(`Unapproved or stale release files: ${unapproved.join(', ')}`);
  process.stdout.write(`Verified KeyCraft release: ${allFiles.length} files, ${allowed.size} referenced assets.\n`);
}

try {
  verify(directory);
} catch (error) {
  process.stderr.write(`Release verification failed: ${error.message}\n`);
  process.exitCode = 1;
}
