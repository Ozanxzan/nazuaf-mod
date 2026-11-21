// Render HTML statis, tema sama seperti morphe.nazuaf.com:
// header: logo + tombol "Blog nazuaf.com" + pencarian oval (flex sama lebar).
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

function shell({ title, desc, body }) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="stylesheet" href="/assets/style.css"></head><body><header class="site-header"><div class="wrap"><a class="brand" href="/"><span class="brand-mark">n</span><span class="brand-text">mod<span>.nazuaf.com</span></span></a><nav class="site-nav"><a href="https://nazuaf.com">Blog nazuaf.com</a><form class="site-search" action="/" method="get" role="search"><input type="search" name="q" placeholder="Cari game &amp; aplikasi MOD..." aria-label="Cari game dan aplikasi"><button type="submit" aria-label="Cari"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg></button></form></nav></div></header><main class="wrap">${body}</main><footer class="site-footer"><div class="wrap"><p>Katalog ini hanya menampilkan daftar dan meneruskan unduhan ke halaman download APKMody / ModYolo / AN1. File APK tidak di-host di situs ini. MOD APK adalah aplikasi yang dimodifikasi pihak ketiga — bisa mengandung malware dan melanggar ketentuan developer aslinya. Pasang dengan risiko sendiri.</p><p><a href="https://nazuaf.com">nazuaf.com</a> — Teknologi, Informasi, dan Inspirasi Digital.</p></div></footer></body></html>`;
}

export function renderIndex(apps, generatedAt) {
  const games = apps.filter((a) => a.type === 'game');
  const appl = apps.filter((a) => a.type === 'app');
  const unknown = apps.filter((a) => a.type === 'unknown');
  const card = (a) => {
    const badges = a.sources.map((s) => `<span class="srv-badge">${esc(SOURCE_LABEL[s])}</span>`).join('');
    return `
    <a class="app-card" href="/apps/${esc(a.slug)}/" data-search="${esc(`${a.name} ${a.category || ''} ${a.description || ''} ${a.servers.map((s) => s.mod_info || '').join(' ')}`.toLowerCase())}">
      <img class="app-icon" src="${esc(a.icon || '/assets/icon-placeholder.svg')}" alt="Ikon ${esc(a.name)}" width="56" height="56" loading="lazy">
      <span class="app-body"><span class="app-name">${esc(a.name)}</span>
      <span class="app-meta">${a.category ? `${esc(a.category)} · ` : ''}v${esc(a.version || '?')}${a.size_mb ? ` · ${esc(a.size_mb)} MB` : ''}</span>
      <span class="app-date">${esc(formatDateId(a.updated))} · ${badges}</span></span>
      <span class="app-get" aria-hidden="true">↓</span>
    </a>`;
  };
  const tabSection = (id, list, label) => `
    <section class="tab-panel" id="tab-${id}" ${id === 'game' ? '' : 'hidden'}>
      <h2>${label} <span class="count">${list.length}</span></h2>
      <div class="apps-list" data-list="${id}">${list.map(card).join('')}</div>
      <p class="no-result" hidden>Tidak ada ${label.toLowerCase()} yang cocok. Coba kata kunci lain.</p>
    </section>`;
  const body = `
    <section class="hero"><h1>Katalog MOD Android, gabungan APKMody + ModYolo + AN1.</h1><p>${apps.length} game &amp; aplikasi MOD dalam satu daftar — ${games.length} game, ${appl.length} aplikasi${unknown.length ? `, ${unknown.length} belum dikategorikan` : ''}. Di halaman detail, pilih server download-nya: Server 1 APKMody, Server 2 ModYolo, atau Server 3 AN1 — masing-masing dengan versi, ukuran, dan info MOD-nya sendiri.</p>
    <p class="updated">Terakhir diperbarui: ${esc(formatDateId(generatedAt))}</p></section>
    <div class="tabs" role="tablist" aria-label="Jenis katalog">
      <button class="tab-btn active" role="tab" data-tab="game" aria-selected="true">Game (${games.length})</button>
      <button class="tab-btn" role="tab" data-tab="app" aria-selected="false">Aplikasi (${appl.length})</button>
    </div>
    <input id="q" type="search" placeholder="Cari di tab ini..." aria-label="Cari game dan aplikasi">
    ${tabSection('game', games, 'Game')}
    ${tabSection('app', appl, 'Aplikasi')}
    ${unknown.length ? `<p class="note"><a href="/unknown/">Belum dikategorikan (${unknown.length})</a> — entri yang tipenya tidak bisa ditentukan dari sumbernya, menunggu ditinjau.</p>` : ''}
    <script>
      const q = document.getElementById('q');
      const headerQ = document.querySelector('.site-search input');
      let activeTab = 'game';
      function applyFilter() {
        const needle = q.value.trim().toLowerCase();
        const panel = document.getElementById('tab-' + activeTab);
        const list = panel.querySelector('[data-list]');
        const noResult = panel.querySelector('.no-result');
        let shown = 0;
        for (const card of list.children) {
          const hit = !needle || card.dataset.search.includes(needle);
          card.style.display = hit ? '' : 'none';
          if (hit) shown++;
        }
        noResult.hidden = shown > 0;
      }
      function setTab(tab) {
        activeTab = tab;
        document.querySelectorAll('.tab-btn').forEach((b) => {
          const on = b.dataset.tab === tab;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.id !== 'tab-' + tab; });
        history.replaceState(null, '', tab === 'game' ? location.pathname : location.pathname + '?tab=' + tab);
        applyFilter();
      }
      q.addEventListener('input', () => { if (headerQ) headerQ.value = q.value; applyFilter(); });
      if (headerQ) headerQ.addEventListener('input', () => { q.value = headerQ.value; applyFilter(); });
      document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
      const params = new URLSearchParams(location.search);
      if (params.get('tab') === 'app') setTab('app');
      else if (params.get('q')) { q.value = params.get('q'); if (headerQ) headerQ.value = params.get('q'); applyFilter(); }
    </script>`;
  return shell({ title: 'Katalog MOD Android — APKMody + ModYolo + AN1 — mod.nazuaf.com', desc: `Daftar ${apps.length} game & aplikasi MOD Android dari APKMody, ModYolo, dan AN1, pilih server download.`, body });
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

export function renderDetail(app) {
  const serverCards = app.servers.map((s) => `
    <article class="server-card">
      <h3>Server ${SERVER_NUM[s.source] || '?'} — ${esc(SOURCE_LABEL[s.source])}</h3>
      <ul class="info">
        <li><span>Versi</span><span>${s.version ? `v${esc(s.version)}` : '—'}</span></li>
        <li><span>Ukuran</span><span>${s.size_mb ? `${esc(s.size_mb)} MB` : '—'}</span></li>
        <li><span>Info MOD</span><span>${esc(s.mod_info || '—')}</span></li>
        <li><span>Diperbarui</span><span>${esc(formatDateId(s.updated))}</span></li>
        ${s.developer ? `<li><span>Developer</span><span>${esc(s.developer)}</span></li>` : ''}
      </ul>
      <a class="btn-download" href="${esc(s.download_url)}" target="_blank" rel="noopener nofollow">Download di ${esc(SOURCE_LABEL[s.source])}${s.size_mb ? ` (${esc(s.size_mb)} MB)` : ''}</a>
      <p class="note">Tautan diteruskan ke halaman download ${esc(SOURCE_LABEL[s.source])} (<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">lihat sumber</a>). File tidak di-host di situs ini.</p>
    </article>`).join('');
  const rows = [
    ['Tipe', app.type === 'game' ? 'Game' : app.type === 'app' ? 'Aplikasi' : 'Belum dikategorikan'],
    ['Kategori', app.category],
    ['Package', app.package_name],
    ['Server tersedia', app.sources.map((s) => SOURCE_LABEL[s]).join(' + ')],
    ['Diperbarui', formatDateId(app.updated)],
    ['Perlu ditinjau', app.needs_review ? 'Ya — digabung dari beberapa server hanya berdasarkan nama (tanpa package name)' : null],
  ].filter(([, v]) => v);
  const rowsHtml = rows.map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('');
  const body = `
    <nav class="crumbs"><a href="/">Semua Game &amp; Aplikasi</a> / ${esc(app.name)}</nav>
    <section class="detail-head">
      <img class="detail-icon" src="${esc(app.icon || '/assets/icon-placeholder.svg')}" alt="Ikon ${esc(app.name)}" width="96" height="96">
      <div><h1>${esc(app.name)}</h1><p class="detail-meta">${esc(app.type === 'game' ? 'Game' : 'Aplikasi')}${app.category ? ` · ${esc(app.category)}` : ''} · v${esc(app.version || '?')} · ${esc(formatDateId(app.updated))}</p>
      <p>${esc(app.description || '')}</p></div>
    </section>
    <section><h2>Pilih server download</h2><div class="servers">${serverCards}</div></section>
    <section><h2>Detail</h2><ul class="info">${rowsHtml}</ul></section>`;
  return shell({ title: `${app.name} v${app.version || ''} MOD — mod.nazuaf.com`, desc: app.description || `${app.name} MOD APK dari APKMody dan ModYolo.`, body });
}
