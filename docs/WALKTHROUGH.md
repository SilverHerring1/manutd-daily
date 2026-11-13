# 走一遍：一个 JSON 怎么变成页面

> 目标不是"学会编程"，是"能读懂这一条链路、能改得动"。
> 边看边开两个文件：`app.js`（用 VS Code 或记事本打开）和 `data/2026-11-10-evening.json`。
> 行号以当前版本为准，改过代码可能会偏移几行，按函数名找。

---

## 一条链路，四步

```
① data/index.json        期次目录：有哪些天、哪几期
② getIssue(id)           按 id 取某一期的数据（第 115 行）
③ storyHtml(item, index) 把一条数据拼成 HTML 字符串（第 229 行）
④ innerHTML = ...        把字符串塞进页面（第 269 行 renderArticles）
```

这四步读通，整套代码都是它的变体。

---

## ① 数据长什么样

打开 `data/index.json`：

```json
"issues": [
  { "id": "2026-11-10-evening", "date": "2026-11-10", "period": "evening",
    "title": "曼联晚报", "item_count": 5, "hero": { "src": "./media/fans.jpg" } }
]
```

打开对应那期的 `data/2026-11-10-evening.json`，里面是：

```json
"sections": [
  { "title": "场外要闻",
    "items": [ { "id": "carrick", "title": "卡里克下课进入倒计时", "summary": "...", "body_html": "<p>...</p>" } ]
  }
]
```

**`items` 里的一条，就是页面上的一篇新闻。**

## ② 怎么取到的

`app.js` 第 19–20 行：

```js
const DATA_DIR = new URLSearchParams(location.search).get("data") || "data";
const DATA_BASE = new URL(`./${DATA_DIR}/`, document.baseURI);
```

意思是：地址栏有 `?data=xxx` 就用 `xxx/` 目录，没有就用 `data/`。这就是三种编法共用一个页面的原理。

第 115 行 `getIssue(id)`：把 `2026-11-10-evening` 拼成 `data/2026-11-10-evening.json`，`fetch` 下来，存进缓存（同一期不重复下载）。

## ③ 怎么变成标签

第 229 行 `storyHtml()`，核心就三句（自己打开看，大约在 229–265 行）：

```js
return `<article class="story" id="${esc(item.id)}">
  <h2 class="story-title">${esc(pangu(item.title || ""))}</h2>
  ${galleryHtml}
  ${item.summary ? `<p class="story-summary">${esc(pangu(item.summary))}</p>` : ""}
  <div class="story-body prose">${item.body_html || ""}</div>
</article>`;
```

三个要认出的东西：

| 写法 | 意思 |
|---|---|
| 反引号 ` `...` ` 包起来 | 模板字符串：里面 `${}` 会被替换成变量的值 |
| `${item.title}` | 取这条数据的标题字段 |
| `esc(...)` | 转义尖括号和引号，防止内容里的 `<` 破坏页面 |
| `pangu(...)` | 中英文之间补空格（「曼联 4-4 维拉」） |

**改动就在这里改。** 比如想让来源显示在标题上面，把 `${sourcesHtml(item.sources)}` 这一行挪到 `<h2>` 上面就行。

## ④ 怎么进页面

第 269 行 `renderArticles()`：

```js
$("articleContent").innerHTML = pairs.map(({ item }, index) => storyHtml(item, index)).join("");
```

`$` 是 `document.getElementById` 的简写；`allItems(issue)` 把各个 section 的 items 拍平成一条列表；`map` 对每条调用 `storyHtml`；`join("")` 拼成一个大字符串；`innerHTML` 塞进页面。

**到这里，数据就变成页面了。**

---

## 三个练习（每个 10 分钟，都能立刻看到效果）

### 练习 1：换颜色

打开 `design-tokens.css`，第 20 行附近：

```css
--accent: #da291c;
```

改成 `#0057b8`（蓝色），刷新页面 —— 全文的红色都变了。

改完记得改回去。这一步的意义：**样式是变量控制的，不是散落在各处的**。

### 练习 2：加粗一句话

打开某一期的 JSON，在 `body_html` 里：

```json
"body_html": "<p>这场平局让曼联保住了「没输」</p>"
```

改成：

```json
"body_html": "<p>这场平局让曼联<strong>保住了「没输」</strong></p>"
```

刷新 —— 那半句变粗了。这一步的意义：**`body_html` 就是 HTML 片段，`<strong>` `<em>` `<br>` 都能用**。

### 练习 3：改动结构

打开 `app.js`，找到 `storyHtml`（搜索这个词），在 `<h2>` 那行的**上面**加一行：

```js
<p class="story-meta">${esc(item.source_name || "")}</p>
```

刷新 —— 每条新闻上面多了一个来源标签。

（想撤销：Ctrl+Z 撤销，或者 `git checkout app.js`）

这一步的意义：**你已经在改逻辑了，不是改文案**。

---

## 改坏了怎么办

1. **Ctrl+Z**（编辑器里）
2. **关掉页面重新打开**（浏览器缓存的话 Ctrl+Shift+R）
3. **git**：`git status` 看改了啥，`git checkout 文件名` 恢复
4. 找不到原因就问我，**把控制台（F12）的红字发我**

## 常用的"我想改 X"

| 想改 | 去哪 |
|---|---|
| 配色、字号、栏宽 | `design-tokens.css` 的 `:root` |
| 版式（间距、边框、栅格） | `layout.css` |
| 某条新闻的文案 | 对应 `data/*.json` 的 `title` / `summary` / `body_html` |
| 页脚、顶栏这类固定文案 | `index.html` |
| 搜索、日期面板、渲染逻辑 | `app.js` |
| 新建一期 | `node scripts/new-issue.mjs 2026-11-11 morning`，然后按 `WRITING-FLOW.md` 走 |
| 写作口径 | `CONVENTIONS.md`（标题 / 正文 / 短评 / 配图 / 期号） |
| 发布 | 同步到仓库副本 → GitHub Desktop 里 commit + push（没有 `_site`、不用 `publish.mjs`） |

---

## 想写一期？看 `WRITING-FLOW.md`

这份文档讲的是「页面怎么渲染」，写稿的步骤在 `WRITING-FLOW.md`：抓数据 → 钉事实 → 写正文 → 起标题 → 写短评 → 拆期 → 重排期号 → 自检 → 发布。
