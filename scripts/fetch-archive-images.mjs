// 给 archive 里每一场抓一张「头图」（ESPN 图集里的 header 图）
// 用法：node scripts/fetch-archive-images.mjs 2018-19 [--dry]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const [season, ...rest] = process.argv.slice(2);
const dry = rest.includes('--dry');
if (!/^\d{4}-\d{2}$/.test(season ?? '')) {
  console.error('用法: node scripts/fetch-archive-images.mjs 2018-19 [--dry]');
  process.exit(1);
}

const UA = { 'User-Agent': 'Mozilla/5.0' };
const archive = JSON.parse(readFileSync(join(ROOT, `data/archive/${season}.json`), 'utf8'));
const outDir = join(ROOT, 'media/archive', season);
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 这场比赛的图在 article.images 里；news.articles[*] 是网站推荐位，别碰 */
function pickHeader(json) {
  const list = json?.article?.images ?? [];
  const usable = list
    .filter((i) => typeof i.url === 'string' && /a\.espncdn\.com\/photo\//.test(i.url) && i.width >= 1200 && i.height > 0)
    .sort((a, b) => Math.abs(a.width / a.height - 16 / 9) - Math.abs(b.width / b.height - 16 / 9));
  const hit = usable[0] ?? list.find((i) => i.url);
  return hit ? { url: hit.url, name: hit.name ?? '', credit: hit.credit ?? '', width: hit.width ?? 0, height: hit.height ?? 0 } : null;
}

const result = {};
let ok = 0;
const missing = [];

for (const m of archive.matches) {
  const id = `${m.date}-${m.opponent.replace(/[^A-Za-z0-9]/g, '')}`;
  try {
    const api = `https://site.api.espn.com/apis/site/v2/sports/soccer/${m.league}/summary?event=${m.id}`;
    const res = await fetch(api, { headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const header = pickHeader(json);
    if (!header) throw new Error('没有 header 图');

    const file = `archive-${id}.jpg`;
    if (!dry) {
      // 走 combiner 降到 960 宽：原图 1296×729 一张近 200 KB，53 张会把仓库撑大
      const path = header.url.replace(/^https:\/\/a\.espncdn\.com/, '');
      const sized = `https://a.espncdn.com/combiner/i?img=${path}&w=960&h=540&cquality=85`;
      const img = await fetch(sized, { headers: UA });
      if (!img.ok) throw new Error(`图 HTTP ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      writeFileSync(join(outDir, file), buf);
      result[id] = {
        src: `./media/archive/${season}/${file}`,
        width: 960,
        height: 540,
        credit: header.credit,
        name: header.name,
      };
    }
    ok += 1;
  } catch (error) {
    missing.push(`${m.date} ${m.opponent}（${error.message}）`);
  }
  await sleep(150);
}

if (!dry) {
  writeFileSync(join(ROOT, `data/images-${season}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

console.log(`${season}：拿到头图 ${ok}/${archive.matches.length}`);
if (missing.length) {
  console.log('\n没拿到的：');
  for (const x of missing) console.log(`  - ${x}`);
}
console.log(dry ? '（--dry：没有下载）' : `图存 media/archive/，索引 data/images-${season}.json`);
