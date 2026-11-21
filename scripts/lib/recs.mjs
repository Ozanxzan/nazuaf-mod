// Daftar rekomendasi per kategori, dipakai halaman detail dinamis.
// buildRecs(apps) -> { "<type>|<kategori>": [kartu...], "<type>|__all": [kartu...] }
// Setiap daftar: maks 8 entri, urut terbaru dulu (updated desc, lalu nama).
// Kartu hanya membawa field yang dipakai render kartu rekomendasi.
export const RECS_PER_LIST = 8;

export function cardData(a) {
  return {
    slug: a.slug,
    name: a.name,
    category: a.category || '',
    icon: a.icon || null,
    version: a.version || null,
    size_mb: a.size_mb ?? null,
    updated: a.updated || null,
    sources: a.sources || [],
    mod: (a.servers || []).map((s) => s.mod_info || '').filter(Boolean),
  };
}

function byNewest(a, b) {
  if ((b.updated || '') !== (a.updated || '')) return (b.updated || '') < (a.updated || '') ? -1 : 1;
  return (a.name || '') < (b.name || '') ? -1 : 1;
}

export function buildRecs(apps) {
  const recs = {};
  const byKey = new Map();
  const byType = new Map();
  for (const a of apps) {
    if (a.type !== 'game' && a.type !== 'app') continue;
    const key = `${a.type}|${a.category || ''}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(a);
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type).push(a);
  }
  for (const [key, list] of byKey) {
    recs[key] = list.slice().sort(byNewest).slice(0, RECS_PER_LIST).map(cardData);
  }
  for (const [type, list] of byType) {
    recs[`${type}|__all`] = list.slice().sort(byNewest).slice(0, RECS_PER_LIST).map(cardData);
  }
  return recs;
}

// Pilih rekomendasi untuk satu entri: kategori sama dulu, kalau kurang
// dari 4, dilengkapi dari yang terbaru di tipe yang sama. Maks 8.
export function pickRecs(recs, app, limit = RECS_PER_LIST) {
  const key = `${app.type}|${app.category || ''}`;
  const out = [];
  const seen = new Set([app.slug]);
  const pushFrom = (list) => {
    for (const c of list || []) {
      if (out.length >= limit) break;
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      out.push(c);
    }
  };
  pushFrom(recs[key]);
  if (out.length < 4) pushFrom(recs[`${app.type}|__all`]);
  return out;
}
