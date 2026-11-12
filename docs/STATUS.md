# 项目状态

> 每次开工先读这份，收工更新这份。聊天记录会丢，这里不会。

## 现在到哪了

- 主线已发布：10 期（10-11 → 11-10），含 11-07 的发布会特刊
- 赛季归档：**9 季全部接入页面，共 447 期**（2018/19 56 期 → 2025/26 41 期），外加主线 2026/27 10 期；**416 场比赛头图**，淘汰赛轮次和「止步/夺冠」结论都已对齐 ESPN
- 上线地址：https://silverherring1.github.io/manutd-daily/
- 仓库：https://github.com/SilverHerring1/manutd-daily
- 最后更新：2026-11-12 22:05（日 / 月 / 日三级筛选 + 赛季归档页 + 积分榜换懂球帝数据源）

## 2026-11-12 这一轮做了什么
1. **归档生成器** `scripts/gen-archive-issues.mjs`
   - `node scripts/gen-archive-issues.mjs 2018-19` 把 `data/archive/<season>.json` 的每一场变成一期日报
   - 产物：`data/seasons/2018-19/<date>-morning.json`（53 期，格式与 `data/*.json` 完全一致）+ 该季 `index.json`
   - 顺带写 `data/seasons.json`（赛季总目，`app.js` 读它）和 `archive/` 两个页面
   - 只跑了一季；`--all` 能把其余 8 季一次生成，但这次没跑（用户要求先看 2018/19 效果）
2. **日期筛选改成 年 / 月 / 日 三级**，替掉原来那个「最近七天」格子
   - 年份按钮在总目里出现过的年份（现在 2018 / 2019 / 2026），点年再点月，最后挑哪天的早报
   - 只列「那天有稿」的日子，不再铺满 31 天
3. **赛季归档页** `/archive/`
   - `archive/index.html` 列赛季，`archive/2018-19.html` 按月列全部场次，最后一列点进当天早报
   - 顶栏加了「赛季归档」入口。发布包里版本切换条会被剥掉，所以这个入口单独写，不在 `variant-nav` 里
4. **`app.js` 改了取数方式**
   - 新增 `state.catalog`：主线期次 + 各赛季期次合成一张按 id 索引的总目，每个期次记住自己所在的目录
   - 归档期次：抬头「曼联早报」；`issue_number` 跨赛季顺延（2018/19 第 1 期起），不再用「赛季 · 第 N 场」；**不挂积分榜**（2018 年的稿子贴 2026 年的榜等于用后来的事写过去）；期次导航只在本赛季内翻
   - 搜索范围扩到全部期次（含归档），结果带赛季前缀
5. `scripts/teams-cn.json`：队名 / 场地 / 队徽 / FM 编号对照（结构化，`cn` + `badge` + `fm`）
6. **人工编辑层** `scripts/featured/<season>.json`（重跑生成器不会冲掉）
   - `note` 覆盖侧栏点评、`items[]` 追加条目、`hero`/`images` 配图；日期键用**期次 date**（赛后次日）
   - 已落地第 41 期（2019-03-07 巴黎 3-1）：
     - 侧栏换成**懂球帝热评**：网友「众人皆醉唯我独醒丶」1.8 万赞那条，带署名和原帖链接
     - 追加「格林伍德欧冠首秀，球衣上的号码是借巴黎的印字印的」，配 `media/greenwood-psg.jpg`（粉色客场 + 号码里嵌 PSG 徽）
7. **队徽覆盖归档对手**：2018/19 全部 26 支都有了中文名 + 25×18 FM 队徽
   - FM 编号来源：kits 包的 `config.xml`（`from="cardiff1" to=".../team/625/..."`），不用去论坛查
8. **积分榜换数据源**：ESPN → 懂球帝（`m.dongqiudi.com/stat/1/rankingTeam`），`--source espn` 可回退
9. **淘汰赛路径 + 欧战小组表**（赛季归档页顶部）：路径只画曼联那一条，止步节点标红；小组表只放曼联那一组
   - 2018/19：欧冠止步八强（小组赛 10 分 → 16 强巴黎 0-2/3-1 客场进球晋级 → 8 强巴萨 0-1/0-3）、联赛杯点球出局、足总杯止步八强
   - 欧冠 H 组：尤文 12 · 曼联 10 · 瓦伦西亚 8 · 年轻人 4（`scripts/fetch-group.mjs` 从 ESPN 抽，写 `data/groups/2018-19.json`）
   - 轮次配置在 `scripts/featured/2018-19.json` 的 `cups`；比分和积分由生成器从 archive 算，不手填
10. **热评取法修正**：`zhanbao` 战报页没有评论组件，必须找**标题带比分的那种新闻文章**（如 `article/923635` 曼联3-1巴黎、`article/947314` 巴萨3-0曼联）
11. **纯新闻期也占号**（跟主线第 8 期「赛前·卡里克」一致）
    - `scripts/featured/2018-19.json` 的 `newsIssues[]` 写没有比赛的期次；生成器把比赛期和新闻期合并按时间排序，再统一编号
    - 已加两期：**第 25 期** 2018-12-18 晚报（穆里尼奥下课）、**第 45 期** 2019-03-28 晚报（索尔斯克亚转正），都带 manutd.com 官方链接
    - 归档页里这类行：赛事「场外」、比分「—」

## 待办

- [x] 上传 `manifest.webmanifest` + 新 `index.html`（装应用要用）
- [x] README 改成访客首页；docs 一并公开
- [x] favicon 换成红底 MU（`media/favicon.svg`）
- [x] **积分榜**：正文末尾一张 20 队全表，曼联行标红；`node scripts/fetch-boards.mjs` 生成 `data/boards.json`
  - 数据源 **懂球帝**（`m.dongqiudi.com/stat/1/rankingTeam`，服务端渲染的表格，解析成 JSON）；`--source espn` 可退回旧接口
  - 队徽用 **FM 25×18 小图标**，原尺寸显示；FM unique ID 记在 `data/team-map.json` 的 `fm` 字段
  - 2026-11-12 实测两者一致：20 行、名次 / 胜平负 / 进失 / 积分逐行相同，曼联 18 名 8 分
- [x] 页面加**年 / 月 / 日**三级筛选（本轮完成，替掉「最近七天」）
- [x] 归档页 `/archive/`：按赛季列全部期次（本轮完成，先只有 2018/19）
- [ ] **其余 8 季接入**：先补 `scripts/teams-cn.json` 里 2021/22 起的队名与场地，再 `node scripts/gen-archive-issues.mjs --all`
- [ ] 从 452 场里挑 30–50 场**深写**成日报规格（现在 53 期都是按比分生成的简报，没有引语和配图）
- [ ] `media/` 压图：现在 3.3 MB，目标 1.5 MB 以内（转 webp，1200px 宽够用）
- [ ] 下一期起混用多来源：懂球帝/直播吧找线索，官网核事实，英媒取观点
- [ ] 11-22 客场利物浦这场要提前一期做前瞻（首发/伤停/历史交锋）
- [ ] 考虑加「月度精选」：把一个月的最好几篇挑出来重发
- [ ] 射手榜 / 助攻榜：**懂球帝有现成页面**，照 `fetch-boards.mjs` 的解析路子再加两个脚本就行
  - `https://m.dongqiudi.com/stat/1/rankingGoal`、`https://m.dongqiudi.com/stat/1/rankingAssist`
  - 队名映射直接复用 `data/team-map.json`（`cn` 对 `cn`，前缀兜底）
  - 老办法（ESPN 无接口）不用再找了

## 已知问题

- 国内访问 GitHub Pages 时快或慢，别人打不开大概率不是内容问题
- 图片版权：比赛图来自官网，个人使用可以，别公开分发
- `new-issue.mjs` 只生成骨架，内容要手填（没有自动抓取）
- **归档简报的内容边界**：只有比分、进球、场地、赛事，所以正文写的是过程与累计战绩，**没有引语、没有配图**。深写要另做
- **球员名保留英文原文**（`Romelu Lukaku`），没有中文名表；要中文得先建一张对照
- 联赛杯点球大战仍被 archive 记为平局（如 2018 主场 2-2 负德比郡）。正文已注明「进入加时；互射点球的结果没有记录」，不猜结果
- `Accu Stadium`（哈德斯菲尔德主场）没有中文场地名，暂留英文
- 2021/22 起的队名和场地大多没收录，`--all` 之前要补 `scripts/teams-cn.json`，否则打「⚠ 未收录」并用英文原名
- 搜索会把所有期次的 JSON 全拉一遍（现在 63 期还行）。9 季全接上后要改成一份搜索索引
- `data/archive/` 由后台 import 脚本写，**不要手改**；生成器只读它
- **队徽是 FM 素材**（`media/badges/<slug>.png`，25×18 小图），只用于个人阅读，别公开分发。编号**不用查网**：kits 包的 `config.xml` 里 `from="cardiff1" to=".../team/625/..."` 同时给了 slug 和编号，遍历联赛文件夹即可（详见 CONVENTIONS）
- 归档对手已覆盖 **9 季全部 80 支，全部有中文名 + 25×18 队徽**（kits 包里没有的 4 支：马竞 1687、阿尔克马尔 991、谢菲尔德联 708、阿斯塔纳 59041139，编号从 fmscout / fmtransferupdate 查的）
- 懂球帝积分榜页是 HTML 表格，靠 class 名解析（`ranking—team-table-body`，中间是长破折号）。页面改版的话 `fetch-boards.mjs` 会报「没解析到积分榜数据」，对着 HTML 改正则即可
- 队徽现状：**80 支对手全部齐了**。以后遇到 kits 包里没有的队，用 `fmtransferupdate.com` 或 `fmscout.com/club/<slug>.html?rev=24.0` 查编号，再去 FM 的 logos 目录按编号拷图

## 文件地图

```
manutd-daily/
├── index.html              页面骨架（结构、文案）
├── archive/                赛季归档页（生成器写，别手改）
│   ├── index.html          赛季列表
│   └── 2018-19.html        一季全部场次，按月分组
├── design-tokens.css       配色与字号（换肤只改这里）
├── layout.css              版式
├── app.js                  路由、渲染、搜索、双语引语、三级日期筛选
├── poster-canvas.js        单条新闻海报
├── manifest.webmanifest    让浏览器能"装成应用"
├── data/                   内容（唯一的内容源）
│   ├── index.json          主线期次目录
│   ├── seasons.json        赛季总目（生成器写）
│   ├── seasons/<slug>/     归档期次 + 该季 index.json（生成器写）
│   └── archive/<season>.json  原始赛程（import 脚本写，生成器只读）
├── media/                  图片 + CREDITS.md（图源对照表）
├── docs/                   本文件 + CONVENTIONS.md（口径）
├── scripts/
│   ├── publish.mjs         生成 _site 发布包（含 archive/）
│   ├── new-issue.mjs       新建一期骨架
│   ├── fetch-boards.mjs    抓积分榜
│   ├── fetch-scorers.mjs   射手榜（未接）
│   ├── import-season.mjs   抓一季赛程 → data/archive/
│   ├── gen-archive-issues.mjs  归档一季 → 一期一期（本轮新增）
│   └── teams-cn.json       队名 / 场地中文对照（生成器用）
├── _site/                  发布包（上传 GitHub 的就是这个）
└── serve.py / 启动.cmd     本地预览（禁用缓存）
```

## 提交步骤（2026-11-13 起：不打发布包，增量提交）

1. 改完先在本地 python serve.py 看一眼
2. 
ode scripts/check-size.mjs —— 体积/大文件检查
3. git add -A（.gitignore 已挡住 	mp/、_site/、变体数据、*.bak）
4. commit + push，GitHub Pages 直接从这个分支根目录出页
5. 线上自查：首页第 10 期 → 日期能翻到 2018/19 → /archive/ 列 8 季 → 2022/23 有「联赛杯 夺冠」

首次迁移（已完成/待做）：仓库 data/ 根目录那 10 个 2026-*.json 要删掉，它们已在 data/seasons/2026-27/。
scripts/publish.mjs 已弃用，留着只为偶尔检查「干净包」。
## 数据目录（2026-11-12 改成统一结构）

```
data/
├── index.json          只留元信息（name / as_of），不再存 issues
├── seasons.json        赛季总目：各季 slug / dir / 期数 / 起止
├── focus.json          每季的焦点战（★ 标在归档页上；build-focus + build-records 生成）
├── records-manual.json 手写的纪录条目（队史里程碑这类算不出来的）
├── team-map.json       当前英超 20 队（积分榜用）
├── boards.json         积分榜
├── groups/<season>.json  欧战小组表（fetch-group.mjs 写）
├── images-<season>.json  归档期次头图索引（fetch-archive-images.mjs 写）
└── seasons/
    ├── 2018-19/        55 期（53 场 + 2 期新闻）+ index.json
    └── 2026-27/        10 期（手写）+ index.json
```

- 新期：`node scripts/new-issue.mjs 2026-11-11 morning`，按日期自动落进对应赛季文件夹，并更新该季 `index.json`、`data/seasons.json`、`data/index.json` 的 `as_of`
- 迁移脚本：`node scripts/migrate-season.mjs 2026-27`（一次性，已跑过；把根目录的 10 期挪进赛季文件夹）
- **上传 GitHub 时要多一步**：`data/` 根目录原来那 10 个 `2026-*.json` 已经从本地删掉了，仓库里要**手动删除**，否则会留着一份旧路径的孤儿文件；新文件在 `data/seasons/2026-27/`。



- `data/` 是**日更版**（主线），`data/index.json` 只登记主线 10 期
- `data/seasons/` 是**归档**，生成器产物，可以随时删了重跑
- `data-weekly/` `data-deep/` `data-magazine/` 是早期对比用的三种编法，用 `?data=` 切换。**已决定用日更**，这三个可以删，也可以留着当参照
- `?data=data-weekly` 这类目录没有 `seasons.json`，页面会自己退化成只有主线，不报错

## 下次开工怎么接

1. 读这份 `STATUS.md` 和 `CONVENTIONS.md`
2. 主线补稿：看 `data/index.json` 最后一期的日期，从下一天开始补
3. 归档扩季：
   - 确认 `data/archive/<season>.json` 有进球数据（`goals` 不为空）
   - 补 `scripts/teams-cn.json`（生成器会逐条提示缺什么）
   - `node scripts/gen-archive-issues.mjs 2023-24`，看一眼 `archive/2023-24.html`
4. 抓素材 → 写 JSON → `node scripts/publish.mjs` → 上传 `_site` 变化的文件

## 历史档案

- 已导入 **9 个赛季、452 场**，在 `data/archive/2018-19.json` … `2026-27.json`
- 脚本：`node scripts/import-season.mjs 2018`（ESPN 赛程接口，一次一季）
- 每场字段：日期（北京）、时间、赛事、主客、对手、比分、胜平负、场地、进球（含点球 / 乌龙标记）
- **2018/19 已接入页面**（53 期）；2021/22–2026/27 的进球数据已于 11-12 21:35 补齐，等接页面

合计：26-11-16 / 33-16-12 / 35-14-12 / 20-14-15 / 41-9-12 / 25-8-19 / 23-16-20 / 20-12-8 / 3-5-7（W-D-L）
