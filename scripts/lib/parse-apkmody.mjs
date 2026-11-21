// Parse halaman detail APKMody.
// HTML langsung diblokir Cloudflare dari IP server (403 "Just a moment..."),
// jadi detail diambil lewat Jina Reader (https://r.jina.ai/<url>) yang
// mengembalikan Markdown: Title berisi versi, tabel info berisi MOD feature /
// Genre / Developer. Ukuran file TIDAK tersedia lewat jalur ini (hanya tampil
// di sidebar browser live) → size_mb null, dicatat di laporan scrape.
import { parseDateId, stripHtml, cleanVersion } from './schema.mjs';

export function parseApkmodyMarkdown(md, wpPost) {
  const url = wpPost.link;
  const slug = url.split('/').filter(Boolean).pop() || wpPost.slug;
  const titleLine = (md.match(/^Title:\s*(.+)$/m) || [])[1] || '';
  const version = cleanVersion((titleLine.match(/(?:MOD APK|APK)\s+v([\d.]+(?:-[\w.]+)?)/i) || [])[1]);
  // Tabel Markdown "| MOD feature | Unlimited Money |" dst.
  const table = {};
  for (const m of md.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)) {
    const k = stripHtml(m[1]).toLowerCase();
    if (k && !/^[-: ]+$/.test(k) && k !== 'information') table[k] = stripHtml(m[2]);
  }
  // "### MOD Features" berisi bullet "**Unlimited Money:** ..."
  let modInfo = table['mod feature'] || null;
  if (!modInfo) {
    const sec = md.match(/### MOD Features([\s\S]*?)(?:\n## |\n### |$)/);
    if (sec) {
      const feats = [...sec[1].matchAll(/\*\*\s*([^*]+?)\s*:\*\*/g)].map((m) => m[1].trim());
      if (feats.length) modInfo = feats.join(', ');
    }
  }
  if (!modInfo) {
    const paren = titleLine.match(/\(([^)]+)\)\s*Download\s*$/);
    if (paren) modInfo = paren[1].trim();
  }
  const genre = table.genre || null;
  const type = /\/games\//.test(url) ? 'game' : 'app';
  // Deskripsi: paragraf pertama setelah baris author ("Written by ...").
  const lines = md.split('\n').map((l) => l.trim()).filter(Boolean);
  let description = null;
  for (const line of lines) {
    if (line.startsWith('Title:') || line.startsWith('URL Source:') || line.startsWith('Published Time:')
      || line.startsWith('Markdown Content:') || line.startsWith('![') || line.includes('Written by')
      || line.startsWith('#')) continue;
    if (line.length > 80) { description = stripHtml(line); break; }
  }
  const name = stripHtml(wpPost.title?.rendered || titleLine.replace(/\s+(MOD )?APK.*$/i, '').trim());
  return {
    source: 'apkmody',
    slug,
    name: name || slug,
    type,
    category: genre ? genre.split(',')[0].trim() : null,
    package_name: null,
    icon: null,
    description: description ? description.slice(0, 500) : null,
    version,
    size_mb: null,
    size_raw: null,
    mod_info: modInfo,
    genre,
    developer: table.developer || null,
    updated: parseDateId(wpPost.modified),
    url,
    download_url: url.replace(/\/$/, '') + '/download',
    wp_id: wpPost.id ?? null,
  };
}
