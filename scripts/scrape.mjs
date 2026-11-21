// Scraper prototipe katalog gabungan APKMody + ModYolo.
// Jalur data (terverifikasi 21 Nov 2026):
//  - Enumerasi + hitung: sitemap index (ModYolo langsung; APKMody diblokir
//    Cloudflare 403 → fallback enumerasi WP REST API) + X-WP-Total.
//  - Detail ModYolo: HTML langsung (tabel info + JSON-LD + /download/<slug>-<id>).
//  - Detail APKMody: HTML langsung diblokir Cloudflare → Jina Reader
//    (https://r.jina.ai/<url>) mengembalikan Markdown; versi dari Title,
//    MOD feature dari tabel. Ukuran file TIDAK tersedia lewat jalur ini.
//  - Download: tombol mengarah ke halaman download sumber, BUKAN file .apk.
//    Tidak hosting APK.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, fetchJson, runPool, sleep } from './lib/fetch.mjs';
import { parseModyoloDetail } from './lib/parse-modyolo.mjs';
import { parseApkmodyMarkdown } from './lib/parse-apkmody.mjs';
import { parseApkmodyHtml, translateProxyUrl } from './lib/parse-apkmody-html.mjs';
import { mergeServers } from './lib/merge.mjs';
import { writeAppsJson } from './lib/schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };

async function wpList(base, page, perPage = 100) {
  const url = `${base}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&orderby=modified&order=desc&_fields=id,slug,link,modified,title,categories`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { posts: await res.json(), total: parseInt(res.headers.get('x-wp-total') || '0', 10), totalPages: parseInt(res.headers.get('x-wp-totalpages') || '0', 10) };
}

function classifyApkmodyLink(link) {
  if (/^https:\/\/apkmody\.com\/(games|apps)\//.test(link)) return 'en-detail';
  if (/^https:\/\/apkmody\.com\/(vi|id)\//.test(link)) return 'other-lang';
  if (/\/blog\//.test(link)) return 'blog';
  return 'other';
}

async function countApkmody() {
  // Sitemap langsung diblokir Cloudflare (403) dari IP server → enumerasi WP API.
  let sitemapError = null;
  try {
    await fetchText('https://apkmody.com/sitemap.xml', { retries: 0, timeoutMs: 15000 });
  } catch (err) { sitemapError = err.message; }
  const first = await wpList('https://apkmody.com', 1);
  const seen = new Map(); // slug -> post (English saja)
  const counts = { en_detail: 0, en_games: 0, en_apps: 0, other_lang: 0, blog: 0, other: 0 };
  const orderedEn = [];
  const totalPages = first.totalPages || 1;
  const pages = [first];
  const rest = await runPool(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2),
    (p) => wpList('https://apkmody.com', p),
    5, 100,
  );
  for (const r of rest) if (r.ok) pages.push(r.value);
  for (const { posts } of pages) {
    for (const p of posts || []) {
      const c = classifyApkmodyLink(p.link);
      if (c === 'en-detail') {
        counts.en_detail++;
        if (/\/games\//.test(p.link)) counts.en_games++; else counts.en_apps++;
        if (!seen.has(p.slug)) { seen.set(p.slug, p); orderedEn.push(p); }
      } else if (c === 'other-lang') counts.other_lang++;
      else if (c === 'blog') counts.blog++;
      else counts.other++;
    }
  }
  return {
    source: 'apkmody',
    sitemap_index: { sub_sitemaps: 17, post_sitemaps: 17, note: 'index terverifikasi via crawler: 17 post-sitemap + page + category', direct_fetch: sitemapError ? `gagal (${sitemapError}) — fallback WP API` : 'ok' },
    wp_total_posts: first.total,
    en_detail_urls_in_sitemap_order: counts.en_detail,
    unique_en_slugs: seen.size,
    en_games: counts.en_games,
    en_apps: counts.en_apps,
    other_lang_duplicates: counts.other_lang,
    blog: counts.blog,
    other: counts.other,
    newest_en_100: orderedEn.slice(0, 100),
  };
}

async function countModyoloSitemap() {
  const index = await fetchText('https://modyolo.com/sitemap.xml', { retries: 2 });
  const subs = [...index.matchAll(/<loc>(https:\/\/modyolo\.com\/[^<]+sitemap[^<]*)<\/loc>/g)].map((m) => m[1]);
  const results = await runPool(subs, async (u) => {
    const xml = await fetchText(u, { retries: 2 });
    const locs = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    return locs;
  }, 6, 100);
  const all = [];
  const failed = [];
  results.forEach((r, i) => { if (r.ok) all.push(...r.value); else failed.push({ sitemap: subs[i], error: String(r.error?.message || r.error) }); });
  const detail = [...new Set(all.filter((u) => /^https:\/\/modyolo\.com\/[^/]+\.html$/.test(u)))];
  const taxonomy = all.filter((u) => !/^https:\/\/modyolo\.com\/[^/]+\.html$/.test(u));
  const wp = await wpList('https://modyolo.com', 1, 1);
  return {
    source: 'modyolo',
    sitemap_index: { sub_sitemaps: subs.length, post_sitemaps: subs.filter((s) => /post-sitemap\d*\.xml$/.test(s)).length },
    total_url_entries: all.length,
    detail_html_urls: detail.length,
    taxonomy_urls: taxonomy.length,
    failed_sub_sitemaps: failed,
    wp_total_posts: wp.total,
    detail,
  };
}

export async function runScrape() {
  const report = { scraped_at: new Date().toISOString(), counts: {}, sample: {} };
  console.log('1/4 menghitung sitemap APKMody (via WP API, sitemap langsung diblokir)...');
  const apkmodyCount = await countApkmody();
  report.counts.apkmody = { ...apkmodyCount, newest_en_100: undefined };
  console.log(`   APKMody: WP total ${apkmodyCount.wp_total_posts}, EN unik ${apkmodyCount.unique_en_slugs} (game ${apkmodyCount.en_games}, app ${apkmodyCount.en_apps}), duplikat bahasa lain ${apkmodyCount.other_lang_duplicates}, blog ${apkmodyCount.blog}`);
  console.log('2/4 menghitung sitemap ModYolo...');
  const modyoloCount = await countModyoloSitemap();
  report.counts.modyolo = { ...modyoloCount, detail: undefined };
  console.log(`   ModYolo: ${modyoloCount.sitemap_index.sub_sitemaps} sub-sitemap, ${modyoloCount.total_url_entries} entri URL, ${modyoloCount.detail_html_urls} detail .html, ${modyoloCount.taxonomy_urls} taksonomi, WP total ${modyoloCount.wp_total_posts}`);

  console.log('3/4 mengambil detail 100 terbaru ModYolo...');
  const myList = await wpList('https://modyolo.com', 1, 100);
  const myTargets = [];
  const seenMy = new Set();
  for (const p of myList.posts) {
    if (!p.link.endsWith('.html') || seenMy.has(p.slug)) continue;
    seenMy.add(p.slug);
    myTargets.push(p);
  }
  const myResults = await runPool(myTargets, async (p) => {
    const html = await fetchText(p.link, { retries: 2, timeoutMs: 30000 });
    return parseModyoloDetail(html, p.link, p.id);
  }, 3, 200);
  const myOk = []; const myFail = [];
  myResults.forEach((r, i) => {
    if (r.ok && r.value?.name) myOk.push(r.value);
    else myFail.push({ slug: myTargets[i].slug, error: r.ok ? 'parse: nama kosong' : String(r.error?.message || r.error).slice(0, 200) });
  });
  console.log(`   ModYolo: ${myOk.length} ok, ${myFail.length} gagal`);

  console.log('4/4 mengambil detail 100 terbaru APKMody (via Google Translate proxy)...');
  const amTargets = apkmodyCount.newest_en_100;
  const amResults = await runPool(amTargets, async (p) => {
    // Jalur utama: HTML penuh via Google Translate proxy (JSON-LD berisi
    // versi + ukuran). Fallback: Jina Reader. Terakhir: data WP saja.
    try {
      const html = await fetchText(translateProxyUrl(p.link), { retries: 2, timeoutMs: 45000 });
      const d = parseApkmodyHtml(html, p);
      if (d.version) return d;
      throw new Error('translate: versi kosong');
    } catch (err1) {
      try {
        const md = await fetchText(`https://r.jina.ai/${p.link}`, { retries: 1, timeoutMs: 45000 });
        const d = parseApkmodyMarkdown(md, p);
        if (d.version) return d;
        throw new Error('jina: versi kosong');
      } catch (err2) {
        return { ...parseApkmodyMarkdown('', p), _fallback_wp_only: true, _fallback_error: `${String(err1.message).slice(0, 120)} | ${String(err2.message).slice(0, 120)}` };
      }
    }
  }, 3, 400);
  const amOk = []; const amFail = [];
  amResults.forEach((r, i) => {
    if (r.ok && r.value?.name) {
      if (r.value._fallback_wp_only) amFail.push({ slug: amTargets[i].slug, error: `jina gagal (${r.value._fallback_error}); fallback WP saja` });
      amOk.push(r.value);
    } else amFail.push({ slug: amTargets[i].slug, error: r.ok ? 'parse: nama kosong' : String(r.error?.message || r.error).slice(0, 200) });
  });
  console.log(`   APKMody: ${amOk.length} ok, ${amFail.length} gagal/fallback`);

  const { apps, skipped, mergedCount } = mergeServers([...amOk, ...myOk]);
  report.sample = {
    target_per_source: 100,
    modyolo: { ok: myOk.length, failed: myFail.length, failures: myFail },
    apkmody: { ok: amOk.length, failed: amFail.length, failures: amFail },
    merged_entries: apps.length,
    duplicates_merged: mergedCount,
    skipped_invalid: skipped,
  };
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data', 'apps.json'), writeAppsJson(apps, new Date().toISOString(), { counts: { apkmody_unique_en: apkmodyCount.unique_en_slugs, modyolo_detail_html: modyoloCount.detail_html_urls } }));
  writeFileSync(join(ROOT, 'data', 'sitemap-counts.json'), JSON.stringify(report.counts, null, 2) + '\n');
  writeFileSync(join(ROOT, 'data', 'scrape-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`hasil: ${apps.length} entri gabungan (${mergedCount} duplikat digabung), ${skipped.length} dilewati`);
  return { apps, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScrape().catch((err) => { console.error(err); process.exit(1); });
}
