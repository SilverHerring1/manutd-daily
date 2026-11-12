// 把手写的「历史级纪录」（data/records-manual.json）合并进 data/focus.json
// 只收「历史上首次」这种级别的：队史里程碑、欧冠/英超史上第一次。
// 赛季内的小纪录（补时绝杀、连胜、队内射手王）不算焦点战，别写进来。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const manual = existsSync('data/records-manual.json') ? JSON.parse(readFileSync('data/records-manual.json', 'utf8')) : {};
const focus = JSON.parse(readFileSync('data/focus.json', 'utf8'));

let added = 0;
for (const [slug, items] of Object.entries(manual)) {
  if (slug.startsWith('_')) continue;
  const byDate = new Map((focus[slug] ?? []).map((x) => [x.date, x]));
  for (const item of items) {
    if (!item?.date || !item?.why) continue;
    if (byDate.has(item.date)) {
      const cur = byDate.get(item.date);
      if (!cur.why.includes(item.why)) cur.why = `${cur.why}；${item.why}`;
    } else {
      byDate.set(item.date, { date: item.date, label: item.label ?? '', why: item.why, record: true });
      added += 1;
    }
  }
  focus[slug] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

writeFileSync('data/focus.json', `${JSON.stringify(focus, null, 2)}\n`, 'utf8');
console.log(`合并 ${added} 条历史级纪录`);
for (const [slug, items] of Object.entries(manual)) {
  if (slug.startsWith('_')) continue;
  console.log(`  ${slug}: ${items.map((i) => i.label).join('、')}`);
}
