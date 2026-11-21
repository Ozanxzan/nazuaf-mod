// Skema katalog gabungan: satu entri = satu aplikasi/game, banyak server.
// servers: [{source:'apkmody'|'modyolo', version, size_mb, size_raw, mod_info,
//   genre, developer, updated, url, download_url, wp_id}]
// Dedup: package_name bila ada, fallback nama dinormalisasi.
import { createHash as _createHash } from 'node:crypto';

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10',
  november: '11', december: '12',
};

export function parseSizeMb(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  const m = String(s).trim().match(/([\d.,]+)\s*(GB|MB|KB|G|M)?\b/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(num)) return null;
  const unit = (m[2] || 'MB').toUpperCase();
  if (unit === 'GB' || unit === 'G') return Math.round(num * 1024 * 100) / 100;
  if (unit === 'KB') return Math.round((num / 1024) * 100) / 100;
  return num;
}

export function parseDateId(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
  }
  m = t.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#8217;|&#8216;/g, "'").replace(/&#8211;|&#8212;/g, '-').replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ').trim();
}

export function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function slugifyName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
}

export function dedupKey({ packageName, name, slug, url }) {
  if (packageName) return `pkg:${String(packageName).toLowerCase()}`;
  const n = normalizeName(name);
  // Nama yang seluruhnya non-Latin (mis. Jepang) hasil normalisasinya kosong
  // — jangan pakai kunci 'name:' kosong, nanti semua nama kosong bertabrakan.
  if (n) return `name:${n}`;
  return `slug:${slug || url || 'x'}`;
}

export function cleanVersion(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/^v/i, '');
  return s || null;
}

// Bandingkan versi semver sederhana ("19.32.4" > "18.647.5"); null kalah.
export function compareVersion(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const pa = String(a).split(/[.+-]/).map((x) => parseInt(x, 10));
  const pb = String(b).split(/[.+-]/).map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (Number.isNaN(pa[i]) ? 0 : pa[i] || 0) - (Number.isNaN(pb[i]) ? 0 : pb[i] || 0);
    if (d !== 0) return d;
  }
  return String(a).localeCompare(String(b));
}

// Server "paling lengkap" jadi tampilan utama kartu/detail.
export function pickPrimary(servers) {
  const score = (s) => (s.version ? 2 : 0) + (s.size_mb != null ? 1 : 0) + (s.mod_info ? 1 : 0);
  return [...servers].sort((a, b) => score(b) - score(a) || (b.updated || '').localeCompare(a.updated || ''))[0];
}

// Versi tampil = versi TERBARU di antara server (bukan sekadar server paling
// lengkap); ukuran diambil dari server versi terbaru itu bila ada, kalau
// tidak dari server mana pun yang punya ukuran.

export function validateEntry(e) {
  const errors = [];
  if (!e.slug) errors.push('slug kosong');
  if (!e.name) errors.push('name kosong');
  if (!e.type || !['game', 'app', 'unknown'].includes(e.type)) errors.push(`type tidak valid: ${e.type}`);
  if (!Array.isArray(e.servers) || e.servers.length === 0) errors.push('servers kosong');
  for (const s of e.servers || []) {
    if (!['apkmody', 'modyolo', 'an1'].includes(s.source)) errors.push(`source tidak valid: ${s.source}`);
    if (!s.url) errors.push('server url kosong');
    if (!s.download_url) errors.push('server download_url kosong');
  }
  return { ok: errors.length === 0, errors };
}

export function normalizeEntry(raw) {
  const servers = (raw.servers || []).map((s) => ({
    source: s.source,
    version: cleanVersion(s.version),
    size_mb: typeof s.size_mb === 'number' ? s.size_mb : parseSizeMb(s.size_mb ?? s.size_raw),
    size_raw: s.size_raw ?? (s.size_mb != null ? String(s.size_mb) : null),
    mod_info: s.mod_info || null,
    genre: s.genre || null,
    developer: s.developer || null,
    updated: parseDateId(s.updated),
    url: s.url,
    download_url: s.download_url,
    wp_id: s.wp_id ?? null,
  }));
  const primary = pickPrimary(servers);
  const newest = [...servers].sort((a, b) => compareVersion(b.version, a.version))[0];
  const displayVersion = newest?.version || primary?.version || null;
  const displaySize = newest?.size_mb ?? primary?.size_mb ?? servers.find((s) => s.size_mb != null)?.size_mb ?? null;
  return {
    slug: raw.slug || slugifyName(raw.name),
    name: raw.name,
    type: raw.type,
    category: raw.category || primary?.genre || null,
    package_name: raw.package_name || null,
    // needs_review: penggabungan ≥2 server hanya mengandalkan nama (tanpa
    // package name) — risiko salah gabung, perlu ditinjau manual.
    // Entri 1 server tanpa package tidak ditandai (tidak ada yang digabung).
    needs_review: !raw.package_name && servers.length >= 2,
    icon: raw.icon || null,
    description: raw.description || null,
    version: displayVersion,
    size_mb: displaySize,
    updated: servers.map((s) => s.updated).filter(Boolean).sort().reverse()[0] || null,
    servers,
    sources: [...new Set(servers.map((s) => s.source))],
    scraped_at: raw.scraped_at || new Date().toISOString(),
  };
}

export function hashContent(apps) {
  const slim = (apps || []).map((a) => {
    const { scraped_at, ...rest } = a;
    return rest;
  });
  return _createHash('sha256').update(JSON.stringify(slim)).digest('hex');
}

export function writeAppsJson(apps, generatedAt, extra = {}) {
  return JSON.stringify({ apps, generated_at: generatedAt, ...extra }, null, 2) + '\n';
}
