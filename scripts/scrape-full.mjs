// Scraper FULL katalog (semua entri, 3 sumber) — resumable per batch.
//   node scripts/scrape-full.mjs --source an1 --batch-size 500
//   node scripts/scrape-full.mjs --source modyolo --max-batches 2
//   node scripts/scrape-full.mjs            (semua sumber, semua batch tersisa)
// Target: data/targets/<source>.json (dibangun sekali dari sitemap/WP API).
// Hasil: data/servers/<source>.jsonl (append per batch, 1 baris = 1 detail).
// Progres: data/progress.json (diperbarui tiap batch; jalankan ulang untuk lanjut).
// Jangan jalankan 2 proses scraper sekaligus untuk sumber yang sama.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, runPool, sleep } from './lib/fetch.mjs';
import { parseModyoloDetail } from './lib/parse-modyolo.mjs';
import { parseAn1Detail } from './lib/parse-an1.mjs';
import { parseApkmodyMarkdown } from './lib/parse-apkmody.mjs';
import { parseApkmodyHtml, translateProxyUrl } from './lib/parse-apkmody-html.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS_DIR = join(ROOT, 'data', 'targets');
const SERVERS_DIR = join(ROOT, 'data', 'servers');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };

export const SOURCE_CONFIG = {
  an1: { concurrency: 5, delayMs: 120 },
  modyolo: { concurrency: 5, delayMs: 120 },
  apkmody: { concurrency: 3, delayMs: 500 },
};

function normalizeAn1Url(u) {
  // Sitemap AN1 memakai huruf Cyrillic yang mirip Latin (а→a, о→o, ...).
  return u.replace(/[а]/g, 'a').replace(/[о]/g, 'o').replace(/[с]/g, 'c')
    .replace(/[е]/g, 'e').replace(/[р]/g, 'p').replace(/[х]/g, 'x').replace(/[у]/g, 'y');
}

async function wpList(base, page, perPage = 100) {
  const url = `${base}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&orderby=modified&order=desc&_fields=id,slug,link,modified,title,categories`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { posts: await res.json(), total: parseInt(res.headers.get('x-wp-total') || '0', 10), totalPages: parseInt(res.headers.get('x-wp-totalpages') || '0', 10) };
}

export async function buildTargets(source) {
  mkdirSync(TARGETS_DIR, { recursive: true });
  if (source === 'apkmody') {
    const first = await wpList('https://apkmody.com', 1);
    const pages = [first];
    const rest = await runPool(Array.from({ length: (first.totalPages || 1) - 1 }, (_, i) => i + 2), (p) => wpList('https://apkmody.com', p), 5, 100);
    for (const r of rest) if (r.ok) pages.push(r.value);
    const seen = new Map();
    for (const { posts } of pages) for (const p of posts || []) {
      if (/^https:\/\/apkmody\.com\/(games|apps)\//.test(p.link) && !seen.has(p.slug)) seen.set(p.slug, p);
    }
    const targets = [...seen.values()].map((p) => ({ slug: p.slug, url: p.link, wp_id: p.id, modified: p.modified, title: p.title?.rendered || null }));
    writeFileSync(join(TARGETS_DIR, 'apkmody.json'), JSON.stringify(targets, null, 2));
    return targets;
  }
  if (source === 'modyolo') {
    const index = await fetchText('https://modyolo.com/sitemap.xml', { retries: 2 });
    const subs = [...index.matchAll(/<loc>(https:\/\/modyolo\.com\/post-sitemap\d*\.xml)<\/loc>/g)].map((m) => m[1]);
    const results = await runPool(subs, async (u) => {
      const xml = await fetchText(u, { retries: 2 });
      return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    }, 6, 100);
    const all = [];
    for (const r of results) if (r.ok) all.push(...r.value);
    const detail = [...new Set(all.filter((u) => /^https:\/\/modyolo\.com\/[^/]+\.html$/.test(u)))];
    const targets = detail.map((url) => ({ slug: url.split('/').filter(Boolean).pop().replace(/\.html$/, ''), url }));
    writeFileSync(join(TARGETS_DIR, 'modyolo.json'), JSON.stringify(targets, null, 2));
    return targets;
  }
  if (source === 'an1') {
    // Sitemap AN1 BASI: URL-nya tanpa prefix ID numerik (mis. /coin-master.html)
    // dan 99/100 pilot 404. URL benar berpola /<id>-<slug>.html dan hanya
    // muncul di halaman kategori. Enumerasi lewat halaman kategori:
    // /games/<cat>/ + /programmy/<cat>/, pagination /page/N/.
    const xml = await fetchText('https://an1.com/sitemap.xml', { retries: 2, timeoutMs: 60000 });
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normalizeAn1Url(m[1]));
    const cats = [...new Set(locs.filter((u) => /^\https:\/\/an1\.com\/(igry|programmy)\/[^/]+\/$/.test(u)))];
    const catPages = await runPool(cats, async (catUrl) => {
      const html = await fetchText(catUrl, { retries: 2 });
      const pages = [...html.matchAll(/\/page\/(\d+)\//g)].map((m) => parseInt(m[1], 10));
      const maxPage = pages.length ? Math.max(...pages) : 1;
      const kind = catUrl.includes('/igry/') ? 'games' : 'programmy';
      return { catUrl, kind, maxPage };
    }, 6, 100);
    const pageUrls = [];
    for (const r of catPages) {
      if (!r.ok) continue;
      const { catUrl, kind, maxPage } = r.value;
      for (let p = 1; p <= maxPage; p++) pageUrls.push({ url: p === 1 ? catUrl : `${catUrl}page/${p}/`, kind });
    }
    const linkResults = await runPool(pageUrls, async ({ url, kind }) => {
      const html = await fetchText(url, { retries: 2 });
      const links = [...new Set([...html.matchAll(/href="(https:\/\/an1\.com\/\d+-[^"]+\.html)"/g)].map((m) => m[1]))];
      return links.map((u) => ({ url: u, kind }));
    }, 4, 100);
    const byUrl = new Map();
    for (const r of linkResults) {
      if (!r.ok) continue;
      for (const { url, kind } of r.value) if (!byUrl.has(url)) byUrl.set(url, kind);
    }
    const targets = [...byUrl.entries()].map(([url, kind]) => ({
      slug: url.split('/').filter(Boolean).pop().replace(/\.html$/, ''),
      url,
      kind,
    }));
    writeFileSync(join(TARGETS_DIR, 'an1.json'), JSON.stringify(targets, null, 2));
    return targets;
  }
  throw new Error(`sumber tidak dikenal: ${source}`);
}

function loadDone(source) {
  const file = join(SERVERS_DIR, `${source}.jsonl`);
  const done = new Set();
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      try { const j = JSON.parse(line); if (j.slug) done.add(j.slug); } catch { /* abaikan */ }
    }
  }
  return done;
}

function loadProgress() {
  try { return JSON.parse(readFileSync(join(ROOT, 'data', 'progress.json'), 'utf8')); } catch { return {}; }
}

function saveProgress(p) {
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data', 'progress.json'), JSON.stringify(p, null, 2) + '\n');
}

async function fetchApkmodyDetail(t) {
  const wpPost = { id: t.wp_id, slug: t.slug, link: t.url, modified: t.modified, title: { rendered: t.title || t.slug } };
  try {
    const html = await fetchText(translateProxyUrl(t.url), { retries: 2, timeoutMs: 45000 });
    const d = parseApkmodyHtml(html, wpPost);
    if (d.version) return { status: 'ok', entry: d };
    throw new Error('translate: versi kosong');
  } catch (err1) {
    try {
      const md = await fetchText(`https://r.jina.ai/${t.url}`, { retries: 1, timeoutMs: 45000 });
      const d = parseApkmodyMarkdown(md, wpPost);
      if (d.version) return { status: 'ok-jina', entry: d };
      throw new Error('jina: versi kosong');
    } catch (err2) {
      const d = parseApkmodyMarkdown('', wpPost);
      return { status: 'fallback-wp', entry: d, error: `${String(err1.message).slice(0, 120)} | ${String(err2.message).slice(0, 120)}` };
    }
  }
}

export async function runFull(opts = {}) {
  const sources = opts.sources || ['an1', 'modyolo', 'apkmody'];
  const batchSize = opts.batchSize || 500;
  const maxBatches = opts.maxBatches ?? Infinity;
  mkdirSync(SERVERS_DIR, { recursive: true });
  const progress = loadProgress();
  const summary = {};
  for (const source of sources) {
    const cfg = SOURCE_CONFIG[source];
    let targets;
    const targetFile = join(TARGETS_DIR, `${source}.json`);
    if (existsSync(targetFile) && !opts.rebuildTargets) {
      targets = JSON.parse(readFileSync(targetFile, 'utf8'));
    } else {
      console.log(`[${source}] membangun daftar target...`);
      targets = await buildTargets(source);
    }
    const done = loadDone(source);
    const remaining = targets.filter((t) => !done.has(t.slug));
    console.log(`[${source}] target ${targets.length}, sudah ${done.size}, sisa ${remaining.length}`);
    const state = progress[source] || (progress[source] = { total: targets.length, ok: 0, fail: 0, skipped_not_app: 0, fallback_wp: 0, batches: 0 });
    state.total = targets.length;
    let batches = 0;
    while (remaining.length > 0 && batches < maxBatches) {
      const batch = remaining.splice(0, batchSize);
      const t0 = Date.now();
      const results = await runPool(batch, async (t) => {
        if (source === 'modyolo') {
          const html = await fetchText(t.url, { retries: 2, timeoutMs: 30000 });
          return { status: 'ok', entry: parseModyoloDetail(html, t.url) };
        }
        if (source === 'an1') {
          const html = await fetchText(t.url, { retries: 2, timeoutMs: 30000 });
          const entry = parseAn1Detail(html, t.url);
          return entry ? { status: 'ok', entry } : { status: 'skip-not-app', entry: null };
        }
        return fetchApkmodyDetail(t);
      }, cfg.concurrency, cfg.delayMs);
      let ok = 0, fail = 0, skip = 0, fb = 0;
      const lines = [];
      results.forEach((r, i) => {
        const t = batch[i];
        if (!r.ok) { fail++; lines.push(JSON.stringify({ slug: t.slug, url: t.url, status: 'fail', error: String(r.error?.message || r.error).slice(0, 300) })); return; }
        const v = r.value;
        if (v.status === 'skip-not-app') { skip++; lines.push(JSON.stringify({ slug: t.slug, url: t.url, status: 'skip-not-app' })); return; }
        if (v.status === 'fallback-wp') fb++;
        if (!v.entry?.name) { fail++; lines.push(JSON.stringify({ slug: t.slug, url: t.url, status: 'fail', error: 'parse: nama kosong' })); return; }
        ok++;
        lines.push(JSON.stringify({ slug: t.slug, url: t.url, status: v.status, entry: v.entry, ...(v.error ? { error: v.error } : {}) }));
      });
      appendFileSync(join(SERVERS_DIR, `${source}.jsonl`), lines.join('\n') + '\n');
      state.ok += ok; state.fail += fail; state.skipped_not_app += skip; state.fallback_wp += fb;
      state.batches++; state.done = (state.ok + state.fail + state.skipped_not_app + state.fallback_wp);
      state.last_batch_at = new Date().toISOString();
      saveProgress(progress);
      batches++;
      console.log(`[${source}] batch ${state.batches}: ok ${ok}, gagal ${fail}, bukan-app ${skip}, fallback-wp ${fb} — progres ${state.done}/${state.total} (${((Date.now() - t0) / 1000).toFixed(0)} dtk)`);
      await sleep(1000);
    }
    summary[source] = { ...state };
  }
  saveProgress(progress);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
  };
  const sources = get('--source', null) ? [get('--source')] : undefined;
  runFull({
    sources,
    batchSize: parseInt(get('--batch-size', '500'), 10),
    maxBatches: get('--max-batches', null) ? parseInt(get('--max-batches'), 10) : undefined,
    rebuildTargets: args.includes('--rebuild-targets'),
  }).then((s) => console.log(JSON.stringify(s, null, 2))).catch((err) => { console.error(err); process.exit(1); });
}
