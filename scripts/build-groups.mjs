// 给每一季抓曼联所在的欧战小组表 → data/groups/<season>.json
// 用法：node scripts/build-groups.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'Mozilla/5.0' };
const UNITED = 'Manchester United';
const STAT = (e, n) => e.stats.find((s) => s.name === n)?.value ?? 0;
const dir = 'data/groups';
mkdirSync(dir, { recursive: true });

for (const f of readdirSync('data/archive').filter((x) => x.endsWith('.json')).sort()) {
  const slug = f.replace('.json', '');
  const arch = JSON.parse(readFileSync(`data/archive/${f}`, 'utf8'));
  const euro = [...new Set(arch.matches.map((m) => m.competition))].filter((c) => c === '欧冠' || c === '欧联');
  if (!euro.length) {
    console.log(`${slug}: 这一季没有欧战`);
    continue;
  }

  const comp = euro.includes('欧冠') ? '欧冠' : '欧联';
  const league = comp === '欧冠' ? 'uefa.champions' : 'uefa.europa';
  const year = slug.slice(0, 4);

  try {
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings?season=${year}`, { headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let found = null;
    for (const group of data.children ?? []) {
      const entries = group.standings?.entries ?? [];
      if (!entries.some((e) => e.team?.displayName === UNITED)) continue;
      found = {
        competition: comp,
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
    if (!found) throw new Error('没找到曼联所在的组');
    writeFileSync(`${dir}/${slug}.json`, `${JSON.stringify(found, null, 2)}\n`, 'utf8');
    console.log(`${slug}  ${comp} ${found.name.padEnd(8)}  曼联 ${found.rows.find((r) => r.united)?.pts ?? '?'} 分`);
  } catch (error) {
    console.log(`${slug}  ⚠ ${error.message}`);
  }
}
