import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseModyoloDetail } from '../scripts/lib/parse-modyolo.mjs';
import { parseApkmodyMarkdown } from '../scripts/lib/parse-apkmody.mjs';

test('parseModyoloDetail: tabel + JSON-LD + download + package', () => {
  const html = readFileSync(new URL('./fixtures/modyolo-moneyland.html', import.meta.url), 'utf8');
  const d = parseModyoloDetail(html, 'https://modyolo.com/moneyland.html', 155526);
  assert.equal(d.source, 'modyolo');
  assert.equal(d.name, 'Moneyland');
  assert.equal(d.version, '3.13.5');
  assert.equal(d.size_mb, 149.5);
  assert.equal(d.mod_info, 'Unlimited Money, Scooter');
  assert.equal(d.type, 'game');
  assert.equal(d.category, 'Casual');
  assert.equal(d.developer, 'Rollic Games');
  assert.equal(d.package_name, 'com.wixot.moneyland');
  assert.equal(d.download_url, 'https://modyolo.com/download/moneyland-155526');
  assert.equal(d.icon, 'https://modyolo.com/wp-content/uploads/2022/07/moneyland.jpg');
  assert.match(d.description, /ambitious investor/);
});

test('parseApkmodyMarkdown: versi dari Title, MOD dari tabel', () => {
  const md = readFileSync(new URL('./fixtures/apkmody-clash-of-clans.md', import.meta.url), 'utf8');
  const post = { id: 415, slug: 'clash-of-clans', link: 'https://apkmody.com/games/clash-of-clans', modified: '2026-11-04T18:38:20', title: { rendered: 'Clash of Clans' } };
  const d = parseApkmodyMarkdown(md, post);
  assert.equal(d.source, 'apkmody');
  assert.equal(d.name, 'Clash of Clans');
  assert.equal(d.version, '19.32.4');
  assert.equal(d.mod_info, 'Unlimited Money');
  assert.equal(d.type, 'game');
  assert.equal(d.category, 'Strategy');
  assert.equal(d.developer, 'Supercell');
  assert.equal(d.size_mb, null); // ukuran tidak tersedia lewat Jina Reader
  assert.equal(d.download_url, 'https://apkmody.com/games/clash-of-clans/download');
  assert.equal(d.updated, '2026-11-04');
  assert.match(d.description, /popular mobile strategy game/);
});
