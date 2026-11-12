// 用门线解说把归档期次的战报写成「过程」，只改 body_html 和进球清单，其他不动
// 用法：node scripts/enrich-archive.mjs 2018-19 [--dry]
import { readFileSync, writeFileSync } from 'node:fs';

const season = process.argv[2];
const dry = process.argv.includes('--dry');
if (!/^\d{4}-\d{2}$/.test(season ?? '')) {
  console.error('用法: node scripts/enrich-archive.mjs 2018-19 [--dry]');
  process.exit(1);
}

const PLAYERS = JSON.parse(readFileSync('data/players-cn.json', 'utf8'));
const TEAMS = JSON.parse(readFileSync('scripts/teams-cn.json', 'utf8'));
const cn = (name) => PLAYERS[name] ?? name;
const teamCn = (name) =>
  TEAMS.team[name]?.cn ?? (name === 'Manchester United' ? '曼联' : name);
const venueCn = (name) => TEAMS.venue?.[name] ?? name;

const arch = JSON.parse(readFileSync(`data/archive/${season}.json`, 'utf8'));
const commentary = JSON.parse(readFileSync(`data/commentary/${season}.json`, 'utf8'));
const dir = `data/seasons/${season}`;
const idx = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));

const mins = (t) => String(t).replace("'", '').replace("90'+", '90+');

/** 从解说里找这条进球的助攻/方式（找不到就只写球员） */
function detailsFor(lines, player, minute) {
  const hit = lines.find((l) => {
    const sameMinute = mins(l.t) === mins(minute);
    return sameMinute && l.text.includes(player) && /Goal|Penalty/.test(l.text + l.type);
  });
  if (!hit) return {};
  const text = hit.text;
  const assist = text.match(/Assisted by ([A-ZÀ-Ý][\w'’\- .]+?)(?: with| following|\.|,|$)/)?.[1]?.trim();
  const how = [
    ['following a corner', '角球后'],
    ['following a cross', '传中后'],
    ['following a fast break', '快攻中'],
    ['with a cross', '传中'],
    ['with a through ball', '直塞'],
    ['own goal', '乌龙'],
  ].find(([k]) => text.toLowerCase().includes(k))?.[1];
  const foot = text.includes('header') ? '头球' : text.includes('left foot') ? '左脚' : text.includes('right foot') ? '右脚' : '';
  return { assist, how, foot };
}

/** 一个进球写成一句人话 */
function goalSentence(g, match, lines, prevScore) {
  const who = cn(g.name);
  const team = g.united ? '曼联' : teamCn(match.opponent);
  const d = detailsFor(lines, g.name, g.minute);
  const type = g.type || (d.foot && g.united ? d.foot : '');
  const tag = g.type ? `（${g.type}${d.foot && g.type !== d.foot ? `，${d.foot}` : ''}）` : d.foot ? `（${d.foot}）` : '';
  const assist = d.assist && g.united ? `，${cn(d.assist)}助攻` : '';
  const how = d.how && !g.type ? `，${d.how}` : '';
  return `${g.minute} ${who}${tag}${assist}${how}`;
}

let touched = 0;
for (const meta of idx.issues) {
  if (meta.kind === 'news') continue;
  const match = arch.matches.find((m) => m.date === meta.date);
  if (!match) continue;
  const data = commentary[match.id];
  const issueFile = `${dir}/${meta.id}.json`;
  const issue = JSON.parse(readFileSync(issueFile, 'utf8'));
  const item = issue.sections?.[0]?.items?.[0];
  if (!item) continue;
  if (!match.goals?.length) continue;

  const lines = data?.lines ?? [];
  const home = match.home;
  const venue = venueCn(match.venue ?? '');
  const opp = teamCn(match.opponent);

  // 段落 1：赛事、场地、比分
  const p1 = `<p>${season.replace('-', '/')} ${match.competition}，${home ? '主场' : '客场'}${venue ? `（${venue}）` : ''}对${opp}，${match.scoreFor}-${match.scoreAgainst}。</p>`;

  // 段落 2：进球按时间排成两三句
  const seq = [...match.goals]
    .filter((g) => !g.shootout)
    .sort((a, b) => parseInt(mins(a.minute), 10) - parseInt(mins(b.minute), 10));
  const sentences = seq.map((g) => goalSentence(g, match, lines, 0));
  const p2 = sentences.length ? `<p>${sentences.join('；')}。</p>` : '';

  // 段落 3：红牌与其他判罚
  const reds = lines
    .filter((l) => /Red Card/.test(l.type))
    .map((l) => {
      const who = l.text.match(/([A-ZÀ-Ý][\w'’\- .]+?)\s+\((.+?)\)\s+is shown the red card/);
      return who ? `${l.t} ${cn(who[1])}（${teamCn(who[2])}）` : null;
    })
    .filter(Boolean);
  const pens = lines.filter((l) => /VAR - Penalty|Penalty Not Awarded/i.test(l.type));
  const p3 = reds.length ? `<p>红牌：${reds.join('、')}。</p>` : pens.length ? '<p>下半场有一次 VAR 介入的点球判罚被改判。</p>' : '';

  // 段落 4：进球清单（保留，方便核对）
  const list = `<p>进球：${seq
    .map((g) => `${g.minute} ${cn(g.name)}（${g.united ? '曼联' : opp}${g.type ? `，${g.type}` : ''}）`)
    .join('、')}。</p>`;

  const body = [p1, p2, p3, list].filter(Boolean).join('');
  if (body === item.body_html) continue;

  item.body_html = body;
  touched += 1;
  if (!dry) writeFileSync(issueFile, `${JSON.stringify(issue, null, 2)}\n`, 'utf8');
}

console.log(`${season}: ${touched} 期的正文改成「过程」写法${dry ? '（试运行，未写盘）' : ''}`);
