import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAn1Detail } from '../scripts/lib/parse-an1.mjs';
import { parseApkmodyHtml, translateProxyUrl } from '../scripts/lib/parse-apkmody-html.mjs';
import { renderIndex, renderDetail, renderUnknown } from '../scripts/lib/render.mjs';
import { mergeServers } from '../scripts/lib/merge.mjs';

test('parseAn1Detail: title + spec + download + kategori', () => {
  const html = readFileSync(new URL('./fixtures/an1-real-boxing-2.html', import.meta.url), 'utf8');
  const d = parseAn1Detail(html, 'https://an1.com/6881-real-boxing-2-mod.html');
  assert.equal(d.source, 'an1');
  assert.equal(d.name, 'Real Boxing 2');
  assert.equal(d.version, '1.61.0');
  assert.equal(d.size_mb, 870.6);
  assert.equal(d.mod_info, 'Unlimited Money');
  assert.equal(d.type, 'game');
  assert.equal(d.category, 'Sport');
  assert.equal(d.developer, 'Vivid Games S.A.');
  assert.equal(d.download_url, 'https://an1.com/file_6881-dw.html');
  assert.equal(d.icon, 'https://an1.com/uploads/posts/2024-01/1705438686_real-boxing-2.png');
  assert.equal(d.updated, '2026-11-21');
  assert.equal(d.android_min, '7.0');
});

test('parseAn1Detail: halaman berita tanpa tombol download → null', () => {
  const d = parseAn1Detail('<html><head><title>1 TB cards from Longsys will be available soon</title></head><body><p>news</p></body></html>', 'https://an1.com/1-tb-cards-from-longsys-will-be-available-soon.html');
  assert.equal(d, null);
});

test('parseApkmodyHtml: JSON-LD berisi versi + ukuran + ikon', () => {
  const html = readFileSync(new URL('./fixtures/apkmody-clash-of-clans.html', import.meta.url), 'utf8');
  const post = { id: 415, slug: 'clash-of-clans', link: 'https://apkmody.com/games/clash-of-clans', modified: '2026-11-04T18:38:20', title: { rendered: 'Clash of Clans' } };
  const d = parseApkmodyHtml(html, post);
  assert.equal(d.source, 'apkmody');
  assert.equal(d.version, '19.32.4');
  assert.equal(d.size_mb, 840);
  assert.equal(d.mod_info, 'Unlimited Money');
  assert.equal(d.developer, 'Supercell');
  assert.equal(d.category, 'Strategy');
  assert.equal(d.icon, 'https://apkmody.com/wp-content/uploads/2022/05/Clash-of-Clans-MOD-APK-by-APKMODY.jpg');
  assert.equal(d.download_url, 'https://apkmody.com/games/clash-of-clans/download');
  assert.equal(translateProxyUrl('https://apkmody.com/games/clash-of-clans'), 'https://apkmody-com.translate.goog/games/clash-of-clans?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en');
});

const gameApp = {
  slug: 'real-boxing-2', name: 'Real Boxing 2', type: 'game', category: 'Sport',
  package_name: null, icon: null, description: 'Boxing.', version: '1.61.0', size_mb: 870.6, updated: '2026-11-21',
  servers: [
    { source: 'an1', version: '1.61.0', size_mb: 870.6, size_raw: '870.6Mb', mod_info: 'Unlimited Money', genre: 'Sport', developer: 'Vivid Games S.A.', updated: '2026-11-21', url: 'https://an1.com/6881-real-boxing-2-mod.html', download_url: 'https://an1.com/file_6881-dw.html', wp_id: null },
  ],
  sources: ['an1'],
};
const toolApp = { ...gameApp, slug: 'one-hand-control', name: 'One Hand Control', type: 'app', category: 'Tools', version: '1.4.1', size_mb: 13.8, servers: [{ source: 'modyolo', version: '1.4.1', size_mb: 13.8, size_raw: '13.8M', mod_info: 'Pro Unlocked', genre: 'Tools', developer: 'Nir Paniri', updated: '2026-11-21', url: 'https://modyolo.com/one-hand-control.html', download_url: 'https://modyolo.com/download/one-hand-control-617566', wp_id: 617566 }], sources: ['modyolo'] };
const unknownApp = { ...gameApp, slug: 'mystery', name: 'Mystery', type: 'unknown', version: null, size_mb: null };

test('renderIndex: 2 tab terpisah, pencarian hanya di tab aktif, unknown tidak di tab', () => {
  const html = renderIndex([gameApp, toolApp, unknownApp], '2026-11-21T00:00:00Z');
  assert.ok(html.includes('data-tab="game"'));
  assert.ok(html.includes('data-tab="app"'));
  assert.ok(html.includes('Game (1)'));
  assert.ok(html.includes('Aplikasi (1)'));
  // Unknown tidak masuk ke panel tab mana pun, hanya tautan peninjau.
  assert.ok(html.includes('/unknown/'));
  assert.ok(html.includes('Belum dikategorikan (1)'));
  const gamePanel = html.split('id="tab-game"')[1].split('id="tab-app"')[0];
  assert.ok(gamePanel.includes('Real Boxing 2'));
  assert.ok(!gamePanel.includes('One Hand Control'));
  assert.ok(!gamePanel.includes('Mystery'));
});

test('renderDetail: Server 3 — AN1', () => {
  const html = renderDetail(gameApp);
  assert.ok(html.includes('Server 3 — AN1'));
  assert.ok(html.includes('https://an1.com/file_6881-dw.html'));
});

test('renderUnknown: daftar peninjau', () => {
  const html = renderUnknown([unknownApp], '2026-11-21T00:00:00Z');
  assert.ok(html.includes('Belum dikategorikan (1)'));
  assert.ok(html.includes('/apps/mystery/'));
});

test('merge: type unknown kalah dari game/app', () => {
  const { apps } = mergeServers([
    { source: 'an1', slug: 'x', name: 'X Game', type: 'unknown', category: null, package_name: null, icon: null, description: null, version: '1.0', size_mb: 10, size_raw: '10M', mod_info: 'MOD', genre: null, developer: null, updated: '2026-11-21', url: 'https://an1.com/1-x-game-mod.html', download_url: 'https://an1.com/file_1-dw.html', wp_id: null },
    { source: 'modyolo', slug: 'x-game', name: 'X Game', type: 'game', category: 'Action', package_name: null, icon: null, description: null, version: '1.0', size_mb: 10, size_raw: '10M', mod_info: 'MOD', genre: 'Action', developer: null, updated: '2026-11-21', url: 'https://modyolo.com/x-game.html', download_url: 'https://modyolo.com/download/x-game-1', wp_id: 1 },
  ]);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].type, 'game');
  assert.equal(apps[0].servers.length, 2);
  // Digabung tanpa package → needs_review.
  assert.equal(apps[0].needs_review, true);
});

test('merge: versi tampil = versi terbaru antar server', () => {
  const { apps } = mergeServers([
    { source: 'modyolo', slug: 'x', name: 'X', type: 'game', category: 'Action', package_name: 'com.x', icon: null, description: null, version: '18.647.5', size_mb: 426.1, size_raw: '426.1M', mod_info: 'MOD', genre: 'Action', developer: null, updated: '2026-08-07', url: 'https://modyolo.com/x.html', download_url: 'https://modyolo.com/download/x-1', wp_id: 1 },
    { source: 'apkmody', slug: 'x', name: 'X', type: 'game', category: 'Action', package_name: 'com.x', icon: null, description: null, version: '19.32.4', size_mb: null, size_raw: null, mod_info: 'MOD', genre: 'Action', developer: null, updated: '2026-11-04', url: 'https://apkmody.com/games/x', download_url: 'https://apkmody.com/games/x/download', wp_id: 2 },
  ]);
  assert.equal(apps[0].version, '19.32.4');
  assert.equal(apps[0].size_mb, 426.1); // ukuran ikut server lain yang punya
  assert.equal(apps[0].needs_review, false); // ada package → tidak perlu tinjau
});

test('merge: emulator/launcher dipaksa jadi Aplikasi', () => {
  const { apps } = mergeServers([
    { source: 'modyolo', slug: 'ppsspp', name: 'PPSSPP Gold PSP Emulator', type: 'game', category: 'Simulation', package_name: 'org.ppsspp.ppssppgold', icon: null, description: null, version: '1.0', size_mb: 10, size_raw: '10M', mod_info: 'MOD', genre: 'Simulation', developer: null, updated: '2026-11-21', url: 'https://modyolo.com/ppsspp.html', download_url: 'https://modyolo.com/download/ppsspp-1', wp_id: 1 },
  ]);
  assert.equal(apps[0].type, 'app');
});
