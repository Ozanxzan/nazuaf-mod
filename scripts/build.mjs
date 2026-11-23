// Generator situs statis dari data/apps.json → public/
//
// Batas Cloudflare Pages: maks 20.000 file/deployment dan 25 MB per file.
// Karena itu TIDAK ada lagi satu halaman detail per entri (30rb+ file):
// - Listing dipecah jadi halaman statis per 100 entri per tipe.
// - Detail dirender di browser dari chunk JSON (1.000 entri/file) + indeks slug.
// - Pencarian global memakai indeks ringkas /data/search.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderListing, renderDetailTemplate, renderSearchPage, renderUnknown, PAGE_SIZE, CHUNK_SIZE, pageUrl } from './lib/render.mjs';
import { buildRecs } from './lib/recs.mjs';
import { loadPopular, orderForListing } from './lib/popular.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function writeHtml(outDir, relPath, html) {
  const p = join(outDir, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html);
  return p;
}

function countFiles(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  }
  return n;
}

export async function buildSite(opts = {}) {
  const dataPath = opts.dataPath || join(ROOT, 'data', 'apps.json');
  const outDir = opts.outDir || join(ROOT, 'public');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const apps = (data.apps || []).slice().sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  // Aset statis di-commit di assets/ (bukan di public/ yang hasil build
  // dan tidak ikut ke repo — kalau dari public/, Pages tidak punya CSS-nya).
  const cssSrc = join(ROOT, 'assets', 'style.css');
  if (existsSync(cssSrc)) {
    mkdirSync(join(outDir, 'assets'), { recursive: true });
    copyFileSync(cssSrc, join(outDir, 'assets', 'style.css'));
  }
  // Placeholder ikon (dipakai kalau entri tidak punya ikon remote).
  const phSrc = join(ROOT, 'assets', 'icon-placeholder.svg');
  if (existsSync(phSrc)) copyFileSync(phSrc, join(outDir, 'assets', 'icon-placeholder.svg'));

  // Halaman 1 tiap tab: 100 populer dulu (data/popular.json), halaman 2+
  // sisanya urut abjad. Urutan master `apps` (chunk + slugs.json) tetap
  // urut slug — halaman detail memakai binary search di slugs.json.
  const popular = loadPopular(join(dirname(dataPath), 'popular.json'));
  const games = orderForListing(apps.filter((a) => a.type === 'game'), popular.game);
  const appl = orderForListing(apps.filter((a) => a.type === 'app'), popular.app);
  const popularShown = {
    game: popular.game.filter((s) => games.some((a) => a.slug === s)).length,
    app: popular.app.filter((s) => appl.some((a) => a.slug === s)).length,
  };
  const unknown = apps.filter((a) => a.type === 'unknown');
  const counts = { game: games.length, app: appl.length, unknown: unknown.length };

  // Listing per 100 entri, per tipe.
  for (const [type, list] of [['game', games], ['app', appl]]) {
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    for (let page = 1; page <= totalPages; page++) {
      const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const rel = pageUrl(type, page) === '/' ? 'index.html' : pageUrl(type, page).replace(/^\//, '') + 'index.html';
      writeHtml(outDir, rel, renderListing({ type, page, totalPages, items, counts, generatedAt: data.generated_at, popularCount: page === 1 ? popularShown[type] : 0 }));
    }
  }
  writeHtml(outDir, 'unknown/index.html', renderUnknown(unknown, data.generated_at));

  // Detail dinamis: satu template + chunk JSON + indeks slug.
  writeHtml(outDir, 'detail/index.html', renderDetailTemplate());
  const chunksDir = join(outDir, 'data', 'chunks');
  mkdirSync(chunksDir, { recursive: true });
  for (let i = 0; i < apps.length; i += CHUNK_SIZE) {
    const n = String(i / CHUNK_SIZE).padStart(3, '0');
    writeFileSync(join(chunksDir, `${n}.json`), JSON.stringify(apps.slice(i, i + CHUNK_SIZE)));
  }
  writeFileSync(join(outDir, 'data', 'slugs.json'), JSON.stringify(apps.map((a) => a.slug)));
  // Indeks pencarian ringkas: nama + slug + tipe + kategori.
  writeFileSync(
    join(outDir, 'data', 'search.json'),
    JSON.stringify(apps.map((a) => ({ n: a.name, s: a.slug, t: a.type, c: a.category || '' }))),
  );
  // Rekomendasi per kategori (maks 8, terbaru dulu) + fallback per tipe.
  writeFileSync(join(outDir, 'data', 'recs.json'), JSON.stringify(buildRecs(apps)));
  writeHtml(outDir, 'cari/index.html', renderSearchPage(apps.length));

  // /apps/<slug>/ lama tetap jalan: tulis ulang ke template detail (200).
  writeFileSync(join(outDir, '_redirects'), '/apps/* /detail/ 200\n');

  const files = countFiles(outDir);
  console.log(`build: ${apps.length} entri (${unknown.length} unknown) → ${outDir} dalam ${files} file`);
  return { count: apps.length, unknown: unknown.length, files };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite().catch((err) => { console.error(err); process.exit(1); });
}
