// Parse halaman detail APKMody dari HTML penuh.
// HTML langsung diblokir Cloudflare dari IP server (403), Jina Reader
// kena rate-limit massal (100/100 gagal saat scrape sampel) — jalur yang
// terbukti bekerja untuk detail massal: Google Translate proxy
// (https://apkmody-com.translate.goog/<path>?_x_tr_sl=auto&_x_tr_tl=en...)
// yang mengembalikan HTML lengkap tanpa challenge.
// Field: JSON-LD (softwareVersion, fileSize, author, operatingSystem,
// applicationCategory), Title (versi + MOD), tabel info (MOD feature /
// Genre / Developer), og:image.
import { parseSizeMb, parseDateId, stripHtml, cleanVersion } from './schema.mjs';

export function parseApkmodyHtml(html, wpPost) {
  const url = wpPost.link;
  const slug = url.split('/').filter(Boolean).pop() || wpPost.slug;
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  let ld = null;
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      const graph = Array.isArray(d['@graph']) ? d['@graph'] : [d];
      const app = graph.find((x) => x && (x['@type'] === 'MobileApplication' || x['@type'] === 'SoftwareApplication'));
      if (app) { ld = app; break; }
    } catch { /* abaikan */ }
  }
  const table = {};
  for (const m of html.matchAll(/<th[^>]*>([^<]{1,40})<\/th>\s*<td[^>]*>([\s\S]{0,200}?)<\/td>/g)) {
    table[stripHtml(m[1]).toLowerCase()] = stripHtml(m[2]);
  }
  // Tabel Markdown APKMody juga bisa muncul sebagai "| MOD feature | ... |"
  for (const m of html.matchAll(/\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g)) {
    const k = stripHtml(m[1]).toLowerCase();
    if (k && !/^[-: ]+$/.test(k) && k !== 'information' && !table[k]) table[k] = stripHtml(m[2]);
  }
  const version = cleanVersion(
    ld?.softwareVersion
    || (title.match(/(?:MOD APK|APK)\s+v([\d.]+(?:-[\w.]+)?)/i) || [])[1],
  );
  let modInfo = table['mod feature'] || null;
  if (!modInfo) {
    const paren = title.match(/\(([^)]+)\)\s*Download\s*$/);
    if (paren) modInfo = paren[1].trim();
  }
  const genre = table.genre || null;
  const type = /\/games\//.test(url) ? 'game' : 'app';
  const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || null;
  const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || null;
  const name = stripHtml(wpPost.title?.rendered || title.replace(/\s+(MOD )?APK.*$/i, '').trim());
  return {
    source: 'apkmody',
    slug,
    name: name || slug,
    type,
    category: genre ? genre.split(',')[0].trim() : null,
    package_name: null,
    icon: ogImage,
    description: metaDesc ? stripHtml(metaDesc).slice(0, 500) : null,
    version,
    size_mb: parseSizeMb(ld?.fileSize),
    size_raw: ld?.fileSize || null,
    mod_info: modInfo,
    genre,
    developer: table.developer || (typeof ld?.author === 'object' ? ld.author?.name : ld?.author) || null,
    updated: parseDateId(wpPost.modified),
    android_min: ld?.operatingSystem ? String(ld.operatingSystem).replace(/^Android\s*/i, '') : null,
    url,
    download_url: url.replace(/\/$/, '') + '/download',
    wp_id: wpPost.id ?? null,
  };
}

export function translateProxyUrl(apkmodyUrl) {
  const u = new URL(apkmodyUrl);
  return `https://apkmody-com.translate.goog${u.pathname}?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en`;
}
