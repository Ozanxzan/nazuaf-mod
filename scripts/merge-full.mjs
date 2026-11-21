// Gabung semua hasil scrape-full (data/servers/*.jsonl) → data/apps.json.
//   node scripts/merge-full.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeServers } from './lib/merge.mjs';
import { writeAppsJson } from './lib/schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function mergeFull() {
  const serversDir = join(ROOT, 'data', 'servers');
  const entries = [];
  const stats = {};
  for (const file of readdirSync(serversDir).filter((f) => f.endsWith('.jsonl')).sort()) {
    const source = file.replace('.jsonl', '');
    const st = stats[source] = { ok: 0, fail: 0, skipped_not_app: 0, fallback_wp: 0, lines: 0 };
    for (const line of readFileSync(join(serversDir, file), 'utf8').split('\n').filter(Boolean)) {
      st.lines++;
      let j;
      try { j = JSON.parse(line); } catch { st.fail++; continue; }
      if (j.status === 'fail') { st.fail++; continue; }
      if (j.status === 'skip-not-app') { st.skipped_not_app++; continue; }
      if (j.status === 'fallback-wp') st.fallback_wp++;
      if (j.entry) { st.ok++; entries.push(j.entry); }
    }
  }
  const { apps, skipped, mergedCount } = mergeServers(entries);
  const byType = { game: 0, app: 0, unknown: 0 };
  for (const a of apps) byType[a.type] = (byType[a.type] || 0) + 1;
  // Validasi kualitas data (Kimi): hitung entri yang field-nya kosong —
  // dipakai sebagai metrik, bukan gate keras (AN1 tidak pernah punya package,
  // APKMody tidak punya ukuran lewat Jina; hard gate akan membuang semua).
  const validation = {
    missing_version: apps.filter((a) => !a.version).length,
    missing_size: apps.filter((a) => a.size_mb == null).length,
    missing_package: apps.filter((a) => !a.package_name).length,
    missing_icon: apps.filter((a) => !a.icon).length,
    needs_review: apps.filter((a) => a.needs_review).length,
    by_source_missing_version: {},
    by_source_missing_size: {},
  };
  for (const src of ['apkmody', 'modyolo', 'an1']) {
    const withSrc = apps.filter((a) => a.sources.includes(src));
    validation.by_source_missing_version[src] = withSrc.filter((a) => !a.servers.find((s) => s.source === src)?.version).length;
    validation.by_source_missing_size[src] = withSrc.filter((a) => a.servers.find((s) => s.source === src)?.size_mb == null).length;
  }
  const report = {
    merged_at: new Date().toISOString(),
    sources: stats,
    server_entries: entries.length,
    merged_entries: apps.length,
    duplicates_merged: mergedCount,
    skipped_invalid: skipped,
    by_type: byType,
    validation,
    by_sources: {},
  };
  for (const a of apps) {
    const k = a.sources.slice().sort().join('+');
    report.by_sources[k] = (report.by_sources[k] || 0) + 1;
  }
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data', 'apps.json'), writeAppsJson(apps, new Date().toISOString(), { counts: { total: apps.length, ...byType } }));
  writeFileSync(join(ROOT, 'data', 'full-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`merge: ${entries.length} entri server → ${apps.length} entri katalog (${mergedCount} duplikat digabung; game ${byType.game}, app ${byType.app}, unknown ${byType.unknown})`);
  console.log(JSON.stringify(stats, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mergeFull();
}
