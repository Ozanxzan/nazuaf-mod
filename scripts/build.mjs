// Generator situs statis dari data/apps.json → public/
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIndex, renderDetail, renderUnknown } from './lib/render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildSite(opts = {}) {
  const dataPath = opts.dataPath || join(ROOT, 'data', 'apps.json');
  const outDir = opts.outDir || join(ROOT, 'public');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const apps = data.apps || [];
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'apps'), { recursive: true });
  // Aset statis di-commit di assets/ (bukan di public/ yang hasil build
  // dan tidak ikut ke repo — kalau dari public/, Pages tidak punya CSS-nya).
  const cssSrc = join(ROOT, 'assets', 'style.css');
  const cssDst = join(outDir, 'assets', 'style.css');
  if (existsSync(cssSrc) && cssSrc !== cssDst) {
    mkdirSync(join(outDir, 'assets'), { recursive: true });
    copyFileSync(cssSrc, cssDst);
  }
  // Placeholder ikon (dipakai kalau entri tidak punya ikon remote).
  const phSrc = join(ROOT, 'assets', 'icon-placeholder.svg');
  if (existsSync(phSrc)) copyFileSync(phSrc, join(outDir, 'assets', 'icon-placeholder.svg'));
  writeFileSync(join(outDir, 'index.html'), renderIndex(apps, data.generated_at));
  const unknown = apps.filter((a) => a.type === 'unknown');
  mkdirSync(join(outDir, 'unknown'), { recursive: true });
  writeFileSync(join(outDir, 'unknown', 'index.html'), renderUnknown(unknown, data.generated_at));
  const t0 = Date.now();
  for (const app of apps) {
    const dir = join(outDir, 'apps', app.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderDetail(app));
  }
  console.log(`build: ${apps.length} entri (${unknown.length} unknown) → ${outDir} dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);
  return { count: apps.length, unknown: unknown.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite().catch((err) => { console.error(err); process.exit(1); });
}
