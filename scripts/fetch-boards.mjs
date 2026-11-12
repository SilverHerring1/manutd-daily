// 每赛季开赛跑一次：node scripts/fetch-boards.mjs
//         换数据源：node scripts/fetch-boards.mjs --source espn
//
// 榜单默认取懂球帝（m.dongqiudi.com 的积分榜页，服务端渲染的表格），队徽用 FM 的 25×18 小图标。
// 看到「⚠ 未收录」就把那支队补进 data/team-map.json —— 中文名 + badge 文件名 + FM unique ID。
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("data/boards.json", ROOT);
const MAP = new URL("data/team-map.json", ROOT);

const source = (process.argv.includes("--source")
  ? process.argv[process.argv.indexOf("--source") + 1]
  : "dqd");

// 懂球帝的赛事 ID：英超 = 1
const DQD_URL = "https://m.dongqiudi.com/stat/1/rankingTeam";
const ESPN_URL = "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=2026";
const UA = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

// 去掉可能存在的 BOM（用记事本或 PowerShell 存过就会带上）
const readJson = (url) => JSON.parse(readFileSync(url, "utf8").replace(/^\uFEFF/, ""));
const teamMap = existsSync(MAP) ? readJson(MAP) : {};

const byCn = new Map();
for (const [en, meta] of Object.entries(teamMap)) byCn.set(meta.cn, { en, ...meta });

/** 懂球帝的队名偶尔比我们长（纽卡斯尔联 / 纽卡斯尔），先精确再前缀 */
function lookup(cn) {
  if (byCn.has(cn)) return byCn.get(cn);
  for (const [key, meta] of byCn) {
    if (cn.startsWith(key) || key.startsWith(cn)) return meta;
  }
  return null;
}

const unknown = new Set();

function toRow({ rank, cn, played, win, draw, loss, gf, ga, pts }) {
  const meta = lookup(cn);
  if (!meta) unknown.add(cn);
  return {
    rank,
    en: meta?.en ?? cn,
    cn,
    badge: meta ? `./media/badges/${meta.badge}.png` : null,
    fm: meta?.fm ?? null,
    played,
    win,
    draw,
    loss,
    gf,
    ga,
    gd: gf - ga,
    pts,
    united: meta?.badge === "man-utd",
  };
}

/** 懂球帝：一页 HTML 表格，每行 队徽/队名 + 赛胜平负 + 进/失 + 积分 */
function parseDqd(html) {
  const rows = [];
  for (const m of html.matchAll(/<tr class="ranking—team-table-body"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const chunk = m[1];
    const rank = chunk.match(/<td class="rank">(\d+)<\/td>/);
    const name = chunk.match(/<span class="name">([^<]+)<\/span>/);
    const plain = [...chunk.matchAll(/<td class="score-number">(\d+)<\/td>/g)].map((x) => Number(x[1]));
    const goals = chunk.match(/<td class="score-number">(\d+)\/(\d+)<\/td>/);
    const pts = chunk.match(/<td class="td-check score-number">(\d+)/);
    if (!rank || !name || plain.length < 4 || !goals || !pts) continue;
    rows.push({
      rank: Number(rank[1]),
      cn: name[1].trim(),
      played: plain[0],
      win: plain[1],
      draw: plain[2],
      loss: plain[3],
      gf: Number(goals[1]),
      ga: Number(goals[2]),
      pts: Number(pts[1]),
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

/** ESPN：接口 JSON，字段名和懂球帝不一样 */
const STAT = (entry, name) => entry.stats.find((s) => s.name === name)?.value ?? 0;

async function fromEspn() {
  const response = await fetch(ESPN_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`ESPN 返回 ${response.status}`);
  const data = await response.json();
  const entries = data.children?.[0]?.standings?.entries ?? [];
  if (!entries.length) throw new Error("ESPN 没解析到积分榜数据");
  return entries
    .map((entry) => ({
      rank: STAT(entry, "rank"),
      cn: teamMap[entry.team.displayName]?.cn ?? entry.team.displayName,
      played: STAT(entry, "gamesPlayed"),
      win: STAT(entry, "wins"),
      draw: STAT(entry, "ties"),
      loss: STAT(entry, "losses"),
      gf: STAT(entry, "pointsFor"),
      ga: STAT(entry, "pointsAgainst"),
      pts: STAT(entry, "points"),
    }))
    .sort((a, b) => a.rank - b.rank);
}

let raw;
let sourceName;

if (source === "espn") {
  sourceName = "ESPN";
  raw = await fromEspn();
} else if (source === "dqd") {
  sourceName = "懂球帝";
  const response = await fetch(DQD_URL, { headers: UA });
  if (!response.ok) throw new Error(`懂球帝返回 ${response.status}`);
  const html = await response.text();
  raw = parseDqd(html);
  if (!raw.length) throw new Error("懂球帝没解析到积分榜数据（页面结构可能变了）");
} else {
  console.error(`不认识的 --source ${source}，可选：dqd / espn`);
  process.exit(1);
}

const rows = raw.map(toRow);

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      title: "英超积分榜",
      updated: new Date().toISOString().slice(0, 10),
      source: sourceName,
      rows,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const united = rows.find((r) => r.united);
console.log(`${sourceName}：写入 ${rows.length} 行，曼联第 ${united?.rank ?? "?"} 名 ${united?.pts ?? "?"} 分`);

if (rows.length !== 20) {
  console.log(`⚠ 只拿到 ${rows.length} 行，正常应当是 20 行 —— 检查数据源`);
}

if (unknown.size) {
  console.log("");
  console.log("⚠ 未收录的球队（页面会没有队徽）：");
  for (const cn of unknown) {
    console.log(`   - ${cn}   ← 去 data/team-map.json 补：{ "cn": "中文名", "badge": "文件名", "fm": FM编号 }`);
  }
  console.log("");
  console.log("FM 编号 = D:\\Sports Interactive\\Football Manager 2024\\graphics\\logos\\logos\\clubs\\small 里的文件名；");
  console.log("队徽另存为 media/badges/<badge>.png（25×18，别缩放）。");
}
