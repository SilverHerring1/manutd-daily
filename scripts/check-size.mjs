// 提交前跑一下：看仓库里有没有意外的大文件/体积超预算
// 用法：node scripts/check-size.mjs [预算MB，默认 200]
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const budgetMB = Number(process.argv[2] ?? 200);
// 这些目录不进仓库（见 .gitignore）
const SKIP = new Set(['tmp', '_site', '.git', 'node_modules', 'data-weekly', 'data-deep', 'data-magazine']);

let total = 0;
let files = 0;
const big = [];
const byDir = new Map();

function walk(dir, rel = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walk(full, relPath);
      continue;
    }
    const size = statSync(full).size;
    total += size;
    files += 1;
    if (size > 200 * 1024) big.push({ path: relPath, mb: size / 1024 / 1024 });
    const top = relPath.split('/')[0];
    byDir.set(top, (byDir.get(top) ?? 0) + size);
  }
}

walk(ROOT);

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`仓库体积（不含 tmp/_site/变体数据）：${mb(total)} MB / ${files} 个文件`);
console.log('\n各目录：');
for (const [dir, size] of [...byDir].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${dir.padEnd(14)} ${mb(size).padStart(7)} MB`);
}

if (big.length) {
  console.log(`\n⚠ 单个超过 200 KB 的文件 ${big.length} 个（网页上传上限 25 MB，git 硬限 100 MB）：`);
  for (const f of big.sort((a, b) => b.mb - a.mb).slice(0, 10)) console.log(`  ${f.mb.toFixed(2)} MB  ${f.path}`);
}

if (total / 1024 / 1024 > budgetMB) {
  console.log(`\n✗ 超出预算 ${budgetMB} MB，检查一下是不是把原图或中间产物提交了`);
  process.exit(1);
}
console.log(`\n✓ 在预算 ${budgetMB} MB 以内`);
