// 把 data/archive/<season>.json 的每一场变成一期日报，写到 data/seasons/<season>/。
// 用法：node scripts/gen-archive-issues.mjs 2018-19
//       node scripts/gen-archive-issues.mjs --all
//       node scripts/gen-archive-issues.mjs 2018-19 --dry   只看汇总，不写文件
//
// 口径（见 docs/CONVENTIONS.md）：
//   一场一期，归属「踢完之后那一天」的早报：北京时间 12 点前开球算当天，之后算次日。
//   只写当天已经知道的事 —— 累计战绩、连胜连败、赛季最大分差都只算到这一场为止。
//   不写引语、不配图：archive 里没有原话，也没有和新闻同源的图。
//
// 产物：
//   data/seasons/<slug>/<date>-morning.json   一期一期，格式与 data/*.json 一致
//   data/seasons/<slug>/index.json            这一季的期次目录
//   data/seasons.json                         所有已生成赛季的总目（app.js 读这个）
//   archive/index.html, archive/<slug>.html   赛季归档页
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = join(ROOT, 'data');
const ARCHIVE = join(DATA, 'archive');
const OUT = join(DATA, 'seasons');
const NAMES = JSON.parse(readFileSync(join(ROOT, 'scripts/teams-cn.json'), 'utf8'));

const args = process.argv.slice(2);
const dry = args.includes('--dry');
// --pages：只重建 archive/*.html，不碰期次 JSON（手写内容不能被覆盖）
const PAGES_ONLY = args.includes('--pages');
const all = args.includes('--all');
const targets = all
  ? readdirSync(ARCHIVE)
      .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, -5))
      .sort()
  : args.filter((a) => /^\d{4}-\d{2}$/.test(a));

if (!targets.length) {
  console.error('用法: node scripts/gen-archive-issues.mjs 2018-19 [--all] [--dry]');
  process.exit(1);
}

/* ---------------- 小工具 ---------------- */

// 属性/整页用：引号也要转
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 正文用：只挡标签，别把「23'」写成「23&#39;」
const textEsc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const resultCn = (r) => ({ W: '胜', D: '平', L: '负' }[r] ?? '平');

const addDay = (date, n) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** "90'+2'" → { value: 90.02, label: "90+2'" }，只用来排序和显示 */
function minute(raw) {
  const hit = String(raw ?? '').match(/(\d+)\s*'?\s*(?:\+\s*(\d+))?/);
  if (!hit) return { value: 999, label: String(raw ?? '') };
  const base = Number(hit[1]);
  const extra = Number(hit[2] ?? 0);
  return { value: base + extra / 100, label: extra ? `${base}+${extra}'` : `${base}'` };
}

/** 对手资料：中文名、队徽文件名、FM 编号。曼联自己在 team-map.json 里，单独补一条 */
const SELF = JSON.parse(readFileSync(join(ROOT, 'data/team-map.json'), 'utf8'))['Manchester United'] ?? null;
const teamMeta = (name) =>
  NAMES.team[name] ?? (name === 'Manchester United' ? SELF : null);
const venueCn = (name) => NAMES.venue[name] ?? name ?? '';
/** 队徽只在该文件真的存在时才挂，免得页面上是个裂图 */
const badgeOf = (meta) => {
  if (!meta?.badge) return null;
  const file = join(ROOT, 'media/badges', `${meta.badge}.png`);
  return existsSync(file) ? `./media/badges/${meta.badge}.png` : null;
};

/* ---------------- 从比分里能读出来的东西 ---------------- */

const scoreline = (m, oppCn) =>
  m.home ? `曼联 ${m.scoreFor}-${m.scoreAgainst} ${oppCn}` : `${oppCn} ${m.scoreAgainst}-${m.scoreFor} 曼联`;

const timeline = (m) =>
  [...(m.goals ?? [])].filter((g) => !g.shootout).sort((a, b) => minute(a.minute).value - minute(b.minute).value);

function goalText(g, oppCn) {
  const type = g.type === '点球' ? '点球' : g.type === '乌龙' ? '乌龙球' : '';
  const who = g.united ? '曼联' : oppCn;
  // 乌龙球算分的那一侧容易看错，写清楚算给谁
  if (type === '乌龙球') return `${minute(g.minute).label} ${g.name}（乌龙球，算给${who}）`;
  return `${minute(g.minute).label} ${g.name}（${type ? `${who}，${type}` : who}）`;
}

/** 标题里那半句：优先用一个具体事实，没有就按比分说 */
function clause(m, goals) {
  const diff = m.scoreFor - m.scoreAgainst;
  const last = goals.at(-1);
  const lastMinute = last ? minute(last.minute).value : 0;
  const lateUnited = last && last.united && lastMinute >= 88;
  const concededFirst = goals.length > 0 && !goals[0].united;

  // 绝杀只在球决定胜负时才叫绝杀，5-1 里补时的第五球不是；乌龙球不能写对方球员名
  const scorer = last && last.type === '乌龙' ? '对手乌龙' : last?.name;
  if (lateUnited && m.result === 'W' && diff <= 1) return `${scorer} ${minute(last.minute).label} 绝杀`;
  if (lateUnited && m.result === 'D') return `${scorer} ${minute(last.minute).label} 扳平`;
  if (concededFirst && m.result === 'W') return diff >= 3 ? '先丢球，大比分翻盘' : '先丢球，翻盘';
  if (concededFirst && m.result === 'D') return '先丢球，追成平局';
  if (m.scoreAgainst === 0 && m.result === 'W') return diff >= 3 ? `零封，净胜 ${diff} 球` : '零封取胜';
  if (diff <= -3) return `净负 ${-diff} 球`;
  if (goals.length === 0) return '互交白卷';
  if (m.result === 'W') return diff === 1 ? '一球小胜' : `净胜 ${diff} 球`;
  if (m.result === 'L') return diff === -1 ? '一球之差' : `${-diff} 球落败`;
  return last.united ? '扳平' : '被扳平';
}

/** 到这一场为止的累计，只用「这一场及以前」 */
function tally(matches, i) {
  const seen = matches.slice(0, i + 1);
  const sum = (list) =>
    list.reduce(
      (a, m) => {
        a[m.result] += 1;
        a.gf += m.scoreFor;
        a.ga += m.scoreAgainst;
        return a;
      },
      { W: 0, D: 0, L: 0, gf: 0, ga: 0 },
    );

  const league = seen.filter((m) => m.competition === '英超');
  const wins = seen.map((m) => m.scoreFor - m.scoreAgainst);
  const losses = seen.map((m) => m.scoreAgainst - m.scoreFor);
  const lastResult = seen.at(-1).result;

  let streak = 0;
  for (let k = seen.length - 1; k >= 0 && seen[k].result === lastResult; k -= 1) streak += 1;

  return {
    no: seen.length,
    all: sum(seen),
    league: { n: league.length, ...sum(league) },
    maxWin: Math.max(...wins),
    maxLoss: Math.max(...losses),
    scoreless: seen.filter((m) => m.scoreFor === 0).length,
    cleanSheets: seen.filter((m) => m.scoreAgainst === 0).length,
    concede2: seen.filter((m) => m.scoreAgainst >= 2).length,
    streak,
    streakResult: lastResult,
  };
}

const CN = ['', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 侧栏一句话判断：用能验证的数字说话，不写「球队需要反思」 */
function judge(m, t) {
  const diff = m.scoreFor - m.scoreAgainst;
  const site = m.home ? '主场' : '客场';
  // 联赛才有「三分」，杯赛只能写赢下这一场
  const points = m.competition === '英超' ? '三分到手' : '赢下这一场';
  // 同一类事实备两条说法，按比赛 id 固定挑一条，重建结果不变
  const pick = (list) => list[Number(String(m.id).slice(-2)) % list.length];
  const streakCn = `${CN[t.streak] ?? t.streak}连${t.streakResult === 'W' ? '胜' : t.streakResult === 'L' ? '败' : '平'}`;

  if (m.result === 'W') {
    if (diff >= 3 && diff === t.maxWin) {
      return pick([
        `${site}赢 ${diff} 球，这一季到目前为止赢得最多的一场。`,
        `${site}净胜 ${diff} 球，是这一季目前最像样的比分。`,
      ]);
    }
    if (diff >= 3) return pick([`${site}赢 ${diff} 球，进攻端这场没浪费机会。`, `${m.scoreFor} 个进球，这一季到目前为止少见的一次。`]);
    if (m.scoreAgainst === 0) {
      return pick([
        `${site}零封，这一季第 ${t.all.W} 胜，防线没给对手留东西。`,
        `${site}零封，这一季第 ${t.cleanSheets} 场不丢球。`,
      ]);
    }
    if (t.streak >= 3) return pick([`${streakCn}，${site}赢得不轻松，但这场拿下了。`, `又赢一场，${streakCn}。`]);
    if (m.scoreAgainst >= 2) return `${points}，可这场丢 ${m.scoreAgainst} 球 —— 这一季第 ${t.concede2} 次单场丢两球以上。`;
    if (t.cleanSheets === 0) return `${points}，这一季还没零封过。`;
    return `${points}，只是没能零封；这一季 ${t.no} 场里只有 ${t.cleanSheets} 场零封。`;
  }

  if (m.result === 'D') {
    if (m.scoreFor === 0) return pick([`0-0，各拿一分，这一季第 ${t.scoreless} 次一球未进。`, `没有进球的平局，这一季第 ${t.scoreless} 次。`]);
    if (m.competition === '联赛杯') return '九十分钟扳平，把比赛拖进了加时。';
    if (m.competition === '足总杯') return '九十分钟没分出胜负，按赛制要重赛。';
    if (timeline(m).some((g) => g.united && minute(g.minute).value >= 85)) {
      return pick(['最后时刻扳平，救回这一分，但过程说明问题一直在。', '补时扳平，一分是抢回来的。']);
    }
    return pick([`追平只换来一分，${site}的进攻够用，防守不够用。`, '比分咬住了，胜负没咬住，还是一分。']);
  }

  if (diff <= -3) {
    return -diff === t.maxLoss
      ? pick([`${site}丢 ${m.scoreAgainst} 球，这一季最难看的比分。`, `${m.scoreAgainst} 个丢球，这一季到目前为止最差的一场。`])
      : `${site}丢 ${m.scoreAgainst} 球，比分已经把问题写清楚了。`;
  }
  if (m.scoreFor === 0) return pick([`一球未进，这一季第 ${t.scoreless} 次被零封。`, `又没能进球，这一季第 ${t.scoreless} 次。`]);
  if (t.streak >= 3) return `${streakCn}，${site}还是没能止住。`;
  return pick([`输了，但进了 ${m.scoreFor} 球，问题不在前场。`, `一球之差，进球拿到了，分数没拿到。`]);
}

/* ---------------- 一场 → 一期 ---------------- */

function buildIssue(m, oppCn) {
  const goals = timeline(m);
  const score = scoreline(m, oppCn);
  const line = clause(m, goals);

  return {
    id: '',
    date: '',
    period: 'morning',
    issue_number: null,
    season: m.season,
    archive: true,
    // 抬头跟日更一致：只写「曼联早报」，比赛本身放条目里
    title: '曼联早报',
    item_count: 1,
    section_count: 1,
    sections: [
      {
        id: 'matches',
        title: '昨夜战报',
        items: [
          {
            id: `m${m.id}`,
            title: `${score}：${line}`,
            summary: '',
            body_html: '',
            sources: [{ text: 'ESPN 比分', url: `https://www.espn.com/soccer/match/_/gameId/${m.id}` }],
            source_name: `${m.competition} · ${m.home ? '主场' : '客场'}`,
            published_at: `${m.date.slice(5)} ${m.time}`,
          },
        ],
      },
    ],
    note: { title: '编辑短评', body: '' },
  };
}

function fillBody(issue, m, t, oppCn) {
  const venue = venueCn(m.venue);
  const goals = timeline(m);
  const goalsDigest = goals.length
    ? `进球：${goals.map((g) => goalText(g, oppCn)).join('、')}。`
    : '双方都没有进球。';
  const item = issue.sections[0].items[0];
  item.summary = `${m.competition}，${m.home ? '主场' : '客场'}${venue ? `（${venue}）` : ''}。这一季各项赛事第 ${t.no} 场，${t.all.W} 胜 ${t.all.D} 平 ${t.all.L} 负。`;

  // 摘要给背景与累计，正文给过程与进球 —— 两边别写同一句话
  const paragraphs = [
    `${m.season} ${m.competition}，${m.home ? '主场' : '客场'}${venue ? `（${venue}）` : ''}对阵${oppCn}，比分 ${m.scoreFor}-${m.scoreAgainst}。`,
    goalsDigest,
  ];
  if (m.competition === '联赛杯' && m.result === 'D') {
    paragraphs.push('杯赛九十分钟打平，进入加时；互射点球的结果没有记录。');
  }
  if (m.competition === '足总杯' && m.result === 'D') {
    paragraphs.push('足总杯九十分钟打平，按赛制需要重赛。');
  }
  item.body_html = paragraphs.map((p) => `<p>${textEsc(p)}</p>`).join('');
  issue.match_no = t.no;
  issue.note.body = judge(m, t);
}

/* ---------------- 归档页 ---------------- */

const page = (title, body) => `<!doctype html>
<html lang="zh-CN" data-theme="morning">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#ffffff" />
<title>${esc(title)} · 曼联日报</title>
<script>
  // 从哪一期点进来就用哪一期的底色：晚报进来是深色，早报进来是浅色
  (function () {
    try {
      var q = new URLSearchParams(location.search).get('theme');
      var saved = sessionStorage.getItem('mud-theme');
      var theme = q || saved || 'morning';
      if (theme !== 'evening') theme = 'morning';
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'evening' ? '#0e0e0d' : '#ffffff');
      sessionStorage.setItem('mud-theme', theme);
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http')) return;
        if (!href.includes('theme=')) {
          a.setAttribute('href', href + (href.includes('?') ? '&' : '?') + 'theme=' + theme);
        }
      });
    } catch (err) {}
  })();
</script>
<link rel="icon" href="../media/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="../design-tokens.css?v=9" />
<link rel="stylesheet" href="../layout.css?v=9" />
</head>
<body class="archive-body">
<div class="shell">
<header class="topbar">
  <a class="brand" href="../" aria-label="回到日报首页">
    <img class="brand-avatar" src="../media/avatar-github.jpg" alt="" width="36" height="36" />
    <span class="brand-text">SilverHerring1<small>Once a red always a red</small></span>
  </a>
  <nav class="variant-nav" aria-label="归档导航">
    <span>归档</span>
    <a href="./">全部赛季</a>
    <a href="../">回日报</a>
  </nav>
</header>
<main class="archive-main">
${body}
</main>
<footer class="site-footer">
  <p class="footer-brand">曼联日报 · 赛季归档</p>
  <p class="footer-note">一场一期，赛后次日早报；比分与进球来自 ESPN 公开赛程，时间统一为北京时间。</p>
</footer>
</div>
</body>
</html>
`;

function renderArchiveIndex(seasons) {
  // 主线赛季（26/27）自己就在首页，不进归档列表
  const listed = seasons.filter((s) => s.kind !== 'main');
  const cards = listed
    .map(
      (s) => `<a class="season-card" href="./${esc(s.slug)}.html">
  <span class="season-name">${esc(s.season)}</span>
  <span class="season-meta">${s.count} 期 · ${s.record ? `${s.record.W} 胜 ${s.record.D} 平 ${s.record.L} 负 · ${s.record.gf}-${s.record.ga}` : '手写'}</span>
  <span class="season-range">${esc(s.first)} → ${esc(s.last)}</span>
</a>`,
    )
    .join('\n');

  return page(
    '赛季归档',
    `<section class="archive-head">
  <p class="kicker">THE ARCHIVE</p>
  <h1>赛季归档</h1>
  <p class="archive-lead">archive 里每一场都写成了一期简报。按赛季进，按月份看。</p>
</section>
<section class="season-list" aria-label="赛季列表">
${cards || '<p class="archive-empty">还没有生成任何赛季。</p>'}
</section>`,
  );
}

function renderSeasonPage(s) {
  // 焦点战：data/focus.json 里这一季标红的几场
  const focusFile = join(DATA, 'focus.json');
  const focus = new Map();
  if (existsSync(focusFile)) {
    for (const item of JSON.parse(readFileSync(focusFile, 'utf8'))[s.slug] ?? []) focus.set(item.date, item);
  }

  const months = new Map();
  for (const issue of s.issues) {
    const key = `${issue.date.slice(0, 4)}-${issue.date.slice(5, 7)}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(issue);
  }

  const blocks = [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const rows = list
        .map((issue) => {
          const day = `<td class="num">${Number(issue.date.slice(5, 7))}/${Number(issue.date.slice(8, 10))}</td>`;
          const period = issue.period === 'evening' ? 'evening' : 'morning';
          // 纯新闻期 / 赛季总结：没有比分和对手，换一套列
          if (issue.kind === 'news' || issue.kind === 'summary') {
            const isSummary = issue.kind === 'summary';
            return `<tr class="is-news${isSummary ? ' is-summary' : ''}">
${day}
<td>${isSummary ? '总结' : '场外'}</td>
<td class="arc-opp">${esc(issue.competition ?? '要闻')}</td>
<td class="arc-result">—</td>
<td><a href="../?date=${esc(issue.date)}&period=${period}">第 ${issue.issue_number} 期 · ${isSummary ? '赛季总结' : '要闻'}</a></td>
</tr>`;
          }
          return `<tr${focus.has(issue.matchDate) ? ' class="is-focus"' : ""}>
${day}
<td>${esc(issue.source_name)}</td>
<td class="arc-opp">${issue.badge ? `<img src="../${issue.badge.replace(/^\.\//, "")}" alt="" width="25" height="18" loading="lazy" />` : ""}${esc(issue.scoreline)}${focus.has(issue.matchDate) ? ' <span class="arc-focus" title="焦点战">★</span>' : ""}</td>
<td class="arc-result is-${esc(issue.result)}">${resultCn(issue.result)}</td>
<td><a href="../?date=${esc(issue.date)}&period=${period}">${issue.issue_number ? `第 ${issue.issue_number} 期 · ` : ""}${esc(issue.clause)}</a></td>
</tr>`;
        })
        .join('\n');
      return `<section class="arc-month">
  <h2>${Number(key.slice(0, 4))} 年 ${Number(key.slice(5, 7))} 月</h2>
  <table class="arc-table">
    <thead><tr><th>日期</th><th>赛事</th><th>比分</th><th>结果</th><th>那一期</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</section>`;
    })
    .join('\n');

  // 欧战小组表：只放曼联那一组
  const groupBlock = !s.group
    ? ""
    : `<section class="group-block" aria-label="${esc(s.group.competition)}小组积分">
<h2 class="cups-title">${esc(s.group.competition)} ${esc(String(s.group.name).replace(/^Group\s*/i, ''))} 组</h2>
<table class="arc-table group-tbl">
  <thead><tr><th>#</th><th>球队</th><th>场</th><th>胜</th><th>平</th><th>负</th><th>进/失</th><th>分</th></tr></thead>
  <tbody>
${s.group.rows
  .map((row) => {
    const meta = teamMeta(row.team);
    const badge = badgeOf(meta);
    return `<tr${row.united ? ' class="is-united"' : ""}>
<td class="num">${row.rank}</td>
<td class="arc-opp">${badge ? `<img src="../${badge.replace(/^\.\//, "")}" alt="" width="25" height="18" loading="lazy" />` : ""}${esc(meta?.cn ?? row.team)}</td>
<td>${row.played}</td><td>${row.win}</td><td>${row.draw}</td><td>${row.loss}</td>
<td class="num">${row.gf}/${row.ga}</td><td class="num group-pts">${row.pts}</td>
</tr>`;
  })
  .join("\n")}
  </tbody>
</table>
</section>`;

  // 英超最终积分榜：从 data/standings/<season>.json 的 380 场算出来（football-data.co.uk）
  const leagueBlock = (() => {
    const file = join(DATA, 'standings', `${s.season.replace('/', '-')}.json`);
    if (!existsSync(file)) return "";
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const acc = new Map();
    for (const m of data.matches ?? []) {
      for (const [name, gf, ga] of [[m.home, m.hg, m.ag], [m.away, m.ag, m.hg]]) {
        const row = acc.get(name) ?? { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
        row.p += 1;
        if (gf > ga) row.w += 1; else if (gf === ga) row.d += 1; else row.l += 1;
        row.gf += gf; row.ga += ga;
        acc.set(name, row);
      }
    }
    const rows = [...acc]
      .map(([name, r]) => ({ name, ...r, pts: r.w * 3 + r.d, gd: r.gf - r.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    if (!rows.length) return "";
    return `<section class="group-block" aria-label="英超最终积分榜">
<h2 class="cups-title">英超最终积分榜</h2>
<table class="arc-table group-tbl">
  <thead><tr><th>#</th><th>球队</th><th>场</th><th>胜</th><th>平</th><th>负</th><th>进/失</th><th>净</th><th>分</th></tr></thead>
  <tbody>
${rows
  .map((row) => {
    const meta = data.teams?.[row.name] ?? teamMeta(row.name);
    const badge = badgeOf(meta);
    const united = /Man(chester)? United/.test(row.name);
    return `<tr${united ? ' class="is-united"' : ""}>
<td class="num">${rows.indexOf(row) + 1}</td>
<td class="arc-opp">${badge ? `<img src="../${badge.replace(/^\.\//, "")}" alt="" width="25" height="18" loading="lazy" />` : ""}${esc(meta?.cn ?? row.name)}</td>
<td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td>
<td class="num">${row.gf}/${row.ga}</td><td class="num">${row.gd > 0 ? `+${row.gd}` : row.gd}</td><td class="num group-pts">${row.pts}</td>
</tr>`;
  })
  .join("\n")}
  </tbody>
</table>
</section>`;
  })();

  const r = s.record ?? { W: 0, D: 0, L: 0, gf: 0, ga: 0 };
  const cups = (s.cups ?? [])
    .map(
      (cup) => `<div class="cup">
  <p class="cup-head"><span class="cup-name">${esc(cup.name)}</span>${cup.outcome ? `<span class="cup-out">${esc(cup.outcome)}</span>` : ""}</p>
  <ol class="cup-path">
    ${cup.rounds
      .map(
        (round) => `<li${round.out ? ' class="is-out"' : ""}>
      <span class="cup-round">${esc(round.name)}</span>
      <span class="cup-detail">${esc(round.detail)}</span>
    </li>`,
      )
      .join("\n    ")}
  </ol>
</div>`,
    )
    .join("\n");

  return page(
    `${s.season} 赛季`,
    `<section class="archive-head">
  <p class="kicker">SEASON ARCHIVE</p>
  <h1>${esc(s.season)} 赛季</h1>
  <p class="archive-lead">${s.matchCount ?? s.count} 场，${r.W} 胜 ${r.D} 平 ${r.L} 负，${r.gf} 进 ${r.ga} 失。点最后一列进当天早报。</p>
</section>
${cups ? `<section class="cups" aria-label="淘汰赛路径">\n<h2 class="cups-title">淘汰赛路径</h2>\n${cups}\n</section>` : ""}
${groupBlock}
${leagueBlock}
${blocks}`,
  );
}

/* ---------------- 淘汰赛路径（只画曼联这一条） ---------------- */

/** 读图片的宽高：赛季总结的配图这样自动拿尺寸，省得手填 */
function imageSize(file) {
  try {
    const buf = readFileSync(file);
    if (buf.slice(0, 4).toString('hex') === '89504e47') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  } catch {
    /* 读不出来就退回默认 */
  }
  return { width: 1200, height: 675 };
}

/** 没有手写 cups 时自动聚轮次：优先用 data/rounds/<season>.json（ESPN 的轮次名） */
function autoCups(matches, roundsByMatch = {}) {
  const byComp = new Map();
  for (const m of matches) {
    if (m.competition === '英超') continue;
    if (!byComp.has(m.competition)) byComp.set(m.competition, []);
    byComp.get(m.competition).push(m);
  }

  const cups = [];
  for (const [comp, list] of byComp) {
    const games = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const rounds = [];

    // 连续「同一轮次 + 同一对手」算一条（两回合）；小组赛/联赛阶段的所有场次并成一条
    let cur = null;
    for (const m of games) {
      const label = roundsByMatch[m.id]?.round ?? null;
      const isGroup = label === '小组赛' || label === '联赛阶段';
      const key = isGroup ? label : `${label ?? ''}|${m.opponent}`;
      if (cur && cur.key === key) {
        cur.dates.push(m.date);
        continue;
      }
      cur = { key, label, dates: [m.date] };
      rounds.push(cur);
    }

    const anyLabel = rounds.some((r) => r.label);
    const named = rounds.map((r, i) => ({
      name: r.label ?? `第 ${i + 1} 轮`,
      dates: r.dates,
      group: r.label === '小组赛' || r.label === '联赛阶段',
    }));

    if (named.length) cups.push({ name: comp, rounds: named, auto: !anyLabel });
  }
  return cups;
}

/** 从 archive 的场次里按轮次聚出曼联的晋级路径；轮次和日期来自 featured 配置 */
const roundCn = (name) => {
  const digits = ['一', '二', '三', '四', '五', '六', '七', '八'];
  const m = String(name).match(/^第\s*(\d)\s*轮$/);
  if (m) return `第${digits[Number(m[1]) - 1] ?? m[1]}轮`;
  const strong = String(name).match(/^(\d+)\s*强$/);
  if (strong) return `${({ 4: '四', 8: '八', 16: '十六', 32: '三十二' })[strong[1]] ?? strong[1]}强`;
  return String(name).replace(/\s+/g, '');
};

function buildCups(config, allMatches) {
  if (!Array.isArray(config) || !config.length) return [];
  const byDate = new Map(allMatches.map((m) => [m.date, m]));
  const cn = (name) => teamMeta(name)?.cn ?? name;

  return config.map((cup) => {
    const rounds = cup.rounds.map((round) => {
      const games = (round.dates ?? []).map((d) => byDate.get(d)).filter(Boolean);

      if (round.group) {
        const w = games.filter((g) => g.result === 'W').length;
        const d = games.filter((g) => g.result === 'D').length;
        const l = games.filter((g) => g.result === 'L').length;
        return {
          name: round.name,
          detail: `${games.length} 场 ${w} 胜 ${d} 平 ${l} 负 · ${w * 3 + d} 分`,
          group: true,
        };
      }

      // 淘汰赛按对手合并两回合，一律曼联比分在前
      const ties = new Map();
      for (const g of games) {
        const name = cn(g.opponent);
        if (!ties.has(name)) ties.set(name, []);
        ties.get(name).push(g);
      }
      const parts = [...ties].map(([name, list]) => {
        const scores = list
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((g) => `${g.scoreFor}-${g.scoreAgainst}`)
          .join(' / ');
        return `${name} ${scores}`;
      });
      const note = round.note ?? '';
      return {
        name: round.name,
        detail: [parts.join('；'), note && !/出局/.test(note) ? note : ''].filter(Boolean).join(' · '),
        note,
        lost: games.some((g) => g.result === 'L') || /出局/.test(note),
        // 决赛打平、点球结果 archive 里没有，这种情况不能判夺冠
        drawn: games.every((g) => g.result === 'D'),
      };
    });

    // 止步在第几轮：取最后一轮（「点球出局」这类备注优先）；打进决赛又赢了就是夺冠
    const last = rounds.at(-1);
    let out = '';
    if (last && !cup.auto) {
      if (last.note && /出局/.test(last.note)) out = last.note;
      else if (last.group) out = `${last.name}出局`;
      else if (last.lost) out = `止步${roundCn(last.name)}`;
      else if (last.drawn) out = last.name === '决赛' ? '决赛打平，点球结果未记录' : `${roundCn(last.name)}打平，点球结果未记录`;
      else if (last.name === '决赛') out = '夺冠';
    }
    // 手写结论优先（点球、加时这种 archive 里没有）
    out = CUP_RESULTS[cup.name] ?? out;
    if (last && out && out !== '夺冠') last.out = true;

    return { name: cup.name, outcome: out, rounds };
  });
}

/* ---------------- 主流程 ---------------- */

/** 之前各赛季一共出过多少期：期号跨赛季顺延，2018/19 从 1 开始 */
function seasonOffset(slug) {
  if (!existsSync(OUT)) return 0;
  const earlier = readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name < slug)
    .map((d) => d.name)
    .sort();
  let total = 0;
  for (const name of earlier) {
    const idx = join(OUT, name, 'index.json');
    if (!existsSync(idx)) continue;
    try {
      total += JSON.parse(readFileSync(idx, 'utf8')).count ?? 0;
    } catch {
      /* 坏掉的季不计入，下面写文件时会重算 */
    }
  }
  return total;
}

const summary = [];
const warnings = [];
// 当前赛季的手写杯赛结论（data/cup-results.json），buildCups 里直接用
let CUP_RESULTS = {};

for (const slug of targets) {
  // 主线赛季（26/27）是手写稿，归档生成器不许覆盖
  const existingIndex = join(OUT, slug, 'index.json');
  if (existsSync(existingIndex)) {
    try {
      if (JSON.parse(readFileSync(existingIndex, 'utf8')).kind === 'main') {
        warnings.push(`跳过 ${slug}：主线赛季（kind=main），归档生成器不碰`);
        continue;
      }
    } catch {
      /* 索引坏了就照常生成 */
    }
  }

  const file = join(ARCHIVE, `${slug}.json`);
  if (!existsSync(file)) {
    warnings.push(`⚠ ${slug}：data/archive/${slug}.json 不存在`);
    continue;
  }

  let archive;
  try {
    archive = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    warnings.push(`⚠ ${slug}：JSON 读不动（${error.message}），可能后台还在写`);
    continue;
  }

  const matches = [...archive.matches].sort((a, b) => String(a.dateUTC).localeCompare(String(b.dateUTC)));

  // 人工编辑层（配图 / 热评 / 追加条目），没有就照常生成
  const featuredFile = join(ROOT, 'scripts/featured', `${slug}.json`);
  const featured = existsSync(featuredFile) ? JSON.parse(readFileSync(featuredFile, 'utf8')) : { issues: {} };
  const featuredIssues = featured.issues ?? {};
  const roundsFile = join(DATA, 'rounds', `${slug}.json`);
  const roundsByMatch = existsSync(roundsFile) ? JSON.parse(readFileSync(roundsFile, 'utf8')) : {};
  const cupResultsFile = join(DATA, 'cup-results.json');
  const allCupResults = existsSync(cupResultsFile) ? JSON.parse(readFileSync(cupResultsFile, 'utf8')) : {};
  CUP_RESULTS = allCupResults[slug] ?? {};
  const cupConfig = featured.cups?.length ? featured.cups : autoCups(matches, roundsByMatch);
  const withGoals = matches.filter((m) => (m.goals ?? []).length > 0).length;
  if (withGoals === 0) {
    warnings.push(`⚠ ${slug}：这一季没有进球数据，正文会写成「双方都没有进球」——先等 archive 补齐`);
  } else if (withGoals < matches.length * 0.8) {
    warnings.push(`⚠ ${slug}：${matches.length} 场里只有 ${withGoals} 场有进球数据，正文可能缺进球`);
  }

  // 每期的头图：fetch-archive-images.mjs 提前抓好，索引在 data/images-<season>.json
  const imageFile = join(DATA, `images-${slug}.json`);
  const images = existsSync(imageFile) ? JSON.parse(readFileSync(imageFile, 'utf8')) : {};
  const heroOf = (m, oppCn) => {
    const key = `${m.date}-${m.opponent.replace(/[^A-Za-z0-9]/g, '')}`;
    const hit = images[key];
    if (!hit) return null;
    return { src: hit.src, alt: scoreline(m, oppCn), width: hit.width, height: hit.height };
  };

  const rows = [];
  const seen = new Map();

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const meta = teamMeta(m.opponent);
    const oppCn = meta?.cn ?? null;
    if (!meta) warnings.push(`⚠ ${slug}：未收录对手「${m.opponent}」，先补 scripts/teams-cn.json`);
    const badge = badgeOf(meta);
    if (meta && !badge) warnings.push(`⚠ ${slug}：「${m.opponent}」有中文名但没有队徽 media/badges/${meta.badge}.png`);
    if (m.venue && !NAMES.venue[m.venue]) warnings.push(`⚠ ${slug}：未收录场地「${m.venue}」（保留英文）`);

    const t = tally(matches, i);
    const issue = buildIssue(m, oppCn ?? m.opponent);
    fillBody(issue, m, t, oppCn ?? m.opponent);
    issue.sections[0].items[0].badge = badge;
    const hero = heroOf(m, oppCn ?? m.opponent);
    if (hero) issue.hero = hero;

    const hh = Number(String(m.time).slice(0, 2));
    issue.date = hh < 12 ? m.date : addDay(m.date, 1);
    issue.id = `${issue.date}-morning`;

    // 同一期撞车（23:00 一场 + 次日 00:30 一场）就并进同一期，不覆盖
    if (seen.has(issue.id)) {
      const host = seen.get(issue.id);
      host.sections[0].items.push(...issue.sections[0].items);
      host.item_count = host.sections[0].items.length;
      warnings.push(`⚠ ${slug}：${issue.id} 撞了两场，已并进同一期`);
      continue;
    }
    seen.set(issue.id, issue);

    rows.push({
      issue,
      result: m.result,
      competition: m.competition,
      home: m.home,
      opponent: oppCn ?? m.opponent,
      matchDate: m.date,
      badge,
      scoreline: scoreline(m, oppCn ?? m.opponent),
      clause: clause(m, timeline(m)),
      source_name: `${m.competition} · ${m.home ? '主场' : '客场'}`,
    });
  }

  rows.sort((a, b) => a.issue.id.localeCompare(b.issue.id));

  // 纯新闻期：没有比赛，但按时间顺序照样占号（跟主线第 8 期「赛前·卡里克」一个道理）
  const newsIssues = (featured.newsIssues ?? []).map((n) => {    const period = n.period === 'evening' ? 'evening' : 'morning';
    return {
      id: `${n.date}-${period}`,
      date: n.date,
      period,
      issue_number: null,
      season: archive.season ?? slug,
      archive: true,
      kind: 'news',
      title: n.title ?? (period === 'evening' ? '曼联晚报' : '曼联早报'),
      item_count: (n.items ?? []).length,
      section_count: 1,
      sections: [{ id: 'news', title: n.section ?? '场外要闻', items: n.items ?? [] }],
      note: n.note ?? { title: '编辑短评', body: '这一期只有场外的事。' },
    };
  });

  // 赛季总结：单独一期，数字全从 archive 算，不手抄
  const summaryConfig = featured.seasonSummary ?? { date: addDay(matches.at(-1).date, 1) };
  if (summaryConfig) {
    // 撞上已有期次就往后挪一天：同一个 id 两期会互相覆盖（2021/22 等 5 季踩过）
    const taken = new Set([...rows.map((r) => r.issue.id), ...newsIssues.map((n) => n.id)]);
    let summaryDate = summaryConfig.date;
    while (taken.has(`${summaryDate}-morning`)) summaryDate = addDay(summaryDate, 1);
    const s = { ...summaryConfig, date: summaryDate };
    const all = tally(matches, matches.length - 1);
    const cups = buildCups(cupConfig, matches);
    const focusFile = join(DATA, 'focus.json');
    const focusList = existsSync(focusFile) ? JSON.parse(readFileSync(focusFile, 'utf8'))[slug] ?? [] : [];
    const list = (arr) => `<ul>${arr.map((x) => `<li>${textEsc(x)}</li>`).join('')}</ul>`;
    const cupLine = cups.map((c) => `${c.name}：${c.outcome || '—'}`);

    newsIssues.push({
      id: `${s.date}-morning`,
      date: s.date,
      period: 'morning',
      issue_number: null,
      season: archive.season ?? slug,
      archive: true,
      kind: 'summary',
      title: '曼联早报',
      // 配图：把图丢到 media/season-<slug>-summary.jpg 就行，生成器自己挂上
      ...(() => {
        if (s.hero) return { hero: s.hero };
        const file = join(ROOT, `media/season-${slug}-summary.jpg`);
        if (!existsSync(file)) return {};
        const size = imageSize(file);
        return { hero: { src: `./media/season-${slug}-summary.jpg`, alt: `${archive.season} 赛季总结`, ...size } };
      })(),
      item_count: 3,
      section_count: 1,
      sections: [
        {
          id: 'season',
          title: '赛季总结',
          items: [
            {
              id: 'season-record',
              title: `${matches.length} 场，${all.all.W} 胜 ${all.all.D} 平 ${all.all.L} 负`,
              summary: `各项赛事进 ${all.all.gf} 球失 ${all.all.ga} 球；联赛 ${all.league.n} 场，${all.league.W} 胜 ${all.league.D} 平 ${all.league.L} 负。`,
              body_html: `<p>这一季一共踢了 ${matches.length} 场：${all.all.W} 胜 ${all.all.D} 平 ${all.all.L} 负，进 ${all.all.gf} 球、失 ${all.all.ga} 球。</p><p>联赛 ${all.league.n} 场，${all.league.W} 胜 ${all.league.D} 平 ${all.league.L} 负，进 ${all.league.gf} 球失 ${all.league.ga} 球。</p>`,
              sources: [{ text: 'ESPN 赛程', url: `https://www.espn.com/soccer/team/_/id/360/manchester-united` }],
              source_name: '数据',
              published_at: s.date.slice(5),
            },
            {
              id: 'season-cups',
              title: '四条战线：欧冠八强，联赛杯一轮游',
              summary: cupLine.join('；'),
              body_html: `${list(cupLine)}<p>联赛最后排第 6，下赛季没有欧冠。</p>`,
              sources: [{ text: 'ESPN 赛程', url: `https://www.espn.com/soccer/team/_/id/360/manchester-united` }],
              source_name: '战线',
              published_at: s.date.slice(5),
            },
            {
              id: 'season-focus',
              title: focusList.length ? `名局 ${focusList.length} 场` : '名局',
              summary: focusList.slice(0, 6).map((f) => f.label).join('、') + (focusList.length > 6 ? ' 等' : ''),
              body_html: focusList.length
                ? `<p>挑出这几场当成一季的名局（共 ${focusList.length} 场）：</p>${list(focusList.map((f) => `${f.label}（${f.date}）—— ${f.why}`))}`
                : '<p>这一季还没有标记名局。</p>',
              sources: [{ text: 'data/focus.json', url: 'https://github.com/SilverHerring1/manutd-daily' }],
              source_name: '回顾',
              published_at: s.date.slice(5),
            },
          ],
        },
      ],
      note: s.note ?? { title: '编辑短评', body: '一季到此为止。' },
    });
    warnings.push(`✎ ${slug}：生成了赛季总结期（${s.date}）`);
  }

  // 比赛期 + 新闻期一起按时间排序，再统一编号
  const rankOf = (p) => (p === 'morning' ? 0 : 1);
  const allIssues = [...rows.map((r) => r.issue), ...newsIssues].sort(
    (a, b) => a.date.localeCompare(b.date) || rankOf(a.period) - rankOf(b.period),
  );
  const offset = seasonOffset(slug);
  allIssues.forEach((issue, i) => {
    issue.issue_number = offset + i + 1;
  });
  if (newsIssues.length) warnings.push(`✎ ${slug}：${newsIssues.length} 期纯新闻期也占用期号`);

  // 套上人工编辑层：配图、懂球帝热评、追加条目（如格林伍德首秀）
  let patched = 0;
  for (const r of rows) {
    const patch = featuredIssues[r.issue.date];
    if (!patch) continue;
    patched += 1;
    if (patch.hero) r.issue.hero = patch.hero;
    if (patch.note) r.issue.note = { title: '编辑短评', ...patch.note };
    for (const extra of patch.items ?? []) {
      const { section: sectionTitle = '场边', ...item } = extra;
      let section = r.issue.sections.find((s) => s.title === sectionTitle);
      if (!section) {
        section = { id: sectionTitle === '场边' ? 'news' : `section-${r.issue.sections.length + 1}`, title: sectionTitle, items: [] };
        r.issue.sections.push(section);
      }
      section.items.push(item);
    }
    r.issue.item_count = r.issue.sections.reduce((a, s) => a + s.items.length, 0);
    r.issue.section_count = r.issue.sections.length;
  }
  if (patched) warnings.push(`✔ ${slug}：${patched} 期套用了 scripts/featured/${slug}.json`);

  const record =
    archive.record ??
    matches.reduce(
      (a, m) => {
        a[m.result] += 1;
        a.gf += m.scoreFor;
        a.ga += m.scoreAgainst;
        return a;
      },
      { W: 0, D: 0, L: 0, gf: 0, ga: 0 },
    );

  const rowMeta = new Map(rows.map((r) => [r.issue, r]));
  const season = {
    season: archive.season ?? slug,
    slug,
    dir: `seasons/${slug}`,
    count: allIssues.length,
    matchCount: rows.length,
    newsCount: newsIssues.length,
    record,
    first: allIssues[0]?.date ?? '',
    last: allIssues.at(-1)?.date ?? '',
    issues: allIssues.map((issue) => {
      const r = rowMeta.get(issue);
      if (!r) {
        // 纯新闻期：没有比分、对手、结果
        return {
          id: issue.id,
          date: issue.date,
          period: issue.period,
          issue_number: issue.issue_number,
          title: issue.title,
          item_count: issue.item_count,
          section_count: issue.section_count,
          season: issue.season,
          archive: true,
          kind: issue.kind ?? 'news',
          competition: issue.kind === 'summary' ? '赛季总结' : issue.sections[0]?.title ?? '场外要闻',
        };
      }
      return {
        id: r.issue.id,
        date: r.issue.date,
        period: 'morning',
        issue_number: r.issue.issue_number,
        title: r.issue.title,
        item_count: r.issue.item_count,
        section_count: r.issue.section_count,
        season: r.issue.season,
        archive: true,
        match_no: r.issue.match_no,
        matchDate: r.matchDate,
        result: r.result,
        competition: r.competition,
        home: r.home,
        opponent: r.opponent,
        badge: r.badge,
        scoreline: r.scoreline,
        clause: r.clause,
        source_name: r.source_name,
      };
    }),
  };

  // 欧战小组表：fetch-group.mjs 提前抓好，放在 data/groups/<season>.json
  const groupFile = join(DATA, 'groups', `${slug}.json`);
  const group = existsSync(groupFile) ? JSON.parse(readFileSync(groupFile, 'utf8')) : null;

  if (!dry && !PAGES_ONLY) {
    const outDir = join(OUT, slug);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const issue of allIssues) {
      writeFileSync(`${join(outDir, issue.id)}.json`, `${JSON.stringify(issue, null, 2)}\n`, 'utf8');
    }
    writeFileSync(
      join(outDir, 'index.json'),
      `${JSON.stringify(
        {
          version: 1,
          season: season.season,
          slug,
          source: `data/archive/${slug}.json`,
          generated_at: new Date().toISOString().slice(0, 19) + '+08:00',
          count: season.count,
          matchCount: season.matchCount,
          newsCount: season.newsCount,
          record: season.record,
          first: season.first,
          last: season.last,
          dates: allIssues.map((i) => i.date).sort().reverse(),
          cups: buildCups(cupConfig, matches),
          group,
          issues: season.issues,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  summary.push(season);
}

/* ---------------- 总目 + 归档页 ---------------- */

if (!dry) {
  mkdirSync(OUT, { recursive: true });
  const seasonsFile = join(DATA, 'seasons.json');
  const previous = existsSync(seasonsFile) ? JSON.parse(readFileSync(seasonsFile, 'utf8')) : { seasons: [] };
  const catalog = new Map((previous.seasons ?? []).map((s) => [s.slug, s]));

  for (const s of summary) {
    catalog.set(s.slug, {
      season: s.season,
      slug: s.slug,
      dir: s.dir,
      count: s.count,
      record: s.record,
      first: s.first,
      last: s.last,
    });
  }

  const seasons = [...catalog.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  if (!PAGES_ONLY) writeFileSync(
    seasonsFile,
    `${JSON.stringify({ version: 1, generated_at: new Date().toISOString().slice(0, 19) + '+08:00', seasons }, null, 2)}\n`,
    'utf8',
  );

  // 归档页按总目重建，这样新增赛季时旧页面不会掉
  const archiveDir = join(ROOT, 'archive');
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(join(archiveDir, 'index.html'), `${renderArchiveIndex(seasons)}\n`, 'utf8');
  for (const s of seasons) {
    if (s.kind === 'main' || !s.record) continue; // 主线赛季和手写季不在归档里生成页面
    const idxFile = join(DATA, s.dir, 'index.json');
    if (!existsSync(idxFile)) continue;
    writeFileSync(join(archiveDir, `${s.slug}.html`), `${renderSeasonPage(JSON.parse(readFileSync(idxFile, 'utf8')))}\n`, 'utf8');
  }
}

/* ---------------- 只报汇总 ---------------- */

for (const s of summary) {
  const r = s.record;
  console.log(
    `${s.season}  ${String(s.count).padStart(3)} 期（${s.matchCount} 场${s.newsCount ? ` + ${s.newsCount} 期新闻` : ''}）  ${r.W} 胜 ${r.D} 平 ${r.L} 负  ${r.gf}-${r.ga}  →  ${s.dir}`,
  );
}
if (!dry) console.log('归档页 archive/index.html + 各赛季页；总目 data/seasons.json');
for (const w of [...new Set(warnings)]) console.log(w);
console.log(dry ? '（--dry：没有写文件）' : '完成。');
