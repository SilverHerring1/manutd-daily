# 项目状态

> 每次开工先读这份，收工更新这份。聊天记录会丢，这里不会。

## 现在到哪了

- 已发布：10 期（10-11 → 11-10），含 11-07 的发布会特刊
- 上线地址：https://silverherring1.github.io/manutd-daily/
- 仓库：https://github.com/SilverHerring1/manutd-daily
- 最后更新：2026-11-10 晚

## 待办

- [ ] 上传 `manifest.webmanifest` + 新 `index.html`（装应用要用）
- [ ] `media/` 压图：现在 3.3 MB，目标 1.5 MB 以内（转 webp，1200px 宽够用）
- [ ] 下一期起混用多来源：懂球帝/直播吧找线索，官网核事实，英媒取观点
- [ ] 11-22 客场利物浦这场要提前一期做前瞻（首发/伤停/历史交锋）
- [ ] 考虑加「月度精选」：把一个月的最好几篇挑出来重发

## 已知问题

- 国内访问 GitHub Pages 时快时慢，别人打不开大概率不是内容问题
- 图片版权：比赛图来自官网，个人使用可以，别公开分发
- `new-issue.mjs` 只生成骨架，内容要手填（没有自动抓取）

## 文件地图

```
manutd-daily/
├── index.html            页面骨架（结构、文案）
├── design-tokens.css     配色与字号（换肤只改这里）
├── layout.css            版式
├── app.js                路由、渲染、搜索、双语引语
├── poster-canvas.js      单条新闻海报
├── manifest.webmanifest  让浏览器能"装成应用"
├── data/                 10 期内容（唯一的内容源）
├── media/                图片 + CREDITS.md（图源对照表）
├── docs/                 本文件 + CONVENTIONS.md（口径）
├── scripts/
│   ├── publish.mjs       生成 _site 发布包
│   └── new-issue.mjs     新建一期骨架
├── _site/                发布包（上传 GitHub 的就是这个）
└── serve.py / 启动.cmd   本地预览（禁用缓存）
```

## 数据目录说明

- `data/` 是**日更版**（主线）
- `data-weekly/` `data-deep/` `data-magazine/` 是早期对比用的三种编法，用 `?data=` 切换。**已决定用日更**，这三个可以删，也可以留着当参照。

## 下次开工怎么接

1. 读这份 `STATUS.md` 和 `CONVENTIONS.md`
2. 看 `data/index.json` 最后一期的日期，从下一天开始补
3. 抓素材 → 写 JSON → `publish` → 上传
