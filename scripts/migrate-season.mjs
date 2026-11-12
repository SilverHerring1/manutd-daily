// 一次性迁移：把主线 data/*.json 归进 data/seasons/2026-27/
// 用法：node scripts/migrate-season.mjs 2026-27
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = join(ROOT, 'data');
const slug = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(slug ?? '')) {
  console.error('用法: node scripts/migrate-season.mjs 2026-27');
  process.exit(1);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const index = read(join(DATA, 'index.json'));
const metaList = index.issues ?? [];
if (!metaList.length) {
  console.error('data/index.json 里没有期次，可能已经迁移过了');
  process.exit(1);
}

const outDir = join(DATA, 'seasons', slug);
mkdirSync(outDir, { recursive: true });

const moved = [];
for (const meta of metaList) {
  const src = join(DATA, `${meta.id}.json`);
  if (!existsSync(src)) {
    console.log(`⚠ 缺少 ${meta.id}.json，跳过`);
    continue;
  }
  copyFileSync(src, join(outDir, `${meta.id}.json`));
  moved.push(meta);
}

const seasonLabel = `${slug.slice(0, 4)}/${slug.slice(5)}`;
const seasonIndex = {
  version: 1,
  season: seasonLabel,
  slug,
  kind: 'main',
  source: 'hand-written',
  generated_at: new Date().toISOString().slice(0, 19) + '+08:00',
  count: moved.length,
  matchCount: moved.length,
  newsCount: 0,
  record: null,
  first: moved.map((m) => m.date).sort()[0] ?? '',
  last: moved.map((m) => m.date).sort().at(-1) ?? '',
  dates: [...new Set(moved.map((m) => m.date))].sort().reverse(),
  issues: moved.map((m) => ({ ...m, season: seasonLabel, archive: false })),
};

writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(seasonIndex, null, 2)}\n`, 'utf8');

// 总目里登记这一季
const seasonsFile = join(DATA, 'seasons.json');
const catalog = existsSync(seasonsFile) ? read(seasonsFile) : { version: 1, seasons: [] };
const map = new Map((catalog.seasons ?? []).map((s) => [s.slug, s]));
map.set(slug, {
  season: seasonLabel,
  slug,
  dir: `seasons/${slug}`,
  kind: 'main',
  count: seasonIndex.count,
  record: seasonIndex.record,
  first: seasonIndex.first,
  last: seasonIndex.last,
});
writeFileSync(
  seasonsFile,
  `${JSON.stringify({ ...catalog, generated_at: new Date().toISOString().slice(0, 19) + '+08:00', seasons: [...map.values()].sort((a, b) => a.slug.localeCompare(b.slug)) }, null, 2)}\n`,
  'utf8',
);

// 主线目录只留元信息
writeFileSync(
  join(DATA, 'index.json'),
  `${JSON.stringify({ ...index, dates: [], issues: [], as_of: moved.map((m) => m.date).sort().at(-1) ?? index.as_of }, null, 2)}\n`,
  'utf8',
);

// 根目录的旧期次文件删掉（已复制进赛季文件夹）
for (const m of moved) {
  const p = join(DATA, `${m.id}.json`);
  if (existsSync(p)) rmSync(p);
}

console.log(`迁移 ${moved.length} 期 → data/seasons/${slug}/`);
console.log(`期号 ${moved[0]?.issue_number} → ${moved.at(-1)?.issue_number}`);
