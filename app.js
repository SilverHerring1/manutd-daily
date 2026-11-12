/* ============================================================
   editorial-html / app.js
   原生 ES module，无框架、无构建。产物直接跑在静态服务器上。

   数据契约（data/）：
     index.json          { version, name, generated_at, dates[], issues[] }
     {date}-{period}.json{ id, date, period, issue_number, title,
                           item_count, section_count, sections[], hero }
     sections[].items[]  { id, title, summary, body_html, sources[],
                           source_name, published_at }

   一条硬规矩：首屏渲染不等任何“可选”资源。
   海报模块按需 import，二维码按需加载，图片尺寸由数据自带。
   ============================================================ */

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
// ?data=data-weekly 可以指向另一套数据目录，用来对比不同编法
const DATA_DIR = new URLSearchParams(location.search).get("data") || "data";
const DATA_BASE = new URL(`./${DATA_DIR}/`, document.baseURI);

const FONT_STEPS = [
  { value: "standard", label: "标准" },
  { value: "large", label: "大" },
  { value: "extra", label: "特大" },
];
const FONT_KEY = "editorial-html:font-size";

const state = {
  index: null,
  catalog: new Map(),    // id -> 期次元信息（主线 + 各赛季归档），带 dir
  seasons: [],           // data/seasons.json 的赛季清单
  picker: { year: "", month: "" },
  cache: new Map(),      // id -> Promise<issue>
  issue: null,
  searchToken: 0,
  searchTimer: 0,
  gallery: [],           // 当前新闻的配图
  galleryAt: 0,
  posterUrl: "",
  posterItem: "",
};

/* ---------------- 纯函数 ---------------- */

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 只放行 http(s)，挡掉 javascript: 之类的来源链接；空值必须返回空串，否则会被解析成当前页 */
const safeUrl = (value) => {
  if (!value) return "";
  try {
    const url = new URL(value, document.baseURI);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

// 只在这几个区段之间补空格：汉字、假名、注音。中文标点（U+3000–303F）和全角字符不算，
// 否则「：96 分钟」会被加成「： 96 分钟」。
const CJK = "\\u2e80-\\u2fff\\u3040-\\u31ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff";
const CJK_LATIN = new RegExp(`([${CJK}])([A-Za-z0-9$])`, "g");
const LATIN_CJK = new RegExp(`([A-Za-z0-9%])([${CJK}])`, "g");

/** 盘古之白：中英文之间补一个空格。渲染前统一过一遍，别在数据里手工加。 */
function pangu(text) {
  return String(text ?? "").replace(CJK_LATIN, "$1 $2").replace(LATIN_CJK, "$1 $2");
}

/** 把 body_html 拍平成一串纯文本，用于搜索 */
function plain(html) {
  if (!html) return "";
  const node = document.createElement("div");
  node.innerHTML = String(html);
  return node.textContent.replace(/\s+/g, " ").trim();
}

const pad = (n) => String(n).padStart(2, "0");
const periodName = (p) => (p === "evening" ? "晚报" : "早报");
const editionName = (p) => (p === "evening" ? "夜间版" : "晨间版");

/** 把当前主题的 CSS 变量读出来，交给画布海报用，避免两套配色各写一遍 */
function themeColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    paper: read("--paper", "#faf9f6"),
    ink: read("--ink", "#171815"),
    body: read("--body-text", "#2c2d29"),
    muted: read("--muted", "#6f7169"),
    line: read("--line", "#e0ddd3"),
    accent: read("--accent", "#cc3d2d"),
  };
}

function dateParts(date) {
  const [year, month, day] = String(date || "").split("-");
  return { year, month: Number(month), day: Number(day) };
}

function weekdayOf(date) {
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : names[d.getDay()];
}

/* ---------------- 取数 ---------------- */

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`读取失败（${response.status}）`);
  return response.json();
}

// dir 是相对 data/ 的子目录：主线期次在根上（dir 为空），归档在各赛季目录里
const issueUrl = (entry) =>
  new URL(entry.dir ? `./${entry.dir}/${entry.id}.json` : `./${entry.id}.json`, DATA_BASE).href;

function getIssue(id) {
  const entry = state.catalog.get(id);
  if (!entry) return Promise.reject(new Error("目录里没有这一期"));
  if (!state.cache.has(id)) {
    const pending = fetchJson(issueUrl(entry)).catch((error) => {
      state.cache.delete(id);       // 失败不缓存，重试还有机会
      throw error;
    });
    state.cache.set(id, pending);
  }
  return state.cache.get(id);
}

const findIssue = (date, period) => state.catalog.get(`${date}-${period}`) ?? null;

const catalogList = () => [...state.catalog.values()];

/** 主线期次 + 各赛季归档，合成一张按 id 索引的总目。没有归档数据就只跑主线。 */
async function loadCatalog() {
  const catalog = new Map();
  for (const meta of state.index?.issues ?? []) catalog.set(meta.id, { ...meta, dir: "" });

  try {
    const seasons = await fetchJson(new URL("./seasons.json", DATA_BASE).href);
    state.seasons = seasons.seasons ?? [];
    const lists = await Promise.all(
      state.seasons.map(async (season) => {
        try {
          const index = await fetchJson(new URL(`./${season.dir}/index.json`, DATA_BASE).href);
          return (index.issues ?? []).map((meta) => ({ ...meta, dir: season.dir, season: meta.season ?? season.season }));
        } catch {
          return [];                 // 某一季坏了不该拖垮整个页面
        }
      }),
    );
    for (const list of lists) for (const meta of list) catalog.set(meta.id, meta);
  } catch {
    state.seasons = [];              // ?data=data-weekly 这类目录没有 seasons.json，正常
  }

  state.catalog = catalog;
}

/* ---------------- 渲染 ---------------- */

function applyTheme(period) {
  root.dataset.theme = period;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = period === "evening" ? "#14171c" : "#faf9f6";
}

/** 侧栏：每期可以写一段自己的短评（issue.note），没写就退回骨架里的默认文案 */
const DEFAULT_SIDE = document.getElementById("sideCard")?.innerHTML ?? "";

function renderSide(issue) {
  const card = $("sideCard");
  if (!card) return;
  const note = issue.note;
  if (!note?.body) {
    card.innerHTML = DEFAULT_SIDE;
    return;
  }
  // 热评：正文加引号，下面一个破折号加球迷名；自己写的那句两样都不加
  const isQuote = Boolean(note.credit);
  const body = isQuote ? `「${esc(pangu(note.body))}」` : esc(pangu(note.body));
  const credit = note.credit
    ? `<p class="side-credit">—— ${
        safeUrl(note.url)
          ? `<a href="${esc(safeUrl(note.url))}" target="_blank" rel="noopener noreferrer">${esc(pangu(note.credit))}</a>`
          : esc(pangu(note.credit))
      }</p>`
    : "";
  card.innerHTML =
    `<p class="side-label">${esc(pangu(note.title || "编辑短评"))}</p>` +
    `<p class="side-body">${body}</p>` +
    credit;
}

function renderMasthead(issue) {
  const { year, month, day } = dateParts(issue.date);
  // 归档期次也按期号走，抬头跟日更一致：第 N 期 · 2018/19 · 晨间版
  const kickerParts = [issue.season, editionName(issue.period)].filter(Boolean);
  $("editionKicker").textContent = issue.issue_number
    ? `第 ${issue.issue_number} 期 · ${kickerParts.join(" · ")}`
    : kickerParts.join(" · ");
  $("editionTitle").textContent = issue.title || `AI ${periodName(issue.period)}`;
  $("editionMeta").textContent = `${issue.section_count ?? "—"} 个栏目 · ${issue.item_count ?? "—"} 条`;
  $("dateFull").textContent = issue.season ? `${year} 年 ${month} 月 ${day} 日` : `${month} 月 ${day} 日`;
  $("dateWeekday").textContent = weekdayOf(issue.date);
  $("dateTrigger").disabled = false;
  $("miniEditionText").textContent = `${pad(month)}.${pad(day)} ${periodName(issue.period)}`;
  document.title = issue.season
    ? `${issue.season} · ${month} 月 ${day} 日 ${editionName(issue.period)} · ${state.index.name || ""}`.trim()
    : `${month} 月 ${day} 日 ${editionName(issue.period)} · ${state.index.name || ""}`.trim();

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.period === issue.period));
  });

  const video = $("videoLink");
  const href = safeUrl(issue.bilibili_url || issue.video_url || "");
  if (href) {
    video.href = href;
    video.hidden = false;
  } else {
    video.hidden = true;
    video.removeAttribute("href");
  }

  applyTheme(issue.period);
}

const allItems = (issue) => (issue.sections || []).flatMap((s) => (s.items || []).map((item) => ({ section: s, item })));

function renderDigest(issue) {
  const pairs = allItems(issue).slice(0, 6);
  const hero = issue.hero;
  const figure = $("digestHero");
  const image = $("digestHeroImage");

  if (hero?.src) {
    image.src = new URL(hero.src, new URL("./", location.href)).href;
    image.alt = hero.alt || "";
    if (hero.width) image.width = hero.width;
    if (hero.height) image.height = hero.height;
    figure.hidden = false;
  } else {
    figure.hidden = true;
  }

  $("digestList").innerHTML = pairs
    .map(({ section, item }, index) => {
      const title = esc(pangu(item.title || ""));
      const tag = esc(pangu(section.title || ""));
      return `<li><a href="#${esc(item.id)}">
        <span class="digest-no">${pad(index + 1)}</span>
        <span class="digest-title">${title}</span>
        <span class="digest-tag">${tag}</span>
      </a></li>`;
    })
    .join("");

  $("digest").hidden = pairs.length === 0;
}

function sourcesHtml(sources) {
  if (!Array.isArray(sources) || !sources.length) return "";
  const links = sources
    .map((source) => {
      const href = safeUrl(source?.url || "");
      if (!href) return "";
      const label = esc(source.text || new URL(href).hostname.replace(/^www\./, ""));
      return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .filter(Boolean);
  return links.length ? `<p class="story-sources">来源 ${links.join("")}</p>` : "";
}

function storyHtml(item, index) {
  const time = esc(item.published_at || "");
  // 配图：images 是数组，可以并排放 2~3 张；image 是单张的简写。
  // 一律按原比例显示、不裁切 —— 裁掉半个人是读者最在意的毛病。
  const gallery = Array.isArray(item.images) && item.images.length
    ? item.images
    : item.image?.src
      ? [item.image]
      : [];
  // 引语：中文一句 + 英文原话 + 出处，三行，不做翻译腔
  const quoteHtml = item.quote
    ? `<blockquote class="quote">
        <p class="quote-zh">「${esc(pangu(item.quote.zh || ""))}」</p>
        ${item.quote.en ? `<p class="quote-en" lang="en">“${esc(item.quote.en)}”</p>` : ""}
        <p class="quote-src">${esc(item.quote.who || "")}${item.quote.when ? ` · ${esc(item.quote.when)}` : ""}</p>
      </blockquote>`
    : "";

  const galleryHtml = gallery.length
    ? `<div class="story-gallery${gallery.length > 1 ? " is-multi" : ""}">${gallery
        .map((g) => `<img src="${esc(g.src)}" alt="${esc(g.alt || "")}" width="${g.width || 1200}" height="${g.height || 800}" loading="lazy" decoding="async" />`)
        .join("")}</div>`
    : "";
  return `<article class="story" id="${esc(item.id)}">
    <p class="story-meta">
      <span class="story-no">${pad(index + 1)}</span>
      ${item.badge ? `<img class="story-badge" src="${esc(item.badge)}" alt="" width="25" height="18" loading="lazy" />` : ""}
      <span class="story-source">${esc(pangu(item.source_name || ""))}</span>
      ${time ? `<time class="story-time">${time}</time>` : ""}
    </p>
    <h2 class="story-title">${esc(pangu(item.title || ""))}</h2>
    ${galleryHtml}
    ${item.summary ? `<p class="story-summary">${esc(pangu(item.summary))}</p>` : ""}
    ${quoteHtml}
    <!-- body_html 由构建脚本生成；外部文本必须在写入前转义，不要直传用户输入 -->
    <div class="story-body prose">${item.body_html || ""}</div>
    ${sourcesHtml(item.sources)}
    <button type="button" class="story-action" data-poster="${esc(item.id)}">生成分享海报 ↗</button>
  </article>`;
}

function renderArticles(issue) {
  const pairs = allItems(issue);
  $("articleContent").innerHTML = pairs.map(({ item }, index) => storyHtml(item, index)).join("");

  const end = $("readEnd");
  end.hidden = pairs.length === 0;
  $("readEndText").textContent = `这一期 ${pairs.length} 条读完了。`;

  // 配图可点开大图，键盘也能进
  document.querySelectorAll(".story-body img, .story-gallery img").forEach((img) => {
    img.setAttribute("tabindex", "0");
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", "放大图片");
  });

  $("directory").innerHTML = pairs
    .map(({ item }, index) => {
      const label = String(item.title || "").slice(0, 16);
      return `<a href="#${esc(item.id)}" data-target="${esc(item.id)}">${pad(index + 1)} ${esc(pangu(label))}</a>`;
    })
    .join("");

  renderIssueNav(issue);
  void renderBoard();
}

/** 期次导航：同一赛季内按「日期升序 + 早报在前」排队，取前后各一期。
    归档期次只在它自己那一季里翻，不会从 2018 直接跳到 2026。 */
function renderIssueNav(issue) {
  const nav = $("issueNav");
  if (!nav || !state.catalog.size) return;

  const rank = (i) => (i.period === "morning" ? 0 : 1);
  const seasonOf = (i) => i.season ?? "";
  const ordered = catalogList()
    .filter((i) => seasonOf(i) === seasonOf(issue))
    .sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b));
  const at = ordered.findIndex((i) => i.id === issue.id);
  const label = (i) => {
    const { year, month, day } = dateParts(i.date);
    return issue.season
      ? `${year} 年 ${month} 月 ${day} 日 ${periodName(i.period)}`
      : `${month} 月 ${day} 日 ${periodName(i.period)}`;
  };

  const cell = (target, dir) => {
    if (!target) return `<span class="issue-nav-item is-empty" aria-hidden="true"></span>`;
    return `<a class="issue-nav-item" href="?date=${esc(target.date)}&period=${esc(target.period)}"
      data-goto="${esc(target.date)}" data-goto-period="${esc(target.period)}">
      <span>${dir}</span><strong>${label(target)}</strong></a>`;
  };

  nav.innerHTML =
    cell(at > 0 ? ordered[at - 1] : null, "上一期") +
    cell(at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null, "下一期");
}

/* ---------------- 日期面板：年 / 月 / 日 三级 ---------------- */

/** 三级筛选：年（有哪些赛季年份）→ 月 → 日（那天有哪几期） */
function renderDateGrid(issue) {
  const all = catalogList();
  if (!all.length) return;

  const years = [...new Set(all.map((i) => i.date.slice(0, 4)))].sort().reverse();
  const wantYear = state.picker.year || issue?.date?.slice(0, 4) || "";
  const year = years.includes(wantYear) ? wantYear : years[0];

  const months = [...new Set(all.filter((i) => i.date.startsWith(year)).map((i) => i.date.slice(5, 7)))].sort();
  const fromIssue = issue?.date?.startsWith(year) ? issue.date.slice(5, 7) : "";
  const kept = state.picker.year === year && months.includes(state.picker.month) ? state.picker.month : "";
  const month = kept || (months.includes(fromIssue) ? fromIssue : months.at(-1));
  state.picker = { year, month };

  $("dateYears").innerHTML = years
    .map((y) => `<button type="button" data-pick-year="${y}" ${y === year ? 'aria-current="true"' : ""}>${y}</button>`)
    .join("");
  $("dateMonths").innerHTML = months
    .map((m) => `<button type="button" data-pick-month="${m}" ${m === month ? 'aria-current="true"' : ""}>${Number(m)} 月</button>`)
    .join("");

  const days = [...new Set(all.filter((i) => i.date.startsWith(`${year}-${month}`)).map((i) => i.date))].sort();
  $("dateGrid").innerHTML = days
    .map((date) => {
      const { day } = dateParts(date);
      const cells = ["morning", "evening"]
        .map((period) => {
          const target = findIssue(date, period);
          const current = issue?.date === date && issue?.period === period;
          return `<button type="button" data-pick-date="${date}" data-pick-period="${period}"
            ${target ? "" : "disabled"} ${current ? 'aria-current="true"' : ""}>${periodName(period)}</button>`;
        })
        .join("");
      return `<div class="edition-day"><span>${Number(day)} 日</span>${cells}</div>`;
    })
    .join("");

  $("pickerPath").textContent = `${year} 年 ${Number(month)} 月 · ${days.length} 天有稿`;
}

function renderEmpty(date, period) {
  const { month, day } = dateParts(date);
  $("editionKicker").textContent = editionName(period);
  $("editionTitle").textContent = "这一期还没发布";
  $("editionMeta").textContent = `${month} 月 ${day} 日 · ${periodName(period)}`;
  $("dateFull").textContent = `${month} 月 ${day} 日`;
  $("dateWeekday").textContent = weekdayOf(date);
  $("dateTrigger").disabled = false;
  $("videoLink").hidden = true;
  $("videoLink").removeAttribute("href");
  document.querySelectorAll("[data-period]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.period === period));
  });
  $("digest").hidden = true;
  $("articleContent").innerHTML = "";
  $("directory").innerHTML = "";
  $("readEnd").hidden = true;
  applyTheme(period);
  renderDateGrid({ date, period });     // 空期也要能打开日期面板换一期
  $("miniEditionText").textContent = `${pad(month)}.${pad(day)} ${periodName(period)}`;
}

/* ---------------- 路由 ---------------- */

/** 最新一期：从总目里按日期 + 早晚报挑，不再依赖 data/index.json 的 issues */
function latestIssue() {
  const list = catalogList();
  if (!list.length) return null;
  const rank = (i) => (i.period === "morning" ? 0 : 1);
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || rank(b) - rank(a))[0];
}

/** 积分榜：单独一个 data/boards.json，随抓取脚本更新，不占每期的 JSON。
    只挂在主线上：2018 年的那一期里贴 2026 年的榜，等于用后来的事写过去。 */
async function renderBoard() {
  const host = $("articleContent");
  if (!host || state.issue?.archive) return;
  let board;
  try {
    board = await fetchJson(new URL("./boards.json", DATA_BASE).href);
  } catch {
    return; // 没有榜单文件就当这段不存在
  }
  if (!board?.rows?.length) return;

  const row = (r) => `<tr${r.united ? ' class="is-united"' : ""}>
      <td class="b-rank">${r.rank}</td>
      <td class="b-team">${r.badge ? `<img src="${esc(r.badge)}" alt="" width="25" height="18" loading="lazy" />` : ""}<span>${esc(r.cn)}</span></td>
      <td>${r.played}</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td>
      <td class="b-wide">${r.gf}</td><td class="b-wide">${r.ga}</td>
      <td class="b-wide">${r.gd > 0 ? "+" + r.gd : r.gd}</td>
      <td class="b-pts">${r.pts}</td>
    </tr>`;

  host.insertAdjacentHTML("beforeend", `
    <section class="board" aria-label="${esc(board.title || "积分榜")}">
      <div class="board-head">
        <h2 class="board-title">${esc(board.title || "积分榜")}</h2>
        <span class="board-meta">更新于 ${esc(board.updated || "")}</span>
      </div>
      <table class="board-table">
        <thead><tr>
          <th>#</th><th class="b-team">球队</th><th>场</th><th>胜</th><th>平</th><th>负</th>
          <th class="b-wide">进</th><th class="b-wide">失</th><th class="b-wide">净</th><th class="b-pts">分</th>
        </tr></thead>
        <tbody>${board.rows.map(row).join("")}</tbody>
      </table>
      <p class="board-src">数据：${esc(board.source || "")}</p>
    </section>`);
}

async function choose(date, period, { scroll = "smooth" } = {}) {
  const meta = findIssue(date, period);
  if (!meta) {
    renderEmpty(date, period);
    return;
  }

  let issue;
  try {
    issue = await getIssue(meta.id);
  } catch (error) {
    notice(`这一期载入失败：${error.message}`, true);
    return;
  }

  state.issue = issue;
  renderMasthead(issue);
  renderSide(issue);
  renderDigest(issue);
  renderArticles(issue);
  renderDateGrid(issue);
  $("pageNotice").hidden = true;

  const url = new URL(location.href);
  url.searchParams.set("date", date);
  url.searchParams.set("period", period);
  history.replaceState(null, "", url);
  if (scroll === "top") window.scrollTo({ top: 0 });
}

/* ---------------- 搜索 ---------------- */

/** 并发上限：预览服务器不一定扛得住一口气几十个请求，慢慢来反而快 */
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let at = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (at < list.length) {
      const i = at++;
      try {
        out[i] = { status: "fulfilled", value: await fn(list[i]) };
      } catch (error) {
        out[i] = { status: "rejected", reason: error };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function runSearch() {
  const token = ++state.searchToken;
  const query = $("searchInput").value.trim().toLowerCase();
  const results = $("searchResults");
  results.replaceChildren();

  if (!query) {
    $("searchHint").textContent = "搜索全部期次（含赛季归档）的标题、摘要与正文。";
    return;
  }

  $("searchHint").textContent = "正在检索…";
  const issues = catalogList();
  const settled = await mapLimit(issues, 6, (issue) => getIssue(issue.id));
  if (token !== state.searchToken) return;         // 输入更快时，旧结果直接丢弃

  const matches = [];
  let failed = 0;
  settled.forEach((result) => {
    if (result.status !== "fulfilled") {
      failed += 1;
      return;
    }
    allItems(result.value).forEach(({ section, item }) => {
      const haystack = `${item.title || ""} ${item.summary || ""} ${plain(item.body_html)}`.toLowerCase();
      if (haystack.includes(query)) matches.push({ issue: result.value, section, item });
    });
  });

  $("searchHint").textContent = `找到 ${matches.length} 条${failed ? `（${failed} 期未载入）` : ""}。`;
  results.innerHTML = matches
    .slice(0, 30)
    .map(({ issue, item }, index) => {
      const snippet = esc(pangu(item.summary || "")).slice(0, 96);
      return `<button type="button" class="search-result" data-result="${index}">
        <span class="result-meta">${issue.season ? `${esc(issue.season)} · ` : ""}${esc(issue.date)} ${periodName(issue.period)}</span>
        <p class="result-title">${esc(pangu(item.title || ""))}</p>
        <p class="result-snippet">${snippet}${snippet.length >= 96 ? "…" : ""}</p>
      </button>`;
    })
    .join("");

  results.querySelectorAll("[data-result]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { issue, item } = matches[Number(button.dataset.result)];
      $("searchDialog").close();
      await choose(issue.date, issue.period, { scroll: "none" });
      document.getElementById(item.id)?.scrollIntoView({ block: "start" });
    });
  });
}

/* ---------------- 海报 ---------------- */

async function openPoster(itemId) {
  const item = allItems(state.issue ?? { sections: [] }).find(({ item }) => item.id === itemId)?.item;
  if (!item) return;
  state.posterItem = itemId;

  const dialog = $("posterDialog");
  const status = $("posterStatus");
  const preview = $("posterPreview");
  const download = $("downloadPoster");
  const share = $("sharePosterImage");

  if (state.posterUrl) URL.revokeObjectURL(state.posterUrl);
  state.posterUrl = "";
  preview.hidden = true;
  preview.removeAttribute("src");
  download.hidden = true;
  share.disabled = true;
  $("retryPoster").hidden = true;
  status.hidden = false;
  status.textContent = "正在生成…";

  if (!dialog.open) dialog.showModal();

  try {
    // 画布和二维码只在真正要海报时下载，首屏一个字节都不带
    const { createPoster } = await import(new URL("./poster-canvas.js", import.meta.url).href);
    const { url } = await createPoster({
      brand: state.index?.name || "AI 早晚报",
      kicker: `${state.issue.date} · ${periodName(state.issue.period)}`,
      title: pangu(item.title || ""),
      summary: pangu(item.summary || ""),
      source: pangu(item.source_name || ""),
      pageUrl: location.href.split("#")[0],
      colors: themeColors(),
    });
    state.posterUrl = url;
    preview.src = url;
    preview.hidden = false;
    status.hidden = true;
    download.href = url;
    download.download = `${state.issue.date}-${item.id}.png`;
    download.hidden = false;
    share.disabled = false;
  } catch (error) {
    status.hidden = false;
    status.textContent = `海报生成失败：${error.message}`;
    $("retryPoster").hidden = false;
  }
}

/* ---------------- 大图 ---------------- */

function openImage(img) {
  const story = img.closest(".story");
  state.gallery = story ? [...story.querySelectorAll(".story-body img, .story-gallery img")] : [img];
  state.galleryAt = Math.max(0, state.gallery.indexOf(img));
  paintImage();
  $("imageDialog").showModal();
}

function paintImage() {
  const img = state.gallery[state.galleryAt];
  if (!img) return;
  $("largeImage").src = img.currentSrc || img.src;
  $("largeImage").alt = img.alt || "";
  const many = state.gallery.length > 1;
  $("previousImage").hidden = !many;
  $("nextImage").hidden = !many;
  $("imagePosition").textContent = many ? `${state.galleryAt + 1} / ${state.gallery.length}` : "";
}

/* ---------------- 交互 ---------------- */

function notice(message, sticky = false) {
  const el = $("pageNotice");
  el.textContent = message;
  el.hidden = false;
  if (!sticky) setTimeout(() => { el.hidden = true; }, 2600);
}

function setFontSize(value) {
  root.dataset.fontSize = value;
  const step = FONT_STEPS.find((s) => s.value === value) ?? FONT_STEPS[0];
  $("fontSizeLabel").textContent = step.label;
  try { localStorage.setItem(FONT_KEY, value); } catch { /* 隐私模式忽略 */ }
}

function cycleFontSize() {
  const current = FONT_STEPS.findIndex((s) => s.value === root.dataset.fontSize);
  setFontSize(FONT_STEPS[(current + 1) % FONT_STEPS.length].value);
}

function updateScroll() {
  const topbar = document.querySelector(".topbar");
  topbar?.classList.toggle("is-stuck", window.scrollY > 8);

  const head = document.querySelector(".edition-head");
  const bar = $("miniBar");
  if (head && bar) bar.hidden = window.scrollY < head.offsetHeight * 0.6;

  const article = $("articleContent");
  const progress = $("miniProgress");
  if (article && progress) {
    const rect = article.getBoundingClientRect();
    const total = rect.height - window.innerHeight * 0.6;
    const passed = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
    progress.style.width = `${Math.round((passed / Math.max(total, 1)) * 100)}%`;
  }
}

function watchDirectory() {
  const links = new Map(
    [...document.querySelectorAll("#directory a")].map((a) => [a.dataset.target, a]),
  );
  if (!links.size || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-active", a.dataset.target === entry.target.id));
      });
    },
    { rootMargin: "-20% 0px -70% 0px" },
  );
  document.querySelectorAll(".story").forEach((el) => observer.observe(el));
}

/* ---------------- 启动 ---------------- */

/** 日期面板：桌面贴着日期按钮弹出，手机仍然从底部升起 */
function placeSheet() {
  const menu = $("dateMenu");
  const panel = menu.querySelector(".sheet-panel");
  if (!panel) return;

  const wide = window.innerWidth >= 768;
  menu.classList.toggle("is-popover", wide);
  panel.style.position = "";
  panel.style.left = "";
  panel.style.top = "";
  panel.style.width = "";
  if (!wide) return;

  const rect = $("dateTrigger").getBoundingClientRect();
  const width = Math.min(440, window.innerWidth - 32);
  const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
  panel.style.position = "fixed";
  panel.style.width = `${width}px`;
  panel.style.left = `${left}px`;
  panel.style.top = `${rect.bottom + 8}px`;
}

function bind() {
  document.querySelectorAll("[data-open-search]").forEach((el) =>
    el.addEventListener("click", () => {
      $("searchDialog").showModal();
      setTimeout(() => $("searchInput").focus(), 30);
    }),
  );

  $("searchInput").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchToken += 1;                       // 立刻作废旧请求
    state.searchTimer = setTimeout(() => void runSearch(), 180);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("dateMenu").hidden) {
      $("dateMenu").hidden = true;
      $("dateTrigger").setAttribute("aria-expanded", "false");
      $("dateTrigger").focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("searchDialog").showModal();
      setTimeout(() => $("searchInput").focus(), 30);
    }
  });

  document.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-close-dialog]");
    if (closer) closer.closest("dialog")?.close();

    const sheetCloser = event.target.closest("[data-close-sheet]");
    if (sheetCloser) {
      const sheet = sheetCloser.closest(".sheet");
      if (sheet) sheet.hidden = true;
      $("dateTrigger").setAttribute("aria-expanded", "false");
    }

    const picker = event.target.closest("[data-pick-date]");
    if (picker) {
      $("dateMenu").hidden = true;
      $("dateTrigger").setAttribute("aria-expanded", "false");
      void choose(picker.dataset.pickDate, picker.dataset.pickPeriod, { scroll: "top" });
      return;
    }

    // 三级筛选：点年/月只重画面板，不关面板
    const yearPick = event.target.closest("[data-pick-year]");
    if (yearPick) {
      state.picker = { year: yearPick.dataset.pickYear, month: "" };
      renderDateGrid(state.issue ?? {});
      return;
    }

    const monthPick = event.target.closest("[data-pick-month]");
    if (monthPick) {
      state.picker = { year: state.picker.year, month: monthPick.dataset.pickMonth };
      renderDateGrid(state.issue ?? {});
      return;
    }

    const goto = event.target.closest("[data-goto]");
    if (goto) {
      event.preventDefault();
      void choose(goto.dataset.goto, goto.dataset.gotoPeriod, { scroll: "top" });
    }

    const poster = event.target.closest("[data-poster]");
    if (poster) void openPoster(poster.dataset.poster);

    if (event.target.closest(".digest-hero")) {
      const img = $("digestHeroImage");
      if (img?.src) openImage(img);
    }

    const contentImage = event.target.closest(".story-body img, .story-gallery img");
    if (contentImage) openImage(contentImage);
  });

  document.addEventListener("keydown", (event) => {
    const img = event.target.closest?.(".story-body img, .story-gallery img");
    if (img && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openImage(img);
    }
  });

  $("fontSizeButton").addEventListener("click", cycleFontSize);
  $("backToTop").addEventListener("click", () => window.scrollTo({ top: 0 }));

  $("dateTrigger").addEventListener("click", () => {
    const menu = $("dateMenu");
    menu.hidden = !menu.hidden;
    $("dateTrigger").setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) placeSheet();
  });

  // 面板外点击关闭。遮罩层不接点击（见 .sheet.is-popover），所以这里统一判断：
  // 点到的不是面板本身、也不是日期按钮，就收起来。
  document.addEventListener("click", (event) => {
    const menu = $("dateMenu");
    if (menu.hidden || !menu.classList.contains("is-popover")) return;
    if (event.target.closest(".sheet-panel") || event.target.closest("#dateTrigger")) return;
    menu.hidden = true;
    $("dateTrigger").setAttribute("aria-expanded", "false");
  });

  window.addEventListener("resize", () => {
    if (!$("dateMenu").hidden) placeSheet();
  });

  document.querySelectorAll("[data-period]").forEach((button) =>
    button.addEventListener("click", () => {
      const date = state.issue?.date;
      if (date) void choose(date, button.dataset.period, { scroll: "none" });
    }),
  );

  $("shareButton").addEventListener("click", () => {
    $("shareLink").value = location.href.split("#")[0];
    $("shareDialog").showModal();
    $("shareLink").select();
  });

  $("copyShareLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("shareLink").value);
      $("shareMessage").textContent = "已复制。";
    } catch {
      $("shareMessage").textContent = "复制失败，请手动选中。";
    }
  });

  $("retryPoster").addEventListener("click", () => {
    if (state.posterItem) void openPoster(state.posterItem);
  });

  $("sharePosterImage").addEventListener("click", async () => {
    if (!state.posterUrl || !navigator.canShare) return;
    try {
      const blob = await (await fetch(state.posterUrl)).blob();
      const file = new File([blob], "poster.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    } catch { /* 用户取消不报错 */ }
  });

  $("previousImage").addEventListener("click", () => {
    state.galleryAt = (state.galleryAt - 1 + state.gallery.length) % state.gallery.length;
    paintImage();
  });
  $("nextImage").addEventListener("click", () => {
    state.galleryAt = (state.galleryAt + 1) % state.gallery.length;
    paintImage();
  });

  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });
}

async function init() {
  bind();

  let saved = "standard";
  try { saved = localStorage.getItem(FONT_KEY) || "standard"; } catch { /* ignore */ }
  setFontSize(FONT_STEPS.some((s) => s.value === saved) ? saved : "standard");

  try {
    state.index = await fetchJson(new URL("./index.json", DATA_BASE).href);
  } catch (error) {
    notice(`目录载入失败：${error.message}。请通过 http 地址打开，例如 python -m http.server。`, true);
    $("editionTitle").textContent = "暂时无法载入";
    return;
  }

  await loadCatalog();

  const query = new URLSearchParams(location.search);
  const latest = latestIssue();
  if (!latest) {
    notice("还没有任何一期可以显示。", true);
    return;
  }

  const wantDate = query.get("date");
  const wantPeriod = ["morning", "evening"].includes(query.get("period")) ? query.get("period") : null;
  let date = latest.date;
  let period = latest.period;
  let fallback = "";

  if (wantDate) {
    const hit = (wantPeriod && findIssue(wantDate, wantPeriod)) || findIssue(wantDate, "morning") || findIssue(wantDate, "evening");
    if (hit) {
      date = hit.date;
      period = hit.period;
    } else {
      fallback = `没有 ${wantDate} 这一期，先看最近一期。`;
    }
  } else if (!findIssue(date, period)) {
    fallback = `这一期${periodName(period)}还没发布，先看最近的${periodName(latest.period)}。`;
    date = latest.date;
    period = latest.period;
  }

  await choose(date, period, { scroll: "none" });
  watchDirectory();
  updateScroll();
  root.classList.add("theme-ready");
  if (fallback) notice(fallback);

  const newsId = query.get("news");
  if (newsId) requestAnimationFrame(() => document.getElementById(newsId)?.scrollIntoView({ block: "start" }));
}

void init();
