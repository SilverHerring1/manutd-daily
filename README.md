# 曼联日报

> 一天一期，把曼联的近况读完。比赛战报、发布会原话、伤病和数据，都在一页里。

🔗 **在线阅读** → https://silverherring1.github.io/manutd-daily/

同一份内容，**早报是纸白、晚报是夜黑**——配色跟着时段走，不跟系统深色模式走。

**早报 · 白天，浅色**

![早报](screenshot-morning.png)

**晚报 · 夜间，深色**

![晚报](screenshot-evening.png)

---

## 这是什么

一个仿报纸排版的曼联资讯页。不是新闻 App，也不是数据站，就是**每天花五分钟读完一期**的那种东西。

内容包括：

- **比赛战报**：比分、进球、关键判罚，一场一篇
- **发布会原话**：中英对照，挑最重要的那几句
- **场外要闻**：帅位、伤病、球迷
- **数据面板**：积分、丢球、近八场走势

排期规则：一场比赛进**赛后次日**的早报，当天傍晚的新闻进当天晚报。时间统一用**北京时间**。

## 怎么用

直接打开上面的链接。手机上也能看，早报是浅色、晚报是深色，字号可以调。

- `Ctrl + K` 搜索全部期次（球员、对手、赛事都行）
- 点日期可以翻以前的期
- 每篇新闻底下有「生成分享海报」，能存成图

## 内容来源

| 级别 | 来源 |
|---|---|
| 事实基准 | 曼联官网（战报、发布会全文） |
| 分析评论 | BBC、Sky Sports、曼彻斯特晚报、Evening Standard |
| 线索与中文表述 | 懂球帝、直播吧 |
| 传闻 | X 上的跟队记者，均标注「未证实」 |

官方没发声的事，写「尚无官方声明」，不替它下结论。每条新闻都附原文链接。

## 关于

个人练手项目，用纯 HTML/CSS/JS 写的，没有框架、不用构建。内容靠人工整理，AI 只参与查资料和排版。

比赛照片来自曼联官网（版权属曼联 / Getty Images），仅作个人阅读使用。

---

<details>
<summary>开发与维护</summary>

- **技术**：原生 ES module，数据在 `data/`，一期一个 JSON；页面由 `app.js` 渲染
- **本地预览**：双击 `启动.cmd`（带 no-cache 的服务器），或 `python serve.py`
- **发布**：`node scripts/publish.mjs` 生成 `_site/`，上传到仓库根目录
- **新建一期**：`node scripts/new-issue.mjs 2026-11-11 morning`

详细文档：

- [`docs/STATUS.md`](docs/STATUS.md) —— 做到哪了、待办
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) —— 编辑口径（时间、视角、图片、来源）
- [`docs/DECISIONS.md`](docs/DECISIONS.md) —— 为什么这么定
- [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) —— 一个 JSON 怎么变成页面

</details>
