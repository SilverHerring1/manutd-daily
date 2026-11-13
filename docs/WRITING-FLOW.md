# 写一期日报：完整流程

> 从「今天踢完一场」到「线上能看到」，按顺序做。口径细节见 `CONVENTIONS.md`。
> 所有命令都在 `manutd-daily/` 目录下跑。

---

## 0. 开工前

```powershell
cd D:\Documents\deepseek-harness\default-workspace\manutd-daily
python serve.py 8141      # 预览（另开一个窗口，别关）
```

站内地址：`http://127.0.0.1:8141/?date=2026-11-09&period=morning`

---

## 1. 比赛期：先把事实钉死

```powershell
# 抓这场比赛的技术统计（射门、射正、时间线），缓存到 data/commentary/<season>.json
node scripts/fetch-commentary.mjs 2026-27
```

- 比分、进球者、分钟从 `data/archive/<season>.json` 拿（ESPN 导入的），**不要凭记忆写**
- 射门、射正、控球从 `data/commentary/<season>.json` 拿
- 两条对不上的时候，比分以 archive 为准，过程中的细节以解说缓存为准

## 2. 写正文（football-writer）

一场 100–250 字，3–5 个 `<p>`，写进 `body_html`：

```
【画面】一句话：谁在什么时间做了什么，带比分
【时间线】2–4 个关键节点，按分钟推进，写动作不写评价
【收尾】一个数字，或一句原话，或一个画面
```

四条硬规矩：

| 规矩 | 说明 |
|---|---|
| 开头必须是具体的画面 | 不允许「本场比赛」「双方展开激烈争夺」 |
| 数字要对得上 archive | 分钟、比分、人名，一个都不能含糊 |
| 结尾停在一个事实上 | 不写「展现了韧性」「希望球队走出低谷」 |
| 引语录进 `quote` 字段 | 不要混在 `body_html` 里 |

## 3. 起标题（football-headline）

**标准形态：`主队 比分 客队，事件`**

```
曼联 4-4 阿斯顿维拉，96分钟扳平
姆贝乌莫73分钟扳平，曼联 1-1 热刺        ← 客场常用这个倒装
曼联 0-0 纽卡斯尔，全场零射正            ← 闷平用一句判断
```

五条禁令：

- ❌ 写 `83'`、`90+6'` → 写 **83分钟**、**补时阶段**
- ❌ 名词堆叠（`VAR 点球 曼联 2-0 雷丁`）→ 必须有一个动词
- ❌ 自造词（`乌龙后抄扳`）→ 用现成的（乌龙送礼、两度落后）
- ❌ 进球数写「两个」→ **梅开二度 / 双响 / 帽子戏法**
- ❌ 一句里塞两个成语

标题 10–18 字，至少有一个数字；比赛期带「曼联」，转会/场外可以不带。

## 4. 写侧栏短评（football-note）

`note.body`，30–60 字，一期一条，**给判断，不是摘要**：

```
现象 + 判断：4-4 说明这支球队还有脾气，但第 18 名说明脾气换不来积分。
数字 + 代价：九场不胜结束在一场 3-2 里，代价是巴莱巴的腿筋和库尼亚的红牌。
```

- 不复述比分
- 至少一个具体的东西（数字、人名、时间点）
- **当天视角**：写这句话的时候，作者当时能不能知道

## 5. 落位：什么内容单独一期

| 内容 | 怎么处置 |
|---|---|
| 比赛 | 一场一期，赛后次日的早报 |
| 转会 | **一条转会一条**，放在官宣当天的早报或晚报；离队带在曼联的数据（联赛口径） |
| 场外（下课、收购、风波、抗议） | 一件事一期，放发生当天的晚报 |
| 纪录 | 次日早报，一期一条；只收历史级（队史首次、联赛纪录） |
| 杯赛夺冠回顾 | **夺冠才单独立一期**；没夺冠就并进那场比赛那一期 |
| 赛季总结 | 最后一轮之后单独一期 |

**合并原则**：同一天、同一个早/晚时段里的事，写成同一期的多个条目；不同天、或不同时段，才拆成两期。

## 6. 配图

```powershell
# 只在确认「图里就是这个人/这件事」时才配
```

规则：

- **相关才配**：文件名里要有这个人，或者就是这座球场/这个事件
- **竖图不用**：人像是竖的，裁成 16:9 就是一张贴脸大图，很难看
- **找不到就不配**：宁可无图版式，也不拿别场图、别队图、同名教堂凑
- 尺寸统一 960×540，`credit` 写来源（Wikimedia Commons / Getty / 曼联官网）
- 检索走维基共享资源，需要代理（见第 9 节）

`hero` 挂在期次上（页头大图），`image` 挂在条目上（正文里的小图）。

## 7. 期号：加完期次必须重排

期号是**跨季连续**的，加了一期，后面所有期次都要跟着动。

```powershell
node tmp/renumber-season.mjs 2026-27   # 先把这一季按日期排好
node tmp/renumber-global.mjs           # 再把 9 季全球重排
node -e "..."                          # 重算 data/seasons.json 的 count / first / last
```

顺序不能反：**先本赛季，再全球**。重排之后重建归档页：

```powershell
node scripts/gen-archive-issues.mjs --all --pages
```

`--pages` 只重建 `archive/*.html`，**不碰任何期次 JSON**（手写内容不会被覆盖）。这是加了 `--pages` 开关的原因，别用 `--all` 裸跑。

## 8. 发之前自检

```powershell
# 1) 每期比赛稿都有「N 分钟」
node -e "…"   # 逐期扫 body_html，缺分钟数的列出来

# 2) 期号连续
node -e "…"   # 各季首末期号必须首尾相接

# 3) 归档页重建过、seasons.json 数字对得上
```

人工看三处：

- 比分顺序：**主队在前**（`阿森纳 2-0 曼联`，不是 `曼联 0-2 阿森纳`）
- 视角：没有「此后」「最终」「后来」这类上帝视角
- 来源：官方 / 多家媒体 / 单一记者 / 传闻未证实，四种状态写在字面上

## 9. 网络与代理

这台机器上 Node 不走系统代理，直连维基、BBC 会被挡（DNS 投毒）。要抓图、查维基，这样跑：

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'
$env:HTTP_PROXY='http://127.0.0.1:7897'
node --use-env-proxy 脚本.mjs
```

- 能通：`en.wikipedia.org`、`commons.wikimedia.org`、ESPN API、manutd.com
- 不通：`ichef.bbci.co.uk`、`pbs.twimg.com`、`resources.premierleague.com`
- 维基会 429 限流，请求间隔放到 **1.5 秒以上**，撞到 429 就退避 20–30 秒

## 10. 发布：同步到仓库副本 → GitHub Desktop 推送

### 两个位置，别搞混

| 角色 | 路径 |
|---|---|
| **工作目录**（我改文件、跑脚本的地方） | `D:\Documents\deepseek-harness\default-workspace\manutd-daily` |
| **Git 仓库**（GitHub Desktop 用这个推送） | `D:\Documents\GitHub\manutd-daily` |

改完的东西**不会自己跑到仓库里**，必须同步一次。

### 第 1 步：bump 版本号（只在改了前端时做）

动了 `app.js` / `layout.css` / `index.html` 的话，打开 `index.html`，把 `app.js?v=N` 里的 N 加一（**现在到 v21**），页脚的「构建 vN」跟着一起改，两处保持一致。这是破浏览器缓存的，不改的话线上可能还是旧页面。

纯内容（只改 `data/`）不用动它。

### 第 2 步：把工作目录同步到仓库

```powershell
node scripts/sync-desktop.mjs
```

默认目标就是 `D:\Documents\GitHub\manutd-daily`，只复制有变化的文件（按 md5 比对），不会碰 `tmp/`、`_site/`、`.git/`。

想指定别的克隆目录：`node scripts/sync-desktop.mjs D:\别的路径`。

手动版（脚本不在时用）：

```powershell
robocopy "D:\Documents\deepseek-harness\default-workspace\manutd-daily" `
         "D:\Documents\GitHub\manutd-daily" `
         /E /XD tmp _site data-weekly data-deep data-magazine .git /XF *.bak *.log
```

- `/XD` 排除 `tmp`、`_site`、三个早期变体目录、`.git`（**千万别覆盖仓库的 .git**）
- 最后看一眼输出里的「已复制」数量，0 就是没东西要同步

### 第 3 步：确认仓库里改了什么

```powershell
cd D:\Documents\GitHub\manutd-daily
git status --porcelain -uall | Measure-Object -Line     # 待提交文件数
git status --porcelain -uall | Where-Object { $_ -match 'app\.js|index\.html|layout\.css' }
```

- 数量对不对（比如刚写完一季，应该是几十到上百个文件）
- 有没有误带 `tmp/`、`*.bak` 这类东西（`git status` 里出现就说明 `.gitignore` 没挡住）

### 第 4 步：GitHub Desktop 提交并推送

1. 打开 **GitHub Desktop**
2. 左上角 **Current Repository** 选 `manutd-daily`（本地路径显示 `D:\Documents\GitHub\manutd-daily`）
3. 左边 **Changes** 会列出所有改动，核对一眼有没有不想提交的文件（有就右键 **Ignore file**）
4. 左下角 **Summary** 写一句，例如：
   - `2018/19 全季重写：战报、标题、短评按新口径`
   - `新增 2025/26 转会期与场外期`
5. 点 **Commit to main**
6. 点右上角 **Push origin**

> 第一次在这台机器上用：GitHub Desktop → `File` → `Clone repository` → 选 `SilverHerring1/manutd-daily` → Local path 填 `D:\Documents\GitHub\manutd-daily`。

### 第 5 步：线上确认

- 地址：https://silverherring1.github.io/manutd-daily/
- Pages 构建要 1–2 分钟，等一会儿再刷，`Ctrl+Shift+R` 强刷
- 自查三处：首页是最新一期 → 日期能翻到 2018/19 → `/archive/` 列 9 季

### 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 线上还是旧内容 | JSON 被 CDN 缓存；改前端版本号，或等十分钟 |
| GitHub Desktop 里看不到改动 | 忘了跑 robocopy，或在错误的工作目录里改的 |
| 提交里混进 `tmp/` | 仓库副本的 `.gitignore` 被覆盖了；从工作目录重新同步，别手动删 |
| Push 被拒（rejected） | 先 **Fetch origin** 再 **Pull**，解决后再 Push |

---

## 一句话版本

> 抓数据 → 钉事实 → 按 writer 写画面 → 按 headline 起句子标题 → 按 note 给一句判断 → 转会/场外按日期拆期 → 加期后重排期号 → 重建归档页 → 自检 → robocopy 到 `D:\Documents\GitHub\manutd-daily` → GitHub Desktop 里 Commit + Push。
