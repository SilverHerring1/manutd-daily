// 给每场比赛补进球者：读 data/archive/*.json，逐场请求 ESPN summary。
// 用法：node scripts/fetch-scorers.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DIR = new URL("../data/archive/", import.meta.url);
const UA = { "User-Agent": "Mozilla/5.0" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

async function fetchSummary(league, eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429) { await sleep(1500 * attempt); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(1000 * attempt);
    }
  }
  return null;
}

function goalsFrom(summary) {
  const events = summary?.keyEvents ?? [];
  return events
    .filter((e) => e.scoringPlay === true)
    .map((e) => {
      const kind = e.type?.text ?? "";
      return {
        minute: e.clock?.displayValue ?? "",
        name: e.participants?.[0]?.athlete?.displayName ?? "",
        team: e.team?.displayName ?? "",
        united: String(e.team?.id) === "360",
        type: /own/i.test(kind) ? "乌龙" : /penalty/i.test(kind) ? "点球" : "",
        shootout: Boolean(e.shootout),
      };
    })
    .filter((g) => !g.shootout); // 点球大战不算进球
}

let done = 0;
let filled = 0;
let failed = 0;

for (const file of files) {
  const path = new URL(file, DIR);
  const season = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  let changed = false;

  for (const match of season.matches) {
    done += 1;
    if (Array.isArray(match.goals)) continue; // 已经有了就跳过，支持断点续跑

    const summary = await fetchSummary(match.league ?? "eng.1", match.id);
    if (!summary) { failed += 1; continue; }

    match.goals = goalsFrom(summary);
    filled += 1;
    changed = true;
    await sleep(120);
  }

  if (changed) writeFileSync(path, JSON.stringify(season, null, 2), "utf8");
  console.log(`${season.season}: 完成，累计 ${done} 场`);
}

console.log(`\n共 ${done} 场，补到 ${filled} 场，失败 ${failed} 场`);
