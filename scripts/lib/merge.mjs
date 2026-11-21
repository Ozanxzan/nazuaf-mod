// Urutan kanonis server di halaman detail: APKMody, ModYolo, AN1.
export const SERVER_ORDER = ['apkmody', 'modyolo', 'an1'];

// Gabung entri per-sumber jadi satu entri katalog.
// Dedup: package_name bila ada, fallback nama dinormalisasi.
// Type: game/app menang atas 'unknown'; kalau server berbeda game vs app,
// pakai type server utama (paling lengkap).
import { dedupKey, normalizeEntry, slugifyName, validateEntry } from './schema.mjs';

export function mergeServers(serverEntries) {
  const byKey = new Map();
  const order = [];
  for (const s of serverEntries) {
    const key = dedupKey({ packageName: s.package_name, name: s.name, slug: s.slug, url: s.url });
    if (!byKey.has(key)) {
      // Slug dari nama; kalau nama seluruhnya non-Latin, pakai slug sumber
      // supaya dua game Jepang tidak sama-sama jadi 'app'.
      const sl = slugifyName(s.name);
      byKey.set(key, {
        slug: sl === 'app' && s.slug ? s.slug : sl,
        name: s.name,
        type: s.type,
        category: s.category,
        package_name: s.package_name || null,
        icon: s.icon || null,
        description: s.description || null,
        servers: [],
      });
      order.push(key);
    }
    const entry = byKey.get(key);
    const serverRow = {
      source: s.source,
      _type: s.type,
      version: s.version,
      size_mb: s.size_mb,
      size_raw: s.size_raw,
      mod_info: s.mod_info,
      genre: s.genre,
      developer: s.developer,
      updated: s.updated,
      url: s.url,
      download_url: s.download_url,
      wp_id: s.wp_id ?? null,
    };
    const existing = entry.servers.find((x) => x.source === s.source);
    if (!existing) {
      entry.servers.push(serverRow);
    } else {
      // Duplikat dari sumber yang sama dengan kunci dedup sama (mis. posting
      // ulang): jangan buang diam-diam — simpan yang paling lengkap/terbaru.
      const score = (r) => (r.version ? 2 : 0) + (r.size_mb != null ? 1 : 0) + (r.mod_info ? 1 : 0);
      if (score(serverRow) > score(existing) || (serverRow.updated || '') > (existing.updated || '')) {
        Object.assign(existing, serverRow);
      }
    }
    // Isi field kosong dari server lain (ikon/deskripsi/kategori/package).
    if (!entry.icon && s.icon) entry.icon = s.icon;
    if (!entry.description && s.description) entry.description = s.description;
    if (!entry.category && s.category) entry.category = s.category;
    if (!entry.package_name && s.package_name) entry.package_name = s.package_name;
    if (s.name && s.name.length > (entry.name || '').length) entry.name = s.name;
  }
  const apps = [];
  const skipped = [];
  for (const key of order) {
    const raw = byKey.get(key);
    // Urutkan server sesuai urutan kanonis.
    raw.servers.sort((a, b) => SERVER_ORDER.indexOf(a.source) - SERVER_ORDER.indexOf(b.source));
    // Type: gabungkan type semua server; game/app menang atas 'unknown'.
    // Kalau server berbeda game vs app, pakai type server pertama (urutan kanonis).
    const knownTypes = [...new Set(raw.servers.map((s) => s._type).filter((t) => t && t !== 'unknown'))];
    raw.type = knownTypes.length >= 1 ? (knownTypes.includes(raw.servers[0]._type) ? raw.servers[0]._type : knownTypes[0]) : 'unknown';
    // Override klasifikasi (Kimi): emulator/launcher/plugin/icon-pack/
    // keyboard selalu Aplikasi, walau sumber menaruhnya di game.
    // ("theme" sengaja tidak dimasukkan: game "Theme Park" akan salah kena.)
    const hay = `${raw.name || ''} ${raw.category || ''}`.toLowerCase();
    if (raw.type === 'game' && /\b(emulator|launcher|plugin)\b|icon[\s-]?pack|keyboard/.test(hay)) raw.type = 'app';
    for (const s of raw.servers) delete s._type;
    const entry = normalizeEntry(raw);
    const v = validateEntry(entry);
    if (!v.ok) { skipped.push({ key, errors: v.errors }); continue; }
    apps.push(entry);
  }
  // Terbaru dulu.
  apps.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  // Jaga slug unik (dua nama berbeda bisa menghasilkan slug sama).
  const seenSlugs = new Set();
  for (const a of apps) {
    let sl = a.slug, n = 2;
    while (seenSlugs.has(sl)) sl = `${a.slug}-${n++}`;
    a.slug = sl;
    seenSlugs.add(sl);
  }
  return { apps, skipped, mergedCount: serverEntries.length - order.length };
}
