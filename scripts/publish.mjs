// 【已弃用 2026-11-13】仓库根目录本身就是要发布的站点，改完直接 commit + push，不再生成 _site。
// 留着只为了万一需要检查「干净发布包」长什么样。提交前用 node scripts/check-size.mjs 看体积。
// 生成可发布的 _site/：只复制上线需要的文件，去掉 tmp、变体数据、本地服务器和演示用的版本切换条。
// 用法：node scripts/publish.mjs
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = `${ROOT}_site`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = ["design-tokens.css", "layout.css", "app.js", "poster-canvas.js", "manifest.webmanifest"];
for (const f of files) {
  if (existsSync(`${ROOT}${f}`)) cpSync(`${ROOT}${f}`, `${OUT}/${f}`);
}
cpSync(`${ROOT}data`, `${OUT}/data`, { recursive: true });
cpSync(`${ROOT}media`, `${OUT}/media`, { recursive: true });

// 赛季归档页：生成器写到 archive/，/archive/ 要能直接打开
if (existsSync(`${ROOT}archive`)) cpSync(`${ROOT}archive`, `${OUT}/archive`, { recursive: true });

// 页面：去掉版本切换条（发布版不留演示入口），顺手把资源版本号写死
let html = readFileSync(`${ROOT}index.html`, "utf8");
html = html.replace(/<nav class="variant-nav"[\s\S]*?<\/nav>\s*/, "");
writeFileSync(`${OUT}/index.html`, html, "utf8");

// 404 也指向首页，免得手滑地址 404
writeFileSync(`${OUT}/404.html`, '<!doctype html><meta charset="utf-8"><title>曼联日报</title><meta http-equiv="refresh" content="0; url=./"><a href="./">返回首页</a>', "utf8");

console.log(`已生成 ${OUT}`);
