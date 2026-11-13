// 把工作区的改动同步到 GitHub Desktop 的克隆目录，供 Desktop 提交推送。
// node scripts/sync-desktop.mjs [目标目录]
import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";

const SRC = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DST = process.argv[2] ?? "D:/Documents/GitHub/manutd-daily";
const SKIP = new Set(["tmp", "_site", ".git", "node_modules"]);

if (!existsSync(DST)) {
  console.error(`目标目录不存在：${DST}`);
  process.exit(1);
}

const hash = (file) => createHash("md5").update(readFileSync(file)).digest("hex");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let copied = 0;
const missingOnTarget = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const target = join(DST, rel);
  if (existsSync(target) && hash(file) === hash(target)) continue;

  if (!existsSync(dirname(target))) mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
  copied += 1;
  if (copied <= 5) console.log(`  ${rel}`);
}

console.log(`\n同步 ${copied} 个文件到 ${DST}`);
if (missingOnTarget.length) console.log(`目标独有（未处理）：${missingOnTarget.length} 个`);
