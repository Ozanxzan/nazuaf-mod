// Parse halaman detail AN1 (DataLife Engine), contoh
// https://an1.com/6881-real-boxing-2-mod.html
// Sumber field: <title> "Download {Nama} (MOD, {fitur}) {versi} APK for android",
// <ul class="spec"> (Android min, Version softwareVersion, fileSize),
// tombol download /file_<id>-dw.html, og:image, datePublished,
// applicationCategory / applicationSubCategory, publisher.
// Package name TIDAK ada di halaman AN1 → dedup via nama.
import { parseSizeMb, parseDateId, stripHtml, cleanVersion } from './schema.mjs';

export function parseAn1Detail(html, sourceUrl) {
  const slug = sourceUrl.split('/').filter(Boolean).pop().replace(/\.html$/, '');
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  const titleMatch = title.match(/^Download\s+(.+?)\s+([\d.]+)\s+APK for android/i);
  const modParen = title.match(/\((MOD[^)]*)\)/i);
  const version = cleanVersion(
    (html.match(/itemprop="softwareVersion">([^<]+)</) || [])[1]
    || (titleMatch ? titleMatch[2] : null),
  );
  const sizeRaw = (html.match(/itemprop="fileSize">([^<]+)</) || [])[1] || null;
  const androidRaw = (html.match(/Android\s+([\d.]+)\s*\+/) || [])[1] || null;
  const dl = (html.match(/href="(\/file_\d+-dw\.html)"/) || [])[1] || null;
  const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || null;
  const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || null;
  const appCat = (html.match(/itemprop="applicationCategory" content="([^"]+)"/) || [])[1] || null;
  const subCat = (html.match(/itemprop="applicationSubCategory" content="([^"]+)"/) || [])[1] || null;
  const publisher = (html.match(/itemprop="publisher"[^>]*>[\s\S]{0,200}?itemprop="name">([^<]+)</) || [])[1] || null;
  const datePub = (html.match(/datePublished" datetime="([^"]+)"/) || [])[1] || null;

  const name = titleMatch ? stripHtml(titleMatch[1].replace(/\s*\(MOD[^)]*\)\s*/i, '').trim()) : null;
  // Halaman berita/artikel tidak punya pola "Download ... APK" dan tidak ada
  // tombol download → bukan entri game/aplikasi.
  if (!name || !dl) return null;
  const type = appCat === 'Games' ? 'game' : appCat === 'Programs' ? 'app' : 'unknown';
  return {
    source: 'an1',
    slug,
    name,
    type,
    category: subCat || (appCat === 'Games' ? 'Games' : appCat === 'Programs' ? 'Programs' : null),
    package_name: null,
    icon: ogImage,
    description: metaDesc ? stripHtml(metaDesc).slice(0, 500) : null,
    version,
    size_mb: parseSizeMb(sizeRaw),
    size_raw: sizeRaw,
    mod_info: modParen ? modParen[1].replace(/^MOD,?\s*/i, '').trim() || 'MOD' : null,
    genre: subCat,
    developer: publisher ? stripHtml(publisher) : null,
    updated: parseDateId(datePub),
    android_min: androidRaw,
    url: sourceUrl,
    download_url: `https://an1.com${dl}`,
    wp_id: null,
  };
}
