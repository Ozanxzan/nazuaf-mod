# Review Kimi — katalog MOD mod.nazuaf.com (21 Nov 2026)

Panggilan pertama Kimi kimi-k3-uncensored gagal HTTP 502 (Geraikita Bad Gateway, ~126 dtk). Retry sekali dengan model murah moonshot-kimi-k2.5 (10 GP) berhasil dalam 28 dtk.

## 1. Akar gagal APKMody via Jina 403
Jina (r.jina.ai) kena 403 karena APKMody pasang Cloudflare WAF yang mendeteksi pola proxy scraping; IP datacenter Jina sudah di-blacklist.

Alternatif (urut rekomendasi Kimi):
1. WP REST API + auth — /wp-json/wp/v2/posts?per_page=100&page=N dengan Application Password. JSON bersih, metadata lengkap.
2. Feed RDF + detail parsial — /feed/?paged=N (10 post/feed) lalu fetch detail dengan rotasi proxy + header browser.
3. Browser Playwright/headless + stealth — berat, lambat 5-10 dtk/halaman.

Catatan koreksi Muse: Kimi menulis cek "mod.nazuaf.com/wp-json/..." — itu salah alamat, yang benar apkmody.com/wp-json/wp/v2/posts. Harus diverifikasi dulu sebelum dipakai.

## 2. Rencana full katalog (estimasi Kimi)
- APKMody ~5.681 item, batch 100, jeda 2 dtk, ~57 batch, ~3-4 jam serial
- ModYolo ~22.740 item, batch 50, jeda 1 dtk, ~455 batch, ~8-10 jam serial
- AN1 belum diukur
- Total ~28.421+, ~500+ batch, ~15 jam serial
- Checkpoint JSONL per batch di data/checkpoints/, resume dari max(batchEnd), retry max 3x exponential backoff 1/2/4 dtk, failed-retry-queue.jsonl
- Validasi: version tidak kosong, size cocok pola MB/GB/KB, packageName cocok /^com\./
- Turnstile: deteksi 403 + cf-turnstile/ray id; mitigasi rotasi UA/header, proxy residential, pause 5 menit lalu lanjut dari checkpoint

## 3. Dedup & tab Game/Aplikasi
- Package tidak ada -> fallback normalized title + developer + size, flag needsReview
- Nama sama package beda -> entri terpisah
- Package sama sumber beda -> merge, ambil versi terbaru, simpan sources[]
- Klasifikasi: mapping kategori sumber ke klasifikasi internal; emulator/launcher/plugin -> App walau dari sumber game; override manual via whitelist forceCategory
- Struktur internal yang diusulkan: id slug, packageName primary key, categoryInternal, isGame boolean, sources[] dengan rawCategory per server

## 4. 3 risiko terbesar
1. AN1 belum diukur — pilot 50 sampel dulu, dokumentasi selector, jangan parallel full sampai valid
2. Sumber ubah struktur / perketat proteksi — monitoring fail-rate, pause kalau >10% dalam 1 batch, test suite 10 URL tetap per sumber
3. Legal/ToS — disclaimer aggregator, tidak host APK, tidak hotlink image, hormati robots.txt
