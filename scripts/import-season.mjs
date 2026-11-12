// 导入一个赛季的曼联赛程 → data/archive/<season>.json
// 用法：node scripts/import-season.mjs 2018
import { mkdirSync, writeFileSync } from "node:fs";

const season = process.argv[2];
if (!/^\d{4}$/.test(season ?? "")) {
  console.error("用法: node scripts/import-season.mjs 2018   （2018 表示 2018/19 赛季）");
  process.exit(1);
}

const OUT_DIR = new URL("../data/archive/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

const LEAGUES = [
  { slug: "eng.1", name: "英超" },
  { slug: "eng.fa", name: "足总杯" },
  { slug: "eng.league_cup", name: "联赛杯" },
  { slug: "uefa.champions", name: "欧冠" },
  { slug: "uefa.europa", name: "欧联" },
];

const UA = { "User-Agent": "Mozilla/5.0" };
const score = (c) => Number(c?.score?.displayValue ?? c?.score?.value ?? 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchLeague(slug) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/360/schedule?season=${season}`;
  // 接口会限流：失败了就退避重试，不能静默返回空数组（那会让一季少几十场）
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429) { await sleep(2000 * attempt); continue; }
      if (!res.ok) { await sleep(1000 * attempt); continue; }
      const data = await res.json();
      if (Array.isArray(data.events)) return data.events;
    } catch {
      await sleep(1500 * attempt);
    }
  }
  console.error(`  ⚠ ${leagueName(slug)} 抓取失败（重试 4 次）`);
  return [];
}

const leagueName = (slug) => LEAGUES.find((l) => l.slug === slug)?.name ?? slug;

const seen = new Set();
const matches = [];

for (const league of LEAGUES) {
  let events;
  try {
    events = await fetchLeague(league.slug);
  } catch {
    continue;
  }
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);

    const comp = event.competitions?.[0];
    const teams = comp?.competitors ?? [];
    const me = teams.find((t) => String(t.team?.id) === "360");
    const them = teams.find((t) => String(t.team?.id) !== "360");
    if (!me || !them) continue;

    const home = me.homeAway === "home";
    const utc = new Date(event.date);
    // 北京时间
    const cn = new Date(utc.getTime() + 8 * 3600 * 1000);
    const dateCN = cn.toISOString().slice(0, 10);

    const forGoals = score(me);
    const againstGoals = score(them);

    matches.push({
      id: event.id,
      season: `${season}/${String(Number(season) + 1).slice(2)}`,
      competition: league.name,
      league: league.slug,
      date: dateCN,
      time: `${String(cn.getUTCHours()).padStart(2, "0")}:${String(cn.getUTCMinutes()).padStart(2, "0")}`,
      dateUTC: utc.toISOString(),
      home,
      opponent: them.team?.displayName ?? "",
      opponentAbbr: them.team?.abbreviation ?? "",
      scoreFor: forGoals,
      scoreAgainst: againstGoals,
      result: forGoals > againstGoals ? "W" : forGoals < againstGoals ? "L" : "D",
      venue: comp?.venue?.fullName ?? "",
      name: event.name ?? "",
    });
  }
}

matches.sort((a, b) => a.dateUTC.localeCompare(b.dateUTC));

const record = matches.reduce(
  (acc, m) => {
    acc[m.result] += 1;
    acc.gf += m.scoreFor;
    acc.ga += m.scoreAgainst;
    return acc;
  },
  { W: 0, D: 0, L: 0, gf: 0, ga: 0 },
);

const out = {
  season: `${season}/${String(Number(season) + 1).slice(2)}`,
  imported: new Date().toISOString().slice(0, 10),
  source: "ESPN",
  count: matches.length,
  record,
  matches,
};

const file = new URL(`${season}-${String(Number(season) + 1).slice(2)}.json`, OUT_DIR);
writeFileSync(file, JSON.stringify(out, null, 2), "utf8");

console.log(`${out.season}: ${matches.length} 场  ${record.W} 胜 ${record.D} 平 ${record.L} 负  ${record.gf}-${record.ga}`);
for (const m of matches) {
  console.log(`  ${m.date}  ${m.competition.padEnd(4)}  ${m.home ? "主" : "客"} ${m.opponent.padEnd(22)} ${m.scoreFor}-${m.scoreAgainst} ${m.result}`);
}
