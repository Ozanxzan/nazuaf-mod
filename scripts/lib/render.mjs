// Render HTML statis, tema sama seperti morphe.nazuaf.com:
// header: logo + tombol "Blog nazuaf.com" + pencarian oval (flex sama lebar).
//
// Arsitektur (batas 20.000 file/deployment di Cloudflare Pages):
// - Listing dipecah jadi halaman statis per 100 entri (Game 1..N, Aplikasi 1..N).
// - Halaman detail TIDAK dibuat per entri lagi: satu template /detail/ yang
//   dirender di browser dari chunk JSON (/data/chunks/NNN.json, 1.000 entri
//   per file) + indeks slug (/data/slugs.json). URL lama /apps/<slug>/ tetap
//   jalan lewat _redirects (/apps/* -> /detail/ 200).
// - Pencarian global di /cari/ memakai indeks ringkas /data/search.json.
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatDateId(iso) {
  if (!iso) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

const SOURCE_LABEL = { apkmody: 'APKMody', modyolo: 'ModYolo', an1: 'AN1' };
const SERVER_NUM = { apkmody: 1, modyolo: 2, an1: 3 };
export const PAGE_SIZE = 100;
export const CHUNK_SIZE = 1000;

export function pageUrl(type, page) {
  if (type === 'game') return page <= 1 ? '/' : `/game/page/${page}/`;
  return page <= 1 ? '/app/' : `/app/page/${page}/`;
}

export function chunkFileForIndex(idx) {
  return `/data/chunks/${String(Math.floor(idx / CHUNK_SIZE)).padStart(3, '0')}.json`;
}

function shell({ title, desc, body }) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="stylesheet" href="/assets/style.css"></head><body><header class="site-header"><div class="wrap"><a class="brand" href="/"><span class="brand-mark">n</span><span class="brand-text">mod<span>.nazuaf.com</span></span></a><nav class="site-nav"><a href="https://nazuaf.com">Blog nazuaf.com</a><form class="site-search" action="/cari/" method="get" role="search"><input type="search" name="q" placeholder="Cari game &amp; aplikasi MOD..." aria-label="Cari game dan aplikasi"><button type="submit" aria-label="Cari"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg></button></form></nav></div></header><main class="wrap">${body}</main><footer class="site-footer"><div class="wrap"><p>Katalog ini hanya menampilkan daftar dan meneruskan unduhan ke halaman download APKMody / ModYolo / AN1. File APK tidak di-host di situs ini.</p><p><a href="https://nazuaf.com">nazuaf.com</a> — Teknologi, Informasi, dan Inspirasi Digital.</p></div></footer><button id="toTop" class="to-top" type="button" aria-label="Lompat ke atas" title="Ke atas">↑</button><script>(function(){var b=document.getElementById('toTop');if(!b)return;function t(){b.classList.toggle('show',window.scrollY>400)}window.addEventListener('scroll',t,{passive:true});t();b.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});})();</script></body></html>`;
}

function card(a) {
  const badges = a.sources.map((s) => `<span class="srv-badge">${esc(SOURCE_LABEL[s])}</span>`).join('');
  return `
    <a class="app-card" href="/apps/${esc(a.slug)}/" data-search="${esc(`${a.name} ${a.category || ''} ${a.description || ''} ${a.servers.map((s) => s.mod_info || '').join(' ')}`.toLowerCase())}">
      <img class="app-icon" src="${esc(a.icon || '/assets/icon-placeholder.svg')}" alt="Ikon ${esc(a.name)}" width="56" height="56" loading="lazy">
      <span class="app-body"><span class="app-name">${esc(a.name)}</span>
      <span class="app-meta">${a.category ? `${esc(a.category)} · ` : ''}v${esc(a.version || '?')}${a.size_mb ? ` · ${esc(a.size_mb)} MB` : ''}</span>
      <span class="app-date">${esc(formatDateId(a.updated))} · ${badges}</span></span>
      <span class="app-get" aria-hidden="true">↓</span>
    </a>`;
}

export function renderListing({ type, page, totalPages, items, counts, generatedAt, popularCount = 0 }) {
  const total = type === 'game' ? counts.game : counts.app;
  const label = type === 'game' ? 'Game' : 'Aplikasi';
  const start = (page - 1) * PAGE_SIZE;
  const end = start + items.length;
  const prev = page > 1
    ? `<a class="pager-btn" href="${pageUrl(type, page - 1)}">‹ Sebelumnya</a>`
    : `<span class="pager-btn" aria-disabled="true">‹ Sebelumnya</span>`;
  const next = page < totalPages
    ? `<a class="pager-btn" href="${pageUrl(type, page + 1)}">Berikutnya ›</a>`
    : `<span class="pager-btn" aria-disabled="true">Berikutnya ›</span>`;
  const title = page <= 1
    ? 'Katalog MOD Android — APKMody + ModYolo + AN1 — mod.nazuaf.com'
    : `Katalog MOD Android — ${label} (Halaman ${page}) — mod.nazuaf.com`;
  const body = `
    <section class="hero"><h1>Katalog MOD Android, gabungan APKMody + ModYolo + AN1.</h1><p>${counts.game + counts.app} game &amp; aplikasi MOD dalam satu daftar — ${counts.game} game, ${counts.app} aplikasi${counts.unknown ? `, ${counts.unknown} belum dikategorikan` : ''}. Di halaman detail, pilih server download-nya: Server 1 APKMody, Server 2 ModYolo, atau Server 3 AN1 — masing-masing dengan versi, ukuran, dan info MOD-nya sendiri.</p>
    <p class="updated">Terakhir diperbarui: ${esc(formatDateId(generatedAt))}</p></section>
    <div class="tabs" role="tablist" aria-label="Jenis katalog">
      <a class="tab-btn${type === 'game' ? ' active' : ''}" role="tab" href="/" aria-selected="${type === 'game' ? 'true' : 'false'}">Game (${counts.game})</a>
      <a class="tab-btn${type === 'app' ? ' active' : ''}" role="tab" href="/app/" aria-selected="${type === 'app' ? 'true' : 'false'}">Aplikasi (${counts.app})</a>
    </div>
    <input id="q" type="search" placeholder="Cari di halaman ini..." aria-label="Cari game dan aplikasi">
    <section class="tab-panel" id="tab-${type}">
      <h2>${label} <span class="count">${total}</span></h2>
      ${page === 1 && popularCount > 0 ? `<p class="note">${popularCount} ${label.toLowerCase()} populer ditampilkan dulu — halaman berikutnya menampilkan seluruh katalog.</p>` : ''}
      <div class="apps-list" data-list="${type}">${items.map(card).join('')}</div>
      <p class="no-result" hidden>Tidak ada ${label.toLowerCase()} yang cocok di halaman ini. Coba kata kunci lain atau cari di <a href="/cari/">pencarian global</a>.</p>
      <nav class="pager" aria-label="Halaman ${label.toLowerCase()}">
        ${prev}
        <span class="pager-info">Halaman ${page} dari ${totalPages} — ${items.length ? `${start + 1}–${end}` : '0'} dari ${total}</span>
        ${next}
      </nav>
    </section>
    ${type === 'game' && page === 1 && counts.unknown ? `<p class="note"><a href="/unknown/">Belum dikategorikan (${counts.unknown})</a> — entri yang tipenya tidak bisa ditentukan dari sumbernya, menunggu ditinjau.</p>` : ''}
    <script>
      const q = document.getElementById('q');
      q.addEventListener('input', () => {
        const needle = q.value.trim().toLowerCase();
        const list = document.querySelector('[data-list]');
        const noResult = document.querySelector('.no-result');
        let shown = 0;
        for (const el of list.children) {
          const hit = !needle || el.dataset.search.includes(needle);
          el.style.display = hit ? '' : 'none';
          if (hit) shown++;
        }
        noResult.hidden = shown > 0;
      });
    </script>`;
  return shell({ title, desc: `Daftar ${total} ${label.toLowerCase()} MOD Android dari APKMody, ModYolo, dan AN1, pilih server download.`, body });
}

export function renderUnknown(apps, generatedAt) {
  const rows = apps.map((a) => `<li><a href="/apps/${esc(a.slug)}/">${esc(a.name)}</a> — ${esc(a.sources.map((s) => SOURCE_LABEL[s]).join(', '))} · v${esc(a.version || '?')} · ${esc(formatDateId(a.updated))}</li>`).join('');
  const body = `
    <nav class="crumbs"><a href="/">Katalog</a> / Belum dikategorikan</nav>
    <section class="hero"><h1>Belum dikategorikan (${apps.length})</h1><p>Entri yang tipenya (game / aplikasi) tidak bisa ditentukan dengan yakin dari sumbernya. Entri ini tidak tampil di tab Game maupun Aplikasi sampai ditinjau.</p>
    <p class="updated">Terakhir diperbarui: ${esc(formatDateId(generatedAt))}</p></section>
    <ul class="info">${rows || '<li>Tidak ada.</li>'}</ul>`;
  return shell({ title: 'Belum dikategorikan — mod.nazuaf.com', desc: 'Entri katalog yang tipenya belum bisa ditentukan.', body });
}

// Template halaman detail dinamis: slug dibaca dari URL /apps/<slug>/,
// datanya diambil dari /data/slugs.json (binary search) + chunk JSON.
// (Skrip di bawah sengaja tanpa template literal bersarang.)
export function renderDetailTemplate() {
  const body = `
    <div id="detail"><p class="note">Memuat detail...</p></div>
    <script>
      var LABEL = { apkmody: 'APKMody', modyolo: 'ModYolo', an1: 'AN1' };
      var NUM = { apkmody: 1, modyolo: 2, an1: 3 };
      var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      function fmtDate(iso) {
        if (!iso) return '—';
        var p = iso.slice(0, 10).split('-');
        return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
      }
      function fail(msg) {
        document.getElementById('detail').innerHTML = '<nav class="crumbs"><a href="/">Semua Game &amp; Aplikasi</a></nav><section class="hero"><h1>Tidak ditemukan</h1><p>' + esc(msg) + '</p><p><a href="/">Kembali ke katalog</a> atau coba <a href="/cari/">pencarian</a>.</p></section>';
      }
      function renderDetail(a) {
        var cards = a.servers.map(function (s) {
          return '<article class="server-card"><h3>Server ' + (NUM[s.source] || '?') + ' — ' + esc(LABEL[s.source]) + '</h3><ul class="info">'
            + '<li><span>Versi</span><span>' + (s.version ? 'v' + esc(s.version) : '—') + '</span></li>'
            + '<li><span>Ukuran</span><span>' + (s.size_mb ? esc(s.size_mb) + ' MB' : '—') + '</span></li>'
            + '<li><span>Info MOD</span><span>' + esc(s.mod_info || '—') + '</span></li>'
            + '<li><span>Diperbarui</span><span>' + esc(fmtDate(s.updated)) + '</span></li>'
            + (s.developer ? '<li><span>Developer</span><span>' + esc(s.developer) + '</span></li>' : '')
            + '</ul><a class="btn-download" href="' + esc(s.download_url) + '" target="_blank" rel="noopener nofollow">Download di ' + esc(LABEL[s.source]) + (s.size_mb ? ' (' + esc(s.size_mb) + ' MB)' : '') + '</a>'
            + '<p class="note">Tautan diteruskan ke halaman download ' + esc(LABEL[s.source]) + ' (<a href="' + esc(s.url) + '" target="_blank" rel="noopener nofollow">lihat sumber</a>). File tidak di-host di situs ini.</p></article>';
        }).join('');
        var rows = [
          ['Tipe', a.type === 'game' ? 'Game' : a.type === 'app' ? 'Aplikasi' : 'Belum dikategorikan'],
          ['Kategori', a.category],
          ['Package', a.package_name],
          ['Server tersedia', a.sources.map(function (s) { return LABEL[s]; }).join(' + ')],
          ['Diperbarui', fmtDate(a.updated)],
          ['Perlu ditinjau', a.needs_review ? 'Ya — digabung dari beberapa server hanya berdasarkan nama (tanpa package name)' : null],
        ].filter(function (r) { return r[1]; });
        var rowsHtml = rows.map(function (r) { return '<li><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></li>'; }).join('');
        document.title = a.name + ' v' + (a.version || '') + ' MOD — mod.nazuaf.com';
        document.getElementById('detail').innerHTML =
          '<nav class="crumbs"><a href="/">Semua Game &amp; Aplikasi</a> / ' + esc(a.name) + '</nav>'
          + '<section class="detail-head"><img class="detail-icon" src="' + esc(a.icon || '/assets/icon-placeholder.svg') + '" alt="Ikon ' + esc(a.name) + '" width="96" height="96">'
          + '<div><h1>' + esc(a.name) + '</h1><p class="detail-meta">' + esc(a.type === 'game' ? 'Game' : 'Aplikasi') + (a.category ? ' · ' + esc(a.category) : '') + ' · v' + esc(a.version || '?') + ' · ' + esc(fmtDate(a.updated)) + '</p>'
          + '<p>' + esc(a.description || '') + '</p></div></section>'
          + '<section><h2>Pilih server download</h2><div class="servers">' + cards + '</div></section>'
          + '<section><h2>Detail</h2><ul class="info">' + rowsHtml + '</ul></section>'
          + '<section id="recs"><h2>Rekomendasi</h2><p class="note">Memuat rekomendasi...</p></section>';
      }
      function renderRecs(a) {
        fetch('/data/recs.json').then(function (r) { return r.json(); }).then(function (recs) {
          var box = document.getElementById('recs');
          if (!box) return;
          var out = [];
          var seen = {};
          seen[a.slug] = true;
          function pushFrom(list) {
            list = list || [];
            for (var i = 0; i < list.length; i++) {
              if (out.length >= 8) break;
              var c = list[i];
              if (seen[c.slug]) continue;
              seen[c.slug] = true;
              out.push(c);
            }
          }
          pushFrom(recs[a.type + '|' + (a.category || '')]);
          if (out.length < 4) pushFrom(recs[a.type + '|__all']);
          if (!out.length) { box.style.display = 'none'; return; }
          var label = a.type === 'game' ? 'Game' : 'Aplikasi';
          var html = '<h2>Rekomendasi</h2><p class="note">' + esc(label) + (a.category ? ' ' + esc(a.category) : '') + ' lainnya yang mungkin kamu suka.</p><div class="apps-list">';
          for (var j = 0; j < out.length; j++) {
            var c = out[j];
            html += '<a class="app-card" href="/apps/' + esc(c.slug) + '/">'
              + '<img class="app-icon" src="' + esc(c.icon || '/assets/icon-placeholder.svg') + '" alt="Ikon ' + esc(c.name) + '" width="56" height="56" loading="lazy">'
              + '<span class="app-body"><span class="app-name">' + esc(c.name) + '</span>'
              + '<span class="app-meta">' + (c.category ? esc(c.category) + ' · ' : '') + 'v' + esc(c.version || '?') + (c.size_mb ? ' · ' + esc(c.size_mb) + ' MB' : '') + '</span>'
              + '<span class="app-date">' + esc(fmtDate(c.updated)) + ' · ' + c.sources.map(function (s) { return esc(LABEL[s]); }).join(', ') + '</span></span>'
              + '<span class="app-get" aria-hidden="true">↓</span></a>';
          }
          html += '</div>';
          box.innerHTML = html;
        }).catch(function () {
          var box = document.getElementById('recs');
          if (box) box.style.display = 'none';
        });
      }
      (function () {
        var parts = location.pathname.split('/').filter(Boolean);
        var slug = parts.length >= 2 && parts[0] === 'apps' ? parts[1] : '';
        if (!slug) { fail('Tidak ada game atau aplikasi yang dipilih.'); return; }
        fetch('/data/slugs.json').then(function (r) { return r.json(); }).then(function (slugs) {
          var lo = 0, hi = slugs.length - 1, idx = -1;
          while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (slugs[mid] === slug) { idx = mid; break; }
            if (slugs[mid] < slug) lo = mid + 1; else hi = mid - 1;
          }
          if (idx < 0) { fail('Entri "' + slug + '" tidak ada di katalog ini.'); return; }
          var chunk = String(Math.floor(idx / 1000)).padStart(3, '0');
          return fetch('/data/chunks/' + chunk + '.json').then(function (r) { return r.json(); }).then(function (apps) {
            var found = null;
            for (var i = 0; i < apps.length; i++) { if (apps[i].slug === slug) { found = apps[i]; break; } }
            if (!found) { fail('Entri "' + slug + '" tidak ada di katalog ini.'); return; }
            renderDetail(found);
            renderRecs(found);
          });
        }).catch(function () { fail('Gagal memuat data katalog. Periksa koneksi lalu muat ulang halaman.'); });
      })();
    </script>`;
  return shell({ title: 'Detail MOD — mod.nazuaf.com', desc: 'Detail game dan aplikasi MOD Android dari APKMody, ModYolo, dan AN1, pilih server download.', body });
}

// Halaman pencarian global: memakai indeks ringkas /data/search.json.
export function renderSearchPage(total) {
  const body = `
    <section class="hero"><h1>Cari game &amp; aplikasi MOD</h1><p>Mencari di seluruh katalog (${total} entri), bukan hanya halaman ini.</p></section>
    <form class="site-search" action="/cari/" method="get" role="search" style="margin-bottom:16px"><input id="q" type="search" name="q" placeholder="Cari game &amp; aplikasi MOD..." aria-label="Cari game dan aplikasi" style="flex:1"><button type="submit" aria-label="Cari">Cari</button></form>
    <p class="note" id="search-info"></p>
    <div class="apps-list" id="results"></div>
    <p class="no-result" id="no-result" hidden>Tidak ada yang cocok. Coba kata kunci lain.</p>
    <script>
      var params = new URLSearchParams(location.search);
      var q = (params.get('q') || '').trim();
      var input = document.getElementById('q');
      input.value = q;
      var info = document.getElementById('search-info');
      var list = document.getElementById('results');
      var noResult = document.getElementById('no-result');
      function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
      if (!q) { info.textContent = 'Ketik kata kunci di atas untuk mencari.'; }
      else {
        info.textContent = 'Mencari "' + q + '"...';
        fetch('/data/search.json').then(function (r) { return r.json(); }).then(function (idx) {
          var needle = q.toLowerCase();
          var hits = [];
          for (var i = 0; i < idx.length; i++) {
            var e = idx[i];
            if ((e.n + ' ' + (e.c || '')).toLowerCase().indexOf(needle) >= 0) hits.push(e);
          }
          var shown = hits.slice(0, 100);
          info.textContent = hits.length === 0 ? '' : 'Menampilkan ' + shown.length + ' dari ' + hits.length + ' hasil untuk "' + q + '"' + (hits.length > 100 ? ' — persempit kata kunci untuk hasil lebih tepat.' : '');
          noResult.hidden = hits.length > 0;
          var html = '';
          for (var j = 0; j < shown.length; j++) {
            var h = shown[j];
            html += '<a class="app-card" href="/apps/' + esc(h.s) + '/"><span class="app-body"><span class="app-name">' + esc(h.n) + '</span><span class="app-meta">' + esc(h.t === 'game' ? 'Game' : 'Aplikasi') + (h.c ? ' · ' + esc(h.c) : '') + '</span></span><span class="app-get" aria-hidden="true">↓</span></a>';
          }
          list.innerHTML = html;
        }).catch(function () { info.textContent = 'Gagal memuat indeks pencarian. Periksa koneksi lalu muat ulang halaman.'; });
      }
    </script>`;
  return shell({ title: 'Cari — mod.nazuaf.com', desc: 'Cari game dan aplikasi MOD Android di seluruh katalog mod.nazuaf.com.', body });
}
