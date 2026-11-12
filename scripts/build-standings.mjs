// 抓每季英超全部比赛（football-data.co.uk 的 CSV），供页面按日期算「当时积分榜」
// 用法：node scripts/build-standings.mjs [--all]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'data/standings');
mkdirSync(OUT, { recursive: true });

// CSV 里的缩写队名 → 我们自己的中文名 / 队徽
const ALIAS = {
  'Man United': 'Manchester United', 'Man City': 'Manchester City', 'Newcastle': 'Newcastle United',
  'Tottenham': 'Tottenham Hotspur', 'Brighton': 'Brighton & Hove Albion', 'Wolves': 'Wolverhampton Wanderers',
  'West Ham': 'West Ham United', "Nott'm Forest": 'Nottingham Forest', 'Leicester': 'Leicester City',
  'Leeds': 'Leeds United', 'Ipswich': 'Ipswich Town', 'Bournemouth': 'AFC Bournemouth',
  'Cardiff': 'Cardiff City', 'Huddersfield': 'Huddersfield Town', 'Norwich': 'Norwich City',
  'Luton': 'Luton Town', 'West Brom': 'West Bromwich Albion', 'Sheffield United': 'Sheffield United',
  'Aston Villa': 'Aston Villa', 'Crystal Palace': 'Crystal Palace', 'Everton': 'Everton',
  'Fulham': 'Fulham', 'Burnley': 'Burnley', 'Southampton': 'Southampton', 'Watford': 'Watford',
  'Sunderland': 'Sunderland', 'Arsenal': 'Arsenal', 'Chelsea': 'Chelsea', 'Liverpool': 'Liverpool',
  'Coventry': 'Coventry City', 'Hull': 'Hull City', 'Sheffield Utd': 'Sheffield United', 'Nottm Forest': 'Nottingham Forest',
};

const TEAMS = JSON.parse(readFileSync(join(ROOT, 'scripts/teams-cn.json'), 'utf8')).team;
const SELF = JSON.parse(readFileSync(join(ROOT, 'data/team-map.json'), 'utf8'))['Manchester United'];
/** CSV 队名 → { cn, badge } */
function team(short) {
  const full = ALIAS[short] ?? short;
  const meta = TEAMS[full] ?? (full === 'Manchester United' ? SELF : null);
  return { en: full, cn: meta?.cn ?? short, badge: meta?.badge ?? null, short };
}

const seasons = process.argv.includes('--all')
  ? ['2018-19', '2019-20', '2020-21', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26']
  : process.argv.slice(2).filter((s) => /^\d{4}-\d{2}$/.test(s));

if (!seasons.length) {
  console.error('用法: node scripts/build-standings.mjs 2018-19 [--all]');
  process.exit(1);
}

/** CSV 行 → { date, home, away, hg, ag }，按表头找列，别依赖固定下标 */
function parseCsv(text) {
  const lines = text.trim().split('\n').map((l) => l.replace(/\r$/, ''));
  const head = lines[0].split(',');
  const idx = (name) => head.indexOf(name);
  const iDate = idx('Date'), iHome = idx('HomeTeam'), iAway = idx('AwayTeam'), iHG = idx('FTHG'), iAG = idx('FTAG');
  const out = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    if (c.length < Math.max(iDate, iHome, iAway, iHG, iAG) + 1) continue;
    const [d, m, y] = c[iDate].split('/');
    if (!y) continue;
    const year = y.length === 4 ? y : `20${y}`;
    const date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    out.push({ date, home: c[iHome], away: c[iAway], hg: Number(c[iHG]), ag: Number(c[iAG]) });
  }
  return out;
}

for (const slug of seasons) {
  const code = `${slug.slice(0, 4).slice(2)}${slug.slice(5)}`;   // 2018-19 → 1819
  const url = `https://www.football-data.co.uk/mmz4281/${code}/E0.csv`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const matches = parseCsv(await res.text());
    const teams = new Map();
    for (const m of matches) {
      teams.set(m.home, team(m.home));
      teams.set(m.away, team(m.away));
    }
    const payload = {
      season: slug,
      source: 'football-data.co.uk',
      count: matches.length,
      teams: Object.fromEntries([...teams].map(([k, v]) => [k, v])),
      matches: matches.sort((a, b) => a.date.localeCompare(b.date)),
    };
    writeFileSync(join(OUT, `${slug}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    const missing = [...teams.values()].filter((t) => !t.badge).map((t) => t.short);
    console.log(`${slug}: ${matches.length} 场，${teams.size} 队${missing.length ? `（缺队徽/中文名：${missing.join('、')}）` : ''}`);
  } catch (error) {
    console.log(`${slug}: ⚠ ${error.message}`);
  }
}
