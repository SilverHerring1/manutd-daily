# 项目状态

> 每次开工先读这份，收工更新这份。聊天记录会丢，这里不会。
> **新开对话时，直接把下面「开工三句话」贴进去就能开始。**

## 开工三句话（新对话复制即用）

```
项目在 D:\Documents\deepseek-harness\default-workspace\manutd-daily
先读 docs/STATUS.md、docs/CONVENTIONS.md、docs/WRITING-FLOW.md
这一轮要做：<在这里写要干什么>
```

三条不能破的铁律：

1. **比分主队在前**（`阿森纳 2-0 曼联`，不是 `曼联 0-2 阿森纳`）
2. **当天视角**（不用「此后」「最终」「后来」）
3. **加完期次必须重排**：`node tmp/renumber-season.mjs <season>` → `node tmp/renumber-global.mjs` → 重建归档页 `node scripts/gen-archive-issues.mjs --all --pages`

常用命令：

```powershell
python serve.py 8141                    # 本地预览 ?date=2026-11-09&period=morning
node scripts/fetch-commentary.mjs 2026-27   # 抓技术统计
node scripts/gen-archive-issues.mjs --all --pages   # 只重建 archive/*.html
```

## 上传到 GitHub Desktop（每轮改完必做）

**两个位置别搞混**：

| 角色 | 路径 |
|---|---|
| 工作目录（改文件、跑脚本的地方） | `D:\Documents\deepseek-harness\default-workspace\manutd-daily` |
| Git 仓库（真正推到线上的是这个） | `D:\Documents\GitHub\manutd-daily` |

改完的东西**不会自己跑到仓库里**，必须同步一次。

**分工（2026-11-13 定）**：AI 只做到「同步 + 本地提交」，**Push 由本人点**。直连 GitHub 时不时被 reset，交给 GitHub Desktop 推更稳。

### ① 同步到仓库（AI 做）

```powershell
cd D:\Documents\deepseek-harness\default-workspace\manutd-daily
node scripts/sync-desktop.mjs
```

- 默认目标就是 `D:\Documents\GitHub\manutd-daily`，按 md5 只复制改过的文件
- 不会碰 `tmp/`、`_site/`、`.git/`
- 手动备选：`robocopy <工作目录> <仓库目录> /E /XD tmp _site data-weekly data-deep data-magazine .git /XF *.bak *.log`

### ② 本地提交（AI 做，提交完就停）

```powershell
cd D:\Documents\GitHub\manutd-daily
git add -A
git commit -m "这一轮干了什么"
git status -sb        # 应显示 [ahead N]，表示 N 个提交等推送
```

- 提交前对一眼 `git status --porcelain -uall`，别把 `tmp/`、`*.bak` 带进去
- **不 push**。AI 交付的话术是「N 个提交待推送」，不是「已上线」

### ③ Push（本人做）

1. 打开 **GitHub Desktop**
2. 左上角 **Current Repository** 选 `manutd-daily`（路径应显示 `D:\Documents\GitHub\manutd-daily`）
3. 右上角点 **Push origin**（有积压时显示 `Push N commits`）
4. 被拒（rejected）就先 **Fetch origin** → **Pull**，再 Push

### ④ 线上确认

- https://silverherring1.github.io/manutd-daily/ ，Pages 构建 1–2 分钟
- `Ctrl+Shift+R` 强刷，自查：首页是最新一期 → 日期能翻到 2018/19 → `/archive/` 列 9 季

### 注意

- 改了 `app.js` / `layout.css` / `index.html` → 先把 `index.html` 里的 `app.js?v=N` 加一，否则线上还是旧页面
- 提交前 `node scripts/check-size.mjs` 看一眼体积
- 直连 `git push` 偶尔被 reset（`Failed to connect to github.com:443`）；真要推时可加代理 `git -c http.proxy=http://127.0.0.1:7897 push`——但按分工，push 归本人
- **首次使用**：GitHub Desktop → `File` → `Clone repository` → `SilverHerring1/manutd-daily` → Local path 填 `D:\Documents\GitHub\manutd-daily`
- 详细版（含常见问题：线上没更新 / Desktop 看不到改动 / Push 被拒）见 `WRITING-FLOW.md` 第 10 节

## 现在到哪了

- 主线：**2026/27 已发 15 期**（07-13 → 11-13），手写；其中 9 期比赛稿已按 writer 重写
- 赛季归档：**9 季全部重写完**
  - 2018/19 62 · 2019/20 75 · 2020/21 70 · 2021/22 59 · 2022/23 76 · 2023/24 63 · 2024/25 70 · 2025/26 54 · 2026/27 28
  - 全站 **557 期**，期号跨季连续（1–557）
- 写作口径：正文按 football-writer、标题按 football-headline、短评按 football-note
- 新闻期（转会/场外/纪录）90 期，28 期有真图，其余走无图版式（只配相关的图）
- 仓库副本 `D:\Documents\GitHub\manutd-daily`：已同步 + 本地提交，**Push 由本人点**（分工见「上传到 GitHub Desktop」一节）
- 上线地址：https://silverherring1.github.io/manutd-daily/
- 仓库：https://github.com/SilverHerring1/manutd-daily
- 最后更新：2026-11-13（补 11/11–11/13 五期 · 卡里克下课与波切蒂诺 · DO 进信源分级）

## 2026-11-13 这一轮做了什么（补稿）
1. 主线补 5 期，553–557，全部是新闻期（11-11～11-13 没有比赛，国际比赛日）
   - 553 11-11 晚报：DO/The Athletic 独家「曼联正在敲定波切蒂诺」；格拉泽家族 50 亿英镑秘密放盘（未证实）
   - 554 11-12 早报：罗马诺口头协议、700 万英镑解约金、高层摩纳哥会面；TA 评论
   - 555 11-12 晚报：曼联官宣卡里克下课（公告中英引语）、离任过程、连续第三季中途换帅与赔偿破 1 亿英镑
   - 556 11-13 早报：B 费拒绝第二份续约报价（TA + BBC）、伤停与 11-22 复出时间
   - 557 11-13 晚报：罗马诺「已签字、周末官宣」、更衣室晒照告别、多古入选丹麦队
2. 信源分级加一层：**The Athletic 的 David Ornstein（DO）** 写进 `docs/CONVENTIONS.md` 与 README，口径是「一线独家，但仍不等于官宣」
3. 配图：头图 3 张（波切蒂诺 / Wikimedia，CC BY-SA 4.0 Bryan Berlin；老特拉福德航拍 / Wikimedia，CC BY-SA 3.0 de Arne Müseler；多古 / 曼联官网）+ 条目图 4 张（格拉泽 / 懂球帝、官宣卡里克 / 曼联官网、B 费 / BBC、球员 IG story 拼图）；555 头图沿用 `carrick.jpg`，556 头图用 `bruno.jpg`
   - 手机竖版社媒截图不直接放：两张拼成 1200×800 再插进正文（见 `tmp/make-item-images.py`）
   - 懂球帝有些配图是 AI 合成的「签约照」（6649192 那张），**不用**
   - 配图规则已写进 `docs/CONVENTIONS.md` 第六节：**不硬凑**（配不出「就是这件事」的图就空着，无图是正常形态）→ 相关才配 → 在满足前两条的前提下信源有图就用；竖图拼接，不用 AI 图
4. 脚本：`tmp/patch-news-meta.mjs`（补 kind:news 并重算计数）、`tmp/verify-issues.mjs`（期号连续 / 字数 / 来源 / 配图存在性）、`tmp/shot-news-issues.mjs`（截图核对）
5. **没跑** `renumber-*.mjs` 与 `gen-archive-issues.mjs --all --pages`：新期都在 552 之后、不挪旧号；`--pages` 会用 archive 的 15 场覆盖 2026/27 的 28 期总目
6. 载入页文案更新（`index.html` + `app.js`）：h1 从「正在载入」改成品牌名「曼联日报」，日期下加「正在读入全部期次…」；侧栏「关于」从过时的「近一个月 8 场」改成日更 + 9 季归档；页脚补 The Athletic / BBC / Sky；file:// 提示与「构建」版本号（v9→v21）一并修好；`app.js` 载入失败时把 meta 复位成「—」；载入中不再闪「第 — 期」（kicker 清空 + `.kicker:empty{display:none}`）。前端版本 v19 → **v21**
7. **2025/26 深写**：已完成 **20/40 场**（第一批 08-18 阿森纳 → 10-26 布莱顿；第二批 11-02 森林 → 12-31 狼队），正文 200–225 字 / 4 段，数据来自 `archive` + `commentary`；阿森纳那期补了阿莫林赛后原话。剩 20 场（2026-01 起），每批 10 场
8. 「名局」统一改「焦点战」：README、`gen-archive-issues.mjs`、口径文档同步；CONVENTIONS 第七节新增「焦点战（★）」判据；顺手把「归档不挂积分榜」改成「挂当时的积分榜」（跟 `app.js` 实际行为对齐）

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

- [x] 其余 8 季接入归档
- [x] 九季全部按新口径重写（战报 / 标题 / 短评）
- [x] 转会期按官宣日期拆期；场外期、纪录期补齐
- [x] 新闻期配图（只配相关的，竖图不用）
- [x] 2026/27 非主线期次重写
- [ ] `media/news/` 清理：删掉不再被引用的旧图（约 10 MB）
- [ ] 射手榜 / 助攻榜：懂球帝有现成页面（`rankingGoal` / `rankingAssist`），照 `fetch-boards.mjs` 的路子加脚本
- [ ] 搜索改成一份静态索引（现在每次全量拉 JSON，期数多了会慢）
- [ ] 重要比赛的前瞻：提前一期做首发 / 伤停 / 历史交锋

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
├── docs/                   本文件 + CONVENTIONS.md（口径）+ WRITING-FLOW.md（流程）
├── scripts/
│   ├── publish.mjs         【已废弃】旧发布包脚本，正常不用（现在是仓库根目录直接出站）
│   ├── new-issue.mjs       新建一期骨架
│   ├── fetch-boards.mjs    抓积分榜
│   ├── fetch-scorers.mjs   射手榜（未接）
│   ├── import-season.mjs   抓一季赛程 → data/archive/
│   ├── gen-archive-issues.mjs  归档一季 → 一期一期（本轮新增）
│   └── teams-cn.json       队名 / 场地中文对照（生成器用）

└── serve.py / 启动.cmd     本地预览（禁用缓存）
```

## 提交步骤（2026-11-13 起：不打发布包，增量提交）

1. 本地预览 `python serve.py` 看一眼
2. `node scripts/check-size.mjs` —— 体积 / 大文件检查
3. `git add -A`（`.gitignore` 已挡住 `tmp/`、`_site/`、变体数据、`*.bak`）
4. commit + push，GitHub Pages 直接从这个分支根目录出页
5. 线上自查：首页最新一期 → 日期能翻到 2018/19 → `/archive/` 列 9 季

`scripts/publish.mjs` 已废弃，留着只为偶尔检查「干净包」。

## 数据目录

```
data/
├── index.json          只留元信息（name / as_of）
├── seasons.json        赛季总目：各季 slug / dir / 期数 / 起止
├── focus.json          每季焦点战（★ 标在归档页）
├── records-manual.json 手写纪录条目（队史里程碑这类算不出来的）
├── team-map.json       当前英超 20 队（积分榜用）
├── boards.json         积分榜
├── commentary/<season>.json  该季解说缓存（射门/射正/时间线，fetch-commentary.mjs 写）
├── images-<season>.json      归档期次头图索引（fetch-archive-images.mjs 写）
├── players-cn.json     进球者中文名对照
└── seasons/<slug>/     该季全部期次 + index.json
```

- 新期：`node scripts/new-issue.mjs 2026-11-11 morning`，会落进对应赛季文件夹并更新索引
- **加完期次必须重排**：`node tmp/renumber-season.mjs <season>` → `node tmp/renumber-global.mjs` → 重算 `seasons.json`
- 归档页重建：`node scripts/gen-archive-issues.mjs --all --pages`（`--pages` 只写页面，不碰期次 JSON）

## 下次开工怎么接

1. 读这份 `STATUS.md`、`CONVENTIONS.md`、`WRITING-FLOW.md`
2. 主线补稿：看最新一期日期，从下一天开始补
3. 归档扩季：
   - 确认 `data/archive/<season>.json` 有进球数据
   - `node scripts/fetch-commentary.mjs <season>` 抓技术统计
   - 补 `scripts/teams-cn.json`（生成器会逐条提示缺什么）
   - `node scripts/gen-archive-issues.mjs <season>`，然后按 writer 逐期重写
4. 写、校、同步：见 `WRITING-FLOW.md`

## 历史档案

- 已导入 **9 个赛季**，在 `data/archive/2018-19.json` … `2026-27.json`
- 脚本：`node scripts/import-season.mjs 2018`（ESPN 赛程接口，一次一季）
- 每场字段：日期（北京）、时间、赛事、主客、对手、比分、胜平负、场地、进球（含点球 / 乌龙标记）
- 九季全部接入页面并重写完毕

## 发版（每次改完必须做）

按上面「上传到 GitHub Desktop」那节的三步走，别在这里另说一套：

1. `node scripts/sync-desktop.mjs` —— 工作区 → `D:\Documents\GitHub\manutd-daily`（AI）
2. 在仓库副本 `git add -A && git commit`（AI），停在 `[ahead N]`
3. GitHub Desktop → **Push origin**（本人）
4. 等一两分钟，线上自动更新

> 工作区（本目录）只是编辑用的，**真正推送的是 GitHub Desktop 的克隆目录**。
> 改完不同步，线上就一直是旧的——这个坑踩过一次。
