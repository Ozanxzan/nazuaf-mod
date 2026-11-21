import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeServers } from '../scripts/lib/merge.mjs';
import { validateEntry, parseSizeMb, dedupKey } from '../scripts/lib/schema.mjs';

const base = (over = {}) => ({
  source: 'modyolo', slug: 'moneyland', name: 'Moneyland', type: 'game', category: 'Casual',
  package_name: 'com.wixot.moneyland', icon: 'https://x/icon.jpg', description: 'd',
  version: '3.13.5', size_mb: 149.5, size_raw: '149.5M', mod_info: 'Unlimited Money',
  genre: 'Casual', developer: 'Rollic', updated: '2026-11-21',
  url: 'https://modyolo.com/moneyland.html', download_url: 'https://modyolo.com/download/moneyland-155526', wp_id: 155526,
  ...over,
});

test('merge: dedup via package_name, kedua server dipertahankan', () => {
  const { apps, mergedCount } = mergeServers([
    base(),
    base({ source: 'apkmody', slug: 'moneyland', version: '3.13.4', size_mb: null, size_raw: null, mod_info: 'Unlimited Money', url: 'https://apkmody.com/games/moneyland', download_url: 'https://apkmody.com/games/moneyland/download', wp_id: 1, package_name: 'com.wixot.moneyland' }),
  ]);
  assert.equal(apps.length, 1);
  assert.equal(mergedCount, 1);
  assert.equal(apps[0].servers.length, 2);
  assert.deepEqual(apps[0].sources, ['apkmody', 'modyolo']); // urutan kanonis server
  assert.equal(apps[0].package_name, 'com.wixot.moneyland');
  assert.equal(apps[0].version, '3.13.5'); // server paling lengkap jadi utama
});

test('merge: fallback nama dinormalisasi bila tanpa package', () => {
  const { apps } = mergeServers([
    base({ package_name: null, name: 'Clash of Clans' }),
    base({ source: 'apkmody', package_name: null, name: 'Clash of Clans!', version: '19.0', url: 'https://apkmody.com/games/clash-of-clans', download_url: 'https://apkmody.com/games/clash-of-clans/download' }),
  ]);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].servers.length, 2);
});

test('merge: nama berbeda tidak digabung', () => {
  const { apps } = mergeServers([base(), base({ name: 'Other Game', package_name: 'com.other.game', slug: 'other-game', url: 'https://modyolo.com/other-game.html', download_url: 'https://modyolo.com/download/other-game-1' })]);
  assert.equal(apps.length, 2);
});

test('validateEntry menolak entri tanpa server', () => {
  assert.equal(validateEntry({ slug: 'x', name: 'X', type: 'game', servers: [] }).ok, false);
  assert.equal(validateEntry({ slug: 'x', name: 'X', type: 'game', servers: [{ source: 'modyolo', url: 'https://modyolo.com/x.html', download_url: 'https://modyolo.com/download/x-1' }] }).ok, true);
});

test('parseSizeMb + dedupKey', () => {
  assert.equal(parseSizeMb('149.5M'), 149.5);
  assert.equal(parseSizeMb('1.7G'), 1740.8);
  assert.equal(dedupKey({ packageName: 'com.Abc.X', name: 'X' }), 'pkg:com.abc.x');
  assert.equal(dedupKey({ packageName: null, name: 'Clash of Clans!' }), 'name:clashofclans');
});
