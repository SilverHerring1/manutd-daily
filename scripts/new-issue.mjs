// 新建一期：node scripts/new-issue.mjs 2026-11-11 morning
// 会写进 data/seasons/<赛季>/<id>.json，并更新该季 index.json、data/seasons.json、data/index.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = join(ROOT, 'data');
const read = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

const [date, period = 'morning'] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !['morning', 'evening'].includes(period)) {
  console.error('用法: node scripts/new-issue.mjs 2026-11-11 morning|evening');
  process.exit(1);
}

/** 赛季归属：8 月起算新赛季（2026-08 → 2026/27） */
function seasonSlugOf(d) {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  const start = m >= 8 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

const slug = seasonSlugOf(date);
const seasonLabel = `${slug.slice(0, 4)}/${slug.slice(5)}`;
const seasonDir = join(DATA, 'seasons', slug);
mkdirSync(seasonDir, { recursive: true });

const id = `${date}-${period}`;
const file = join(seasonDir, `${id}.json`);
if (existsSync(file)) {
  console.error(`已经存在：seasons/${slug}/${id}.json`);
  process.exit(1);
}

const indexFile = join(seasonDir, 'index.json');
const seasonIndex = existsSync(indexFile)
  ? read(indexFile)
  : {
      version: 1,
      season: seasonLabel,
      slug,
      kind: 'main',
      source: 'hand-written',
      count: 0,
      matchCount: 0,
      newsCount: 0,
      record: null,
      first: '',
      last: '',
      dates: [],
      issues: [],
    };

const issueNumber = Math.max(0, ...seasonIndex.issues.map((i) => i.issue_number ?? 0)) + 1;

const issue = {
  id,
  date,
  period,
  issue_number: issueNumber,
  title: period === 'evening' ? '曼联晚报' : '曼联早报',
  item_count: 1,
  section_count: 1,
  hero: { src: './media/cover.svg', alt: '', width: 1200, height: 900 },
  sections: [
    {
      id: 'news',
      title: period === 'evening' ? '场外要闻' : '昨夜战报',
      items: [
        {
          id: 'news-01',
          title: '标题写在这里',
          summary: '一两句摘要。',
          body_html: '<p>正文写在 body_html 里。</p>',
          sources: [{ text: '来源', url: 'https://www.manutd.com/' }],
          source_name: '来源标签',
          published_at: '',
        },
      ],
    },
  ],
};

writeFileSync(file, `${JSON.stringify(issue, null, 2)}\n`, 'utf8');

// 该季目录
const meta = {
  id,
  date,
  period,
  issue_number: issueNumber,
  title: issue.title,
  item_count: 1,
  section_count: 1,
  season: seasonLabel,
  archive: false,
  hero: issue.hero,
};
seasonIndex.issues = [...seasonIndex.issues, meta].sort(
  (a, b) => a.date.localeCompare(b.date) || (a.period === 'morning' ? 0 : 1) - (b.period === 'morning' ? 0 : 1),
);
seasonIndex.dates = [...new Set(seasonIndex.issues.map((i) => i.date))].sort().reverse();
seasonIndex.count = seasonIndex.issues.length;
seasonIndex.first = seasonIndex.issues[0]?.date ?? '';
seasonIndex.last = seasonIndex.issues.at(-1)?.date ?? '';
writeFileSync(indexFile, `${JSON.stringify(seasonIndex, null, 2)}\n`, 'utf8');

// 赛季总目
const seasonsFile = join(DATA, 'seasons.json');
const catalog = existsSync(seasonsFile) ? read(seasonsFile) : { version: 1, seasons: [] };
const map = new Map((catalog.seasons ?? []).map((s) => [s.slug, s]));
const prev = map.get(slug) ?? { season: seasonLabel, slug, dir: `seasons/${slug}`, kind: 'main' };
map.set(slug, {
  ...prev,
  count: seasonIndex.count,
  first: seasonIndex.first,
  last: seasonIndex.last,
  record: prev.record ?? null,
});
writeFileSync(
  seasonsFile,
  `${JSON.stringify({ ...catalog, seasons: [...map.values()].sort((a, b) => a.slug.localeCompare(b.slug)) }, null, 2)}\n`,
  'utf8',
);

// 主线目录只更新 as_of
const mainIndex = read(join(DATA, 'index.json'));
writeFileSync(
  join(DATA, 'index.json'),
  `${JSON.stringify({ ...mainIndex, as_of: seasonIndex.last }, null, 2)}\n`,
  'utf8',
);

console.log(`新建 seasons/${slug}/${id}.json（第 ${issueNumber} 期），已登记到该季 index.json 与 seasons.json`);
