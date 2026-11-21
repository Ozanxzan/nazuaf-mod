// Parse halaman detail ModYolo, contoh https://modyolo.com/moneyland.html
// Sumber field: tabel info (App Name/Publisher/Genre/Size/Latest Version/MOD Info),
// JSON-LD (softwareVersion), og:image, tombol download /download/<slug>-<wpId>,
// package name dari tautan Google Play (?id=com.xxx).
import { parseSizeMb, parseDateId, stripHtml, cleanVersion } from './schema.mjs';

function parseInfoTable(html) {
  const info = {};
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  for (const tr of rows) {
    const clean = tr.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '|');
    const parts = clean.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) info[parts[0].toLowerCase()] = { text: parts.slice(1).join(' '), html: tr };
  }
  return info;
}

function genreLink(html) {
  // Di baris Genre ada <a href="https://modyolo.com/games/casual" rel="tag">Casual</a>
  const m = html.match(/<a href="https?:\/\/modyolo\.com\/(games|apps)\/[^"]*"[^>]*>([^<]+)<\/a>/);
  return m ? { kind: m[1], genre: stripHtml(m[2]) } : null;
}

export function parseModyoloDetail(html, sourceUrl, wpId = null) {
  const slug = sourceUrl.replace(/\.html$/, '').split('/').filter(Boolean).pop() || '';
  const info = parseInfoTable(html);
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || null;
  const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || null;
  const ldVersion = (html.match(/"softwareVersion":\s*"([^"]+)"/) || [])[1] || null;
  const dl = (html.match(/href="(https?:\/\/modyolo\.com\/download\/[^"]+)"/) || [])[1] || null;
  const play = (html.match(/play\.google\.com\/store\/apps\/details\?id=([A-Za-z0-9._]+)/) || [])[1] || null;
  const genre = genreLink(html);

  const name = info['app name']?.text || stripHtml(title.replace(/ v[\d.]+ .*$/, '')) || null;
  const version = cleanVersion(info['latest version']?.text || ldVersion || (title.match(/ v([\d.]+)/) || [])[1]);
  const sizeRaw = info.size?.text || null;
  const modInfo = info['mod info']?.text || null;
  const type = genre?.kind === 'apps' ? 'app' : 'game';
  const category = genre?.genre || info.genre?.text || null;
  const updated = parseDateId((html.match(/"dateModified":\s*"([^"]+)"/) || [])[1]);

  // Deskripsi: paragraf pertama isi artikel (lebih lengkap dari meta description).
  let description = null;
  const ps = [...html.matchAll(/<p>([^<]{40,500})<\/p>/g)].map((m) => stripHtml(m[1]));
  description = ps[0] || (metaDesc ? stripHtml(metaDesc) : null);

  return {
    source: 'modyolo',
    slug,
    name,
    type,
    category,
    package_name: play,
    icon: ogImage,
    description: description ? description.slice(0, 500) : null,
    version,
    size_mb: parseSizeMb(sizeRaw),
    size_raw: sizeRaw,
    mod_info: modInfo,
    genre: category,
    developer: info.publisher?.text || null,
    updated,
    url: sourceUrl,
    download_url: dl || `https://modyolo.com/download/${slug}${wpId ? `-${wpId}` : ''}`,
    wp_id: wpId,
  };
}
