// 按规则生成每季焦点战 → data/focus.json
// 规则：BIG6 内战 / 三球以上分差 / 欧战碰强队 / 杯赛爆冷或点球出局 / 破纪录（赛季最大比分）
// 用法：node scripts/build-focus.mjs [--dry]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dry = process.argv.includes('--dry');
const BIG6 = ['Manchester City', 'Liverpool', 'Arsenal', 'Chelsea', 'Tottenham Hotspur'];
const BIG_EURO = [
  'Bayern Munich', 'Real Madrid', 'Barcelona', 'Juventus', 'Paris Saint-Germain', 'AC Milan',
  'Sevilla', 'AS Roma', 'Atlético Madrid', 'Borussia Dortmund', 'RB Leipzig', 'Ajax', 'FC Porto',
  'Benfica', 'Inter', 'Napoli', 'Lyon', 'Villarreal', 'Real Sociedad', 'Athletic Club',
];

const NAMES = JSON.parse(readFileSync('scripts/teams-cn.json', 'utf8'));
const cn = (n) => NAMES.team[n]?.cn ?? n;

const out = {};
for (const f of readdirSync('data/archive').filter((x) => x.endsWith('.json')).sort()) {
  const arch = JSON.parse(readFileSync(`data/archive/${f}`, 'utf8'));
  const slug = f.replace('.json', '');
  const matches = [...arch.matches].sort((a, b) => a.date.localeCompare(b.date));

  const maxWin = Math.max(...matches.map((m) => m.scoreFor - m.scoreAgainst));
  const maxLoss = Math.max(...matches.map((m) => m.scoreAgainst - m.scoreFor));
  const mostGoals = Math.max(...matches.map((m) => m.scoreFor + m.scoreAgainst));

  const rows = [];
  for (const m of matches) {
    const diff = m.scoreFor - m.scoreAgainst;
    const tags = [];

    if (BIG6.includes(m.opponent)) tags.push('BIG6 内战');
    if (Math.abs(diff) >= 3) tags.push(diff > 0 ? `${diff} 球大胜` : `${-diff} 球惨败`);
    if (m.competition !== '英超' && BIG_EURO.includes(m.opponent)) tags.push(`${m.competition} 强强对话`);
    if (['联赛杯', '足总杯'].includes(m.competition) && m.result !== 'W') tags.push('杯赛出局');
    if (m.scoreFor + m.scoreAgainst === mostGoals && mostGoals >= 6) tags.push(`${mostGoals} 球大战`);
    if (diff === maxWin && diff >= 3) tags.push('赛季最大胜');
    if (-diff === maxLoss && -diff >= 3) tags.push('赛季最大负');

    if (!tags.length) continue;
    rows.push({
      date: m.date,
      label: `${cn(m.opponent)} ${m.scoreFor}-${m.scoreAgainst}`,
      why: [...new Set(tags)].join('、'),
    });
  }

  out[slug] = rows;
}

if (!dry) {
  const file = 'data/focus.json';
  // 编辑备注（「索尔斯克亚执教首战」这种语境）放 data/focus-notes.json，按 赛季|日期 存
  const notesFile = 'data/focus-notes.json';
  const notes = existsSync(notesFile) ? JSON.parse(readFileSync(notesFile, 'utf8')) : {};
  for (const [slug, rows] of Object.entries(out)) {
    out[slug] = rows
      .map((r) => {
        const note = notes[`${slug}|${r.date}`];
        return note ? { ...r, why: `${note}；${r.why}` } : r;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  writeFileSync(file, `${JSON.stringify({ ...prev, ...out }, null, 2)}\n`, 'utf8');
}

for (const [slug, rows] of Object.entries(out)) console.log(`${slug}  ${String(rows.length).padStart(2)} 场`);
console.log(dry ? '（--dry：没有写文件）' : '已写入 data/focus.json');
