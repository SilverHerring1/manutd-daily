/* ============================================================
   editorial-html / poster-canvas.js
   单条新闻的分享海报，全部在浏览器本地画，不经过后端。

   用法（由 app.js 按需 import）：
     const { createPoster } = await import("./poster-canvas.js");
     const { url } = await createPoster({ brand, kicker, title, summary, source, pageUrl });

   两条中文排版规则必须保留：
     - 行首不放 ，。！？；：、）》】」』 等收尾标点；
     - 行尾不放 “（《【 等起始标点。
   ============================================================ */

const WIDTH = 1080;
const HEIGHT = 1440;
const PAD = 96;

const NO_LINE_START = /^[，。！？；：、）》】」』”’…,.!?;:%)\]]+$/;
const NO_LINE_END = /[“‘（《【「『]$/;

const FONT_UI = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
// 画布只认第一个能命中的字族，所以把 Win / macOS 的系统衬线放在前面
const FONT_TEXT = '"Songti SC", "SimSun", "Noto Serif SC", serif';

// 默认配色与 design-tokens.css 对齐；调用方可以传 colors 覆盖（例如换成品牌红）
const COLORS = {
  paper: "#faf9f6",
  ink: "#171815",
  body: "#2c2d29",
  muted: "#6f7169",
  line: "#d8d4c8",
  accent: "#cc3d2d",
};

/** 把字符串切成排版单元：拉丁词整体，中文逐字 */
function tokenize(text) {
  return String(text ?? "").match(/[A-Za-z0-9][A-Za-z0-9._/+%-]*|[^\x00-\x7f]|./gu) ?? [];
}

/** 按画布宽度折行，遵守避头尾规则 */
function wrap(ctx, text, maxWidth, maxLines = Infinity) {
  const tokens = tokenize(text);
  const merged = [];

  // 收尾标点并入前一个单元；行尾的起始标点挪到下一行
  for (const token of tokens) {
    if (NO_LINE_START.test(token) && merged.length) merged[merged.length - 1] += token;
    else merged.push(token);
  }

  const lines = [];
  let line = "";

  for (const token of merged) {
    const candidate = line + token;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      if (NO_LINE_END.test(line)) {
        // 行尾是左引号/左括号：把它带到下一行
        const carry = line.slice(-1);
        lines.push(line.slice(0, -1).trimEnd());
        line = carry + token;
      } else {
        lines.push(line.trimEnd());
        line = token.trimStart();
      }
    } else {
      line = candidate;
    }
    if (lines.length >= maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line.trimEnd());

  // 超出行数上限时补省略号
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }

  return lines;
}

function paintLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((text, index) => ctx.fillText(text, x, y + index * lineHeight));
}

export async function createPoster({
  brand = "AI 早晚报",
  kicker = "",
  title = "",
  summary = "",
  source = "",
  pageUrl = location.href,
  colors = {},
} = {}) {
  if (document.fonts?.ready) {
    // 字体没就绪就画，中文衬线会退化成系统字体
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持画布");

  const C = { ...COLORS, ...colors };
  const inner = WIDTH - PAD * 2;

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 顶部朱红线
  ctx.fillStyle = C.accent;
  ctx.fillRect(PAD, PAD, 64, 6);

  ctx.textBaseline = "alphabetic";
  let y = PAD + 76;

  // 期号 / 日期
  if (kicker) {
    ctx.fillStyle = C.accent;
    ctx.font = `600 30px ${FONT_UI}`;
    ctx.fillText(String(kicker).toUpperCase(), PAD, y);
    y += 72;
  }

  // 标题：最多 3 行
  ctx.fillStyle = C.ink;
  ctx.font = `700 62px ${FONT_TEXT}`;
  const titleLines = wrap(ctx, title, inner, 3);
  paintLines(ctx, titleLines, PAD, y, 84);
  y += titleLines.length * 84 + 28;

  // 分隔线
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, y, inner, 2);
  y += 56;

  // 摘要：最多 7 行
  if (summary) {
    ctx.fillStyle = C.body;
    ctx.font = `400 34px ${FONT_TEXT}`;
    const summaryLines = wrap(ctx, summary, inner, 7);
    paintLines(ctx, summaryLines, PAD, y, 58);
  }

  // 页脚
  const footY = HEIGHT - PAD - 120;

  // 来源压在页脚上方，让短内容的版面往下沉，不空一大块
  if (source) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 26px ${FONT_UI}`;
    ctx.fillText(`来源 ${source}`, PAD, footY - 36);
  }

  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, footY, inner, 2);

  ctx.fillStyle = C.ink;
  ctx.font = `600 32px ${FONT_UI}`;
  ctx.fillText(brand, PAD, footY + 62);

  ctx.fillStyle = C.muted;
  ctx.font = `400 22px ${FONT_UI}`;
  const urlText = String(pageUrl).replace(/^https?:\/\//, "");
  ctx.fillText(wrap(ctx, urlText, inner * 0.62, 1)[0] || "", PAD, footY + 102);

  // 有二维码就画，没有就留白，绝不为了二维码再拉一个库
  if (window.QRCode && typeof window.QRCode.toCanvas === "function") {
    try {
      const qr = document.createElement("canvas");
      await window.QRCode.toCanvas(qr, pageUrl, { margin: 0, width: 132, color: { dark: C.ink, light: C.paper } });
      ctx.drawImage(qr, WIDTH - PAD - 132, footY + 24, 132, 132);
    } catch { /* 二维码失败不影响海报 */ }
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("画布导出失败"))), "image/png");
  });

  return { url: URL.createObjectURL(blob), blob, width: WIDTH, height: HEIGHT };
}
