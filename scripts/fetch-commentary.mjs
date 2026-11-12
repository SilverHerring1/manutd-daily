// 抓一季所有比赛的门线解说（缓存到 data/commentary/<season>.json），后面写过程用
// 用法：node scripts/fetch-commentary.mjs 2018-19
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const season = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(season ?? '')) {
  console.error('用法: node scripts/fetch-commentary.mjs 2018-19');
  process.exit(1);
}

const H = { 'User-Agent': 'Mozilla/5.0' };
const arch = JSON.parse(readFileSync(`data/archive/${season}.json`, 'utf8'));
mkdirSync('data/commentary', { recursive: true });
const outFile = `data/commentary/${season}.json`;
const cache = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};

let added = 0;
for (const m of arch.matches) {
  if (cache[m.id]) continue;
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${m.league}/summary?event=${m.id}`,
      { headers: H },
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const lines = (j.commentary ?? []).map((c) => ({
      t: c.time?.displayValue ?? '',
      type: c.play?.type?.text ?? '',
      text: c.text ?? '',
    }));
    const events = (j.keyEvents ?? []).map((e) => ({
      t: e.clock?.displayValue ?? '',
      type: e.type?.text ?? '',
      text: e.text ?? '',
    }));
    const teams = (j.boxscore?.teams ?? []).map((t) => ({
      name: t.team?.displayName,
      stats: Object.fromEntries((t.statistics ?? []).map((s) => [s.name, s.displayValue])),
    }));
    cache[m.id] = { date: m.date, opponent: m.opponent, lines, events, teams };
    added += 1;
    if (added % 10 === 0) console.log(`  …${added} 场`);
  } catch (error) {
    console.log(`  ⚠ ${m.date} ${m.opponent}: ${error.message}`);
  }
  await new Promise((r) => setTimeout(r, 120));
}

writeFileSync(outFile, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
console.log(`${season}: 解说缓存 ${Object.keys(cache).length} 场（新增 ${added}）→ ${outFile}`);
