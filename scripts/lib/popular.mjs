// Daftar populer untuk halaman awal listing (100 game + 100 aplikasi).
//
// Halaman 1 tiap tab menampilkan 100 entri populer dulu, halaman 2+
// menampilkan sisanya urut abjad (slug) seperti sebelumnya. Urutan master
// (chunk JSON + slugs.json) TIDAK diubah — halaman detail memakai binary
// search di slugs.json, jadi slugs.json harus tetap terurut.
import { readFileSync, existsSync } from 'node:fs';

export const POPULAR_SIZE = 100;

// Baca data/popular.json ({ game: [slug], app: [slug] }).
// File tidak ada / rusak / bukan array → daftar kosong (fallback: semua
// urut abjad, perilaku lama). Slug yang tidak ada di katalog dilewati
// saat pengurutan, supaya entri yang sudah dihapus tidak merusak build.
export function loadPopular(popularPath) {
  try {
    if (!popularPath || !existsSync(popularPath)) return { game: [], app: [] };
    const raw = JSON.parse(readFileSync(popularPath, 'utf8'));
    const pick = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
    return { game: pick(raw.game), app: pick(raw.app) };
  } catch {
    return { game: [], app: [] };
  }
}

// Urutkan satu tipe untuk listing: populer dulu (sesuai urutan file),
// lalu sisanya urut slug. Selalu kembalikan daftar lengkap tanpa duplikat.
export function orderForListing(list, popularSlugs) {
  const bySlug = new Map(list.map((a) => [a.slug, a]));
  const seen = new Set();
  const out = [];
  for (const slug of popularSlugs || []) {
    const a = bySlug.get(slug);
    if (a && !seen.has(slug)) { out.push(a); seen.add(slug); }
  }
  const rest = list.filter((a) => !seen.has(a.slug))
    .sort((x, y) => (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
  return out.concat(rest);
}
