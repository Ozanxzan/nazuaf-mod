import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecs, pickRecs, cardData } from '../scripts/lib/recs.mjs';

const mk = (slug, type, category, updated) => ({
  slug, name: slug, type, category, icon: null, version: '1.0', size_mb: 10,
  updated, sources: ['modyolo'],
  servers: [{ source: 'modyolo', mod_info: 'MOD' }],
});

test('buildRecs: kelompok per kategori, maks 8, terbaru dulu', () => {
  const apps = [];
  for (let i = 0; i < 10; i++) apps.push(mk(`g${i}`, 'game', 'Puzzle', `2026-11-${String(i + 1).padStart(2, '0')}`));
  apps.push(mk('a1', 'app', 'Tools', '2026-11-21'));
  const recs = buildRecs(apps);
  assert.equal(recs['game|Puzzle'].length, 8);
  assert.equal(recs['game|Puzzle'][0].slug, 'g9'); // terbaru dulu
  assert.equal(recs['game|Puzzle'][7].slug, 'g2');
  assert.equal(recs['app|Tools'].length, 1);
  assert.equal(recs['game|__all'].length, 8);
  assert.equal(recs['app|__all'].length, 1);
  assert.deepEqual(Object.keys(recs['game|Puzzle'][0]).sort(), ['category', 'icon', 'mod', 'name', 'size_mb', 'slug', 'sources', 'updated', 'version']);
});

test('pickRecs: buang entri sendiri, lengkapi dari tipe yang sama kalau kurang dari 4', () => {
  const apps = [mk('g1', 'game', 'Puzzle', '2026-11-21'), mk('g2', 'game', 'Puzzle', '2026-11-20')];
  for (let i = 0; i < 6; i++) apps.push(mk(`a${i}`, 'game', 'Action', `2026-11-1${i}`));
  const recs = buildRecs(apps);
  const picked = pickRecs(recs, apps[0]);
  assert.ok(!picked.some((c) => c.slug === 'g1'));
  assert.ok(picked.some((c) => c.slug === 'g2')); // kategori sama
  assert.ok(picked.length >= 4); // dilengkapi dari game terbaru lainnya
  assert.ok(picked.length <= 8);
});

test('cardData: hanya field kartu', () => {
  const c = cardData(mk('x', 'app', 'Tools', '2026-11-21'));
  assert.equal(c.mod[0], 'MOD');
  assert.equal(c.slug, 'x');
});
