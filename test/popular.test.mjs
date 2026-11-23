import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPopular, orderForListing, POPULAR_SIZE } from '../scripts/lib/popular.mjs';
import { renderListing } from '../scripts/lib/render.mjs';
import { buildSite } from '../scripts/build.mjs';

const app = {
  name: 'Test', type: 'game', category: 'Arcade', package_name: null,
  icon: '', description: '', version: '1.0', size_mb: 10, updated: '2026-11-21',
  servers: [], sources: ['modyolo'],
};
const counts = { game: 250, app: 150, unknown: 0 };

test('loadPopular: file tidak ada / rusak → daftar kosong', () => {
  assert.deepEqual(loadPopular('/tmp/tidak-ada-popular.json'), { game: [], app: [] });
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mod-popular-'));
  const p = join(dir, 'popular.json');
  writeFileSync(p, '{ bukan json');
  assert.deepEqual(loadPopular(p), { game: [], app: [] });
  writeFileSync(p, JSON.stringify({ game: ['a', 123, null], app: 'bukan-array' }));
  assert.deepEqual(loadPopular(p), { game: ['a'], app: [] });
  assert.equal(POPULAR_SIZE, 100);
});

test('orderForListing: populer dulu sesuai urutan file, sisanya urut slug, tanpa duplikat', () => {
  const list = ['alpha', 'beta', 'gamma', 'delta', 'zeta'].map((s) => ({ ...app, slug: s, name: s }));
  const out = orderForListing(list, ['zeta', 'tidak-ada', 'beta', 'zeta']);
  assert.deepEqual(out.map((a) => a.slug), ['zeta', 'beta', 'alpha', 'delta', 'gamma']);
  assert.deepEqual(orderForListing(list, []).map((a) => a.slug), ['alpha', 'beta', 'delta', 'gamma', 'zeta']);
});

test('renderListing: catatan populer hanya di halaman 1 kalau popularCount > 0', () => {
  const items = [{ ...app, slug: 'minecraft', name: 'Minecraft' }];
  const p1 = renderListing({ type: 'game', page: 1, totalPages: 3, items, counts, generatedAt: '2026-11-21T00:00:00Z', popularCount: 100 });
  assert.ok(p1.includes('100 game populer ditampilkan dulu'));
  const p1b = renderListing({ type: 'app', page: 1, totalPages: 2, items, counts, generatedAt: '2026-11-21T00:00:00Z', popularCount: 100 });
  assert.ok(p1b.includes('100 aplikasi populer ditampilkan dulu'));
  const p2 = renderListing({ type: 'game', page: 2, totalPages: 3, items, counts, generatedAt: '2026-11-21T00:00:00Z', popularCount: 100 });
  assert.ok(!p2.includes('populer ditampilkan dulu'));
  const p1c = renderListing({ type: 'game', page: 1, totalPages: 3, items, counts, generatedAt: '2026-11-21T00:00:00Z' });
  assert.ok(!p1c.includes('populer ditampilkan dulu'));
});

test('buildSite: halaman 1 = populer dulu, halaman 2 bersih dari populer, slugs.json tetap terurut', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mod-popular-build-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  const games = Array.from({ length: 120 }, (_, i) => ({ ...app, slug: `game-${String(i).padStart(3, '0')}`, name: `Game ${i}`, type: 'game' }));
  const appl = Array.from({ length: 120 }, (_, i) => ({ ...app, slug: `app-${String(i).padStart(3, '0')}`, name: `App ${i}`, type: 'app' }));
  writeFileSync(dataPath, JSON.stringify({ apps: [...games, ...appl], generated_at: '2026-11-21T00:00:00Z' }));
  writeFileSync(join(dir, 'popular.json'), JSON.stringify({ game: ['game-119', 'game-005'], app: ['app-100'] }));
  await buildSite({ dataPath, outDir });

  const index = readFileSync(join(outDir, 'index.html'), 'utf8');
  const firstCards = [...index.matchAll(/\/apps\/([a-z0-9-]+)\//g)].map((m) => m[1]);
  assert.deepEqual(firstCards.slice(0, 2), ['game-119', 'game-005']);
  assert.ok(index.includes('2 game populer ditampilkan dulu'));
  const page2 = readFileSync(join(outDir, 'game', 'page', '2', 'index.html'), 'utf8');
  assert.ok(!page2.includes('/apps/game-119/') && !page2.includes('/apps/game-005/'));
  assert.ok(!page2.includes('populer ditampilkan dulu'));
  const appIndex = readFileSync(join(outDir, 'app', 'index.html'), 'utf8');
  const appCards = [...appIndex.matchAll(/\/apps\/([a-z0-9-]+)\//g)].map((m) => m[1]);
  assert.equal(appCards[0], 'app-100');
  assert.ok(appIndex.includes('1 aplikasi populer ditampilkan dulu'));
  // Binary search halaman detail tetap aman: slugs.json terurut.
  const slugs = JSON.parse(readFileSync(join(outDir, 'data', 'slugs.json'), 'utf8'));
  assert.deepEqual(slugs, [...slugs].sort());
  assert.ok(existsSync(join(outDir, 'data', 'chunks', '000.json')));
});

test('buildSite tanpa popular.json: perilaku lama (urut abjad semua)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mod-popular-none-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  const games = Array.from({ length: 120 }, (_, i) => ({ ...app, slug: `game-${String(i).padStart(3, '0')}`, name: `Game ${i}`, type: 'game' }));
  writeFileSync(dataPath, JSON.stringify({ apps: games, generated_at: '2026-11-21T00:00:00Z' }));
  await buildSite({ dataPath, outDir });
  const index = readFileSync(join(outDir, 'index.html'), 'utf8');
  assert.ok(!index.includes('populer ditampilkan dulu'));
  assert.ok(index.indexOf('/apps/game-000/') < index.indexOf('/apps/game-001/'));
});
