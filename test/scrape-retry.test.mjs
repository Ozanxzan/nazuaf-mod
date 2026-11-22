import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDoneFromFile, isTargetNewer } from '../scripts/scrape-full.mjs';
import { mergeServers } from '../scripts/lib/merge.mjs';

test('loadDoneFromFile: Map slug->catatan, fallback-wp menghapus, baris terakhir menang', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mod-done-'));
  const file = join(dir, 'apkmody.jsonl');
  writeFileSync(file, [
    JSON.stringify({ slug: 'a', url: 'https://apkmody.com/apps/a', status: 'ok', entry: { name: 'A', updated: '2026-11-01' } }),
    JSON.stringify({ slug: 'b', url: 'https://apkmody.com/apps/b', status: 'fallback-wp', entry: { name: 'B' } }),
    JSON.stringify({ slug: 'c', url: 'https://apkmody.com/apps/c', status: 'ok-jina', entry: { name: 'C' } }),
    JSON.stringify({ slug: 'd', url: 'https://apkmody.com/apps/d', status: 'skip-not-app' }),
    JSON.stringify({ slug: 'a', url: 'https://apkmody.com/apps/a', status: 'fallback-wp', entry: { name: 'A' } }),
    JSON.stringify({ slug: 'b', url: 'https://apkmody.com/apps/b', status: 'ok', entry: { name: 'B', updated: '2026-11-20' } }),
    'baris rusak',
  ].join('\n') + '\n');
  const done = loadDoneFromFile(file);
  assert.equal(done.size, 3); // b, c, d — a terhapus oleh fallback terakhirnya
  assert.ok(!done.has('a'));
  assert.equal(done.get('b').status, 'ok');
  assert.equal(done.get('b').updated, '2026-11-20');
  assert.equal(done.get('c').status, 'ok-jina');
  assert.equal(done.get('d').status, 'skip-not-app');
});

test('isTargetNewer: bandingkan modified sumber vs tersimpan', () => {
  assert.equal(isTargetNewer({ modified: '2026-11-22T10:00:00' }, { updated: '2026-11-21' }), true);
  assert.equal(isTargetNewer({ modified: '2026-11-21T10:00:00' }, { updated: '2026-11-21' }), false); // tanggal sama
  assert.equal(isTargetNewer({ modified: '2026-11-20T10:00:00' }, { updated: '2026-11-21' }), false);
  assert.equal(isTargetNewer({ modified: '2026-11-21T15:00:00' }, { updated: '2026-11-21T10:00:00' }), true); // hari sama, detik beda
  assert.equal(isTargetNewer({ modified: '2026-11-21T09:00:00' }, { updated: '2026-11-21T10:00:00' }), false);
  assert.equal(isTargetNewer({}, { updated: '2026-11-21' }), false); // tanpa modified (AN1)
  assert.equal(isTargetNewer({ modified: '2026-11-22' }, null), false);
  assert.equal(isTargetNewer({ modified: '2026-11-22' }, {}), false);
});

test('mergeServers: duplikat sumber sama memakai baris paling lengkap', () => {
  const fallback = {
    source: 'apkmody', slug: '1-1-1-1', name: '1.1.1.1 + WARP', type: 'app', category: null,
    package_name: null, icon: null, description: null, version: null, size_mb: null, size_raw: null,
    mod_info: null, genre: null, developer: null, updated: '2026-11-06',
    url: 'https://apkmody.com/apps/1-1-1-1', download_url: 'https://apkmody.com/apps/1-1-1-1/download', wp_id: 900,
  };
  const full = {
    ...fallback, version: '6.38.12', size_mb: 52, size_raw: '52 MB', mod_info: 'Premium Unlocked',
    icon: 'https://apkmody.com/wp-content/uploads/2022/05/1.1.1.1-MOD-APK-Cover.jpg',
    description: '1.1.1.1 + WARP APK improves Internet privacy.', developer: 'Cloudflare, Inc.',
  };
  // Urutan fallback dulu (seperti di JSONL repo), lalu baris ok dari retry.
  const { apps } = mergeServers([fallback, full]);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].slug, '1-1-1-1-warp');
  assert.equal(apps[0].version, '6.38.12');
  assert.equal(apps[0].size_mb, 52);
  assert.equal(apps[0].servers[0].mod_info, 'Premium Unlocked');
  assert.ok(apps[0].icon);
  // Urutan terbalik pun hasilnya sama.
  const r2 = mergeServers([full, fallback]);
  assert.equal(r2.apps[0].version, '6.38.12');
});
