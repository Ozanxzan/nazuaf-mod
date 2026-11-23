# nazuaf-mod — Katalog MOD Android gabungan APKMody + ModYolo + AN1

Prototipe lokal (belum deploy). Domain rencana: `mod.nazuaf.com`, repo rencana: `nazuaf-mod`.
Live: https://nazuaf-mod.pages.dev (project Pages dibuat 21 Nov 2026).
Template: `~/workspace/nazuaf-apps/` (morphe.nazuaf.com) — header, pencarian oval,
tema yang sama. Data Morphe TIDAK dipakai.

## Model data (`data/apps.json`)

Satu entri = satu game/aplikasi, dengan banyak server:

```json
{
  "slug": "clash-of-clans",
  "name": "Clash of Clans",
  "type": "game",
  "category": "Strategy",
  "package_name": "com.supercell.clashofclans",
  "icon": "https://modyolo.com/wp-content/uploads/...jpg",
  "description": "...",
  "version": "19.32.4",
  "size_mb": 840,
  "updated": "2026-11-04",
  "servers": [
    {"source": "apkmody", "version": "19.32.4", "size_mb": null,
     "mod_info": "Unlimited Money", "updated": "2026-11-04",
     "url": "https://apkmody.com/games/clash-of-clans",
     "download_url": "https://apkmody.com/games/clash-of-clans/download"},
    {"source": "modyolo", "version": "18.647.5", "size_mb": 426.1,
     "mod_info": "Unlimited money", "updated": "2026-08-07",
     "url": "https://modyolo.com/clash-of-clans.html",
     "download_url": "https://modyolo.com/download/clash-of-clans-123"}
  ],
  "sources": ["apkmody", "modyolo"]
}
```

Dedup: `package_name` bila ada, fallback nama dinormalisasi (huruf+angka kecil).
Tombol download mengarah ke **halaman download sumber**, bukan file `.apk`
langsung — link file final tidak bisa diambil (HappyMod: reCAPTCHA; APKMody:
Cloudflare + halaman perantara). **Tidak hosting APK.**

## Jalur scrape (terverifikasi 21 Nov 2026)

| Sumber | Enumerasi/hitung | Detail |
|---|---|---|
| APKMody | `/sitemap.xml` diblokir Cloudflare 403 dari IP server → fallback enumerasi WP REST API (`/wp-json/wp/v2/posts`, 100/halaman, urut `modified` desc). Duplikat bahasa `/vi/`, `/id/` dipisah; hanya `/games/` + `/apps/` (EN) yang dihitung. **5.681 slug EN unik** (game 4.064 entri link, app 1.631 — hitung per link, lihat `data/sitemap-counts.json`). | HTML langsung diblokir Cloudflare; Jina Reader kena rate-limit massal (sampel: 100/100 gagal 403, tapi 1 request tunggal lolos). **Jalur yang dipakai: Google Translate proxy** (`apkmody-com.translate.goog/...`) — mengembalikan HTML lengkap tanpa challenge, JSON-LD berisi `softwareVersion` + `fileSize` + `author` + `og:image`. Fallback: Jina, lalu data WP saja. |
| ModYolo | `/sitemap.xml` → 23 post-sitemap (+ sitemap kategori/dll, total 41 entri index), 34.076 entri URL, **22.740 detail `.html`**, 11.336 taksonomi, WP total 22.721. | HTML langsung: tabel info (App Name/Publisher/Genre/Size/Latest Version/MOD Info), JSON-LD, `og:image`, tombol `/download/<slug>-<wpId>`, package dari tautan Google Play. |
| AN1 | **Sitemap BASI**: `/sitemap.xml` (5.060 URL, domain ditulis dengan huruf Cyrillic mirip Latin) berisi URL tanpa prefix ID (`/coin-master.html`) — pilot 100 entri: 99× HTTP 404. Enumerasi benar lewat **halaman kategori** `/games/<kat>/` + `/programmy/<kat>/` (17+17 kategori), pagination `/page/N/`, link detail berpola `/<id>-<slug>.html`. **4.301 target live.** | HTML langsung (DLE): `<title>` "Download {Nama} (MOD, {fitur}) {versi} APK", `<ul class="spec">` (Android min, `softwareVersion`, `fileSize`), tombol `/file_<id>-dw.html`, `og:image`, `datePublished`, `applicationCategory` Games/Programs, publisher. Package name TIDAK ada di halaman AN1. Halaman berita/artikel (tanpa tombol download) di-skip sebagai bukan-app. |

## Full katalog (resumable)

```bash
npm run scrape:full        # = scrape-full semua sumber, batch 500, lanjutkan dari checkpoint
node scripts/scrape-full.mjs --source an1 --batch-size 500 --max-batches 2
node scripts/merge-full.mjs # gabung data/servers/*.jsonl → data/apps.json
```

Target: `data/targets/<sumber>.json`. Hasil per batch di-append ke
`data/servers/<sumber>.jsonl` (1 baris = 1 detail, status ok/fail/
skip-not-app/fallback-wp). Progres: `data/progress.json`. Jalankan ulang
untuk melanjutkan — slug yang sudah ada di JSONL dilewati.

## Aturan merge & tab

- Dedup: `package_name` bila ada, fallback nama dinormalisasi. Nama sama +
  package beda → entri terpisah. Package sama → merge, versi tampil =
  **versi terbaru antar server**, ukuran ikut server yang punya ukuran.
- `needs_review: true` bila entri digabung dari ≥2 server hanya berdasarkan
  nama (tanpa package) — tampil di halaman detail, dihitung di
  `data/full-report.json`.
- Override klasifikasi: emulator/launcher/plugin/icon-pack/keyboard yang
  sumbernya menaruh di game dipaksa jadi **Aplikasi** ("theme" sengaja tidak
  dimasukkan — game "Theme Park" akan salah kena).
- Type `unknown` (tidak bisa ditentukan dari sumber) tidak tampil di tab
  Game/Aplikasi — daftarnya di `/unknown/` untuk ditinjau.
- Validasi (metrik, bukan gate keras — AN1 tidak pernah punya package,
  hard gate akan membuang semua): jumlah entri tanpa versi/ukuran/package/
  ikon per sumber ada di `data/full-report.json` → `validation`.

## Review Kimi (kimi-review.md) — dipakai / ditolak

Dipakai (terverifikasi): checkpoint JSONL + resume + retry 3x (sudah ada di
`lib/fetch.mjs` + `scrape-full.mjs`); pilot AN1 50 sampel sebelum full
(50/50 ok setelah enumerasi diperbaiki); `needsReview` saat package tidak
ada; mapping kategori → game/app + override emulator/launcher/plugin;
monitoring fail-rate per batch (log per batch).

Ditolak / dikoreksi:
- "WP REST API + Application Password memberi metadata lengkap" — **salah**.
  Dicek langsung: `apkmody.com/wp-json/wp/v2/posts` tanpa auth memang HTTP 200,
  tapi `content.rendered` TIDAK mengandung versi/ukuran (`/19\.32\.4|840 ?MB|softwareVersion/`
  tidak cocok), `meta` hanya `{_acf_changed, footnotes}`, `acf: []`, tidak ada
  `yoast_head`/`yoast_head_json`, post type hanya standar. Versi/ukuran hanya
  ada di HTML/JSON-LD halaman detail. Application Password juga butuh kredensial
  admin WP yang tidak kita punya. Jalur yang dipakai: Google Translate proxy.
- "Feed + fetch detail dengan header browser" — **sudah dicoba, gagal**:
  HTML langsung 403 Cloudflare untuk semua UA yang diuji (desktop, mobile,
  Googlebot). Bukan masalah header.
- Estimasi Kimi (~15 jam serial, batch 50/100) — terlalu pesimistis: batch 500
  + konkurensi 3-5 dipakai; AN1 pilot 50 selesai ~98 dtk termasuk membangun
  target (~360 halaman kategori).
- "Tidak hotlink image" — **ditunda**: ikon saat ini hotlink ke server sumber
  (dengan placeholder lokal bila kosong). Mengunduh ~30 ribu ikon lokal akan
  melipatgandakan waktu/penyimpanan scrape; bisa dialihkan ke pola
  nazuaf-apps (download saat build) nanti.
- "Cek mod.nazuaf.com/wp-json/..." — salah alamat (dicatat Kimi sendiri);
  yang benar `apkmody.com/wp-json/...`, sudah dicek (lihat di atas).

Catatan robots.txt (21 Nov 2026): APKMody `Disallow: /wp-json/` — pemakaian
WP API kami (read-only, tanpa auth, rate rendah, data sama dengan sitemap
publik) menyimpang dari robots.txt; sitemap adalah jalur yang patuh, tapi
fetch langsungnya diblokir Cloudflare dari IP server. ModYolo mengizinkan
semua kecuali `/wp-admin/`. AN1 melarang `/engine/go.php` dan
`/engine/download.php` (bukan halaman detail/download yang kami pakai).

## Perintah

```bash
npm run scrape   # hitung sitemap + ambil 100 terbaru per sumber → data/apps.json (sampel)
npm run scrape:full  # full katalog, resumable per batch (lihat di bawah)
npm run merge:full   # gabung data/servers/*.jsonl → data/apps.json
npm run build    # data/apps.json → public/ (listing per 100 + detail dinamis, lihat di bawah)
npm test         # node --test test/*.test.mjs
# Lihat lokal: npx serve public  atau  python3 -m http.server -d public
```

## Deploy ke live (langkah untuk Zan, dari HP)

Snapshot live pertama (21 Nov 2026, 16.18 WIB): **9.222 entri**
(game 8.029, aplikasi 1.193, unknown 0) dari AN1 full 4.236 ok +
ModYolo 5.000/22.721 ok + APKMody sampel 100 (fallback WP, tanpa
versi/ukuran). Tes 19/19 lolos, build 3,3 dtk, `public/` 46 MB
(index.html 8,0 MB, 9.222 halaman detail). Full scrape dilanjutkan

## Batas file Cloudflare Pages (22 Nov 2026)

Katalog full 30.776 entri TIDAK bisa di-deploy sebagai satu halaman
detail per entri: Pages menolak deployment di atas 20.000 file (dan
25 MB per file). Karena itu build sekarang menghasilkan:
- Listing statis per 100 entri: `/` + `/game/page/N/`, `/app/` + `/app/page/N/`
- Detail dinamis: satu template `/detail/` + `_redirects` (`/apps/* /detail/ 200`,
  jadi URL lama `/apps/<slug>/` tetap jalan) + chunk JSON `/data/chunks/NNN.json`
  (1.000 entri/file) + indeks slug `/data/slugs.json` (binary search di browser)
- Pencarian global `/cari/` memakai indeks ringkas `/data/search.json`
- Total ~350 file untuk 30.780 entri (build lokal 3,8 dtk, file terbesar 2,4 MB).
setelah live — lihat "Lanjutkan full scrape" di bawah.

### 1. Buat repo GitHub (Zan, dari HP — Brave)
1. Buka github.com/new → Repository name: `nazuaf-mod` → **Public** →
   jangan centang "Add a README" → Create repository.
2. Beri tahu Muse — Muse yang push semua file prototipe ini ke `main`
   (commit pertama). **Jangan** buat file apa pun dulu di repo.

### 2. Buat workflow sync (Zan, dari HP — token Muse tidak bisa membuat file di `.github/workflows/`, 403)
1. Di repo `Ozanxzan/nazuaf-mod`, buka **Add file → Create new file**.
2. Nama file: `.github/workflows/sync.yml` (tulis persis, termasuk titik di depan).
3. Tempel isi di bawah ini, lalu **Commit new file** langsung ke `main`:

```yaml
name: Sync nazuaf-mod

on:
  schedule:
    # UTC — sama dengan 00.00 / 08.00 / 16.00 WIB
    - cron: '0 17,1,9 * * *'
  workflow_dispatch:

concurrency:
  group: sync
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm test
      # Lanjutkan scrape full dari checkpoint (data/servers/*.jsonl +
      # data/progress.json ikut ter-commit, jadi tiap run hanya mengambil
      # sisa + entri baru). APKMody lewat Google Translate proxy.
      - run: node scripts/scrape-full.mjs --batch-size 500
      - run: node scripts/merge-full.mjs
      - run: node scripts/build.mjs
      - name: Commit kalau ada perubahan data
        run: |
          git config user.name "muse-sync"
          git config user.email "muse-sync@nazuaf.com"
          git add data/
          git diff --cached --quiet || git commit -m "sync: update katalog MOD $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          git push
```

4. Cek tab **Actions** → jalankan sekali manual (**Run workflow**) untuk
   memastikan sync jalan; run pertama akan lama (melanjutkan sisa
   ModYolo ~17.721 + APKMody ~5.581 entri).

### 3. Buat project Cloudflare Pages (Zan, dari HP atau laptop)
1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
   pilih repo `Ozanxzan/nazuaf-mod`.
2. **Build command:** `node scripts/build.mjs` — **Output directory:** `public` —
   **Root directory:** (kosong) — **Production branch:** `main`.
   Tidak perlu environment variable.
3. **Save and Deploy** → tunggu deploy pertama → alamat sementara
   `https://nazuaf-mod.pages.dev`.

### 4. Pasang domain mod.nazuaf.com
1. Di project Pages → **Custom domains → Set up a custom domain** →
   ketik `mod.nazuaf.com` → Continue → Activate domain.
   (nazuaf.com sudah di Cloudflare, DNS CNAME dibuat otomatis.)
2. Buka https://mod.nazuaf.com — cek tab **Game (8.029)** dan
   **Aplikasi (1.193)**, pencarian, dan satu halaman detail (mis.
   Subway Surfers City → tombol Server 3 — AN1).

### Lanjutkan full scrape (setelah live)
Di VM ini (atau lewat workflow sync di atas, otomatis):
```bash
node scripts/scrape-full.mjs --batch-size 500   # lanjut dari checkpoint
node scripts/merge-full.mjs && node scripts/build.mjs
```
Sisa saat live pertama: ModYolo 17.721 entri + APKMody 5.581 entri
(total target ~32.722). Checkpoint di `data/servers/*.jsonl` dan
`data/progress.json` — jangan dihapus; menghapusnya berarti scrape
diulang dari awal.

## Yang belum dikerjakan

- Full katalog belum selesai: sisa ModYolo 17.721 entri + APKMody 5.581
  entri (APKMody via Google Translate proxy — versi/ukuran baru terisi
  penuh setelah full scrape; 100 entri sampelnya saat ini tanpa
  versi/ukuran). Checkpoint aman di `data/servers/*.jsonl` +
  `data/progress.json`; lanjutkan dengan `node scripts/scrape-full.mjs`.
- Belum ada GitHub repo, workflow sync, atau deploy Cloudflare Pages
  (langkahnya ada di "Deploy ke live" di atas — Zan yang membuat repo +
  workflow, Muse push file).
- Ikon masih hotlink ke server sumber (lihat catatan Kimi di atas).

## Halaman awal: 100 populer dulu (23 Nov 2026)

- Permintaan Zan: daftar di awal halaman harus game dan aplikasi populer saja — 100 game + 100 aplikasi populer ditampilkan dulu.
- Data katalog tidak punya angka popularitas (unduhan/rating), jadi daftar populer adalah kurasi judul terkenal (`data/popular.json`: 100 slug game + 100 slug app, mis. Minecraft, GTA San Andreas, PUBG, Spotify, TikTok, Instagram) — dibuat dengan `make-popular.mjs` (kurasi + isi sisa dari entri multi-sumber), lalu diverifikasi semua slug ada dan tipenya benar.
- `scripts/lib/popular.mjs` (`loadPopular` + `orderForListing`) + `scripts/build.mjs`: hanya listing halaman 1 yang diurutkan populer dulu; halaman 2+ sisanya urut abjad. Urutan master (`apps`, chunk JSON, `slugs.json`) tetap urut slug karena halaman detail memakai binary search di `slugs.json`.
- `scripts/lib/render.mjs`: halaman 1 menampilkan catatan "100 game/aplikasi populer ditampilkan dulu — halaman berikutnya menampilkan seluruh katalog."
- Mengubah daftar: edit `data/popular.json` (slug harus ada di katalog; slug yang hilang dilewati otomatis) lalu push — Pages rebuild otomatis. Tes: `test/popular.test.mjs` (33/33 lolos).
