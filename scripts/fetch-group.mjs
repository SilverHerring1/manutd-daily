// 抽曼联所在那一个欧战小组的积分表 → data/seasons/<season>/group.json
// 用法：node scripts/fetch-group.mjs 2018-19 champions
//       node scripts/fetch-group.mjs 2018-19 europa
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const [season, comp = 'champions'] = process.argv.slice(2);
if (!/^\d{4}-\d{2}$/.test(season ?? '')) {
  console.error('用法: node scripts/fetch-group.mjs 2018-19 champions|europa');
  process.exit(1);
}

const slug = comp === 'europa' ? 'uefa.europa' : 'uefa.champions';
const compName = comp === 'europa' ? '欧联' : '欧冠';
const year = season.slice(0, 4);
const UNITED = 'Manchester United';

const url = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${year}`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`ESPN 返回 ${res.status}`);
const data = await res.json();

const STAT = (entry, name) => entry.stats.find((s) => s.name === name)?.value ?? 0;

let found = null;
for (const group of data.children ?? []) {
  const entries = group.standings?.entries ?? [];
  if (!entries.some((e) => e.team?.displayName === UNITED)) continue;
  found = {
    competition: compName,
    name: String(group.name ?? group.abbreviation ?? '').trim(),
    rows: entries
      .map((e) => ({
        rank: STAT(e, 'rank'),
        team: e.team?.displayName ?? '',
        played: STAT(e, 'gamesPlayed'),
        win: STAT(e, 'wins'),
        draw: STAT(e, 'ties'),
        loss: STAT(e, 'losses'),
        gf: STAT(e, 'pointsFor'),
        ga: STAT(e, 'pointsAgainst'),
        pts: STAT(e, 'points'),
        united: e.team?.displayName === UNITED,
      }))
      .sort((a, b) => a.rank - b.rank),
  };
}

if (!found) {
  console.error(`⚠ 没在 ${compName} ${year} 里找到曼联所在的组`);
  process.exit(1);
}

const outDir = join(ROOT, 'data/groups');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${season}.json`), `${JSON.stringify(found, null, 2)}\n`, 'utf8');

console.log(`${compName} ${found.name}：${found.rows.length} 行`);
for (const r of found.rows) {
  console.log(`  ${r.rank} ${r.team.padEnd(24)} ${r.played} 场 ${r.win}-${r.draw}-${r.loss} ${r.gf}/${r.ga} ${r.pts} 分${r.united ? '  ← 曼联' : ''}`);
}
