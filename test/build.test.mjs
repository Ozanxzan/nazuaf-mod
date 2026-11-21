import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';
import { renderListing, renderDetailTemplate, renderSearchPage, pageUrl, chunkFileForIndex, PAGE_SIZE } from '../scripts/lib/render.mjs';

const app = {
  slug: 'moneyland', name: 'Moneyland', type: 'game', category: 'Casual',
  package_name: 'com.wixot.moneyland', icon: 'https://modyolo.com/wp-content/uploads/2022/07/moneyland.jpg',
  description: 'Investor game.', version: '3.13.5', size_mb: 149.5, updated: '2026-11-21',
  servers: [
    { source: 'apkmody', version: '3.13.4', size_mb: null, size_raw: null, mod_info: 'Unlimited Money', genre: 'Casual', developer: 'Rollic Games', updated: '2026-11-20', url: 'https://apkmody.com/games/moneyland', download_url: 'https://apkmody.com/games/moneyland/download', wp_id: 1 },
    { source: 'modyolo', version: '3.13.5', size_mb: 149.5, size_raw: '149.5M', mod_info: 'Unlimited Money, Scooter', genre: 'Casual', developer: 'Rollic Games', updated: '2026-11-21', url: 'https://modyolo.com/moneyland.html', download_url: 'https://modyolo.com/download/moneyland-155526', wp_id: 155526 },
  ],
  sources: ['apkmody', 'modyolo'],
};
const counts = { game: 250, app: 1, unknown: 0 };

test('pageUrl + chunkFileForIndex', () => {
  assert.equal(pageUrl('game', 1), '/');
  assert.equal(pageUrl('game', 2), '/game/page/2/');
  assert.equal(pageUrl('app', 1), '/app/');
  assert.equal(pageUrl('app', 3), '/app/page/3/');
  assert.equal(chunkFileForIndex(0), '/data/chunks/000.json');
  assert.equal(chunkFileForIndex(1000), '/data/chunks/001.json');
  assert.equal(chunkFileForIndex(30779), '/data/chunks/030.json');
  assert.equal(PAGE_SIZE, 100);
});

test('renderListing: 100 kartu per halaman + pager tautan + tab berupa tautan', () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ ...app, slug: `game-${i}`, name: `Game ${i}` }));
  const html = renderListing({ type: 'game', page: 1, totalPages: 3, items: many.slice(0, 100), counts, generatedAt: '2026-11-21T00:00:00Z' });
  assert.equal((html.match(/class="app-card"/g) || []).length, 100);
  assert.ok(html.includes('Game (250)'));
  assert.ok(html.includes('Aplikasi (1)'));
  assert.ok(html.includes('href="/app/"'));
  assert.ok(html.includes('Halaman 1 dari 3'));
  assert.ok(html.includes('href="/game/page/2/"'));
  assert.ok(html.includes('aria-disabled="true"')); // Sebelumnya nonaktif di hal. 1
  assert.ok(html.includes('APKMody') && html.includes('ModYolo'));
  assert.ok(html.includes('/apps/game-0/'));
  assert.ok(html.includes('action="/cari/"')); // pencarian header ke halaman cari
  const p2 = renderListing({ type: 'game', page: 2, totalPages: 3, items: many.slice(100, 200), counts, generatedAt: '2026-11-21T00:00:00Z' });
  assert.ok(p2.includes('href="/"')); // Sebelumnya kembali ke hal. 1
  assert.ok(p2.includes('Halaman 2 dari 3'));
});

test('renderDetailTemplate: slug dari URL + ambil chunk JSON', () => {
  const html = renderDetailTemplate();
  assert.ok(html.includes('/data/slugs.json'));
  assert.ok(html.includes('/data/chunks/'));
  assert.ok(html.includes("parts[0] === 'apps'"));
  assert.ok(html.includes('Download di'));
  assert.ok(html.includes('Server '));
  assert.ok(html.includes('an1'));
});

test('renderSearchPage: indeks pencarian + parameter q', () => {
  const html = renderSearchPage(30776);
  assert.ok(html.includes('/data/search.json'));
  assert.ok(html.includes('30776 entri'));
  assert.ok(html.includes("params.get('q')"));
});

test('buildSite menulis listing + chunk + indeks + _redirects, tanpa halaman detail per entri', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mod-build-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  const many = Array.from({ length: 250 }, (_, i) => ({ ...app, slug: `game-${i}`, name: `Game ${i}` }));
  writeFileSync(dataPath, JSON.stringify({ apps: many, generated_at: '2026-11-21T00:00:00Z' }));
  const r = await buildSite({ dataPath, outDir });
  assert.equal(r.count, 250);
  assert.ok(r.files < 20000);
  assert.ok(existsSync(join(outDir, 'index.html')));
  assert.ok(existsSync(join(outDir, 'game', 'page', '2', 'index.html')));
  assert.ok(existsSync(join(outDir, 'game', 'page', '3', 'index.html')));
  assert.ok(!existsSync(join(outDir, 'game', 'page', '4')));
  assert.ok(existsSync(join(outDir, 'app', 'index.html')));
  assert.ok(existsSync(join(outDir, 'detail', 'index.html')));
  assert.ok(existsSync(join(outDir, 'cari', 'index.html')));
  assert.ok(existsSync(join(outDir, 'data', 'chunks', '000.json')));
  assert.ok(existsSync(join(outDir, 'data', 'slugs.json')));
  assert.ok(existsSync(join(outDir, 'data', 'search.json')));
  // Tidak ada lagi halaman detail statis per entri.
  assert.ok(!existsSync(join(outDir, 'apps', 'game-0')));
  assert.equal(readFileSync(join(outDir, '_redirects'), 'utf8'), '/apps/* /detail/ 200\n');
  const chunk = JSON.parse(readFileSync(join(outDir, 'data', 'chunks', '000.json'), 'utf8'));
  assert.equal(chunk.length, 250);
  assert.ok(chunk.some((a) => a.slug === 'game-0' && a.servers.length === 2));
  const slugs = JSON.parse(readFileSync(join(outDir, 'data', 'slugs.json'), 'utf8'));
  assert.deepEqual(slugs, [...slugs].sort());
  assert.ok(slugs.includes('game-0'));
  const search = JSON.parse(readFileSync(join(outDir, 'data', 'search.json'), 'utf8'));
  assert.equal(search.length, 250);
  assert.ok(search.some((e) => e.s === 'game-0' && e.n === 'Game 0'));
  const index = readFileSync(join(outDir, 'index.html'), 'utf8');
  assert.equal((index.match(/class="app-card"/g) || []).length, 100);
  assert.ok(index.includes('href="/game/page/2/"'));
  // Satu file listing tidak boleh mendekati batas 25 MB Pages.
  for (const f of readdirSync(outDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name))) {
    const { size } = statSync(f);
    assert.ok(size < 25 * 1024 * 1024, `${f} ${size} byte melebihi 25 MB`);
  }
});
