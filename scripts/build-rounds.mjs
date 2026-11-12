// 从 ESPN summary 的 header.season.name 里取每场的轮次 → data/rounds/<season>.json
// 用法：node scripts/build-rounds.mjs 2018-19 [更多赛季...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'Mozilla/5.0' };
const EN = {
  '1st Round': '第 1 轮', '2nd Round': '第 2 轮', '3rd Round': '第 3 轮', '4th Round': '第 4 轮',
  '5th Round': '第 5 轮', '6th Round': '第 6 轮',
  'First Round': '第 1 轮', 'Second Round': '第 2 轮', 'Third Round': '第 3 轮',
  'Fourth Round': '第 4 轮', 'Fifth Round': '第 5 轮', 'Sixth Round': '第 6 轮',
  'Quarter-finals': '8 强', 'Quarterfinals': '8 强', 'Semi-finals': '半决赛', 'Semifinals': '半决赛',
  'Final': '决赛',
  'Round of 16': '16 强', 'Round of 32': '32 强', 'Round of 64': '64 强',
  'Group Stage': '小组赛', 'League Phase': '联赛阶段', 'League stage': '联赛阶段',
  'Play-offs': '附加赛', 'Playoffs': '附加赛', 'Knockout Round Playoffs': '附加赛', 'Qualifying': '资格赛',
};

const seasons = process.argv.slice(2).filter((s) => /^\d{4}-\d{2}$/.test(s));
if (!seasons.length) {
  console.error('用法: node scripts/build-rounds.mjs 2018-19 2019-20 …');
  process.exit(1);
}
mkdirSync('data/rounds', { recursive: true });

for (const season of seasons) {
  const arch = JSON.parse(readFileSync(`data/archive/${season}.json`, 'utf8'));
  const outFile = `data/rounds/${season}.json`;
  // 已有结果直接复用，重跑只补缺的
  const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
  let ok = 0;
  const unknown = new Set();

  for (const m of arch.matches) {
    if (m.competition === '英超' || out[m.id]) continue;
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${m.league}/summary?event=${m.id}`,
        { headers: UA },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const full = json.header?.season?.name ?? '';
      const tail = full.split(',').pop()?.trim() ?? '';
      const label = EN[tail] ?? null;
      if (!label) {
        if (tail) unknown.add(tail);
        continue;
      }
      out[m.id] = { round: label, full };
      ok += 1;
    } catch {
      /* 拿不到就跳过，生成器会退回「第 N 轮」 */
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  writeFileSync(`data/rounds/${season}.json`, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`${season}: ${ok} 场拿到轮次${unknown.size ? `，未识别：${[...unknown].slice(0, 4).join(' / ')}` : ''}`);
}
