import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';
import { renderIndex, renderDetail } from '../scripts/lib/render.mjs';

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

test('renderDetail menampilkan kedua server + tombol download per server', () => {
  const html = renderDetail(app);
  assert.ok(html.includes('Server 1 — APKMody'));
  assert.ok(html.includes('Server 2 — ModYolo'));
  assert.ok(html.includes('https://apkmody.com/games/moneyland/download'));
  assert.ok(html.includes('https://modyolo.com/download/moneyland-155526'));
  assert.ok(html.includes('Unlimited Money, Scooter'));
  assert.ok(html.includes('Blog nazuaf.com'));
  assert.ok(html.includes('mod.nazuaf.com'));
  assert.ok(!html.includes('.apk"')); // tidak ada link file .apk langsung
});

test('renderIndex: tab Game/Aplikasi + pencarian per tab + badge server', () => {
  const html = renderIndex([app], '2026-11-21T00:00:00Z');
  assert.ok(html.includes('id="q"'));
  assert.ok(html.includes('data-tab="game"'));
  assert.ok(html.includes('data-tab="app"'));
  assert.ok(html.includes('Game (1)'));
  assert.ok(html.includes('APKMody') && html.includes('ModYolo'));
  assert.ok(html.includes('/apps/moneyland/'));
  // Entri game hanya ada di panel tab Game.
  const gamePanel = html.split('id="tab-game"')[1].split('id="tab-app"')[0];
  assert.ok(gamePanel.includes('Moneyland'));
});

test('renderIndex: pagination 100 per halaman di tiap tab', () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ ...app, slug: `game-${i}`, name: `Game ${i}` }));
  const html = renderIndex(many, '2026-11-21T00:00:00Z');
  assert.ok(html.includes('PAGE_SIZE = 100'));
  assert.ok(html.includes('data-pager="game"'));
  assert.ok(html.includes('data-pager="app"'));
  assert.ok(html.includes('Sebelumnya') && html.includes('Berikutnya'));
  assert.ok(html.includes('Halaman '));
});

test('buildSite menulis index + detail', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mod-build-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  writeFileSync(dataPath, JSON.stringify({ apps: [app], generated_at: '2026-11-21T00:00:00Z' }));
  const r = await buildSite({ dataPath, outDir });
  assert.equal(r.count, 1);
  assert.ok(existsSync(join(outDir, 'index.html')));
  assert.ok(existsSync(join(outDir, 'apps', 'moneyland', 'index.html')));
  const detail = readFileSync(join(outDir, 'apps', 'moneyland', 'index.html'), 'utf8');
  assert.ok(detail.includes('Server 2 — ModYolo'));
});
