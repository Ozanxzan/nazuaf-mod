// Backfill satu kali (22 Nov 2026): isi ulang entri APKMody yang di repo
// masih fallback-wp (versi/ukuran kosong karena Translate proxy kena
// rate-limit saat run GitHub 00.00), memakai hasil scrape lokal yang
// sudah OK untuk slug yang sama. Slug yang di lokal pun belum OK
// di-scrape langsung (Translate proxy sedang bisa diakses).
//
//   REPO_JSONL=/tmp/repo-apkmody.jsonl node scripts/backfill-apkmody.mjs
//
// Hasil: data/servers/apkmody-retry.jsonl — dibaca merge-full (semua
// *.jsonl di data/servers) dan loadDone (file apkmody-*.jsonl), jadi
// run sync berikutnya langsung menggabungkan baris-baris ini tanpa
// harus scrape ulang. Merge memilih baris paling lengkap per sumber.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchApkmodyDetail } from './scrape-full.mjs';
import { runPool } from './lib/fetch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoPath = process.env.REPO_JSONL || '/tmp/repo-apkmody.jsonl';

function readJsonl(path) {
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const repo = readJsonl(repoPath);
const local = readJsonl(join(ROOT, 'data', 'servers', 'apkmody.jsonl'));
const targets = JSON.parse(readFileSync(join(ROOT, 'data', 'targets', 'apkmody.json'), 'utf8'));
const targetBySlug = new Map(targets.map((t) => [t.slug, t]));

const repoFallback = repo.filter((r) => r.status === 'fallback-wp');
const localBest = new Map();
const score = (e) => (e.version ? 2 : 0) + (e.size_mb != null ? 1 : 0) + (e.mod_info ? 1 : 0);
for (const l of local) {
  if (!l.slug || !l.entry || (l.status !== 'ok' && l.status !== 'ok-jina')) continue;
  const cur = localBest.get(l.slug);
  if (!cur || score(l.entry) > score(cur.entry)) localBest.set(l.slug, l);
}

const out = [];
const missing = [];
for (const r of repoFallback) {
  const best = localBest.get(r.slug);
  if (best) out.push(best);
  else missing.push(r.slug);
}
console.log(`repo fallback: ${repoFallback.length}, terisi dari lokal: ${out.length}, perlu scrape: ${missing.length}`);

// Checkpoint dulu: tulis baris lokal-OK ke file retry SEBELUM scrape
// langsung, supaya progres tidak hilang kalau proses mati (VM bisa
// restart sewaktu-waktu) atau proxy kena rate-limit di tengah jalan.
mkdirSync(join(ROOT, 'data', 'servers'), { recursive: true });
const retryPath = join(ROOT, 'data', 'servers', 'apkmody-retry.jsonl');
writeFileSync(retryPath, out.map((l) => JSON.stringify(l)).join('\n') + '\n');
console.log(`checkpoint ${retryPath}: ${out.length} baris`);

if (process.env.SKIP_LIVE === '1') {
  console.log('SKIP_LIVE=1: scrape langsung dilewati, sisa fallback diurus run sync berikutnya.');
  process.exit(0);
}

// Scrape langsung sisanya (paralel 3, tiap sukses langsung di-append).
const results = await runPool(missing, async (slug) => {
  const t = targetBySlug.get(slug);
  if (!t) return { slug, status: 'no-target' };
  try {
    const v = await fetchApkmodyDetail(t);
    return { slug, status: v.status, value: v };
  } catch (e) {
    return { slug, status: 'error', error: String(e.message).slice(0, 100) };
  }
}, 3, 500);
let added = 0;
for (const r of results) {
  if (r.status === 'ok' || r.status === 'ok-jina') {
    const t = targetBySlug.get(r.slug);
    appendFileSync(retryPath, JSON.stringify({ slug: r.slug, url: t.url, status: r.status, entry: r.value.entry }) + '\n');
    added++;
  }
}
console.log(`scrape langsung: +${added} baris OK di-append ke ${retryPath}`);
